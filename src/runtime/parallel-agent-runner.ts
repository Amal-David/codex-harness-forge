import path from "node:path";
import type {
  CouncilReview,
  HarnessRequest,
  HarnessSpec,
  RuntimeAgentGroup,
  RuntimeAgentRun,
  TraceEvent,
  ValidationResult,
  WorkflowNode,
} from "../types.js";
import { slugify, stableId, writeJson, writeText } from "../utils/fs.js";
import { traceEvent } from "./trace-ledger.js";
import { resolveWorkerBindings, workerAgentIdsForGroup, type ResolvedWorkerBinding } from "./worker-registry.js";
import { runWorkerExecutor, type WorkerExecutorOutcome } from "./worker-runner.js";

interface ParallelAgentContext {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  request: HarnessRequest;
  validations?: ValidationResult[];
}

interface ParallelAgentGroupResult {
  runs: RuntimeAgentRun[];
  artifacts: string[];
  events: TraceEvent[];
}

export async function runRuntimePlanningAgents(context: ParallelAgentContext): Promise<ParallelAgentGroupResult> {
  return runParallelAgentGroup(context, "runtime-planning");
}

export async function runDomainPlanningAgents(context: ParallelAgentContext, completedNodeIds: Set<string>): Promise<ParallelAgentGroupResult> {
  return runTopologicalAgentGroup(context, "domain-planning", completedNodeIds);
}

export async function runCouncilElderAgents(context: ParallelAgentContext): Promise<ParallelAgentGroupResult> {
  return runParallelAgentGroup(context, "council-elders");
}

export async function runCourseCorrectionAgent(context: ParallelAgentContext, review: CouncilReview): Promise<ParallelAgentGroupResult> {
  const bindings = resolveWorkerBindings(context.spec, "course-correction");
  const agentIds = workerAgentIdsForGroup(context.spec, "course-correction");
  const node = context.spec.graph.find((item) => item.agentId && agentIds.has(item.agentId));
  if (!node) {
    return { runs: [], artifacts: [], events: [] };
  }
  const events = [
    traceEvent({ runId: context.runId, type: "parallel_group.started", nodeId: node.id, capabilityId: node.capabilityId, message: "Started course-correction agent group." }),
    traceEvent({ runId: context.runId, type: "agent.started", nodeId: node.id, capabilityId: node.capabilityId, message: `Started agent '${node.agentId}'.` }),
  ];
  const binding = bindingForNode(node, bindings);
  const outcome = await runWorkerExecutor(binding, { ...context, group: "course-correction", node, review });
  const run = await writeAgentRun(context, "course-correction", node, outcome, binding);
  events.push(
    traceEvent({ runId: context.runId, type: "agent.completed", nodeId: node.id, capabilityId: node.capabilityId, status: run.status, message: run.summary, evidence: run.artifacts }),
    traceEvent({ runId: context.runId, type: "parallel_group.completed", nodeId: node.id, capabilityId: node.capabilityId, status: "completed", message: "Completed course-correction agent group.", evidence: run.artifacts }),
  );
  const manifestArtifacts = await writeGroupManifest(context.outputDir, context.runId, "course-correction", [run], bindings);
  return { runs: [run], artifacts: [...run.artifacts, ...manifestArtifacts], events };
}

export async function runFinalizationAgents(context: ParallelAgentContext, completedNodeIds: Set<string>): Promise<ParallelAgentGroupResult> {
  return runTopologicalAgentGroup(context, "finalization", completedNodeIds);
}

