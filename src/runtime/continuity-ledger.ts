import path from "node:path";
import type { HarnessRequest, HarnessSpec, TraceEvent, ValidationResult } from "../types.js";
import { finalStatusFromValidations } from "../validators/common/validation-report.js";
import { stableId, writeJson } from "../utils/fs.js";
import type { CompletionAuthorityLedger } from "./completion-authority-ledger.js";
import type { HarnessQualityLedger } from "./harness-quality-ledger.js";
import type { RunPlan } from "./run-plan.js";
import type { SourceOfRecordLedger } from "./source-of-record-ledger.js";
import { traceEvent } from "./trace-ledger.js";

export const CONTINUITY_LEDGER_ARTIFACT = "continuity-ledger.json";
export const CONTINUITY_VALIDATION_ID = "continuity_state_recorded";

type ContinuityStatus = "pass" | "fail" | "warning";

const DEFERRED_CONTINUITY_VALIDATION_IDS = new Set([CONTINUITY_VALIDATION_ID, "feature_scope_state_gated"]);

interface ContinuityLedgerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  request: HarnessRequest;
  runPlan: RunPlan;
  artifacts: string[];
  validations: ValidationResult[];
  sourceOfRecordLedger: SourceOfRecordLedger;
  completionAuthorityLedger: CompletionAuthorityLedger;
  harnessQualityLedger: HarnessQualityLedger;
}

export interface ContinuityLedgerResult {
  artifact: string;
  ledger: ContinuityLedger;
  validation: ValidationResult;
}

export interface ContinuityLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: ContinuityStatus;
  rule: string;
  summary: {
    decisionCount: number;
    restartArtifactCount: number;
    missingRestartArtifactCount: number;
    validationCount: number;
    failedValidationCount: number;
    warningValidationCount: number;
    nextActionCount: number;
    estimatedRebuildMinutes: number;
    rebuildCostStatus: ContinuityStatus;
    failedCheckCount: number;
    warningCheckCount: number;
    unresolvedCount: number;
  };
  decisions: ContinuityDecision[];
  restart: {
    requiredArtifacts: string[];
    presentArtifacts: string[];
    missingArtifacts: string[];
    standardStartCommand: string;
    verifyCommand: string;
    progressArtifact: string;
    handoffArtifact: string;
    stateStore: string;
  };
  verificationSnapshot: {
    finalStatusBeforeContinuity: string;
    totalValidationCount: number;
    passedValidationIds: string[];
    failedValidationIds: string[];
    warningValidationIds: string[];
    skippedValidationIds: string[];
    authorityStatus: CompletionAuthorityLedger["status"];
    qualityStatus: HarnessQualityLedger["status"];
    qualityScore: number;
    qualityGrade: HarnessQualityLedger["grade"];
  };
  nextActions: ContinuityNextAction[];
  rebuildCost: {
    status: ContinuityStatus;
    estimatedMinutes: number;
    drivers: string[];
  };
  checks: ContinuityCheck[];
  unresolved: Array<{
    id: string;
    status: "fail" | "warning";
    reason: string;
    evidence: string[];
  }>;
}

interface ContinuityDecision {
  id: string;
  madeAt: string;
  decision: string;
  why: string;
  alternativesRejected: string[];
  evidence: string[];
}

interface ContinuityNextAction {
  rank: number;
  action: string;
  why: string;
  evidence: string[];
}

interface ContinuityCheck {
  id: string;
  status: ContinuityStatus;
  details: string;
  evidence: string[];
}

export async function writeContinuityLedger(input: ContinuityLedgerInput): Promise<ContinuityLedgerResult> {
  const ledger = buildContinuityLedger(input);
  const target = path.join(input.outputDir, CONTINUITY_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: CONTINUITY_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: CONTINUITY_VALIDATION_ID,
      name: "Continuity state recorded",
      status: ledger.status,
      details: validationDetails(ledger),
      evidence: [target],
      repairable: true,
    },
  };
}

