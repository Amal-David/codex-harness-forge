import path from "node:path";
import type { CouncilReview, HarnessSpec, HarnessSubsystemId, TraceEvent, ValidationResult, ValidatorStatus } from "../types.js";
import { stableId, writeJson, writeText } from "../utils/fs.js";
import type { HarnessAblationComparisonLedger } from "./harness-ablation-comparison.js";
import type { HarnessSubsystemAuditLedger, SubsystemAuditEntry } from "./harness-subsystem-audit.js";
import type { FunctionInvocationLedger } from "./function-invocation-ledger.js";
import type { RepairAction } from "./repair-guidance-ledger.js";
import { traceEvent } from "./trace-ledger.js";

export const EVALUATOR_RUBRIC_JSON_ARTIFACT = "evaluator-rubric.json";
export const EVALUATOR_RUBRIC_MD_ARTIFACT = "evaluator-rubric.md";
export const EVALUATOR_RUBRIC_VALIDATION_ID = "evaluator_rubric_recorded";
export const QUALITY_DOCUMENT_JSON_ARTIFACT = "quality-document.json";
export const QUALITY_DOCUMENT_MD_ARTIFACT = "quality-document.md";
export const QUALITY_DOCUMENT_VALIDATION_ID = "quality_document_recorded";

type ArtifactStatus = "pass" | "fail" | "warning";
type ObservedStatus = ValidatorStatus | "missing";

interface EvaluatorRubricInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  artifacts: string[];
  validations: ValidationResult[];
  councilReview: CouncilReview;
  functionInvocationLedger: FunctionInvocationLedger;
}

interface QualityDocumentInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  artifacts: string[];
  validations: ValidationResult[];
  subsystemAudit: HarnessSubsystemAuditLedger;
  ablationComparison: HarnessAblationComparisonLedger;
  repairActions: RepairAction[];
}

export interface EvaluatorRubricResult {
  artifacts: string[];
  rubric: EvaluatorRubric;
  validation: ValidationResult;
}

export interface QualityDocumentResult {
  artifacts: string[];
  document: QualityDocument;
  validation: ValidationResult;
}

export interface EvaluatorRubric {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: ArtifactStatus;
  rule: string;
  summary: {
    dimensionCount: number;
    passingDimensionCount: number;
    warningDimensionCount: number;
    failedDimensionCount: number;
    minimumScore: number;
    lowestScore: number;
    unresolvedCount: number;
  };
  dimensions: EvaluatorRubricDimension[];
  unresolved: Array<{
    id: string;
    status: "fail" | "warning";
    reason: string;
    evidence: string[];
  }>;
}

interface EvaluatorRubricDimension {
  id: string;
  name: string;
  status: ArtifactStatus;
  score: number;
  minimumScore: number;
  passCriteria: string;
  observedValidationIds: string[];
  failedValidationIds: string[];
  warningValidationIds: string[];
  missingValidationIds: string[];
  evidence: string[];
  notes: string[];
}

export interface QualityDocument {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: ArtifactStatus;
  grade: "A" | "B" | "C" | "D";
  rule: string;
  summary: {
    moduleCount: number;
    healthyModuleCount: number;
    degradedModuleCount: number;
    blockedModuleCount: number;
    repairActionCount: number;
    measuredAblationProbeCount: number;
    lowestSubsystemScore: number;
    unresolvedCount: number;
  };
  modules: QualityModule[];
  nextPriorities: Array<{
    rank: number;
    subsystem: HarnessSubsystemId | "none";
    action: string;
    evidence: string[];
  }>;
  unresolved: Array<{
    id: string;
    status: "fail" | "warning";
    reason: string;
    evidence: string[];
  }>;
}

interface QualityModule {
  id: HarnessSubsystemId;
  grade: "A" | "B" | "C" | "D";
  status: "healthy" | "degraded" | "blocked";
  verificationStatus: "passing" | "warning" | "failing";
  agentUnderstandable: boolean;
  testStability: "stable" | "watch" | "unstable";
  boundaryStatus: "compliant" | "watch" | "violated";
  keyGaps: string[];
  evidence: string[];
  recommendation: string;
}

