import path from "node:path";
import type { CouncilReview, HarnessSubsystemId, TraceEvent, ValidationResult, ValidatorStatus } from "../types.js";
import { stableId, writeJson } from "../utils/fs.js";

export const HARNESS_DIAGNOSTIC_LEDGER_ARTIFACT = "harness-diagnostic-ledger.json";
const DEFERRED_DIAGNOSTIC_VALIDATION_IDS = new Set(["feature_scope_state_gated"]);

interface HarnessDiagnosticLedgerInput {
  outputDir: string;
  runId: string;
  specId: string;
  validations: ValidationResult[];
  councilReview: CouncilReview;
}

export interface HarnessDiagnosticLedgerResult {
  artifact: string;
  ledger: HarnessDiagnosticLedger;
  validation: ValidationResult;
}

export interface HarnessDiagnosticLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  rule: string;
  sourceSummary: {
    validationSignalCount: number;
    unresolvedBlockerQuestionCount: number;
    attributionCount: number;
  };
  layerSummary: Array<{
    layer: HarnessSubsystemId;
    attributionCount: number;
    failedValidationCount: number;
    warningValidationCount: number;
    skippedValidationCount: number;
  }>;
  attributions: DiagnosticAttribution[];
  unresolved: Array<{
    sourceType: "validation" | "critic-question";
    sourceId: string;
    reason: string;
    evidence: string[];
  }>;
}

export interface DiagnosticAttribution {
  id: string;
  sourceType: "validation" | "critic-question";
  sourceId: string;
  status: ValidatorStatus | "unresolved";
  layer: HarnessSubsystemId;
  failureMode: string;
  evidence: string[];
  details: string;
  suggestedHarnessFix: string;
}

export async function writeHarnessDiagnosticLedger(input: HarnessDiagnosticLedgerInput): Promise<HarnessDiagnosticLedgerResult> {
  const ledger = buildHarnessDiagnosticLedger(input);
  const target = path.join(input.outputDir, HARNESS_DIAGNOSTIC_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: HARNESS_DIAGNOSTIC_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: "diagnostic_loop_recorded",
      name: "Diagnostic loop recorded",
      status: ledger.status,
      details:
        ledger.status === "pass"
          ? `Attributed ${ledger.attributions.length} non-passing validation or blocker signal(s) to harness subsystem(s).`
          : `Diagnostic loop missed ${ledger.unresolved.length} signal attribution(s).`,
      evidence: [target],
      repairable: true,
    },
  };
}

