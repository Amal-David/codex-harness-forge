import type {
  ArtifactContractV2,
  EvidenceGraph,
  HarnessDraft,
  HarnessNode,
  HarnessRequest,
  NodeInputRef,
  NodeOutputContract,
  ValidatorBinding,
} from "../types.js";
import type { CapabilityRegistry } from "../registry/capability-registry.js";
import { getCapability } from "../registry/capability-registry.js";
import { type CapabilityPackManifest, type CapabilityPackNode, selectCapabilityPacks } from "../registry/capability-packs.js";
import { stableId } from "../utils/fs.js";

export interface HarnessDraftSynthesisContext {
  request: HarnessRequest;
  evidenceGraph: EvidenceGraph;
  registry: CapabilityRegistry;
  selectedPackIds?: string[];
}

export function synthesizeHarnessDraft({ request, evidenceGraph, registry, selectedPackIds }: HarnessDraftSynthesisContext): HarnessDraft {
  const text = `${request.harness ?? ""} ${request.intent} ${request.sources.join(" ")}`.toLowerCase();
  const selectedPacks = selectedPackIds
    ? selectedPackIds.map((packId) => {
        const pack = registry.packs.find((candidate) => candidate.id === packId);
        if (!pack) {
          throw new Error(`Selected capability pack '${packId}' is missing from the registry.`);
        }
        return pack;
      })
    : selectCapabilityPacks({ request, evidenceGraph, packs: registry.packs });
  const needsOriginality = Boolean(request.originalityRequired || request.reasoningEffort === "hard" || request.reasoningEffort === "original" || /think (really )?hard|original|hypothes|out-of-distribution/.test(text));

  const nodes: HarnessNode[] = [];
  const edges: Array<{ from: string; to: string; reason: string }> = [];
  const artifacts: ArtifactContractV2[] = [];
  const validators: ValidatorBinding[] = [];
  const evidenceUse: HarnessDraft["evidenceUse"] = [];

  const sourceEvidence = evidenceGraph.facts.filter((fact) => fact.tags?.includes("source-availability")).map((fact) => fact.id);
  nodes.push(
    node(registry, {
      id: "profile:source-availability",
      kind: "profile",
      title: "Profile source availability",
      capabilityId: "profiler:source-availability",
      inputs: sourceInputs(evidenceGraph),
      outputs: [output("source-availability-facts", "fact")],
      evidenceRequired: sourceEvidence,
    }),
  );
  nodes.push(
    node(registry, {
      id: "validate:source-availability",
      kind: "validate",
      title: "Validate source availability",
      capabilityId: "validator:source-availability",
      validatorId: "validator:source-availability",
      inputs: [input("source-availability-facts", "fact", "source-availability-facts")],
      outputs: [output("source-availability-result", "validator-result")],
      evidenceRequired: sourceEvidence,
    }),
  );
  edges.push({ from: "profile:source-availability", to: "validate:source-availability", reason: "Validate sources after profiling availability." });
  validators.push({
    id: "binding:source-availability",
    validatorId: "validator:source-availability",
    nodeId: "validate:source-availability",
    required: true,
    evidenceRequired: sourceEvidence,
  });

  let prerequisiteForGenerators: string | undefined;
  if (needsOriginality) {
    const cognitiveEvidence = evidenceGraph.facts.filter((fact) => fact.kind === "rule" || fact.kind === "capability-hint").map((fact) => fact.id);
    nodes.push(
      node(registry, {
        id: "plan:hypotheses",
        kind: "plan",
        title: "Generate competing hypotheses",
        capabilityId: "agent:hypothesis-generator",
        agentId: "hypothesis-generator",
        inputs: sourceInputs(evidenceGraph),
        outputs: [output("hypotheses", "report")],
        evidenceRequired: cognitiveEvidence,
      }),
      node(registry, {
        id: "analyze:research-critic",
        kind: "analyze",
        title: "Critique hypotheses",
        capabilityId: "agent:research-critic",
        agentId: "research-critic",
        inputs: [input("hypotheses", "artifact", "hypotheses")],
        outputs: [output("research-critique", "report")],
        evidenceRequired: cognitiveEvidence,
      }),
      node(registry, {
        id: "plan:validation-strategy",
        kind: "plan",
        title: "Plan validation strategy",
        capabilityId: "agent:validation-strategist",
        agentId: "validation-strategist",
        inputs: [input("research-critique", "artifact", "research-critique")],
        outputs: [output("validation-strategy", "report")],
        evidenceRequired: cognitiveEvidence,
      }),
    );
    edges.push(
      { from: "profile:source-availability", to: "plan:hypotheses", reason: "Hypotheses must be grounded in known sources." },
      { from: "plan:hypotheses", to: "analyze:research-critic", reason: "Critique generated hypotheses before choosing a candidate." },
      { from: "analyze:research-critic", to: "plan:validation-strategy", reason: "Validation strategy follows critique." },
    );
    prerequisiteForGenerators = "plan:validation-strategy";
  }

  const terminalValidators: string[] = ["validate:source-availability"];
  for (const pack of selectedPacks.filter((item) => item.id !== "workflow-runtime")) {
    const packComponents = expandCapabilityPack(pack, registry, evidenceGraph, artifacts, validators, terminalValidators, {
      generationPrerequisite: prerequisiteForGenerators,
    });
    artifacts.push(...packComponents.artifacts);
    nodes.push(...packComponents.nodes);
    edges.push(...packComponents.edges);
    validators.push(...packComponents.validators);
    terminalValidators.push(...packComponents.terminalValidators);
    evidenceUse.push({
      decision: `Built ${pack.id} DAG nodes from capability pack '${pack.id}'.`,
      evidenceFactIds: packComponents.evidenceFactIds,
    });
  }

  if (artifacts.length === 0) {
    const fallbackPack = registry.packs.find((pack) => pack.id === "generic-report");
    if (!fallbackPack) {
      throw new Error("Fallback capability pack 'generic-report' is missing.");
    }
    if (!selectedPacks.some((pack) => pack.id === fallbackPack.id)) {
      selectedPacks.push(fallbackPack);
    }
    const packComponents = expandCapabilityPack(fallbackPack, registry, evidenceGraph, artifacts, validators, terminalValidators, {
      generationPrerequisite: prerequisiteForGenerators,
    });
    artifacts.push(...packComponents.artifacts);
    nodes.push(...packComponents.nodes);
    edges.push(...packComponents.edges);
    validators.push(...packComponents.validators);
    terminalValidators.push(...packComponents.terminalValidators);
    evidenceUse.push({
      decision: `Built generic fallback DAG nodes from capability pack '${fallbackPack.id}'.`,
      evidenceFactIds: packComponents.evidenceFactIds,
    });
  }

  const runtimePack = selectedPacks.find((pack) => pack.id === "workflow-runtime");
  if (runtimePack) {
    const packComponents = expandCapabilityPack(runtimePack, registry, evidenceGraph, artifacts, validators, terminalValidators);
    artifacts.push(...packComponents.artifacts);
    nodes.push(...packComponents.nodes);
    edges.push(...packComponents.edges);
    validators.push(...packComponents.validators);
    terminalValidators.push(...packComponents.terminalValidators);
    evidenceUse.push({
      decision: `Built workflow-runtime DAG nodes from capability pack '${runtimePack.id}'.`,
      evidenceFactIds: packComponents.evidenceFactIds,
    });
  }

  nodes.push(
    node(registry, {
      id: "finalize",
      kind: "finalize",
      title: "Finalize run artifacts and learning proposals",
      capabilityId: "agent:finalizer",
      agentId: "finalizer",
      inputs: artifacts.map((artifact) => input(artifact.id, "artifact", artifact.id)),
      outputs: [output("run-summary", "report")],
      evidenceRequired: sourceEvidence,
    }),
  );
  for (const validatorId of terminalValidators) {
    edges.push({ from: validatorId, to: "finalize", reason: "Finalization waits for required validators." });
  }

  const taskKinds = taskKindHypotheses(selectedPacks, evidenceGraph, artifacts.some((artifact) => artifact.id === "final-report"), sourceEvidence);

  return {
    id: stableId("draft", `${request.intent}:${evidenceGraph.id}:${artifacts.map((artifact) => artifact.id).join(",")}`),
    selectedCapabilityPackIds: selectedPacks.map((pack) => pack.id),
    taskKindHypotheses: taskKinds,
    selectedArtifacts: artifacts,
    proposedNodes: nodes,
    proposedEdges: edges,
    proposedValidators: validators,
    assumptions: assumptionsFor(request, selectedPacks),
    evidenceUse: [
      ...selectedPacks.map((pack) => ({
        decision: `Selected capability pack '${pack.id}' from manifest metadata.`,
        evidenceFactIds: evidenceGraph.facts.filter((fact) => fact.tags?.some((tag) => pack.match?.anyTags?.includes(tag))).map((fact) => fact.id),
      })),
      ...evidenceUse,
    ],
  };
}