export function continuityLedgerEvents(runId: string, result: ContinuityLedgerResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.continuity_ledger.recorded",
      artifactId: CONTINUITY_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Recorded continuity state with ${result.ledger.summary.decisionCount} decision(s), ${result.ledger.summary.nextActionCount} next action(s), and rebuild cost ${result.ledger.summary.estimatedRebuildMinutes} minute(s).`,
      evidence: [CONTINUITY_LEDGER_ARTIFACT],
    }),
  ];
}

function buildContinuityLedger(input: ContinuityLedgerInput): ContinuityLedger {
  const artifacts = new Set(input.artifacts);
  const decisions = buildDecisions(input);
  const restartArtifacts = requiredRestartArtifacts();
  const presentArtifacts = restartArtifacts.filter((artifact) => artifacts.has(artifact) || artifact === CONTINUITY_LEDGER_ARTIFACT);
  const missingArtifacts = restartArtifacts.filter((artifact) => !presentArtifacts.includes(artifact));
  const scoredValidations = input.validations.filter((validation) => !DEFERRED_CONTINUITY_VALIDATION_IDS.has(validation.id));
  const failedValidations = scoredValidations.filter((validation) => validation.status === "fail");
  const warningValidations = scoredValidations.filter((validation) => validation.status === "warning");
  const skippedValidations = scoredValidations.filter((validation) => validation.status === "skipped");
  const nextActions = buildNextActions(input, failedValidations, warningValidations, skippedValidations);
  const rebuildCost = estimateRebuildCost(input, missingArtifacts, failedValidations, warningValidations, skippedValidations);
  const finalStatusBeforeContinuity = finalStatusFromValidations(scoredValidations);
  const verificationSnapshot = {
    finalStatusBeforeContinuity,
    totalValidationCount: scoredValidations.length,
    passedValidationIds: scoredValidations.filter((validation) => validation.status === "pass").map((validation) => validation.id),
    failedValidationIds: failedValidations.map((validation) => validation.id),
    warningValidationIds: warningValidations.map((validation) => validation.id),
    skippedValidationIds: skippedValidations.map((validation) => validation.id),
    authorityStatus: input.completionAuthorityLedger.status,
    qualityStatus: input.harnessQualityLedger.status,
    qualityScore: input.harnessQualityLedger.score,
    qualityGrade: input.harnessQualityLedger.grade,
  };
  const checks: ContinuityCheck[] = [
    {
      id: "decision-log-present",
      status: decisions.length >= 5 && decisions.every((decision) => decision.why && decision.evidence.length) ? "pass" : "fail",
      details: `${decisions.length} continuity decision(s) record what changed, why, rejected alternatives, and evidence.`,
      evidence: unique(decisions.flatMap((decision) => decision.evidence)),
    },
    {
      id: "restart-inputs-present",
      status: missingArtifacts.length ? "fail" : "pass",
      details: missingArtifacts.length ? `Missing restart artifact(s): ${missingArtifacts.join(", ")}.` : `${presentArtifacts.length} restart artifact(s) are declared for a fresh session.`,
      evidence: restartArtifacts,
    },
    {
      id: "verification-snapshot-present",
      status: scoredValidations.length && verificationSnapshot.finalStatusBeforeContinuity ? "pass" : "fail",
      details: `Validation snapshot has finalStatus=${verificationSnapshot.finalStatusBeforeContinuity}, ${failedValidations.length} failed, ${warningValidations.length} warning, and ${skippedValidations.length} skipped validation(s).`,
      evidence: ["validation-report.md", "verification-hierarchy.json", "completion-authority-ledger.json", "harness-quality-ledger.json"],
    },
    {
      id: "next-actions-owned",
      status: nextActions.length ? "pass" : "fail",
      details: nextActions.length ? `${nextActions.length} ranked next action(s) are available for the next session.` : "No next action was recorded for the next session.",
      evidence: unique(nextActions.flatMap((action) => action.evidence)),
    },
    {
      id: "rebuild-cost-estimated",
      status: rebuildCost.status,
      details: `Fresh-session rebuild cost is estimated at ${rebuildCost.estimatedMinutes} minute(s): ${rebuildCost.drivers.join("; ")}.`,
      evidence: ["startup-readiness.json", "source-of-record-ledger.json", "feature-list.json", "progress.md", "session-handoff.md"],
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
    id: stableId("continuity-ledger", `${input.runId}:${decisions.length}:${missingArtifacts.join("|")}:${rebuildCost.estimatedMinutes}:${checks.map((check) => `${check.id}:${check.status}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    rule: "Long-running harness work must persist decisions, restart inputs, verification posture, next actions, and rebuild-cost evidence outside chat history before completion can be trusted.",
    summary: {
      decisionCount: decisions.length,
      restartArtifactCount: presentArtifacts.length,
      missingRestartArtifactCount: missingArtifacts.length,
      validationCount: scoredValidations.length,
      failedValidationCount: failedValidations.length,
      warningValidationCount: warningValidations.length + skippedValidations.length,
      nextActionCount: nextActions.length,
      estimatedRebuildMinutes: rebuildCost.estimatedMinutes,
      rebuildCostStatus: rebuildCost.status,
      failedCheckCount: checks.filter((check) => check.status === "fail").length,
      warningCheckCount: checks.filter((check) => check.status === "warning").length,
      unresolvedCount: unresolved.length,
    },
    decisions,
    restart: {
      requiredArtifacts: restartArtifacts,
      presentArtifacts,
      missingArtifacts,
      standardStartCommand: `node dist/cli/harnessctl.js ${input.request.harness} start ${input.request.mode ?? input.spec.mode} --intent "${input.request.intent}" --output ${input.outputDir}`,
      verifyCommand: "npm test",
      progressArtifact: "progress.md",
      handoffArtifact: "session-handoff.md",
      stateStore: ".harness/runs/<run-id>/run-state.json",
    },
    verificationSnapshot,
    nextActions,
    rebuildCost,
    checks,
    unresolved,
  };
}

function buildDecisions(input: ContinuityLedgerInput): ContinuityDecision[] {
  const madeAt = new Date().toISOString();
  return [
    {
      id: "source-of-record-before-resume",
      madeAt,
      decision: "Resume state is grounded in source-of-record answers and run artifacts.",
      why: `Source-of-record status is ${input.sourceOfRecordLedger.status} with ${input.sourceOfRecordLedger.summary.answeredQuestionCount}/${input.sourceOfRecordLedger.summary.questionCount} fresh-session answer(s).`,
      alternativesRejected: ["Use chat history as the main state store", "Rely on a human memory summary without source authority"],
      evidence: ["source-of-record-ledger.json", "feature-list.json", "progress.md", "session-handoff.md"],
    },
    {
      id: "feature-state-is-authoritative",
      madeAt,
      decision: "Feature-list and verification hierarchy own current scope state.",
      why: `${input.spec.harnessModel.featureList.length} feature row(s) and ${input.spec.harnessModel.verificationHierarchy.length} verification layer(s) define what is complete, active, or blocked.`,
      alternativesRejected: ["Infer progress from final prose", "Let generated artifacts declare their own completion"],
      evidence: ["feature-list.json", "verification-hierarchy.json"],
    },
    {
      id: "independent-completion-authority",
      madeAt,
      decision: "Completion is authorized by a runtime authority ledger, not by the worker that produced artifacts.",
      why: `Completion authority status is ${input.completionAuthorityLedger.status} across ${input.completionAuthorityLedger.summary.authorityGateCount} authority gate(s).`,
      alternativesRejected: ["Let generator success imply run success", "Treat council review alone as the final gate"],
      evidence: ["evaluator-rubric.json", "completion-authority-ledger.json", "function-invocation-ledger.json", "council-review.json"],
    },
    {
      id: "quality-priorities-carry-forward",
      madeAt,
      decision: "The next session starts from quality priorities and validation posture.",
      why: `Quality status is ${input.harnessQualityLedger.status}, score ${input.harnessQualityLedger.score}, grade ${input.harnessQualityLedger.grade}, with ${input.harnessQualityLedger.priorities.length} priority item(s).`,
      alternativesRejected: ["Start the next session with a blank TODO list", "Hide warnings inside a successful run summary"],
      evidence: ["quality-document.json", "harness-quality-ledger.json", "validation-report.md"],
    },
    {
      id: "run-plan-is-replayable",
      madeAt,
      decision: "Restart follows the locked run plan, executor lock, and worker lock.",
      why: `${input.runPlan.nodeCount} run-plan node(s) and ${input.runPlan.schedule.maxConcurrency} max concurrency are recorded for replay.`,
      alternativesRejected: ["Reconstruct the workflow graph from conversation context", "Re-select workers and executors implicitly on resume"],
      evidence: ["run-plan.json", "executor-lock.json", "worker-lock.json"],
    },
  ];
}

function buildNextActions(
  input: ContinuityLedgerInput,
  failedValidations: ValidationResult[],
  warningValidations: ValidationResult[],
  skippedValidations: ValidationResult[],
): ContinuityNextAction[] {
  const validationActions = [...failedValidations, ...warningValidations, ...skippedValidations].slice(0, 3).map((validation, index) => ({
    rank: index + 1,
    action: `Resolve ${validation.id} before claiming a clean continuation.`,
    why: validation.details,
    evidence: validation.evidence ?? ["validation-report.md"],
  }));
  const qualityActions = input.harnessQualityLedger.priorities.slice(0, Math.max(0, 5 - validationActions.length)).map((priority, index) => ({
    rank: validationActions.length + index + 1,
    action: priority.action,
    why: `Harness quality priority ${priority.rank}: ${priority.area}.`,
    evidence: priority.evidence,
  }));
  const actions = [...validationActions, ...qualityActions];
  if (actions.length) {
    return actions.map((action, index) => ({ ...action, rank: index + 1 }));
  }
  return [
    {
      rank: 1,
      action: "Review the verification snapshot and rerun the standard test command before making further changes.",
      why: "No non-passing validation or quality priority was available, so the safest continuation is a lightweight verification refresh.",
      evidence: ["validation-report.md", "harness-trace.json"],
    },
  ];
}

function estimateRebuildCost(
  input: ContinuityLedgerInput,
  missingArtifacts: string[],
  failedValidations: ValidationResult[],
  warningValidations: ValidationResult[],
  skippedValidations: ValidationResult[],
): ContinuityLedger["rebuildCost"] {
  const drivers = ["base artifact scan: 1 minute"];
  let estimatedMinutes = 1;
  if (missingArtifacts.length) {
    const penalty = missingArtifacts.length * 2;
    estimatedMinutes += penalty;
    drivers.push(`${missingArtifacts.length} missing restart artifact(s): +${penalty} minute(s)`);
  }
  if (input.sourceOfRecordLedger.summary.unavailableSourceCount) {
    const penalty = input.sourceOfRecordLedger.summary.unavailableSourceCount * 3;
    estimatedMinutes += penalty;
    drivers.push(`${input.sourceOfRecordLedger.summary.unavailableSourceCount} unavailable source(s): +${penalty} minute(s)`);
  }
  if (failedValidations.length) {
    const penalty = Math.min(9, failedValidations.length * 3);
    estimatedMinutes += penalty;
    drivers.push(`${failedValidations.length} failed validation(s): +${penalty} minute(s)`);
  }
  if (warningValidations.length || skippedValidations.length) {
    const count = warningValidations.length + skippedValidations.length;
    const penalty = Math.min(5, count);
    estimatedMinutes += penalty;
    drivers.push(`${count} warning/skipped validation(s): +${penalty} minute(s)`);
  }
  if (input.completionAuthorityLedger.status !== "pass" || input.harnessQualityLedger.status !== "pass") {
    estimatedMinutes += 2;
    drivers.push("authority or quality not clean: +2 minute(s)");
  }
  const status = estimatedMinutes <= 3 ? "pass" : estimatedMinutes <= 8 ? "warning" : "fail";
  return { status, estimatedMinutes, drivers };
}

function requiredRestartArtifacts(): string[] {
  return [
    "feature-list.json",
    "progress.md",
    "session-handoff.md",
    "run-state.json",
    "validation-report.md",
    "harness-trace.json",
    "events.jsonl",
    "startup-readiness.json",
    "source-of-record-ledger.json",
    "evaluator-rubric.json",
    "evaluator-rubric.md",
    "completion-authority-ledger.json",
    "quality-document.json",
    "quality-document.md",
    "harness-quality-ledger.json",
    CONTINUITY_LEDGER_ARTIFACT,
    "verification-hierarchy.json",
    "run-plan.json",
    "executor-lock.json",
    "worker-lock.json",
  ];
}

function validationDetails(ledger: ContinuityLedger): string {
  if (ledger.status === "pass") {
    return `Continuity state recorded ${ledger.summary.decisionCount} decision(s), ${ledger.summary.restartArtifactCount} restart artifact(s), and ${ledger.summary.nextActionCount} next action(s); rebuild cost ${ledger.summary.estimatedRebuildMinutes} minute(s).`;
  }
  if (ledger.status === "warning") {
    return `Continuity state has warning check(s): ${ledger.unresolved
      .filter((issue) => issue.status === "warning")
      .map((issue) => issue.id)
      .join(", ")}.`;
  }
  return `Continuity state failed check(s): ${ledger.unresolved
    .filter((issue) => issue.status === "fail")
    .map((issue) => issue.id)
    .join(", ")}.`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
