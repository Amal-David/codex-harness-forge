import path from "node:path";
import type { FeatureState, HarnessFeature, HarnessSpec, TraceEvent, ValidationResult } from "../types.js";
import { stableId, writeJson } from "../utils/fs.js";
import type { RunPlan } from "./run-plan.js";
import { traceEvent } from "./trace-ledger.js";

export const FEATURE_SCHEDULER_ARTIFACT = "feature-scheduler.json";

interface FeatureSchedulerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  runPlan: RunPlan;
}

export interface FeatureSchedulerResult {
  artifact: string;
  scheduler: FeatureScheduler;
  validation: ValidationResult;
}

interface FeatureScheduler {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  policy: {
    wipLimit: 1;
    activeSelection: string;
    startRule: string;
    completionRule: string;
    pressureRule: string;
  };
  summary: {
    totalFeatureCount: number;
    activeFeatureCount: number;
    readyFeatureCount: number;
    waitingFeatureCount: number;
    blockedFeatureCount: number;
    passingFeatureCount: number;
    completionPressure: number;
    runPlanNodeCount: number;
  };
  activeFeatureIds: string[];
  nextFeatureId?: string;
  queue: FeatureScheduleEntry[];
  dependencyEdges: Array<{
    featureId: string;
    dependsOn: string[];
  }>;
  unresolved: Array<{
    featureId: string;
    reason: string;
    evidence: string[];
  }>;
}

interface FeatureScheduleEntry {
  featureId: string;
  behavior: string;
  verificationCommand: string;
  originalState: FeatureState;
  scheduledState: FeatureState | "ready" | "waiting_on_dependencies";
  dependsOn: string[];
  validatorIds: string[];
  dependencyStatus: "satisfied" | "waiting" | "missing";
  nodeIds: string[];
  artifactIds: string[];
}

export function scheduledFeatureStates(features: HarnessFeature[], wipLimit = 1): HarnessFeature[] {
  const activeIds = selectActiveFeatureIds(features, wipLimit);
  return features.map((feature) => ({
    ...feature,
    state: activeIds.includes(feature.id) && feature.state === "not_started" ? "active" : feature.state,
  }));
}

export async function writeFeatureScheduler(input: FeatureSchedulerInput): Promise<FeatureSchedulerResult> {
  const scheduler = buildFeatureScheduler(input);
  const target = path.join(input.outputDir, FEATURE_SCHEDULER_ARTIFACT);
  await writeJson(target, scheduler);
  return {
    artifact: FEATURE_SCHEDULER_ARTIFACT,
    scheduler,
    validation: {
      id: "feature_scheduler_ready",
      name: "Feature scheduler ready",
      status: scheduler.status,
      details:
        scheduler.status === "pass"
          ? `Feature scheduler enforces WIP=${scheduler.policy.wipLimit} with ${scheduler.summary.activeFeatureCount} active feature(s) and ${scheduler.summary.completionPressure} unfinished feature(s).`
          : `Feature scheduler has unresolved item(s): ${scheduler.unresolved.map((item) => `${item.featureId}: ${item.reason}`).join(", ")}.`,
      evidence: [target],
      repairable: true,
    },
  };
}

export function featureSchedulerEvents(runId: string, result: FeatureSchedulerResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.feature_scheduler.created",
      artifactId: result.artifact,
      status: result.validation.status,
      message: `Feature scheduler selected ${result.scheduler.activeFeatureIds.length} active feature(s) with ${result.scheduler.summary.completionPressure} unfinished feature(s).`,
      evidence: [result.artifact],
    }),
  ];
}