export function harnessDiagnosticLedgerEvents(runId: string, result: HarnessDiagnosticLedgerResult): TraceEvent[] {
  return [
    {
      id: stableId("event", `${runId}:runtime.diagnostic_ledger.created:${result.ledger.id}`),
      runId,
      type: "runtime.diagnostic_ledger.created",
      timestamp: new Date().toISOString(),
      artifactId: HARNESS_DIAGNOSTIC_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Recorded ${result.ledger.attributions.length} diagnostic attribution(s) across harness subsystems.`,
      evidence: [HARNESS_DIAGNOSTIC_LEDGER_ARTIFACT],
    },
  ];
}

function buildHarnessDiagnosticLedger(input: HarnessDiagnosticLedgerInput): HarnessDiagnosticLedger {
  const validationSignals = input.validations.filter((validation) => (validation.status === "fail" || validation.status === "warning" || validation.status === "skipped") && !DEFERRED_DIAGNOSTIC_VALIDATION_IDS.has(validation.id));
  const blockerQuestions = input.councilReview.unresolvedBlockerQuestions ?? [];
  const attributions = [
    ...validationSignals.map((validation) => validationAttribution(input.runId, validation)),
    ...blockerQuestions.map((question) => ({
      id: stableId("diagnostic-attribution", `${input.runId}:critic-question:${question.id}`),
      sourceType: "critic-question" as const,
      sourceId: question.id,
      status: "unresolved" as const,
      layer: layerForCriticCategory(question.category),
      failureMode: failureModeForCriticCategory(question.category),
      evidence: question.evidence,
      details: question.question,
      suggestedHarnessFix: question.answerRequired
        ? "Convert this blocker into explicit source facts, acceptance criteria, or a validator before future clean completion claims."
        : "Keep this question in the review rubric until the harness can answer it automatically.",
    })),
  ];
  const unresolved = [
    ...validationSignals
      .filter((validation) => !attributions.some((attribution) => attribution.sourceType === "validation" && attribution.sourceId === validation.id))
      .map((validation) => ({
        sourceType: "validation" as const,
        sourceId: validation.id,
        reason: "Non-passing validation was not mapped to a harness subsystem.",
        evidence: validation.evidence ?? [],
      })),
    ...blockerQuestions
      .filter((question) => !attributions.some((attribution) => attribution.sourceType === "critic-question" && attribution.sourceId === question.id))
      .map((question) => ({
        sourceType: "critic-question" as const,
        sourceId: question.id,
        reason: "Unresolved blocker question was not mapped to a harness subsystem.",
        evidence: question.evidence,
      })),
  ];
  return {
    schemaVersion: 1,
    id: stableId("harness-diagnostic-ledger", `${input.runId}:${attributions.map((attribution) => attribution.id).join("|") || "clean"}`),
    runId: input.runId,
    specId: input.specId,
    status: unresolved.length ? "fail" : "pass",
    rule: "Every failed, warning, skipped, or unresolved blocker signal must be attributed to instructions, tools, environment, state, or feedback so the next improvement fixes the harness layer rather than blaming the model.",
    sourceSummary: {
      validationSignalCount: validationSignals.length,
      unresolvedBlockerQuestionCount: blockerQuestions.length,
      attributionCount: attributions.length,
    },
    layerSummary: layerSummary(attributions),
    attributions,
    unresolved,
  };
}

function validationAttribution(runId: string, validation: ValidationResult): DiagnosticAttribution {
  const layer = layerForValidation(validation.id);
  return {
    id: stableId("diagnostic-attribution", `${runId}:validation:${validation.id}:${validation.status}`),
    sourceType: "validation",
    sourceId: validation.id,
    status: validation.status,
    layer,
    failureMode: failureModeForValidation(validation.id, layer, validation.status),
    evidence: validation.evidence ?? [],
    details: validation.details,
    suggestedHarnessFix: suggestedFixForValidation(validation.id, layer, validation.status),
  };
}

function layerSummary(attributions: DiagnosticAttribution[]) {
  const layers: HarnessSubsystemId[] = ["instructions", "tools", "environment", "state", "feedback"];
  return layers.map((layer) => {
    const layerAttributions = attributions.filter((attribution) => attribution.layer === layer);
    return {
      layer,
      attributionCount: layerAttributions.length,
      failedValidationCount: layerAttributions.filter((attribution) => attribution.status === "fail").length,
      warningValidationCount: layerAttributions.filter((attribution) => attribution.status === "warning").length,
      skippedValidationCount: layerAttributions.filter((attribution) => attribution.status === "skipped").length,
    };
  });
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
  if (matches(id, ["worker_function", "provider_replacement", "tool_safety", "dispatch", "runtime_bus", "function_invocation", "policy", "approval", "budget", "hook", "trace_context", "runtime_error"])) {
    return "tools";
  }
  if (matches(id, ["app_api", "app_persistence", "app_test", "app_acceptance", "architecture_boundary", "valid_json", "valid_lottie", "fps", "duration", "dimensions", "controls", "preview", "hypothesis", "evaluator_rubric", "completion_authority", "quality_document", "harness_quality", "course_alignment", "quality", "verified_completion", "verification_pipeline"])) {
    return "feedback";
  }
  if (matches(id, ["council", "critic", "blocker", "feedback_promotion", "diagnostic"])) {
    return "feedback";
  }
  return "instructions";
}

function layerForCriticCategory(category: string): HarnessSubsystemId {
  if (matches(category, ["source", "schema", "data", "component", "deployment"])) {
    return "environment";
  }
  if (matches(category, ["test", "coverage", "acceptance", "security", "accessibility", "validator"])) {
    return "feedback";
  }
  if (matches(category, ["api", "persistence", "tool", "runtime"])) {
    return "tools";
  }
  if (matches(category, ["handoff", "state", "progress"])) {
    return "state";
  }
  return "instructions";
}

function failureModeForValidation(id: string, layer: HarnessSubsystemId, status: ValidatorStatus): string {
  if (status === "skipped") {
    return "verification not exercised";
  }
  if (layer === "environment") {
    return "missing or under-grounded repository/source context";
  }
  if (layer === "state") {
    return "session state, scope, or lifecycle continuity gap";
  }
  if (layer === "tools") {
    return "runtime tool, gate, dispatch, or trace substrate gap";
  }
  if (layer === "feedback") {
    return "verification, review, or completion-judgment gap";
  }
  return "unclear or incomplete task/instruction contract";
}

function failureModeForCriticCategory(category: string): string {
  const layer = layerForCriticCategory(category);
  if (layer === "environment") {
    return "source facts or repo evidence are insufficient";
  }
  if (layer === "state") {
    return "handoff or progress state cannot answer the blocker";
  }
  if (layer === "tools") {
    return "runtime/tooling contract cannot prove the required behavior";
  }
  if (layer === "feedback") {
    return "review or validator coverage is not strong enough";
  }
  return "task acceptance criteria are underspecified";
}

function suggestedFixForValidation(id: string, layer: HarnessSubsystemId, status: ValidatorStatus): string {
  if (status === "skipped") {
    return `Make ${id} executable in this route or explicitly scope it out before completion.`;
  }
  if (layer === "environment") {
    return `Strengthen source profiling or required source availability before ${id} can support generation.`;
  }
  if (layer === "state") {
    return `Persist clearer progress, feature state, lifecycle, or restart evidence for ${id}.`;
  }
  if (layer === "tools") {
    return `Repair the runtime control plane so ${id} is enforced by registered tools rather than implicit code paths.`;
  }
  if (layer === "feedback") {
    return `Add or tighten validators, critic questions, or evaluator checks around ${id}.`;
  }
  return `Clarify task instructions or acceptance criteria so ${id} has an executable definition of done.`;
}

function matches(value: string, needles: string[]): boolean {
  const normalized = value.toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}
