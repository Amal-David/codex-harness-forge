import path from "node:path";
import type { HarnessRequest, HarnessSpec, SystemProfile } from "../types.js";
import { inventoryDesignSystem } from "../profiler/design-system-profiler.js";
import { profileSvg } from "../profiler/motion-profiler.js";
import { readText, writeJson, writeText } from "../utils/fs.js";

interface AppRoute {
  method: string;
  path: string;
  purpose: string;
  requestSchema: Record<string, string>;
  responseSchema: Record<string, string>;
}

interface AppTable {
  name: string;
  columns: string[];
  constraints: string[];
}

interface AppFlow {
  id: string;
  name: string;
  behavior: string;
}

interface AppBlueprint {
  schemaVersion: number;
  intent: string;
  harnessSpecId: string;
  sourceLocations: string[];
  product: {
    summary: string;
    flows: AppFlow[];
    acceptanceCriteria: string[];
  };
  ui: {
    screens: Array<{ id: string; name: string; behavior: string }>;
    accessibility: string[];
  };
  api: {
    routes: AppRoute[];
    auth: string;
  };
  persistence: {
    tables: AppTable[];
    migrations: string[];
  };
  tests: Record<"unit" | "integration" | "e2e" | "accessibility" | "deployment", string[]>;
  assumptions: string[];
}

export async function generateFinalReport({ spec, outputDir }: { spec: HarnessSpec; outputDir: string }): Promise<string[]> {
  await writeText(path.join(outputDir, "final-report.md"), `# Harness Report\n\n${spec.compiledPrompt}\n`);
  return ["final-report.md"];
}

export async function generateMotionArtifacts({
  spec,
  request,
  profiles,
  outputDir,
}: {
  spec: HarnessSpec;
  request: HarnessRequest;
  profiles: SystemProfile[];
  outputDir: string;
}): Promise<string[]> {
  const svgSource = availableSourceLocations(profiles).find((source) => source.toLowerCase().endsWith(".svg"));
  const svg = svgSource ? await profileSvg(svgSource) : undefined;
  const fps = request.fps ?? 30;
  const duration = request.durationSeconds ?? 4;
  const width = request.width ?? svg?.width ?? 1080;
  const height = request.height ?? svg?.height ?? 1080;
  const controls = Object.fromEntries((request.controls.length ? request.controls : ["background", "accentColor", "speed", "cameraIntensity"]).map((control) => [control, defaultControl(control)]));
  const color = svg?.colors[0] ?? "#6d6ff2";
  const accent = svg?.colors[1] ?? "#f6c85f";
  const animation = {
    v: "5.12.2",
    fr: fps,
    ip: 0,
    op: fps * duration,
    w: width,
    h: height,
    nm: spec.name,
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: "asset-grounded-logo-reveal",
        sr: 1,
        ks: {
          o: { a: 1, k: [{ t: 0, s: [0] }, { t: fps, s: [100] }] },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [width / 2, height / 2, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 1, k: [{ t: 0, s: [82, 82, 100] }, { t: fps * 0.7, s: [104, 104, 100] }, { t: fps, s: [100, 100, 100] }] },
        },
        ao: 0,
        shapes: [
          {
            ty: "gr",
            nm: "final-lockup",
            it: [
              { ty: "rc", nm: "source-bounds", s: { a: 0, k: [Math.round(width * 0.42), Math.round(height * 0.22)] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 28 } },
              { ty: "fl", nm: "brand-fill", c: { a: 0, k: hexToLottieColor(color) }, o: { a: 0, k: 100 } },
              { ty: "st", nm: "accent-stroke", c: { a: 0, k: hexToLottieColor(accent) }, o: { a: 0, k: 100 }, w: { a: 0, k: 10 } },
              { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
            ],
          },
        ],
        ip: 0,
        op: fps * duration,
        st: 0,
        bm: 0,
      },
    ],
    meta: {
      harnessForge: {
        prompt: spec.compiledPrompt,
        svgProfile: svg,
      },
    },
  };
  await writeJson(path.join(outputDir, "animation.json"), animation);
  await writeJson(path.join(outputDir, "controls.json"), controls);
  await writeText(path.join(outputDir, "motion-rationale.md"), renderMotionRationale(spec, request, svg?.location));
  await writeText(path.join(outputDir, "preview.svg"), renderPreviewSvg(width, height, color, accent, spec.name));
  await writeText(path.join(outputDir, "preview.html"), renderPreviewHtml(width, height, spec.name, animation));
  return ["harness-spec.json", "system-profiles.json", "animation.json", "controls.json", "motion-rationale.md", "preview.svg", "preview.html"];
}

