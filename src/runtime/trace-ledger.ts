import path from "node:path";
import type { AgentRun, HarnessTrace, RuntimeAgentRun, TraceEvent, TraceEventType, ValidatorStatus } from "../types.js";
import { stableId, writeText } from "../utils/fs.js";

export interface TraceEventInput {
  runId: string;
  type: TraceEventType;
  nodeId?: string;
  capabilityId?: string;
  validatorId?: string;
  artifactId?: string;
  status?: ValidatorStatus | AgentRun["status"] | RuntimeAgentRun["status"] | HarnessTrace["finalStatus"];
  message: string;
  evidence?: string[];
}

export function traceEvent(input: TraceEventInput): TraceEvent {
  const timestamp = new Date().toISOString();
  return {
    id: stableId("event", `${input.runId}:${input.type}:${input.nodeId ?? ""}:${input.validatorId ?? ""}:${input.artifactId ?? ""}:${timestamp}:${input.message}`),
    timestamp,
    evidence: input.evidence ?? [],
    ...input,
  };
}

export async function writeTraceEvents(outputDir: string, events: TraceEvent[]): Promise<void> {
  const lines = events.map((event) => JSON.stringify(event)).join("\n");
  await writeText(path.join(outputDir, "events.jsonl"), `${lines}${lines ? "\n" : ""}`);
}
