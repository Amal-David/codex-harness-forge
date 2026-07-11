import type {
  AgentSpec,
  ArtifactContract,
  CheckpointSpec,
  HarnessIR,
  HarnessNode,
  HarnessRequest,
  HarnessSpec,
  PermissionSpec,
  RouteDecision,
  SourceRef,
  SystemProfile,
  ValidatorSpec,
  WorkflowNode,
} from "../types.js";
import type { CapabilityRegistry } from "../registry/capability-registry.js";
import { getCapability } from "../registry/capability-registry.js";
import { slugify, stableId } from "../utils/fs.js";
import { workflowNodesFromIR } from "./dag-planner.js";
import { compileDomainPrompt } from "./domain-prompt-compiler.js";
import { buildDynamicHarnessModel } from "./dynamic-harness-model.js";

export function compileHarnessSpec(request: HarnessRequest, route: RouteDecision, profiles: SystemProfile[], sources: SourceRef[]): HarnessSpec {
  const validators = mergeValidators(profiles.flatMap((profile) => profile.validators), route.requiredValidators);
  const agents = route.requiredAgents.map((agentId) => buildAgent(agentId, sources));
  const graph = buildGraph(agents, validators);
  const artifactContracts = profiles.flatMap((profile) => profile.artifactContracts);
  const harnessModel = buildDynamicHarnessModel({ request, mode: route.mode, artifacts: artifactContracts, workflowNodes: graph, validators });
  return {
    id: stableId("harness", `${request.intent}-${route.archetype}-${route.mode}`),
    name: slugify(request.intent || request.harness || route.archetype),
    archetype: route.archetype,
    mode: route.mode,
    routeComposition: route.composition,
    selectedCapabilityPackIds: route.selectedCapabilityPackIds,
    userIntent: request.intent,
    systemProfiles: profiles.map((profile) => ({ id: profile.id, type: profile.type })),
    sources,
    agents,
    graph,
    validators,
    artifactContracts,
    permissions: defaultPermissions(),
    checkpoints: buildCheckpoints(route.mode, artifactContracts),
    learning: {
      proposeAgentsMdUpdates: true,
      proposeSkillUpdates: true,
      updateWithoutApproval: false,
      automationCandidate: route.mode === "automation",
    },
    cognitiveStrategy: buildCognitiveStrategy(request),
    harnessModel,
    compiledPrompt: compileDomainPrompt(request, route, profiles),
  };
}

export function compileHarnessSpecFromIR(
  request: HarnessRequest,
  route: RouteDecision,
  profiles: SystemProfile[],
  sources: SourceRef[],
  ir: HarnessIR,
  registry: CapabilityRegistry,
): HarnessSpec {
  const validatorIds = unique([...profiles.flatMap((profile) => profile.validators.map((validator) => validator.id)), ...ir.artifacts.flatMap((artifact) => artifact.validators)]);
  const validators = mergeValidators(profiles.flatMap((profile) => profile.validators), validatorIds);
  const graph = workflowNodesFromIR(ir);
  return {
    id: stableId("harness", `${request.intent}-${ir.id}-${route.mode}`),
    name: slugify(request.intent || request.harness || route.archetype),
    archetype: route.archetype,
    mode: ir.mode,
    routeComposition: route.composition,
    selectedCapabilityPackIds: ir.selectedCapabilityPackIds,
    userIntent: request.intent,
    systemProfiles: profiles.map((profile) => ({ id: profile.id, type: profile.type })),
    sources,
    agents: buildAgentsFromIR(ir, registry, sources),
    graph,
    validators,
    artifactContracts: ir.artifacts,
    permissions: ir.permissions,
    checkpoints: ir.checkpoints,
    learning: {
      proposeAgentsMdUpdates: true,
      proposeSkillUpdates: true,
      updateWithoutApproval: false,
      automationCandidate: ir.mode === "automation",
    },
    cognitiveStrategy: buildCognitiveStrategy(request),
    harnessModel: ir.harnessModel,
    compiledPrompt: compileDomainPrompt(request, route, profiles),
    evidenceGraph: ir.evidenceGraph,
    ir,
  };
}

