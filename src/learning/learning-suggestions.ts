import type { HarnessSpec, LearningSuggestion, ValidationResult } from "../types.js";

export function generateLearningSuggestions(spec: HarnessSpec, validations: ValidationResult[]): LearningSuggestion[] {
  const suggestions: LearningSuggestion[] = [];
  const failures = validations.filter((result) => result.status === "fail");
  const warnings = validations.filter((result) => result.status === "warning");

  if (spec.artifactContracts.some((contract) => contract.type === "lottie-json")) {
    suggestions.push({
      id: "motion-example",
      target: "example",
      title: "Add premium logo reveal example",
      body: "Capture this run as a motion-lottie example once the user accepts the output, including SVG grouping, controls, and validation report.",
    });
  }

  if (spec.artifactContracts.some((contract) => contract.id === "design-system-report")) {
    suggestions.push({
      id: "design-profile-refresh",
      target: "source-sync",
      title: "Refresh design-system source profile",
      body: "Keep component inventory and token vocabulary synced when component exports or tokens change.",
    });
  }

  for (const result of [...failures, ...warnings]) {
    suggestions.push({
      id: `validator-${result.id}`,
      target: "validator",
      title: `Improve ${result.name} validator`,
      body: `${result.details} Add a focused repair hint or source example so future runs recover faster.`,
    });
  }

  suggestions.push({
    id: "agents-md-approval-rule",
    target: "agents-md",
    title: "Preserve approval boundaries",
    body: "Harness runs should continue to propose source-of-truth updates instead of editing skills, AGENTS.md, design-system files, release config, or external systems without explicit approval.",
  });

  return suggestions;
}

export function renderLearningSuggestions(suggestions: LearningSuggestion[]): string {
  const lines = ["# Skill Update Suggestions", ""];
  for (const suggestion of suggestions) {
    lines.push(`## ${suggestion.title}`);
    lines.push(`- Target: ${suggestion.target}`);
    lines.push(suggestion.body);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
