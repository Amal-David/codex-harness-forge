import type { HarnessSpec } from "../types.js";
import { stableId } from "../utils/fs.js";
import type { ExecutorLockEntry, RunPlan, WorkerLockEntry } from "./run-plan.js";

interface PolicyGateInput {
  runId: string;
  spec: HarnessSpec;
  executorLock: ExecutorLockEntry[];
  workerLock: WorkerLockEntry[];
  runPlan: RunPlan;
}

export interface PolicyGate {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  rule: string;
  permissions: HarnessSpec["permissions"];
  checkpoints: HarnessSpec["checkpoints"];
  allowedAdapters: string[];
  decisions: PolicyDecision[];
}

export interface PolicyDecision {
  subjectType: "worker" | "executor";
  subjectId: string;
  functionId: string;
  adapter: string;
  status: "allow" | "deny";
  requiredPermissions: string[];
  approvalRequired: boolean;
  checkpointIds: string[];
  reasons: string[];
}

export interface BudgetGate {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  rule: string;
  limits: {
    maxNodes: number;
    maxExecutorFunctions: number;
    maxWorkerFunctions: number;
    maxLocalDeterministicCalls: number;
    maxRetriesPerNode: number;
  };
  estimatedUsage: {
    nodes: number;
    executorFunctions: number;
    workerFunctions: number;
    localDeterministicCalls: number;
  };
  allocations: Array<{
    nodeId: string;
    executorLockIds: string[];
    workerLockIds: string[];
    maxLocalCalls: number;
    maxArtifacts: number;
    traceSpanId: string;
  }>;
}

export interface ApprovalGate {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  rule: string;
  requiredRequestCount: number;
  resolvedRequestCount: number;
  requests: ApprovalRequest[];
}

export interface ApprovalRequest {
  id: string;
  subjectType: PolicyDecision["subjectType"];
  subjectId: string;
  functionId: string;
  requiredPermissions: string[];
  checkpointIds: string[];
  status: "not_required" | "resolved" | "pending";
  resolution: "not_required" | "auto_allowed_local_read_write" | "requires_user_approval";
  details: string;
}

const KNOWN_PERMISSIONS = new Set([
  "filesystem-read",
  "filesystem-write",
  "destructive-write",
  "source-of-truth-write",
  "external-side-effect",
  "human-review",
]);

export const SENSITIVE_PERMISSIONS = new Set(["destructive-write", "source-of-truth-write", "external-side-effect"]);
export const ALLOWED_ADAPTERS = ["local:module", "codex:host"];

