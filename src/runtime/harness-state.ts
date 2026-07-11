import path from "node:path";
import type { FeatureState, HarnessFeature, HarnessSpec, ValidationResult, VerificationLevel } from "../types.js";
import { finalStatusFromValidations } from "../validators/common/validation-report.js";
import { writeJson, writeText } from "../utils/fs.js";
import { scheduledFeatureStates } from "./feature-scheduler.js";

export const FEATURE_LIST_ARTIFACT = "feature-list.json";
export const SPRINT_CONTRACT_ARTIFACT = "sprint-contract.json";
export const VERIFICATION_HIERARCHY_ARTIFACT = "verification-hierarchy.json";
export const PROGRESS_ARTIFACT = "progress.md";
export const SESSION_HANDOFF_ARTIFACT = "session-handoff.md";

interface HarnessRuntimeStateInput {
  outputDir: string;
  spec: HarnessSpec;
  validations: ValidationResult[];
  artifacts: string[];
}

export interface HarnessRuntimeStateResult {
  artifacts: string[];
  validation: ValidationResult;
}

export async function writeHarnessPlanningArtifacts(spec: HarnessSpec, outputDir: string): Promise<string[]> {
  const scheduledFeatures = scheduledFeatureStates(spec.harnessModel.featureList);
  await writeJson(path.join(outputDir, FEATURE_LIST_ARTIFACT), renderFeatureList(spec, scheduledFeatures, []));
  await writeJson(path.join(outputDir, SPRINT_CONTRACT_ARTIFACT), spec.harnessModel.sprintContract);
  await writeJson(path.join(outputDir, VERIFICATION_HIERARCHY_ARTIFACT), renderVerificationHierarchy(spec.harnessModel.verificationHierarchy, []));
  await writeText(path.join(outputDir, PROGRESS_ARTIFACT), renderProgress(spec, scheduledFeatures, "not_started"));
  return [FEATURE_LIST_ARTIFACT, SPRINT_CONTRACT_ARTIFACT, VERIFICATION_HIERARCHY_ARTIFACT, PROGRESS_ARTIFACT];
}

export async function writeHarnessRuntimeStateArtifacts(input: HarnessRuntimeStateInput): Promise<HarnessRuntimeStateResult> {
  const features = materializeFeatureStates(input.spec.harnessModel.featureList, input.validations);
  const validation = validateFeatureScope(input.outputDir, features);
  const validations = [...input.validations, validation];
  const finalStatus = finalStatusFromValidations(validations);
  await writeJson(path.join(input.outputDir, FEATURE_LIST_ARTIFACT), renderFeatureList(input.spec, features, validations));
  await writeJson(path.join(input.outputDir, VERIFICATION_HIERARCHY_ARTIFACT), renderVerificationHierarchy(input.spec.harnessModel.verificationHierarchy, validations));
  await writeText(path.join(input.outputDir, PROGRESS_ARTIFACT), renderProgress(input.spec, features, finalStatus));
  await writeText(path.join(input.outputDir, SESSION_HANDOFF_ARTIFACT), renderSessionHandoff(input.spec, features, validations, finalStatus, input.artifacts));
  return {
    artifacts: [FEATURE_LIST_ARTIFACT, VERIFICATION_HIERARCHY_ARTIFACT, PROGRESS_ARTIFACT, SESSION_HANDOFF_ARTIFACT],
    validation,
  };
}

function materializeFeatureStates(features: HarnessFeature[], validations: ValidationResult[]): HarnessFeature[] {
  const statusById = new Map(validations.map((validation) => [validation.id, validation]));
  const sourceFailed = statusById.get("source_availability")?.status === "fail";
  return features.map((feature) => {
    const validatorResults = feature.validatorIds.map((id) => statusById.get(id)).filter(Boolean) as ValidationResult[];
    const missingValidators = feature.validatorIds.filter((id) => !statusById.has(id));
    const failedValidators = validatorResults.filter((validation) => validation.status === "fail");
    const warningValidators = validatorResults.filter((validation) => validation.status === "warning" || validation.status === "skipped");
    const state = featureState({ feature, sourceFailed, missingValidators, failedValidators, warningValidators, validatorResults });
    return {
      ...feature,
      state,
      evidence: unique([...feature.evidence, ...validatorResults.flatMap((validation) => validation.evidence ?? [])]),
    };
  });
}

