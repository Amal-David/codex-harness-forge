import { readdir } from "node:fs/promises";
import path from "node:path";
import type { HarnessSpec, TraceEvent, ValidationResult } from "../types.js";
import { pathExists, readJson, readText, stableId, writeJson } from "../utils/fs.js";
import { traceEvent } from "./trace-ledger.js";

export const ARCHITECTURE_BOUNDARY_LEDGER_ARTIFACT = "architecture-boundary-ledger.json";
export const ARCHITECTURE_BOUNDARY_VALIDATION_ID = "architecture_boundary_rules_enforced";

type BoundaryStatus = "pass" | "fail" | "warning";

interface ArchitectureBoundaryLedgerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  artifacts: string[];
}

export interface ArchitectureBoundaryLedgerResult {
  artifact: string;
  ledger: ArchitectureBoundaryLedger;
  validation: ValidationResult;
}

export interface ArchitectureBoundaryLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: BoundaryStatus;
  rule: string;
  summary: {
    ruleCount: number;
    passedRuleCount: number;
    warningRuleCount: number;
    failedRuleCount: number;
    sourceFileCount: number;
    violationCount: number;
  };
  rules: BoundaryRuleResult[];
  unresolved: BoundaryViolation[];
}

interface BoundaryRuleResult {
  id: string;
  status: BoundaryStatus;
  invariant: string;
  why: string;
  fix: string;
  evidence: string[];
  violations: BoundaryViolation[];
}

interface BoundaryViolation {
  ruleId: string;
  status: "fail" | "warning";
  file: string;
  line?: number;
  match?: string;
  what: string;
  why: string;
  fix: string;
}

interface SourceFile {
  rel: string;
  abs: string;
  text: string;
}

export async function writeArchitectureBoundaryLedger(input: ArchitectureBoundaryLedgerInput): Promise<ArchitectureBoundaryLedgerResult> {
  const ledger = await buildArchitectureBoundaryLedger(input);
  const target = path.join(input.outputDir, ARCHITECTURE_BOUNDARY_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: ARCHITECTURE_BOUNDARY_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: ARCHITECTURE_BOUNDARY_VALIDATION_ID,
      name: "Architecture boundary rules enforced",
      status: ledger.status,
      details: validationDetails(ledger),
      evidence: [target],
      repairable: true,
    },
  };
}

