import path from "node:path";
import { stat } from "node:fs/promises";
import type {
  ArtifactContract,
  HarnessRequest,
  Rule,
  SourceAvailability,
  SourceRef,
  SourceRefType,
  SourceTrust,
  SystemProfile,
  SystemProfileType,
  ValidatorSpec,
} from "../types.js";
import { listFiles, pathExists, readText, stableId } from "../utils/fs.js";

export async function buildSourceRefs(sourceLocations: string[]): Promise<SourceRef[]> {
  const refs: SourceRef[] = [];
  for (const location of sourceLocations) {
    const source = await classifySource(location);
    refs.push({
      id: stableId("source", location),
      type: source.type,
      location,
      trust: defaultTrust(source.type, source.availability),
      availability: source.availability,
      lastSyncedAt: source.availability === "available" ? new Date().toISOString() : undefined,
      notes: source.notes,
    });
  }
  return refs;
}

export async function buildSystemProfiles(request: HarnessRequest, systemTypes: SystemProfileType[], sources: SourceRef[]): Promise<SystemProfile[]> {
  const profiles: SystemProfile[] = [];
  for (const type of systemTypes) {
    if (type === "motion-system") {
      profiles.push(await buildMotionProfile(request, sources));
    } else if (type === "design-system") {
      profiles.push(await buildDesignSystemProfile(sources));
    } else {
      profiles.push(await buildGenericProfile(type, sources));
    }
  }
  return profiles;
}

async function buildMotionProfile(request: HarnessRequest, sources: SourceRef[]): Promise<SystemProfile> {
  const svgSources = sources.filter((source) => source.availability === "available" && source.location.toLowerCase().endsWith(".svg"));
  const vocabulary = [
    "ease-in",
    "ease-out",
    "ease-in-out",
    "camera push",
    "pan",
    "zoom",
    "anticipation",
    "overshoot",
    "stagger",
    "parallax",
    "accent sweep",
    "final lockup",
  ];
  const rules = motionRules();
  const validators = lottieValidators();
  const artifactContracts: ArtifactContract[] = [
    {
      id: "motion-lottie-output",
      type: "lottie-json",
      requiredFiles: ["animation.json", "controls.json", "preview.html", "validation-report.md", "harness-trace.json"],
      validators: validators.map((validator) => validator.id),
      humanReviewRequired: request.mode === "tournament" || request.mode === "deep",
    },
  ];
  const examples = svgSources.map((source, index) => ({
    id: `svg-example-${index + 1}`,
    title: path.basename(source.location),
    location: source.location,
    notes: "SVG geometry can seed animatable groups, dimensions, and brand colors.",
  }));

  return {
    id: "motion-system",
    name: "Motion/Lottie System",
    type: "motion-system",
    sources,
    trustRank: rankSources(sources),
    freshness: { profiledAt: new Date().toISOString(), stale: false, notes: [] },
    vocabulary,
    rules,
    examples,
    antiPatterns: [
      { id: "random-motion", text: "Avoid random motion that is not grounded in asset geometry." },
      { id: "missing-controls", text: "Do not omit requested controls from controls.json." },
    ],
    artifactContracts,
    validators,
    humanReviewPoints: [{ id: "taste-review", reason: "Motion quality is taste-sensitive.", requiredBefore: "finalize" }],
  };
}

