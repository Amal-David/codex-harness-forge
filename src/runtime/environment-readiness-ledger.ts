import path from "node:path";
import type { HarnessRequest, HarnessSpec, SourceAvailability, TraceEvent, ValidationResult } from "../types.js";
import { pathExists, readJson, stableId, writeJson } from "../utils/fs.js";
import { PACKAGE_ROOT } from "../utils/package-paths.js";
import { traceEvent } from "./trace-ledger.js";
import type { InitializationChecklist } from "./initialization-checklist.js";
import { outputIsolationIssues } from "./run-output.js";

export const ENVIRONMENT_READINESS_LEDGER_ARTIFACT = "environment-readiness-ledger.json";
export const ENVIRONMENT_READINESS_VALIDATION_ID = "environment_readiness_confirmed";

type EnvironmentReadinessStatus = "pass" | "fail" | "warning";

interface EnvironmentReadinessLedgerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  request: HarnessRequest;
  initializationChecklist: InitializationChecklist;
}

export interface EnvironmentReadinessLedgerResult {
  artifact: string;
  ledger: EnvironmentReadinessLedger;
  validation: ValidationResult;
}

export interface EnvironmentReadinessLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: EnvironmentReadinessStatus;
  rule: string;
  runtime: {
    nodeVersion: string;
    packageManager: string;
    nodeEngine?: string;
    buildCommand?: string;
    testCommand?: string;
  };
  summary: {
    checkCount: number;
    passedCheckCount: number;
    warningCheckCount: number;
    failedCheckCount: number;
    sourceCount: number;
    unavailableSourceCount: number;
    lockfileCount: number;
    unresolvedCount: number;
  };
  checks: EnvironmentReadinessCheck[];
  sources: EnvironmentSourceState[];
  unresolved: Array<{
    id: string;
    status: "fail" | "warning";
    reason: string;
    evidence: string[];
  }>;
}

interface EnvironmentReadinessCheck {
  id: string;
  status: EnvironmentReadinessStatus;
  details: string;
  evidence: string[];
}

interface EnvironmentSourceState {
  id: string;
  location: string;
  availability: SourceAvailability;
  requested: boolean;
}

interface PackageMetadata {
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
  packageManager?: string;
  dependencies?: Record<string, string>;
}

export async function writeEnvironmentReadinessLedger(input: EnvironmentReadinessLedgerInput): Promise<EnvironmentReadinessLedgerResult> {
  const ledger = await buildEnvironmentReadinessLedger(input);
  const target = path.join(input.outputDir, ENVIRONMENT_READINESS_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: ENVIRONMENT_READINESS_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: ENVIRONMENT_READINESS_VALIDATION_ID,
      name: "Environment readiness confirmed",
      status: ledger.status,
      details: validationDetails(ledger),
      evidence: [target],
      repairable: true,
    },
  };
}