async function runTopologicalAgentGroup(
  context: ParallelAgentContext,
  group: "domain-planning" | "finalization",
  completedNodeIds: Set<string>,
): Promise<ParallelAgentGroupResult> {
  const bindings = resolveWorkerBindings(context.spec, group);
  const agentIds = workerAgentIdsForGroup(context.spec, group);
  const pending = new Map(context.spec.graph.filter((node) => node.agentId && agentIds.has(node.agentId)).map((node) => [node.id, node]));
  if (!pending.size) {
    return { runs: [], artifacts: [], events: [] };
  }
  const events: TraceEvent[] = [
    traceEvent({ runId: context.runId, type: "parallel_group.started", message: `Started ${group} with dependency-aware local workers.` }),
  ];
  const runs: RuntimeAgentRun[] = [];
  const satisfied = new Set(completedNodeIds);
  while (pending.size) {
    const ready = [...pending.values()].filter((node) => (node.dependsOn ?? []).every((dependency) => satisfied.has(dependency)));
    if (!ready.length) {
      const blocked = [...pending.values()].map((node) => `${node.id} <- ${(node.dependsOn ?? []).filter((dependency) => !satisfied.has(dependency)).join(", ") || "unknown"}`);
      throw new Error(`Cannot execute ${group}; unmet required dependencies: ${blocked.join("; ")}.`);
    }
    events.push(
      ...ready.map((node) =>
        traceEvent({ runId: context.runId, type: "agent.started", nodeId: node.id, capabilityId: node.capabilityId, message: `Started agent '${node.agentId}'.` }),
      ),
    );
    const wave = await Promise.all(
      ready.map(async (node) => {
        const binding = bindingForNode(node, bindings);
        const outcome = await runWorkerExecutor(binding, { ...context, group, node });
        return writeAgentRun(context, group, node, outcome, binding);
      }),
    );
    runs.push(...wave);
    for (const run of wave) {
      pending.delete(run.nodeId);
      satisfied.add(run.nodeId);
      completedNodeIds.add(run.nodeId);
      events.push(
        traceEvent({
          runId: context.runId,
          type: "agent.completed",
          nodeId: run.nodeId,
          status: run.status,
          message: run.summary,
          evidence: run.artifacts,
        }),
      );
    }
  }
  const manifestArtifacts = await writeGroupManifest(context.outputDir, context.runId, group, runs, bindings);
  events.push(
    traceEvent({
      runId: context.runId,
      type: "parallel_group.completed",
      status: "completed",
      message: `Completed ${group} with ${runs.length} dependency-ordered local worker(s).`,
      evidence: [...manifestArtifacts, ...runs.flatMap((run) => run.artifacts)],
    }),
  );
  return { runs, artifacts: [...manifestArtifacts, ...runs.flatMap((run) => run.artifacts)], events };
}

async function runParallelAgentGroup(context: ParallelAgentContext, group: RuntimeAgentGroup): Promise<ParallelAgentGroupResult> {
  const bindings = resolveWorkerBindings(context.spec, group);
  const agentIds = workerAgentIdsForGroup(context.spec, group);
  const nodes = context.spec.graph.filter((node) => node.agentId && agentIds.has(node.agentId));
  if (nodes.length === 0) {
    return { runs: [], artifacts: [], events: [] };
  }
  const events: TraceEvent[] = [
    traceEvent({ runId: context.runId, type: "parallel_group.started", message: `Started ${group} with ${nodes.length} local subagent(s).` }),
  ];
  events.push(
    ...nodes.map((node) =>
      traceEvent({ runId: context.runId, type: "agent.started", nodeId: node.id, capabilityId: node.capabilityId, message: `Started agent '${node.agentId}'.` }),
    ),
  );
  const runs = await Promise.all(
    nodes.map(async (node) => {
      const binding = bindingForNode(node, bindings);
      const outcome = await runWorkerExecutor(binding, { ...context, group, node });
      return writeAgentRun(context, group, node, outcome, binding);
    }),
  );
  events.push(
    ...runs.map((run) =>
      traceEvent({
        runId: context.runId,
        type: "agent.completed",
        nodeId: run.nodeId,
        status: run.status,
        message: run.summary,
        evidence: run.artifacts,
      }),
    ),
  );
  const manifestArtifacts = await writeGroupManifest(context.outputDir, context.runId, group, runs, bindings);
  events.push(
    traceEvent({
      runId: context.runId,
      type: "parallel_group.completed",
      status: "completed",
      message: `Completed ${group} with ${runs.length} local subagent(s).`,
      evidence: [...manifestArtifacts, ...runs.flatMap((run) => run.artifacts)],
    }),
  );
  return { runs, artifacts: [...manifestArtifacts, ...runs.flatMap((run) => run.artifacts)], events };
}