export async function generateDesignSystemArtifacts({ profiles, outputDir }: { profiles: SystemProfile[]; outputDir: string }): Promise<string[]> {
  const sourceDirs = availableDirectorySources(profiles);
  const inventory = await inventoryDesignSystem(sourceDirs);
  await writeJson(path.join(outputDir, "component-inventory.json"), inventory);
  await writeText(
    path.join(outputDir, "design-system-conformance.md"),
    [
      "# Design System Conformance",
      "",
      `Components discovered: ${inventory.components.length}`,
      `Token markers discovered: ${inventory.tokens.length}`,
      `Raw color occurrences detected: ${inventory.rawColors.length}`,
      `Import issues detected: ${inventory.importIssues.length}`,
      "",
      "The MVP harness profiles and reports conformance signals without modifying source-of-truth component files.",
    ].join("\n"),
  );
  return ["harness-spec.json", "system-profiles.json", "component-inventory.json", "design-system-conformance.md"];
}

export async function generateAppBuildingArtifacts({
  spec,
  request,
  profiles,
  outputDir,
}: {
  spec: HarnessSpec;
  request: HarnessRequest;
  profiles: SystemProfile[];
  outputDir: string;
}): Promise<string[]> {
  const sourceTexts = await readAvailableTextSources(profiles);
  const combined = sourceTexts.map((source) => source.text).join("\n\n");
  const blueprint = buildAppBlueprint(spec, request, combined, sourceTexts.map((source) => source.location));
  await writeJson(path.join(outputDir, "app-blueprint.json"), blueprint);
  await writeText(path.join(outputDir, "ui-flow.md"), renderUiFlow(blueprint));
  await writeJson(path.join(outputDir, "api-contract.json"), blueprint.api);
  await writeText(path.join(outputDir, "persistence-plan.md"), renderPersistencePlan(blueprint));
  const sourceTreeArtifacts = await writeAppSourceTree(outputDir, blueprint);
  await writeText(path.join(outputDir, "test-plan.md"), renderTestPlan(blueprint));
  await writeText(path.join(outputDir, "app-acceptance.md"), renderAcceptancePlan(blueprint));
  return ["harness-spec.json", "system-profiles.json", "app-blueprint.json", "ui-flow.md", "api-contract.json", "persistence-plan.md", ...sourceTreeArtifacts, "test-plan.md", "app-acceptance.md"];
}

async function readAvailableTextSources(profiles: SystemProfile[]): Promise<Array<{ location: string; text: string }>> {
  const sources = profiles
    .flatMap((profile) => profile.sources)
    .filter((source) => source.availability === "available" && source.type === "file" && /\.(md|mdx|txt)$/i.test(source.location));
  const uniqueSources = [...new Map(sources.map((source) => [source.location, source])).values()];
  return Promise.all(uniqueSources.map(async (source) => ({ location: source.location, text: await readText(source.location).catch(() => "") })));
}

