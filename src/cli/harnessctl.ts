import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildHarness } from "../index.js";
import type { HarnessMode, HarnessRequest } from "../types.js";
import { ensureDir, writeText } from "../utils/fs.js";
import { normalizeMode } from "../router/pattern-router.js";
import { listRunRecords, listSavedWorkflows, mergeRequests, readRunRecord, readSavedWorkflow, saveWorkflowFromRun } from "../runtime/run-store.js";

type ParsedArgs = Record<string, string[]>;

export async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  if (argv[0] === "init") {
    await initHarness();
    console.log("Initialized .harness/");
    return;
  }

  if (argv[0] === "workflows") {
    await handleWorkflows(argv.slice(1));
    return;
  }

  const harness = argv[0];
  const maybeMode = normalizeMode(argv[1]);
  const optionStart = maybeMode ? 2 : 1;
  const options = parseOptions(argv.slice(optionStart));
  const request = buildRequest(harness, maybeMode, options);
  const result = await buildHarness(request);
  if (result.trace.finalStatus !== "success") {
    process.exitCode = 1;
  }
  printBuildResult(result, hasFlag(options, "json"));
}

async function handleWorkflows(argv: string[]): Promise<void> {
  const subcommand = argv[0] ?? "list";
  if (subcommand === "list") {
    const options = parseOptions(argv.slice(1));
    const runs = await listRunRecords();
    if (hasFlag(options, "json")) {
      console.log(JSON.stringify(runs, null, 2));
      return;
    }
    if (runs.length === 0) {
      console.log("No workflow runs recorded yet.");
      return;
    }
    for (const run of runs) {
      console.log(`${run.runId}  ${run.status}${run.finalStatus ? `/${run.finalStatus}` : ""}  ${run.outputDir}`);
    }
    return;
  }

  if (subcommand === "show") {
    const runId = argv[1];
    if (!runId) {
      throw new Error("Usage: harness-forge workflows show <run-id> [--json]");
    }
    const options = parseOptions(argv.slice(2));
    const run = await readRunRecord(runId);
    console.log(hasFlag(options, "json") ? JSON.stringify(run, null, 2) : renderRunRecord(run));
    return;
  }

  if (subcommand === "saved") {
    const options = parseOptions(argv.slice(1));
    const workflows = await listSavedWorkflows();
    if (hasFlag(options, "json")) {
      console.log(JSON.stringify(workflows, null, 2));
      return;
    }
    if (workflows.length === 0) {
      console.log("No saved workflows yet.");
      return;
    }
    for (const workflow of workflows) {
      console.log(`${workflow.name}  from ${workflow.sourceRunId}`);
    }
    return;
  }

  if (subcommand === "save") {
    const runId = argv[1];
    if (!runId) {
      throw new Error("Usage: harness-forge workflows save <run-id> --name <name>");
    }
    const options = parseOptions(argv.slice(2));
    const name = getOne(options, "name");
    if (!name) {
      throw new Error("workflows save requires --name <name>.");
    }
    const workflow = await saveWorkflowFromRun(runId, name);
    console.log(hasFlag(options, "json") ? JSON.stringify(workflow, null, 2) : `Saved workflow /${workflow.name} from ${runId}.`);
    return;
  }

  if (subcommand === "run") {
    const name = argv[1];
    if (!name) {
      throw new Error("Usage: harness-forge workflows run <name> [--intent <text>] [--source <path>] [--output <dir>] [--json]");
    }
    const options = parseOptions(argv.slice(2));
    const saved = await readSavedWorkflow(name);
    const request = mergeRequests(saved.request, requestOverridesFromOptions(options));
    const result = await buildHarness(request);
    if (result.trace.finalStatus !== "success") {
      process.exitCode = 1;
    }
    printBuildResult(result, hasFlag(options, "json"));
    return;
  }

  if (subcommand === "resume") {
    const runId = argv[1];
    if (!runId) {
      throw new Error("Usage: harness-forge workflows resume <run-id> [--output <dir>] [--json]");
    }
    const options = parseOptions(argv.slice(2));
    const record = await readRunRecord(runId);
    const request = mergeRequests(record.request, { ...requestOverridesFromOptions(options), outputDir: getOne(options, "output") ? path.resolve(getOne(options, "output") as string) : record.outputDir });
    const result = await buildHarness({ ...request, intent: `${request.intent} (resumed from ${runId})` });
    if (result.trace.finalStatus !== "success") {
      process.exitCode = 1;
    }
    printBuildResult(result, hasFlag(options, "json"));
    return;
  }

  if (subcommand === "start") {
    const maybeMode = normalizeMode(argv[1]);
    const optionStart = maybeMode ? 2 : 1;
    const options = parseOptions(argv.slice(optionStart));
    const request = buildRequest("workflows", maybeMode, options);
    const result = await buildHarness(request);
    if (result.trace.finalStatus !== "success") {
      process.exitCode = 1;
    }
    printBuildResult(result, hasFlag(options, "json"));
    return;
  }

  throw new Error(`Unknown workflows subcommand '${subcommand}'.`);
}

