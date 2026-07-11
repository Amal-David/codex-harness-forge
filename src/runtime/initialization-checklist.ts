import { readFile } from "node:fs/promises";
import path from "node:path";
import type { HarnessSpec, TraceEvent, ValidationResult } from "../types.js";
import { pathExists, stableId, writeJson } from "../utils/fs.js";
import { PACKAGE_ROOT } from "../utils/package-paths.js";
import { traceEvent } from "./trace-ledger.js";
import type { RunPlan } from "./run-plan.js";

export const INITIALIZATION_CHECKLIST_ARTIFACT = "initialization-checklist.json";

interface InitializationChecklistInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  runPlan: RunPlan;
  planningArtifacts: string[];
}

export interface InitializationChecklistResult {
  artifact: string;
  checklist: InitializationChecklist;
  validation: ValidationResult;
}

export interface InitializationChecklist {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail" | "warning";
  lifecyclePhase: "initialization";
  rule: string;
  commands: {
    install: string;
    build?: string;
    test?: string;
    appWorkflowEval?: string;
  };
  projectStructure: Array<{
    path: string;
    present: boolean;
    purpose: string;
  }>;
  checks: InitializationCheck[];
}

interface InitializationCheck {
  id: string;
  status: "pass" | "fail" | "warning";
  details: string;
  evidence: string[];
}

interface PackageMetadata {
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
}

export async function writeInitializationChecklist(input: InitializationChecklistInput): Promise<InitializationChecklistResult> {
  const checklist = await buildInitializationChecklist(input);
  const artifact = INITIALIZATION_CHECKLIST_ARTIFACT;
  const target = path.join(input.outputDir, artifact);
  await writeJson(target, checklist);
  return {
    artifact,
    checklist,
    validation: {
      id: "initialization_checklist_confirmed",
      name: "Initialization checklist confirmed",
      status: checklist.status,
      details:
        checklist.status === "pass"
          ? "Fresh-session initialization can start, test, see progress, and pick next work from repository and run artifacts."
          : `Initialization checklist has non-passing check(s): ${checklist.checks.filter((check) => check.status !== "pass").map((check) => check.id).join(", ")}.`,
      evidence: [target],
      repairable: true,
    },
  };
}

export function initializationChecklistEvents(runId: string, result: InitializationChecklistResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.initialization.checked",
      artifactId: result.artifact,
      status: result.validation.status,
      message: `Initialization checklist completed with status ${result.checklist.status}.`,
      evidence: [result.artifact],
    }),
  ];
}

async function buildInitializationChecklist(input: InitializationChecklistInput): Promise<InitializationChecklist> {
  const packageJsonPath = path.resolve(PACKAGE_ROOT, "package.json");
  const packageMetadata = await readPackageMetadata(packageJsonPath);
  const scripts = packageMetadata?.scripts ?? {};
  const structure = await projectStructure(PACKAGE_ROOT);
  const checks: InitializationCheck[] = [
    {
      id: "start-command-declared",
      status: packageMetadata && scripts.build ? "pass" : "fail",
      details: scripts.build ? `Build command is declared as npm run build: ${scripts.build}.` : "No build command is declared in package.json.",
      evidence: ["package.json"],
    },
    {
      id: "test-command-declared",
      status: packageMetadata && scripts.test ? "pass" : "fail",
      details: scripts.test ? `Test command is declared as npm test: ${scripts.test}.` : "No test command is declared in package.json.",
      evidence: ["package.json"],
    },
    {
      id: "progress-surface-ready",
      status: ["feature-list.json", "feature-scheduler.json", "progress.md", "sprint-contract.json", "verification-hierarchy.json"].every((artifact) => input.planningArtifacts.includes(artifact)) ? "pass" : "fail",
      details: `${input.planningArtifacts.length} initialization planning artifact(s) are written before runtime execution.`,
      evidence: input.planningArtifacts,
    },
    {
      id: "task-breakdown-ready",
      status: input.spec.harnessModel.featureList.length > 0 && input.spec.harnessModel.sprintContract.featureIds.length === input.spec.harnessModel.featureList.length ? "pass" : "fail",
      details: `${input.spec.harnessModel.featureList.length} feature row(s) and ${input.runPlan.nodeCount} run-plan node(s) define next work.`,
      evidence: ["feature-list.json", "sprint-contract.json", "run-plan.json"],
    },
    {
      id: "project-structure-readable",
      status: structure.every((entry) => entry.present) ? "pass" : "warning",
      details: structure.every((entry) => entry.present)
        ? "Core source, test, capability, worker-contract, and script directories are present."
        : `Missing optional structure: ${structure.filter((entry) => !entry.present).map((entry) => entry.path).join(", ")}.`,
      evidence: structure.map((entry) => entry.path),
    },
    {
      id: "fresh-session-entrypoints",
      status: packageMetadata && input.planningArtifacts.includes("progress.md") ? "pass" : "fail",
      details: "A fresh session can find package commands plus the current progress artifact without conversation context.",
      evidence: ["package.json", "README.md", "progress.md"],
    },
  ];
  return {
    schemaVersion: 1,
    id: stableId("initialization-checklist", `${input.runId}:${checks.map((check) => `${check.id}:${check.status}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status: checks.some((check) => check.status === "fail") ? "fail" : checks.some((check) => check.status === "warning") ? "warning" : "pass",
    lifecyclePhase: "initialization",
    rule: "Initialization is complete only when a fresh session can start, test, see progress, and pick the next scoped work before implementation begins.",
    commands: {
      install: "npm install",
      build: scripts.build ? "npm run build" : undefined,
      test: scripts.test ? "npm test" : undefined,
      appWorkflowEval: scripts["eval:app-workflows"] ? "npm run eval:app-workflows" : undefined,
    },
    projectStructure: structure,
    checks,
  };
}

async function readPackageMetadata(packageJsonPath: string): Promise<PackageMetadata | undefined> {
  if (!(await pathExists(packageJsonPath))) {
    return undefined;
  }
  return JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageMetadata;
}

async function projectStructure(rootDir: string) {
  const entries = [
    { path: "dist", purpose: "compiled runtime and compiler modules" },
    { path: "capability-packs", purpose: "dynamic domain manifests" },
    { path: "worker-contracts", purpose: "stable worker function contracts" },
    { path: "schemas", purpose: "published runtime artifact schemas" },
    { path: "README.md", purpose: "installed package entrypoint guidance" },
  ];
  return Promise.all(
    entries.map(async (entry) => ({
      ...entry,
      present: await pathExists(path.resolve(rootDir, entry.path)),
    })),
  );
}