export async function writeEvaluatorRubric(input: EvaluatorRubricInput): Promise<EvaluatorRubricResult> {
  const rubric = buildEvaluatorRubric(input);
  const jsonPath = path.join(input.outputDir, EVALUATOR_RUBRIC_JSON_ARTIFACT);
  const mdPath = path.join(input.outputDir, EVALUATOR_RUBRIC_MD_ARTIFACT);
  await writeJson(jsonPath, rubric);
  await writeText(mdPath, renderEvaluatorRubric(rubric));
  return {
    artifacts: [EVALUATOR_RUBRIC_JSON_ARTIFACT, EVALUATOR_RUBRIC_MD_ARTIFACT],
    rubric,
    validation: {
      id: EVALUATOR_RUBRIC_VALIDATION_ID,
      name: "Evaluator rubric recorded",
      status: rubric.status,
      details:
        rubric.status === "pass"
          ? `${rubric.summary.dimensionCount} evaluator rubric dimension(s) meet their minimum scores.`
          : `Evaluator rubric ${rubric.status}; lowest score ${rubric.summary.lowestScore}, unresolved=${rubric.summary.unresolvedCount}.`,
      evidence: [jsonPath, mdPath],
      repairable: true,
    },
  };
}

export async function writeQualityDocument(input: QualityDocumentInput): Promise<QualityDocumentResult> {
  const document = buildQualityDocument(input);
  const jsonPath = path.join(input.outputDir, QUALITY_DOCUMENT_JSON_ARTIFACT);
  const mdPath = path.join(input.outputDir, QUALITY_DOCUMENT_MD_ARTIFACT);
  await writeJson(jsonPath, document);
  await writeText(mdPath, renderQualityDocument(document));
  return {
    artifacts: [QUALITY_DOCUMENT_JSON_ARTIFACT, QUALITY_DOCUMENT_MD_ARTIFACT],
    document,
    validation: {
      id: QUALITY_DOCUMENT_VALIDATION_ID,
      name: "Quality document recorded",
      status: document.status,
      details:
        document.status === "pass"
          ? `Quality document recorded ${document.summary.moduleCount} subsystem module(s) with grade ${document.grade}.`
          : `Quality document ${document.status}; grade ${document.grade}, unresolved=${document.summary.unresolvedCount}.`,
      evidence: [jsonPath, mdPath],
      repairable: true,
    },
  };
}

export function evaluatorRubricEvents(runId: string, result: EvaluatorRubricResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.evaluator_rubric.recorded",
      artifactId: EVALUATOR_RUBRIC_JSON_ARTIFACT,
      status: result.validation.status,
      message: `Recorded evaluator rubric with ${result.rubric.summary.dimensionCount} dimension(s), status ${result.rubric.status}.`,
      evidence: result.artifacts,
    }),
  ];
}

export function qualityDocumentEvents(runId: string, result: QualityDocumentResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.quality_document.recorded",
      artifactId: QUALITY_DOCUMENT_JSON_ARTIFACT,
      status: result.validation.status,
      message: `Recorded quality document grade ${result.document.grade} with status ${result.document.status}.`,
      evidence: result.artifacts,
    }),
  ];
}

