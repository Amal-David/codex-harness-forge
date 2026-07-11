import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { afterEach } from "node:test";

import { buildHarness } from "../dist/index.js";
import { runArtifactExecutor } from "../dist/runtime/executor-runner.js";

const testRuntimeRoot = path.resolve(".harness/tests", String(process.pid));
process.env.HARNESS_RUNTIME_ROOT = testRuntimeRoot;

async function fileExists(target) {
  try {
    await readFile(target);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await rm(testRuntimeRoot, { recursive: true, force: true });
});

test("built CLI resolves packaged resources from a foreign working directory", async () => {
  const foreignRoot = await mkdtemp(path.join(os.tmpdir(), "harness-foreign-cwd-"));
  const installRoot = path.join(foreignRoot, "install");
  const workspaceRoot = path.join(foreignRoot, "workspace");
  const outputDir = path.join(workspaceRoot, "run-output");
  try {
    await mkdir(installRoot, { recursive: true });
    await mkdir(workspaceRoot, { recursive: true });
    const packed = spawnSync("npm", ["pack", "--json", "--pack-destination", foreignRoot], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(packed.status, 0, `${packed.stdout}\n${packed.stderr}`);
    const [{ filename }] = JSON.parse(packed.stdout);
    const installed = spawnSync(
      "npm",
      ["install", "--ignore-scripts", "--no-package-lock", "--no-save", "--prefix", installRoot, path.join(foreignRoot, filename)],
      { cwd: workspaceRoot, encoding: "utf8" },
    );
    assert.equal(installed.status, 0, `${installed.stdout}\n${installed.stderr}`);
    const installedPackageRoot = path.join(installRoot, "node_modules", "codex-harness-forge");
    const cli = spawnSync(
      process.execPath,
      [
        path.join(installedPackageRoot, "bin", "harness-forge.js"),
        "workflows",
        "start",
        "standard",
        "--source",
        path.join(installedPackageRoot, "README.md"),
        "--intent",
        "Explain the architecture and dependency boundaries in this project.",
        "--output",
        outputDir,
        "--json",
      ],
      {
        cwd: workspaceRoot,
        encoding: "utf8",
        env: { ...process.env, HARNESS_RUNTIME_ROOT: path.join(workspaceRoot, ".harness") },
      },
    );
    assert.equal(cli.status, 0, `${cli.stdout}\n${cli.stderr}`);
    const result = JSON.parse(cli.stdout);
    assert.equal(result.trace.finalStatus, "success");
    assert.ok(result.spec.selectedCapabilityPackIds.includes("workflow-runtime"));
    assert.equal(await fileExists(path.join(workspaceRoot, ".harness", "runs", result.trace.runId, "run-state.json")), true);
  } finally {
    await rm(foreignRoot, { recursive: true, force: true });
  }
});

test("published package includes worker contracts", async () => {
  const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
  assert.ok(packageJson.files.includes("worker-contracts"));
});

test("workflow rejects output and source paths that overlap in either direction", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "harness-path-overlap-"));
  const sourceRoot = path.join(root, "source");
  await mkdir(sourceRoot, { recursive: true });
  await writeFile(path.join(sourceRoot, "requirements.md"), "# Requirements\nBuild a report.");
  try {
    await assert.rejects(
      () =>
        buildHarness({
          mode: "standard",
          intent: "Summarize requirements.",
          sources: [sourceRoot],
          controls: [],
          outputDir: path.join(sourceRoot, "generated-output"),
        }),
      /overlap/i,
    );
    await assert.rejects(
      () =>
        buildHarness({
          mode: "standard",
          intent: "Summarize requirements.",
          sources: [path.join(sourceRoot, "requirements.md")],
          controls: [],
          outputDir: root,
        }),
      /overlap/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reusing an output directory removes stale domain artifacts", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "harness-output-reuse-"));
  try {
    await buildHarness({
      harness: "motion-lottie",
      mode: "standard",
      intent: "Create a short SVG logo reveal.",
      sources: [path.resolve("fixtures/motion/logo.svg")],
      durationSeconds: 2,
      fps: 30,
      controls: ["background", "speed"],
      outputDir,
    });
    assert.equal(await fileExists(path.join(outputDir, "animation.json")), true);
    await buildHarness({
      mode: "standard",
      intent: "Explain the architecture and dependency boundaries in this project.",
      sources: [path.resolve("README.md")],
      controls: [],
      outputDir,
    });
    assert.equal(await fileExists(path.join(outputDir, "animation.json")), false);
    const cleanState = JSON.parse(await readFile(path.join(outputDir, "session-clean-state-ledger.json"), "utf8"));
    assert.equal(cleanState.summary.staleArtifactCount, 0);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("local module executors reject modules outside trusted roots", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "harness-untrusted-module-"));
  const modulePath = path.join(root, "executor.mjs");
  await writeFile(modulePath, "export async function run() { return ['untrusted.txt']; }\n");
  try {
    await assert.rejects(
      () =>
        runArtifactExecutor(
          { id: "exec:untrusted", adapter: "local:module", module: modulePath, exportName: "run" },
          { spec: {}, request: {}, profiles: [], outputDir: root },
        ),
      /trusted root/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
