import { readdir } from "node:fs/promises";
import path from "node:path";
import type { HarnessSpec, TraceEvent, ValidationResult, ValidatorStatus } from "../types.js";
import { pathExists, readJson, stableId, writeJson } from "../utils/fs.js";
import type { StartupReadiness } from "./runtime-control-plane.js";
import type { VerificationPipelineLedger } from "./verification-pipeline-ledger.js";
import { traceEvent } from "./trace-ledger.js";

export const SESSION_CLEAN_STATE_LEDGER_ARTIFACT = "session-clean-state-ledger.json";
export const SESSION_CLEAN_STATE_VALIDATION_ID = "session_clean_state_ready";

type CleanStateStatus = "pass" | "fail" | "warning";

interface SessionCleanStateLedgerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  artifacts: string[];
  validations: ValidationResult[];
  startupReadiness: StartupReadiness;
  verificationPipelineLedger: VerificationPipelineLedger;
}

export interface SessionCleanStateLedgerResult {
  artifact: string;
  ledger: SessionCleanStateLedger;
  validation: ValidationResult;
}

export interface SessionCleanStateLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: CleanStateStatus;
  rule: string;
  summary: {
    checkCount: number;
    passedCheckCount: number;
    warningCheckCount: number;
    failedCheckCount: number;
    staleArtifactCount: number;
    nonPassingValidationCount: number;
    missingRequiredArtifactCount: number;
  };
  checks: CleanStateCheck[];
  staleArtifacts: Array<{
    path: string;
    reason: string;
  }>;
  unresolved: Array<{
    id: string;
    status: "fail" | "warning";
    reason: string;
    evidence: string[];
  }>;
}

interface CleanStateCheck {
  id: string;
  status: CleanStateStatus;
  details: string;
  evidence: string[];
}

interface InitializationChecklist {
  commands?: {
    install?: string;
    build?: string;
    test?: string;
    dev?: string;
  };
}

export async function writeSessionCleanStateLedger(input: SessionCleanStateLedgerInput): Promise<SessionCleanStateLedgerResult> {
  const ledger = await buildSessionCleanStateLedger(input);
  const target = path.join(input.outputDir, SESSION_CLEAN_STATE_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: SESSION_CLEAN_STATE_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: SESSION_CLEAN_STATE_VALIDATION_ID,
      name: "Session clean state ready",
      status: ledger.status,
      details: validationDetails(ledger),
      evidence: [target],
      repairable: true,
    },
  };
}