async function writeAgentRun(
  context: ParallelAgentContext,
  group: RuntimeAgentGroup,
  node: WorkflowNode,
  outcome: WorkerExecutorOutcome,
  binding: ResolvedWorkerBinding,
): Promise<RuntimeAgentRun> {
  const startedAt = new Date().toISOString();
  const artifactBase = artifactBaseName(node);
  const jsonArtifact = path.join("agent-runs", `${artifactBase}.json`);
  const markdownArtifact = path.join("agent-runs", `${artifactBase}.md`);
  const run: RuntimeAgentRun = {
    id: stableId("agent-run", `${context.runId}:${node.id}:${node.agentId}`),
    runId: context.runId,
    group,
    nodeId: node.id,
    agentId: node.agentId ?? "unknown-agent",
    status: "completed",
    startedAt,
    completedAt: new Date().toISOString(),
    summary: outcome.summary,
    artifacts: [jsonArtifact, markdownArtifact],
    inputs: node.dependsOn ?? [],
    evidence: node.evidenceRequired ?? [],
    findings: outcome.findings,
    courseCorrections: outcome.courseCorrections,
    criticReview: outcome.criticReview,
    references: binding.references ?? [],
  };
  await writeJson(path.join(context.outputDir, jsonArtifact), run);
  await writeText(path.join(context.outputDir, markdownArtifact), renderAgentRun(run));
  return run;
}

async function writeGroupManifest(outputDir: string, runId: string, group: RuntimeAgentGroup, runs: RuntimeAgentRun[], bindings: ResolvedWorkerBinding[]): Promise<string[]> {
  const artifact = path.join("agent-runs", `${group}-manifest.json`);
  const hostArtifacts = group === "council-elders" ? await writeCodexHostCriticRequest(outputDir, runId, runs, bindings) : [];
  await writeJson(path.join(outputDir, artifact), {
    runId,
    group,
    executionModel: bindings[0]?.executionModel ?? "parallel-promise-all",
    criticContract:
      group === "council-elders"
        ? {
            requiredOutput: "criticReview",
            localAdapter: "local:module",
            hostAdapter: "codex:host",
            promptArtifacts: hostArtifacts,
          }
        : undefined,
    workerBindings: bindings.map((binding) => ({
      id: binding.id,
      packId: binding.packId,
      contractId: binding.contract.id,
      functionId: binding.contract.functionId,
      triggerId: binding.contract.triggerId,
      contractVersion: binding.contract.version,
      stateNamespace: binding.contract.stateNamespace,
      eventTopics: binding.contract.eventTopics,
      adapterTypes: binding.contract.adapterTypes,
      replacementCompatibilityKey: binding.contract.replacement.compatibilityKey,
      adapter: binding.adapter,
      module: binding.module,
      exportName: binding.exportName,
      agentIds: binding.agentIds,
      matchedAgentIds: binding.matchedAgentIds,
      capabilityIds: binding.capabilityIds,
      matchedCapabilityIds: binding.matchedCapabilityIds,
      references: binding.references ?? [],
    })),
    startedAgentCount: runs.length,
    agentRunIds: runs.map((run) => run.id),
    nodeIds: runs.map((run) => run.nodeId),
    agentIds: runs.map((run) => run.agentId),
    artifacts: [...hostArtifacts, ...runs.flatMap((run) => run.artifacts)],
  });
  return [artifact, ...hostArtifacts];
}

