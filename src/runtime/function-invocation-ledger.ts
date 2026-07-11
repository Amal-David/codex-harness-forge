import path from "node:path";
import type { HarnessSpec, RuntimeAgentRun, TraceEvent, ValidationResult } from "../types.js";
import { stableId, writeJson } from "../utils/fs.js";
import { traceEvent } from "./trace-ledger.js";
import type { FunctionDispatchPlan, ProviderRoute } from "./runtime-control-plane.js";
import { FUNCTION_DISPATCH_PLAN_ARTIFACT, FUNCTION_INVOCATION_LEDGER_ARTIFACT } from "./runtime-control-plane.js";

interface FunctionInvocationLedgerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  dispatchPlan: FunctionDispatchPlan;
  agentRuns: RuntimeAgentRun[];
  artifacts: string[];
  validations: ValidationResult[];
}

export interface FunctionInvocationLedgerResult {
  artifact: string;
  ledger: FunctionInvocationLedger;
  validation: ValidationResult;
}

export interface FunctionInvocationLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail" | "warning";
  protocol: {
    name: "harness.function-invocation";
    completionRule: string;
  };
  summary: {
    dispatchableNodeCount: number;
    completedInvocationCount: number;
    missingInvocationCount: number;
    blockedInvocationCount: number;
    noDispatchNodeCount: number;
  };
  invocations: FunctionInvocation[];
  missingInvocations: Array<{
    nodeId: string;
    routeId: string;
    functionId: string;
    expectedEvidence: string[];
    reason: string;
  }>;
}

interface FunctionInvocation {
  id: string;
  nodeId: string;
  routeId: string;
  routeType: ProviderRoute["routeType"];
  subjectId: string;
  functionId: string;
  adapter: string;
  status: "completed" | "blocked" | "planned_not_executed";
  expectedEvidence: string[];
  evidence: string[];
  traceSpanId: string;
}

export async function writeFunctionInvocationLedger(input: FunctionInvocationLedgerInput): Promise<FunctionInvocationLedgerResult> {
  const ledger = buildFunctionInvocationLedger(input);
  const artifact = FUNCTION_INVOCATION_LEDGER_ARTIFACT;
  const target = path.join(input.outputDir, artifact);
  await writeJson(target, ledger);
  return {
    artifact,
    ledger,
    validation: {
      id: "function_invocation_ledger_completed",
      name: "Function invocation ledger completed",
      status: ledger.status,
      details:
        ledger.status === "pass"
          ? `Completed ${ledger.summary.completedInvocationCount} provider invocation(s) across ${ledger.summary.dispatchableNodeCount} dispatchable node(s).`
          : `Missing ${ledger.summary.missingInvocationCount} provider invocation(s) and ${ledger.summary.blockedInvocationCount} blocked invocation(s).`,
      evidence: [target],
      repairable: true,
    },
  };
}

export function functionInvocationEvents(runId: string, ledger: FunctionInvocationLedger, validation: ValidationResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.invocation_ledger.created",
      artifactId: FUNCTION_INVOCATION_LEDGER_ARTIFACT,
      status: validation.status,
      message: `Recorded ${ledger.invocations.length} provider invocation(s); ${ledger.summary.completedInvocationCount} completed.`,
      evidence: [FUNCTION_INVOCATION_LEDGER_ARTIFACT],
    }),
  ];
}