function buildEvaluatorRubric(input: EvaluatorRubricInput): EvaluatorRubric {
  const validationsById = new Map(input.validations.map((validation) => [validation.id, validation]));
  const dimensions = input.spec.harnessModel.sprintContract.evaluatorRubric.map((dimension) =>
    evaluatorDimension({
      id: dimension.id,
      name: dimension.name,
      minimumScore: dimension.minimumScore,
      passCriteria: dimension.passCriteria,
      validationsById,
      councilReview: input.councilReview,
      functionInvocationLedger: input.functionInvocationLedger,
      artifacts: input.artifacts,
    }),
  );
  const unresolved = dimensions.flatMap((dimension) =>
    dimension.status === "pass"
      ? []
      : [
          {
            id: dimension.id,
            status: dimension.status,
            reason: `${dimension.name} scored ${dimension.score}/${dimension.minimumScore}; failed=${dimension.failedValidationIds.join(", ") || "none"}, warning=${dimension.warningValidationIds.join(", ") || "none"}, missing=${dimension.missingValidationIds.join(", ") || "none"}.`,
            evidence: dimension.evidence,
          },
        ],
  );
  const status = dimensions.some((dimension) => dimension.status === "fail") ? "fail" : dimensions.some((dimension) => dimension.status === "warning") ? "warning" : "pass";
  const lowestScore = Math.min(...dimensions.map((dimension) => dimension.score));
  return {
    schemaVersion: 1,
    id: stableId("evaluator-rubric", `${input.runId}:${dimensions.map((dimension) => `${dimension.id}:${dimension.score}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    rule: "Every run must externalize the evaluator rubric used for completion judgment, with dimension scores tied to validation, review, and invocation evidence.",
    summary: {
      dimensionCount: dimensions.length,
      passingDimensionCount: dimensions.filter((dimension) => dimension.status === "pass").length,
      warningDimensionCount: dimensions.filter((dimension) => dimension.status === "warning").length,
      failedDimensionCount: dimensions.filter((dimension) => dimension.status === "fail").length,
      minimumScore: Math.min(...dimensions.map((dimension) => dimension.minimumScore)),
      lowestScore,
      unresolvedCount: unresolved.length,
    },
    dimensions,
    unresolved,
  };
}

function evaluatorDimension({
  id,
  name,
  minimumScore,
  passCriteria,
  validationsById,
  councilReview,
  functionInvocationLedger,
  artifacts,
}: {
  id: string;
  name: string;
  minimumScore: number;
  passCriteria: string;
  validationsById: Map<string, ValidationResult>;
  councilReview: CouncilReview;
  functionInvocationLedger: FunctionInvocationLedger;
  artifacts: string[];
}): EvaluatorRubricDimension {
  const validationIds = validatorIdsForDimension(id);
  const observations = validationIds.map((validationId) => ({
    id: validationId,
    status: validationsById.get(validationId)?.status ?? ("missing" as const),
    evidence: validationsById.get(validationId)?.evidence ?? [validationId],
  }));
  const failedValidationIds = observations.filter((item) => item.status === "fail" || item.status === "missing").map((item) => item.id);
  const warningValidationIds = observations.filter((item) => item.status === "warning" || item.status === "skipped").map((item) => item.id);
  const missingValidationIds = observations.filter((item) => item.status === "missing").map((item) => item.id);
  const hasCouncilBlockers = id === "correctness" && councilReview.unresolvedBlockerQuestions.length > 0;
  const hasMissingArtifacts = id === "handoff" && ["feature-list.json", "progress.md", "session-handoff.md"].some((artifact) => !artifacts.includes(artifact));
  const invocationWarning = id === "observability" && functionInvocationLedger.summary.completedInvocationCount === 0;
  const score = failedValidationIds.length || hasCouncilBlockers || hasMissingArtifacts ? 1 : warningValidationIds.length || invocationWarning ? 3 : 5;
  const status: ArtifactStatus = score >= minimumScore ? "pass" : score >= 3 ? "warning" : "fail";
  const notes = [
    hasCouncilBlockers ? `${councilReview.unresolvedBlockerQuestions.length} unresolved blocker question(s) remain.` : "",
    hasMissingArtifacts ? "Feature, progress, or handoff artifacts are missing." : "",
    invocationWarning ? "No completed function invocation evidence was observed." : "",
  ].filter(Boolean);
  return {
    id,
    name,
    status,
    score,
    minimumScore,
    passCriteria,
    observedValidationIds: validationIds,
    failedValidationIds,
    warningValidationIds,
    missingValidationIds,
    evidence: unique([...observations.flatMap((item) => item.evidence), ...artifactEvidenceForDimension(id), ...(id === "observability" ? ["function-invocation-ledger.json"] : [])]),
    notes: notes.length ? notes : ["Rubric dimension is grounded in current runtime validation evidence."],
  };
}

function validatorIdsForDimension(id: string): string[] {
  if (id === "correctness") {
    return ["source_availability", "environment_readiness_confirmed", "function_invocation_ledger_completed", "council_review_complete", "blocker_questions_resolved"];
  }
  if (id === "source-grounding") {
    return ["source_availability", "environment_readiness_confirmed", "source_of_record_confirmed"];
  }
  if (id === "architecture") {
    return ["architecture_boundary_rules_enforced", "worker_function_registry_resolved", "function_dispatch_plan_resolved", "runtime_bus_resolved"];
  }
  if (id === "observability") {
    return ["function_invocation_ledger_completed", "critic_questions_present", "council_review_complete"];
  }
  if (id === "handoff") {
    return ["initialization_checklist_confirmed", "feature_scheduler_ready", "run_state_persisted"];
  }
  return ["council_review_complete", "critic_questions_present"];
}

function artifactEvidenceForDimension(id: string): string[] {
  if (id === "correctness") {
    return ["validation-report.md", "verification-hierarchy.json", "council-review.json"];
  }
  if (id === "source-grounding") {
    return ["source-of-record-ledger.json", "environment-readiness-ledger.json", "evidence-graph.json"];
  }
  if (id === "architecture") {
    return ["architecture-boundary-ledger.json", "function-dispatch-plan.json", "runtime-bus.json"];
  }
  if (id === "observability") {
    return ["function-invocation-ledger.json", "events.jsonl", "harness-trace.json", "council-review.json"];
  }
  if (id === "handoff") {
    return ["feature-list.json", "progress.md", "session-handoff.md", "run-state.json"];
  }
  return ["council-review.json"];
}

function buildQualityDocument(input: QualityDocumentInput): QualityDocument {
  const modules = input.subsystemAudit.subsystems.map(qualityModule);
  const unresolved = [
    ...modules
      .filter((module) => module.status !== "healthy")
      .map((module) => ({
        id: module.id,
        status: module.status === "blocked" ? ("fail" as const) : ("warning" as const),
        reason: `${module.id} quality is ${module.status}: ${module.keyGaps.join("; ") || module.recommendation}.`,
        evidence: module.evidence,
      })),
    ...(input.subsystemAudit.status === "fail"
      ? [
          {
            id: "subsystem-audit",
            status: "fail" as const,
            reason: "Subsystem audit itself is failing, so the quality document cannot be clean.",
            evidence: ["harness-subsystem-audit.json"],
          },
        ]
      : []),
  ];
  const status = unresolved.some((item) => item.status === "fail") ? "fail" : unresolved.some((item) => item.status === "warning") ? "warning" : "pass";
  const score = Math.max(0, Math.round((modules.reduce((total, module) => total + gradeScore(module.grade), 0) / Math.max(1, modules.length)) * 20) - input.repairActions.length * 2);
  const nextPriorities = buildQualityPriorities(input);
  return {
    schemaVersion: 1,
    id: stableId("quality-document", `${input.runId}:${modules.map((module) => `${module.id}:${module.grade}`).join("|")}:${input.repairActions.length}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    grade: gradeForScore(score),
    rule: "Every significant session must leave a quality snapshot that grades each harness subsystem, records known gaps, and points the next session to the weakest area.",
    summary: {
      moduleCount: modules.length,
      healthyModuleCount: modules.filter((module) => module.status === "healthy").length,
      degradedModuleCount: modules.filter((module) => module.status === "degraded").length,
      blockedModuleCount: modules.filter((module) => module.status === "blocked").length,
      repairActionCount: input.repairActions.length,
      measuredAblationProbeCount: input.ablationComparison.summary.measuredProbeCount,
      lowestSubsystemScore: input.subsystemAudit.summary.lowestScore,
      unresolvedCount: unresolved.length,
    },
    modules,
    nextPriorities,
    unresolved,
  };
}

function qualityModule(entry: SubsystemAuditEntry): QualityModule {
  const hasFailures = entry.validationSummary.fail > 0;
  const hasWarnings = entry.validationSummary.warning > 0 || entry.validationSummary.skipped > 0 || entry.validationSummary.missing > 0;
  const keyGaps = unique([
    ...entry.missingArtifacts.map((artifact) => `Missing ${artifact}`),
    ...(hasFailures ? ["Failing validations remain"] : []),
    ...(hasWarnings ? ["Warning, skipped, or missing validations remain"] : []),
    ...(entry.repairActionIds.length ? [`${entry.repairActionIds.length} repair action(s) open`] : []),
  ]);
  return {
    id: entry.id,
    grade: gradeForSubsystemScore(entry.score),
    status: entry.status,
    verificationStatus: hasFailures ? "failing" : hasWarnings ? "warning" : "passing",
    agentUnderstandable: entry.missingArtifacts.length === 0 && Boolean(entry.rationale),
    testStability: hasFailures ? "unstable" : hasWarnings ? "watch" : "stable",
    boundaryStatus: entry.id === "feedback" && hasFailures ? "violated" : hasWarnings || entry.missingArtifacts.length ? "watch" : "compliant",
    keyGaps: keyGaps.length ? keyGaps : ["No current quality gaps recorded."],
    evidence: entry.evidence.length ? entry.evidence : entry.presentArtifacts,
    recommendation: entry.recommendedHarnessChange,
  };
}

function buildQualityPriorities(input: QualityDocumentInput): QualityDocument["nextPriorities"] {
  const priorities = [
    {
      subsystem: input.subsystemAudit.summary.nextInvestment.subsystem,
      action: input.subsystemAudit.summary.nextInvestment.action,
      evidence: input.subsystemAudit.summary.nextInvestment.evidence,
    },
    ...input.repairActions.slice(0, 4).map((action) => ({
      subsystem: action.layer,
      action: action.fix,
      evidence: action.evidence,
    })),
  ];
  return priorities.slice(0, 5).map((priority, index) => ({ rank: index + 1, ...priority }));
}

function renderEvaluatorRubric(rubric: EvaluatorRubric): string {
  const rows = rubric.dimensions
    .map((dimension) => `| ${dimension.id} | ${dimension.score}/${dimension.minimumScore} | ${dimension.status} | ${dimension.passCriteria} | ${dimension.evidence.join(", ")} |`)
    .join("\n");
  const unresolved = rubric.unresolved.length ? rubric.unresolved.map((item) => `- [${item.status}] ${item.id}: ${item.reason}`).join("\n") : "- None.";
  return [
    "# Evaluator Rubric",
    "",
    `Status: ${rubric.status}`,
    `Lowest score: ${rubric.summary.lowestScore}`,
    "",
    "| Dimension | Score | Status | Pass criteria | Evidence |",
    "| --- | ---: | --- | --- | --- |",
    rows,
    "",
    "## Unresolved",
    "",
    unresolved,
    "",
  ].join("\n");
}

function renderQualityDocument(document: QualityDocument): string {
  const rows = document.modules
    .map((module) => `| ${module.id} | ${module.grade} | ${module.status} | ${module.verificationStatus} | ${module.testStability} | ${module.keyGaps.join("; ")} |`)
    .join("\n");
  const priorities = document.nextPriorities.map((priority) => `${priority.rank}. ${priority.subsystem}: ${priority.action}`).join("\n");
  const unresolved = document.unresolved.length ? document.unresolved.map((item) => `- [${item.status}] ${item.id}: ${item.reason}`).join("\n") : "- None.";
  return [
    "# Quality Document",
    "",
    `Status: ${document.status}`,
    `Grade: ${document.grade}`,
    "",
    "| Module | Grade | Status | Verification | Test stability | Key gaps |",
    "| --- | --- | --- | --- | --- | --- |",
    rows,
    "",
    "## Next Priorities",
    "",
    priorities || "1. none: No immediate bottleneck recorded.",
    "",
    "## Unresolved",
    "",
    unresolved,
    "",
  ].join("\n");
}

function gradeForSubsystemScore(score: number): QualityModule["grade"] {
  if (score >= 5) {
    return "A";
  }
  if (score >= 4) {
    return "B";
  }
  if (score >= 3) {
    return "C";
  }
  return "D";
}

function gradeScore(grade: QualityDocument["grade"]): number {
  if (grade === "A") {
    return 5;
  }
  if (grade === "B") {
    return 4;
  }
  if (grade === "C") {
    return 3;
  }
  return 1;
}

function gradeForScore(score: number): QualityDocument["grade"] {
  if (score >= 90) {
    return "A";
  }
  if (score >= 75) {
    return "B";
  }
  if (score >= 60) {
    return "C";
  }
  return "D";
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