export function architectureBoundaryLedgerEvents(runId: string, result: ArchitectureBoundaryLedgerResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.architecture_boundary.recorded",
      artifactId: ARCHITECTURE_BOUNDARY_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Recorded ${result.ledger.rules.length} executable architecture boundary rule(s) with status ${result.ledger.status}.`,
      evidence: [ARCHITECTURE_BOUNDARY_LEDGER_ARTIFACT],
    }),
  ];
}

async function buildArchitectureBoundaryLedger(input: ArchitectureBoundaryLedgerInput): Promise<ArchitectureBoundaryLedger> {
  const sourceRoot = path.join(input.outputDir, "app-source");
  const sourceFiles = (await pathExists(sourceRoot)) ? await readSourceFiles(sourceRoot) : [];
  const packageJson = await readGeneratedPackageJson(sourceRoot);
  const rules = [
    ruleSourceTreeDeclared(input.artifacts, sourceFiles),
    ruleNoDirectNodeSideEffects(sourceFiles),
    ruleLayerImportDirection(sourceFiles),
    ruleGeneratedTestCommand(packageJson, input.artifacts),
    ruleFullPipelinePlan(input.artifacts),
  ];
  const unresolved = rules.flatMap((rule) => rule.violations);
  const status = rules.some((rule) => rule.status === "fail") ? "fail" : rules.some((rule) => rule.status === "warning") ? "warning" : "pass";
  return {
    schemaVersion: 1,
    id: stableId("architecture-boundary-ledger", `${input.runId}:${rules.map((rule) => `${rule.id}:${rule.status}:${rule.violations.length}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    rule: "Full-pipeline verification must enforce architecture invariants with executable checks and agent-oriented what/why/fix guidance.",
    summary: {
      ruleCount: rules.length,
      passedRuleCount: rules.filter((rule) => rule.status === "pass").length,
      warningRuleCount: rules.filter((rule) => rule.status === "warning").length,
      failedRuleCount: rules.filter((rule) => rule.status === "fail").length,
      sourceFileCount: sourceFiles.length,
      violationCount: unresolved.length,
    },
    rules,
    unresolved,
  };
}

function ruleSourceTreeDeclared(artifacts: string[], sourceFiles: SourceFile[]): BoundaryRuleResult {
  const sourceArtifacts = artifacts.filter((artifact) => artifact.startsWith("app-source/"));
  const violations =
    sourceArtifacts.length && !sourceFiles.length
      ? [
          violation({
            ruleId: "generated-source-tree-readable",
            file: "app-source",
            what: "Generated source artifacts were declared, but no readable generated source files were found.",
            why: "A full-pipeline claim needs inspectable source files, not only artifact names.",
            fix: "Regenerate the app-source tree before accepting app workflow completion.",
          }),
        ]
      : [];
  return {
    id: "generated-source-tree-readable",
    status: violations.length ? "fail" : "pass",
    invariant: "Declared generated source-tree artifacts must exist as readable files before architecture checks can pass.",
    why: "Artifact manifests alone cannot prove component boundaries or executable behavior.",
    fix: "Regenerate app-source artifacts or remove the source-tree feature from scope before finalization.",
    evidence: sourceArtifacts.length ? sourceArtifacts : ["app-source/"],
    violations,
  };
}

function ruleNoDirectNodeSideEffects(sourceFiles: SourceFile[]): BoundaryRuleResult {
  const sideEffectPatterns = [
    { pattern: /from\s+['"](?:node:)?fs(?:\/promises)?['"]/g, match: "fs import" },
    { pattern: /require\(\s*['"](?:node:)?fs(?:\/promises)?['"]\s*\)/g, match: "fs require" },
    { pattern: /from\s+['"](?:node:)?child_process['"]/g, match: "child_process import" },
    { pattern: /require\(\s*['"](?:node:)?child_process['"]\s*\)/g, match: "child_process require" },
  ];
  const violations = sourceFiles.flatMap((file) =>
    sideEffectPatterns.flatMap(({ pattern, match }) =>
      matchesFor(file, pattern).map((hit) =>
        violation({
          ruleId: "no-direct-node-side-effects",
          file: file.rel,
          line: hit.line,
          match,
          what: `Generated app source directly references ${match}.`,
          why: "Generated app layers should prove product behavior without hidden filesystem or process side effects.",
          fix: "Move the side effect behind an explicit provider/adapter artifact and call that boundary from app code.",
        }),
      ),
    ),
  );
  return {
    id: "no-direct-node-side-effects",
    status: violations.length ? "fail" : "pass",
    invariant: "Generated app source must not directly import filesystem or child-process APIs.",
    why: "Direct platform side effects bypass the harness' provider, permission, and verification boundaries.",
    fix: "Introduce a provider boundary, document it in the generated contract, and verify it through a dedicated adapter test.",
    evidence: sourceFiles.map((file) => file.rel),
    violations,
  };
}

function ruleLayerImportDirection(sourceFiles: SourceFile[]): BoundaryRuleResult {
  const violations = sourceFiles.flatMap((file) => {
    if (file.rel === "app-source/src/model.js") {
      return forbiddenImports(file, ["./api.js", "./app.js", "../tests/", "../src/api.js", "../src/app.js"], "Domain model imports an upper application layer.", "Keep model/domain code independent; move API or UI logic upward into api.js or app.js.");
    }
    if (file.rel === "app-source/src/api.js") {
      return forbiddenImports(file, ["./app.js", "../tests/", "../src/app.js"], "API layer imports the UI adapter or tests.", "Keep API handlers below UI; call API from app.js instead of importing UI from api.js.");
    }
    if (file.rel.startsWith("app-source/src/")) {
      return forbiddenImports(file, ["../tests/"], "Runtime source imports test code.", "Move shared helpers into src/ and let tests import runtime source, not the reverse.");
    }
    return [];
  });
  return {
    id: "layer-import-direction",
    status: violations.length ? "fail" : "pass",
    invariant: "Generated app dependencies flow from model/domain to API/runtime to UI/tests, never backward.",
    why: "Backward imports hide component-boundary defects that unit tests often miss and make generated systems harder to verify end to end.",
    fix: "Move shared behavior to the lower layer, then import it from the higher layer that needs it.",
    evidence: sourceFiles.map((file) => file.rel),
    violations,
  };
}

function ruleGeneratedTestCommand(packageJson: Record<string, unknown> | null, artifacts: string[]): BoundaryRuleResult {
  const appScoped = Boolean(packageJson) || artifacts.some((artifact) => artifact.startsWith("app-source/"));
  if (!appScoped) {
    return {
      id: "generated-test-command-executable",
      status: "pass",
      invariant: "Generated source trees must declare the local command that verifies their runnable behavior.",
      why: "Completion claims need rerunnable proof; tests hidden in the harness are too easy to skip or misinterpret.",
      fix: "Expose the generated source smoke command in package.json and keep it aligned with the validator.",
      evidence: ["app-source/package.json"],
      violations: [],
    };
  }
  const scripts = isRecord(packageJson?.scripts) ? packageJson.scripts : {};
  const testScript = typeof scripts.test === "string" ? scripts.test : "";
  const violations = testScript.includes("node --test")
    ? []
    : [
        violation({
          ruleId: "generated-test-command-executable",
          file: "app-source/package.json",
          what: "Generated source package does not declare an executable Node test command.",
          why: "A full-pipeline run needs a command the agent can rerun instead of relying on prose confidence.",
          fix: "Add `\"test\": \"node --test tests/*.test.js\"` to app-source/package.json and ensure the generated tests pass.",
        }),
      ];
  return {
    id: "generated-test-command-executable",
    status: violations.length ? "fail" : "pass",
    invariant: "Generated source trees must declare the local command that verifies their runnable behavior.",
    why: "Completion claims need rerunnable proof; tests hidden in the harness are too easy to skip or misinterpret.",
    fix: "Expose the generated source smoke command in package.json and keep it aligned with the validator.",
    evidence: ["app-source/package.json"],
    violations,
  };
}