function buildFunctionInvocationLedger(input: FunctionInvocationLedgerInput): FunctionInvocationLedger {
  const artifacts = new Set(input.artifacts);
  const routeById = new Map(input.dispatchPlan.providerRoutes.map((route) => [route.id, route]));
  const invocations = input.dispatchPlan.nodeDispatches.flatMap((node) =>
    [...node.workerRouteIds, ...node.executorRouteIds].map((routeId) => {
      const route = routeById.get(routeId);
      if (!route) {
        return missingRouteInvocation(input.runId, node.nodeId, routeId);
      }
      return route.routeType === "worker"
        ? workerInvocation(input.runId, node.nodeId, route, input.agentRuns)
        : executorInvocation(input.runId, node.nodeId, route, artifacts, input.validations);
    }),
  );
  const missingInvocations = invocations
    .filter((invocation) => invocation.status !== "completed")
    .map((invocation) => ({
      nodeId: invocation.nodeId,
      routeId: invocation.routeId,
      functionId: invocation.functionId,
      expectedEvidence: invocation.expectedEvidence,
      reason: invocation.status === "blocked" ? "Provider route was blocked before completion." : "Provider route has no observed execution evidence.",
    }));
  const noDispatchNodeCount = input.dispatchPlan.nodeDispatches.filter((node) => node.status === "no_dispatch_required").length;
  const blockedInvocationCount = invocations.filter((invocation) => invocation.status === "blocked").length;
  const completedInvocationCount = invocations.filter((invocation) => invocation.status === "completed").length;
  const missingInvocationCount = invocations.filter((invocation) => invocation.status === "planned_not_executed").length;
  return {
    schemaVersion: 1,
    id: stableId("function-invocation-ledger", `${input.runId}:${invocations.map((invocation) => `${invocation.routeId}:${invocation.status}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status: missingInvocations.length ? "fail" : invocations.length ? "pass" : "warning",
    protocol: {
      name: "harness.function-invocation",
      completionRule: "A dispatch route is complete only when the runtime observes agent-run, artifact-output, or validator-result evidence for the routed function.",
    },
    summary: {
      dispatchableNodeCount: input.dispatchPlan.nodeDispatches.filter((node) => node.status === "dispatchable").length,
      completedInvocationCount,
      missingInvocationCount,
      blockedInvocationCount,
      noDispatchNodeCount,
    },
    invocations,
    missingInvocations,
  };
}

function workerInvocation(runId: string, nodeId: string, route: ProviderRoute, agentRuns: RuntimeAgentRun[]): FunctionInvocation {
  const runs = agentRuns.filter((run) => run.nodeId === nodeId);
  const completedRuns = runs.filter((run) => run.status === "completed");
  const blockedRuns = runs.filter((run) => run.status === "blocked");
  const evidence = completedRuns.flatMap((run) => run.artifacts);
  return {
    id: stableId("function-invocation", `${runId}:${nodeId}:${route.id}`),
    nodeId,
    routeId: route.id,
    routeType: route.routeType,
    subjectId: route.subjectId,
    functionId: route.functionId,
    adapter: route.adapter,
    status: evidence.length ? "completed" : blockedRuns.length ? "blocked" : "planned_not_executed",
    expectedEvidence: [`agent-runs/* for node ${nodeId}`],
    evidence,
    traceSpanId: route.traceSpanId,
  };
}

function executorInvocation(
  runId: string,
  nodeId: string,
  route: ProviderRoute,
  artifacts: Set<string>,
  validations: ValidationResult[],
): FunctionInvocation {
  const expectedEvidence = route.executorKind === "validator" ? route.validatorIds ?? [] : route.produces ?? [];
  const evidence =
    route.executorKind === "validator"
      ? (route.validatorIds ?? []).filter((validatorId) => validations.some((validation) => validation.id === validatorId))
      : (route.produces ?? []).filter((artifact) => artifacts.has(artifact));
  return {
    id: stableId("function-invocation", `${runId}:${nodeId}:${route.id}`),
    nodeId,
    routeId: route.id,
    routeType: route.routeType,
    subjectId: route.subjectId,
    functionId: route.functionId,
    adapter: route.adapter,
    status: evidence.length && evidence.length === expectedEvidence.length ? "completed" : "planned_not_executed",
    expectedEvidence,
    evidence,
    traceSpanId: route.traceSpanId,
  };
}

function missingRouteInvocation(runId: string, nodeId: string, routeId: string): FunctionInvocation {
  return {
    id: stableId("function-invocation", `${runId}:${nodeId}:${routeId}:missing-route`),
    nodeId,
    routeId,
    routeType: "executor",
    subjectId: "missing-route",
    functionId: "missing-route",
    adapter: "missing",
    status: "planned_not_executed",
    expectedEvidence: [FUNCTION_DISPATCH_PLAN_ARTIFACT],
    evidence: [],
    traceSpanId: stableId("span", `${runId}:${nodeId}:${routeId}:missing-route`),
  };
}
