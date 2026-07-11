import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PACKAGE_ROOT } from "../utils/package-paths.js";
import type {
  ArtifactContractV2,
  EvidenceGraph,
  HarnessArchetype,
  HarnessMode,
  HarnessNodeKind,
  HarnessRequest,
  NodeInputRef,
  NodeOutputContract,
  RuntimeAgentGroup,
  SystemProfileType,
  ValidatorBinding,
} from "../types.js";

export interface CapabilityPackManifest {
  id: string;
  name: string;
  description: string;
  required?: boolean;
  match?: {
    anyTags?: string[];
    anyTerms?: string[];
    sourceExtensions?: string[];
  };
  artifactIds?: string[];
  capabilityIds: string[];
  route?: CapabilityPackRoute;
  artifacts?: CapabilityPackArtifact[];
  nodes?: CapabilityPackNode[];
  edges?: CapabilityPackEdge[];
  validatorBindings?: CapabilityPackValidatorBinding[];
  terminalValidators?: string[];
  executors?: CapabilityPackExecutor[];
  workerBindings?: CapabilityPackWorkerBinding[];
}

export interface CapabilityPackRoute {
  archetype: HarnessArchetype;
  systemTypes: SystemProfileType[];
  requiredAgents?: string[];
  requiredValidators?: string[];
  defaultMode?: HarnessMode;
}

export interface CapabilityPackArtifact extends Omit<ArtifactContractV2, "requiredEvidence"> {
  requiredEvidenceTags?: string[];
}

export interface CapabilityPackNode {
  id: string;
  kind: HarnessNodeKind;
  title: string;
  capabilityId?: string;
  agentId?: string;
  validatorId?: string;
  inputs: Array<PackInputRef | "$sources" | "$selectedArtifacts" | "$validatorBindings">;
  outputs: NodeOutputContract[];
  evidenceTags?: string[];
}

export interface PackInputRef extends NodeInputRef {
  optional?: boolean;
}

export interface CapabilityPackEdge {
  from: string;
  to: string;
  reason: string;
}

export interface CapabilityPackValidatorBinding extends Omit<ValidatorBinding, "evidenceRequired"> {
  evidenceTags?: string[];
}

export type CapabilityPackExecutorKind = "artifact-generator" | "validator";

export interface CapabilityPackExecutor {
  id: string;
  kind: CapabilityPackExecutorKind;
  capabilityIds: string[];
  adapter: string;
  module?: string;
  exportName?: string;
  required?: boolean;
  produces?: string[];
  validatorIds?: string[];
}

export interface CapabilityPackWorkerBinding {
  id: string;
  contractId: string;
  group: RuntimeAgentGroup;
  adapter: string;
  module?: string;
  exportName?: string;
  agentIds: string[];
  capabilityIds: string[];
  executionModel?: string;
  required?: boolean;
  references?: string[];
}

export function loadCapabilityPacks(rootDir = PACKAGE_ROOT): CapabilityPackManifest[] {
  const packsDir = path.join(rootDir, "capability-packs");
  if (!existsSync(packsDir)) {
    return [];
  }
  return readdirSync(packsDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => validateCapabilityPack(JSON.parse(readFileSync(path.join(packsDir, file), "utf8")), file));
}

export function selectCapabilityPacks(context: { request: HarnessRequest; evidenceGraph: EvidenceGraph; packs?: CapabilityPackManifest[] }): CapabilityPackManifest[] {
  const packs = context.packs ?? loadCapabilityPacks();
  const selected = packs.filter((pack) => pack.required || matchesPack(pack, context.request, context.evidenceGraph));
  const selectedOptional = selected.filter((pack) => !pack.required);
  const hasSpecificOptionalPack = selectedOptional.some((pack) => pack.id !== "generic-report");
  const filtered = hasSpecificOptionalPack ? selected.filter((pack) => pack.required || pack.id !== "generic-report") : selected;
  return filtered.sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)) || a.id.localeCompare(b.id));
}

export function requestMatchesCapabilityPack(pack: CapabilityPackManifest, request: HarnessRequest): boolean {
  const text = `${request.harness ?? ""} ${request.intent} ${request.sources.join(" ")}`.toLowerCase();
  const anyTerms = pack.match?.anyTerms ?? [];
  if (anyTerms.some((term) => text.includes(term.toLowerCase()))) {
    return true;
  }
  const sourceExtensions = pack.match?.sourceExtensions ?? [];
  return sourceExtensions.some((extension) => request.sources.some((source) => source.toLowerCase().endsWith(extension)));
}

function matchesPack(pack: CapabilityPackManifest, request: HarnessRequest, evidenceGraph: EvidenceGraph): boolean {
  if (requestMatchesCapabilityPack(pack, request)) {
    return true;
  }
  const tags = new Set(evidenceGraph.facts.flatMap((fact) => fact.tags ?? []));
  const anyTags = pack.match?.anyTags ?? [];
  return anyTags.some((tag) => tags.has(tag));
}