function featureState({
  feature,
  sourceFailed,
  missingValidators,
  failedValidators,
  warningValidators,
  validatorResults,
}: {
  feature: HarnessFeature;
  sourceFailed: boolean;
  missingValidators: string[];
  failedValidators: ValidationResult[];
  warningValidators: ValidationResult[];
  validatorResults: ValidationResult[];
}): FeatureState {
  if (feature.id !== "F-001-source-readiness" && sourceFailed) {
    return "blocked";
  }
  if (failedValidators.length) {
    return "blocked";
  }
  if (missingValidators.length || warningValidators.length || !validatorResults.length) {
    return "active";
  }
  return "passing";
}

function validateFeatureScope(outputDir: string, features: HarnessFeature[]): ValidationResult {
  const required = features.filter((feature) => feature.required);
  const blocked = required.filter((feature) => feature.state === "blocked");
  const unfinished = required.filter((feature) => feature.state !== "passing" && feature.state !== "blocked");
  const status = blocked.length ? "fail" : unfinished.length ? "warning" : "pass";
  return {
    id: "feature_scope_state_gated",
    name: "Feature scope state gated by validators",
    status,
    details:
      status === "pass"
        ? `${required.length} required feature(s) reached passing through validator-owned state transitions.`
        : blocked.length
          ? `Blocked required feature(s): ${blocked.map((feature) => feature.id).join(", ")}.`
          : `Unfinished required feature(s): ${unfinished.map((feature) => feature.id).join(", ")}.`,
    evidence: [path.join(outputDir, FEATURE_LIST_ARTIFACT)],
    repairable: true,
  };
}

function renderFeatureList(spec: HarnessSpec, features: HarnessFeature[], validations: ValidationResult[]) {
  return {
    schemaVersion: 1,
    harnessSpecId: spec.id,
    userIntent: spec.userIntent,
    stateMachine: {
      states: ["not_started", "active", "blocked", "passing"],
      transitionRule: "Only runtime validation results may move required features into passing.",
      passingIsIrreversibleWithinRun: true,
    },
    summary: summarizeFeatures(features),
    features: features.map((feature) => ({
      ...feature,
      validationResults: feature.validatorIds.map((id) => {
        const validation = validations.find((item) => item.id === id);
        return {
          id,
          status: validation?.status ?? "missing",
          details: validation?.details,
          evidence: validation?.evidence ?? [],
        };
      }),
    })),
  };
}

function renderVerificationHierarchy(levels: VerificationLevel[], validations: ValidationResult[]) {
  return {
    schemaVersion: 1,
    rule: "Static checks precede runtime checks; runtime checks precede system completion judgment. Skipping a required layer prevents a clean success.",
    levels: levels.map((level) => ({
      ...level,
      validationResults: level.validatorIds.map((id) => {
        const validation = validations.find((item) => item.id === id);
        return {
          id,
          status: validation?.status ?? "missing",
          evidence: validation?.evidence ?? [],
          details: validation?.details,
        };
      }),
    })),
  };
}

