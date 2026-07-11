import path from "node:path";
import type { HarnessSpec, HarnessSubsystemId, TraceEvent, ValidationResult } from "../types.js";
import { stableId, writeJson } from "../utils/fs.js";
import type { HarnessSubsystemAuditLedger, SubsystemAuditEntry } from "./harness-subsystem-audit.js";

export const HARNESS_ABLATION_COMPARISON_ARTIFACT = "harness-ablation-comparison.json";

interface HarnessAblationComparisonInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  subsystemAudit: HarnessSubsystemAuditLedger;
}

export interface HarnessAblationComparisonResult {
  artifact: string;
  ledger: HarnessAblationComparisonLedger;
  validation: ValidationResult;
}

export interface HarnessAblationComparisonLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  rule: string;
  measurementMode: "artifact-evidence-exclusion";
  baseline: {
    auditId: string;
    auditStatus: "pass" | "fail";
    primaryBottleneck: HarnessSubsystemId | null;
    averageScore: number;
    subsystemCount: number;
  };
  summary: {
    probeCount: number;
    measuredProbeCount: number;
    branchRerunProbeCount: 0;
    primaryMarginalSubsystem: HarnessSubsystemId | null;
    lowSignalSubsystems: HarnessSubsystemId[];
    highestProjectedRegression: number;
    unresolvedCount: number;
    recommendedNextExperiment: {
      subsystem: HarnessSubsystemId | "none";
      action: string;
      evidence: string[];
    };
  };
  probes: HarnessAblationProbeMeasurement[];
  unresolved: Array<{
    reason: string;
    evidence: string[];
  }>;
}

interface HarnessAblationProbeMeasurement {
  subsystem: HarnessSubsystemId;
  status: "measured" | "low_signal" | "unresolved";
  baselineScore: number;
  baselineStatus: SubsystemAuditEntry["status"];
  excludedArtifacts: string[];
  excludedValidationIds: string[];
  excludedDiagnosticSignalIds: string[];
  excludedRepairActionIds: string[];
  evidenceRemovedCount: number;
  projectedRegressionScore: number;
  marginalValue: "high" | "medium" | "low";
  artifactExclusionMeasuredInThisRun: true;
  branchRerunExecuted: false;
  expectedFailureSignal: string;
  compareUsing: string[];
  rationale: string;
  nextControlledExperiment: string;
}

const SUBSYSTEMS: HarnessSubsystemId[] = ["instructions", "tools", "environment", "state", "feedback"];

export async function writeHarnessAblationComparison(input: HarnessAblationComparisonInput): Promise<HarnessAblationComparisonResult> {
  const ledger = buildHarnessAblationComparison(input);
  const target = path.join(input.outputDir, HARNESS_ABLATION_COMPARISON_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: HARNESS_ABLATION_COMPARISON_ARTIFACT,
    ledger,
    validation: {
      id: "harness_ablation_comparison_recorded",
      name: "Harness ablation comparison recorded",
      status: ledger.status,
      details:
        ledger.status === "pass"
          ? `Measured ${ledger.summary.measuredProbeCount} subsystem ablation probe(s); primary marginal subsystem is ${ledger.summary.primaryMarginalSubsystem ?? "none"}.`
          : `Harness ablation comparison has ${ledger.unresolved.length} unresolved measurement gap(s).`,
      evidence: [target],
      repairable: true,
    },
  };
}

export function harnessAblationComparisonEvents(runId: string, result: HarnessAblationComparisonResult): TraceEvent[] {
  return [
    {
      id: stableId("event", `${runId}:runtime.ablation_comparison.recorded:${result.ledger.id}`),
      runId,
      type: "runtime.ablation_comparison.recorded",
      timestamp: new Date().toISOString(),
      artifactId: HARNESS_ABLATION_COMPARISON_ARTIFACT,
      status: result.validation.status,
      message: `Recorded artifact-exclusion ablation comparison; primary marginal subsystem is ${result.ledger.summary.primaryMarginalSubsystem ?? "none"}.`,
      evidence: [HARNESS_ABLATION_COMPARISON_ARTIFACT],
    },
  ];
}