function buildAppBlueprint(spec: HarnessSpec, request: HarnessRequest, sourceText: string, sourceLocations: string[]): AppBlueprint {
  const lower = sourceText.toLowerCase();
  const entities = extractEntities(lower);
  const routes = buildApiRoutes(lower, entities);
  const tables = buildTables(lower, entities);
  const flows = buildFlows(lower, entities);
  return {
    schemaVersion: 1,
    intent: request.intent,
    harnessSpecId: spec.id,
    sourceLocations,
    product: {
      summary: summarizeSource(sourceText, request.intent),
      flows,
      acceptanceCriteria: [
        "User can complete the primary app flow end to end.",
        "API, persistence, and UI contracts are traceable to the PRD.",
        "Required failure and empty states are represented before finalization.",
      ],
    },
    ui: {
      screens: flows.map((flow) => ({ id: flow.id.replace("flow", "screen"), name: flow.name, behavior: flow.behavior })),
      accessibility: ["keyboard reachable controls", "labeled form fields", "visible focus state", "status/error messaging"],
    },
    api: {
      routes,
      auth: lower.includes("auth") || lower.includes("login") ? "Authenticated user session required for user-owned resources." : "No explicit auth requirement found; surface as assumption before implementation.",
    },
    persistence: {
      tables,
      migrations: tables.map((table) => `Create ${table.name} table with required ownership, timestamp, and uniqueness constraints where applicable.`),
    },
    tests: {
      unit: ["model/schema validation", "API handler validation", "UI state reducer/component behavior"],
      integration: ["API route writes and reads persisted records", "validation errors return actionable responses"],
      e2e: ["primary user flow from empty state to completed habit/check-in", "reload verifies persisted state"],
      accessibility: ["forms expose labels and status text", "keyboard path reaches primary actions"],
      deployment: ["build/start command succeeds", "environment variables for persistence are documented"],
    },
    assumptions: [
      "The app-building pack writes a dependency-free source tree that proves the PRD contract can become runnable code.",
      "Framework, styling, database adapter, and deployment provider choices remain replaceable implementation details.",
    ],
  };
}

async function writeAppSourceTree(outputDir: string, blueprint: AppBlueprint): Promise<string[]> {
  const root = "app-source";
  const packageJson = {
    name: "generated-harness-app",
    private: true,
    type: "module",
    scripts: {
      test: "node --test tests/*.test.js",
      start: "node src/app.js",
    },
  };
  await writeJson(path.join(outputDir, root, "package.json"), packageJson);
  await writeText(path.join(outputDir, root, "README.md"), renderSourceReadme(blueprint));
  await writeText(path.join(outputDir, root, "src", "model.js"), renderModelSource(blueprint));
  await writeText(path.join(outputDir, root, "src", "api.js"), renderApiSource(blueprint));
  await writeText(path.join(outputDir, root, "src", "app.js"), renderAppSource(blueprint));
  await writeText(path.join(outputDir, root, "tests", "app.test.js"), renderAppTestSource(blueprint));
  return [`${root}/package.json`, `${root}/README.md`, `${root}/src/model.js`, `${root}/src/api.js`, `${root}/src/app.js`, `${root}/tests/app.test.js`];
}

function renderSourceReadme(blueprint: AppBlueprint): string {
  return [
    "# Generated App Source",
    "",
    blueprint.product.summary,
    "",
    "## Commands",
    "",
    "- `npm test` runs the generated Node smoke tests.",
    "- `npm start` prints a generated implementation summary.",
    "",
    "## Generated Surface",
    "",
    "- `src/model.js` contains the in-memory domain model and persistence-shaped tables.",
    "- `src/api.js` contains dependency-free API route handlers matching `api-contract.json`.",
    "- `src/app.js` contains a small UI summary adapter grounded in `ui-flow.md`.",
    "- `tests/app.test.js` proves the generated source can create and list primary records.",
    "",
    "This is a runnable scaffold, not a final framework binding. It exists to prove the workflow can cross from planning contracts into source-tree execution evidence.",
    "",
  ].join("\n");
}

