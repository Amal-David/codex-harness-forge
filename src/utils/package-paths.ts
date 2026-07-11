import { realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function packagePath(...segments: string[]): string {
  return path.join(PACKAGE_ROOT, ...segments);
}

export function isSameOrInside(candidate: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export function pathsOverlap(left: string, right: string): boolean {
  return isSameOrInside(left, right) || isSameOrInside(right, left);
}

export async function resolveTrustedModulePath(moduleSpecifier: string): Promise<string> {
  const configuredRoots = (process.env.HARNESS_TRUSTED_MODULE_ROOTS ?? "")
    .split(path.delimiter)
    .map((root) => root.trim())
    .filter(Boolean)
    .map((root) => path.resolve(root));
  const trustedRoots = [PACKAGE_ROOT, ...configuredRoots];
  const candidate = path.isAbsolute(moduleSpecifier) ? path.resolve(moduleSpecifier) : path.resolve(PACKAGE_ROOT, moduleSpecifier);
  let resolvedCandidate: string;
  try {
    resolvedCandidate = await realpath(candidate);
  } catch {
    throw new Error(`Local module '${moduleSpecifier}' does not exist at ${candidate}.`);
  }
  const resolvedRoots = await Promise.all(
    trustedRoots.map(async (root) => {
      try {
        return await realpath(root);
      } catch {
        return root;
      }
    }),
  );
  if (!resolvedRoots.some((root) => isSameOrInside(resolvedCandidate, root))) {
    throw new Error(`Local module '${moduleSpecifier}' resolves outside trusted root(s): ${resolvedRoots.join(", ")}.`);
  }
  return resolvedCandidate;
}
