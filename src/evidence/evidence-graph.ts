import type { EvidenceGraph, SourceFact, SourceRef } from "../types.js";
import { listFiles, readText, stableId } from "../utils/fs.js";

export async function buildEvidenceGraph(sources: SourceRef[]): Promise<EvidenceGraph> {
  const facts: SourceFact[] = [];
  for (const source of sources) {
    facts.push(sourceAvailabilityFact(source));
    if (source.availability !== "available") {
      continue;
    }
    if (source.type === "file" && source.location.toLowerCase().endsWith(".svg")) {
      facts.push(...(await svgFacts(source)));
    }
    if (source.type === "directory") {
      facts.push(...(await designSystemFacts(source)));
    }
    if (source.type === "file" && /\.(md|mdx|txt)$/i.test(source.location)) {
      facts.push(...(await appRequirementFacts(source)));
    }
  }
  return {
    id: stableId("evidence", sources.map((source) => `${source.location}:${source.availability}`).join("|")),
    builtAt: new Date().toISOString(),
    sources,
    facts,
    edges: [],
  };
}

async function appRequirementFacts(source: SourceRef): Promise<SourceFact[]> {
  const text = await readText(source.location).catch(() => "");
  const lower = text.toLowerCase();
  const facts: SourceFact[] = [];
  const productSignals = countMatches(lower, ["app", "application", "prd", "product", "user", "screen", "flow", "ui", "frontend", "backend", "api", "route", "endpoint"]);
  const dataSignals = countMatches(lower, ["database", "schema", "persistence", "model"]);
  if (productSignals === 0 || productSignals + dataSignals < 2) {
    return facts;
  }
  facts.push(fact(source, "capability-hint", "Markdown requirement source supports app-building workflow synthesis.", "static", ["app-building", "prd"]));
  const uiSignals = countMatches(lower, ["screen", "flow", "user", "habit", "dashboard", "settings", "onboarding", "form"]);
  if (uiSignals > 0) {
    facts.push(fact(source, "example", `Product/UI requirement signals detected (${uiSignals} match(es)).`, "static", ["app-building", "ui-flow", "product-acceptance"]));
  }
  const apiSignals = countMatches(lower, ["api", "route", "endpoint", "request", "response", "get ", "post ", "put ", "delete "]);
  if (apiSignals > 0) {
    facts.push(fact(source, "api", `API requirement signals detected (${apiSignals} match(es)).`, "static", ["app-building", "api"]));
  }
  const persistenceSignals = countMatches(lower, ["database", "schema", "table", "model", "migration", "storage", "persistence", "persist"]);
  if (persistenceSignals > 0) {
    facts.push(fact(source, "schema", `Persistence/schema requirement signals detected (${persistenceSignals} match(es)).`, "static", ["app-building", "persistence", "schema"]));
  }
  const testSignals = countMatches(lower, ["test", "unit", "integration", "e2e", "end-to-end", "playwright", "coverage", "accessibility"]);
  if (testSignals > 0) {
    facts.push(fact(source, "test-command", `Testing and verification requirement signals detected (${testSignals} match(es)).`, "static", ["app-building", "tests", "verification"]));
  }
  const deploySignals = countMatches(lower, ["deploy", "release", "environment", "ci", "production", "hosting"]);
  if (deploySignals > 0) {
    facts.push(fact(source, "runtime-constraint", `Deployment/runtime requirement signals detected (${deploySignals} match(es)).`, "static", ["app-building", "deployment", "release"]));
  }
  return facts;
}

function countMatches(text: string, terms: string[]): number {
  return terms.reduce((total, term) => total + (termMatches(text, term) ? 1 : 0), 0);
}

function termMatches(text: string, term: string): boolean {
  if (/^[a-z0-9]+$/i.test(term)) {
    return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text);
  }
  return text.includes(term);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceAvailabilityFact(source: SourceRef): SourceFact {
  const claim =
    source.availability === "available"
      ? `Source ${source.location} is available as a ${source.type}.`
      : source.availability === "missing"
        ? `Source ${source.location} is missing and cannot be treated as authoritative evidence.`
        : `Source ${source.location} is remote or otherwise unverified by the local profiler.`;
  return {
    id: stableId("fact", `${source.id}:availability:${source.availability}`),
    sourceId: source.id,
    kind: "runtime-constraint",
    claim,
    provenance: [{ sourceId: source.id, location: source.location }],
    extractor: "runtime",
    confidence: source.availability === "available" ? 1 : 0.95,
    stale: false,
    tags: ["source-availability", source.availability],
  };
}

