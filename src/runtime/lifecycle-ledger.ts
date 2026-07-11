import path from "node:path";
import type { HarnessSpec, RuntimeAgentRun, TraceEvent, ValidationResult, ValidatorStatus } from "../types.js";
import { finalStatusFromValidations } from "../validators/common/validation-report.js";
import { stableId, writeJson } from "../utils/fs.js";
import type { FunctionInvocationLedger } from "./function-invocation-ledger.js";
import type { RuntimeControlArtifacts } from "./runtime-control-plane.js";
import type { CompletionAuthorityLedger } from "./completion-authority-ledger.js";

export const LIFECYCLE_LEDGER_ARTIFACT = "lifecycle-ledger.json";

interface LifecycleLedgerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  runtimeControl: RuntimeControlArtifacts;
  functionInvocationLedger: FunctionInvocationLedger;
  completionAuthorityLedger: CompletionAuthorityLedger;
  artifacts: string[];
  validations: ValidationResult[];
  agentRuns: RuntimeAgentRun[];
}

export interface LifecycleLedgerResult {
  artifact: string;
  ledger: LifecycleLedger;
  validation: ValidationResult;
}

interface LifecycleLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail" | "warning";
  rule: string;
  finalStatusWithoutLifecycle: string;
  phases: LifecyclePhase[];
  cleanExit: {
    requiredArtifacts: string[];
    presentArtifacts: string[];
    missingArtifacts: string[];
    requiredValidationIds: string[];
    failedValidationIds: string[];
    warningValidationIds: string[];
    agentRunCount: number;
  };
}

interface LifecyclePhase {
  id: string;
  order: number;
  status: "pass" | "fail" | "warning";
  details: string;
  evidence: string[];
  requiredArtifacts: string[];
  validationIds: string[];
}

export async function writeLifecycleLedger(input: LifecycleLedgerInput): Promise<LifecycleLedgerResult> {
  const ledger = buildLifecycleLedger(input);
  const target = path.join(input.outputDir, LIFECYCLE_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: LIFECYCLE_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: "lifecycle_ledger_clean",
      name: "Lifecycle ledger clean",
      status: ledger.status,
      details:
        ledger.status === "pass"
          ? "Run lifecycle moved through initialization, environment readiness, instruction routing, scheduling, runtime control, execution evidence, architecture-boundary enforcement, validation, feature state, source-of-record confirmation, feedback promotion, diagnostic attribution, repair guidance, subsystem audit, ablation comparison, evaluator-rubric recording, completion authority, quality-document recording, quality ledger documentation, continuity recording, course alignment, and clean handoff phases."
          : ledger.status === "warning"
            ? `Run lifecycle has warning phase(s): ${ledger.phases.filter((phase) => phase.status === "warning").map((phase) => phase.id).join(", ")}.`
            : `Run lifecycle has failed phase(s): ${ledger.phases.filter((phase) => phase.status === "fail").map((phase) => phase.id).join(", ")}.`,
      evidence: [target],
      repairable: true,
    },
  };
}

