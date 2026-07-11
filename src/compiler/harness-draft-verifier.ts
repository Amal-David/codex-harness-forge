import type { EvidenceGraph, HarnessDraft, HarnessEdge, HarnessNode, ValidatorBinding } from "../types.js";
import type { CapabilityRegistry } from "../registry/capability-registry.js";
import { getCapability } from "../registry/capability-registry.js";

export interface CompilerError {
  code: string;
  path: string;
  message: string;
  repairHint?: string;
}

export interface DraftVerificationResult {
  ok: boolean;
  errors: CompilerError[];
}

export function verifyHarnessDraft(draft: HarnessDraft, evidenceGraph: EvidenceGraph, registry: CapabilityRegistry): DraftVerificationResult {
  const errors: CompilerError[] = [];
  const nodeIds = new Set<string>();
  const artifactIds = new Set(draft.selectedArtifacts.map((artifact) => artifact.id));
  const bindingIds = new Set(draft.proposedValidators.map((binding) => binding.id));
  const evidenceIds = new Set(evidenceGraph.facts.map((fact) => fact.id));

  draft.proposedNodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      errors.push(error("DUPLICATE_NODE_ID", `proposedNodes[${index}].id`, `Duplicate node id '${node.id}'.`, "Use stable unique ids for every draft node."));
    }
    nodeIds.add(node.id);
    verifyNode(node, index, registry, evidenceIds, errors);
  });

  draft.proposedEdges.forEach((edge, index) => verifyEdge(edge, index, nodeIds, errors));
  verifyAcyclic(draft.proposedEdges, nodeIds, errors);

  draft.selectedArtifacts.forEach((artifact, index) => {
    if (!artifact.validatorBindings.length) {
      errors.push(error("ARTIFACT_WITHOUT_VALIDATORS", `selectedArtifacts[${index}].validatorBindings`, `Artifact '${artifact.id}' has no validator bindings.`, "Bind at least one registered validator to every artifact."));
    }
    for (const bindingId of artifact.validatorBindings) {
      if (!bindingIds.has(bindingId)) {
        errors.push(error("UNKNOWN_ARTIFACT_VALIDATOR_BINDING", `selectedArtifacts[${index}].validatorBindings`, `Artifact '${artifact.id}' references missing validator binding '${bindingId}'.`));
      }
    }
    if (artifact.producedBy && !nodeIds.has(artifact.producedBy)) {
      errors.push(error("UNKNOWN_ARTIFACT_PRODUCER", `selectedArtifacts[${index}].producedBy`, `Artifact '${artifact.id}' producer '${artifact.producedBy}' is not a draft node.`));
    }
    for (const factId of artifact.requiredEvidence ?? []) {
      if (!evidenceIds.has(factId)) {
        errors.push(error("UNKNOWN_ARTIFACT_EVIDENCE", `selectedArtifacts[${index}].requiredEvidence`, `Artifact '${artifact.id}' references missing evidence fact '${factId}'.`));
      }
    }
  });

  draft.proposedValidators.forEach((binding, index) => verifyBinding(binding, index, registry, nodeIds, artifactIds, evidenceIds, errors));
  return { ok: errors.length === 0, errors };
}

function verifyNode(node: HarnessNode, index: number, registry: CapabilityRegistry, evidenceIds: Set<string>, errors: CompilerError[]): void {
  const path = `proposedNodes[${index}]`;
  if (!node.capabilityId) {
    errors.push(error("NODE_WITHOUT_CAPABILITY", `${path}.capabilityId`, `Node '${node.id}' has no capability id.`, "Every executable node must select a registered capability."));
    return;
  }
  const capability = getCapability(registry, node.capabilityId);
  if (!capability) {
    errors.push(error("UNKNOWN_CAPABILITY", `${path}.capabilityId`, `Capability '${node.capabilityId}' is not registered.`, "Use a capability id from CapabilityRegistry."));
    return;
  }
  for (const permission of node.permissions) {
    if (!capability.permissionRequired.includes(permission)) {
      errors.push(error("PERMISSION_ESCALATION", `${path}.permissions`, `Node '${node.id}' declares permission '${permission}' not allowed by '${capability.id}'.`, "Node permissions must be a subset of the selected capability permissions."));
    }
  }
  for (const factId of node.evidenceRequired) {
    if (!evidenceIds.has(factId)) {
      errors.push(error("UNKNOWN_NODE_EVIDENCE", `${path}.evidenceRequired`, `Node '${node.id}' references missing evidence fact '${factId}'.`));
    }
  }
}

