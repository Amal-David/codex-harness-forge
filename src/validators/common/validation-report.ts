import type { ValidationResult } from "../../types.js";

export function renderValidationReport(results: ValidationResult[]): string {
  const lines = ["# Validation Report", ""];
  for (const result of results) {
    lines.push(`## ${result.name}`);
    lines.push(`- Status: ${result.status}`);
    lines.push(`- Repairable: ${result.repairable ? "yes" : "no"}`);
    lines.push(`- Details: ${result.details}`);
    if (result.evidence?.length) {
      lines.push(`- Evidence: ${result.evidence.join(", ")}`);
    }
    lines.push("");
  }
  const failed = results.filter((result) => result.status === "fail").length;
  const warnings = results.filter((result) => result.status === "warning").length;
  lines.unshift(`Summary: ${failed} failed, ${warnings} warning(s), ${results.length - failed - warnings} passed/skipped.`, "");
  return `${lines.join("\n")}\n`;
}

export function finalStatusFromValidations(results: ValidationResult[]): "success" | "partial" | "failed" | "needs-human-review" {
  if (results.some((result) => result.status === "fail")) {
    return "failed";
  }
  if (results.some((result) => result.status === "warning" || result.status === "skipped")) {
    return "partial";
  }
  return "success";
}