function mergeValidators(profileValidators: ValidatorSpec[], requiredIds: string[]): ValidatorSpec[] {
  const byId = new Map<string, ValidatorSpec>();
  for (const validator of profileValidators) {
    byId.set(validator.id, validator);
  }
  for (const id of requiredIds) {
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        name: id.replace(/_/g, " "),
        type: "runtime",
        required: true,
      });
    }
  }
  return [...byId.values()];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function buildAgent(agentId: string, sources: SourceRef[]): AgentSpec {
  const writeAccess = ["lottie-engineer", "frontend-builder", "storybook-agent", "repair-agent", "implementation-agent"].includes(agentId);
  return {
    id: agentId,
    name: agentId
      .split("-")
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" "),
    role: roleFor(agentId),
    goal: goalFor(agentId),
    writeAccess,
    tools: writeAccess ? ["filesystem-write", "validators"] : ["filesystem-read", "analysis"],
    allowedSources: sources.map((source) => source.id),
    outputSchema: { type: "object", required: ["summary", "artifacts"] },
    stopConditions: ["output schema satisfied", "validator handoff complete"],
  };
}

function buildAgentsFromIR(ir: HarnessIR, registry: CapabilityRegistry, sources: SourceRef[]): AgentSpec[] {
  const byId = new Map<string, AgentSpec>();
  for (const node of ir.nodes) {
    if (!node.agentId || byId.has(node.agentId)) {
      continue;
    }
    byId.set(node.agentId, buildAgentFromNode(node.agentId, node, registry, sources));
  }
  return [...byId.values()];
}

function buildAgentFromNode(agentId: string, node: HarnessNode, registry: CapabilityRegistry, sources: SourceRef[]): AgentSpec {
  const capability = node.capabilityId ? getCapability(registry, node.capabilityId) : undefined;
  const writeAccess = node.permissions.includes("filesystem-write");
  return {
    id: agentId,
    name: agentId
      .split("-")
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" "),
    role: capability?.description ?? roleFor(agentId),
    goal: goalFor(agentId),
    writeAccess,
    tools: writeAccess ? ["filesystem-write", "validators"] : ["filesystem-read", "analysis"],
    allowedSources: node.allowedSources.length ? node.allowedSources : sources.map((source) => source.id),
    outputSchema: { type: "object", required: ["summary", "artifacts"] },
    stopConditions: ["capability contract satisfied", "validator handoff complete"],
  };
}

function roleFor(agentId: string): string {
  const roles: Record<string, string> = {
    "asset-analyst": "Inspect assets, groups, colors, dimensions, and animatable structure.",
    "motion-director": "Define animation concept, camera language, pacing, and movement hierarchy.",
    "prompt-specialist": "Translate user intent into precise domain vocabulary and constraints.",
    "lottie-engineer": "Generate the Lottie JSON artifact and controls.",
    "render-qa": "Preview generated artifacts and catch technical issues.",
    "motion-critic": "Judge taste, pacing, clarity, premium feel, and brand fit.",
    "repair-agent": "Repair validation failures without changing source-of-truth files.",
    finalizer: "Package artifacts, trace, validation report, and learning suggestions.",
    "source-auditor": "Identify source conflicts, stale docs, missing context, and authority order.",
    "component-inventory": "Extract approved components, props, imports, and examples.",
    "token-agent": "Extract colors, spacing, typography, radius, and token usage.",
    "ux-flow-agent": "Convert request into a UI flow specification grounded in source.",
    "frontend-builder": "Produce implementation guidance or files using approved components.",
    "storybook-agent": "Create or describe Storybook examples.",
    "accessibility-agent": "Validate keyboard, contrast, ARIA, and semantics.",
    "visual-qa": "Validate responsive and visual conformance.",
    "hypothesis-generator": "Generate concrete hypotheses before implementation, including non-obvious candidates.",
    "research-critic": "Challenge assumptions, identify copied/default patterns, and score originality.",
    "validation-strategist": "Define how hypotheses will be validated or falsified before finalization.",
    "persistence-architect": "Design durable run state, saved workflow records, memory write-back, provenance, and sync boundaries.",
    "flow-runtime-manager": "Manage workflow lifecycle, resumability, run inspection, and generated orchestration boundaries.",
    "council-gstack-critic": "Adversarially review process quality, specialist coverage, QA/release discipline, and inspectable workflow mechanics using GStack-inspired practices.",
    "council-gbrain-memory": "Adversarially review memory, source refs, provenance, write-back, sync, and contradiction handling using GBrain-inspired practices.",
    "council-verifier": "Adversarially review validator bindings, IR grounding, failed checks, and finalization gates.",
    "council-course-corrector": "Synthesize council findings into concrete course corrections before finalization.",
  };
  return roles[agentId] ?? "Perform scoped specialist harness work.";
}

