import path from "node:path";
import type { CouncilReview, HarnessSpec, RuntimeAgentRun, TraceEvent, ValidationResult, ValidatorStatus, VerificationLayer } from "../types.js";
import { stableId, writeJson } from "../utils/fs.js";
import { traceEvent } from "./trace-ledger.js";
import type { FunctionInvocationLedger } from "./function-invocation-ledger.js";

export const COMPLETION_AUTHORITY_LEDGER_ARTIFACT = "completion-authority-ledger.json";
export const COMPLETION_AUTHORITY_VALIDATION_ID = "completion_authority_confirmed";
const DEFERRED_AUTHORITY_VALIDATION_IDS = new Set([
  COMPLETION_AUTHORITY_VALIDATION_ID,
  "feedback_promotion_recorded",
  "diagnostic_loop_recorded",
  "repair_guidance_recorded",
  "harness_subsystem_audit_recorded",
  "harness_ablation_comparison_recorded",
  "quality_document_recorded",
  "harness_quality_documented",
  "continuity_state_recorded",
  "course_alignment_confirmed",
  "feature_scope_state_gated",
  "lifecycle_ledger_clean",
  "verified_completion_rate_passed",
  "session_clean_state_ready",
  "harness_engineering_record_written",
]);

type CompletionAuthorityStatus = "pass" | "fail" | "warning";
type ObservedValidationStatus = ValidatorStatus | "missing";
type CompletionRole = "planner" | "generator" | "evaluator" | "authority";

interface CompletionAuthorityLedgerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  functionInvocationLedger: FunctionInvocationLedger;
  councilReview: CouncilReview;
  validations: ValidationResult[];
  agentRuns: RuntimeAgentRun[];
}

export interface CompletionAuthorityLedgerResult {
  artifact: string;
  ledger: CompletionAuthorityLedger;
  validation: ValidationResult;
}

export interface CompletionAuthorityLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: CompletionAuthorityStatus;
  protocol: {
    name: "harness.completion-authority";
    authorityRule: string;
    roleSeparationRule: string;
    terminationRule: string;
  };
  summary: {
    roleCount: number;
    plannerEvidenceCount: number;
    generatorEvidenceCount: number;
    evaluatorEvidenceCount: number;
    authorityGateCount: number;
    failedAuthorityGateCount: number;
    warningAuthorityGateCount: number;
    requiredVerificationLayerCount: number;
    passedVerificationLayerCount: number;
    unresolvedCount: number;
  };
  roles: CompletionRoleEvidence[];
  verificationLayers: CompletionVerificationLayer[];
  authorityGates: CompletionAuthorityGate[];
  unresolved: CompletionAuthorityIssue[];
}

interface CompletionRoleEvidence {
  role: CompletionRole;
  owner: string;
  status: CompletionAuthorityStatus;
  rule: string;
  evidence: string[];
  ownerIds: string[];
}

interface CompletionVerificationLayer {
  layer: VerificationLayer;
  required: boolean;
  validatorIds: string[];
  passCount: number;
  failCount: number;
  warningCount: number;
  missingCount: number;
  status: CompletionAuthorityStatus;
}

interface CompletionAuthorityGate {
  id: string;
  status: CompletionAuthorityStatus;
  details: string;
  evidence: string[];
}

interface CompletionAuthorityIssue {
  id: string;
  status: "fail" | "warning";
  reason: string;
  evidence: string[];
}

export async function writeCompletionAuthorityLedger(input: CompletionAuthorityLedgerInput): Promise<CompletionAuthorityLedgerResult> {
  const ledger = buildCompletionAuthorityLedger(input);
  const target = path.join(input.outputDir, COMPLETION_AUTHORITY_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: COMPLETION_AUTHORITY_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: COMPLETION_AUTHORITY_VALIDATION_ID,
      name: "Completion authority confirmed",
      status: ledger.status,
      details: validationDetails(ledger),
      evidence: [target],
      repairable: true,
    },
  };
}