export function sessionCleanStateEvents(runId: string, result: SessionCleanStateLedgerResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.clean_state.recorded",
      artifactId: SESSION_CLEAN_STATE_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Recorded ${result.ledger.checks.length} clean-state check(s) with status ${result.ledger.status}.`,
      evidence: [SESSION_CLEAN_STATE_LEDGER_ARTIFACT],
    }),
  ];
}

async function buildSessionCleanStateLedger(input: SessionCleanStateLedgerInput): Promise<SessionCleanStateLedger> {
  const artifacts = new Set(input.artifacts);
  const validationsById = new Map(input.validations.map((validation) => [validation.id, validation]));
  const initializationChecklist = await readInitializationChecklist(input.outputDir);
  const staleArtifacts = await findStaleArtifacts(input.outputDir);
  const requiredHandoffArtifacts = [
    "feature-list.json",
    "progress.md",
    "session-handoff.md",
    "verification-hierarchy.json",
    "context-budget-ledger.json",
    "environment-readiness-ledger.json",
    "source-of-record-ledger.json",
    "architecture-boundary-ledger.json",
    "evaluator-rubric.json",
    "evaluator-rubric.md",
    "completion-authority-ledger.json",
    "continuity-ledger.json",
    "course-alignment-ledger.json",
    "verification-pipeline-ledger.json",
    "quality-document.json",
    "quality-document.md",
    "harness-quality-ledger.json",
    "validation-report.md",
    "harness-trace.json",
    "events.jsonl",
    "run-state.json",
  ];
  const missingRequiredArtifacts = requiredHandoffArtifacts.filter((artifact) => !artifacts.has(artifact) && artifact !== "run-state.json" && artifact !== "validation-report.md" && artifact !== "harness-trace.json" && artifact !== "events.jsonl");
  const failedValidations = input.validations.filter((validation) => validation.status === "fail");
  const warningValidations = input.validations.filter((validation) => validation.status === "warning" || validation.status === "skipped");
  const checks: CleanStateCheck[] = [
    {
      id: "startup-commands-declared",
      status: initializationChecklist?.commands?.build && initializationChecklist.commands.test ? "pass" : "fail",
      details: initializationChecklist?.commands?.build && initializationChecklist.commands.test ? `Build and test commands are declared: ${initializationChecklist.commands.build}; ${initializationChecklist.commands.test}.` : "Build and test commands were not declared in initialization-checklist.json.",
      evidence: ["initialization-checklist.json"],
    },
    {
      id: "validation-state-clean",
      status: failedValidations.length ? "fail" : warningValidations.length ? "warning" : "pass",
      details: failedValidations.length
        ? `Failed validation(s) remain: ${failedValidations.map((validation) => validation.id).join(", ")}.`
        : warningValidations.length
          ? `Warning/skipped validation(s) remain: ${warningValidations.map((validation) => validation.id).join(", ")}.`
          : `${input.validations.length} validation(s) are passing.`,
      evidence: ["validation-report.md", ...input.validations.flatMap((validation) => validation.evidence ?? [])],
    },
    {
      id: "progress-and-handoff-recorded",
      status: missingRequiredArtifacts.length ? "fail" : "pass",
      details: missingRequiredArtifacts.length ? `Missing handoff artifact(s): ${missingRequiredArtifacts.join(", ")}.` : "Feature state, progress, handoff, validation, trace, event, and run-state artifacts are declared for handoff.",
      evidence: requiredHandoffArtifacts,
    },
    {
      id: "stale-artifacts-absent",
      status: staleArtifacts.length ? "warning" : "pass",
      details: staleArtifacts.length ? `${staleArtifacts.length} stale temporary artifact candidate(s) remain in the run output.` : "No stale temporary artifact candidates were found in the run output.",
      evidence: staleArtifacts.map((artifact) => artifact.path),
    },
    {
      id: "startup-path-available",
      status: input.startupReadiness.status === "fail" || validationsById.get("startup_readiness_confirmed")?.status === "fail" ? "fail" : input.startupReadiness.status === "warning" || validationsById.get("startup_readiness_confirmed")?.status === "warning" ? "warning" : "pass",
      details: `startup-readiness=${input.startupReadiness.status}, startup_readiness_confirmed=${validationsById.get("startup_readiness_confirmed")?.status ?? "missing"}.`,
      evidence: ["startup-readiness.json"],
    },
    {
      id: "completion-and-handoff-gates-clean",
      status:
        input.verificationPipelineLedger.status === "fail" || validationsById.get("environment_readiness_confirmed")?.status === "fail" || validationsById.get("evaluator_rubric_recorded")?.status === "fail" || validationsById.get("quality_document_recorded")?.status === "fail" || validationsById.get("harness_quality_documented")?.status === "fail" || validationsById.get("continuity_state_recorded")?.status === "fail" || validationsById.get("course_alignment_confirmed")?.status === "fail" || validationsById.get("completion_authority_confirmed")?.status === "fail" || validationsById.get("source_of_record_confirmed")?.status === "fail" || validationsById.get("lifecycle_ledger_clean")?.status === "fail" || validationsById.get("feature_scope_state_gated")?.status === "fail"
          ? "fail"
          : input.verificationPipelineLedger.status === "warning" || validationsById.get("environment_readiness_confirmed")?.status === "warning" || validationsById.get("evaluator_rubric_recorded")?.status === "warning" || validationsById.get("quality_document_recorded")?.status === "warning" || validationsById.get("harness_quality_documented")?.status === "warning" || validationsById.get("continuity_state_recorded")?.status === "warning" || validationsById.get("course_alignment_confirmed")?.status === "warning" || validationsById.get("completion_authority_confirmed")?.status === "warning" || validationsById.get("source_of_record_confirmed")?.status === "warning" || validationsById.get("lifecycle_ledger_clean")?.status === "warning" || validationsById.get("feature_scope_state_gated")?.status === "warning"
            ? "warning"
            : "pass",
      details: `verification-pipeline=${input.verificationPipelineLedger.status}, environment=${validationsById.get("environment_readiness_confirmed")?.status ?? "missing"}, evaluator-rubric=${validationsById.get("evaluator_rubric_recorded")?.status ?? "missing"}, quality-document=${validationsById.get("quality_document_recorded")?.status ?? "missing"}, quality=${validationsById.get("harness_quality_documented")?.status ?? "missing"}, continuity=${validationsById.get("continuity_state_recorded")?.status ?? "missing"}, course=${validationsById.get("course_alignment_confirmed")?.status ?? "missing"}, completion-authority=${validationsById.get("completion_authority_confirmed")?.status ?? "missing"}, source-of-record=${validationsById.get("source_of_record_confirmed")?.status ?? "missing"}, lifecycle=${validationsById.get("lifecycle_ledger_clean")?.status ?? "missing"}, feature-scope=${validationsById.get("feature_scope_state_gated")?.status ?? "missing"}.`,
      evidence: ["verification-pipeline-ledger.json", "environment-readiness-ledger.json", "evaluator-rubric.json", "quality-document.json", "harness-quality-ledger.json", "continuity-ledger.json", "course-alignment-ledger.json", "completion-authority-ledger.json", "source-of-record-ledger.json", "lifecycle-ledger.json", "feature-list.json"],
    },
  ];
  const unresolved = checks.flatMap((check) =>
    check.status === "pass"
      ? []
      : [
          {
            id: check.id,
            status: check.status,
            reason: check.details,
            evidence: check.evidence,
          },
        ],
  );
  const status = checks.some((check) => check.status === "fail") ? "fail" : checks.some((check) => check.status === "warning") ? "warning" : "pass";
  return {
    schemaVersion: 1,
    id: stableId("session-clean-state-ledger", `${input.runId}:${checks.map((check) => `${check.id}:${check.status}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    rule: "A session is clean only when startup commands are known, validation state is non-failing, progress and handoff artifacts are declared, evaluator rubric and quality document are recorded, continuity state is recorded, course alignment is confirmed, temporary artifacts are absent, startup readiness is available, environment readiness is confirmed, quality is documented, independent completion authority is confirmed, and completion/handoff gates are clean.",
    summary: {
      checkCount: checks.length,
      passedCheckCount: checks.filter((check) => check.status === "pass").length,
      warningCheckCount: checks.filter((check) => check.status === "warning").length,
      failedCheckCount: checks.filter((check) => check.status === "fail").length,
      staleArtifactCount: staleArtifacts.length,
      nonPassingValidationCount: failedValidations.length + warningValidations.length,
      missingRequiredArtifactCount: missingRequiredArtifacts.length,
    },
    checks,
    staleArtifacts,
    unresolved,
  };
}

async function readInitializationChecklist(outputDir: string): Promise<InitializationChecklist | null> {
  const target = path.join(outputDir, "initialization-checklist.json");
  if (!(await pathExists(target))) {
    return null;
  }
  return readJson<InitializationChecklist>(target);
}

async function findStaleArtifacts(outputDir: string): Promise<SessionCleanStateLedger["staleArtifacts"]> {
  const result: SessionCleanStateLedger["staleArtifacts"] = [];
  async function visit(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(target);
        continue;
      }
      const rel = path.relative(outputDir, target);
      const reason = staleArtifactReason(rel);
      if (reason) {
        result.push({ path: rel, reason });
      }
    }
  }
  if (await pathExists(outputDir)) {
    await visit(outputDir);
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

function staleArtifactReason(rel: string): string | null {
  const normalized = rel.toLowerCase();
  const basename = path.basename(normalized);
  if (basename === ".ds_store") {
    return "macOS metadata file should not remain in a clean run output.";
  }
  if (basename.endsWith(".tmp") || basename.endsWith(".temp") || basename.endsWith(".bak") || basename.endsWith(".orig") || basename.endsWith(".swp")) {
    return "temporary or backup file should be removed before handoff.";
  }
  if (basename.startsWith("debug-") || basename.startsWith("tmp-") || basename.includes(".debug.")) {
    return "debug artifact should not remain in a clean run output.";
  }
  return null;
}

function validationDetails(ledger: SessionCleanStateLedger): string {
  if (ledger.status === "pass") {
    return `Session clean state passed ${ledger.summary.passedCheckCount}/${ledger.summary.checkCount} check(s) with no stale artifact candidates.`;
  }
  if (ledger.status === "warning") {
    return `Session clean state has warning check(s): ${ledger.unresolved
      .filter((issue) => issue.status === "warning")
      .map((issue) => issue.id)
      .join(", ")}.`;
  }
  return `Session clean state failed check(s): ${ledger.unresolved
    .filter((issue) => issue.status === "fail")
    .map((issue) => issue.id)
    .join(", ")}.`;
}