async function initHarness(): Promise<void> {
  await ensureDir(".harness/profiles");
  await ensureDir(".harness/traces");
  await ensureDir(".harness/validators");
  await ensureDir(".harness/harnesses");
  await writeText(
    ".harness/config.yaml",
    [
      "version: 0.1",
      "defaultMode: standard",
      "approval:",
      "  destructiveWrites: required",
      "  sourceOfTruthWrites: required",
      "  externalSideEffects: required",
      "traces: .harness/traces",
      "profiles: .harness/profiles",
      "",
    ].join("\n"),
  );
}

function buildRequest(harness: string | undefined, mode: HarnessMode | undefined, options: ParsedArgs): HarnessRequest {
  const intent = getOne(options, "intent") ?? getOne(options, "task") ?? "Compile a source-grounded harness run.";
  const sources = getMany(options, "source");
  return {
    harness,
    mode,
    intent,
    sources,
    durationSeconds: numberOption(options, "duration", { minExclusive: 0 }),
    fps: numberOption(options, "fps", { integer: true, minExclusive: 0 }),
    width: numberOption(options, "width", { integer: true, minExclusive: 0 }),
    height: numberOption(options, "height", { integer: true, minExclusive: 0 }),
    controls: getMany(options, "control"),
    reasoningEffort: hasFlag(options, "original") ? "original" : hasFlag(options, "think-hard") ? "hard" : undefined,
    originalityRequired: hasFlag(options, "original"),
    hypothesisCount: numberOption(options, "hypotheses", { integer: true, minInclusive: 0 }),
    outOfDistributionExploration: hasFlag(options, "ood") || hasFlag(options, "out-of-distribution"),
    outputDir: path.resolve(getOne(options, "output") ?? "output"),
  };
}

function requestOverridesFromOptions(options: ParsedArgs): Partial<HarnessRequest> {
  const overrides: Partial<HarnessRequest> = {};
  const intent = getOne(options, "intent") ?? getOne(options, "task");
  const sources = getMany(options, "source");
  const controls = getMany(options, "control");
  const mode = normalizeMode(getOne(options, "mode"));
  if (intent) overrides.intent = intent;
  if (sources.length) overrides.sources = sources;
  if (controls.length) overrides.controls = controls;
  if (mode) overrides.mode = mode;
  if (getOne(options, "output")) overrides.outputDir = path.resolve(getOne(options, "output") as string);
  if (getOne(options, "duration")) overrides.durationSeconds = numberOption(options, "duration", { minExclusive: 0 });
  if (getOne(options, "fps")) overrides.fps = numberOption(options, "fps", { integer: true, minExclusive: 0 });
  if (getOne(options, "width")) overrides.width = numberOption(options, "width", { integer: true, minExclusive: 0 });
  if (getOne(options, "height")) overrides.height = numberOption(options, "height", { integer: true, minExclusive: 0 });
  if (hasFlag(options, "original")) overrides.reasoningEffort = "original";
  if (hasFlag(options, "think-hard")) overrides.reasoningEffort = "hard";
  if (hasFlag(options, "original")) overrides.originalityRequired = true;
  if (getOne(options, "hypotheses")) overrides.hypothesisCount = numberOption(options, "hypotheses", { integer: true, minInclusive: 0 });
  if (hasFlag(options, "ood") || hasFlag(options, "out-of-distribution")) overrides.outOfDistributionExploration = true;
  return overrides;
}

