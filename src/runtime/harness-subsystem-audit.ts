import path from "node:path";
import type { HarnessSpec, HarnessSubsystemId, TraceEvent, ValidationResult, ValidatorStatus } from "../types.js";
import { stableId, writeJson } from "../utils/fs.js";
import type { DiagnosticAttribution } from "./harness-diagnostic-ledger.js";
import type { RepairAction } from "./repair-guidance-ledger.js";

export const HARNESS_SUBSYSTEM_AUDIT_ARTIFACT = "harness-subsystem-audit.json";
const DEFERRED_AUDIT_VALIDATION_IDS = new Set(["feature_scope_state_gated"]);

interface HarnessSubsystemAuditInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  artifacts: string[];
  validations: ValidationResult[];
  diagnosticAttributions: DiagnosticAttribution[];
  repairActions: RepairAction[];
}

export interface HarnessSubsystemAuditResult {
  artifact: string;
  ledger: HarnessSubsystemAuditLedger;
  validation: ValidationResult;
}

export interface HarnessSubsystemAuditLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  rule: string;
  summary: {
    subsystemCount: number;
    averageScore: number;
    lowestScore: number;
    primaryBottleneck: HarnessSubsystemId | null;
    lowestScoringSubsystems: HarnessSubsystemId[];
    nonPassingValidationCount: number;
    diagnosticAttributionCount: number;
    repairActionCount: number;
    missingArtifactCount: number;
    nextInvestment: {
      subsystem: HarnessSubsystemId | "none";
      action: string;
      evidence: string[];
    };
  };
  subsystems: SubsystemAuditEntry[];
  ablationPlan: SubsystemAblationProbe[];
  unresolved: Array<{
    reason: string;
    evidence: string[];
  }>;
}

export interface SubsystemAuditEntry {
  id: HarnessSubsystemId;
  score: number;
  status: "healthy" | "degraded" | "blocked";
  plannedArtifacts: string[];
  presentArtifacts: string[];
  missingArtifacts: string[];
  validationIds: string[];
  validationSummary: {
    pass: number;
    warning: number;
    fail: number;
    skipped: number;
    missing: number;
  };
  diagnosticSignalIds: string[];
  repairActionIds: string[];
  evidence: string[];
  rationale: string;
  recommendedHarnessChange: string;
}

export interface SubsystemAblationProbe {
  subsystem: HarnessSubsystemId;
  hypothesis: string;
  controlledExclusion: string;
  compareUsing: string[];
  expectedFailureSignal: string;
  executedInThisRun: false;
}

const SUBSYSTEMS: HarnessSubsystemId[] = ["instructions", "tools", "environment", "state", "feedback"];

export async function writeHarnessSubsystemAudit(input: HarnessSubsystemAuditInput): Promise<HarnessSubsystemAuditResult> {
  const ledger = buildHarnessSubsystemAudit(input);
  const target = path.join(input.outputDir, HARNESS_SUBSYSTEM_AUDIT_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: HARNESS_SUBSYSTEM_AUDIT_ARTIFACT,
    ledger,
    validation: {
      id: "harness_subsystem_audit_recorded",
      name: "Harness subsystem audit recorded",
      status: ledger.status,
      details:
        ledger.status === "pass"
          ? `Scored ${ledger.subsystems.length} harness subsystem(s); primary bottleneck is ${ledger.summary.primaryBottleneck ?? "none"}.`
          : `Harness subsystem audit has ${ledger.unresolved.length} unresolved audit gap(s).`,
      evidence: [target],
      repairable: true,
    },
  };
}

export function harnessSubsystemAuditEvents(runId: string, result: HarnessSubsystemAuditResult): TraceEvent[] {
  return [
    {
      id: stableId("event", `${runId}:runtime.subsystem_audit.recorded:${result.ledger.id}`),
      runId,
      type: "runtime.subsystem_audit.recorded",
      timestamp: new Date().toISOString(),
      artifactId: HARNESS_SUBSYSTEM_AUDIT_ARTIFACT,
      status: result.validation.status,
      message: `Recorded five-subsystem harness audit; primary bottleneck is ${result.ledger.summary.primaryBottleneck ?? "none"}.`,
      evidence: [HARNESS_SUBSYSTEM_AUDIT_ARTIFACT],
    },
  ];
}

