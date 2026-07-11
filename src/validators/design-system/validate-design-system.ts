import path from "node:path";
import type { HarnessRequest, ValidationResult } from "../../types.js";
import { inventoryDesignSystem } from "../../profiler/design-system-profiler.js";
import { pathExists } from "../../utils/fs.js";

export async function runDesignSystemValidators(outputDir: string, request: HarnessRequest): Promise<ValidationResult[]> {
  const sourceDirs = request.sources.filter((source) => !source.startsWith("http"));
  const inventory = await inventoryDesignSystem(sourceDirs);
  const inventoryPath = path.join(outputDir, "component-inventory.json");
  const conformancePath = path.join(outputDir, "design-system-conformance.md");

  return [
    {
      id: "component_inventory",
      name: "Component inventory generated",
      status: (await pathExists(inventoryPath)) && inventory.components.length > 0 ? "pass" : "warning",
      details: `${inventory.components.length} component export(s) found.`,
      evidence: [inventoryPath],
      repairable: true,
    },
    {
      id: "token_usage_detected",
      name: "Token usage detected",
      status: inventory.tokens.length > 0 ? "pass" : "warning",
      details: `${inventory.tokens.length} token marker(s) found.`,
      evidence: [conformancePath],
      repairable: true,
    },
    {
      id: "raw_color_detection",
      name: "Raw color detection",
      status: inventory.rawColors.length === 0 ? "pass" : "warning",
      details: inventory.rawColors.length === 0 ? "No raw hex colors detected." : `Detected ${inventory.rawColors.length} raw color occurrence(s).`,
      evidence: [conformancePath],
      repairable: true,
    },
    {
      id: "valid_import_paths",
      name: "Valid import paths",
      status: inventory.importIssues.length === 0 ? "pass" : "fail",
      details: inventory.importIssues.length === 0 ? "Relative imports resolved within profiled files." : `${inventory.importIssues.length} unresolved relative import(s).`,
      evidence: [conformancePath],
      repairable: true,
    },
  ];
}
