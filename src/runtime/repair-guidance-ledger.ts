import path from "node:path";
import type { CouncilReview, HarnessSubsystemId, TraceEvent, ValidationResult, ValidatorStatus } from "../types.js";
import { stableId, writeJson } from "../utils/fs.js";
import type { DiagnosticAttribution } from "./harness-diagnostic-ledger.js";

export const REPAIR_GUIDANCE_LEDGER_ARTIFACT = "repair-guidance-ledger.json";
const DEFERRED_REPAIR_VALIDATION_IDS = new Set(["feature_scope_state_gated"]);

interface RepairGuidanceLedgerInput {
  outputDir: string;
  runId: string;
  specId: string;
  validations: ValidationResult[];
  councilReview: CouncilReview;
  diagnosticAttributions: DiagnosticAttribution[];
}

export interface RepairGuidanceLedgerResult {
  artifact: string;
  ledger: RepairGuidanceLedger;
  validation: ValidationResult;
}

export interface RepairGuidanceLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  rule: string;
  sourceSummary: {
    validationSignalCount: number;
    unresolvedBlockerQuestionCount: number;
    repairSignalCount: number;
    repairActionCount: number;
  };
  actions: RepairAction[];
  unresolved: Array<{
    sourceType: "validation" | "critic-question";
    sourceId: string;
    reason: string;
    evidence: string[];
  }>;
}

export interface RepairAction {
  id: string;
  sourceType: "validation" | "critic-question";
  sourceId: string;
  status: ValidatorStatus | "unresolved";
  layer: HarnessSubsystemId;
  severity: "blocker" | "major" | "minor";
  whatFailed: string;
  whyItMatters: string;
  fix: string;
  nextCommand: string;
  evidence: string[];
}

export async function writeRepairGuidanceLedger(input: RepairGuidanceLedgerInput): Promise<RepairGuidanceLedgerResult> {
  const ledger = buildRepairGuidanceLedger(input);
  const target = path.join(input.outputDir, REPAIR_GUIDANCE_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: REPAIR_GUIDANCE_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: "repair_guidance_recorded",
      name: "Repair guidance recorded",
      status: ledger.status,
      details:
        ledger.status === "pass"
          ? `Recorded ${ledger.actions.length} agent-oriented repair action(s) for ${ledger.sourceSummary.repairSignalCount} non-passing signal(s).`
          : `Repair guidance missed ${ledger.unresolved.length} non-passing signal(s).`,
      evidence: [target],
      repairable: true,
    },
  };
}