export function completionAuthorityEvents(runId: string, result: CompletionAuthorityLedgerResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.completion_authority.recorded",
      artifactId: COMPLETION_AUTHORITY_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Recorded independent completion authority with status ${result.ledger.status}.`,
      evidence: [COMPLETION_AUTHORITY_LEDGER_ARTIFACT],
    }),
  ];
}

function buildCompletionAuthorityLedger(input: CompletionAuthorityLedgerInput): CompletionAuthorityLedger {
  const validationsById = new Map(input.validations.map((validation) => [validation.id, validation]));
  const plannerRuns = input.agentRuns.filter((run) => run.group === "runtime-planning");
  const councilVerifierRuns = input.agentRuns.filter((run) => run.agentId === "council-verifier");
  const artifactGeneratorInvocations = input.functionInvocationLedger.invocations.filter((invocation) => invocation.functionId.startsWith("artifact-generator."));
  const validatorInvocations = input.functionInvocationLedger.invocations.filter((invocation) => invocation.functionId.startsWith("validator."));
  const completedArtifactInvocations = artifactGeneratorInvocations.filter((invocation) => invocation.status === "completed");
  const completedValidatorInvocations = validatorInvocations.filter((invocation) => invocation.status === "completed");
  const roles: CompletionRoleEvidence[] = [
    {
      role: "planner",
      owner: "runtime-planning workers",
      status: plannerRuns.length ? "pass" : "fail",
      rule: "Planning must be evidenced before generator output is accepted.",
      evidence: unique(["agent-runs/runtime-planning-manifest.json", ...plannerRuns.flatMap((run) => run.artifacts)]),
      ownerIds: unique(plannerRuns.map((run) => run.agentId)),
    },
    {
      role: "generator",
      owner: "artifact generator executors",
      status: completedArtifactInvocations.length && completedArtifactInvocations.length === artifactGeneratorInvocations.length ? "pass" : completedArtifactInvocations.length ? "warning" : "fail",
      rule: "Generation is evidenced by artifact-producing executor invocations, not by completion prose.",
      evidence: unique(completedArtifactInvocations.flatMap((invocation) => invocation.evidence)),
      ownerIds: unique(artifactGeneratorInvocations.map((invocation) => invocation.functionId)),
    },
    {
      role: "evaluator",
      owner: "validators and council verifier",
      status: completedValidatorInvocations.length && councilVerifierRuns.length && input.councilReview.criticReviews.some((review) => review.criticId === "council-verifier") ? "pass" : completedValidatorInvocations.length || councilVerifierRuns.length ? "warning" : "fail",
      rule: "Evaluation must be owned by validators and the verifier critic, not by the artifact generator.",
      evidence: unique(["validation-report.md", "council-review.json", ...completedValidatorInvocations.flatMap((invocation) => invocation.evidence), ...councilVerifierRuns.flatMap((run) => run.artifacts)]),
      ownerIds: unique(["runtime-validators", ...councilVerifierRuns.map((run) => run.agentId)]),
    },
    {
      role: "authority",
      owner: "completion authority ledger",
      status: "pass",
      rule: "Final completion authority is a runtime ledger derived from independent validation and review signals.",
      evidence: [COMPLETION_AUTHORITY_LEDGER_ARTIFACT],
      ownerIds: [COMPLETION_AUTHORITY_VALIDATION_ID],
    },
  ];
  const verificationLayers = input.spec.harnessModel.verificationHierarchy.map((layer) => verificationLayerCompletion(layer, validationsById));
  const requiredAuthorityValidationIds = unique([
    "source_availability",
    "environment_readiness_confirmed",
    "source_of_record_confirmed",
    "architecture_boundary_rules_enforced",
    "function_invocation_ledger_completed",
    "node_execution_integrity",
    "evaluator_rubric_recorded",
    "council_review_complete",
    "critic_questions_present",
    "blocker_questions_resolved",
    "app_prd_critic_coverage",
  ]);
  const requiredAuthorityStatuses: Array<{ id: string; status: ObservedValidationStatus; evidence: string[] }> = requiredAuthorityValidationIds.map((id) => ({
    id,
    status: validationsById.get(id)?.status ?? "missing",
    evidence: validationsById.get(id)?.evidence ?? [id],
  }));
  const generatorOwnerIds = new Set(roles.find((role) => role.role === "generator")?.ownerIds ?? []);
  const evaluatorOwnerIds = new Set(roles.find((role) => role.role === "evaluator")?.ownerIds ?? []);
  const sharedGeneratorEvaluatorOwners = [...generatorOwnerIds].filter((ownerId) => evaluatorOwnerIds.has(ownerId));
  const authorityGates: CompletionAuthorityGate[] = [
    gate({
      id: "planner-generator-evaluator-separated",
      pass: roles.every((role) => role.status !== "fail") && sharedGeneratorEvaluatorOwners.length === 0,
      warn: roles.some((role) => role.status === "warning"),
      details: sharedGeneratorEvaluatorOwners.length
        ? `Generator and evaluator share owner(s): ${sharedGeneratorEvaluatorOwners.join(", ")}.`
        : "Planner, generator, evaluator, and authority roles have distinct evidence owners.",
      evidence: roles.flatMap((role) => role.evidence),
    }),
    gate({
      id: "artifact-generation-observed",
      pass: artifactGeneratorInvocations.length > 0 && completedArtifactInvocations.length === artifactGeneratorInvocations.length,
      warn: completedArtifactInvocations.length > 0,
      details: `${completedArtifactInvocations.length}/${artifactGeneratorInvocations.length} artifact generator invocation(s) completed.`,
      evidence: unique(completedArtifactInvocations.flatMap((invocation) => invocation.evidence)),
    }),
    gate({
      id: "independent-evaluator-observed",
      pass: completedValidatorInvocations.length > 0 && councilVerifierRuns.length > 0,
      warn: completedValidatorInvocations.length > 0 || councilVerifierRuns.length > 0,
      details: `${completedValidatorInvocations.length} validator invocation(s) and ${councilVerifierRuns.length} council-verifier run(s) observed.`,
      evidence: unique(["council-review.json", ...completedValidatorInvocations.flatMap((invocation) => invocation.evidence), ...councilVerifierRuns.flatMap((run) => run.artifacts)]),
    }),
    gate({
      id: "three-layer-termination-covered",
      pass: verificationLayers.filter((layer) => layer.required).every((layer) => layer.status === "pass"),
      warn: verificationLayers.filter((layer) => layer.required).some((layer) => layer.status === "warning"),
      details: `${verificationLayers.filter((layer) => layer.status === "pass").length}/${verificationLayers.length} verification layer(s) passed.`,
      evidence: ["verification-hierarchy.json", "validation-report.md"],
    }),
    gate({
      id: "authority-validations-clean",
      pass: requiredAuthorityStatuses.every((validation) => validation.status === "pass"),
      warn: requiredAuthorityStatuses.some((validation) => validation.status === "warning" || validation.status === "skipped"),
      details: validationGateDetails(requiredAuthorityStatuses),
      evidence: unique(requiredAuthorityStatuses.flatMap((validation) => validation.evidence)),
    }),
    gate({
      id: "runtime-signals-captured",
      pass: input.functionInvocationLedger.status === "pass" && input.functionInvocationLedger.summary.completedInvocationCount > 0,
      warn: input.functionInvocationLedger.summary.completedInvocationCount > 0,
      details: `${input.functionInvocationLedger.summary.completedInvocationCount} completed invocation(s), ${input.functionInvocationLedger.summary.missingInvocationCount} missing invocation(s).`,
      evidence: ["function-invocation-ledger.json", ...input.functionInvocationLedger.invocations.flatMap((invocation) => invocation.evidence)],
    }),
    gate({
      id: "blockers-do-not-authorize-success",
      pass: input.councilReview.unresolvedBlockerQuestions.length === 0 && validationsById.get("blocker_questions_resolved")?.status === "pass",
      warn: input.councilReview.unresolvedBlockerQuestions.length > 0 || validationsById.get("blocker_questions_resolved")?.status === "warning",
      details: `${input.councilReview.unresolvedBlockerQuestions.length} unresolved blocker question(s); blocker_questions_resolved=${validationsById.get("blocker_questions_resolved")?.status ?? "missing"}.`,
      evidence: ["council-review.json"],
    }),
  ];
  const unresolved = authorityGates.flatMap((gate) =>
    gate.status === "pass"
      ? []
      : [
          {
            id: gate.id,
            status: gate.status,
            reason: gate.details,
            evidence: gate.evidence,
          },
        ],
  );
  const status = unresolved.some((issue) => issue.status === "fail") ? "fail" : unresolved.some((issue) => issue.status === "warning") ? "warning" : "pass";
  return {
    schemaVersion: 1,
    id: stableId("completion-authority-ledger", `${input.runId}:${authorityGates.map((item) => `${item.id}:${item.status}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    protocol: {
      name: "harness.completion-authority",
      authorityRule: "The worker or artifact generator never owns final completion judgment; runtime validators, council verifier evidence, and this ledger authorize completion.",
      roleSeparationRule: "Planning, generation, evaluation, and final authority must have distinct evidence owners.",
      terminationRule: "Static, runtime, and system verification layers must be satisfied before clean success can be reported.",
    },
    summary: {
      roleCount: roles.length,
      plannerEvidenceCount: roles.find((role) => role.role === "planner")?.evidence.length ?? 0,
      generatorEvidenceCount: roles.find((role) => role.role === "generator")?.evidence.length ?? 0,
      evaluatorEvidenceCount: roles.find((role) => role.role === "evaluator")?.evidence.length ?? 0,
      authorityGateCount: authorityGates.length,
      failedAuthorityGateCount: authorityGates.filter((item) => item.status === "fail").length,
      warningAuthorityGateCount: authorityGates.filter((item) => item.status === "warning").length,
      requiredVerificationLayerCount: verificationLayers.filter((layer) => layer.required).length,
      passedVerificationLayerCount: verificationLayers.filter((layer) => layer.required && layer.status === "pass").length,
      unresolvedCount: unresolved.length,
    },
    roles,
    verificationLayers,
    authorityGates,
    unresolved,
  };
}

function verificationLayerCompletion(
  layer: HarnessSpec["harnessModel"]["verificationHierarchy"][number],
  validationsById: Map<string, ValidationResult>,
): CompletionVerificationLayer {
  const validatorIds = unique(layer.validatorIds).filter((id) => !DEFERRED_AUTHORITY_VALIDATION_IDS.has(id));
  const statuses = validatorIds.map((id) => validationsById.get(id)?.status ?? "missing");
  const failCount = statuses.filter((status) => status === "fail" || status === "missing").length;
  const warningCount = statuses.filter((status) => status === "warning" || status === "skipped").length;
  const passCount = statuses.filter((status) => status === "pass").length;
  return {
    layer: layer.layer,
    required: layer.required,
    validatorIds,
    passCount,
    failCount,
    warningCount,
    missingCount: statuses.filter((status) => status === "missing").length,
    status: failCount ? "fail" : warningCount ? "warning" : "pass",
  };
}

function gate({
  id,
  pass,
  warn,
  details,
  evidence,
}: {
  id: string;
  pass: boolean;
  warn: boolean;
  details: string;
  evidence: string[];
}): CompletionAuthorityGate {
  return {
    id,
    status: pass ? "pass" : warn ? "warning" : "fail",
    details,
    evidence: unique(evidence),
  };
}

function validationGateDetails(validations: Array<{ id: string; status: ObservedValidationStatus }>): string {
  const failed = validations.filter((validation) => validation.status === "fail" || validation.status === "missing").map((validation) => `${validation.id}:${validation.status}`);
  const warnings = validations.filter((validation) => validation.status === "warning" || validation.status === "skipped").map((validation) => `${validation.id}:${validation.status}`);
  if (failed.length) {
    return `Authority validation failure(s): ${failed.join(", ")}.`;
  }
  if (warnings.length) {
    return `Authority validation warning(s): ${warnings.join(", ")}.`;
  }
  return `${validations.length} authority validation(s) passed.`;
}

function validationDetails(ledger: CompletionAuthorityLedger): string {
  if (ledger.status === "pass") {
    return `Completion authority passed with ${ledger.summary.roleCount} separated role(s), ${ledger.summary.authorityGateCount} authority gate(s), and ${ledger.summary.passedVerificationLayerCount}/${ledger.summary.requiredVerificationLayerCount} required verification layer(s).`;
  }
  if (ledger.status === "warning") {
    return `Completion authority has warning gate(s): ${ledger.unresolved
      .filter((issue) => issue.status === "warning")
      .map((issue) => issue.id)
      .join(", ")}.`;
  }
  return `Completion authority failed gate(s): ${ledger.unresolved
    .filter((issue) => issue.status === "fail")
    .map((issue) => issue.id)
    .join(", ")}.`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