export function environmentReadinessEvents(runId: string, result: EnvironmentReadinessLedgerResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.environment_readiness.recorded",
      artifactId: ENVIRONMENT_READINESS_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Recorded environment readiness with status ${result.ledger.status}.`,
      evidence: [ENVIRONMENT_READINESS_LEDGER_ARTIFACT],
    }),
  ];
}

async function buildEnvironmentReadinessLedger(input: EnvironmentReadinessLedgerInput): Promise<EnvironmentReadinessLedger> {
  const packageJsonPath = path.resolve(PACKAGE_ROOT, "package.json");
  const packageMetadata = await readPackageMetadata(packageJsonPath);
  const lockfiles = await presentLockfiles(PACKAGE_ROOT);
  const runtimeDependencyCount = Object.keys(packageMetadata?.dependencies ?? {}).length;
  const sources = input.spec.sources.map((source) => ({
    id: source.id,
    location: source.location,
    availability: source.availability,
    requested: input.request.sources.includes(source.location),
  }));
  const outputDir = path.resolve(input.outputDir);
  const outputIssues = outputIsolationIssues({ outputDir, sourcePaths: sources.map((source) => source.location) });
  const checks: EnvironmentReadinessCheck[] = [
    {
      id: "package-manifest-readable",
      status: packageMetadata ? "pass" : "fail",
      details: packageMetadata ? "package.json is readable for runtime commands and package metadata." : "package.json is not readable.",
      evidence: ["package.json"],
    },
    {
      id: "runtime-version-declared",
      status: packageMetadata?.engines?.node ? "pass" : "warning",
      details: packageMetadata?.engines?.node ? `Node engine is declared as ${packageMetadata.engines.node}.` : "No Node engine is declared; runtime version may drift.",
      evidence: ["package.json"],
    },
    {
      id: "dependency-lock-present",
      status: lockfiles.length || runtimeDependencyCount === 0 ? "pass" : "warning",
      details: lockfiles.length
        ? `Dependency lockfile(s) present: ${lockfiles.join(", ")}.`
        : runtimeDependencyCount === 0
          ? "The installed runtime has no production dependencies that require a package lock."
          : "No dependency lockfile is present; installs may not be reproducible.",
      evidence: lockfiles.length ? lockfiles : ["package.json"],
    },
    {
      id: "build-test-commands-declared",
      status: input.initializationChecklist.commands.build && input.initializationChecklist.commands.test ? "pass" : "fail",
      details:
        input.initializationChecklist.commands.build && input.initializationChecklist.commands.test
          ? `Build and test commands are declared: ${input.initializationChecklist.commands.build}; ${input.initializationChecklist.commands.test}.`
          : "Build and test commands are not declared in initialization-checklist.json.",
      evidence: ["initialization-checklist.json", "package.json"],
    },
    {
      id: "source-paths-available",
      status: sourceReadinessStatus(sources),
      details: sourceReadinessDetails(sources),
      evidence: sources.map((source) => source.location),
    },
    {
      id: "output-directory-isolated",
      status: (await pathExists(outputDir)) && outputIssues.length === 0 ? "pass" : "fail",
      details: outputIssues.length ? outputIssues.join(" ") : `Output directory resolves to ${outputDir} without containing, equaling, or being contained by a declared source path.`,
      evidence: [outputDir],
    },
    {
      id: "package-runtime-map-present",
      status: (await pathExists(path.resolve(PACKAGE_ROOT, "README.md"))) && (await pathExists(path.resolve(PACKAGE_ROOT, "dist"))) && (await pathExists(path.resolve(PACKAGE_ROOT, "capability-packs"))) && (await pathExists(path.resolve(PACKAGE_ROOT, "worker-contracts"))) ? "pass" : "warning",
      details: "README.md, compiled runtime modules, capability packs, and worker contracts should be present in the installed package.",
      evidence: ["README.md", "dist", "capability-packs", "worker-contracts"],
    },
  ];
  const unresolved = checks.flatMap((check) =>
    check.status === "pass"
      ? []
      : [
          {
            id: check.id,
            status: check.status,
            reason: check.details,
            evidence: check.evidence,
          },
        ],
  );
  const status = checks.some((check) => check.status === "fail") ? "fail" : checks.some((check) => check.status === "warning") ? "warning" : "pass";
  return {
    schemaVersion: 1,
    id: stableId("environment-readiness-ledger", `${input.runId}:${checks.map((check) => `${check.id}:${check.status}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    rule: "The harness environment is ready only when runtime metadata, dependency reproducibility, build/test entrypoints, declared sources, output isolation, and repo guidance are inspectable before generation starts.",
    runtime: {
      nodeVersion: process.version,
      packageManager: packageMetadata?.packageManager ?? (lockfiles.includes("package-lock.json") ? "npm" : "unknown"),
      nodeEngine: packageMetadata?.engines?.node,
      buildCommand: input.initializationChecklist.commands.build,
      testCommand: input.initializationChecklist.commands.test,
    },
    summary: {
      checkCount: checks.length,
      passedCheckCount: checks.filter((check) => check.status === "pass").length,
      warningCheckCount: checks.filter((check) => check.status === "warning").length,
      failedCheckCount: checks.filter((check) => check.status === "fail").length,
      sourceCount: sources.length,
      unavailableSourceCount: sources.filter((source) => source.availability !== "available").length,
      lockfileCount: lockfiles.length,
      unresolvedCount: unresolved.length,
    },
    checks,
    sources,
    unresolved,
  };
}

async function readPackageMetadata(packageJsonPath: string): Promise<PackageMetadata | undefined> {
  if (!(await pathExists(packageJsonPath))) {
    return undefined;
  }
  return readJson<PackageMetadata>(packageJsonPath);
}

async function presentLockfiles(rootDir: string): Promise<string[]> {
  const candidates = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"];
  const present: string[] = [];
  for (const candidate of candidates) {
    if (await pathExists(path.resolve(rootDir, candidate))) {
      present.push(candidate);
    }
  }
  return present;
}

function sourceReadinessStatus(sources: EnvironmentSourceState[]): EnvironmentReadinessStatus {
  if (!sources.length) {
    return "warning";
  }
  if (sources.some((source) => source.availability === "missing")) {
    return "fail";
  }
  if (sources.some((source) => source.availability === "unverified")) {
    return "warning";
  }
  return "pass";
}

function sourceReadinessDetails(sources: EnvironmentSourceState[]): string {
  if (!sources.length) {
    return "No source refs were declared; the environment can start, but generated work must stay partial until source evidence is provided.";
  }
  const unavailable = sources.filter((source) => source.availability !== "available");
  if (unavailable.length) {
    return `Unavailable source ref(s): ${unavailable.map((source) => `${source.id}:${source.availability}`).join(", ")}.`;
  }
  return `${sources.length} declared source ref(s) are available before generation.`;
}

function validationDetails(ledger: EnvironmentReadinessLedger): string {
  if (ledger.status === "pass") {
    return `Environment readiness passed with ${ledger.summary.passedCheckCount}/${ledger.summary.checkCount} check(s), ${ledger.summary.sourceCount} source(s), and ${ledger.summary.lockfileCount} lockfile(s).`;
  }
  if (ledger.status === "warning") {
    return `Environment readiness has warning check(s): ${ledger.unresolved
      .filter((issue) => issue.status === "warning")
      .map((issue) => issue.id)
      .join(", ")}.`;
  }
  return `Environment readiness failed check(s): ${ledger.unresolved
    .filter((issue) => issue.status === "fail")
    .map((issue) => issue.id)
    .join(", ")}.`;
}