async function svgFacts(source: SourceRef): Promise<SourceFact[]> {
  const text = await readText(source.location).catch(() => "");
  const facts: SourceFact[] = [];
  const width = matchAttribute(text, "width");
  const height = matchAttribute(text, "height");
  const colors = [...new Set([...text.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((match) => match[0]))];
  const groupCount = (text.match(/<g[\s>]/gi) ?? []).length;
  if (width || height) {
    facts.push(fact(source, "asset-property", `SVG declares dimensions ${width ?? "unknown"}x${height ?? "unknown"}.`, "static", ["svg", "dimensions"]));
  }
  if (colors.length) {
    facts.push(fact(source, "asset-property", `SVG contains ${colors.length} color value(s): ${colors.slice(0, 12).join(", ")}.`, "static", ["svg", "colors"]));
  }
  facts.push(fact(source, "asset-property", `SVG contains ${groupCount} group element(s).`, "static", ["svg", "groups"]));
  facts.push(fact(source, "capability-hint", "Available SVG evidence supports motion/Lottie artifact generation.", "static", ["motion", "lottie"]));
  return facts;
}

async function designSystemFacts(source: SourceRef): Promise<SourceFact[]> {
  const files = await listFiles(source.location, 500);
  const facts: SourceFact[] = [];
  for (const file of files.filter((candidate) => /\.(tsx?|jsx?|css|scss)$/i.test(candidate))) {
    const text = await readText(file).catch(() => "");
    const fileSource = { ...source, location: file };
    for (const name of componentExports(text)) {
      facts.push(fact(fileSource, "component", `Component export discovered: ${name}.`, "static", ["design-system", "component"]));
    }
    const tokens = tokenMarkers(file, text);
    if (tokens.length) {
      facts.push(fact(fileSource, "token", `Token marker(s) discovered: ${[...new Set(tokens)].slice(0, 20).join(", ")}.`, "static", ["design-system", "token"]));
    }
    const rawColors = [...text.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((match) => match[0]);
    if (rawColors.length) {
      facts.push(fact(fileSource, "anti-pattern", `Raw color occurrence(s) discovered: ${[...new Set(rawColors)].slice(0, 20).join(", ")}.`, "static", ["raw-color"]));
    }
  }
  if (facts.some((item) => item.kind === "component" || item.kind === "token")) {
    facts.push(fact(source, "capability-hint", "Design-system evidence supports design inventory and conformance reporting.", "static", ["design-system"]));
  }
  return facts;
}

function componentExports(text: string): string[] {
  const names = [...text.matchAll(/export\s+(?:function|class)\s+([A-Z][A-Za-z0-9_]*)/g)].map((match) => match[1] ?? "");
  for (const match of text.matchAll(/export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=/g)) {
    const nearby = text.slice(match.index ?? 0, (match.index ?? 0) + 300);
    if (/=>\s*(?:<|\(|React\.)|React\.(?:memo|forwardRef|createElement)/.test(nearby)) {
      names.push(match[1] ?? "");
    }
  }
  return names.filter(Boolean);
}

function tokenMarkers(file: string, text: string): string[] {
  const markers: string[] = [];
  if (/\.(css|scss)$/i.test(file)) {
    markers.push(...[...text.matchAll(/(?:--[a-z0-9-]+|var\(--[a-z0-9-]+\))/gi)].map((match) => match[0]));
  }
  markers.push(
    ...[...text.matchAll(/tokens\.(?!length\b|add\b|map\b|filter\b|reduce\b|forEach\b|size\b)[A-Za-z0-9_.-]+/g)].map((match) => match[0]),
  );
  return markers;
}

function fact(source: SourceRef, kind: SourceFact["kind"], claim: string, extractor: SourceFact["extractor"], tags: string[]): SourceFact {
  return {
    id: stableId("fact", `${source.id}:${source.location}:${kind}:${claim}`),
    sourceId: source.id,
    kind,
    claim,
    provenance: [{ sourceId: source.id, location: source.location }],
    extractor,
    confidence: 0.9,
    stale: false,
    tags,
  };
}

function matchAttribute(text: string, name: string): string | undefined {
  return text.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1];
}
