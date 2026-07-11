import { pathToFileURL } from "node:url";
import type { CouncilReview, CouncilReviewFinding, CriticReview, HarnessRequest, HarnessSpec, RuntimeAgentGroup, ValidationResult, WorkflowNode } from "../types.js";
import { resolveTrustedModulePath } from "../utils/package-paths.js";
import type { ResolvedWorkerBinding } from "./worker-registry.js";

export interface WorkerExecutorContext {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  request: HarnessRequest;
  group: RuntimeAgentGroup;
  node: WorkflowNode;
  validations?: ValidationResult[];
  review?: CouncilReview;
}

export interface WorkerExecutorOutcome {
  summary: string;
  findings: CouncilReviewFinding[];
  courseCorrections: string[];
  criticReview?: CriticReview;
}

export async function runWorkerExecutor(binding: ResolvedWorkerBinding, context: WorkerExecutorContext): Promise<WorkerExecutorOutcome> {
  if (binding.adapter === "local:module") {
    return runLocalModuleWorker(binding, context);
  }
  if (binding.adapter === "local:deterministic-agent") {
    throw new Error(`Worker binding '${binding.id}' uses legacy adapter 'local:deterministic-agent'. Add a local:module worker executor binding.`);
  }
  throw new Error(`Worker binding '${binding.id}' uses unsupported adapter '${binding.adapter}'.`);
}

async function runLocalModuleWorker(binding: ResolvedWorkerBinding, context: WorkerExecutorContext): Promise<WorkerExecutorOutcome> {
  if (!binding.module || !binding.exportName) {
    throw new Error(`Worker binding '${binding.id}' must declare module and exportName for local:module.`);
  }
  const modulePath = await resolveTrustedModulePath(binding.module);
  const loaded = (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>;
  const runner = loaded[binding.exportName];
  if (typeof runner !== "function") {
    throw new Error(`Worker binding '${binding.id}' could not find worker export '${binding.exportName}' in ${binding.module}.`);
  }
  return (await runner(context)) as WorkerExecutorOutcome;
}