function ruleFullPipelinePlan(artifacts: string[]): BoundaryRuleResult {
  const required = ["test-plan.md", "app-acceptance.md", "api-contract.json", "persistence-plan.md"];
  const missing = required.filter((artifact) => !artifacts.includes(artifact));
  const violations = missing.map((artifact) =>
    violation({
      ruleId: "full-pipeline-plan-artifacts",
      file: artifact,
      what: `Full-pipeline planning artifact ${artifact} is missing.`,
      why: "Boundary checks need product, API, persistence, test, and acceptance surfaces to connect rather than isolated component output.",
      fix: "Regenerate the app workflow artifacts so test, acceptance, API, and persistence contracts are all present.",
    }),
  );
  const appScoped = artifacts.some((artifact) => artifact.startsWith("app-source/") || required.includes(artifact));
  return {
    id: "full-pipeline-plan-artifacts",
    status: appScoped && violations.length ? "fail" : "pass",
    invariant: "App-building runs must include test, acceptance, API, and persistence artifacts that make cross-component verification explicit.",
    why: "End-to-end validation changes agent behavior only when the integration surfaces are visible and required.",
    fix: "Keep these artifacts in the app-building contract or mark the run as non-app scoped before finalization.",
    evidence: required,
    violations: appScoped ? violations : [],
  };
}

async function readSourceFiles(sourceRoot: string): Promise<SourceFile[]> {
  const result: SourceFile[] = [];
  async function visit(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(target);
        continue;
      }
      if (!/\.(?:js|mjs|cjs|ts|tsx|jsx|json)$/i.test(entry.name)) {
        continue;
      }
      const rel = path.join("app-source", path.relative(sourceRoot, target)).split(path.sep).join("/");
      result.push({ rel, abs: target, text: await readText(target) });
    }
  }
  await visit(sourceRoot);
  return result.sort((a, b) => a.rel.localeCompare(b.rel));
}

async function readGeneratedPackageJson(sourceRoot: string): Promise<Record<string, unknown> | null> {
  const target = path.join(sourceRoot, "package.json");
  if (!(await pathExists(target))) {
    return null;
  }
  return readJson<Record<string, unknown>>(target).catch(() => null);
}

function forbiddenImports(file: SourceFile, forbidden: string[], what: string, fix: string): BoundaryViolation[] {
  return extractImports(file).flatMap((importRef) =>
    forbidden.some((item) => importRef.value.includes(item))
      ? [
          violation({
            ruleId: "layer-import-direction",
            file: file.rel,
            line: importRef.line,
            match: importRef.value,
            what,
            why: "Layer direction must remain mechanical so future generated changes cannot drift by copying a bad local pattern.",
            fix,
          }),
        ]
      : [],
  );
}

function extractImports(file: SourceFile): Array<{ value: string; line: number }> {
  const results: Array<{ value: string; line: number }> = [];
  for (const [index, line] of file.text.split(/\r?\n/).entries()) {
    const fromMatch = line.match(/\bfrom\s+['"]([^'"]+)['"]/);
    const importMatch = line.match(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    const requireMatch = line.match(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/);
    for (const match of [fromMatch, importMatch, requireMatch]) {
      if (match?.[1]) {
        results.push({ value: match[1], line: index + 1 });
      }
    }
  }
  return results;
}

function matchesFor(file: SourceFile, pattern: RegExp): Array<{ line: number }> {
  const hits: Array<{ line: number }> = [];
  for (const [index, line] of file.text.split(/\r?\n/).entries()) {
    pattern.lastIndex = 0;
    if (pattern.test(line)) {
      hits.push({ line: index + 1 });
    }
  }
  return hits;
}

function violation(input: Omit<BoundaryViolation, "status">): BoundaryViolation {
  return { ...input, status: "fail" };
}

function validationDetails(ledger: ArchitectureBoundaryLedger): string {
  if (ledger.status === "pass") {
    return `Architecture boundary rules passed ${ledger.summary.passedRuleCount}/${ledger.summary.ruleCount} executable check(s).`;
  }
  return `Architecture boundary rules found ${ledger.summary.violationCount} violation(s): ${ledger.unresolved
    .map((item) => item.ruleId)
    .slice(0, 6)
    .join(", ")}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
