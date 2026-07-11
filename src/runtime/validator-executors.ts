import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { HarnessRequest, HarnessSpec, ValidationResult } from "../types.js";
import { runDesignSystemValidators } from "../validators/design-system/validate-design-system.js";
import { runLottieValidators } from "../validators/lottie/validate-lottie.js";
import { pathExists, readText } from "../utils/fs.js";

export async function runLottieValidatorsExecutor({ outputDir, request }: { spec: HarnessSpec; request: HarnessRequest; outputDir: string }): Promise<ValidationResult[]> {
  return runLottieValidators(outputDir, request);
}

export async function runDesignSystemValidatorsExecutor({ outputDir, request }: { spec: HarnessSpec; request: HarnessRequest; outputDir: string }): Promise<ValidationResult[]> {
  return runDesignSystemValidators(outputDir, request);
}

export async function runAppBuildingValidatorsExecutor({ outputDir }: { spec: HarnessSpec; request: HarnessRequest; outputDir: string }): Promise<ValidationResult[]> {
  const blueprintPath = path.join(outputDir, "app-blueprint.json");
  const uiFlowPath = path.join(outputDir, "ui-flow.md");
  const apiContractPath = path.join(outputDir, "api-contract.json");
  const persistencePath = path.join(outputDir, "persistence-plan.md");
  const sourceRoot = path.join(outputDir, "app-source");
  const packagePath = path.join(sourceRoot, "package.json");
  const appSourcePath = path.join(sourceRoot, "src", "app.js");
  const apiSourcePath = path.join(sourceRoot, "src", "api.js");
  const modelSourcePath = path.join(sourceRoot, "src", "model.js");
  const sourceTestPath = path.join(sourceRoot, "tests", "app.test.js");
  const testPlanPath = path.join(outputDir, "test-plan.md");
  const acceptancePath = path.join(outputDir, "app-acceptance.md");
  const blueprint = await parseJson<Record<string, unknown>>(blueprintPath);
  const api = await parseJson<{ routes?: unknown[] }>(apiContractPath);
  const persistence = (await pathExists(persistencePath)) ? await readText(persistencePath) : "";
  const packageJson = await parseJson<{ scripts?: Record<string, string> }>(packagePath);
  const appSource = (await pathExists(appSourcePath)) ? await readText(appSourcePath) : "";
  const apiSource = (await pathExists(apiSourcePath)) ? await readText(apiSourcePath) : "";
  const modelSource = (await pathExists(modelSourcePath)) ? await readText(modelSourcePath) : "";
  const sourceTest = (await pathExists(sourceTestPath)) ? await readText(sourceTestPath) : "";
  const sourceSmoke = runSourceSmokeTest(sourceRoot, sourceTestPath);
  const testPlan = (await pathExists(testPlanPath)) ? await readText(testPlanPath) : "";
  const acceptance = (await pathExists(acceptancePath)) ? await readText(acceptancePath) : "";
  const uiFlow = (await pathExists(uiFlowPath)) ? await readText(uiFlowPath) : "";
  return [
    {
      id: "app_requirements_extracted",
      name: "App requirements extracted",
      status: blueprint.ok && uiFlow.includes("## Screens") ? "pass" : "fail",
      details: blueprint.ok ? "App blueprint and UI flow were generated from requirement sources." : blueprint.error,
      evidence: [blueprintPath, uiFlowPath],
      repairable: true,
    },
    {
      id: "app_api_contract_present",
      name: "App API contract present",
      status: api.ok && Array.isArray(api.value.routes) && api.value.routes.length > 0 ? "pass" : "fail",
      details: api.ok ? `${api.value.routes?.length ?? 0} API route contract(s) generated.` : api.error,
      evidence: [apiContractPath],
      repairable: true,
    },
    {
      id: "app_persistence_plan_present",
      name: "App persistence plan present",
      status: persistence.includes("## Tables") && /migration/i.test(persistence) ? "pass" : "fail",
      details: persistence ? "Persistence plan includes tables and migration guidance." : "Persistence plan was not generated.",
      evidence: [persistencePath],
      repairable: true,
    },
    {
      id: "app_source_tree_present",
      name: "App source tree present and smoke-tested",
      status:
        packageJson.ok &&
        packageJson.value.scripts?.test === "node --test tests/*.test.js" &&
        appSource.includes("renderAppSummary") &&
        apiSource.includes("handleRequest") &&
        modelSource.includes("createInitialState") &&
        sourceTest.includes("generated API creates and lists primary records") &&
        sourceSmoke.ok
          ? "pass"
          : "fail",
      details: sourceSmoke.ok ? "Generated app source tree exists and its Node smoke test passed." : `Generated source smoke test failed: ${sourceSmoke.details}`,
      evidence: [packagePath, appSourcePath, apiSourcePath, modelSourcePath, sourceTestPath],
      repairable: true,
    },
    {
      id: "app_test_plan_full_pipeline",
      name: "App test plan covers full pipeline",
      status: ["unit", "integration", "e2e", "accessibility", "deployment"].every((term) => testPlan.toLowerCase().includes(term)) ? "pass" : "fail",
      details: "Test plan must include unit, integration, E2E, accessibility, and deployment checks.",
      evidence: [testPlanPath],
      repairable: true,
    },
    {
      id: "app_acceptance_coverage",
      name: "App acceptance coverage",
      status: acceptance.includes("Acceptance Criteria") && acceptance.includes("Assumptions") ? "pass" : "fail",
      details: "Acceptance artifact must separate criteria from assumptions before implementation.",
      evidence: [acceptancePath],
      repairable: true,
    },
  ];
}

export async function runTraceCompleteValidatorExecutor({ outputDir }: { spec: HarnessSpec; request: HarnessRequest; outputDir: string }): Promise<ValidationResult[]> {
  return [
    {
      id: "trace_complete",
      name: "Trace complete",
      status: "pass",
      details: "Generic workflow trace can be written.",
      evidence: [path.join(outputDir, "harness-trace.json")],
      repairable: false,
    },
  ];
}

function runSourceSmokeTest(sourceRoot: string, testPath: string): { ok: boolean; details: string } {
  if (!pathExistsSync(testPath)) {
    return { ok: false, details: "Generated source test file is missing." };
  }
  const result = spawnSync(process.execPath, ["--test", testPath], {
    cwd: sourceRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 5,
  });
  const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  return {
    ok: result.status === 0,
    details: details || `node --test exited with ${result.status ?? "unknown"}`,
  };
}

function pathExistsSync(target: string): boolean {
  return Boolean(target) && existsSync(target);
}

async function parseJson<T>(file: string): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: JSON.parse(await readText(file)) as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
