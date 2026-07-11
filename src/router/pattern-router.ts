import type { EvidenceGraph, HarnessArchetype, HarnessMode, HarnessRequest, RouteComposition, RouteDecision, RoutePackMatch, SystemProfileType } from "../types.js";
import { loadCapabilityPacks, selectCapabilityPacks, type CapabilityPackManifest } from "../registry/capability-packs.js";

const MODE_VALUES: HarnessMode[] = ["quick", "standard", "deep", "tournament", "automation"];

export function normalizeMode(value: string | undefined): HarnessMode | undefined {
  if (!value) {
    return undefined;
  }
  return MODE_VALUES.includes(value as HarnessMode) ? (value as HarnessMode) : undefined;
}

interface RouteRequestContext {
  evidenceGraph?: EvidenceGraph;
  packs?: CapabilityPackManifest[];
}

export function routeRequest(request: HarnessRequest, context: RouteRequestContext = {}): RouteDecision {
  const text = `${request.harness ?? ""} ${request.intent} ${request.sources.join(" ")}`.toLowerCase();
  const packs = context.packs ?? loadCapabilityPacks();
  const matchedPackDetails = context.evidenceGraph
    ? ensureRoutedSelection(selectCapabilityPacks({ request, evidenceGraph: context.evidenceGraph, packs }), packs).map((pack) => describeSelectedPack(pack, request, text, context.evidenceGraph as EvidenceGraph))
    : filterGenericWhenSpecific(packs.filter((pack) => pack.route).map((pack) => matchPack(pack, request, text)).filter((match): match is RoutePackMatch & { manifest: CapabilityPackManifest } => Boolean(match)));
  const matchedPacks = matchedPackDetails.map((match) => match.manifest);
  const routeSource = routeFromPacks(matchedPacks);
  let archetype = routeSource.archetype;
  let systemTypes = routeSource.systemTypes;
  let requiredAgents = routeSource.requiredAgents;
  let requiredValidators = routeSource.requiredValidators;

  if (request.reasoningEffort === "hard" || request.reasoningEffort === "original" || request.originalityRequired || hasAny(text, ["think really hard", "think hard", "original", "hypothesis", "out-of-distribution", "research"])) {
    requiredAgents = unique(["hypothesis-generator", "research-critic", ...requiredAgents, "validation-strategist"]);
    requiredValidators = unique([...requiredValidators, "hypotheses_recorded", "originality_rationale_present", "hypothesis_validation_plan_present"]);
  }

  const mode = request.mode ?? routeSource.defaultMode ?? inferMode(text, archetype);
  const composition = buildComposition(archetype, systemTypes, matchedPackDetails);
  return {
    archetype,
    mode,
    systemTypes,
    requiredAgents,
    requiredValidators,
    selectedCapabilityPackIds: matchedPacks.map((pack) => pack.id),
    composition,
    reason: matchedPacks.length
      ? `Matched ${archetype} from capability pack(s) '${matchedPacks.map((pack) => pack.id).join(", ")}' in ${mode} mode.`
      : `Matched ${archetype} from generic fallback route in ${mode} mode.`,
  };
}

function ensureRoutedSelection(selected: CapabilityPackManifest[], packs: CapabilityPackManifest[]): CapabilityPackManifest[] {
  if (selected.some((pack) => pack.route)) {
    return selected;
  }
  const fallback = packs.find((pack) => pack.id === "generic-report");
  return fallback ? [...selected, fallback] : selected;
}

function describeSelectedPack(
  pack: CapabilityPackManifest,
  request: HarnessRequest,
  text: string,
  evidenceGraph: EvidenceGraph,
): RoutePackMatch & { manifest: CapabilityPackManifest } {
  const direct = matchPack(pack, request, text);
  const matchedBy = [...(direct?.matchedBy ?? [])];
  const tags = new Set(evidenceGraph.facts.flatMap((fact) => fact.tags ?? []));
  for (const tag of pack.match?.anyTags ?? []) {
    if (tags.has(tag) && !matchedBy.some((match) => match.type === "evidence-tag" && match.value === tag)) {
      matchedBy.push({ type: "evidence-tag", value: tag });
    }
  }
  if (pack.required) {
    matchedBy.push({ type: "required", value: "required-pack" });
  }
  return {
    manifest: pack,
    packId: pack.id,
    name: pack.name,
    archetype: pack.route?.archetype,
    score: scoreMatch(matchedBy),
    selected: true,
    matchedBy,
    reason: `${pack.id} selected by ${matchedBy.map((match) => `${match.type}:${match.value}`).join(", ") || "fallback"}.`,
  };
}

