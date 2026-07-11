import type { HarnessSpec } from "../types.js";
import { loadCapabilityPacks, type CapabilityPackExecutor, type CapabilityPackExecutorKind, type CapabilityPackManifest } from "../registry/capability-packs.js";

export interface ResolvedExecutorBinding extends CapabilityPackExecutor {
  packId: string;
  matchedCapabilityIds: string[];
}

export function resolveExecutorBindings(spec: HarnessSpec, kind: CapabilityPackExecutorKind, packs: CapabilityPackManifest[] = loadCapabilityPacks()): ResolvedExecutorBinding[] {
  const activeCapabilityIds = new Set(spec.graph.map((node) => node.capabilityId).filter((capabilityId): capabilityId is string => Boolean(capabilityId)));
  return resolveExecutorBindingsForCapabilityIds(activeCapabilityIds, kind, packs);
}

export function resolveExecutorBindingsForCapabilityIds(
  activeCapabilityIds: Iterable<string>,
  kind: CapabilityPackExecutorKind,
  packs: CapabilityPackManifest[] = loadCapabilityPacks(),
): ResolvedExecutorBinding[] {
  const active = new Set(activeCapabilityIds);
  const bindings: ResolvedExecutorBinding[] = [];
  for (const pack of packs) {
    for (const executor of pack.executors ?? []) {
      if (executor.kind !== kind) {
        continue;
      }
      const matchedCapabilityIds = executor.capabilityIds.filter((capabilityId) => active.has(capabilityId));
      if (matchedCapabilityIds.length) {
        bindings.push({ ...executor, packId: pack.id, matchedCapabilityIds });
      }
    }
  }
  return bindings;
}

export function resolveExecutorForCapability(
  spec: HarnessSpec,
  kind: CapabilityPackExecutorKind,
  capabilityId: string | undefined,
  packs?: CapabilityPackManifest[],
): ResolvedExecutorBinding | undefined {
  return resolveExecutorForCapabilityId(capabilityId, kind, packs);
}

export function resolveExecutorForCapabilityId(
  capabilityId: string | undefined,
  kind: CapabilityPackExecutorKind,
  packs?: CapabilityPackManifest[],
): ResolvedExecutorBinding | undefined {
  if (!capabilityId) {
    return undefined;
  }
  return resolveExecutorBindingsForCapabilityIds([capabilityId], kind, packs).find((executor) => executor.capabilityIds.includes(capabilityId));
}

export function uniqueExecutorBindings(bindings: ResolvedExecutorBinding[]): ResolvedExecutorBinding[] {
  const byId = new Map<string, ResolvedExecutorBinding>();
  for (const binding of bindings) {
    const key = `${binding.packId}:${binding.id}`;
    if (!byId.has(key)) {
      byId.set(key, binding);
    }
  }
  return [...byId.values()];
}