function renderModelSource(blueprint: AppBlueprint): string {
  const primaryCollection = primaryCollectionFor(blueprint);
  return [
    `export const productSummary = ${JSON.stringify(blueprint.product.summary)};`,
    `export const screens = ${JSON.stringify(blueprint.ui.screens, null, 2)};`,
    `export const routes = ${JSON.stringify(blueprint.api.routes, null, 2)};`,
    `export const tables = ${JSON.stringify(blueprint.persistence.tables, null, 2)};`,
    `export const primaryCollection = ${JSON.stringify(primaryCollection)};`,
    "",
    "export function createInitialState() {",
    "  return {",
    "    [primaryCollection]: [],",
    "    checkIns: [],",
    "  };",
    "}",
    "",
    "export function createItem(state, input = {}) {",
    "  const name = String(input.name ?? '').trim();",
    "  if (!name) {",
    "    return { ok: false, error: 'name is required' };",
    "  }",
    "  const item = {",
    "    id: `${primaryCollection}-${state[primaryCollection].length + 1}`,",
    "    name,",
    "    createdAt: new Date(0).toISOString(),",
    "    updatedAt: new Date(0).toISOString(),",
    "  };",
    "  state[primaryCollection].push(item);",
    "  return { ok: true, item };",
    "}",
    "",
    "export function listItems(state) {",
    "  return [...state[primaryCollection]];",
    "}",
    "",
    "export function recordCheckIn(state, itemId, date = '1970-01-01') {",
    "  const item = state[primaryCollection].find((entry) => entry.id === itemId);",
    "  if (!item) {",
    "    return { ok: false, error: 'item not found' };",
    "  }",
    "  const checkIn = { id: `check-in-${state.checkIns.length + 1}`, itemId, date };",
    "  state.checkIns.push(checkIn);",
    "  return { ok: true, checkIn, streak: state.checkIns.filter((entry) => entry.itemId === itemId).length };",
    "}",
    "",
    "export function implementationSummary(state = createInitialState()) {",
    "  return {",
    "    screens: screens.map((screen) => screen.name),",
    "    routeCount: routes.length,",
    "    tableCount: tables.length,",
    "    itemCount: state[primaryCollection].length,",
    "  };",
    "}",
    "",
  ].join("\n");
}

function renderApiSource(_blueprint: AppBlueprint): string {
  return [
    "import { createInitialState, createItem, listItems, primaryCollection, recordCheckIn } from './model.js';",
    "",
    "export function handleRequest(method, url, body = {}, state = createInitialState()) {",
    "  const normalizedMethod = method.toUpperCase();",
    "  const path = url.split('?')[0];",
    "  const collectionPath = `/api/${primaryCollection}`;",
    "  if (normalizedMethod === 'GET' && path === collectionPath) {",
    "    return { status: 200, body: { items: listItems(state) }, state };",
    "  }",
    "  if (normalizedMethod === 'POST' && path === collectionPath) {",
    "    const result = createItem(state, body);",
    "    return result.ok ? { status: 201, body: result.item, state } : { status: 422, body: result, state };",
    "  }",
    "  const checkInMatch = path.match(new RegExp(`^/api/${primaryCollection}/([^/]+)/check-ins$`));",
    "  if (normalizedMethod === 'POST' && checkInMatch) {",
    "    const result = recordCheckIn(state, checkInMatch[1], body.date);",
    "    return result.ok ? { status: 201, body: result, state } : { status: 404, body: result, state };",
    "  }",
    "  return { status: 404, body: { error: 'route not implemented', method: normalizedMethod, path }, state };",
    "}",
    "",
  ].join("\n");
}

function renderAppSource(_blueprint: AppBlueprint): string {
  return [
    "import { createInitialState, implementationSummary, productSummary } from './model.js';",
    "",
    "export function renderAppSummary(state = createInitialState()) {",
    "  const summary = implementationSummary(state);",
    "  return [`Product: ${productSummary}`, `Screens: ${summary.screens.join(', ')}`, `Routes: ${summary.routeCount}`, `Tables: ${summary.tableCount}`, `Items: ${summary.itemCount}`].join('\\n');",
    "}",
    "",
    "if (import.meta.url === `file://${process.argv[1]}`) {",
    "  console.log(renderAppSummary());",
    "}",
    "",
  ].join("\n");
}

function renderAppTestSource(_blueprint: AppBlueprint): string {
  return [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { handleRequest } from '../src/api.js';",
    "import { createInitialState, primaryCollection, routes, tables } from '../src/model.js';",
    "import { renderAppSummary } from '../src/app.js';",
    "",
    "test('generated source tree exposes API and persistence contracts', () => {",
    "  assert.ok(routes.some((route) => route.path.startsWith('/api/')));",
    "  assert.ok(tables.length >= 2);",
    "  assert.match(renderAppSummary(), /Routes:/);",
    "});",
    "",
    "test('generated API creates and lists primary records', () => {",
    "  const state = createInitialState();",
    "  const created = handleRequest('POST', `/api/${primaryCollection}`, { name: 'Morning habit' }, state);",
    "  assert.equal(created.status, 201);",
    "  const listed = handleRequest('GET', `/api/${primaryCollection}`, {}, state);",
    "  assert.equal(listed.status, 200);",
    "  assert.equal(listed.body.items.length, 1);",
    "  assert.equal(listed.body.items[0].name, 'Morning habit');",
    "});",
    "",
  ].join("\n");
}

