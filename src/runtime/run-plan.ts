import { createHash } from "node:crypto";
import path from "node:path";
import type { HarnessSpec, WorkflowNode } from "../types.js";
import { readTextIfExists, stableId, writeJson } from "../utils/fs.js";
import { resolveExecutorBindings, type ResolvedExecutorBinding, uniqueExecutorBindings } from "./executor-registry.js";
import { resolveWorkerBindings, type ResolvedWorkerBinding } from "./worker-registry.js";

export interface ExecutorLockEntry {
  id: string;
  packId: string;
  executorId: string;
  kind: ResolvedExecutorBinding["kind"];
  adapter: string;
  capabilityIds: string[];
  matchedCapabilityIds: string[];
  module?: string;
  exportName?: string;
  produces?: string[];
  validatorIds?: string[];
  digest: string;
}

export interface WorkerLockEntry {
  id: string;
  packId: string;
  workerBindingId: string;
  contractId: string;
  functionId: string;
  triggerId: string;
  contractVersion: string;
  stateNamespace: string;
  eventTopics: string[];
  adapterTypes: string[];
  requiredPermissions: string[];
  replacementCompatibilityKey: string;
  criticContract?: {
    requiredOutput: "criticReview";
    hostAdapter: "codex:host";
    fallbackAdapter: "local:module";
  };
  group: ResolvedWorkerBinding["group"];
  adapter: string;
  module?: string;
  exportName?: string;
  executionModel?: string;
  agentIds: string[];
  matchedAgentIds: string[];
  capabilityIds: string[];
  matchedCapabilityIds: string[];
  references?: string[];
  digest: string;
}

export interface RunPlanNode {
  id: string;
  title: string;
  kind?: WorkflowNode["kind"];
  capabilityId?: string;
  agentId?: string;
  validatorId?: string;
  artifactId?: string;
  dependsOn: string[];
  produces: string[];
  executorLockIds: string[];
  workerLockIds: string[];
}

export interface RunPlan {
  id: string;
  runId: string;
  specId: string;
  irId?: string;
  schedule: {
    strategy: "parallel-topological";
    maxConcurrency: number;
    retryPolicy: "node-declared-or-fail-fast";
  };
  executorLockDigest: string;
  workerLockDigest: string;
  nodeCount: number;
  nodes: RunPlanNode[];
}

export async function writeRunPlanArtifacts(
  outputDir: string,
  runId: string,
  spec: HarnessSpec,
): Promise<{ artifacts: string[]; executorLock: ExecutorLockEntry[]; workerLock: WorkerLockEntry[]; runPlan: RunPlan }> {
  const executorLock = await buildExecutorLock(spec);
  const workerLock = buildWorkerLock(spec);
  const executorLockDigest = digestJson(executorLock);
  const workerLockDigest = digestJson(workerLock);
  const runPlan: RunPlan = {
    id: stableId("run-plan", `${runId}:${spec.id}:${executorLockDigest}:${workerLockDigest}`),
    runId,
    specId: spec.id,
    irId: spec.ir?.id,
    schedule: {
      strategy: "parallel-topological",
      maxConcurrency: 16,
      retryPolicy: "node-declared-or-fail-fast",
    },
    executorLockDigest,
    workerLockDigest,
    nodeCount: spec.graph.length,
    nodes: spec.graph.map((node) => ({
      id: node.id,
      title: node.title,
      kind: node.kind,
      capabilityId: node.capabilityId,
      agentId: node.agentId,
      validatorId: node.validatorId,
      artifactId: node.artifactId,
      dependsOn: node.dependsOn,
      produces: node.produces ?? [],
      executorLockIds: lockIdsForNode(node, executorLock),
      workerLockIds: workerLockIdsForNode(node, workerLock),
    })),
  };
  await writeJson(path.join(outputDir, "executor-lock.json"), {
    runId,
    specId: spec.id,
    irId: spec.ir?.id,
    digest: executorLockDigest,
    executors: executorLock,
  });
  await writeJson(path.join(outputDir, "worker-lock.json"), {
    runId,
    specId: spec.id,
    irId: spec.ir?.id,
    digest: workerLockDigest,
    workers: workerLock,
  });
  await writeJson(path.join(outputDir, "run-plan.json"), runPlan);
  return { artifacts: ["executor-lock.json", "worker-lock.json", "run-plan.json"], executorLock, workerLock, runPlan };
}

