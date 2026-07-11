import path from "node:path";
import type { HarnessFeature, HarnessSpec, TraceEvent, ValidationResult, ValidatorStatus, VerificationLayer } from "../types.js";
import { pathExists, readJson, stableId, writeJson } from "../utils/fs.js";
import { traceEvent } from "./trace-ledger.js";

export const VERIFICATION_PIPELINE_LEDGER_ARTIFACT = "verification-pipeline-ledger.json";
export const VERIFIED_COMPLETION_RATE_VALIDATION_ID = "verified_completion_rate_passed";
const DEFERRED_FINAL_VALIDATION_IDS = new Set([VERIFIED_COMPLETION_RATE_VALIDATION_ID, "session_clean_state_ready"]);

type PipelineStatus = "pass" | "fail" | "warning";
type ObservedValidationStatus = ValidatorStatus | "missing";

interface VerificationPipelineLedgerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  artifacts: string[];
  validations: ValidationResult[];
}

export interface VerificationPipelineLedgerResult {
  artifact: string;
  ledger: VerificationPipelineLedger;
  validation: ValidationResult;
}

export interface VerificationPipelineLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: PipelineStatus;
  protocol: {
    name: "harness.verification-pipeline";
    vcrRule: string;
    hierarchyRule: string;
    fullPipelineRule: string;
  };
  summary: {
    requiredFeatureCount: number;
    activatedFeatureCount: number;
    verifiedFeatureCount: number;
    passingFeatureCount: number;
    activeFeatureCount: number;
    blockedFeatureCount: number;
    notStartedFeatureCount: number;
    verifiedCompletionRate: number;
    requiredLevelCount: number;
    passedLevelCount: number;
    missingRequiredValidationCount: number;
    failedRequiredValidationCount: number;
    warningRequiredValidationCount: number;
    fullPipelineEvidenceCount: number;
    unresolvedCount: number;
  };
  featureCompletions: FeatureCompletion[];
  verificationLevels: VerificationLevelCompletion[];
  fullPipelineEvidence: FullPipelineEvidence[];
  unresolved: VerificationPipelineIssue[];
}

interface FeatureCompletion {
  featureId: string;
  layer: VerificationLayer;
  required: boolean;
  state: HarnessFeature["state"];
  validatorIds: string[];
  validationStatuses: Array<{
    id: string;
    status: ObservedValidationStatus;
    evidence: string[];
  }>;
  evidence: string[];
  countedAsVerified: boolean;
}

interface VerificationLevelCompletion {
  layer: VerificationLayer;
  required: boolean;
  validatorCount: number;
  passCount: number;
  missingValidationIds: string[];
  failedValidationIds: string[];
  warningValidationIds: string[];
  status: PipelineStatus;
}

interface FullPipelineEvidence {
  id: string;
  kind: "artifact" | "validation";
  status: "present" | "missing" | ValidatorStatus;
  evidence: string[];
}

interface VerificationPipelineIssue {
  id: string;
  status: "fail" | "warning";
  reason: string;
  evidence: string[];
}

interface RenderedFeatureList {
  features: Array<{
    id: string;
    layer: VerificationLayer;
    required: boolean;
    state: HarnessFeature["state"];
    validatorIds: string[];
    validationResults?: Array<{
      id: string;
      status: ObservedValidationStatus;
      evidence?: string[];
    }>;
    evidence?: string[];
  }>;
}

interface RenderedVerificationHierarchy {
  levels: Array<{
    layer: VerificationLayer;
    required: boolean;
    validatorIds: string[];
    validationResults?: Array<{
      id: string;
      status: ObservedValidationStatus;
      evidence?: string[];
    }>;
  }>;
}

export async function writeVerificationPipelineLedger(input: VerificationPipelineLedgerInput): Promise<VerificationPipelineLedgerResult> {
  const ledger = await buildVerificationPipelineLedger(input);
  const target = path.join(input.outputDir, VERIFICATION_PIPELINE_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: VERIFICATION_PIPELINE_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: VERIFIED_COMPLETION_RATE_VALIDATION_ID,
      name: "Verified completion rate passed",
      status: ledger.status,
      details: validationDetails(ledger),
      evidence: [target],
      repairable: true,
    },
  };
}