async function writeCodexHostCriticRequest(outputDir: string, runId: string, runs: RuntimeAgentRun[], bindings: ResolvedWorkerBinding[]): Promise<string[]> {
  const jsonArtifact = path.join("agent-runs", "codex-host-critic-request.json");
  const markdownArtifact = path.join("agent-runs", "codex-host-critic-request.md");
  const request = {
    runId,
    adapter: "codex:host",
    fallbackAdapter: "local:module",
    group: "council-elders",
    contractIds: bindings.map((binding) => binding.contract.id),
    functionIds: bindings.map((binding) => binding.contract.functionId),
    triggerIds: bindings.map((binding) => binding.contract.triggerId),
    agentIds: runs.map((run) => run.agentId),
    nodeIds: runs.map((run) => run.nodeId),
    requiredOutput: {
      criticReview: {
        criticId: "string",
        summary: "string",
        questions: [
          {
            id: "string",
            criticId: "string",
            category: "string",
            severity: "blocker | major | minor | note",
            question: "string",
            whyItMatters: "string",
            evidence: ["string"],
            answerRequired: "boolean",
            suggestedAssumption: "string",
            resolution: "unresolved | assumed | answered | not-required",
          },
        ],
        missingEvidence: ["string"],
        unsafeAssumptions: ["string"],
        domainRisks: ["string"],
        mustAnswerBeforeFinalize: ["question id"],
        confidenceScore: "number 0..1",
      },
    },
    instructions: [
      "Act as the Codex-hosted critic for the council elder agents.",
      "Generate questions that expose missing requirements, weak assumptions, missing evidence, and blocker gates.",
      "Use blocker severity only when final success claims would be unsafe without an answer.",
      "Do not call external model APIs from the Node CLI; this artifact is consumed by the host.",
    ],
  };
  await writeJson(path.join(outputDir, jsonArtifact), request);
  await writeText(path.join(outputDir, markdownArtifact), renderCodexHostCriticRequest(request));
  return [jsonArtifact, markdownArtifact];
}

function bindingForNode(node: WorkflowNode, bindings: ResolvedWorkerBinding[]): ResolvedWorkerBinding {
  const binding = bindings.find(
    (item) =>
      (node.agentId && item.matchedAgentIds.includes(node.agentId)) ||
      (node.capabilityId && item.matchedCapabilityIds.includes(node.capabilityId)),
  );
  if (!binding) {
    throw new Error(`No worker binding matched node '${node.id}'.`);
  }
  return binding;
}

function artifactBaseName(node: WorkflowNode): string {
  return `${slugify(node.id)}__${slugify(node.agentId ?? "agent")}`;
}

function renderAgentRun(run: RuntimeAgentRun): string {
  const findings = run.findings.length
    ? run.findings.map((finding) => `- [${finding.severity}] ${finding.finding}\n  Correction: ${finding.courseCorrection}`).join("\n")
    : "- No findings.";
  const criticQuestions = run.criticReview?.questions.length
    ? run.criticReview.questions
        .map((question) =>
          [
            `- [${question.severity}] ${question.category}: ${question.question}`,
            `  Why: ${question.whyItMatters}`,
            `  Answer required: ${question.answerRequired ? "yes" : "no"}; resolution: ${question.resolution}`,
            `  Evidence: ${question.evidence.join(", ")}`,
          ].join("\n"),
        )
        .join("\n")
    : "- No critic questions.";
  return [
    `# ${run.agentId}`,
    "",
    `Group: ${run.group}`,
    `Node: ${run.nodeId}`,
    `Status: ${run.status}`,
    "",
    "## Summary",
    "",
    run.summary,
    "",
    "## Findings",
    "",
    findings,
    "",
    "## Critic Questions",
    "",
    criticQuestions,
    "",
  ].join("\n");
}

function renderCodexHostCriticRequest(request: Record<string, unknown>): string {
  return [
    "# Codex Host Critic Request",
    "",
    `Run: ${request.runId}`,
    `Group: ${request.group}`,
    `Adapter: ${request.adapter}`,
    `Fallback: ${request.fallbackAdapter}`,
    "",
    "## Contract",
    "",
    "- Return one `criticReview` object for each council elder.",
    "- Include structured `questions`, `missingEvidence`, `unsafeAssumptions`, `domainRisks`, `mustAnswerBeforeFinalize`, and `confidenceScore`.",
    "- Unresolved blocker questions must remain unresolved until answered or explicitly assumed.",
    "",
    "## Agents",
    "",
    ...((request.agentIds as string[]) ?? []).map((agentId) => `- ${agentId}`),
    "",
  ].join("\n");
}