function buildFeatureScheduler(input: FeatureSchedulerInput): FeatureScheduler {
  const features = input.spec.harnessModel.featureList;
  const activeFeatureIds = selectActiveFeatureIds(features, 1);
  const queue = features.map((feature) => featureScheduleEntry(feature, features, activeFeatureIds));
  const unresolved = unresolvedScheduleItems(queue, activeFeatureIds);
  const summary = {
    totalFeatureCount: features.length,
    activeFeatureCount: activeFeatureIds.length,
    readyFeatureCount: queue.filter((entry) => entry.scheduledState === "ready").length,
    waitingFeatureCount: queue.filter((entry) => entry.scheduledState === "waiting_on_dependencies").length,
    blockedFeatureCount: queue.filter((entry) => entry.scheduledState === "blocked").length,
    passingFeatureCount: queue.filter((entry) => entry.scheduledState === "passing").length,
    completionPressure: queue.filter((entry) => entry.scheduledState !== "passing").length,
    runPlanNodeCount: input.runPlan.nodeCount,
  };
  return {
    schemaVersion: 1,
    id: stableId("feature-scheduler", `${input.runId}:${queue.map((entry) => `${entry.featureId}:${entry.scheduledState}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status: unresolved.length ? "fail" : "pass",
    policy: {
      wipLimit: 1,
      activeSelection: "Pick the first unfinished feature whose dependencies are passing or absent; keep all other unfinished features ready or waiting.",
      startRule: "Only the scheduler may activate a feature; agents must not self-promote work to active.",
      completionRule: "Only validator results may move active or ready features to passing.",
      pressureRule: "Completion pressure equals required features not yet passing; zero pressure means the run may cleanly finish.",
    },
    summary,
    activeFeatureIds,
    nextFeatureId: activeFeatureIds[0] ?? queue.find((entry) => entry.scheduledState === "ready")?.featureId,
    queue,
    dependencyEdges: features.map((feature) => ({ featureId: feature.id, dependsOn: feature.dependsOn })),
    unresolved,
  };
}

function featureScheduleEntry(feature: HarnessFeature, features: HarnessFeature[], activeFeatureIds: string[]): FeatureScheduleEntry {
  const dependencyStatus = dependencyStatusFor(feature, features);
  const ready = feature.state === "not_started" && dependencyStatus === "satisfied";
  const scheduledState: FeatureScheduleEntry["scheduledState"] =
    feature.state === "not_started"
      ? activeFeatureIds.includes(feature.id)
        ? "active"
        : ready
          ? "ready"
          : "waiting_on_dependencies"
      : feature.state;
  return {
    featureId: feature.id,
    behavior: feature.behavior,
    verificationCommand: feature.verificationCommand,
    originalState: feature.state,
    scheduledState,
    dependsOn: feature.dependsOn,
    validatorIds: feature.validatorIds,
    dependencyStatus,
    nodeIds: feature.nodeIds,
    artifactIds: feature.artifactIds,
  };
}

function selectActiveFeatureIds(features: HarnessFeature[], wipLimit: number): string[] {
  const active = features.filter((feature) => feature.state === "active").map((feature) => feature.id);
  if (active.length) {
    return active.slice(0, wipLimit);
  }
  return features
    .filter((feature) => feature.state === "not_started" && dependencyStatusFor(feature, features) === "satisfied")
    .slice(0, wipLimit)
    .map((feature) => feature.id);
}

function dependencyStatusFor(feature: HarnessFeature, features: HarnessFeature[]): FeatureScheduleEntry["dependencyStatus"] {
  const byId = new Map(features.map((item) => [item.id, item]));
  const missing = feature.dependsOn.filter((id) => !byId.has(id));
  if (missing.length) {
    return "missing";
  }
  return feature.dependsOn.every((id) => byId.get(id)?.state === "passing") ? "satisfied" : "waiting";
}

function unresolvedScheduleItems(queue: FeatureScheduleEntry[], activeFeatureIds: string[]): FeatureScheduler["unresolved"] {
  return [
    ...(activeFeatureIds.length > 1
      ? [
          {
            featureId: "scheduler",
            reason: "More than one feature is active under WIP=1.",
            evidence: [FEATURE_SCHEDULER_ARTIFACT],
          },
        ]
      : []),
    ...queue
      .filter((entry) => !entry.behavior || !entry.verificationCommand || entry.dependencyStatus === "missing")
      .map((entry) => ({
        featureId: entry.featureId,
        reason: entry.dependencyStatus === "missing" ? "Feature depends on a missing feature ID." : "Feature is missing behavior or verification command.",
        evidence: ["feature-list.json"],
      })),
    ...(queue.length === 0
      ? [
          {
            featureId: "scheduler",
            reason: "Feature list is empty; scheduler has no scope primitive to drive.",
            evidence: ["feature-list.json"],
          },
        ]
      : []),
  ];
}
