import path from "node:path";
import type { HarnessRequest, SavedWorkflow, WorkflowRunRecord } from "../types.js";
import { ensureDir, pathExists, readJson, slugify, writeJson } from "../utils/fs.js";

function runtimePaths(): { runtimeRoot: string; runsDir: string; workflowsDir: string; indexPath: string } {
  const runtimeRoot = process.env.HARNESS_RUNTIME_ROOT?.trim() || ".harness";
  const runsDir = path.join(runtimeRoot, "runs");
  return {
    runtimeRoot,
    runsDir,
    workflowsDir: path.join(runtimeRoot, "workflows"),
    indexPath: path.join(runsDir, "index.json"),
  };
}

export function createRunId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `run-${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createRunRecord(record: WorkflowRunRecord): Promise<WorkflowRunRecord> {
  await ensureRuntimeDirs();
  await writeRunRecord(record);
  await upsertRunIndex(record);
  return record;
}

export async function completeRunRecord(runId: string, updates: Partial<WorkflowRunRecord>): Promise<WorkflowRunRecord> {
  const current = await readRunRecord(runId);
  const next: WorkflowRunRecord = {
    ...current,
    ...updates,
    runId,
    completedAt: updates.completedAt ?? new Date().toISOString(),
  };
  await writeRunRecord(next);
  await upsertRunIndex(next);
  return next;
}

export async function readRunRecord(runId: string): Promise<WorkflowRunRecord> {
  return readJson<WorkflowRunRecord>(runRecordPath(runId));
}

export async function listRunRecords(): Promise<WorkflowRunRecord[]> {
  const { indexPath } = runtimePaths();
  if (!(await pathExists(indexPath))) {
    return [];
  }
  const index = await readJson<Array<{ runId: string }>>(indexPath);
  const records: WorkflowRunRecord[] = [];
  for (const item of index) {
    const target = runRecordPath(item.runId);
    if (await pathExists(target)) {
      records.push(await readJson<WorkflowRunRecord>(target));
    }
  }
  return records.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function saveWorkflowFromRun(runId: string, name: string): Promise<SavedWorkflow> {
  const record = await readRunRecord(runId);
  const normalizedName = slugify(name);
  const workflow: SavedWorkflow = {
    name: normalizedName,
    sourceRunId: runId,
    savedAt: new Date().toISOString(),
    request: {
      ...record.request,
      outputDir: record.request.outputDir || record.outputDir,
    },
    harnessSpecId: record.harnessSpecId,
    notes: [
      "Saved from a verified workflow run.",
      "Runtime arguments may override intent, sources, mode, and output directory at launch.",
    ],
  };
  await ensureRuntimeDirs();
  await writeJson(savedWorkflowPath(normalizedName), workflow);
  return workflow;
}

export async function readSavedWorkflow(name: string): Promise<SavedWorkflow> {
  return readJson<SavedWorkflow>(savedWorkflowPath(slugify(name)));
}

export async function listSavedWorkflows(): Promise<SavedWorkflow[]> {
  const { workflowsDir } = runtimePaths();
  if (!(await pathExists(workflowsDir))) {
    return [];
  }
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(workflowsDir)).filter((file) => file.endsWith(".json"));
  const workflows: SavedWorkflow[] = [];
  for (const file of files) {
    workflows.push(await readJson<SavedWorkflow>(path.join(workflowsDir, file)));
  }
  return workflows.sort((a, b) => a.name.localeCompare(b.name));
}

export function runRecordPath(runId: string): string {
  const { runsDir } = runtimePaths();
  return path.join(runsDir, runId, "run-state.json");
}

export function savedWorkflowPath(name: string): string {
  const { workflowsDir } = runtimePaths();
  return path.join(workflowsDir, `${slugify(name)}.json`);
}

export async function ensureRuntimeDirs(): Promise<void> {
  const { runtimeRoot, runsDir, workflowsDir } = runtimePaths();
  await ensureDir(runsDir);
  await ensureDir(workflowsDir);
  await ensureDir(path.join(runtimeRoot, "traces"));
  await ensureDir(path.join(runtimeRoot, "profiles"));
  await ensureDir(path.join(runtimeRoot, "validators"));
  await ensureDir(path.join(runtimeRoot, "harnesses"));
}

export function mergeRequests(base: HarnessRequest, overrides: Partial<HarnessRequest>): HarnessRequest {
  return {
    ...base,
    ...overrides,
    controls: overrides.controls ?? base.controls ?? [],
    sources: overrides.sources ?? base.sources ?? [],
    outputDir: overrides.outputDir ?? base.outputDir,
  };
}

async function writeRunRecord(record: WorkflowRunRecord): Promise<void> {
  await writeJson(runRecordPath(record.runId), record);
}

async function upsertRunIndex(record: WorkflowRunRecord): Promise<void> {
  const { indexPath } = runtimePaths();
  const current = (await pathExists(indexPath)) ? await readJson<Array<{ runId: string; startedAt: string; status: WorkflowRunRecord["status"] }>>(indexPath) : [];
  const filtered = current.filter((item) => item.runId !== record.runId);
  filtered.unshift({ runId: record.runId, startedAt: record.startedAt, status: record.status });
  await writeJson(indexPath, filtered.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
}