export function verificationPipelineEvents(runId: string, result: VerificationPipelineLedgerResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.verification_pipeline.recorded",
      artifactId: VERIFICATION_PIPELINE_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Recorded verified completion rate ${result.ledger.summary.verifiedCompletionRate.toFixed(2)} with status ${result.ledger.status}.`,
      evidence: [VERIFICATION_PIPELINE_LEDGER_ARTIFACT],
    }),
  ];
}

async function buildVerificationPipelineLedger(input: VerificationPipelineLedgerInput): Promise<VerificationPipelineLedger> {
  const featureListPath = path.join(input.outputDir, "feature-list.json");
  const hierarchyPath = path.join(input.outputDir, "verification-hierarchy.json");
  const featureList = (await pathExists(featureListPath)) ? await readJson<RenderedFeatureList>(featureListPath) : null;
  const hierarchy = (await pathExists(hierarchyPath)) ? await readJson<RenderedVerificationHierarchy>(hierarchyPath) : null;
  const artifacts = new Set(input.artifacts);
  const validationsById = new Map(input.validations.map((validation) => [validation.id, validation]));
  const featureCompletions = buildFeatureCompletions(input.spec, featureList, validationsById);
  const verificationLevels = buildVerificationLevelCompletions(hierarchy);
  const fullPipelineEvidence = buildFullPipelineEvidence(artifacts, validationsById);
  const unresolved = unresolvedIssues({
    featureList,
    hierarchy,
    featureCompletions,
    verificationLevels,
    fullPipelineEvidence,
  });
  const status = unresolved.some((issue) => issue.status === "fail") ? "fail" : unresolved.some((issue) => issue.status === "warning") ? "warning" : "pass";
  const requiredFeatureCompletions = featureCompletions.filter((feature) => feature.required);
  const requiredLevels = verificationLevels.filter((level) => level.required);
  return {
    schemaVersion: 1,
    id: stableId("verification-pipeline-ledger", `${input.runId}:${featureCompletions.map((feature) => `${feature.featureId}:${feature.state}`).join("|")}:${verificationLevels.map((level) => `${level.layer}:${level.status}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    protocol: {
      name: "harness.verification-pipeline",
      vcrRule: "Verified Completion Rate equals required features in passing state divided by required features activated by the run; clean completion requires VCR = 1.0.",
      hierarchyRule: "Every required verification layer must be represented and must not contain failed or missing required validator evidence.",
      fullPipelineRule: "Feature state, layered verification, lifecycle, dispatch/invocation, council review, validation, trace, event, and run-state evidence must be named before clean completion.",
    },
    summary: {
      requiredFeatureCount: requiredFeatureCompletions.length,
      activatedFeatureCount: requiredFeatureCompletions.length,
      verifiedFeatureCount: requiredFeatureCompletions.filter((feature) => feature.countedAsVerified).length,
      passingFeatureCount: requiredFeatureCompletions.filter((feature) => feature.state === "passing").length,
      activeFeatureCount: requiredFeatureCompletions.filter((feature) => feature.state === "active").length,
      blockedFeatureCount: requiredFeatureCompletions.filter((feature) => feature.state === "blocked").length,
      notStartedFeatureCount: requiredFeatureCompletions.filter((feature) => feature.state === "not_started").length,
      verifiedCompletionRate: rate(requiredFeatureCompletions.filter((feature) => feature.countedAsVerified).length, requiredFeatureCompletions.length),
      requiredLevelCount: requiredLevels.length,
      passedLevelCount: requiredLevels.filter((level) => level.status === "pass").length,
      missingRequiredValidationCount: requiredLevels.reduce((total, level) => total + level.missingValidationIds.length, 0),
      failedRequiredValidationCount: requiredLevels.reduce((total, level) => total + level.failedValidationIds.length, 0),
      warningRequiredValidationCount: requiredLevels.reduce((total, level) => total + level.warningValidationIds.length, 0),
      fullPipelineEvidenceCount: fullPipelineEvidence.filter((item) => item.status !== "missing").length,
      unresolvedCount: unresolved.length,
    },
    featureCompletions,
    verificationLevels,
    fullPipelineEvidence,
    unresolved,
  };
}

function buildFeatureCompletions(spec: HarnessSpec, featureList: RenderedFeatureList | null, validationsById: Map<string, ValidationResult>): FeatureCompletion[] {
  const renderedById = new Map((featureList?.features ?? []).map((feature) => [feature.id, feature]));
  return spec.harnessModel.featureList.map((feature) => {
    const rendered = renderedById.get(feature.id);
    const validationStatuses = feature.validatorIds.map((id) => {
      const renderedValidation = rendered?.validationResults?.find((validation) => validation.id === id);
      const runtimeValidation = validationsById.get(id);
      return {
        id,
        status: renderedValidation?.status ?? runtimeValidation?.status ?? "missing",
        evidence: renderedValidation?.evidence ?? runtimeValidation?.evidence ?? [],
      };
    });
    const state = rendered?.state ?? feature.state;
    return {
      featureId: feature.id,
      layer: feature.layer,
      required: feature.required,
      state,
      validatorIds: feature.validatorIds,
      validationStatuses,
      evidence: unique([...(rendered?.evidence ?? []), ...feature.evidence, ...validationStatuses.flatMap((validation) => validation.evidence)]),
      countedAsVerified: feature.required ? state === "passing" && validationStatuses.every((validation) => validation.status === "pass") : state === "passing",
    };
  });
}

function buildVerificationLevelCompletions(hierarchy: RenderedVerificationHierarchy | null): VerificationLevelCompletion[] {
  return (hierarchy?.levels ?? []).map((level) => {
    const validatorIds = level.validatorIds.filter((id) => !DEFERRED_FINAL_VALIDATION_IDS.has(id));
    const validationResults = validatorIds.map((id) => level.validationResults?.find((validation) => validation.id === id) ?? { id, status: "missing" as const, evidence: [] });
    const missingValidationIds = validationResults.filter((validation) => validation.status === "missing").map((validation) => validation.id);
    const failedValidationIds = validationResults.filter((validation) => validation.status === "fail").map((validation) => validation.id);
    const warningValidationIds = validationResults.filter((validation) => validation.status === "warning" || validation.status === "skipped").map((validation) => validation.id);
    const status = failedValidationIds.length ? "fail" : missingValidationIds.length || warningValidationIds.length ? "warning" : "pass";
    return {
      layer: level.layer,
      required: level.required,
      validatorCount: validatorIds.length,
      passCount: validationResults.filter((validation) => validation.status === "pass").length,
      missingValidationIds,
      failedValidationIds,
      warningValidationIds,
      status,
    };
  });
}

function buildFullPipelineEvidence(artifacts: Set<string>, validationsById: Map<string, ValidationResult>): FullPipelineEvidence[] {
  const requiredArtifacts = [
    "feature-list.json",
    "verification-hierarchy.json",
    "environment-readiness-ledger.json",
    "source-of-record-ledger.json",
    "architecture-boundary-ledger.json",
    "evaluator-rubric.json",
    "evaluator-rubric.md",
    "completion-authority-ledger.json",
    "quality-document.json",
    "quality-document.md",
    "harness-quality-ledger.json",
    "continuity-ledger.json",
    "course-alignment-ledger.json",
    "tool-safety-ledger.json",
    "context-budget-ledger.json",
    "function-invocation-ledger.json",
    "lifecycle-ledger.json",
    "council-review.json",
    "validation-report.md",
    "harness-trace.json",
    "events.jsonl",
    "run-state.json",
  ];
  const requiredValidationIds = [
    "feature_scope_state_gated",
    "environment_readiness_confirmed",
    "source_of_record_confirmed",
    "architecture_boundary_rules_enforced",
    "tool_safety_registry_ready",
    "context_budget_ready",
    "function_invocation_ledger_completed",
    "evaluator_rubric_recorded",
    "completion_authority_confirmed",
    "quality_document_recorded",
    "harness_quality_documented",
    "continuity_state_recorded",
    "course_alignment_confirmed",
    "lifecycle_ledger_clean",
    "council_review_complete",
    "blocker_questions_resolved",
    "run_state_persisted",
  ];
  return [
    ...requiredArtifacts.map((artifact) => ({
      id: artifact,
      kind: "artifact" as const,
      status: artifacts.has(artifact) ? ("present" as const) : ("missing" as const),
      evidence: [artifact],
    })),
    ...requiredValidationIds.map((id) => {
      const validation = validationsById.get(id);
      return {
        id,
        kind: "validation" as const,
        status: validation?.status ?? ("missing" as const),
        evidence: validation?.evidence ?? [],
      };
    }),
  ];
}

function unresolvedIssues({
  featureList,
  hierarchy,
  featureCompletions,
  verificationLevels,
  fullPipelineEvidence,
}: {
  featureList: RenderedFeatureList | null;
  hierarchy: RenderedVerificationHierarchy | null;
  featureCompletions: FeatureCompletion[];
  verificationLevels: VerificationLevelCompletion[];
  fullPipelineEvidence: FullPipelineEvidence[];
}): VerificationPipelineIssue[] {
  const requiredFeatures = featureCompletions.filter((feature) => feature.required);
  const blockedFeatures = requiredFeatures.filter((feature) => feature.state === "blocked");
  const unfinishedFeatures = requiredFeatures.filter((feature) => feature.state !== "passing" && feature.state !== "blocked");
  const requiredLevels = verificationLevels.filter((level) => level.required);
  return [
    ...(!featureList
      ? [
          {
            id: "feature-list-missing",
            status: "fail" as const,
            reason: "Feature state artifact is missing, so verified completion rate cannot be computed.",
            evidence: ["feature-list.json"],
          },
        ]
      : []),
    ...(!hierarchy
      ? [
          {
            id: "verification-hierarchy-missing",
            status: "fail" as const,
            reason: "Verification hierarchy artifact is missing, so required check levels cannot be evaluated.",
            evidence: ["verification-hierarchy.json"],
          },
        ]
      : []),
    ...(requiredFeatures.length === 0
      ? [
          {
            id: "required-features-missing",
            status: "fail" as const,
            reason: "No required features are available for verified completion rate accounting.",
            evidence: ["feature-list.json"],
          },
        ]
      : []),
    ...blockedFeatures.map((feature) => ({
      id: `feature-blocked:${feature.featureId}`,
      status: "fail" as const,
      reason: `Required feature ${feature.featureId} is blocked and cannot count as verified completion.`,
      evidence: feature.evidence,
    })),
    ...unfinishedFeatures.map((feature) => ({
      id: `feature-unfinished:${feature.featureId}`,
      status: "warning" as const,
      reason: `Required feature ${feature.featureId} is ${feature.state}; clean completion requires passing state.`,
      evidence: feature.evidence,
    })),
    ...requiredLevels.flatMap((level) => [
      ...level.failedValidationIds.map((id) => ({
        id: `validation-failed:${level.layer}:${id}`,
        status: "fail" as const,
        reason: `Required ${level.layer} verification ${id} failed.`,
        evidence: [id],
      })),
      ...level.missingValidationIds.map((id) => ({
        id: `validation-missing:${level.layer}:${id}`,
        status: "warning" as const,
        reason: `Required ${level.layer} verification ${id} is missing.`,
        evidence: [id],
      })),
      ...level.warningValidationIds.map((id) => ({
        id: `validation-warning:${level.layer}:${id}`,
        status: "warning" as const,
        reason: `Required ${level.layer} verification ${id} produced a warning or skipped status.`,
        evidence: [id],
      })),
    ]),
    ...fullPipelineEvidence
      .filter((item) => item.status === "missing")
      .map((item) => ({
        id: `full-pipeline-evidence-missing:${item.id}`,
        status: "fail" as const,
        reason: `Full-pipeline completion evidence ${item.id} is missing.`,
        evidence: item.evidence,
      })),
  ];
}

function validationDetails(ledger: VerificationPipelineLedger): string {
  if (ledger.status === "pass") {
    return `Verified completion rate ${ledger.summary.verifiedCompletionRate.toFixed(2)} across ${ledger.summary.requiredFeatureCount} required feature(s), ${ledger.summary.requiredLevelCount} required verification level(s), and ${ledger.summary.fullPipelineEvidenceCount} full-pipeline evidence item(s).`;
  }
  if (ledger.status === "warning") {
    return `Verified completion rate ${ledger.summary.verifiedCompletionRate.toFixed(2)} is not clean yet; warning issue(s): ${ledger.unresolved
      .filter((issue) => issue.status === "warning")
      .map((issue) => issue.id)
      .slice(0, 6)
      .join(", ")}.`;
  }
  return `Verified completion rate ${ledger.summary.verifiedCompletionRate.toFixed(2)} failed; blocking issue(s): ${ledger.unresolved
    .filter((issue) => issue.status === "fail")
    .map((issue) => issue.id)
    .slice(0, 6)
    .join(", ")}.`;
}

function rate(numerator: number, denominator: number): number {
  return denominator ? Number((numerator / denominator).toFixed(4)) : 0;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
