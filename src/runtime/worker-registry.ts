import type { HarnessSpec, RuntimeAgentGroup } from "../types.js";
import { loadCapabilityPacks, type CapabilityPackManifest, type CapabilityPackWorkerBinding } from "../registry/capability-packs.js";
import { loadWorkerFunctionContracts, type WorkerFunctionContract } from "./worker-contracts.js";

export interface ResolvedWorkerBinding extends CapabilityPackWorkerBinding {
  packId: string;
  matchedAgentIds: string[];
  matchedCapabilityIds: string[];
  contract: WorkerFunctionContract;
}

export function resolveWorkerBindings(
  spec: HarnessSpec,
  group?: RuntimeAgentGroup,
  packs: CapabilityPackManifest[] = loadCapabilityPacks(),
  contracts: WorkerFunctionContract[] = loadWorkerFunctionContracts(),
): ResolvedWorkerBinding[] {
  const activeAgentIds = new Set(spec.graph.map((node) => node.agentId).filter((agentId): agentId is string => Boolean(agentId)));
  const activeCapabilityIds = new Set(spec.graph.map((node) => node.capabilityId).filter((capabilityId): capabilityId is string => Boolean(capabilityId)));
  const explicitBindings: ResolvedWorkerBinding[] = [];
  for (const pack of packs) {
    for (const binding of pack.workerBindings ?? []) {
      const matchedAgentIds = binding.agentIds.filter((agentId) => activeAgentIds.has(agentId));
      const matchedCapabilityIds = binding.capabilityIds.filter((capabilityId) => activeCapabilityIds.has(capabilityId));
      if (matchedAgentIds.length || matchedCapabilityIds.length) {
        explicitBindings.push({ ...binding, packId: pack.id, matchedAgentIds, matchedCapabilityIds, contract: resolveBindingContract(binding, contracts, pack.id) });
      }
    }
  }
  const coveredAgentIds = new Set(explicitBindings.flatMap((binding) => binding.matchedAgentIds));
  const coveredCapabilityIds = new Set(explicitBindings.flatMap((binding) => binding.matchedCapabilityIds));
  const syntheticBindings = [
    syntheticGraphBinding(spec, "domain-planning", coveredAgentIds, coveredCapabilityIds, contracts),
    syntheticGraphBinding(spec, "finalization", coveredAgentIds, coveredCapabilityIds, contracts),
  ].filter((binding): binding is ResolvedWorkerBinding => Boolean(binding));
  return [...explicitBindings, ...syntheticBindings].filter((binding) => !group || binding.group === group);
}

export function workerAgentIdsForGroup(spec: HarnessSpec, group: RuntimeAgentGroup, packs?: CapabilityPackManifest[]): Set<string> {
  return new Set(resolveWorkerBindings(spec, group, packs).flatMap((binding) => binding.matchedAgentIds.length ? binding.matchedAgentIds : binding.agentIds));
}

function resolveBindingContract(binding: CapabilityPackWorkerBinding, contracts: WorkerFunctionContract[], packId: string): WorkerFunctionContract {
  const contract = contracts.find((item) => item.id === binding.contractId);
  if (!contract) {
    throw new Error(`Worker binding '${binding.id}' from pack '${packId}' references unknown contract '${binding.contractId}'.`);
  }
  if (contract.workerId !== binding.id) {
    throw new Error(`Worker binding '${binding.id}' from pack '${packId}' references contract '${contract.id}' for worker '${contract.workerId}'.`);
  }
  if (!contract.adapterTypes.includes(binding.adapter)) {
    throw new Error(`Worker binding '${binding.id}' uses adapter '${binding.adapter}' but contract '${contract.id}' allows ${contract.adapterTypes.join(", ")}.`);
  }
  return contract;
}

function syntheticGraphBinding(
  spec: HarnessSpec,
  group: "domain-planning" | "finalization",
  coveredAgentIds: Set<string>,
  coveredCapabilityIds: Set<string>,
  contracts: WorkerFunctionContract[],
): ResolvedWorkerBinding | undefined {
  const nodes = spec.graph.filter((node) => {
    if (!node.agentId || coveredAgentIds.has(node.agentId) || (node.capabilityId && coveredCapabilityIds.has(node.capabilityId))) {
      return false;
    }
    return group === "domain-planning" ? node.kind === "analyze" || node.kind === "plan" : node.kind === "finalize";
  });
  if (!nodes.length) {
    return undefined;
  }
  const binding: CapabilityPackWorkerBinding = {
    id: group === "domain-planning" ? "worker:domain-planning" : "worker:finalization",
    contractId: group === "domain-planning" ? "contract:workflow-domain-planning" : "contract:workflow-finalization",
    group,
    adapter: "local:module",
    module: "dist/runtime/worker-executors.js",
    exportName: "runWorkflowRuntimeWorker",
    agentIds: unique(nodes.map((node) => node.agentId).filter((agentId): agentId is string => Boolean(agentId))),
    capabilityIds: unique(nodes.map((node) => node.capabilityId).filter((capabilityId): capabilityId is string => Boolean(capabilityId))),
    executionModel: group === "domain-planning" ? "topological-waves" : "serial-finalization",
    required: true,
    references: ["run-plan.json", "function-invocation-ledger.json"],
  };
  return {
    ...binding,
    packId: "workflow-runtime",
    matchedAgentIds: binding.agentIds,
    matchedCapabilityIds: binding.capabilityIds,
    contract: resolveBindingContract(binding, contracts, "workflow-runtime"),
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