async function buildDesignSystemProfile(sources: SourceRef[]): Promise<SystemProfile> {
  const files = (await Promise.all(sources.filter((source) => source.type === "directory" && source.availability === "available").map((source) => listFiles(source.location, 300)))).flat();
  const componentNames = new Set<string>();
  const tokens = new Set<string>();
  for (const file of files.filter(isCodeOrStyleFile)) {
    const text = await readText(file).catch(() => "");
    for (const name of componentExports(text)) {
      componentNames.add(name);
    }
    for (const marker of tokenMarkers(file, text)) {
      tokens.add(marker);
    }
  }
  const validators = designSystemValidators();
  return {
    id: "design-system",
    name: "Design System",
    type: "design-system",
    sources,
    trustRank: rankSources(sources),
    freshness: { profiledAt: new Date().toISOString(), stale: false, notes: [] },
    vocabulary: [...componentNames, ...tokens].filter(Boolean).slice(0, 200),
    rules: [
      { id: "approved-components", text: "Use approved components discovered from source inventory." },
      { id: "no-raw-hex", text: "Do not introduce raw hex colors when tokens exist." },
      { id: "valid-imports", text: "Preserve import conventions and valid import paths." },
    ],
    examples: files.slice(0, 20).map((file, index) => ({ id: `design-example-${index + 1}`, title: path.basename(file), location: file })),
    antiPatterns: [{ id: "invented-components", text: "Do not invent components that are absent from the source inventory." }],
    artifactContracts: [
      {
        id: "design-system-report",
        type: "markdown-doc",
        requiredFiles: ["component-inventory.json", "design-system-conformance.md", "validation-report.md", "harness-trace.json"],
        validators: validators.map((validator) => validator.id),
        humanReviewRequired: false,
      },
    ],
    validators,
    humanReviewPoints: [{ id: "source-conflict-review", reason: "Source conflicts or deprecated components require human judgment.", requiredBefore: "write" }],
  };
}

async function buildGenericProfile(type: SystemProfileType, sources: SourceRef[]): Promise<SystemProfile> {
  const conflictNotes = type === "codebase" ? await detectSourceConflictNotes(sources) : [];
  return {
    id: type,
    name: type.replace(/-/g, " "),
    type,
    sources,
    trustRank: rankSources(sources),
    freshness: { profiledAt: new Date().toISOString(), stale: false, notes: conflictNotes },
    vocabulary: [],
    rules: [{ id: "source-first", text: "Prefer durable source-of-truth evidence over generic model knowledge." }],
    examples: [],
    antiPatterns: [],
    artifactContracts: [],
    validators: [],
    humanReviewPoints: [],
  };
}

async function detectSourceConflictNotes(sources: SourceRef[]): Promise<string[]> {
  const textSources = await Promise.all(
    sources
      .filter((source) => source.availability === "available" && source.type === "file" && /\.(md|mdx|txt)$/i.test(source.location))
      .map(async (source) => ({ source, text: (await readText(source.location).catch(() => "")).toLowerCase() })),
  );
  if (textSources.length < 2) {
    return [];
  }
  const notes: string[] = [];
  const passwordless = textSources.filter((item) => /passwordless|magic links?/.test(item.text));
  const passwordTotp = textSources.filter((item) => /username\/password|password plus totp|totp/.test(item.text));
  if (passwordless.length && passwordTotp.length) {
    notes.push(conflictNote("Authentication method", passwordless, "passwordless email magic links", passwordTotp, "username/password plus TOTP"));
  }
  const postgres = textSources.filter((item) => /postgres|postgresql/.test(item.text));
  const firestore = textSources.filter((item) => /firestore/.test(item.text));
  if (postgres.length && firestore.length) {
    notes.push(conflictNote("Storage backend", postgres, "PostgreSQL", firestore, "Firestore"));
  }
  const webOnly = textSources.filter((item) => /web-only|web only|browser only/.test(item.text));
  const nativeOnly = textSources.filter((item) => /native mobile only|mobile only/.test(item.text));
  if (webOnly.length && nativeOnly.length) {
    notes.push(conflictNote("Release platform", webOnly, "web-only", nativeOnly, "native mobile only"));
  }
  return [...new Set(notes)];
}