function renderProgress(spec: HarnessSpec, features: HarnessFeature[], finalStatus: string): string {
  const summary = summarizeFeatures(features);
  const active = features.filter((feature) => feature.state === "active");
  const blocked = features.filter((feature) => feature.state === "blocked");
  const passing = features.filter((feature) => feature.state === "passing");
  const next = active[0] ?? blocked[0] ?? features.find((feature) => feature.state === "not_started");
  return [
    "# Progress",
    "",
    `Intent: ${spec.userIntent}`,
    `Status: ${finalStatus}`,
    `Feature states: ${summary.passing} passing, ${summary.active} active, ${summary.blocked} blocked, ${summary.not_started} not_started`,
    "",
    "## Next Feature",
    "",
    next ? `- ${next.id}: ${next.behavior}` : "- None. Required feature pressure is zero.",
    "",
    "## Passing",
    "",
    ...listFeatureLines(passing),
    "",
    "## Active",
    "",
    ...listFeatureLines(active),
    "",
    "## Blocked",
    "",
    ...listFeatureLines(blocked),
    "",
  ].join("\n");
}

function renderSessionHandoff(spec: HarnessSpec, features: HarnessFeature[], validations: ValidationResult[], finalStatus: string, artifacts: string[]): string {
  const failures = validations.filter((validation) => validation.status === "fail");
  const warnings = validations.filter((validation) => validation.status === "warning" || validation.status === "skipped");
  const next = features.find((feature) => feature.state === "active") ?? features.find((feature) => feature.state === "blocked") ?? features.find((feature) => feature.state === "not_started");
  return [
    "# Session Handoff",
    "",
    `Harness: ${spec.name}`,
    `Final status: ${finalStatus}`,
    "",
    "## Current Scope",
    "",
    ...features.map((feature) => `- ${feature.id} [${feature.state}]: ${feature.behavior}`),
    "",
    "## Validation Signals",
    "",
    `- Failed: ${failures.length ? failures.map((validation) => validation.id).join(", ") : "none"}`,
    `- Warning/skipped: ${warnings.length ? warnings.map((validation) => validation.id).join(", ") : "none"}`,
    "",
    "## Next Action",
    "",
    next ? `Continue from ${next.id}: ${next.verificationCommand}` : "No unfinished feature remains. Use the validation report and trace for review.",
    "",
    "## Restart Artifacts",
    "",
    ...[
      "feature-list.json",
      "progress.md",
      "validation-report.md",
      "harness-trace.json",
      "run-state.json",
      "events.jsonl",
      "initialization-checklist.json",
      "feature-scheduler.json",
      "environment-readiness-ledger.json",
      "instruction-routing-ledger.json",
      "source-of-record-ledger.json",
      "architecture-boundary-ledger.json",
      "evaluator-rubric.json",
      "evaluator-rubric.md",
      "completion-authority-ledger.json",
      "quality-document.json",
      "quality-document.md",
      "continuity-ledger.json",
      "course-alignment-ledger.json",
      "lifecycle-ledger.json",
      "verification-pipeline-ledger.json",
      "session-clean-state-ledger.json",
      "feedback-promotion-ledger.json",
      "harness-diagnostic-ledger.json",
      "repair-guidance-ledger.json",
      "harness-subsystem-audit.json",
      "harness-ablation-comparison.json",
      "harness-quality-ledger.json",
      "worker-function-registry.json",
      "provider-replacement-registry.json",
      "tool-safety-ledger.json",
      "context-budget-ledger.json",
      "function-dispatch-plan.json",
      "runtime-bus.json",
      "function-invocation-ledger.json",
      "startup-readiness.json",
      "trace-context.json",
    ]
      .filter((artifact) => artifacts.includes(artifact) || artifact === "validation-report.md" || artifact === "harness-trace.json")
      .map((artifact) => `- ${artifact}`),
    "",
  ].join("\n");
}

function summarizeFeatures(features: HarnessFeature[]) {
  return {
    not_started: features.filter((feature) => feature.state === "not_started").length,
    active: features.filter((feature) => feature.state === "active").length,
    blocked: features.filter((feature) => feature.state === "blocked").length,
    passing: features.filter((feature) => feature.state === "passing").length,
  };
}

function listFeatureLines(features: HarnessFeature[]): string[] {
  return features.length ? features.map((feature) => `- ${feature.id}: ${feature.behavior}`) : ["- None"];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