export function buildPolicyGate(input: PolicyGateInput): PolicyGate {
  const decisions = [
    ...input.workerLock.map((worker) => workerPolicyDecision(worker, input.spec)),
    ...input.executorLock.map((executor) => executorPolicyDecision(executor)),
  ];
  return {
    schemaVersion: 1,
    id: stableId("policy-gate", `${input.runId}:${decisions.map((decision) => `${decision.subjectId}:${decision.status}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status: decisions.every((decision) => decision.status === "allow") ? "pass" : "fail",
    rule: "Fail closed when an adapter is unknown, a permission is undeclared, or a sensitive permission lacks an explicit checkpoint.",
    permissions: input.spec.permissions,
    checkpoints: input.spec.checkpoints,
    allowedAdapters: ALLOWED_ADAPTERS,
    decisions,
  };
}

export function buildBudgetGate(input: PolicyGateInput): BudgetGate {
  const allocations = input.runPlan.nodes.map((node) => {
    const maxLocalCalls = Math.max(1, node.executorLockIds.length + node.workerLockIds.length);
    return {
      nodeId: node.id,
      executorLockIds: node.executorLockIds,
      workerLockIds: node.workerLockIds,
      maxLocalCalls,
      maxArtifacts: Math.max(1, node.produces.length),
      traceSpanId: stableId("span", `${input.runId}:${node.id}`),
    };
  });
  const estimatedUsage = {
    nodes: input.runPlan.nodeCount,
    executorFunctions: input.executorLock.length,
    workerFunctions: input.workerLock.length,
    localDeterministicCalls: allocations.reduce((total, allocation) => total + allocation.maxLocalCalls, 0),
  };
  const limits = {
    maxNodes: 128,
    maxExecutorFunctions: 32,
    maxWorkerFunctions: 32,
    maxLocalDeterministicCalls: 256,
    maxRetriesPerNode: 1,
  };
  const status =
    estimatedUsage.nodes <= limits.maxNodes &&
    estimatedUsage.executorFunctions <= limits.maxExecutorFunctions &&
    estimatedUsage.workerFunctions <= limits.maxWorkerFunctions &&
    estimatedUsage.localDeterministicCalls <= limits.maxLocalDeterministicCalls
      ? "pass"
      : "fail";
  return {
    schemaVersion: 1,
    id: stableId("budget-gate", `${input.runId}:${estimatedUsage.nodes}:${estimatedUsage.localDeterministicCalls}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    rule: "Every run is checked against fixed runtime limits before workers or executors are dispatched.",
    limits,
    estimatedUsage,
    allocations,
  };
}

export function buildApprovalGate(input: PolicyGateInput, policyGate: PolicyGate): ApprovalGate {
  const requests: ApprovalRequest[] = policyGate.decisions
    .filter((decision) => decision.approvalRequired)
    .map((decision) => ({
      id: stableId("approval-request", `${input.runId}:${decision.subjectId}:${decision.functionId}`),
      subjectType: decision.subjectType,
      subjectId: decision.subjectId,
      functionId: decision.functionId,
      requiredPermissions: decision.requiredPermissions,
      checkpointIds: decision.checkpointIds,
      status: "pending" as const,
      resolution: "requires_user_approval" as const,
      details: "Approval is required and no resolved approval token is attached to this run.",
    }));
  const resolvedRequestCount = requests.filter((request) => request.status === "resolved" || request.status === "not_required").length;
  return {
    schemaVersion: 1,
    id: stableId("approval-gate", `${input.runId}:${requests.map((request) => `${request.subjectId}:${request.status}`).join("|") || "not-required"}`),
    runId: input.runId,
    specId: input.spec.id,
    status: requests.length === 0 || requests.every((request) => request.status === "resolved" || request.status === "not_required") ? "pass" : "fail",
    rule: "Runs must resolve every human, destructive, source-of-truth, or external-side-effect approval before dispatch.",
    requiredRequestCount: requests.length,
    resolvedRequestCount,
    requests,
  };
}

function workerPolicyDecision(worker: WorkerLockEntry, spec: HarnessSpec): PolicyDecision {
  const reasons: string[] = [];
  const unknownAdapters = worker.adapterTypes.length ? worker.adapterTypes.filter((adapter) => !ALLOWED_ADAPTERS.includes(adapter)) : [];
  if (!ALLOWED_ADAPTERS.includes(worker.adapter)) {
    reasons.push(`Selected adapter '${worker.adapter}' is not allowed.`);
  }
  if (!worker.adapterTypes.includes(worker.adapter)) {
    reasons.push(`Selected adapter '${worker.adapter}' is not declared by contract '${worker.contractId}'.`);
  }
  if (unknownAdapters.length) {
    reasons.push(`Allowed adapter list includes unknown adapter(s): ${unknownAdapters.join(", ")}.`);
  }
  const requiredPermissions = worker.requiredPermissions;
  const undeclaredPermissions = requiredPermissions.filter((permission) => !KNOWN_PERMISSIONS.has(permission));
  if (undeclaredPermissions.length) {
    reasons.push(`Unknown required permission(s): ${undeclaredPermissions.join(", ")}.`);
  }
  const sensitive = requiredPermissions.filter((permission) => SENSITIVE_PERMISSIONS.has(permission));
  const checkpointIds = checkpointIdsForSensitivePermissions(spec, sensitive);
  if (sensitive.length && checkpointIds.length === 0) {
    reasons.push(`Sensitive permission(s) require an explicit checkpoint: ${sensitive.join(", ")}.`);
  }
  return {
    subjectType: "worker",
    subjectId: worker.workerBindingId,
    functionId: worker.functionId,
    adapter: worker.adapter,
    status: reasons.length ? "deny" : "allow",
    requiredPermissions,
    approvalRequired: sensitive.length > 0 || requiredPermissions.includes("human-review"),
    checkpointIds,
    reasons: reasons.length ? reasons : ["Adapter and permission contract are allowed for this run."],
  };
}

function executorPolicyDecision(executor: ExecutorLockEntry): PolicyDecision {
  const requiredPermissions = executor.kind === "validator" ? ["filesystem-read"] : ["filesystem-read", "filesystem-write"];
  const reasons = ALLOWED_ADAPTERS.includes(executor.adapter) ? ["Adapter and inferred filesystem permissions are allowed for this run."] : [`Selected adapter '${executor.adapter}' is not allowed.`];
  return {
    subjectType: "executor",
    subjectId: executor.executorId,
    functionId: `${executor.kind}.${executor.executorId}`,
    adapter: executor.adapter,
    status: ALLOWED_ADAPTERS.includes(executor.adapter) ? "allow" : "deny",
    requiredPermissions,
    approvalRequired: false,
    checkpointIds: [],
    reasons,
  };
}

function checkpointIdsForSensitivePermissions(spec: HarnessSpec, sensitivePermissions: string[]): string[] {
  if (!sensitivePermissions.length) {
    return [];
  }
  return spec.checkpoints.filter((checkpoint) => checkpoint.required).map((checkpoint) => checkpoint.id);
}