function extractEntities(lower: string): string[] {
  const entities = new Set<string>();
  for (const candidate of ["habit", "check-in", "streak", "user", "goal", "reminder", "dashboard"]) {
    if (lower.includes(candidate)) {
      entities.add(candidate);
    }
  }
  return entities.size ? [...entities] : ["item", "user"];
}

function buildApiRoutes(lower: string, entities: string[]): AppRoute[] {
  const primary = entities.includes("habit") ? "habits" : `${entities[0]}s`;
  const routes: AppRoute[] = [
    { method: "GET", path: `/api/${primary}`, purpose: `List ${primary} for the current user.`, requestSchema: {}, responseSchema: { items: "array" } },
    { method: "POST", path: `/api/${primary}`, purpose: `Create a ${primary.replace(/s$/, "")}.`, requestSchema: { name: "string" }, responseSchema: { id: "string", name: "string" } },
    { method: "PATCH", path: `/api/${primary}/:id`, purpose: `Update a ${primary.replace(/s$/, "")}.`, requestSchema: { id: "string" }, responseSchema: { id: "string" } },
  ];
  if (lower.includes("check") || lower.includes("streak")) {
    routes.push({ method: "POST", path: `/api/${primary}/:id/check-ins`, purpose: "Record a completion/check-in and update streak state.", requestSchema: { date: "string" }, responseSchema: { streak: "number" } });
  }
  return routes;
}

function primaryCollectionFor(blueprint: AppBlueprint): string {
  const route = blueprint.api.routes.find((item) => item.path.startsWith("/api/"));
  const match = route?.path.match(/^\/api\/([^/:]+)/);
  return match?.[1] ?? "items";
}

function buildTables(lower: string, entities: string[]): AppTable[] {
  const tables = [
    { name: "users", columns: ["id", "created_at"], constraints: ["primary key id"] },
    { name: entities.includes("habit") ? "habits" : `${entities[0]}s`, columns: ["id", "user_id", "name", "created_at", "updated_at"], constraints: ["belongs to users", "name required"] },
  ];
  if (lower.includes("check") || lower.includes("streak")) {
    tables.push({ name: "habit_check_ins", columns: ["id", "habit_id", "checked_at"], constraints: ["belongs to habits", "unique habit_id + checked_at date"] });
  }
  return tables;
}

function buildFlows(lower: string, entities: string[]): AppFlow[] {
  const primary = entities.includes("habit") ? "habit" : entities[0];
  const flows = [
    { id: "flow-001", name: `Create ${primary}`, behavior: `User can create a ${primary} from the primary screen and see it in the list.` },
    { id: "flow-002", name: `Track ${primary}`, behavior: `User can mark progress and receive immediate persisted feedback.` },
  ];
  if (lower.includes("dashboard") || lower.includes("streak")) {
    flows.push({ id: "flow-003", name: "Review progress", behavior: "User can inspect progress, streak, or dashboard summary after persisted changes." });
  }
  return flows;
}