export function validateCapabilityPack(value: unknown, source = "capability-pack"): CapabilityPackManifest {
  if (!isRecord(value)) {
    throw new Error(`${source} must be a JSON object.`);
  }
  const id = stringField(value, "id", source);
  stringField(value, "name", source);
  stringField(value, "description", source);
  const capabilityIds = arrayField(value, "capabilityIds", source).map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`${source}.capabilityIds[${index}] must be a string.`);
    }
    return item;
  });
  if (capabilityIds.length === 0) {
    throw new Error(`${source}.capabilityIds must not be empty.`);
  }
  if (value.route !== undefined) {
    validatePackRoute(value.route, source);
  }
  for (const node of optionalArray(value, "nodes", source)) {
    validatePackNode(node, source, capabilityIds);
  }
  for (const artifact of optionalArray(value, "artifacts", source)) {
    validatePackArtifact(artifact, source);
  }
  for (const binding of optionalArray(value, "validatorBindings", source)) {
    validatePackValidatorBinding(binding, source);
  }
  for (const executor of optionalArray(value, "executors", source)) {
    validatePackExecutor(executor, source, capabilityIds);
  }
  for (const binding of optionalArray(value, "workerBindings", source)) {
    validatePackWorkerBinding(binding, source, capabilityIds);
  }
  for (const edge of optionalArray(value, "edges", source)) {
    if (!isRecord(edge)) {
      throw new Error(`${source}.edges entries must be objects.`);
    }
    stringField(edge, "from", `${source}.edges`);
    stringField(edge, "to", `${source}.edges`);
    stringField(edge, "reason", `${source}.edges`);
  }
  return value as unknown as CapabilityPackManifest;
}

function validatePackRoute(value: unknown, source: string): void {
  if (!isRecord(value)) {
    throw new Error(`${source}.route must be an object.`);
  }
  const archetype = stringField(value, "archetype", `${source}.route`);
  if (
    ![
      "explore-harness",
      "repair-harness",
      "test-harness",
      "feature-harness",
      "migration-harness",
      "visual-harness",
      "system-harness",
      "review-harness",
      "ops-data-docs-harness",
    ].includes(archetype)
  ) {
    throw new Error(`${source}.route.archetype must be a known harness archetype.`);
  }
  const systemTypes = arrayField(value, "systemTypes", `${source}.route`);
  if (systemTypes.length === 0) {
    throw new Error(`${source}.route.systemTypes must not be empty.`);
  }
  const allowedSystemTypes = new Set([
    "motion-system",
    "design-system",
    "codebase",
    "api-system",
    "brand-system",
    "release-system",
    "security-system",
    "data-system",
    "docs-system",
    "custom-skill",
  ]);
  for (const item of systemTypes) {
    if (typeof item !== "string" || !allowedSystemTypes.has(item)) {
      throw new Error(`${source}.route.systemTypes entries must be known system profile types.`);
    }
  }
  if (value.defaultMode !== undefined && !["quick", "standard", "deep", "tournament", "automation"].includes(String(value.defaultMode))) {
    throw new Error(`${source}.route.defaultMode must be a known harness mode.`);
  }
  for (const field of ["requiredAgents", "requiredValidators"] as const) {
    for (const item of optionalArray(value, field, `${source}.route`)) {
      if (typeof item !== "string" || !item) {
        throw new Error(`${source}.route.${field} entries must be non-empty strings.`);
      }
    }
  }
}

function validatePackNode(value: unknown, source: string, capabilityIds: string[]): void {
  if (!isRecord(value)) {
    throw new Error(`${source}.nodes entries must be objects.`);
  }
  const capabilityId = typeof value.capabilityId === "string" ? value.capabilityId : undefined;
  if (capabilityId && !capabilityIds.includes(capabilityId)) {
    throw new Error(`${source}.nodes.${String(value.id)} references capability '${capabilityId}' that is not listed in capabilityIds.`);
  }
  stringField(value, "id", `${source}.nodes`);
  stringField(value, "kind", `${source}.nodes`);
  stringField(value, "title", `${source}.nodes`);
  arrayField(value, "inputs", `${source}.nodes`);
  arrayField(value, "outputs", `${source}.nodes`);
}

function validatePackArtifact(value: unknown, source: string): void {
  if (!isRecord(value)) {
    throw new Error(`${source}.artifacts entries must be objects.`);
  }
  stringField(value, "id", `${source}.artifacts`);
  stringField(value, "type", `${source}.artifacts`);
  arrayField(value, "validators", `${source}.artifacts`);
  arrayField(value, "validatorBindings", `${source}.artifacts`);
}

function validatePackValidatorBinding(value: unknown, source: string): void {
  if (!isRecord(value)) {
    throw new Error(`${source}.validatorBindings entries must be objects.`);
  }
  stringField(value, "id", `${source}.validatorBindings`);
  stringField(value, "validatorId", `${source}.validatorBindings`);
}

