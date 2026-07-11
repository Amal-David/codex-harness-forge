import path from "node:path";
import type { HarnessSpec, HarnessSubsystemId, TraceEvent, ValidationResult } from "../types.js";
import { stableId, writeJson } from "../utils/fs.js";

export const INSTRUCTION_ROUTING_LEDGER_ARTIFACT = "instruction-routing-ledger.json";

interface InstructionRoutingLedgerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
}

export interface InstructionRoutingLedgerResult {
  artifact: string;
  ledger: InstructionRoutingLedger;
  validation: ValidationResult;
}

interface InstructionRoutingLedger {
  schemaVersion: 2;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  rule: string;
  entryFile: {
    role: "router";
    estimatedLineCount: number;
    minRecommendedLineCount: number;
    maxRecommendedLineCount: number;
    maxHardConstraints: number;
    maxAlwaysLoadedTopics: number;
    hardConstraints: InstructionConstraint[];
  };
  instructionBudget: InstructionBudget;
  selectedTopics: InstructionTopic[];
  heldBackTopics: InstructionTopic[];
  topicAudit: InstructionTopicAudit[];
  subsystemCoverage: Array<{
    subsystem: HarnessSubsystemId;
    topicIds: string[];
    status: "covered" | "missing";
  }>;
  unresolved: Array<{
    id: string;
    reason: string;
    evidence: string[];
  }>;
}

interface InstructionConstraint {
  id: string;
  text: string;
  source: string;
  appliesWhen: string;
  expiryCondition: string;
}

interface InstructionTopic {
  id: string;
  title: string;
  subsystem: HarnessSubsystemId;
  source: string;
  appliesWhen: string;
  expiryCondition: string;
  revealPolicy: "always" | "when-source-matches" | "when-runtime-signal-appears";
  priority: "entry" | "topic";
  estimatedLineCount: number;
  reason: string;
  evidence: string[];
}

interface InstructionTopicAudit extends InstructionTopic {
  selection: "selected" | "held-back";
  budgetStatus: "pass" | "fail";
  metadataStatus: "pass" | "fail";
}

interface InstructionBudget {
  status: "pass" | "fail";
  entryEstimatedLineCount: number;
  minEntryLineCount: number;
  maxEntryLineCount: number;
  hardConstraintCount: number;
  maxHardConstraints: number;
  alwaysLoadedTopicCount: number;
  maxAlwaysLoadedTopics: number;
  selectedTopicCount: number;
  availableTopicCount: number;
  heldBackTopicCount: number;
  selectedTopicEstimatedLineCount: number;
  minTopicLineCount: number;
  maxTopicLineCount: number;
  revealRatio: number;
  loadedSignalRatio: number;
  checks: InstructionBudgetCheck[];
}

interface InstructionBudgetCheck {
  id: string;
  status: "pass" | "fail";
  actual: number | string;
  expected: string;
  reason: string;
  evidence: string[];
}

export async function writeInstructionRoutingLedger(input: InstructionRoutingLedgerInput): Promise<InstructionRoutingLedgerResult> {
  const ledger = buildInstructionRoutingLedger(input);
  const target = path.join(input.outputDir, INSTRUCTION_ROUTING_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: INSTRUCTION_ROUTING_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: "instruction_router_resolved",
      name: "Instruction router resolved",
      status: ledger.status,
      details:
        ledger.status === "pass"
          ? `Instruction router selected ${ledger.selectedTopics.length} topic route(s), held back ${ledger.heldBackTopics.length} non-applicable topic(s), and passed instruction budget checks.`
          : `Instruction router has unresolved item(s): ${ledger.unresolved.map((item) => item.id).join(", ")}.`,
      evidence: [target],
      repairable: true,
    },
  };
}

