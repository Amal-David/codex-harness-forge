import { pathToFileURL } from "node:url";
import type { HarnessRequest, HarnessSpec, SystemProfile, ValidationResult } from "../types.js";
import { resolveTrustedModulePath } from "../utils/package-paths.js";
import type { ResolvedExecutorBinding } from "./executor-registry.js";

export interface ArtifactExecutorContext {
  spec: HarnessSpec;
  request: HarnessRequest;
  profiles: SystemProfile[];
  outputDir: string;
}

export interface ValidatorExecutorContext {
  spec: HarnessSpec;
  request: HarnessRequest;
  outputDir: string;
}

export async function runArtifactExecutor(executor: ResolvedExecutorBinding, context: ArtifactExecutorContext): Promise<string[]> {
  return runLocalModuleExecutor<string[]>(executor, context, "artifact");
}

export async function runValidatorExecutor(executor: ResolvedExecutorBinding, context: ValidatorExecutorContext): Promise<ValidationResult[]> {
  return runLocalModuleExecutor<ValidationResult[]>(executor, context, "validator");
}

async function runLocalModuleExecutor<TResult>(executor: ResolvedExecutorBinding, context: ArtifactExecutorContext | ValidatorExecutorContext, noun: string): Promise<TResult> {
  if (executor.adapter !== "local:module") {
    throw new Error(`Executor '${executor.id}' uses unsupported adapter '${executor.adapter}'.`);
  }
  if (!executor.module || !executor.exportName) {
    throw new Error(`Executor '${executor.id}' must declare module and exportName for local:module.`);
  }
  const modulePath = await resolveTrustedModulePath(executor.module);
  const loaded = (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>;
  const runner = loaded[executor.exportName];
  if (typeof runner !== "function") {
    throw new Error(`Executor '${executor.id}' could not find ${noun} export '${executor.exportName}' in ${executor.module}.`);
  }
  return (await runner(context)) as TResult;
}