function goalFor(agentId: string): string {
  return `Produce a structured ${agentId} result that can be traced and validated.`;
}

function buildGraph(agents: AgentSpec[], validators: ValidatorSpec[]): WorkflowNode[] {
  const nodes: WorkflowNode[] = [];
  const finalizers = agents.filter((agent) => agent.id === "finalizer");
  const writers = agents.filter((agent) => agent.id !== "finalizer" && agent.writeAccess);
  const readers = agents.filter((agent) => agent.id !== "finalizer" && !agent.writeAccess);
  for (const agent of readers) {
    const id = `agent:${agent.id}`;
    nodes.push({ id, title: agent.name, kind: "analyze", agentId: agent.id, dependsOn: [], produces: [`${agent.id}.summary`] });
  }
  const readerIds = readers.map((agent) => `agent:${agent.id}`);
  for (const agent of writers) {
    const id = `agent:${agent.id}`;
    nodes.push({ id, title: agent.name, kind: "generate", agentId: agent.id, dependsOn: readerIds, produces: [`${agent.id}.summary`] });
  }
  const producerIds = writers.length ? writers.map((agent) => `agent:${agent.id}`) : readerIds;
  const validatorIds: string[] = [];
  for (const validator of validators) {
    const id = `validator:${validator.id}`;
    validatorIds.push(id);
    nodes.push({ id, title: validator.name, kind: "validate", validatorId: validator.id, dependsOn: producerIds });
  }
  for (const agent of finalizers) {
    const id = `agent:${agent.id}`;
    nodes.push({ id, title: agent.name, kind: "finalize", agentId: agent.id, dependsOn: validatorIds.length ? validatorIds : producerIds, produces: [`${agent.id}.summary`] });
  }
  return nodes;
}

function defaultPermissions(): PermissionSpec {
  return {
    defaultWriteAccess: false,
    destructiveWritesRequireApproval: true,
    sourceOfTruthWritesRequireApproval: true,
    externalSideEffectsRequireApproval: true,
  };
}

function buildCheckpoints(mode: string, contracts: ArtifactContract[]): CheckpointSpec[] {
  const checkpoints: CheckpointSpec[] = [
    { id: "destructive-write-approval", reason: "Destructive writes require explicit approval.", required: true },
    { id: "source-of-truth-write-approval", reason: "Source-of-truth updates are suggestions only unless approved.", required: true },
  ];
  if (mode === "deep" || mode === "tournament" || contracts.some((contract) => contract.humanReviewRequired)) {
    checkpoints.push({ id: "taste-review", reason: "Deep/tournament outputs may be taste-sensitive.", required: true, beforeNodeId: "agent:finalizer" });
  }
  return checkpoints;
}

function buildCognitiveStrategy(request: HarnessRequest) {
  const reasoningEffort = request.reasoningEffort ?? "normal";
  const originalityRequired = Boolean(request.originalityRequired || reasoningEffort === "original");
  const hypothesisCount = request.hypothesisCount ?? (originalityRequired ? 5 : reasoningEffort === "hard" ? 3 : 0);
  return {
    reasoningEffort,
    originalityRequired,
    hypothesisCount,
    outOfDistributionExploration: Boolean(request.outOfDistributionExploration || originalityRequired),
    validationPlan:
      hypothesisCount > 0
        ? [
            "Record competing hypotheses before artifact generation.",
            "Tie each hypothesis to source evidence or a validation check.",
            "Reject candidates that fail source conformance, safety, or artifact validators.",
          ]
        : ["Run normal artifact validators."],
    stopWhen:
      hypothesisCount > 0
        ? ["hypotheses are recorded", "validation plan exists", "best supported candidate is selected"]
        : ["artifact validators complete"],
  };
}
