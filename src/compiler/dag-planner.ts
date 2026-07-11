import type {
  CheckpointSpec,
  EvidenceGraph,
  HarnessDraft,
  HarnessEdge,
  HarnessIR,
  HarnessNode,
  HarnessRequest,
  PermissionSpec,
  WorkflowNode,
} from "../types.js";
import type { CapabilityRegistry } from "../registry/capability-registry.js";
import { getCapability } from "../registry/capability-registry.js";
import { stableId } from "../utils/fs.js";
import { resolveExecutorForCapabilityId } from "../runtime/executor-registry.js";
import type { CompilerError } from "./harness-draft-verifier.js";
import { buildDynamicHarnessModel } from "./dynamic-harness-model.js";

export interface IRVerificationResult {
  ok: boolean;
  errors: CompilerError[];
}

export function compileHarnessIR(request: HarnessRequest, draft: HarnessDraft, evidenceGraph: EvidenceGraph): HarnessIR {
  const mode = request.mode ?? "standard";
  return {
    id: stableId("ir", `${draft.id}:${draft.proposedNodes.map((node) => node.id).join("|")}`),
    selectedCapabilityPackIds: draft.selectedCapabilityPackIds,
    task: {
      userGoal: request.intent,
      explicitConstraints: explicitConstraints(request),
      impliedArtifacts: draft.selectedArtifacts.map((artifact) => artifact.id),
      assumptions: draft.assumptions,
    },
    mode,
    evidenceGraph,
    artifacts: draft.selectedArtifacts,
    nodes: draft.proposedNodes,
    edges: draft.proposedEdges,
    validators: draft.proposedValidators,
    permissions: defaultPermissions(),
    checkpoints: buildCheckpoints(mode, draft.proposedNodes),
    harnessModel: buildDynamicHarnessModel({
      request,
      mode,
      artifacts: draft.selectedArtifacts,
      harnessNodes: draft.proposedNodes,
      validatorBindings: draft.proposedValidators,
    }),
  };
}

export function verifyHarnessIR(ir: HarnessIR, registry: CapabilityRegistry): IRVerificationResult {
  const errors: CompilerError[] = [];
  const nodeIds = new Set(ir.nodes.map((node) => node.id));
  for (const node of ir.nodes) {
    if (node.capabilityId && !getCapability(registry, node.capabilityId)) {
      errors.push(error("IR_UNKNOWN_CAPABILITY", `nodes.${node.id}.capabilityId`, `IR node '${node.id}' uses unknown capability '${node.capabilityId}'.`));
    }
    if (node.capabilityId?.startsWith("artifact-generator:") && !resolveExecutorForCapabilityId(node.capabilityId, "artifact-generator", registry.packs)) {
      errors.push(error("IR_GENERATOR_WITHOUT_EXECUTOR", `nodes.${node.id}.capabilityId`, `Artifact generator '${node.capabilityId}' has no executor binding in loaded capability packs.`));
    }
    if (node.capabilityId?.startsWith("validator:") && requiresManifestValidatorExecutor(node.capabilityId) && !resolveExecutorForCapabilityId(node.capabilityId, "validator", registry.packs)) {
      errors.push(error("IR_VALIDATOR_WITHOUT_EXECUTOR", `nodes.${node.id}.capabilityId`, `Validator '${node.capabilityId}' has no executor binding in loaded capability packs.`));
    }
  }
  const artifactProducer = new Map<string, string>();
  for (const node of ir.nodes) {
    for (const output of node.outputs) {
      if (output.kind !== "artifact") {
        continue;
      }
      if (artifactProducer.has(output.id)) {
        errors.push(error("IR_DUPLICATE_ARTIFACT_PRODUCER", `nodes.${node.id}.outputs`, `Artifact '${output.id}' is produced by multiple nodes.`));
      }
      artifactProducer.set(output.id, node.id);
    }
  }
  for (const artifact of ir.artifacts) {
    if (artifact.producedBy && artifactProducer.get(artifact.id) !== artifact.producedBy) {
      errors.push(error("IR_ARTIFACT_PRODUCER_MISMATCH", `artifacts.${artifact.id}.producedBy`, `Artifact '${artifact.id}' is not produced by '${artifact.producedBy}'.`));
    }
    if (!artifact.validatorBindings.length) {
      errors.push(error("IR_ARTIFACT_WITHOUT_VALIDATOR", `artifacts.${artifact.id}.validatorBindings`, `Artifact '${artifact.id}' has no validator bindings.`));
    }
  }
  for (const edge of ir.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      errors.push(error("IR_EDGE_UNKNOWN_NODE", "edges", `IR edge '${edge.from}' -> '${edge.to}' references an unknown node.`));
    }
  }
  const cycle = firstCycle(ir.nodes, ir.edges);
  if (cycle.length) {
    errors.push(error("IR_DAG_CYCLE", "edges", `IR graph contains a cycle: ${cycle.join(" -> ")}.`));
  }
  for (const binding of ir.validators) {
    if (binding.nodeId && !nodeIds.has(binding.nodeId)) {
      errors.push(error("IR_VALIDATOR_UNKNOWN_NODE", `validators.${binding.id}.nodeId`, `Validator binding '${binding.id}' targets unknown node '${binding.nodeId}'.`));
    }
  }
  return { ok: errors.length === 0, errors };
}

