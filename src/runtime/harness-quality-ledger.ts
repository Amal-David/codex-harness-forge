import path from "node:path";
import type { HarnessSpec, TraceEvent, ValidationResult } from "../types.js";
import { stableId, writeJson } from "../utils/fs.js";
import type { HarnessAblationComparisonLedger } from "./harness-ablation-comparison.js";
import type { HarnessSubsystemAuditLedger } from "./harness-subsystem-audit.js";
import type { RepairAction } from "./repair-guidance-ledger.js";
import { traceEvent } from "./trace-ledger.js";

export const HARNESS_QUALITY_LEDGER_ARTIFACT = "harness-quality-ledger.json";
export const HARNESS_QUALITY_VALIDATION_ID = "harness_quality_documented";

type QualityStatus = "pass" | "fail" | "warning";

const DEFERRED_QUALITY_VALIDATION_IDS = new Set(["feature_scope_state_gated", HARNESS_QUALITY_VALIDATION_ID]);

interface HarnessQualityLedgerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  artifacts: string[];
  validations: ValidationResult[];
  subsystemAudit: HarnessSubsystemAuditLedger;
  ablationComparison: HarnessAblationComparisonLedger;
  repairActions: RepairAction[];
}

export interface HarnessQualityLedgerResult {
  artifact: string;
  ledger: HarnessQualityLedger;
  validation: ValidationResult;
}

export interface HarnessQualityLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: QualityStatus;
  score: number;
  grade: "A" | "B" | "C" | "D";
  rule: string;
  summary: {
    checkCount: number;
    passedCheckCount: number;
    warningCheckCount: number;
    failedCheckCount: number;
    nonPassingValidationCount: number;
    repairActionCount: number;
    subsystemCount: number;
    lowestSubsystemScore: number;
    ablationMeasuredProbeCount: number;
    unresolvedCount: number;
  };
  checks: QualityCheck[];
  priorities: QualityPriority[];
  unresolved: Array<{
    id: string;
    status: "fail" | "warning";
    reason: string;
    evidence: string[];
  }>;
}

interface QualityCheck {
  id: string;
  status: QualityStatus;
  details: string;
  evidence: string[];
}

interface QualityPriority {
  rank: number;
  area: string;
  action: string;
  evidence: string[];
}

export async function writeHarnessQualityLedger(input: HarnessQualityLedgerInput): Promise<HarnessQualityLedgerResult> {
  const ledger = buildHarnessQualityLedger(input);
  const target = path.join(input.outputDir, HARNESS_QUALITY_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: HARNESS_QUALITY_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: HARNESS_QUALITY_VALIDATION_ID,
      name: "Harness quality documented",
      status: ledger.status,
      details: validationDetails(ledger),
      evidence: [target],
      repairable: true,
    },
  };
}