function buildHarnessSubsystemAudit(input: HarnessSubsystemAuditInput): HarnessSubsystemAuditLedger {
  const subsystems = SUBSYSTEMS.map((subsystem) => auditSubsystem(input, subsystem));
  const missingSubsystems = SUBSYSTEMS.filter((subsystem) => !subsystems.some((entry) => entry.id === subsystem));
  const nonPassingValidations = input.validations.filter((validation) => (validation.status === "fail" || validation.status === "warning" || validation.status === "skipped") && !DEFERRED_AUDIT_VALIDATION_IDS.has(validation.id));
  const lowestScore = Math.min(...subsystems.map((entry) => entry.score));
  const lowestScoringSubsystems = subsystems.filter((entry) => entry.score === lowestScore).map((entry) => entry.id);
  const primaryBottleneck = subsystems.find((entry) => entry.score < 5)?.id ?? null;
  const missingArtifactCount = subsystems.reduce((total, entry) => total + entry.missingArtifacts.length, 0);
  const unresolved = [
    ...missingSubsystems.map((subsystem) => ({
      reason: `Missing audit row for ${subsystem}.`,
      evidence: [],
    })),
    ...subsystems
      .filter((entry) => !entry.recommendedHarnessChange || !entry.rationale)
      .map((entry) => ({
        reason: `Audit row ${entry.id} is missing rationale or recommended change.`,
        evidence: entry.evidence,
      })),
    ...(nonPassingValidations.length > 0 && primaryBottleneck === null
      ? [
          {
            reason: "Non-passing validations exist but no primary bottleneck was selected.",
            evidence: nonPassingValidations.flatMap((validation) => validation.evidence ?? []),
          },
        ]
      : []),
  ];
  const nextInvestment = nextInvestmentFor(primaryBottleneck, subsystems);
  return {
    schemaVersion: 1,
    id: stableId("harness-subsystem-audit", `${input.runId}:${subsystems.map((entry) => `${entry.id}:${entry.score}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status: unresolved.length ? "fail" : "pass",
    rule: "Every run must score instructions, tools, environment, state, and feedback from runtime evidence, identify the current bottleneck, and leave an ablation probe for measuring marginal harness value.",
    summary: {
      subsystemCount: subsystems.length,
      averageScore: Number((subsystems.reduce((total, entry) => total + entry.score, 0) / subsystems.length).toFixed(2)),
      lowestScore,
      primaryBottleneck,
      lowestScoringSubsystems,
      nonPassingValidationCount: nonPassingValidations.length,
      diagnosticAttributionCount: input.diagnosticAttributions.length,
      repairActionCount: input.repairActions.length,
      missingArtifactCount,
      nextInvestment,
    },
    subsystems,
    ablationPlan: SUBSYSTEMS.map((subsystem) => ablationProbeFor(subsystem)),
    unresolved,
  };
}

function auditSubsystem(input: HarnessSubsystemAuditInput, subsystem: HarnessSubsystemId): SubsystemAuditEntry {
  const model = input.spec.harnessModel.subsystems.find((item) => item.id === subsystem);
  const plannedArtifacts = auditStageArtifacts(unique([...(model?.plannedArtifacts ?? []), ...extraArtifactsFor(subsystem)]));
  const presentArtifacts = plannedArtifacts.filter((artifact) => input.artifacts.includes(artifact));
  const missingArtifacts = plannedArtifacts.filter((artifact) => !presentArtifacts.includes(artifact));
  const validationIds = validationIdsFor(input.validations, subsystem);
  const validations = validationIds.map((id) => input.validations.find((validation) => validation.id === id));
  const validationSummary = summarizeValidations(validations);
  const diagnosticSignals = input.diagnosticAttributions.filter((attribution) => attribution.layer === subsystem);
  const repairActions = input.repairActions.filter((action) => action.layer === subsystem);
  const score = scoreSubsystem(validationSummary, missingArtifacts.length, diagnosticSignals.length, repairActions.length);
  return {
    id: subsystem,
    score,
    status: validationSummary.fail > 0 ? "blocked" : validationSummary.warning > 0 || validationSummary.skipped > 0 || validationSummary.missing > 0 || missingArtifacts.length > 0 ? "degraded" : "healthy",
    plannedArtifacts,
    presentArtifacts,
    missingArtifacts,
    validationIds,
    validationSummary,
    diagnosticSignalIds: diagnosticSignals.map((attribution) => attribution.id),
    repairActionIds: repairActions.map((action) => action.id),
    evidence: unique([
      ...presentArtifacts,
      ...validations.flatMap((validation) => validation?.evidence ?? []),
      ...diagnosticSignals.flatMap((signal) => signal.evidence),
      ...repairActions.flatMap((action) => action.evidence),
    ]),
    rationale: rationaleFor(subsystem, score, validationSummary, missingArtifacts.length, diagnosticSignals.length, repairActions.length),
    recommendedHarnessChange: recommendedChangeFor(subsystem, validationSummary, missingArtifacts, diagnosticSignals.length, repairActions.length),
  };
}

function validationIdsFor(validations: ValidationResult[], subsystem: HarnessSubsystemId): string[] {
  return validations.filter((validation) => !DEFERRED_AUDIT_VALIDATION_IDS.has(validation.id) && layerForValidation(validation.id) === subsystem).map((validation) => validation.id);
}

function summarizeValidations(validations: Array<ValidationResult | undefined>): SubsystemAuditEntry["validationSummary"] {
  return {
    pass: validations.filter((validation) => validation?.status === "pass").length,
    warning: validations.filter((validation) => validation?.status === "warning").length,
    fail: validations.filter((validation) => validation?.status === "fail").length,
    skipped: validations.filter((validation) => validation?.status === "skipped").length,
    missing: validations.filter((validation) => !validation).length,
  };
}

function scoreSubsystem(summary: SubsystemAuditEntry["validationSummary"], missingArtifactCount: number, diagnosticSignalCount: number, repairActionCount: number): number {
  const penalty = summary.fail * 2 + summary.warning + summary.skipped + summary.missing + Math.min(2, missingArtifactCount) + Math.min(1, diagnosticSignalCount > repairActionCount ? 1 : 0);
  return Math.max(1, 5 - penalty);
}

function rationaleFor(
  subsystem: HarnessSubsystemId,
  score: number,
  summary: SubsystemAuditEntry["validationSummary"],
  missingArtifactCount: number,
  diagnosticSignalCount: number,
  repairActionCount: number,
): string {
  if (score === 5) {
    return `${labelFor(subsystem)} is healthy: expected artifacts are present and owned validations passed.`;
  }
  return `${labelFor(subsystem)} scored ${score}/5 with ${summary.fail} failed, ${summary.warning} warning, ${summary.skipped} skipped, ${summary.missing} missing validation(s), ${missingArtifactCount} missing artifact(s), ${diagnosticSignalCount} diagnostic signal(s), and ${repairActionCount} repair action(s).`;
}

function recommendedChangeFor(
  subsystem: HarnessSubsystemId,
  summary: SubsystemAuditEntry["validationSummary"],
  missingArtifacts: string[],
  diagnosticSignalCount: number,
  repairActionCount: number,
): string {
  if (missingArtifacts.length) {
    return `Make ${missingArtifacts[0]} a durable runtime artifact before accepting ${labelFor(subsystem)} as complete.`;
  }
  if (summary.fail > 0) {
    return `Repair the failed ${labelFor(subsystem)} validation(s), then rerun the workflow and compare this audit score.`;
  }
  if (summary.warning > 0 || summary.skipped > 0 || summary.missing > 0) {
    return `Tighten ${labelFor(subsystem)} gates so warning, skipped, or missing checks become executable pass/fail evidence.`;
  }
  if (diagnosticSignalCount > repairActionCount) {
    return `Add repair guidance for every ${labelFor(subsystem)} diagnostic signal before the next handoff.`;
  }
  return `Keep ${labelFor(subsystem)} unchanged and use the ablation probe to measure whether it still contributes marginal value.`;
}

function nextInvestmentFor(primaryBottleneck: HarnessSubsystemId | null, subsystems: SubsystemAuditEntry[]): HarnessSubsystemAuditLedger["summary"]["nextInvestment"] {
  if (!primaryBottleneck) {
    return {
      subsystem: "none",
      action: "No immediate bottleneck; run a controlled subsystem ablation only when a future regression appears.",
      evidence: subsystems.flatMap((entry) => entry.evidence.slice(0, 1)),
    };
  }
  const entry = subsystems.find((item) => item.id === primaryBottleneck);
  return {
    subsystem: primaryBottleneck,
    action: entry?.recommendedHarnessChange ?? `Repair ${primaryBottleneck} subsystem evidence.`,
    evidence: entry?.evidence ?? [],
  };
}

function ablationProbeFor(subsystem: HarnessSubsystemId): SubsystemAblationProbe {
  return {
    subsystem,
    hypothesis: `If ${labelFor(subsystem)} is carrying real marginal value, removing its artifacts or gates should lower workflow success, increase partial/failed finalStatus, or add repair actions.`,
    controlledExclusion: `Temporarily disable only ${labelFor(subsystem)} artifacts/gates in an isolated eval branch and leave the model, sources, request, and remaining harness unchanged.`,
    compareUsing: ["output/app-workflow-evals/evaluation-report.md", "output/comprehensive-workflow-eval/comprehensive-report.md", HARNESS_SUBSYSTEM_AUDIT_ARTIFACT, "completion-authority-ledger.json", "verification-pipeline-ledger.json", "harness-ablation-comparison.json", "harness-diagnostic-ledger.json", "repair-guidance-ledger.json"],
    expectedFailureSignal: `A useful ${labelFor(subsystem)} layer should create a measurable regression when removed; no regression means the layer may be redundant, poorly designed, or unexercised.`,
    executedInThisRun: false,
  };
}

function extraArtifactsFor(subsystem: HarnessSubsystemId): string[] {
  if (subsystem === "instructions") {
    return ["harness-ir.json"];
  }
  if (subsystem === "tools") {
    return ["run-plan.json", "provider-replacement-registry.json", "tool-safety-ledger.json", "context-budget-ledger.json"];
  }
  if (subsystem === "state") {
    return ["startup-readiness.json", "context-budget-ledger.json", "continuity-ledger.json", "session-clean-state-ledger.json"];
  }
  if (subsystem === "environment") {
    return ["environment-readiness-ledger.json", "source-of-record-ledger.json", "evidence-graph.json"];
  }
  if (subsystem === "feedback") {
    return [HARNESS_SUBSYSTEM_AUDIT_ARTIFACT, "evaluator-rubric.json", "evaluator-rubric.md", "architecture-boundary-ledger.json", "completion-authority-ledger.json", "verification-pipeline-ledger.json"];
  }
  return [];
}

function auditStageArtifacts(artifacts: string[]): string[] {
  const writtenAfterSubsystemAudit = new Set(["continuity-ledger.json", "course-alignment-ledger.json", "verification-pipeline-ledger.json", "session-clean-state-ledger.json", "harness-ablation-comparison.json", "quality-document.json", "quality-document.md", "harness-quality-ledger.json", "lifecycle-ledger.json", "run-state.json", "session-handoff.md", "validation-report.md", "events.jsonl", "harness-trace.json", "harness-engineering-record.json"]);
  return artifacts.filter((artifact) => !writtenAfterSubsystemAudit.has(artifact));
}

function layerForValidation(id: string): HarnessSubsystemId {
  if (matches(id, ["app_source_tree"])) {
    return "feedback";
  }
  if (matches(id, ["source", "source_of_record", "environment_readiness", "svg_source", "component", "token", "raw_color", "import_path", "requirements_extracted"])) {
    return "environment";
  }
  if (matches(id, ["initialization", "feature_scheduler", "feature_scope", "run_state", "context_budget", "continuity", "lifecycle", "startup_readiness", "clean_state"])) {
    return "state";
  }
  if (matches(id, ["worker_function", "provider_replacement", "dispatch", "runtime_bus", "function_invocation", "policy", "approval", "budget", "hook", "trace_context", "runtime_error"])) {
    return "tools";
  }
  if (matches(id, ["app_api", "app_persistence", "app_test", "app_acceptance", "architecture_boundary", "valid_json", "valid_lottie", "fps", "duration", "dimensions", "controls", "preview", "hypothesis", "council", "critic", "blocker", "evaluator_rubric", "completion_authority", "feedback_promotion", "diagnostic", "repair_guidance", "harness_subsystem_audit", "quality_document", "harness_quality", "course_alignment", "quality", "verified_completion", "verification_pipeline"])) {
    return "feedback";
  }
  return "instructions";
}

function labelFor(subsystem: HarnessSubsystemId): string {
  return subsystem.replace("-", " ");
}

function matches(value: string, needles: string[]): boolean {
  const normalized = value.toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
