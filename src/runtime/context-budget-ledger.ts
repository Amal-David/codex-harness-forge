import type { HarnessSpec } from "../types.js";
import { stableId } from "../utils/fs.js";
import {
  FUNCTION_DISPATCH_PLAN_ARTIFACT,
  RUNTIME_BUS_ARTIFACT,
  TOOL_SAFETY_LEDGER_ARTIFACT,
  TRACE_CONTEXT_ARTIFACT,
} from "./runtime-control-artifacts.js";
import type { ProviderRoute } from "./runtime-control-plane.js";
import type { WorkerLockEntry } from "./run-plan.js";

interface ContextBudgetInput {
  runId: string;
  spec: HarnessSpec;
  workerLock: WorkerLockEntry[];
}

interface DispatchPlanView {
  providerRoutes: ProviderRoute[];
}

export interface ContextBudgetLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  protocol: {
    name: "harness.context-budget";
    operations: ContextOperationKind[];
    progressiveDisclosureRule: string;
    compressionRule: string;
    isolationRule: string;
    invalidationRule: string;
  };
  summary: {
    maxTokenBudget: number;
    estimatedTokenCount: number;
    usageRatio: number;
    tierCount: number;
    selectedContextCount: number;
    writeBackCount: number;
    compressionPolicyCount: number;
    isolationBoundaryCount: number;
    memoizedBuilderCount: number;
    invalidationPointCount: number;
    unresolvedCount: number;
  };
  tiers: ContextTier[];
  operations: ContextOperation[];
  memoizedBuilders: ContextMemoizedBuilder[];
  invalidationPoints: ContextInvalidationPoint[];
  isolationBoundaries: ContextIsolationBoundary[];
  unresolved: Array<{
    id: string;
    reason: string;
    evidence: string[];
  }>;
}

type ContextOperationKind = "SELECT" | "WRITE" | "COMPRESS" | "ISOLATE";

interface ContextTier {
  id: "tier-1-metadata" | "tier-2-instructions" | "tier-3-resources";
  loadPolicy: "always" | "on-activation" | "on-demand";
  budgetTokens: number;
  estimatedTokens: number;
  status: "pass" | "fail";
  evidence: string[];
}

interface ContextOperation {
  id: string;
  operation: ContextOperationKind;
  status: "pass" | "fail";
  rule: string;
  evidence: string[];
}

interface ContextMemoizedBuilder {
  id: string;
  outputArtifact: string;
  status: "covered" | "missing-invalidation";
  invalidatedBy: string[];
  evidence: string[];
}

interface ContextInvalidationPoint {
  id: string;
  mutationPoint: string;
  invalidatesBuilderIds: string[];
  evidence: string[];
}

interface ContextIsolationBoundary {
  id: string;
  boundaryType: "coordinator-zero-inheritance" | "single-level-fork-guard" | "shared-state-swarm";
  subjectIds: string[];
  contextSharing: "none" | "single-level" | "shared-task-list";
  toolFilter: string[];
  status: "pass" | "fail";
  evidence: string[];
}