function node(
  registry: CapabilityRegistry,
  options: Omit<HarnessNode, "permissions" | "allowedSources">,
): HarnessNode {
  const capability = options.capabilityId ? getCapability(registry, options.capabilityId) : undefined;
  return {
    ...options,
    permissions: capability?.permissionRequired ?? [],
    allowedSources: options.inputs.filter((inputRef) => inputRef.kind === "source").map((inputRef) => inputRef.ref),
  };
}

function expandCapabilityPack(
  pack: CapabilityPackManifest,
  registry: CapabilityRegistry,
  evidenceGraph: EvidenceGraph,
  selectedArtifacts: ArtifactContractV2[],
  validatorBindings: ValidatorBinding[],
  terminalValidators: string[],
  options: { generationPrerequisite?: string } = {},
): {
  artifacts: ArtifactContractV2[];
  nodes: HarnessNode[];
  edges: Array<{ from: string; to: string; reason: string }>;
  validators: ValidatorBinding[];
  terminalValidators: string[];
  evidenceFactIds: string[];
} {
  const artifacts = (pack.artifacts ?? []).map((artifact) => ({
    ...artifact,
    requiredEvidence: evidenceForTags(evidenceGraph, artifact.requiredEvidenceTags),
  }));
  const allArtifacts = [...selectedArtifacts, ...artifacts];
  const packValidators = (pack.validatorBindings ?? []).map((validator) => ({
    id: validator.id,
    validatorId: validator.validatorId,
    artifactId: validator.artifactId,
    nodeId: validator.nodeId,
    required: validator.required,
    evidenceRequired: evidenceForTags(evidenceGraph, validator.evidenceTags),
  }));
  const allValidatorBindings = [...validatorBindings, ...packValidators];
  const nodes = (pack.nodes ?? []).map((packNode) =>
    node(registry, {
      id: packNode.id,
      kind: packNode.kind,
      title: packNode.title,
      capabilityId: packNode.capabilityId,
      agentId: packNode.agentId,
      validatorId: packNode.validatorId,
      inputs: expandPackInputs(packNode.inputs, evidenceGraph, allArtifacts, allValidatorBindings),
      outputs: packNode.outputs,
      evidenceRequired: evidenceForTags(evidenceGraph, packNode.evidenceTags),
    }),
  );
  const edges = (pack.edges ?? []).flatMap((edge) =>
    edge.from === "$terminalValidators"
      ? terminalValidators.map((from) => ({ from, to: edge.to, reason: edge.reason }))
      : edge.from === "$generationPrerequisite"
        ? options.generationPrerequisite
          ? [{ from: options.generationPrerequisite, to: edge.to, reason: edge.reason }]
          : []
      : [{ from: edge.from, to: edge.to, reason: edge.reason }],
  );
  return {
    artifacts,
    nodes,
    edges,
    validators: packValidators,
    terminalValidators: pack.terminalValidators ?? [],
    evidenceFactIds: unique([...artifacts.flatMap((artifact) => artifact.requiredEvidence ?? []), ...nodes.flatMap((node) => node.evidenceRequired), ...packValidators.flatMap((validator) => validator.evidenceRequired)]),
  };
}

