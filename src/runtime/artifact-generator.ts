import path from "node:path";
import type { HarnessRequest, HarnessSpec, SystemProfile } from "../types.js";
import { ensureDir, writeJson, writeText } from "../utils/fs.js";
import { resolveExecutorForCapability, type ResolvedExecutorBinding } from "./executor-registry.js";
import { generateFinalReport } from "./artifact-executors.js";
import { runArtifactExecutor } from "./executor-runner.js";

interface ArtifactGenerationOptions {
  completedNodeIds: Set<string>;
}

export async function generateArtifacts(
  spec: HarnessSpec,
  request: HarnessRequest,
  profiles: SystemProfile[],
  outputDir: string,
  options: ArtifactGenerationOptions,
): Promise<string[]> {
  await ensureDir(outputDir);
  await writeJson(path.join(outputDir, "harness-spec.json"), spec);
  await writeJson(path.join(outputDir, "system-profiles.json"), profiles);
  if (spec.evidenceGraph) {
    await writeJson(path.join(outputDir, "evidence-graph.json"), spec.evidenceGraph);
  }
  if (spec.ir) {
    await writeJson(path.join(outputDir, "harness-ir.json"), spec.ir);
  }
  const artifacts = new Set(["harness-spec.json", "system-profiles.json"]);
  if (spec.evidenceGraph) artifacts.add("evidence-graph.json");
  if (spec.ir) artifacts.add("harness-ir.json");
  for (const artifact of await maybeWriteResearchArtifacts(spec, outputDir)) {
    artifacts.add(artifact);
  }
  const generatorNodes = spec.graph.filter((node) => node.capabilityId?.startsWith("artifact-generator:"));
  if (!generatorNodes.length) {
    for (const artifact of await generateFinalReport({ spec, outputDir })) {
      artifacts.add(artifact);
    }
    return [...artifacts];
  }
  for (const node of generatorNodes) {
    const unmetDependencies = (node.dependsOn ?? []).filter((dependency) => !options.completedNodeIds.has(dependency));
    if (unmetDependencies.length) {
      throw new Error(`Cannot execute generator '${node.id}'; unmet required dependencies: ${unmetDependencies.join(", ")}.`);
    }
    const executor = resolveExecutorForCapability(spec, "artifact-generator", node.capabilityId);
    for (const artifact of await runArtifactCapability(executor, node.capabilityId, spec, request, profiles, outputDir)) {
      artifacts.add(artifact);
    }
    options.completedNodeIds.add(node.id);
  }
  return [...artifacts];
}

async function runArtifactCapability(
  executor: ResolvedExecutorBinding | undefined,
  capabilityId: string | undefined,
  spec: HarnessSpec,
  request: HarnessRequest,
  profiles: SystemProfile[],
  outputDir: string,
): Promise<string[]> {
  if (executor) {
    return runArtifactExecutor(executor, { spec, request, profiles, outputDir });
  }
  if (capabilityId === "artifact-generator:final-report") {
    return generateFinalReport({ spec, outputDir });
  }
  throw new Error(`No artifact executor binding registered for ${capabilityId ?? "unknown artifact capability"}.`);
}

async function maybeWriteResearchArtifacts(spec: HarnessSpec, outputDir: string): Promise<string[]> {
  if (spec.cognitiveStrategy.hypothesisCount <= 0) {
    return [];
  }
  const hypotheses = Array.from({ length: spec.cognitiveStrategy.hypothesisCount }, (_, index) => ({
    id: `H-${index + 1}`,
    claim: index === 0 ? "The default source-grounded candidate is likely safest." : `Out-of-distribution candidate ${index} may improve originality if validators still pass.`,
    validation: spec.cognitiveStrategy.validationPlan,
    status: index === 0 ? "baseline" : "candidate",
  }));
  await writeJson(path.join(outputDir, "hypotheses.json"), hypotheses);
  await writeText(
    path.join(outputDir, "originality-rationale.md"),
    [
      "# Originality Rationale",
      "",
      `Reasoning effort: ${spec.cognitiveStrategy.reasoningEffort}`,
      `Originality required: ${spec.cognitiveStrategy.originalityRequired ? "yes" : "no"}`,
      `Out-of-distribution exploration: ${spec.cognitiveStrategy.outOfDistributionExploration ? "yes" : "no"}`,
      "",
      "The harness records hypotheses before final artifact selection and gates unusual candidates through the same source-conformance and artifact validators as ordinary candidates.",
    ].join("\n"),
  );
  return ["hypotheses.json", "originality-rationale.md"];
}