export function lifecycleLedgerEvents(runId: string, result: LifecycleLedgerResult): TraceEvent[] {
  return [
    {
      id: stableId("event", `${runId}:runtime.lifecycle_ledger.created:${result.ledger.id}`),
      runId,
      type: "runtime.lifecycle_ledger.created",
      timestamp: new Date().toISOString(),
      artifactId: LIFECYCLE_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Recorded ${result.ledger.phases.length} lifecycle phase(s) with status ${result.ledger.status}.`,
      evidence: [LIFECYCLE_LEDGER_ARTIFACT],
    },
  ];
}

function buildLifecycleLedger(input: LifecycleLedgerInput): LifecycleLedger {
  const finalStatusWithoutLifecycle = finalStatusFromValidations(input.validations);
  const phases: LifecyclePhase[] = [
    phase({
      id: "plan-locked",
      order: 1,
      artifacts: input.artifacts,
      requiredArtifacts: ["run-plan.json", "executor-lock.json", "worker-lock.json"],
      validationIds: [],
      validations: input.validations,
      pass: input.runtimeControl.dispatchPlan.nodeDispatches.length > 0,
      details: `${input.runtimeControl.dispatchPlan.nodeDispatches.length} node dispatch record(s) are available.`,
    }),
    phase({
      id: "initialization-ready",
      order: 2,
      artifacts: input.artifacts,
      requiredArtifacts: ["initialization-checklist.json", "feature-list.json", "progress.md", "sprint-contract.json", "verification-hierarchy.json"],
      validationIds: ["initialization_checklist_confirmed"],
      validations: input.validations,
      details: "Fresh-session initialization checklist is recorded before runtime execution.",
    }),
    phase({
      id: "feature-scheduled",
      order: 3,
      artifacts: input.artifacts,
      requiredArtifacts: ["feature-scheduler.json"],
      validationIds: ["feature_scheduler_ready"],
      validations: input.validations,
      details: "Scheduler picked the WIP=1 active feature before runtime execution.",
    }),
    phase({
      id: "environment-ready",
      order: 4,
      artifacts: input.artifacts,
      requiredArtifacts: ["environment-readiness-ledger.json"],
      validationIds: ["environment_readiness_confirmed"],
      validations: input.validations,
      details: "Runtime metadata, dependency reproducibility, source accessibility, output isolation, and repo guidance are recorded before generation.",
    }),
    phase({
      id: "instructions-routed",
      order: 5,
      artifacts: input.artifacts,
      requiredArtifacts: ["instruction-routing-ledger.json"],
      validationIds: ["instruction_router_resolved"],
      validations: input.validations,
      details: "Compact entry instructions route only applicable topic guidance into this run.",
    }),
    phase({
      id: "runtime-control-ready",
      order: 6,
      artifacts: input.artifacts,
      requiredArtifacts: [
        "worker-function-registry.json",
        "provider-replacement-registry.json",
        "tool-safety-ledger.json",
        "context-budget-ledger.json",
        "function-dispatch-plan.json",
        "runtime-bus.json",
        "startup-readiness.json",
        "policy-gate.json",
        "approval-gate.json",
        "budget-gate.json",
        "hook-ledger.json",
        "trace-context.json",
      ],
      validationIds: [
        "worker_function_registry_resolved",
        "provider_replacement_registry_ready",
        "tool_safety_registry_ready",
        "context_budget_ready",
        "function_dispatch_plan_resolved",
        "runtime_bus_resolved",
        "startup_readiness_confirmed",
        "policy_gate_passed",
        "approval_gate_resolved",
        "budget_gate_passed",
        "hook_ledger_recorded",
        "trace_context_propagated",
      ],
      validations: input.validations,
      details: "Runtime gates, tool safety classifications, context budget rules, function routes, replacement slots, bus topics, hooks, and trace context are established.",
    }),
    phase({
      id: "execution-evidenced",
      order: 7,
      artifacts: input.artifacts,
      requiredArtifacts: ["function-invocation-ledger.json"],
      validationIds: ["function_invocation_ledger_completed"],
      validations: input.validations,
      pass: input.functionInvocationLedger.summary.missingInvocationCount === 0,
      details: `${input.functionInvocationLedger.summary.completedInvocationCount} provider invocation(s) completed; ${input.functionInvocationLedger.summary.missingInvocationCount} missing.`,
    }),
    phase({
      id: "architecture-boundaries-enforced",
      order: 8,
      artifacts: input.artifacts,
      requiredArtifacts: ["architecture-boundary-ledger.json"],
      validationIds: ["architecture_boundary_rules_enforced"],
      validations: input.validations,
      details: "Executable architecture boundary rules were checked before completion judgment.",
    }),
    phase({
      id: "verification-judged",
      order: 9,
      artifacts: input.artifacts,
      requiredArtifacts: ["council-review.json"],
      validationIds: ["council_review_complete", "critic_questions_present", "blocker_questions_resolved"],
      validations: input.validations,
      details: `Pre-lifecycle final status is ${finalStatusWithoutLifecycle}.`,
    }),
    phase({
      id: "feature-state-gated",
      order: 10,
      artifacts: input.artifacts,
      requiredArtifacts: ["feature-list.json", "verification-hierarchy.json"],
      validationIds: ["feature_scope_state_gated"],
      validations: input.validations,
      details: "Validator-owned feature states and layered verification hierarchy are written.",
    }),
    phase({
      id: "source-of-record-confirmed",
      order: 11,
      artifacts: input.artifacts,
      requiredArtifacts: ["source-of-record-ledger.json"],
      validationIds: ["source_of_record_confirmed"],
      validations: input.validations,
      details: "Fresh-session source-of-record answers, source authority, knowledge freshness, and durable state discipline are recorded.",
    }),
    phase({
      id: "feedback-promoted",
      order: 12,
      artifacts: input.artifacts,
      requiredArtifacts: ["feedback-promotion-ledger.json"],
      validationIds: ["feedback_promotion_recorded"],
      validations: input.validations,
      details: "Review feedback and validation signals are promoted into durable improvement candidates.",
    }),
    phase({
      id: "diagnostic-loop-recorded",
      order: 13,
      artifacts: input.artifacts,
      requiredArtifacts: ["harness-diagnostic-ledger.json"],
      validationIds: ["diagnostic_loop_recorded"],
      validations: input.validations,
      details: "Non-passing validation and blocker signals are attributed to harness subsystems.",
    }),
    phase({
      id: "repair-guidance-recorded",
      order: 14,
      artifacts: input.artifacts,
      requiredArtifacts: ["repair-guidance-ledger.json"],
      validationIds: ["repair_guidance_recorded"],
      validations: input.validations,
      details: "Non-passing validation and blocker signals have agent-oriented what/why/fix/next-command repair guidance.",
    }),
    phase({
      id: "subsystem-audit-recorded",
      order: 15,
      artifacts: input.artifacts,
      requiredArtifacts: ["harness-subsystem-audit.json"],
      validationIds: ["harness_subsystem_audit_recorded"],
      validations: input.validations,
      details: "The five harness subsystems are scored and the current bottleneck is recorded before handoff.",
    }),
    phase({
      id: "ablation-comparison-recorded",
      order: 16,
      artifacts: input.artifacts,
      requiredArtifacts: ["harness-ablation-comparison.json"],
      validationIds: ["harness_ablation_comparison_recorded"],
      validations: input.validations,
      details: "Subsystem ablation probes are measured through artifact-evidence exclusion before handoff.",
    }),
    phase({
      id: "evaluator-rubric-recorded",
      order: 17,
      artifacts: input.artifacts,
      requiredArtifacts: ["evaluator-rubric.json", "evaluator-rubric.md"],
      validationIds: ["evaluator_rubric_recorded"],
      validations: input.validations,
      details: "Evaluator rubric dimensions are externalized with validation, review, and invocation evidence before completion authority is accepted.",
    }),
    phase({
      id: "completion-authority-confirmed",
      order: 18,
      artifacts: input.artifacts,
      requiredArtifacts: ["completion-authority-ledger.json"],
      validationIds: ["completion_authority_confirmed"],
      validations: input.validations,
      details: "Planner/generator/evaluator role separation and independent completion authority are confirmed before quality scoring, VCR, and clean handoff.",
    }),
    phase({
      id: "quality-document-recorded",
      order: 19,
      artifacts: input.artifacts,
      requiredArtifacts: ["quality-document.json", "quality-document.md"],
      validationIds: ["quality_document_recorded"],
      validations: input.validations,
      details: "A fresh-session quality document grades subsystem health and next priorities before the quality ledger and handoff.",
    }),
    phase({
      id: "quality-documented",
      order: 20,
      artifacts: input.artifacts,
      requiredArtifacts: ["quality-document.json", "quality-document.md", "harness-quality-ledger.json"],
      validationIds: ["harness_quality_documented"],
      validations: input.validations,
      details: "Run quality, repair backlog, subsystem health, ablation priority, and next improvement priorities are documented before handoff.",
    }),
    phase({
      id: "continuity-recorded",
      order: 21,
      artifacts: input.artifacts,
      requiredArtifacts: ["continuity-ledger.json"],
      validationIds: ["continuity_state_recorded"],
      validations: input.validations,
      details: "Decision log, restart inputs, verification snapshot, next actions, and rebuild-cost estimate are recorded before VCR and clean handoff.",
    }),
    phase({
      id: "course-alignment-confirmed",
      order: 22,
      artifacts: input.artifacts,
      requiredArtifacts: ["course-alignment-ledger.json"],
      validationIds: ["course_alignment_confirmed"],
      validations: input.validations,
      details: "Learn Harness Engineering principles are mapped to concrete artifacts, validators, subsystem coverage, and planned clean-handoff gates before VCR and clean handoff.",
    }),
    phase({
      id: "clean-handoff-ready",
      order: 23,
      artifacts: input.artifacts,
      requiredArtifacts: ["progress.md", "session-handoff.md", "run-state.json", "validation-report.md", "events.jsonl", "harness-trace.json"],
      validationIds: ["run_state_persisted"],
      validations: input.validations,
      details: "Restart and clean-exit artifacts are declared before final status is persisted.",
    }),
  ];
  const failedValidationIds = input.validations.filter((validation) => validation.status === "fail").map((validation) => validation.id);
  const warningValidationIds = input.validations.filter((validation) => validation.status === "warning" || validation.status === "skipped").map((validation) => validation.id);
  const requiredArtifacts = unique([...phases.flatMap((item) => item.requiredArtifacts), LIFECYCLE_LEDGER_ARTIFACT]);
  const presentArtifacts = requiredArtifacts.filter((artifact) => input.artifacts.includes(artifact) || artifact === LIFECYCLE_LEDGER_ARTIFACT);
  const missingArtifacts = requiredArtifacts.filter((artifact) => !presentArtifacts.includes(artifact));
  const status = phases.some((item) => item.status === "fail") || missingArtifacts.length ? "fail" : phases.some((item) => item.status === "warning") ? "warning" : "pass";
  return {
    schemaVersion: 1,
    id: stableId("lifecycle-ledger", `${input.runId}:${phases.map((item) => `${item.id}:${item.status}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    rule: "A run is not cleanly complete until the lifecycle ledger proves ordered initialization, environment readiness, instruction routing, scheduling, runtime control, context budgeting, execution evidence, architecture-boundary enforcement, verification judgment, feature-state gating, source-of-record confirmation, feedback promotion, diagnostic attribution, repair guidance, subsystem audit, ablation comparison, evaluator-rubric recording, independent completion authority, quality-document recording, quality ledger documentation, continuity recording, course alignment, and handoff readiness.",
    finalStatusWithoutLifecycle,
    phases,
    cleanExit: {
      requiredArtifacts,
      presentArtifacts,
      missingArtifacts,
      requiredValidationIds: unique(phases.flatMap((item) => item.validationIds)),
      failedValidationIds,
      warningValidationIds,
      agentRunCount: input.agentRuns.length,
    },
  };
}

function phase({
  id,
  order,
  artifacts,
  requiredArtifacts,
  validationIds,
  validations,
  details,
  pass = true,
}: {
  id: string;
  order: number;
  artifacts: string[];
  requiredArtifacts: string[];
  validationIds: string[];
  validations: ValidationResult[];
  details: string;
  pass?: boolean;
}): LifecyclePhase {
  const missingArtifacts = requiredArtifacts.filter((artifact) => !artifacts.includes(artifact));
  const statuses = validationIds.map((validationId) => validations.find((validation) => validation.id === validationId)?.status ?? "fail");
  const status = lifecycleStatus({ missingArtifacts, statuses, pass });
  return {
    id,
    order,
    status,
    details: missingArtifacts.length ? `${details} Missing artifact(s): ${missingArtifacts.join(", ")}.` : details,
    evidence: unique([...requiredArtifacts, ...validationIds]),
    requiredArtifacts,
    validationIds,
  };
}

function lifecycleStatus({
  missingArtifacts,
  statuses,
  pass,
}: {
  missingArtifacts: string[];
  statuses: ValidatorStatus[];
  pass: boolean;
}): "pass" | "fail" | "warning" {
  if (!pass || missingArtifacts.length || statuses.some((status) => status === "fail")) {
    return "fail";
  }
  if (statuses.some((status) => status === "warning" || status === "skipped")) {
    return "warning";
  }
  return "pass";
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