async function buildExecutorLock(spec: HarnessSpec): Promise<ExecutorLockEntry[]> {
  const executors = uniqueExecutorBindings([...resolveExecutorBindings(spec, "artifact-generator"), ...resolveExecutorBindings(spec, "validator")]);
  return Promise.all(
    executors.map(async (executor) => {
      const digest = await digestExecutor(executor);
      return {
        id: stableId("executor-lock", `${executor.packId}:${executor.id}:${digest}`),
        packId: executor.packId,
        executorId: executor.id,
        kind: executor.kind,
        adapter: executor.adapter,
        capabilityIds: executor.capabilityIds,
        matchedCapabilityIds: executor.matchedCapabilityIds,
        module: executor.module,
        exportName: executor.exportName,
        produces: executor.produces,
        validatorIds: executor.validatorIds,
        digest,
      };
    }),
  );
}

function buildWorkerLock(spec: HarnessSpec): WorkerLockEntry[] {
  const bindings = uniqueWorkerBindings(resolveWorkerBindings(spec));
  return bindings.map((binding) => {
    const digest = digestJson({
      packId: binding.packId,
      id: binding.id,
      group: binding.group,
      adapter: binding.adapter,
      module: binding.module,
      exportName: binding.exportName,
      executionModel: binding.executionModel,
      contractId: binding.contract.id,
      functionId: binding.contract.functionId,
      triggerId: binding.contract.triggerId,
      contractVersion: binding.contract.version,
      stateNamespace: binding.contract.stateNamespace,
      eventTopics: binding.contract.eventTopics,
      adapterTypes: binding.contract.adapterTypes,
      requiredPermissions: binding.contract.requiredPermissions,
      replacementCompatibilityKey: binding.contract.replacement.compatibilityKey,
      criticContract: binding.group === "council-elders" ? { requiredOutput: "criticReview", hostAdapter: "codex:host", fallbackAdapter: "local:module" } : undefined,
      agentIds: binding.agentIds,
      matchedAgentIds: binding.matchedAgentIds,
      capabilityIds: binding.capabilityIds,
      matchedCapabilityIds: binding.matchedCapabilityIds,
      references: binding.references,
    });
    return {
      id: stableId("worker-lock", `${binding.packId}:${binding.id}:${digest}`),
      packId: binding.packId,
      workerBindingId: binding.id,
      contractId: binding.contract.id,
      functionId: binding.contract.functionId,
      triggerId: binding.contract.triggerId,
      contractVersion: binding.contract.version,
      stateNamespace: binding.contract.stateNamespace,
      eventTopics: binding.contract.eventTopics,
      adapterTypes: binding.contract.adapterTypes,
      requiredPermissions: binding.contract.requiredPermissions,
      replacementCompatibilityKey: binding.contract.replacement.compatibilityKey,
      criticContract: binding.group === "council-elders" ? { requiredOutput: "criticReview", hostAdapter: "codex:host", fallbackAdapter: "local:module" } : undefined,
      group: binding.group,
      adapter: binding.adapter,
      module: binding.module,
      exportName: binding.exportName,
      executionModel: binding.executionModel,
      agentIds: binding.agentIds,
      matchedAgentIds: binding.matchedAgentIds,
      capabilityIds: binding.capabilityIds,
      matchedCapabilityIds: binding.matchedCapabilityIds,
      references: binding.references,
      digest,
    };
  });
}

function uniqueWorkerBindings(bindings: ResolvedWorkerBinding[]): ResolvedWorkerBinding[] {
  const seen = new Set<string>();
  return bindings.filter((binding) => {
    const key = `${binding.packId}:${binding.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function digestExecutor(executor: ResolvedExecutorBinding): Promise<string> {
  const moduleContent = executor.module ? await readTextIfExists(path.resolve(process.cwd(), executor.module)) : undefined;
  return digestJson({
    packId: executor.packId,
    id: executor.id,
    kind: executor.kind,
    adapter: executor.adapter,
    capabilityIds: executor.capabilityIds,
    matchedCapabilityIds: executor.matchedCapabilityIds,
    module: executor.module,
    exportName: executor.exportName,
    produces: executor.produces,
    validatorIds: executor.validatorIds,
    moduleSha1: moduleContent ? sha1(moduleContent) : undefined,
  });
}

function lockIdsForNode(node: WorkflowNode, executorLock: ExecutorLockEntry[]): string[] {
  if (!node.capabilityId) {
    return [];
  }
  return executorLock.filter((entry) => entry.matchedCapabilityIds.includes(node.capabilityId as string)).map((entry) => entry.id);
}

function workerLockIdsForNode(node: WorkflowNode, workerLock: WorkerLockEntry[]): string[] {
  return workerLock
    .filter(
      (entry) =>
        (node.agentId && entry.matchedAgentIds.includes(node.agentId)) ||
        (node.capabilityId && entry.matchedCapabilityIds.includes(node.capabilityId)),
    )
    .map((entry) => entry.id);
}

function digestJson(value: unknown): string {
  return sha1(stableStringify(value));
}

function sha1(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