export function buildContextBudgetLedger(input: ContextBudgetInput, dispatchPlan: DispatchPlanView): ContextBudgetLedger {
  const maxTokenBudget = 32000;
  const tiers = ([
    {
      id: "tier-1-metadata",
      loadPolicy: "always",
      budgetTokens: 8000,
      estimatedTokens: estimateTokens(["harness-spec.json", "feature-list.json", "feature-scheduler.json", "startup-readiness.json", "run-plan.json"], input.spec.graph.length, input.spec.harnessModel.featureList.length),
      status: "pass",
      evidence: ["harness-spec.json", "feature-list.json", "feature-scheduler.json", "startup-readiness.json", "run-plan.json"],
    },
    {
      id: "tier-2-instructions",
      loadPolicy: "on-activation",
      budgetTokens: 8000,
      estimatedTokens: estimateTokens(["AGENTS.md", "instruction-routing-ledger.json", "sprint-contract.json", "worker-contracts/workflow-runtime.json"], input.spec.harnessModel.subsystems.length, input.workerLock.length),
      status: "pass",
      evidence: ["AGENTS.md", "instruction-routing-ledger.json", "sprint-contract.json", "worker-contracts/workflow-runtime.json"],
    },
    {
      id: "tier-3-resources",
      loadPolicy: "on-demand",
      budgetTokens: 16000,
      estimatedTokens: estimateTokens(
        ["environment-readiness-ledger.json", "source-of-record-ledger.json", "evidence-graph.json", "system-profiles.json", "architecture-boundary-ledger.json", "evaluator-rubric.json", "completion-authority-ledger.json", "quality-document.json", "continuity-ledger.json", "course-alignment-ledger.json", "verification-pipeline-ledger.json", "harness-diagnostic-ledger.json", "repair-guidance-ledger.json"],
        input.spec.sources.length,
        input.spec.artifactContracts.length,
      ),
      status: "pass",
      evidence: ["environment-readiness-ledger.json", "source-of-record-ledger.json", "evidence-graph.json", "system-profiles.json", "architecture-boundary-ledger.json", "evaluator-rubric.json", "completion-authority-ledger.json", "quality-document.json", "continuity-ledger.json", "course-alignment-ledger.json", "verification-pipeline-ledger.json", "harness-diagnostic-ledger.json", "repair-guidance-ledger.json"],
    },
  ] satisfies ContextTier[]).map((tier): ContextTier => ({
    ...tier,
    status: tier.estimatedTokens <= tier.budgetTokens ? "pass" : "fail",
  }));
  const operations: ContextOperation[] = [
    {
      id: "select-progressive-disclosure",
      operation: "SELECT",
      status: tiers.every((tier) => tier.status === "pass") && tiers.some((tier) => tier.loadPolicy === "always") && tiers.some((tier) => tier.loadPolicy === "on-demand") ? "pass" : "fail",
      rule: "Load metadata at startup, activate instruction topics only when relevant, and defer source/resource detail until a node or validator needs it.",
      evidence: tiers.flatMap((tier) => tier.evidence),
    },
    {
      id: "write-durable-state",
      operation: "WRITE",
      status: "pass",
      rule: "Write feature state, progress, handoff, run state, source-of-record answers, and feedback promotion candidates before completion so chat history is not the state store.",
      evidence: ["feature-list.json", "progress.md", "session-handoff.md", "run-state.json", "source-of-record-ledger.json", "feedback-promotion-ledger.json"],
    },
    {
      id: "compress-with-recovery-pointers",
      operation: "COMPRESS",
      status: "pass",
      rule: "When context usage reaches 80%, preserve recent context, summarize older decisions, and point recovery to progress, handoff, trace, validation, and source-of-record artifacts.",
      evidence: ["progress.md", "session-handoff.md", "harness-trace.json", "validation-report.md", "source-of-record-ledger.json"],
    },
    {
      id: "isolate-delegated-workers",
      operation: "ISOLATE",
      status: input.workerLock.length > 0 ? "pass" : "fail",
      rule: "Delegated worker groups receive self-contained prompts and filtered tools; parent context is not inherited except through explicit artifacts and state namespaces.",
      evidence: ["worker-lock.json", "run-plan.json", "agent-runs/runtime-planning-manifest.json", "agent-runs/council-elders-manifest.json"],
    },
  ];
  const invalidationPoints: ContextInvalidationPoint[] = [
    {
      id: "source-ref-mutated",
      mutationPoint: "Declared source refs or source availability change.",
      invalidatesBuilderIds: ["builder:evidence-graph", "builder:environment-readiness", "builder:source-of-record", "builder:system-profiles"],
      evidence: input.spec.sources.map((source) => source.location),
    },
    {
      id: "artifact-contract-mutated",
      mutationPoint: "Artifact contracts, generated artifacts, or validator bindings change.",
      invalidatesBuilderIds: ["builder:verification-hierarchy", "builder:feature-state", "builder:verification-pipeline"],
      evidence: input.spec.artifactContracts.map((contract) => contract.id),
    },
    {
      id: "provider-lock-mutated",
      mutationPoint: "Worker locks, executor locks, or provider routes change.",
      invalidatesBuilderIds: ["builder:dispatch-plan", "builder:tool-safety", "builder:runtime-bus", "builder:trace-context"],
      evidence: ["worker-lock.json", "executor-lock.json", FUNCTION_DISPATCH_PLAN_ARTIFACT],
    },
    {
      id: "validation-state-mutated",
      mutationPoint: "Any validation result changes after artifact generation or review.",
      invalidatesBuilderIds: ["builder:feature-state", "builder:evaluator-rubric", "builder:completion-authority", "builder:quality-document", "builder:continuity", "builder:course-alignment", "builder:verification-pipeline", "builder:session-clean-state", "builder:harness-diagnostic", "builder:harness-quality"],
      evidence: ["validation-report.md", "feature-list.json", "evaluator-rubric.json", "completion-authority-ledger.json", "quality-document.json", "continuity-ledger.json", "course-alignment-ledger.json", "verification-pipeline-ledger.json", "session-clean-state-ledger.json", "harness-quality-ledger.json"],
    },
  ];
  const memoizedBuilders: ContextMemoizedBuilder[] = [
    memoizedBuilder("builder:evidence-graph", "evidence-graph.json", invalidationPoints),
    memoizedBuilder("builder:environment-readiness", "environment-readiness-ledger.json", invalidationPoints),
    memoizedBuilder("builder:source-of-record", "source-of-record-ledger.json", invalidationPoints),
    memoizedBuilder("builder:system-profiles", "system-profiles.json", invalidationPoints),
    memoizedBuilder("builder:verification-hierarchy", "verification-hierarchy.json", invalidationPoints),
    memoizedBuilder("builder:feature-state", "feature-list.json", invalidationPoints),
    memoizedBuilder("builder:evaluator-rubric", "evaluator-rubric.json", invalidationPoints),
    memoizedBuilder("builder:completion-authority", "completion-authority-ledger.json", invalidationPoints),
    memoizedBuilder("builder:quality-document", "quality-document.json", invalidationPoints),
    memoizedBuilder("builder:continuity", "continuity-ledger.json", invalidationPoints),
    memoizedBuilder("builder:course-alignment", "course-alignment-ledger.json", invalidationPoints),
    memoizedBuilder("builder:verification-pipeline", "verification-pipeline-ledger.json", invalidationPoints),
    memoizedBuilder("builder:dispatch-plan", FUNCTION_DISPATCH_PLAN_ARTIFACT, invalidationPoints),
    memoizedBuilder("builder:tool-safety", TOOL_SAFETY_LEDGER_ARTIFACT, invalidationPoints),
    memoizedBuilder("builder:runtime-bus", RUNTIME_BUS_ARTIFACT, invalidationPoints),
    memoizedBuilder("builder:trace-context", TRACE_CONTEXT_ARTIFACT, invalidationPoints),
    memoizedBuilder("builder:session-clean-state", "session-clean-state-ledger.json", invalidationPoints),
    memoizedBuilder("builder:harness-diagnostic", "harness-diagnostic-ledger.json", invalidationPoints),
    memoizedBuilder("builder:harness-quality", "harness-quality-ledger.json", invalidationPoints),
  ];
  const isolationBoundaries: ContextIsolationBoundary[] = [
    ...unique(input.workerLock.map((worker) => worker.group)).map((group): ContextIsolationBoundary => {
      const workers = input.workerLock.filter((worker) => worker.group === group);
      return {
        id: stableId("context-isolation", `${input.runId}:${group}`),
        boundaryType: "coordinator-zero-inheritance" as const,
        subjectIds: workers.map((worker) => worker.id),
        contextSharing: "none" as const,
        toolFilter: unique(workers.flatMap((worker) => worker.requiredPermissions)),
        status: workers.every((worker) => worker.contractId && worker.functionId && worker.stateNamespace) ? "pass" : "fail",
        evidence: ["worker-lock.json", ...workers.map((worker) => worker.workerBindingId)],
      };
    }),
    {
      id: stableId("context-isolation", `${input.runId}:fork-guard`),
      boundaryType: "single-level-fork-guard",
      subjectIds: dispatchPlan.providerRoutes.map((route) => route.id),
      contextSharing: "single-level",
      toolFilter: ["spawn:disabled-for-child-workers", "shared-state-only-through-artifacts"],
      status: "pass",
      evidence: [FUNCTION_DISPATCH_PLAN_ARTIFACT, "worker-lock.json"],
    },
  ];
  const estimatedTokenCount = tiers.reduce((total, tier) => total + tier.estimatedTokens, 0);
  const unresolved = [
    ...tiers.filter((tier) => tier.status === "fail").map((tier) => ({ id: `tier-over-budget:${tier.id}`, reason: `${tier.id} estimates ${tier.estimatedTokens} token(s), above budget ${tier.budgetTokens}.`, evidence: tier.evidence })),
    ...operations.filter((operation) => operation.status === "fail").map((operation) => ({ id: `operation-missing:${operation.operation.toLowerCase()}`, reason: operation.rule, evidence: operation.evidence })),
    ...memoizedBuilders.filter((builder) => builder.status === "missing-invalidation").map((builder) => ({ id: `builder-invalidation-missing:${builder.id}`, reason: `${builder.id} has no explicit invalidation point.`, evidence: builder.evidence })),
    ...isolationBoundaries.filter((boundary) => boundary.status === "fail").map((boundary) => ({ id: `isolation-boundary-failed:${boundary.id}`, reason: "Delegated worker boundary is missing contract, function, state namespace, or explicit tool filter evidence.", evidence: boundary.evidence })),
    ...(estimatedTokenCount > maxTokenBudget ? [{ id: "context-budget-exceeded", reason: `Estimated context ${estimatedTokenCount} exceeds max budget ${maxTokenBudget}.`, evidence: tiers.flatMap((tier) => tier.evidence) }] : []),
  ];
  return {
    schemaVersion: 1,
    id: stableId("context-budget-ledger", `${input.runId}:${tiers.map((tier) => `${tier.id}:${tier.estimatedTokens}`).join("|")}:${operations.map((operation) => `${operation.operation}:${operation.status}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status: unresolved.length ? "fail" : "pass",
    protocol: {
      name: "harness.context-budget",
      operations: ["SELECT", "WRITE", "COMPRESS", "ISOLATE"],
      progressiveDisclosureRule: "Tier 1 metadata is always loaded; Tier 2 instructions activate by route; Tier 3 resources load only on demand.",
      compressionRule: "Compaction triggers at 80% of the session budget and must preserve recovery pointers to durable run artifacts.",
      isolationRule: "Delegated workers start from synthesized prompts and artifact/state references, not the parent conversation transcript.",
      invalidationRule: "Every memoized context builder must name mutation points that invalidate it.",
    },
    summary: {
      maxTokenBudget,
      estimatedTokenCount,
      usageRatio: ratio(estimatedTokenCount, maxTokenBudget),
      tierCount: tiers.length,
      selectedContextCount: tiers.filter((tier) => tier.loadPolicy !== "on-demand").length,
      writeBackCount: operations.filter((operation) => operation.operation === "WRITE" && operation.status === "pass").length,
      compressionPolicyCount: operations.filter((operation) => operation.operation === "COMPRESS" && operation.status === "pass").length,
      isolationBoundaryCount: isolationBoundaries.length,
      memoizedBuilderCount: memoizedBuilders.length,
      invalidationPointCount: invalidationPoints.length,
      unresolvedCount: unresolved.length,
    },
    tiers,
    operations,
    memoizedBuilders,
    invalidationPoints,
    isolationBoundaries,
    unresolved,
  };
}

function memoizedBuilder(id: string, outputArtifact: string, invalidationPoints: ContextInvalidationPoint[]): ContextMemoizedBuilder {
  const invalidatedBy = invalidationPoints.filter((point) => point.invalidatesBuilderIds.includes(id)).map((point) => point.id);
  return {
    id,
    outputArtifact,
    status: invalidatedBy.length ? "covered" : "missing-invalidation",
    invalidatedBy,
    evidence: [outputArtifact, ...invalidatedBy],
  };
}

function estimateTokens(artifactIds: string[], primaryCount: number, secondaryCount: number): number {
  return artifactIds.length * 320 + primaryCount * 140 + secondaryCount * 90;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 1000 : 0;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
