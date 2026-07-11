import path from "node:path";
import type { HarnessSpec, TraceEvent, ValidationResult } from "../types.js";
import { stableId, writeJson } from "../utils/fs.js";
import type { FunctionInvocationLedger } from "./function-invocation-ledger.js";
import { intrinsicValidationId, isIntrinsicRuntimeNode } from "./node-execution-policy.js";
import type { FunctionDispatchPlan } from "./runtime-control-plane.js";
import { traceEvent } from "./trace-ledger.js";

export const NODE_EXECUTION_LEDGER_ARTIFACT = "node-execution-ledger.json";
export const NODE_EXECUTION_VALIDATION_ID = "node_execution_integrity";

interface NodeExecutionLedgerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  dispatchPlan: FunctionDispatchPlan;
  invocationLedger: FunctionInvocationLedger;
  completedNodeIds: Set<string>;
}

export interface NodeExecutionLedgerResult {
  artifact: string;
  ledger: NodeExecutionLedger;
  validation: ValidationResult;
}

export interface NodeExecutionLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  protocol: {
    name: "harness.node-execution";
    completionRule: string;
    dependencyRule: string;
  };
  summary: {
    requiredNodeCount: number;
    completedNodeCount: number;
    missingNodeCount: number;
    dependencyViolationCount: number;
  };
  nodes: NodeExecutionRecord[];
}

interface NodeExecutionRecord {
  nodeId: string;
  kind?: string;
  executionMode: "worker" | "executor" | "intrinsic" | "unrouted";
  status: "completed" | "planned_not_executed" | "dependency_violation";
  dependsOn: string[];
  unmetDependencies: string[];
  routeIds: string[];
  evidence: string[];
}

export function markCompletedValidationNodes(
  spec: HarnessSpec,
  dispatchPlan: FunctionDispatchPlan,
  validations: ValidationResult[],
  completedNodeIds: Set<string>,
): void {
  const observedValidationIds = new Set(validations.map((validation) => validation.id));
  const routesById = new Map(dispatchPlan.providerRoutes.map((route) => [route.id, route]));
  for (const node of spec.graph.filter((candidate) => candidate.kind === "validate")) {
    const dispatch = dispatchPlan.nodeDispatches.find((candidate) => candidate.nodeId === node.id);
    const executorRoutes = (dispatch?.executorRouteIds ?? []).map((routeId) => routesById.get(routeId)).filter((route) => route?.routeType === "executor");
    const routedValidationIds = executorRoutes.flatMap((route) => route?.validatorIds ?? []);
    const intrinsicId = intrinsicValidationId(node);
    const normalizedValidatorId = node.validatorId?.replace(/^validator:/, "").replace(/-/g, "_");
    const observed = routedValidationIds.length
      ? routedValidationIds.every((validatorId) => observedValidationIds.has(validatorId))
      : [intrinsicId, normalizedValidatorId].some((validatorId) => Boolean(validatorId && observedValidationIds.has(validatorId)));
    if (observed) {
      completedNodeIds.add(node.id);
    }
  }
}

export async function writeNodeExecutionLedger(input: NodeExecutionLedgerInput): Promise<NodeExecutionLedgerResult> {
  const ledger = buildNodeExecutionLedger(input);
  const target = path.join(input.outputDir, NODE_EXECUTION_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: NODE_EXECUTION_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: NODE_EXECUTION_VALIDATION_ID,
      name: "Node execution integrity",
      status: ledger.status,
      details:
        ledger.status === "pass"
          ? `Observed execution evidence for all ${ledger.summary.requiredNodeCount} required graph node(s) in dependency order.`
          : `Missing ${ledger.summary.missingNodeCount} required node execution(s) with ${ledger.summary.dependencyViolationCount} dependency violation(s).`,
      evidence: [target],
      repairable: true,
    },
  };
}

export function nodeExecutionEvents(runId: string, result: NodeExecutionLedgerResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.node_execution.recorded",
      artifactId: NODE_EXECUTION_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Recorded required graph-node execution with status ${result.ledger.status}.`,
      evidence: [NODE_EXECUTION_LEDGER_ARTIFACT],
    }),
  ];
}

function buildNodeExecutionLedger(input: NodeExecutionLedgerInput): NodeExecutionLedger {
  const dispatchByNode = new Map(input.dispatchPlan.nodeDispatches.map((dispatch) => [dispatch.nodeId, dispatch]));
  const invocationsByNode = new Map<string, FunctionInvocationLedger["invocations"]>();
  for (const invocation of input.invocationLedger.invocations) {
    invocationsByNode.set(invocation.nodeId, [...(invocationsByNode.get(invocation.nodeId) ?? []), invocation]);
  }
  const nodes = input.spec.graph.map((node): NodeExecutionRecord => {
    const dispatch = dispatchByNode.get(node.id);
    const routeIds = [...(dispatch?.workerRouteIds ?? []), ...(dispatch?.executorRouteIds ?? [])];
    const invocations = invocationsByNode.get(node.id) ?? [];
    const providerCompleted = routeIds.length > 0 && invocations.length === routeIds.length && invocations.every((invocation) => invocation.status === "completed");
    const intrinsicCompleted = isIntrinsicRuntimeNode(node) && input.completedNodeIds.has(node.id);
    const completed = providerCompleted || intrinsicCompleted;
    const unmetDependencies = (node.dependsOn ?? []).filter((dependency) => !input.completedNodeIds.has(dependency));
    const executionMode = routeIds.length
      ? dispatch?.workerRouteIds.length
        ? "worker"
        : "executor"
      : isIntrinsicRuntimeNode(node)
        ? "intrinsic"
        : "unrouted";
    return {
      nodeId: node.id,
      kind: node.kind,
      executionMode,
      status: completed ? (unmetDependencies.length ? "dependency_violation" : "completed") : "planned_not_executed",
      dependsOn: node.dependsOn ?? [],
      unmetDependencies,
      routeIds,
      evidence: invocations.flatMap((invocation) => invocation.evidence),
    };
  });
  const missingNodeCount = nodes.filter((node) => node.status === "planned_not_executed").length;
  const dependencyViolationCount = nodes.filter((node) => node.status === "dependency_violation").length;
  return {
    schemaVersion: 1,
    id: stableId("node-execution-ledger", `${input.runId}:${nodes.map((node) => `${node.nodeId}:${node.status}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status: missingNodeCount || dependencyViolationCount ? "fail" : "pass",
    protocol: {
      name: "harness.node-execution",
      completionRule: "Every graph node requires observed worker, executor, or explicitly named intrinsic runtime evidence before success.",
      dependencyRule: "A completed node is invalid when any declared predecessor lacks completion evidence.",
    },
    summary: {
      requiredNodeCount: nodes.length,
      completedNodeCount: nodes.filter((node) => node.status === "completed").length,
      missingNodeCount,
      dependencyViolationCount,
    },
    nodes,
  };
}