function expandPackInputs(
  inputs: CapabilityPackNode["inputs"],
  evidenceGraph: EvidenceGraph,
  artifacts: ArtifactContractV2[],
  validatorBindings: ValidatorBinding[],
): NodeInputRef[] {
  const expanded: NodeInputRef[] = [];
  for (const inputRef of inputs as Array<NodeInputRef | "$sources" | "$selectedArtifacts" | "$validatorBindings">) {
    if (inputRef === "$sources") {
      expanded.push(...sourceInputs(evidenceGraph));
      continue;
    }
    if (inputRef === "$selectedArtifacts") {
      expanded.push(...artifacts.map((artifact) => input(artifact.id, "artifact", artifact.id)));
      continue;
    }
    if (inputRef === "$validatorBindings") {
      expanded.push(...validatorBindings.map((validator) => input(validator.id, "validator-result", validator.id)));
      continue;
    }
    expanded.push({ id: inputRef.id, kind: inputRef.kind, ref: inputRef.ref });
  }
  return expanded;
}

function evidenceForTags(evidenceGraph: EvidenceGraph, tags: string[] | undefined): string[] {
  if (!tags?.length) {
    return [];
  }
  return evidenceGraph.facts.filter((fact) => fact.tags?.some((tag) => tags.includes(tag)) || tags.includes(fact.kind)).map((fact) => fact.id);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function input(id: string, kind: NodeInputRef["kind"], ref: string): NodeInputRef {
  return { id, kind, ref };
}

function output(id: string, kind: NodeOutputContract["kind"]): NodeOutputContract {
  return { id, kind, required: true };
}

function sourceInputs(evidenceGraph: EvidenceGraph): NodeInputRef[] {
  return evidenceGraph.sources.map((source) => input(source.id, "source", source.id));
}

function taskKindHypotheses(
  selectedPacks: CapabilityPackManifest[],
  evidenceGraph: EvidenceGraph,
  usesGenericReport: boolean,
  sourceEvidence: string[],
): Array<{ kind: string; confidence: number; evidence: string[] }> {
  const hypotheses = selectedPacks
    .filter((pack) => pack.id !== "workflow-runtime")
    .map((pack) => {
      const evidence = evidenceForTags(evidenceGraph, pack.match?.anyTags);
      return { kind: pack.id, confidence: evidence.length ? 0.95 : 0.75, evidence };
    });
  if (!hypotheses.length && usesGenericReport) {
    hypotheses.push({ kind: "generic-report", confidence: 0.6, evidence: sourceEvidence });
  }
  return hypotheses;
}

function assumptionsFor(request: HarnessRequest, selectedPacks: CapabilityPackManifest[]): string[] {
  const assumptions = ["Only registered local MVP capabilities may execute.", `Selected capability packs: ${selectedPacks.map((pack) => pack.id).join(", ") || "none"}.`];
  for (const pack of selectedPacks.filter((item) => item.id !== "workflow-runtime")) {
    const requestedExtension = pack.match?.sourceExtensions?.some((extension) => request.sources.some((source) => source.toLowerCase().endsWith(extension)));
    if (pack.match?.sourceExtensions?.length && !requestedExtension) {
      assumptions.push(`Capability pack '${pack.id}' matched by request language or evidence rather than an explicit source extension.`);
    }
    if (pack.artifacts?.some((artifact) => artifact.humanReviewRequired)) {
      assumptions.push(`Capability pack '${pack.id}' includes an artifact that may need human review.`);
    }
  }
  return assumptions;
}