function validatePackExecutor(value: unknown, source: string, capabilityIds: string[]): void {
  if (!isRecord(value)) {
    throw new Error(`${source}.executors entries must be objects.`);
  }
  const executorId = stringField(value, "id", `${source}.executors`);
  const kind = stringField(value, "kind", `${source}.executors`);
  if (kind !== "artifact-generator" && kind !== "validator") {
    throw new Error(`${source}.executors.${executorId}.kind must be 'artifact-generator' or 'validator'.`);
  }
  const adapter = stringField(value, "adapter", `${source}.executors`);
  if (adapter === "local:module") {
    stringField(value, "module", `${source}.executors.${executorId}`);
    stringField(value, "exportName", `${source}.executors.${executorId}`);
  }
  const executorCapabilityIds = arrayField(value, "capabilityIds", `${source}.executors`).map((item, index) => {
    if (typeof item !== "string" || !item) {
      throw new Error(`${source}.executors.${executorId}.capabilityIds[${index}] must be a non-empty string.`);
    }
    return item;
  });
  if (executorCapabilityIds.length === 0) {
    throw new Error(`${source}.executors.${executorId}.capabilityIds must not be empty.`);
  }
  for (const capabilityId of executorCapabilityIds) {
    if (!capabilityIds.includes(capabilityId)) {
      throw new Error(`${source}.executors.${executorId} references capability '${capabilityId}' that is not listed in capabilityIds.`);
    }
  }
  for (const field of ["produces", "validatorIds"] as const) {
    for (const item of optionalArray(value, field, `${source}.executors.${executorId}`)) {
      if (typeof item !== "string" || !item) {
        throw new Error(`${source}.executors.${executorId}.${field} entries must be non-empty strings.`);
      }
    }
  }
}

function validatePackWorkerBinding(value: unknown, source: string, capabilityIds: string[]): void {
  if (!isRecord(value)) {
    throw new Error(`${source}.workerBindings entries must be objects.`);
  }
  const bindingId = stringField(value, "id", `${source}.workerBindings`);
  stringField(value, "contractId", `${source}.workerBindings.${bindingId}`);
  const group = stringField(value, "group", `${source}.workerBindings.${bindingId}`);
  if (!["runtime-planning", "council-elders", "course-correction"].includes(group)) {
    throw new Error(`${source}.workerBindings.${bindingId}.group must be a known runtime agent group.`);
  }
  const adapter = stringField(value, "adapter", `${source}.workerBindings.${bindingId}`);
  if (adapter !== "local:deterministic-agent" && adapter !== "local:module") {
    throw new Error(`${source}.workerBindings.${bindingId}.adapter must be 'local:deterministic-agent' or 'local:module'.`);
  }
  if (adapter === "local:module") {
    stringField(value, "module", `${source}.workerBindings.${bindingId}`);
    stringField(value, "exportName", `${source}.workerBindings.${bindingId}`);
  }
  const agentIds = arrayField(value, "agentIds", `${source}.workerBindings.${bindingId}`);
  if (agentIds.length === 0) {
    throw new Error(`${source}.workerBindings.${bindingId}.agentIds must not be empty.`);
  }
  for (const item of agentIds) {
    if (typeof item !== "string" || !item) {
      throw new Error(`${source}.workerBindings.${bindingId}.agentIds entries must be non-empty strings.`);
    }
  }
  if (value.executionModel !== undefined && (typeof value.executionModel !== "string" || !value.executionModel)) {
    throw new Error(`${source}.workerBindings.${bindingId}.executionModel must be a non-empty string when provided.`);
  }
  const workerCapabilityIds = arrayField(value, "capabilityIds", `${source}.workerBindings.${bindingId}`).map((item, index) => {
    if (typeof item !== "string" || !item) {
      throw new Error(`${source}.workerBindings.${bindingId}.capabilityIds[${index}] must be a non-empty string.`);
    }
    return item;
  });
  if (workerCapabilityIds.length === 0) {
    throw new Error(`${source}.workerBindings.${bindingId}.capabilityIds must not be empty.`);
  }
  for (const capabilityId of workerCapabilityIds) {
    if (!capabilityIds.includes(capabilityId)) {
      throw new Error(`${source}.workerBindings.${bindingId} references capability '${capabilityId}' that is not listed in capabilityIds.`);
    }
  }
  for (const item of optionalArray(value, "references", `${source}.workerBindings.${bindingId}`)) {
    if (typeof item !== "string" || !item) {
      throw new Error(`${source}.workerBindings.${bindingId}.references entries must be non-empty strings.`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(value: Record<string, unknown>, field: string, source: string): string {
  if (typeof value[field] !== "string" || !value[field]) {
    throw new Error(`${source}.${field} must be a non-empty string.`);
  }
  return value[field] as string;
}

function arrayField(value: Record<string, unknown>, field: string, source: string): unknown[] {
  if (!Array.isArray(value[field])) {
    throw new Error(`${source}.${field} must be an array.`);
  }
  return value[field] as unknown[];
}

function optionalArray(value: Record<string, unknown>, field: string, source: string): unknown[] {
  if (value[field] === undefined) {
    return [];
  }
  return arrayField(value, field, source);
}