function buildHarnessAblationComparison(input: HarnessAblationComparisonInput): HarnessAblationComparisonLedger {
  const probes = SUBSYSTEMS.map((subsystem) => measureProbe(input.subsystemAudit, subsystem));
  const missingSubsystems = SUBSYSTEMS.filter((subsystem) => !input.subsystemAudit.subsystems.some((entry) => entry.id === subsystem));
  const unresolved = [
    ...missingSubsystems.map((subsystem) => ({
      reason: `Missing subsystem audit row for ${subsystem}; ablation probe cannot be measured.`,
      evidence: [input.subsystemAudit.id],
    })),
    ...probes
      .filter((probe) => probe.status === "unresolved")
      .map((probe) => ({
        reason: `Ablation probe for ${probe.subsystem} could not identify removable runtime evidence.`,
        evidence: probe.compareUsing,
      })),
  ];
  const measured = probes.filter((probe) => probe.status !== "unresolved");
  const lowSignalSubsystems = measured.filter((probe) => probe.status === "low_signal").map((probe) => probe.subsystem);
  const highestProjectedRegression = Math.max(0, ...measured.map((probe) => probe.projectedRegressionScore));
  const primaryMarginalSubsystem = primaryMarginalSubsystemFor(measured, input.subsystemAudit.summary.primaryBottleneck);
  return {
    schemaVersion: 1,
    id: stableId("harness-ablation-comparison", `${input.runId}:${probes.map((probe) => `${probe.subsystem}:${probe.projectedRegressionScore}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status: unresolved.length ? "fail" : "pass",
    rule: "Every subsystem audit probe must be measured with artifact-evidence exclusion so the harness can distinguish marginal value from decorative control-plane output.",
    measurementMode: "artifact-evidence-exclusion",
    baseline: {
      auditId: input.subsystemAudit.id,
      auditStatus: input.subsystemAudit.status,
      primaryBottleneck: input.subsystemAudit.summary.primaryBottleneck,
      averageScore: input.subsystemAudit.summary.averageScore,
      subsystemCount: input.subsystemAudit.summary.subsystemCount,
    },
    summary: {
      probeCount: probes.length,
      measuredProbeCount: measured.length,
      branchRerunProbeCount: 0,
      primaryMarginalSubsystem,
      lowSignalSubsystems,
      highestProjectedRegression,
      unresolvedCount: unresolved.length,
      recommendedNextExperiment: recommendedNextExperiment(primaryMarginalSubsystem, probes),
    },
    probes,
    unresolved,
  };
}

function measureProbe(audit: HarnessSubsystemAuditLedger, subsystem: HarnessSubsystemId): HarnessAblationProbeMeasurement {
  const entry = audit.subsystems.find((item) => item.id === subsystem);
  if (!entry) {
    return unresolvedProbe(subsystem);
  }
  const evidenceRemovedCount = unique([
    ...entry.presentArtifacts,
    ...entry.validationIds,
    ...entry.diagnosticSignalIds,
    ...entry.repairActionIds,
    ...entry.evidence,
  ]).length;
  const projectedRegressionScore = projectedRegressionFor(entry, evidenceRemovedCount);
  const status = evidenceRemovedCount === 0 || entry.validationIds.length === 0 ? "low_signal" : "measured";
  return {
    subsystem,
    status,
    baselineScore: entry.score,
    baselineStatus: entry.status,
    excludedArtifacts: entry.presentArtifacts,
    excludedValidationIds: entry.validationIds,
    excludedDiagnosticSignalIds: entry.diagnosticSignalIds,
    excludedRepairActionIds: entry.repairActionIds,
    evidenceRemovedCount,
    projectedRegressionScore,
    marginalValue: marginalValueFor(projectedRegressionScore),
    artifactExclusionMeasuredInThisRun: true,
    branchRerunExecuted: false,
    expectedFailureSignal: expectedFailureSignalFor(subsystem),
    compareUsing: [HARNESS_ABLATION_COMPARISON_ARTIFACT, "harness-subsystem-audit.json", "harness-diagnostic-ledger.json", "repair-guidance-ledger.json", "validation-report.md"],
    rationale: rationaleFor(entry, evidenceRemovedCount, projectedRegressionScore),
    nextControlledExperiment: `Run the same workflow in an isolated branch with only the ${labelFor(subsystem)} subsystem gates disabled, then compare finalStatus, repair action count, and subsystem audit score against this baseline.`,
  };
}

function unresolvedProbe(subsystem: HarnessSubsystemId): HarnessAblationProbeMeasurement {
  return {
    subsystem,
    status: "unresolved",
    baselineScore: 0,
    baselineStatus: "blocked",
    excludedArtifacts: [],
    excludedValidationIds: [],
    excludedDiagnosticSignalIds: [],
    excludedRepairActionIds: [],
    evidenceRemovedCount: 0,
    projectedRegressionScore: 0,
    marginalValue: "low",
    artifactExclusionMeasuredInThisRun: true,
    branchRerunExecuted: false,
    expectedFailureSignal: expectedFailureSignalFor(subsystem),
    compareUsing: [HARNESS_ABLATION_COMPARISON_ARTIFACT, "harness-subsystem-audit.json"],
    rationale: `No ${labelFor(subsystem)} audit row was available to exclude.`,
    nextControlledExperiment: `Restore the ${labelFor(subsystem)} audit row before attempting a branch-level ablation.`,
  };
}

function projectedRegressionFor(entry: SubsystemAuditEntry, evidenceRemovedCount: number): number {
  return (
    entry.presentArtifacts.length +
    entry.validationIds.length * 2 +
    entry.diagnosticSignalIds.length +
    entry.repairActionIds.length +
    Math.min(3, evidenceRemovedCount) +
    (entry.status === "blocked" ? 2 : entry.status === "degraded" ? 1 : 0)
  );
}

function marginalValueFor(projectedRegressionScore: number): HarnessAblationProbeMeasurement["marginalValue"] {
  if (projectedRegressionScore >= 10) {
    return "high";
  }
  if (projectedRegressionScore >= 5) {
    return "medium";
  }
  return "low";
}

function primaryMarginalSubsystemFor(probes: HarnessAblationProbeMeasurement[], primaryBottleneck: HarnessSubsystemId | null): HarnessSubsystemId | null {
  if (primaryBottleneck && probes.some((probe) => probe.subsystem === primaryBottleneck && probe.status !== "unresolved")) {
    return primaryBottleneck;
  }
  const sorted = [...probes].filter((probe) => probe.status !== "unresolved").sort((left, right) => right.projectedRegressionScore - left.projectedRegressionScore);
  return sorted[0]?.subsystem ?? null;
}

function recommendedNextExperiment(primaryMarginalSubsystem: HarnessSubsystemId | null, probes: HarnessAblationProbeMeasurement[]): HarnessAblationComparisonLedger["summary"]["recommendedNextExperiment"] {
  if (!primaryMarginalSubsystem) {
    return {
      subsystem: "none",
      action: "No measurable subsystem evidence was available for ablation; restore audit coverage first.",
      evidence: [],
    };
  }
  const probe = probes.find((item) => item.subsystem === primaryMarginalSubsystem);
  return {
    subsystem: primaryMarginalSubsystem,
    action: probe?.nextControlledExperiment ?? `Run an isolated branch-level ablation for ${primaryMarginalSubsystem}.`,
    evidence: probe ? [...probe.excludedArtifacts, ...probe.excludedValidationIds] : [],
  };
}

function rationaleFor(entry: SubsystemAuditEntry, evidenceRemovedCount: number, projectedRegressionScore: number): string {
  return `${labelFor(entry.id)} exclusion would remove ${entry.presentArtifacts.length} artifact(s), ${entry.validationIds.length} validation gate(s), ${entry.diagnosticSignalIds.length} diagnostic signal(s), ${entry.repairActionIds.length} repair action(s), and ${evidenceRemovedCount} unique evidence reference(s), for projected regression ${projectedRegressionScore}.`;
}

function expectedFailureSignalFor(subsystem: HarnessSubsystemId): string {
  return `A useful ${labelFor(subsystem)} subsystem should show a lower finalStatus, fewer passing feature gates, weaker audit score, or more repair actions when its evidence is excluded.`;
}

function labelFor(subsystem: HarnessSubsystemId): string {
  return subsystem.replace("-", " ");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