export function workflowNodesFromIR(ir: HarnessIR): WorkflowNode[] {
  const dependencyMap = new Map<string, string[]>();
  for (const node of ir.nodes) {
    dependencyMap.set(node.id, []);
  }
  for (const edge of ir.edges) {
    dependencyMap.set(edge.to, [...(dependencyMap.get(edge.to) ?? []), edge.from]);
  }
  return topoSort(ir.nodes, ir.edges).map((node) => ({
    id: node.id,
    title: node.title,
    kind: node.kind,
    capabilityId: node.capabilityId,
    agentId: node.agentId,
    validatorId: node.validatorId,
    artifactId: node.outputs.find((output) => output.kind === "artifact")?.id,
    dependsOn: dependencyMap.get(node.id) ?? [],
    produces: node.outputs.map((output) => output.id),
    evidenceRequired: node.evidenceRequired,
  }));
}

export function topoSort(nodes: HarnessNode[], edges: HarnessEdge[]): HarnessNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) {
      continue;
    }
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  }
  const ready = [...incoming.entries()].filter(([, count]) => count === 0).map(([id]) => id).sort();
  const ordered: HarnessNode[] = [];
  while (ready.length) {
    const id = ready.shift() as string;
    const node = byId.get(id);
    if (node) {
      ordered.push(node);
    }
    for (const next of outgoing.get(id) ?? []) {
      const count = (incoming.get(next) ?? 0) - 1;
      incoming.set(next, count);
      if (count === 0) {
        ready.push(next);
        ready.sort();
      }
    }
  }
  return ordered.length === nodes.length ? ordered : nodes;
}

function firstCycle(nodes: HarnessNode[], edges: HarnessEdge[]): string[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
      outgoing.get(edge.from)?.push(edge.to);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(nodeId: string, path: string[]): string[] {
    if (visiting.has(nodeId)) {
      return [...path, nodeId];
    }
    if (visited.has(nodeId)) {
      return [];
    }
    visiting.add(nodeId);
    for (const next of outgoing.get(nodeId) ?? []) {
      const cycle = visit(next, [...path, nodeId]);
      if (cycle.length) return cycle;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return [];
  }
  for (const node of nodes) {
    const cycle = visit(node.id, []);
    if (cycle.length) return cycle;
  }
  return [];
}

function explicitConstraints(request: HarnessRequest): string[] {
  const constraints: string[] = [];
  if (request.durationSeconds !== undefined) constraints.push(`duration:${request.durationSeconds}`);
  if (request.fps !== undefined) constraints.push(`fps:${request.fps}`);
  if (request.width !== undefined) constraints.push(`width:${request.width}`);
  if (request.height !== undefined) constraints.push(`height:${request.height}`);
  for (const control of request.controls) constraints.push(`control:${control}`);
  return constraints;
}

function defaultPermissions(): PermissionSpec {
  return {
    defaultWriteAccess: false,
    destructiveWritesRequireApproval: true,
    sourceOfTruthWritesRequireApproval: true,
    externalSideEffectsRequireApproval: true,
  };
}

function buildCheckpoints(mode: string, nodes: HarnessNode[]): CheckpointSpec[] {
  const checkpoints: CheckpointSpec[] = [
    { id: "destructive-write-approval", reason: "Destructive writes require explicit approval.", required: true },
    { id: "source-of-truth-write-approval", reason: "Source-of-truth updates are suggestions only unless approved.", required: true },
  ];
  if (mode === "deep" || mode === "tournament" || nodes.some((node) => node.permissions.includes("human-review"))) {
    checkpoints.push({ id: "taste-review", reason: "Deep/tournament outputs may be taste-sensitive.", required: true, beforeNodeId: "finalize" });
  }
  return checkpoints;
}

function error(code: string, path: string, message: string): CompilerError {
  return { code, path, message };
}

function requiresManifestValidatorExecutor(capabilityId: string): boolean {
  return !new Set(["validator:source-availability", "validator:run-state", "validator:council-review"]).has(capabilityId);
}
