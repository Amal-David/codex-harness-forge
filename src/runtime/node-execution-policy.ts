import type { WorkflowNode } from "../types.js";

const INTRINSIC_VALIDATION_IDS = new Map<string, string>([
  ["validate:source-availability", "source_availability"],
  ["validate:run-state", "run_state_persisted"],
  ["validate:council-review", "council_review_complete"],
]);

export function isIntrinsicRuntimeNode(node: WorkflowNode): boolean {
  return node.kind === "profile" || INTRINSIC_VALIDATION_IDS.has(node.id);
}

export function intrinsicValidationId(node: WorkflowNode): string | undefined {
  return INTRINSIC_VALIDATION_IDS.get(node.id);
}