export function harnessQualityLedgerEvents(runId: string, result: HarnessQualityLedgerResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.quality_ledger.recorded",
      artifactId: HARNESS_QUALITY_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Recorded harness quality score ${result.ledger.score} (${result.ledger.grade}) with status ${result.ledger.status}.`,
      evidence: [HARNESS_QUALITY_LEDGER_ARTIFACT],
    }),
  ];
}

function buildHarnessQualityLedger(input: HarnessQualityLedgerInput): HarnessQualityLedger {
  const artifacts = new Set(input.artifacts);
  const scoredValidations = input.validations.filter((validation) => !DEFERRED_QUALITY_VALIDATION_IDS.has(validation.id));
  const failedValidations = scoredValidations.filter((validation) => validation.status === "fail");
  const warningValidations = scoredValidations.filter((validation) => validation.status === "warning" || validation.status === "skipped");
  const requiredHandoffArtifacts = ["feature-list.json", "progress.md", "session-handoff.md", "evaluator-rubric.json", "evaluator-rubric.md", "quality-document.json", "quality-document.md", "harness-diagnostic-ledger.json", "repair-guidance-ledger.json", "harness-subsystem-audit.json", "harness-ablation-comparison.json"];
  const missingHandoffArtifacts = requiredHandoffArtifacts.filter((artifact) => !artifacts.has(artifact));
  const diagnosticSignalCount = input.subsystemAudit.summary.diagnosticAttributionCount;
  const repairCoverageGap = Math.max(0, diagnosticSignalCount - input.repairActions.length);
  const checks: QualityCheck[] = [
    {
      id: "validation-posture-recorded",
      status: failedValidations.length ? "fail" : warningValidations.length ? "warning" : "pass",
      details: failedValidations.length
        ? `Failed validation(s) remain: ${failedValidations.map((validation) => validation.id).join(", ")}.`
        : warningValidations.length
          ? `Warning/skipped validation(s) remain: ${warningValidations.map((validation) => validation.id).join(", ")}.`
          : `${scoredValidations.length} scored validation(s) are passing.`,
      evidence: scoredValidations.flatMap((validation) => validation.evidence ?? []),
    },
    {
      id: "subsystem-health-recorded",
      status: input.subsystemAudit.status === "fail" ? "fail" : input.subsystemAudit.summary.lowestScore < 5 ? "warning" : "pass",
      details: `Subsystem audit status=${input.subsystemAudit.status}, average=${input.subsystemAudit.summary.averageScore}, lowest=${input.subsystemAudit.summary.lowestScore}, bottleneck=${input.subsystemAudit.summary.primaryBottleneck ?? "none"}.`,
      evidence: ["harness-subsystem-audit.json"],
    },
    {
      id: "repair-backlog-owned",
      status: repairCoverageGap > 0 ? "fail" : input.repairActions.length > 0 ? "warning" : "pass",
      details:
        repairCoverageGap > 0
          ? `${repairCoverageGap} diagnostic signal(s) lack repair action coverage.`
          : input.repairActions.length > 0
            ? `${input.repairActions.length} repair action(s) remain for the next run.`
            : "No repair backlog remains.",
      evidence: ["harness-diagnostic-ledger.json", "repair-guidance-ledger.json"],
    },
    {
      id: "ablation-prioritization-recorded",
      status: input.ablationComparison.status === "fail" ? "fail" : input.ablationComparison.summary.measuredProbeCount < 5 ? "warning" : "pass",
      details: `${input.ablationComparison.summary.measuredProbeCount}/${input.ablationComparison.summary.probeCount} subsystem probe(s) measured; primary marginal subsystem is ${input.ablationComparison.summary.primaryMarginalSubsystem ?? "none"}.`,
      evidence: ["harness-ablation-comparison.json"],
    },
    {
      id: "handoff-quality-artifacts-present",
      status: missingHandoffArtifacts.length ? "fail" : "pass",
      details: missingHandoffArtifacts.length ? `Missing quality handoff artifact(s): ${missingHandoffArtifacts.join(", ")}.` : "Evaluator rubric, quality document, progress, diagnostic, repair, audit, and ablation handoff artifacts are present.",
      evidence: requiredHandoffArtifacts,
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
  const score = qualityScore(checks, input.subsystemAudit.summary.lowestScore);
  const priorities = qualityPriorities(input, checks);
  return {
    schemaVersion: 1,
    id: stableId("harness-quality-ledger", `${input.runId}:${checks.map((check) => `${check.id}:${check.status}`).join("|")}:${score}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    score,
    grade: qualityGrade(score),
    rule: "Every run must leave a quality document that turns validation posture, subsystem health, repair backlog, ablation priority, and handoff artifacts into concrete next-system-improvement evidence.",
    summary: {
      checkCount: checks.length,
      passedCheckCount: checks.filter((check) => check.status === "pass").length,
      warningCheckCount: checks.filter((check) => check.status === "warning").length,
      failedCheckCount: checks.filter((check) => check.status === "fail").length,
      nonPassingValidationCount: failedValidations.length + warningValidations.length,
      repairActionCount: input.repairActions.length,
      subsystemCount: input.subsystemAudit.summary.subsystemCount,
      lowestSubsystemScore: input.subsystemAudit.summary.lowestScore,
      ablationMeasuredProbeCount: input.ablationComparison.summary.measuredProbeCount,
      unresolvedCount: unresolved.length,
    },
    checks,
    priorities,
    unresolved,
  };
}

function qualityScore(checks: QualityCheck[], lowestSubsystemScore: number): number {
  const penalty = checks.reduce((total, check) => total + (check.status === "fail" ? 25 : check.status === "warning" ? 10 : 0), 0);
  const subsystemPenalty = Math.max(0, 5 - lowestSubsystemScore) * 5;
  return Math.max(0, 100 - penalty - subsystemPenalty);
}

function qualityGrade(score: number): HarnessQualityLedger["grade"] {
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

function qualityPriorities(input: HarnessQualityLedgerInput, checks: QualityCheck[]): QualityPriority[] {
  const priorities: QualityPriority[] = [];
  const failingOrWarning = checks.filter((check) => check.status !== "pass");
  for (const check of failingOrWarning) {
    priorities.push({
      rank: priorities.length + 1,
      area: check.id,
      action: actionForCheck(check.id),
      evidence: check.evidence,
    });
  }
  if (!priorities.length) {
    priorities.push({
      rank: 1,
      area: input.ablationComparison.summary.primaryMarginalSubsystem ?? "none",
      action: input.ablationComparison.summary.recommendedNextExperiment.action,
      evidence: input.ablationComparison.summary.recommendedNextExperiment.evidence,
    });
  }
  return priorities.slice(0, 5).map((priority, index) => ({ ...priority, rank: index + 1 }));
}

function actionForCheck(id: string): string {
  if (id === "validation-posture-recorded") {
    return "Repair failed validations or convert warnings into explicit scoped partial outcomes before claiming quality is clean.";
  }
  if (id === "subsystem-health-recorded") {
    return "Invest next in the lowest-scoring harness subsystem and rerun the matrix to compare quality score movement.";
  }
  if (id === "repair-backlog-owned") {
    return "Apply or explicitly defer every repair-guidance action before the next clean handoff.";
  }
  if (id === "ablation-prioritization-recorded") {
    return "Measure the missing subsystem ablation probe before treating subsystem value as proven.";
  }
  if (id === "handoff-quality-artifacts-present") {
    return "Regenerate progress, handoff, diagnostic, repair, audit, and ablation artifacts before ending the session.";
  }
  return "Inspect the quality ledger and repair the non-passing quality check.";
}

function validationDetails(ledger: HarnessQualityLedger): string {
  if (ledger.status === "pass") {
    return `Harness quality documented with score ${ledger.score} (${ledger.grade}) and ${ledger.summary.passedCheckCount}/${ledger.summary.checkCount} passing check(s).`;
  }
  return `Harness quality ${ledger.status} with score ${ledger.score} (${ledger.grade}); priority: ${ledger.priorities[0]?.action ?? "inspect harness-quality-ledger.json"}.`;
}