export function instructionRoutingLedgerEvents(runId: string, result: InstructionRoutingLedgerResult): TraceEvent[] {
  return [
    {
      id: stableId("event", `${runId}:runtime.instruction_router.created:${result.ledger.id}`),
      runId,
      type: "runtime.instruction_router.created",
      timestamp: new Date().toISOString(),
      artifactId: INSTRUCTION_ROUTING_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Selected ${result.ledger.selectedTopics.length} instruction topic route(s); held back ${result.ledger.heldBackTopics.length}.`,
      evidence: [INSTRUCTION_ROUTING_LEDGER_ARTIFACT],
    },
  ];
}

function buildInstructionRoutingLedger(input: InstructionRoutingLedgerInput): InstructionRoutingLedger {
  const hardConstraints = buildHardConstraints(input.spec);
  const availableTopics = buildAvailableTopics(input.spec);
  const selectedTopics = selectTopics(availableTopics, input.spec);
  const selectedTopicIds = new Set(selectedTopics.map((topicItem) => topicItem.id));
  const heldBackTopics = availableTopics.filter((topicItem) => !selectedTopicIds.has(topicItem.id));
  const entryEstimatedLineCount = estimateEntryLineCount(hardConstraints, selectedTopics);
  const topicAudit = buildTopicAudit(availableTopics, selectedTopicIds);
  const instructionBudget = buildInstructionBudget({
    hardConstraints,
    selectedTopics,
    heldBackTopics,
    topicAudit,
    entryEstimatedLineCount,
  });
  const subsystemCoverage = subsystemCoverageFor(selectedTopics);
  const unresolved = [
    ...(!hardConstraints.length ? [{ id: "hard-constraints-missing", reason: "Entry instructions must include non-negotiable constraints.", evidence: ["AGENTS.md"] }] : []),
    ...(hardConstraints.length > 15 ? [{ id: "too-many-hard-constraints", reason: "Entry instructions should stay compact with no more than 15 hard constraints.", evidence: hardConstraints.map((constraint) => constraint.id) }] : []),
    ...(selectedTopics.filter((topic) => topic.priority === "entry").length > 8
      ? [
          {
            id: "too-many-entry-topics",
            reason: "Entry instructions should route to a small set of always-loaded topics instead of loading every detail.",
            evidence: selectedTopics.filter((topic) => topic.priority === "entry").map((topic) => topic.id),
          },
        ]
      : []),
    ...selectedTopics
      .filter((topic) => !topic.source || !topic.appliesWhen || !topic.expiryCondition || !topic.reason)
      .map((topic) => ({
        id: `incomplete-topic-${topic.id}`,
        reason: "Instruction topics must declare source, applicability, expiry, and routing reason.",
        evidence: [topic.id],
      })),
    ...hardConstraints
      .filter((constraint) => !constraint.source || !constraint.appliesWhen || !constraint.expiryCondition)
      .map((constraint) => ({
        id: `incomplete-constraint-${constraint.id}`,
        reason: "Hard constraints must declare source, applicability, and expiry.",
        evidence: [constraint.id],
      })),
    ...instructionBudget.checks
      .filter((check) => check.status === "fail")
      .map((check) => ({
        id: check.id,
        reason: check.reason,
        evidence: check.evidence,
      })),
    ...subsystemCoverage
      .filter((coverage) => coverage.status === "missing")
      .map((coverage) => ({
        id: `missing-${coverage.subsystem}-topic`,
        reason: `Instruction routing did not cover the ${coverage.subsystem} subsystem.`,
        evidence: selectedTopics.map((topic) => topic.id),
      })),
  ];
  return {
    schemaVersion: 2,
    id: stableId("instruction-routing-ledger", `${input.runId}:${selectedTopics.map((topic) => topic.id).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status: unresolved.length ? "fail" : "pass",
    rule: "Entry instructions must behave as a compact router: keep entry guidance within budget, cap hard constraints, reveal detailed topic guidance only when applicable, attach source/applicability/expiry metadata, and cover instructions, tools, environment, state, and feedback.",
    entryFile: {
      role: "router",
      estimatedLineCount: entryEstimatedLineCount,
      minRecommendedLineCount: 50,
      maxRecommendedLineCount: 200,
      maxHardConstraints: 15,
      maxAlwaysLoadedTopics: 8,
      hardConstraints,
    },
    instructionBudget,
    selectedTopics,
    heldBackTopics,
    topicAudit,
    subsystemCoverage,
    unresolved,
  };
}

function buildHardConstraints(spec: HarnessSpec): InstructionConstraint[] {
  return [
    {
      id: "repo-is-source-of-truth",
      text: "Source-of-truth inputs and run artifacts must answer fresh-session system, organization, run, verification, and progress questions before generated work is treated as durable.",
      source: "source-of-record-ledger.json",
      appliesWhen: "Every workflow run.",
      expiryCondition: "When source-of-record questions, authority ranking, or durable state rules change.",
    },
    {
      id: "validators-own-passing-state",
      text: "Required features may pass only through runtime validator results.",
      source: "sprint-contract.json",
      appliesWhen: "Before any completion claim.",
      expiryCondition: "When feature state transitions or validator ownership rules change.",
    },
    {
      id: "manifest-bound-runtime",
      text: "Executors and workers must be selected from manifest and contract bindings.",
      source: "capability-packs/",
      appliesWhen: "Whenever graph nodes need providers.",
      expiryCondition: "When provider selection moves outside capability packs or worker contracts.",
    },
    {
      id: "approval-before-side-effect",
      text: "Destructive, source-of-truth, or external side effects require an approval gate.",
      source: "approval-gate.json",
      appliesWhen: spec.checkpoints.length ? `This run has ${spec.checkpoints.length} checkpoint(s).` : "Whenever a permission requires human review.",
      expiryCondition: "When approval policy, permission tiers, or checkpoint semantics change.",
    },
    {
      id: "clean-handoff-before-complete",
      text: "Progress, run state, validation evidence, environment readiness, context-budget evidence, source-of-record answers, architecture-boundary evidence, completion-authority evidence, continuity evidence, course-alignment evidence, verified completion-rate evidence, clean-state evidence, lifecycle, diagnostic, and handoff artifacts must exist before completion.",
      source: "lifecycle-ledger.json",
      appliesWhen: "Before final status is persisted.",
      expiryCondition: "When clean-exit required artifacts or lifecycle gates change.",
    },
  ];
}

function buildAvailableTopics(spec: HarnessSpec): InstructionTopic[] {
  const topics: InstructionTopic[] = [
    topic({
      id: "entry-map",
      title: "Entry Map",
      subsystem: "instructions",
      source: "AGENTS.md",
      appliesWhen: "Always loaded as the compact routing layer.",
      expiryCondition: "When AGENTS.md stops being a short router or no longer links to verification/run guidance.",
      revealPolicy: "always",
      priority: "entry",
      estimatedLineCount: 60,
      reason: "A harness should expose a short entry map instead of a giant instruction file.",
      evidence: ["AGENTS.md", "README.md"],
    }),
    topic({
      id: "runtime-control",
      title: "Runtime Control Contracts",
      subsystem: "tools",
      source: "worker-contracts/workflow-runtime.json",
      appliesWhen: "Whenever workers, executors, replacement slots, policy, approval, budget, tool-safety classification, context budgeting, hooks, or trace context are needed.",
      expiryCondition: "When worker contracts, replacement slots, tool safety, context budgeting, runtime bus, or dispatch semantics change.",
      revealPolicy: "always",
      priority: "entry",
      estimatedLineCount: 90,
      reason: "Provider selection, context budgeting, and gates must be explicit contracts, not hidden prompt instructions.",
      evidence: ["worker-function-registry.json", "provider-replacement-registry.json", "tool-safety-ledger.json", "context-budget-ledger.json", "function-dispatch-plan.json", "runtime-bus.json"],
    }),
    topic({
      id: "source-environment",
      title: "Source And Environment Readiness",
      subsystem: "environment",
      source: "environment-readiness-ledger.json",
      appliesWhen: "Whenever declared sources or local runtime prerequisites affect generation.",
      expiryCondition: "When source authority, freshness checks, or local runtime prerequisites change.",
      revealPolicy: "always",
      priority: "entry",
      estimatedLineCount: 70,
      reason: "The runtime must ground work in available sources, runtime metadata, reproducible dependencies, and output isolation before artifacts depend on them.",
      evidence: ["environment-readiness-ledger.json", "source-of-record-ledger.json", "evidence-graph.json", ...spec.sources.map((source) => source.location)],
    }),
    topic({
      id: "state-handoff",
      title: "State And Handoff",
      subsystem: "state",
      source: "docs/harness-engineering-operational-record.md",
      appliesWhen: "Every run that may need resume, review, or clean exit.",
      expiryCondition: "When restartable state, continuity, progress, handoff, or clean-state artifacts change.",
      revealPolicy: "always",
      priority: "entry",
      estimatedLineCount: 80,
      reason: "Long-running work needs restartable state outside conversation memory.",
      evidence: ["feature-list.json", "progress.md", "session-handoff.md", "environment-readiness-ledger.json", "context-budget-ledger.json", "source-of-record-ledger.json", "architecture-boundary-ledger.json", "evaluator-rubric.json", "completion-authority-ledger.json", "quality-document.json", "continuity-ledger.json", "course-alignment-ledger.json", "lifecycle-ledger.json", "verification-pipeline-ledger.json", "session-clean-state-ledger.json", "harness-quality-ledger.json"],
    }),
    topic({
      id: "feedback-diagnostics",
      title: "Feedback And Diagnostics",
      subsystem: "feedback",
      source: "docs/dynamic-harness-architecture.md",
      appliesWhen: "Whenever validation, council review, feedback promotion, or diagnostic attribution runs.",
      expiryCondition: "When feedback promotion, diagnostic attribution, repair guidance, or subsystem audit contracts change.",
      revealPolicy: "always",
      priority: "entry",
      estimatedLineCount: 90,
      reason: "Completion judgment and failure attribution belong inside the harness feedback loop.",
      evidence: ["validation-report.md", "council-review.json", "architecture-boundary-ledger.json", "evaluator-rubric.json", "completion-authority-ledger.json", "quality-document.json", "course-alignment-ledger.json", "verification-pipeline-ledger.json", "feedback-promotion-ledger.json", "harness-diagnostic-ledger.json", "repair-guidance-ledger.json", "harness-subsystem-audit.json", "harness-ablation-comparison.json", "harness-quality-ledger.json"],
    }),
    topic({
      id: "app-building-fullstack",
      title: "App-Building Full-Stack Pack",
      subsystem: "instructions",
      source: "capability-packs/app-building-fullstack.json",
      appliesWhen: "PRD or app-building artifacts require UI, API, persistence, tests, accessibility, or deployment planning.",
      expiryCondition: "When app-building contracts or acceptance criteria change.",
      revealPolicy: "when-source-matches",
      priority: "topic",
      estimatedLineCount: 120,
      reason: "App workflows need domain instructions only when app contracts are selected.",
      evidence: spec.artifactContracts.map((artifact) => artifact.id).filter((id) => id.startsWith("app-")),
    }),
    topic({
      id: "motion-lottie",
      title: "Motion Lottie Pack",
      subsystem: "instructions",
      source: "capability-packs/motion-lottie.json",
      appliesWhen: "Lottie, SVG, animation, or motion artifacts are selected.",
      expiryCondition: "When motion artifact contracts, validators, or capability-pack semantics change.",
      revealPolicy: "when-source-matches",
      priority: "topic",
      estimatedLineCount: 110,
      reason: "Motion-specific guidance should not be always loaded for non-motion work.",
      evidence: spec.artifactContracts.map((artifact) => artifact.id).filter((id) => id.includes("lottie") || id.includes("motion")),
    }),
    topic({
      id: "design-system-ui",
      title: "Design-System UI Pack",
      subsystem: "instructions",
      source: "capability-packs/design-system-ui.json",
      appliesWhen: "Design-system components, tokens, conformance, or UI artifacts are selected.",
      expiryCondition: "When design-system contracts or conformance checks change.",
      revealPolicy: "when-source-matches",
      priority: "topic",
      estimatedLineCount: 110,
      reason: "Design-system rules should be revealed only for design/UI workflows.",
      evidence: spec.artifactContracts.map((artifact) => artifact.id).filter((id) => id.includes("design") || id.includes("component")),
    }),
    topic({
      id: "deep-originality",
      title: "Deep And Originality Strategy",
      subsystem: "feedback",
      source: "README.md",
      appliesWhen: "Deep, tournament, automation, or explicit originality strategy is enabled.",
      expiryCondition: "When deep-mode strategy, originality scoring, or validation-plan rules change.",
      revealPolicy: "when-runtime-signal-appears",
      priority: "topic",
      estimatedLineCount: 70,
      reason: "Research/originality guidance should load only when the run asks for it.",
      evidence: [`hypothesisCount=${spec.cognitiveStrategy.hypothesisCount}`, ...spec.cognitiveStrategy.validationPlan],
    }),
  ];

  return uniqueTopics(topics);
}

function selectTopics(topics: InstructionTopic[], spec: HarnessSpec): InstructionTopic[] {
  return topics.filter((topicItem) => topicItem.revealPolicy === "always" || topicAppliesToSpec(topicItem, spec));
}

function topicAppliesToSpec(topicItem: InstructionTopic, spec: HarnessSpec): boolean {
  switch (topicItem.id) {
    case "app-building-fullstack":
      return hasAppArtifact(spec);
    case "motion-lottie":
      return hasMotionArtifact(spec);
    case "design-system-ui":
      return hasDesignArtifact(spec);
    case "deep-originality":
      return spec.mode === "deep" || spec.cognitiveStrategy.hypothesisCount > 0 || spec.cognitiveStrategy.originalityRequired;
    default:
      return false;
  }
}

function estimateEntryLineCount(hardConstraints: InstructionConstraint[], selectedTopics: InstructionTopic[]): number {
  const alwaysLoadedTopics = selectedTopics.filter((topicItem) => topicItem.priority === "entry").length;
  return 18 + hardConstraints.length * 3 + alwaysLoadedTopics * 5;
}

function buildTopicAudit(topics: InstructionTopic[], selectedTopicIds: Set<string>): InstructionTopicAudit[] {
  return topics.map((topicItem) => ({
    ...topicItem,
    selection: selectedTopicIds.has(topicItem.id) ? "selected" : "held-back",
    budgetStatus: topicItem.estimatedLineCount >= 50 && topicItem.estimatedLineCount <= 150 ? "pass" : "fail",
    metadataStatus: topicItem.source && topicItem.appliesWhen && topicItem.expiryCondition ? "pass" : "fail",
  }));
}

function buildInstructionBudget(input: {
  hardConstraints: InstructionConstraint[];
  selectedTopics: InstructionTopic[];
  heldBackTopics: InstructionTopic[];
  topicAudit: InstructionTopicAudit[];
  entryEstimatedLineCount: number;
}): InstructionBudget {
  const minEntryLineCount = 50;
  const maxEntryLineCount = 200;
  const maxHardConstraints = 15;
  const maxAlwaysLoadedTopics = 8;
  const minTopicLineCount = 50;
  const maxTopicLineCount = 150;
  const alwaysLoadedTopicCount = input.selectedTopics.filter((topicItem) => topicItem.priority === "entry").length;
  const selectedTopicEstimatedLineCount = input.selectedTopics.reduce((sum, topicItem) => sum + topicItem.estimatedLineCount, 0);
  const availableTopicCount = input.selectedTopics.length + input.heldBackTopics.length;
  const revealRatio = ratio(input.selectedTopics.length, availableTopicCount);
  const loadedSignalRatio = ratio(input.selectedTopics.length, input.selectedTopics.length);
  const metadataComplete =
    input.hardConstraints.every((constraint) => constraint.source && constraint.appliesWhen && constraint.expiryCondition) &&
    input.topicAudit.every((topicItem) => topicItem.metadataStatus === "pass");
  const topicDocsWithinBudget = input.topicAudit.every((topicItem) => topicItem.budgetStatus === "pass");
  const checks: InstructionBudgetCheck[] = [
    {
      id: "entry-file-budget",
      status: input.entryEstimatedLineCount >= minEntryLineCount && input.entryEstimatedLineCount <= maxEntryLineCount ? "pass" : "fail",
      actual: input.entryEstimatedLineCount,
      expected: `${minEntryLineCount}-${maxEntryLineCount} estimated lines`,
      reason: "Entry instructions should stay a compact map, not become the full manual.",
      evidence: ["AGENTS.md", "instruction-routing-ledger.json"],
    },
    {
      id: "hard-constraint-budget",
      status: input.hardConstraints.length <= maxHardConstraints ? "pass" : "fail",
      actual: input.hardConstraints.length,
      expected: `<=${maxHardConstraints} hard constraints`,
      reason: "Hard constraints lose force when the always-loaded layer is overloaded.",
      evidence: input.hardConstraints.map((constraint) => constraint.id),
    },
    {
      id: "always-loaded-topic-budget",
      status: alwaysLoadedTopicCount <= maxAlwaysLoadedTopics ? "pass" : "fail",
      actual: alwaysLoadedTopicCount,
      expected: `<=${maxAlwaysLoadedTopics} always-loaded topic routes`,
      reason: "Always-loaded topic routes must stay small enough to be scanned at startup.",
      evidence: input.selectedTopics.filter((topicItem) => topicItem.priority === "entry").map((topicItem) => topicItem.id),
    },
    {
      id: "topic-document-budget",
      status: topicDocsWithinBudget ? "pass" : "fail",
      actual: input.topicAudit.map((topicItem) => `${topicItem.id}:${topicItem.estimatedLineCount}`).join(", "),
      expected: `${minTopicLineCount}-${maxTopicLineCount} estimated lines per topic document`,
      reason: "Topic guidance should be large enough to be useful but small enough to read on demand.",
      evidence: input.topicAudit.map((topicItem) => topicItem.id),
    },
    {
      id: "source-applicability-expiry-metadata",
      status: metadataComplete ? "pass" : "fail",
      actual: metadataComplete ? "complete" : "missing",
      expected: "every hard constraint and topic declares source, applicability, and expiry",
      reason: "Instruction guidance must explain where it came from, when it applies, and when to revisit it.",
      evidence: [...input.hardConstraints.map((constraint) => constraint.id), ...input.topicAudit.map((topicItem) => topicItem.id)],
    },
    {
      id: "reveal-on-demand",
      status: input.heldBackTopics.length > 0 || input.selectedTopics.length === availableTopicCount ? "pass" : "fail",
      actual: `${input.selectedTopics.length} selected / ${input.heldBackTopics.length} held back`,
      expected: "select matching topics and hold back non-applicable topics",
      reason: "The router should avoid loading domain guidance until the run has a matching source or runtime signal.",
      evidence: [...input.selectedTopics.map((topicItem) => topicItem.id), ...input.heldBackTopics.map((topicItem) => topicItem.id)],
    },
  ];
  return {
    status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
    entryEstimatedLineCount: input.entryEstimatedLineCount,
    minEntryLineCount,
    maxEntryLineCount,
    hardConstraintCount: input.hardConstraints.length,
    maxHardConstraints,
    alwaysLoadedTopicCount,
    maxAlwaysLoadedTopics,
    selectedTopicCount: input.selectedTopics.length,
    availableTopicCount,
    heldBackTopicCount: input.heldBackTopics.length,
    selectedTopicEstimatedLineCount,
    minTopicLineCount,
    maxTopicLineCount,
    revealRatio,
    loadedSignalRatio,
    checks,
  };
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }
  return Number((numerator / denominator).toFixed(3));
}

function topic(input: InstructionTopic): InstructionTopic {
  return input;
}

function subsystemCoverageFor(topics: InstructionTopic[]) {
  const subsystems: HarnessSubsystemId[] = ["instructions", "tools", "environment", "state", "feedback"];
  return subsystems.map((subsystem) => {
    const topicIds = topics.filter((topic) => topic.subsystem === subsystem).map((topic) => topic.id);
    return {
      subsystem,
      topicIds,
      status: topicIds.length ? ("covered" as const) : ("missing" as const),
    };
  });
}

function hasAppArtifact(spec: HarnessSpec): boolean {
  return spec.artifactContracts.some((artifact) => artifact.id.startsWith("app-"));
}

function hasMotionArtifact(spec: HarnessSpec): boolean {
  return spec.artifactContracts.some((artifact) => artifact.type === "lottie-json" || artifact.id.includes("lottie") || artifact.id.includes("motion"));
}

function hasDesignArtifact(spec: HarnessSpec): boolean {
  return spec.artifactContracts.some((artifact) => artifact.type === "react-component" || artifact.id.includes("design") || artifact.id.includes("component"));
}

function uniqueTopics(topics: InstructionTopic[]): InstructionTopic[] {
  const byId = new Map<string, InstructionTopic>();
  for (const topicItem of topics) {
    byId.set(topicItem.id, topicItem);
  }
  return [...byId.values()];
}