function conflictNote(
  subject: string,
  left: Array<{ source: SourceRef; text: string }>,
  leftClaim: string,
  right: Array<{ source: SourceRef; text: string }>,
  rightClaim: string,
): string {
  return `Conflict: ${subject} differs between ${left.map((item) => item.source.location).join(", ")} (${leftClaim}) and ${right.map((item) => item.source.location).join(", ")} (${rightClaim}).`;
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

interface SourceClassification {
  type: SourceRefType;
  availability: SourceAvailability;
  notes: string[];
}

async function classifySource(location: string): Promise<SourceClassification> {
  const type = await inferSourceType(location);
  if (type === "url") {
    return {
      type,
      availability: "unverified",
      notes: ["Remote URL sources are recorded but not fetched by the local MVP profiler."],
    };
  }
  if (await pathExists(location)) {
    return { type, availability: "available", notes: [] };
  }
  return {
    type,
    availability: "missing",
    notes: ["Local source path was not found during profiling."],
  };
}

async function inferSourceType(location: string): Promise<SourceRefType> {
  if (/^https?:\/\//.test(location)) {
    return "url";
  }
  if (location.toLowerCase().includes("storybook")) {
    return "storybook";
  }
  if (location.toLowerCase().endsWith("agents.md")) {
    return "agents-md";
  }
  if (location.toLowerCase().includes("skill")) {
    return "skill";
  }
  if (location.toLowerCase().endsWith(".json") && location.toLowerCase().includes("openapi")) {
    return "openapi";
  }
  const exists = await pathExists(location);
  if (exists) {
    const info = await stat(location);
    return info.isDirectory() ? "directory" : "file";
  }
  return "file";
}

function defaultTrust(type: SourceRefType, availability: SourceAvailability): SourceTrust {
  if (availability === "missing") {
    return "low";
  }
  if (availability === "unverified") {
    return "medium";
  }
  if (type === "repo" || type === "file" || type === "directory" || type === "agents-md") {
    return "highest";
  }
  if (type === "skill" || type === "storybook" || type === "openapi" || type === "test-suite") {
    return "high";
  }
  return "medium";
}

function rankSources(sources: SourceRef[]) {
  const weight: Record<SourceTrust, number> = { highest: 1, high: 2, medium: 3, low: 4 };
  return [...sources]
    .sort((a, b) => weight[a.trust] - weight[b.trust])
    .map((source, index) => ({ sourceId: source.id, rank: index + 1, reason: `${source.type} source with ${source.trust} trust; availability is ${source.availability}.` }));
}

function motionRules(): Rule[] {
  return [
    { id: "asset-grounded", text: "Ground animation in concrete SVG geometry and source assets." },
    { id: "motion-language", text: "Use motion design terminology such as anticipation, stagger, parallax, overshoot, camera push, and final lockup." },
    { id: "explicit-timing", text: "Specify FPS and duration and validate both." },
    { id: "staged-readable", text: "Prefer staged, readable movement over simultaneous chaotic motion." },
    { id: "preview-before-final", text: "Generate a preview artifact before finalizing." },
    { id: "requested-controls", text: "Expose every requested control in controls.json." },
  ];
}

export function lottieValidators(): ValidatorSpec[] {
  return [
    { id: "valid_json", name: "Valid JSON", type: "schema", required: true },
    { id: "valid_lottie_schema", name: "Basic Lottie schema", type: "schema", required: true },
    { id: "duration_matches_request", name: "Duration matches request", type: "schema", required: true },
    { id: "fps_matches_request", name: "FPS matches request", type: "schema", required: true },
    { id: "dimensions_match_request", name: "Dimensions match request", type: "schema", required: true },
    { id: "controls_exist", name: "Requested controls exist", type: "source-conformance", required: true },
    { id: "no_missing_image_references", name: "No missing image references", type: "schema", required: true },
    { id: "no_unsupported_lottie_features", name: "No unsupported features", type: "schema", required: true },
    { id: "preview_generated", name: "Preview generated", type: "visual", required: true },
  ];
}

export function designSystemValidators(): ValidatorSpec[] {
  return [
    { id: "component_inventory", name: "Component inventory generated", type: "source-conformance", required: true },
    { id: "token_usage_detected", name: "Token usage detected", type: "source-conformance", required: true },
    { id: "raw_color_detection", name: "Raw color detection", type: "source-conformance", required: true },
    { id: "valid_import_paths", name: "Valid import paths", type: "static", required: true },
  ];
}

function isCodeOrStyleFile(file: string): boolean {
  return /\.(tsx?|jsx?|css|scss|mdx?)$/i.test(file);
}
