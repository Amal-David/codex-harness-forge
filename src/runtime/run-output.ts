import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { pathsOverlap } from "../utils/package-paths.js";

interface RunOutputPreparationInput {
  outputDir: string;
  sourcePaths: string[];
  workspaceRoot?: string;
}

export function outputIsolationIssues({
  outputDir,
  sourcePaths,
  workspaceRoot = process.cwd(),
}: RunOutputPreparationInput): string[] {
  const resolvedOutput = path.resolve(outputDir);
  const issues: string[] = [];
  if (resolvedOutput === path.resolve(workspaceRoot)) {
    issues.push(`Output directory '${resolvedOutput}' is the workspace root.`);
  }
  for (const sourcePath of sourcePaths) {
    const resolvedSource = path.resolve(sourcePath);
    if (pathsOverlap(resolvedOutput, resolvedSource)) {
      issues.push(`Output directory '${resolvedOutput}' and source path '${resolvedSource}' overlap.`);
    }
  }
  return issues;
}

export function assertRunOutputIsolated(input: RunOutputPreparationInput): void {
  const issues = outputIsolationIssues(input);
  if (issues.length) {
    throw new Error(`Run output isolation failed: ${issues.join(" ")}`);
  }
}

export async function prepareRunOutputDirectory(input: RunOutputPreparationInput): Promise<string[]> {
  assertRunOutputIsolated(input);
  const outputDir = path.resolve(input.outputDir);
  let removedEntries: string[] = [];
  try {
    removedEntries = await readdir(outputDir);
  } catch {
    removedEntries = [];
  }
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  return removedEntries.sort();
}
