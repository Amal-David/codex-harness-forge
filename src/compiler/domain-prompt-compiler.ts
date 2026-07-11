import type { HarnessRequest, RouteDecision, SystemProfile } from "../types.js";

export function compileDomainPrompt(request: HarnessRequest, route: RouteDecision, profiles: SystemProfile[]): string {
  void route;
  const cognitive = compileCognitiveInstruction(request);
  const contracts = profiles.flatMap((profile) => profile.artifactContracts);
  if (contracts.some((contract) => contract.type === "lottie-json")) {
    const vocabulary = unique(profiles.flatMap((profile) => profile.vocabulary)).slice(0, 16).join(", ");
    const controls = request.controls.length ? request.controls.join(", ") : "background color, accent color, speed, camera intensity";
    return [
      `Create a ${request.durationSeconds ?? 4}-second ${request.fps ?? 30} FPS Lottie motion artifact.`,
      "Ground the animation in the supplied SVG/source geometry before inventing movement.",
      `Use motion vocabulary: ${vocabulary}.`,
      "Prefer staged, readable movement with anticipation, stagger, parallax, and final lockup.",
      `Expose reusable controls for: ${controls}.`,
      "Validate JSON, Lottie schema basics, FPS, duration, dimensions, controls, image references, unsupported features, and preview generation.",
      cognitive,
      `User intent: ${request.intent}`,
    ].join("\n");
  }

  if (contracts.some((contract) => contract.id === "design-system-report")) {
    const vocabulary = unique(profiles.flatMap((profile) => profile.vocabulary)).slice(0, 24).join(", ") || "approved components and tokens";
    return [
      "Build or analyze UI using only source-discovered design-system components, tokens, and import paths.",
      `Known vocabulary: ${vocabulary}.`,
      "Do not invent components. Detect raw colors, token usage, import validity, and source conflicts.",
      cognitive,
      `User intent: ${request.intent}`,
    ].join("\n");
  }

  return [
    "Compile this request into a source-grounded, validated harness.",
    "Prefer durable source-of-truth evidence over generic model knowledge.",
    cognitive,
    `User intent: ${request.intent}`,
  ].join("\n");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function compileCognitiveInstruction(request: HarnessRequest): string {
  if (request.reasoningEffort !== "hard" && request.reasoningEffort !== "original" && !request.originalityRequired && !request.outOfDistributionExploration) {
    return "Use normal validation depth.";
  }
  const hypotheses = request.hypothesisCount ?? (request.reasoningEffort === "original" ? 5 : 3);
  const lines = [
    `Use ${request.reasoningEffort ?? "hard"} reasoning: generate at least ${hypotheses} concrete hypotheses before implementation.`,
    "Validate or falsify each hypothesis against source evidence, validators, or explicit uncertainty notes.",
  ];
  if (request.originalityRequired) {
    lines.push("Prefer original, non-obvious approaches and explain why they are not merely copied from the default pattern.");
  }
  if (request.outOfDistributionExploration) {
    lines.push("Explore out-of-distribution candidates, then gate them with source conformance and safety validators before finalizing.");
  }
  return lines.join(" ");
}
