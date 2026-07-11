import path from "node:path";
import type { HarnessSpec, HarnessTrace, RuntimeAgentRun, SystemProfile, TraceEvent, ValidationResult } from "../types.js";
import { finalStatusFromValidations } from "../validators/common/validation-report.js";
import { writeJson } from "../utils/fs.js";
import { generateLearningSuggestions } from "../learning/learning-suggestions.js";

export async function writeTrace(
  outputDir: string,
  spec: HarnessSpec,
  profiles: SystemProfile[],
  validations: ValidationResult[],
  artifacts: string[],
  events: TraceEvent[] = [],
  runId = `run-${Date.now()}`,
  agentRuns: RuntimeAgentRun[] = [],
): Promise<HarnessTrace> {
  const suggestions = generateLearningSuggestions(spec, validations);
  const finalStatus = finalStatusFromValidations(validations);
  const sourceBlocked = validations.some((validation) => validation.status === "fail" && ["source_availability", "svg_source_available"].includes(validation.id));
  const agentRunsByAgent = new Map(agentRuns.map((run) => [run.agentId, run]));
  const completedNodeIds = new Set(events.filter((event) => event.type === "node.completed" && event.status === "completed" && event.nodeId).map((event) => event.nodeId as string));
  const completedAgentIds = new Set(spec.graph.filter((node) => node.agentId && completedNodeIds.has(node.id)).map((node) => node.agentId as string));
  const trace: HarnessTrace = {
    runId,
    harnessSpecId: spec.id,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    userIntent: spec.userIntent,
    selectedArchetype: spec.archetype,
    selectedMode: spec.mode,
    routeComposition: spec.routeComposition,
    sourcesLoaded: spec.sources,
    sourceConflicts: findSourceConflicts(profiles),
    agentsSpawned: spec.agents.map((agent) => ({
      agentId: agent.id,
      status: agentRunStatus(agent.id, sourceBlocked, agentRunsByAgent, completedAgentIds),
      summary: agentRunSummary(agent.id, agent.name, sourceBlocked, agentRunsByAgent, completedAgentIds),
      artifacts: agentRunsByAgent.get(agent.id)?.artifacts ?? artifacts.filter((artifact) => artifact.includes(agent.id) || artifact.includes("harness") || artifact.includes("report")),
    })),
    validations,
    artifacts: artifacts.map((artifact) => ({ id: artifact.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), type: artifactType(artifact), path: path.join(outputDir, artifact) })),
    finalStatus,
    learningSuggestions: suggestions,
    events,
  };
  await writeJson(path.join(outputDir, "harness-trace.json"), trace);
  return trace;
}

function agentRunStatus(
  agentId: string,
  sourceBlocked: boolean,
  agentRunsByAgent: Map<string, RuntimeAgentRun>,
  completedAgentIds: Set<string>,
): HarnessTrace["agentsSpawned"][number]["status"] {
  if (sourceBlocked) {
    return "blocked";
  }
  return agentRunsByAgent.has(agentId) || completedAgentIds.has(agentId) ? "completed" : "planned_not_executed";
}

function agentRunSummary(
  agentId: string,
  agentName: string,
  sourceBlocked: boolean,
  agentRunsByAgent: Map<string, RuntimeAgentRun>,
  completedAgentIds: Set<string>,
): string {
  if (sourceBlocked) {
    return `${agentName} was blocked because required source evidence was unavailable.`;
  }
  const run = agentRunsByAgent.get(agentId);
  if (run) {
    return run.summary;
  }
  if (completedAgentIds.has(agentId)) {
    return `${agentName} completed through a registered runtime executor with recorded node evidence.`;
  }
  return `${agentName} was planned in the verified DAG; the local MVP runtime did not spawn an independent subagent process.`;
}

function findSourceConflicts(profiles: SystemProfile[]) {
  return profiles.flatMap((profile) =>
    profile.freshness.notes
      .filter((note) => note.toLowerCase().includes("conflict"))
      .map((note, index) => ({ id: `${profile.id}-conflict-${index + 1}`, description: note, sourceIds: profile.sources.map((source) => source.id), resolution: "Surface to user; do not guess silently." })),
  );
}

function artifactType(artifact: string): string {
  if (artifact.endsWith(".json")) return "json";
  if (artifact.endsWith(".md")) return "markdown";
  if (artifact.endsWith(".html")) return "html-preview";
  if (artifact.endsWith(".svg")) return "svg-preview";
  return "file";
}