function parseOptions(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      append(result, "intent", token);
      continue;
    }
    const key = token.slice(2);
    if (key === "json") {
      append(result, key, "true");
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      append(result, key, "true");
      continue;
    }
    append(result, key, value);
    index += 1;
  }
  return result;
}

function append(options: ParsedArgs, key: string, value: string): void {
  options[key] = [...(options[key] ?? []), value];
}

function getOne(options: ParsedArgs, key: string): string | undefined {
  return options[key]?.[0];
}

function getMany(options: ParsedArgs, key: string): string[] {
  return options[key] ?? [];
}

interface NumberOptionRules {
  integer?: boolean;
  minExclusive?: number;
  minInclusive?: number;
}

function numberOption(options: ParsedArgs, key: string, rules: NumberOptionRules): number | undefined {
  const value = getOne(options, key);
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${key} must be a finite number.`);
  }
  if (rules.integer && !Number.isInteger(parsed)) {
    throw new Error(`--${key} must be an integer.`);
  }
  if (rules.minExclusive !== undefined && parsed <= rules.minExclusive) {
    throw new Error(`--${key} must be greater than ${rules.minExclusive}.`);
  }
  if (rules.minInclusive !== undefined && parsed < rules.minInclusive) {
    throw new Error(`--${key} must be at least ${rules.minInclusive}.`);
  }
  return parsed;
}

function hasFlag(options: ParsedArgs, key: string): boolean {
  return options[key]?.includes("true") ?? false;
}

function printBuildResult(result: Awaited<ReturnType<typeof buildHarness>>, asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Status: ${result.trace.finalStatus}`);
  console.log(`Run: ${result.trace.runId}`);
  console.log(`Output: ${result.outputDir}`);
  console.log("Artifacts:");
  for (const artifact of result.artifacts) {
    console.log(`- ${artifact}`);
  }
  console.log("Validation:");
  for (const validation of result.validations) {
    console.log(`- ${validation.name}: ${validation.status}`);
  }
}

function renderRunRecord(run: Awaited<ReturnType<typeof readRunRecord>>): string {
  return [
    `Run: ${run.runId}`,
    `Status: ${run.status}${run.finalStatus ? `/${run.finalStatus}` : ""}`,
    `Started: ${run.startedAt}`,
    run.completedAt ? `Completed: ${run.completedAt}` : undefined,
    `Output: ${run.outputDir}`,
    run.tracePath ? `Trace: ${run.tracePath}` : undefined,
    `Artifacts: ${run.artifacts.length}`,
    `Validations: ${run.validations.length}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function printHelp(): void {
  console.log(`Codex Harness Forge

Usage:
  harness-forge init
  harness-forge workflows start standard --source ./repo --intent "Build a source-grounded workflow"
  harness-forge workflows list
  harness-forge workflows show <run-id>
  harness-forge workflows save <run-id> --name <name>
  harness-forge workflows run <name>
  harness-forge workflows resume <run-id>
  harness-forge motion-lottie deep --source ./logo.svg --intent "Create a 4-second 30 FPS premium reveal" --duration 4 --fps 30 --control background --control accentColor
  harness-forge design-system-ui standard --source ./packages/ui --intent "Build a settings page using approved components only"

Options:
  --source <path>       Source-of-truth file or directory. Repeatable.
  --intent <text>       User task intent.
  --duration <seconds>  Lottie duration constraint.
  --fps <number>        Lottie FPS constraint.
  --width <number>      Output width.
  --height <number>     Output height.
  --control <name>      Required output control. Repeatable.
  --think-hard          Force hard reasoning with explicit hypotheses.
  --original            Require original/non-obvious candidate generation.
  --hypotheses <n>      Number of hypotheses to generate and validate.
  --ood                 Explore out-of-distribution candidates.
  --output <dir>        Output directory. Default: output.
  --json                Print machine-readable run summary.
`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