export function repairGuidanceLedgerEvents(runId: string, result: RepairGuidanceLedgerResult): TraceEvent[] {
  return [
    {
      id: stableId("event", `${runId}:runtime.repair_guidance.recorded:${result.ledger.id}`),
      runId,
      type: "runtime.repair_guidance.recorded",
      timestamp: new Date().toISOString(),
      artifactId: REPAIR_GUIDANCE_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Recorded ${result.ledger.actions.length} agent-oriented repair action(s).`,
      evidence: [REPAIR_GUIDANCE_LEDGER_ARTIFACT],
    },
  ];
}

function buildRepairGuidanceLedger(input: RepairGuidanceLedgerInput): RepairGuidanceLedger {
  const validationSignals = input.validations.filter((validation) => (validation.status === "fail" || validation.status === "warning" || validation.status === "skipped") && !DEFERRED_REPAIR_VALIDATION_IDS.has(validation.id));
  const blockerQuestions = input.councilReview.unresolvedBlockerQuestions ?? [];
  const actions = uniqueActions([
    ...validationSignals.map((validation) => actionForValidation(input.runId, validation, attributionFor(input.diagnosticAttributions, "validation", validation.id))),
    ...blockerQuestions.map((question) => {
      const attribution = attributionFor(input.diagnosticAttributions, "critic-question", question.id);
      return {
        id: stableId("repair-action", `${input.runId}:critic-question:${question.id}`),
        sourceType: "critic-question" as const,
        sourceId: question.id,
        status: "unresolved" as const,
        layer: attribution?.layer ?? "instructions",
        severity: question.severity === "blocker" ? ("blocker" as const) : ("major" as const),
        whatFailed: question.question,
        whyItMatters: question.whyItMatters,
        fix: question.answerRequired
          ? "Answer this blocker from source evidence, add the missing acceptance criterion, or scope it out explicitly before completion."
          : "Keep this as an evaluator rubric item until the harness can answer it automatically.",
        nextCommand: "Inspect council-review.json and update the source facts, feature scope, or validator that should answer this question.",
        evidence: question.evidence,
      };
    }),
  ]);
  const unresolved = [
    ...validationSignals
      .filter((validation) => !actions.some((action) => action.sourceType === "validation" && action.sourceId === validation.id && completeAction(action)))
      .map((validation) => ({
        sourceType: "validation" as const,
        sourceId: validation.id,
        reason: "Non-passing validation did not receive complete what/why/fix/next-command guidance.",
        evidence: validation.evidence ?? [],
      })),
    ...blockerQuestions
      .filter((question) => !actions.some((action) => action.sourceType === "critic-question" && action.sourceId === question.id && completeAction(action)))
      .map((question) => ({
        sourceType: "critic-question" as const,
        sourceId: question.id,
        reason: "Unresolved blocker question did not receive complete repair guidance.",
        evidence: question.evidence,
      })),
  ];
  return {
    schemaVersion: 1,
    id: stableId("repair-guidance-ledger", `${input.runId}:${actions.map((action) => action.id).join("|") || "clean"}`),
    runId: input.runId,
    specId: input.specId,
    status: unresolved.length ? "fail" : "pass",
    rule: "Every failed, warning, skipped, or unresolved blocker signal must produce agent-oriented repair guidance with what failed, why it matters, how to fix it, the next command to run, evidence, and the owning harness subsystem.",
    sourceSummary: {
      validationSignalCount: validationSignals.length,
      unresolvedBlockerQuestionCount: blockerQuestions.length,
      repairSignalCount: validationSignals.length + blockerQuestions.length,
      repairActionCount: actions.length,
    },
    actions,
    unresolved,
  };
}

function actionForValidation(runId: string, validation: ValidationResult, attribution?: DiagnosticAttribution): RepairAction {
  const layer = attribution?.layer ?? layerForValidation(validation.id);
  return {
    id: stableId("repair-action", `${runId}:validation:${validation.id}:${validation.status}`),
    sourceType: "validation",
    sourceId: validation.id,
    status: validation.status,
    layer,
    severity: validation.status === "fail" ? "major" : "minor",
    whatFailed: validation.details,
    whyItMatters: whyForLayer(layer, validation.status),
    fix: attribution?.suggestedHarnessFix ?? fixForValidation(validation.id, layer, validation.status),
    nextCommand: nextCommandForValidation(validation.id, layer),
    evidence: validation.evidence ?? [],
  };
}

function attributionFor(attributions: DiagnosticAttribution[], sourceType: DiagnosticAttribution["sourceType"], sourceId: string): DiagnosticAttribution | undefined {
  return attributions.find((attribution) => attribution.sourceType === sourceType && attribution.sourceId === sourceId);
}

function completeAction(action: RepairAction): boolean {
  return Boolean(action.whatFailed && action.whyItMatters && action.fix && action.nextCommand);
}

function layerForValidation(id: string): HarnessSubsystemId {
  if (matches(id, ["app_source_tree"])) {
    return "feedback";
  }
  if (matches(id, ["source", "source_of_record", "environment_readiness", "svg_source", "component", "token", "raw_color", "import_path", "requirements_extracted"])) {
    return "environment";
  }
  if (matches(id, ["initialization", "feature_scheduler", "feature_scope", "run_state", "context_budget", "lifecycle", "startup_readiness", "clean_state"])) {
    return "state";
  }
  if (matches(id, ["worker_function", "provider_replacement", "tool_safety", "dispatch", "runtime_bus", "function_invocation", "policy", "approval", "budget", "hook", "trace_context", "runtime_error"])) {
    return "tools";
  }
  if (matches(id, ["app_api", "app_persistence", "app_test", "app_acceptance", "architecture_boundary", "valid_json", "valid_lottie", "fps", "duration", "dimensions", "controls", "preview", "hypothesis", "council", "critic", "blocker", "completion_authority", "feedback_promotion", "diagnostic", "harness_quality", "quality", "verified_completion", "verification_pipeline"])) {
    return "feedback";
  }
  return "instructions";
}

function whyForLayer(layer: HarnessSubsystemId, status: ValidatorStatus): string {
  if (status === "skipped") {
    return "Skipped checks create a verification blind spot, so the harness cannot distinguish completed work from untested work.";
  }
  if (layer === "environment") {
    return "The run is not source-grounded; generated artifacts may be based on guesses instead of repository evidence.";
  }
  if (layer === "state") {
    return "A fresh session cannot safely resume or trust the feature state while this state gate is unresolved.";
  }
  if (layer === "tools") {
    return "The runtime cannot prove that the required tool, gate, dispatch, or trace substrate enforced the plan.";
  }
  if (layer === "feedback") {
    return "Completion judgment would rely on confidence or prose instead of independent verification evidence.";
  }
  return "The task contract is underspecified, so the worker may optimize for the wrong definition of done.";
}

function fixForValidation(id: string, layer: HarnessSubsystemId, status: ValidatorStatus): string {
  if (status === "skipped") {
    return `Make ${id} executable for this route, or mark the dependent feature out of scope before finalization.`;
  }
  if (layer === "environment") {
    return `Provide the missing source, correct the source path, or update source profiling so ${id} can pass from repository evidence.`;
  }
  if (layer === "state") {
    return `Regenerate state artifacts after repairing upstream failures so ${id} can reflect the true run state.`;
  }
  if (layer === "tools") {
    return `Repair the locked worker, executor, replacement slot, gate, bus, or trace route that owns ${id}, then rerun the workflow.`;
  }
  if (layer === "feedback") {
    return `Tighten the validator, artifact, or critic input that owns ${id}, then rerun verification.`;
  }
  return `Clarify the instruction or acceptance criterion that ${id} is trying to enforce.`;
}

function nextCommandForValidation(id: string, layer: HarnessSubsystemId): string {
  if (layer === "environment") {
    return `Inspect source refs and rerun the workflow after fixing ${id}.`;
  }
  if (layer === "state") {
    return `Inspect feature-list.json, context-budget-ledger.json, progress.md, session-handoff.md, and rerun after fixing ${id}.`;
  }
  if (layer === "tools") {
    return `Inspect run-plan.json, worker-lock.json, executor-lock.json, provider-replacement-registry.json, tool-safety-ledger.json, and runtime-bus.json for ${id}.`;
  }
  if (layer === "feedback") {
    return `Inspect validation-report.md and council-review.json for ${id}, then rerun the relevant validator.`;
  }
  return `Inspect harness-spec.json and sprint-contract.json for ${id}, then clarify the acceptance criteria.`;
}

function uniqueActions(actions: RepairAction[]): RepairAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.sourceType}:${action.sourceId}:${action.whatFailed}:${action.fix}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function matches(value: string, needles: string[]): boolean {
  const normalized = value.toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}