function verifyEdge(edge: HarnessEdge, index: number, nodeIds: Set<string>, errors: CompilerError[]): void {
  if (!nodeIds.has(edge.from)) {
    errors.push(error("UNKNOWN_EDGE_FROM", `proposedEdges[${index}].from`, `Edge source '${edge.from}' is not a draft node.`));
  }
  if (!nodeIds.has(edge.to)) {
    errors.push(error("UNKNOWN_EDGE_TO", `proposedEdges[${index}].to`, `Edge target '${edge.to}' is not a draft node.`));
  }
}

function verifyBinding(
  binding: ValidatorBinding,
  index: number,
  registry: CapabilityRegistry,
  nodeIds: Set<string>,
  artifactIds: Set<string>,
  evidenceIds: Set<string>,
  errors: CompilerError[],
): void {
  const path = `proposedValidators[${index}]`;
  const capability = getCapability(registry, binding.validatorId);
  if (!capability || capability.kind !== "validator") {
    errors.push(error("UNKNOWN_VALIDATOR", `${path}.validatorId`, `Validator '${binding.validatorId}' is not a registered validator capability.`, "Bind validators from CapabilityRegistry only."));
  }
  if (binding.nodeId && !nodeIds.has(binding.nodeId)) {
    errors.push(error("UNKNOWN_VALIDATOR_NODE", `${path}.nodeId`, `Validator binding '${binding.id}' targets missing node '${binding.nodeId}'.`));
  }
  if (binding.artifactId && !artifactIds.has(binding.artifactId)) {
    errors.push(error("UNKNOWN_VALIDATOR_ARTIFACT", `${path}.artifactId`, `Validator binding '${binding.id}' targets missing artifact '${binding.artifactId}'.`));
  }
  if (!binding.nodeId && !binding.artifactId) {
    errors.push(error("UNBOUND_VALIDATOR", `${path}`, `Validator binding '${binding.id}' has neither nodeId nor artifactId.`));
  }
  for (const factId of binding.evidenceRequired) {
    if (!evidenceIds.has(factId)) {
      errors.push(error("UNKNOWN_VALIDATOR_EVIDENCE", `${path}.evidenceRequired`, `Validator binding '${binding.id}' references missing evidence fact '${factId}'.`));
    }
  }
}

function verifyAcyclic(edges: HarnessEdge[], nodeIds: Set<string>, errors: CompilerError[]): void {
  const outgoing = new Map<string, string[]>();
  for (const nodeId of nodeIds) {
    outgoing.set(nodeId, []);
  }
  for (const edge of edges) {
    if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
      outgoing.get(edge.from)?.push(edge.to);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(nodeId: string, path: string[]): void {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      errors.push(error("DAG_CYCLE", "proposedEdges", `Draft graph contains a cycle through '${nodeId}'.`, `Cycle path: ${[...path, nodeId].join(" -> ")}`));
      return;
    }
    visiting.add(nodeId);
    for (const next of outgoing.get(nodeId) ?? []) {
      visit(next, [...path, nodeId]);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  }
  for (const nodeId of nodeIds) {
    visit(nodeId, []);
  }
}

function error(code: string, path: string, message: string, repairHint?: string): CompilerError {
  return { code, path, message, repairHint };
}