function matchPack(pack: CapabilityPackManifest, request: HarnessRequest, text: string): (RoutePackMatch & { manifest: CapabilityPackManifest }) | undefined {
  const matchedBy: RoutePackMatch["matchedBy"] = [];
  for (const term of pack.match?.anyTerms ?? []) {
    if (text.includes(term.toLowerCase())) {
      matchedBy.push({ type: "term", value: term });
    }
  }
  for (const extension of pack.match?.sourceExtensions ?? []) {
    if (request.sources.some((source) => source.toLowerCase().endsWith(extension.toLowerCase()))) {
      matchedBy.push({ type: "source-extension", value: extension });
    }
  }
  if (!matchedBy.length) {
    return undefined;
  }
  const score = scoreMatch(matchedBy);
  return {
    manifest: pack,
    packId: pack.id,
    name: pack.name,
    archetype: pack.route?.archetype,
    score,
    selected: true,
    matchedBy,
    reason: `${pack.id} matched ${matchedBy.map((match) => `${match.type}:${match.value}`).join(", ")}.`,
  };
}

function scoreMatch(matchedBy: RoutePackMatch["matchedBy"]): number {
  const termMatches = matchedBy.filter((match) => match.type === "term").length;
  const extensionMatches = matchedBy.filter((match) => match.type === "source-extension").length;
  const evidenceMatches = matchedBy.filter((match) => match.type === "evidence-tag").length;
  const requiredMatches = matchedBy.filter((match) => match.type === "required").length;
  return Math.min(1, 0.45 + termMatches * 0.15 + extensionMatches * 0.25 + evidenceMatches * 0.1 + requiredMatches * 0.55);
}

function buildComposition(archetype: HarnessArchetype, systemTypes: SystemProfileType[], matchedPackDetails: Array<RoutePackMatch & { manifest: CapabilityPackManifest }>): RouteComposition {
  const matchedPacks = matchedPackDetails.map(({ manifest, ...match }) => match);
  const routedMatches = matchedPacks.filter((match) => match.archetype);
  const archetypes = new Set(routedMatches.map((match) => match.archetype).filter(Boolean));
  return {
    primaryArchetype: archetype,
    primaryPackId: routedMatches[0]?.packId,
    composite: routedMatches.length > 1 || archetypes.size > 1,
    matchedPacks,
    systemTypes,
    conflictWarnings: [],
  };
}

function routeFromPacks(packs: CapabilityPackManifest[]): {
  archetype: HarnessArchetype;
  systemTypes: SystemProfileType[];
  requiredAgents: string[];
  requiredValidators: string[];
  defaultMode?: HarnessMode;
} {
  const routedPacks = packs.filter((pack) => pack.route);
  if (routedPacks.length === 0) {
    return {
      archetype: "feature-harness",
      systemTypes: ["codebase"],
      requiredAgents: ["source-auditor", "implementation-agent", "finalizer"],
      requiredValidators: ["trace_complete"],
    };
  }
  const primary = routedPacks[0].route;
  return {
    archetype: primary?.archetype ?? "feature-harness",
    systemTypes: unique(routedPacks.flatMap((pack) => pack.route?.systemTypes ?? [])),
    requiredAgents: unique(routedPacks.flatMap((pack) => pack.route?.requiredAgents ?? agentIdsFromPack(pack))),
    requiredValidators: unique(routedPacks.flatMap((pack) => pack.route?.requiredValidators ?? validatorIdsFromPack(pack))),
    defaultMode: primary?.defaultMode,
  };
}

function filterGenericWhenSpecific<T extends { packId: string }>(packs: T[]): T[] {
  const hasSpecificPack = packs.some((pack) => pack.packId !== "generic-report");
  return hasSpecificPack ? packs.filter((pack) => pack.packId !== "generic-report") : packs;
}

function agentIdsFromPack(pack: CapabilityPackManifest): string[] {
  return (pack.nodes ?? []).map((node) => node.agentId).filter((agentId): agentId is string => Boolean(agentId));
}

function validatorIdsFromPack(pack: CapabilityPackManifest): string[] {
  return unique([...(pack.artifacts ?? []).flatMap((artifact) => artifact.validators), ...(pack.executors ?? []).flatMap((executor) => executor.validatorIds ?? [])]);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function inferMode(text: string, archetype: HarnessArchetype): HarnessMode {
  for (const mode of MODE_VALUES) {
    if (text.includes(mode)) {
      return mode;
    }
  }
  if (text.includes("multiple") || text.includes("candidate") || text.includes("ranked")) {
    return "tournament";
  }
  if (archetype === "repair-harness" || archetype === "system-harness") {
    return "standard";
  }
  return "quick";
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}