function summarizeSource(sourceText: string, fallback: string): string {
  const firstMeaningful = sourceText
    .split(/\n+/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find((line) => line.length > 20);
  return firstMeaningful ?? fallback;
}

function renderUiFlow(blueprint: AppBlueprint): string {
  return [
    "# UI Flow",
    "",
    `Summary: ${blueprint.product.summary}`,
    "",
    "## Screens",
    "",
    ...blueprint.ui.screens.map((screen) => `- ${screen.name}: ${screen.behavior}`),
    "",
    "## Accessibility",
    "",
    ...blueprint.ui.accessibility.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

function renderPersistencePlan(blueprint: AppBlueprint): string {
  return [
    "# Persistence Plan",
    "",
    "## Tables",
    "",
    ...blueprint.persistence.tables.map((table) => `- ${table.name}: columns ${table.columns.join(", ")}; constraints ${table.constraints.join(", ")}`),
    "",
    "## Migrations",
    "",
    ...blueprint.persistence.migrations.map((migration) => `- ${migration}`),
    "",
  ].join("\n");
}

function renderTestPlan(blueprint: AppBlueprint): string {
  return [
    "# Test Plan",
    "",
    ...Object.entries(blueprint.tests).flatMap(([kind, checks]) => [`## ${kind}`, "", ...(checks as string[]).map((check) => `- ${check}`), ""]),
  ].join("\n");
}

function renderAcceptancePlan(blueprint: AppBlueprint): string {
  return [
    "# App Acceptance",
    "",
    "## Acceptance Criteria",
    "",
    ...blueprint.product.acceptanceCriteria.map((criterion) => `- ${criterion}`),
    "",
    "## Assumptions",
    "",
    ...blueprint.assumptions.map((assumption) => `- ${assumption}`),
    "",
  ].join("\n");
}

function defaultControl(control: string): Record<string, unknown> {
  return {
    type: control.toLowerCase().includes("color") || control.toLowerCase().includes("background") ? "color" : "number",
    default: control.toLowerCase().includes("color") || control.toLowerCase().includes("background") ? "#111827" : 1,
    description: `Reusable ${control} control exposed by Harness Forge.`,
  };
}

function hexToLottieColor(hex: string): [number, number, number, number] {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3 ? normalized.split("").map((char) => `${char}${char}`).join("") : normalized.slice(0, 6);
  const value = Number.parseInt(full, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, 1];
}

function renderMotionRationale(spec: HarnessSpec, request: HarnessRequest, svg?: string): string {
  return [
    "# Motion Rationale",
    "",
    `Intent: ${request.intent}`,
    `Mode: ${spec.mode}`,
    svg ? `SVG source: ${svg}` : "SVG source: not provided",
    "",
    "The generated direction uses a source-grounded reveal, camera-like scale push, staged opacity, slight overshoot, and final lockup. It exposes requested controls in `controls.json` and leaves source files unchanged.",
  ].join("\n");
}

function renderPreviewSvg(width: number, height: number, color: string, accent: string, name: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#111827"/>
  <rect x="${width * 0.29}" y="${height * 0.39}" width="${width * 0.42}" height="${height * 0.22}" rx="28" fill="${color}" stroke="${accent}" stroke-width="10"/>
  <text x="50%" y="72%" fill="#f9fafb" font-family="Arial, sans-serif" font-size="${Math.max(24, width * 0.04)}" text-anchor="middle">${escapeXml(name)}</text>
</svg>
`;
}

function renderPreviewHtml(width: number, height: number, name: string, animation: unknown): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeXml(name)} preview</title>
  <style>
    body { margin: 0; background: #111827; color: #f9fafb; display: grid; place-items: center; min-height: 100vh; font-family: Arial, sans-serif; }
    #lottie-root { width: min(${width}px, 92vw); aspect-ratio: ${width} / ${height}; }
    .fallback { max-width: min(${width}px, 92vw); height: auto; }
  </style>
</head>
<body>
  <div id="lottie-root" aria-label="${escapeXml(name)} Lottie preview"></div>
  <noscript><img class="fallback" src="./preview.svg" alt="${escapeXml(name)} static preview"></noscript>
  <script id="animation-data" type="application/json">${escapeScriptJson(JSON.stringify(animation))}</script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
  <script>
    const root = document.getElementById("lottie-root");
    const dataNode = document.getElementById("animation-data");
    const animationData = JSON.parse(dataNode.textContent);
    if (window.lottie && root) {
      window.lottie.loadAnimation({ container: root, renderer: "svg", loop: true, autoplay: true, animationData });
    } else if (root) {
      root.innerHTML = '<img class="fallback" src="./preview.svg" alt="${escapeXml(name)} static preview">';
    }
  </script>
</body>
</html>
`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&apos;" })[char] ?? char);
}

function escapeScriptJson(value: string): string {
  return value.replace(/</g, "\\u003c");
}

function availableSourceLocations(profiles: SystemProfile[]): string[] {
  const locations = profiles.flatMap((profile) => profile.sources).filter((source) => source.availability === "available").map((source) => source.location);
  return [...new Set(locations)];
}

function availableDirectorySources(profiles: SystemProfile[]): string[] {
  const directories = profiles
    .flatMap((profile) => profile.sources)
    .filter((source) => source.availability === "available" && source.type === "directory")
    .map((source) => source.location);
  return [...new Set(directories)];
}
