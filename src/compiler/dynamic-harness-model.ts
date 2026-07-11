import type {
  ArtifactContract,
  DynamicHarnessModel,
  HarnessFeature,
  HarnessMode,
  HarnessNode,
  HarnessRequest,
  ValidatorBinding,
  ValidatorSpec,
  VerificationLayer,
  WorkflowNode,
} from "../types.js";
import { slugify, stableId } from "../utils/fs.js";

type DynamicHarnessArtifact = ArtifactContract & {
  producedBy?: string;
};

export interface DynamicHarnessModelInput {
  request: HarnessRequest;
  mode: HarnessMode;
  artifacts: DynamicHarnessArtifact[];
  harnessNodes?: HarnessNode[];
  workflowNodes?: WorkflowNode[];
  validatorBindings?: ValidatorBinding[];
  validators?: ValidatorSpec[];
}

export function buildDynamicHarnessModel(input: DynamicHarnessModelInput): DynamicHarnessModel {
  const features = buildFeatureList(input);
  const verificationHierarchy = buildVerificationHierarchy(input, features);
  return {
    schemaVersion: 1,
    subsystems: [
      {
        id: "instructions",
        purpose: "Constrain the run through a compiled HarnessSpec, capability packs, worker contracts, and permission checkpoints.",
        plannedArtifacts: ["harness-spec.json", "sprint-contract.json", "instruction-routing-ledger.json"],
        evaluationCriteria: ["Spec is source-grounded", "scope and exclusions are explicit", "permissions and checkpoints are visible", "topic instructions are routed on demand"],
      },
      {
        id: "tools",
        purpose: "Select artifact generators, validators, and workers through explicit registry bindings, policy gates, approval gates, budget gates, shared runtime bus topics, hooks, trace context, and invocation evidence instead of hidden runtime branches.",
        plannedArtifacts: ["executor-lock.json", "worker-lock.json", "worker-function-registry.json", "provider-replacement-registry.json", "tool-safety-ledger.json", "context-budget-ledger.json", "function-dispatch-plan.json", "runtime-bus.json", "function-invocation-ledger.json", "startup-readiness.json", "policy-gate.json", "approval-gate.json", "budget-gate.json", "hook-ledger.json", "trace-context.json"],
        evaluationCriteria: ["Executors are locked", "workers are locked", "worker functions are registered", "provider replacement slots are resolved", "tool calls are fail-closed and concurrency-classified", "context is budgeted with SELECT/WRITE/COMPRESS/ISOLATE operations", "function dispatch is planned by node", "runtime bus topics and state namespaces are resolved", "function invocations are evidenced", "startup readiness is explicit", "policy is checked before dispatch", "approval is resolved before dispatch", "budget is allocated before dispatch", "hooks are recorded", "trace context is propagated", "unknown capabilities fail before runtime"],
      },
      {
        id: "environment",
        purpose: "Prove requested sources, local runtime prerequisites, dependency reproducibility, output isolation, and repo guidance before generation depends on them.",
        plannedArtifacts: ["system-profiles.json", "evidence-graph.json", "environment-readiness-ledger.json", "source-of-record-ledger.json"],
        evaluationCriteria: ["source_availability is evaluated", "environment_readiness_confirmed is evaluated", "missing sources block dependent features", "runtime commands and dependency lockfiles are inspectable", "fresh-session source-of-record questions are answered from repo/run artifacts"],
      },
      {
        id: "state",
        purpose: "Keep feature scheduling, lifecycle state, feature state, progress, run state, and handoff data outside conversation memory.",
        plannedArtifacts: ["initialization-checklist.json", "feature-scheduler.json", "context-budget-ledger.json", "continuity-ledger.json", "course-alignment-ledger.json", "lifecycle-ledger.json", "session-clean-state-ledger.json", "feature-list.json", "progress.md", "run-state.json", "session-handoff.md"],
        evaluationCriteria: ["initialization is checked before implementation", "one feature list is authoritative", "WIP=1 activation is scheduler-owned", "context budget, write-back, compaction, and isolation are explicit", "continuity decisions and restart inputs are recorded", "course alignment is mapped to artifacts and validators", "lifecycle phases are recorded", "session clean state is checked", "passing state is validator-gated", "handoff is restartable"],
      },
      {
        id: "feedback",
        purpose: "Externalize completion judgment through layered validators, executable architecture-boundary rules, independent completion authority, verified completion-rate accounting, council review, agent-oriented failure evidence, diagnostic attribution, subsystem scoring, quality documentation, and controlled ablation comparison candidates.",
        plannedArtifacts: ["verification-hierarchy.json", "evaluator-rubric.json", "evaluator-rubric.md", "architecture-boundary-ledger.json", "completion-authority-ledger.json", "verification-pipeline-ledger.json", "validation-report.md", "council-review.json", "feedback-promotion-ledger.json", "harness-diagnostic-ledger.json", "repair-guidance-ledger.json", "harness-subsystem-audit.json", "harness-ablation-comparison.json", "quality-document.json", "quality-document.md", "harness-quality-ledger.json", "course-alignment-ledger.json"],
        evaluationCriteria: ["static/runtime/system layers are represented", "evaluator rubric is externalized with evidence-backed dimensions", "architecture boundaries are executable and include what/why/fix guidance", "planner/generator/evaluator roles are separated before final authority", "verified completion rate is computed from feature state", "warnings keep runs partial", "failures include evidence", "repair guidance includes what/why/fix/next command", "review feedback becomes harness improvement candidates", "non-passing signals are attributed to harness subsystems", "five subsystem scores identify the current bottleneck", "quality documentation prioritizes next improvements", "course alignment is audited against the Learn Harness Engineering framework", "ablation comparison measures subsystem evidence loss"],
      },
    ],
    featureList: features,
    sprintContract: {
      id: stableId("sprint-contract", `${input.request.intent}:${features.map((feature) => feature.id).join("|")}`),
      scope: [
        `User intent: ${input.request.intent}`,
        `Mode: ${input.mode}`,
        ...input.artifacts.map((artifact) => `Produce ${artifact.type} contract '${artifact.id}'.`),
      ],
      exclusions: [
        "Do not silently modify source-of-truth inputs.",
        "Do not perform destructive writes or external side effects without an explicit checkpoint.",
        "Do not mark a feature passing without the runtime owning the validator result.",
      ],
      featureIds: features.map((feature) => feature.id),
      verificationStandards: verificationHierarchy.map((level) => `${level.layer}: ${level.passCriteria}`),
      evaluatorRubric: [
        { id: "correctness", name: "Functional correctness", minimumScore: 4, passCriteria: "Required feature validators pass without unresolved blocker questions." },
        { id: "source-grounding", name: "Source grounding", minimumScore: 4, passCriteria: "Artifacts and decisions cite available source evidence or explicit assumptions." },
        { id: "architecture", name: "Architecture compliance", minimumScore: 4, passCriteria: "Capability packs, executors, and workers remain manifest-driven." },
        { id: "observability", name: "Observability", minimumScore: 4, passCriteria: "Runtime and process artifacts explain what happened and why." },
        { id: "handoff", name: "Clean handoff", minimumScore: 4, passCriteria: "Progress, feature state, run state, and session handoff are written before completion." },
      ],
    },
    verificationHierarchy,
    lifecycle: {
      startupReadiness: ["can start from declared sources", "can prove environment readiness", "can route relevant instruction topics", "can budget context progressively", "can answer fresh-session source-of-record questions", "can run verification commands", "can see progress", "can pick the next scoped work", "can enforce a WIP=1 feature schedule", "can authorize workers", "can resolve approvals", "can budget the run", "can classify tool calls fail-closed", "can dispatch functions", "can resolve provider replacement slots", "can resolve runtime bus topics", "can prove function invocations", "can publish hooks", "can propagate trace context", "can enforce architecture boundaries", "can record evaluator rubric", "can confirm independent completion authority", "can attribute harness failures", "can repair from agent-oriented failure guidance", "can score five harness subsystems", "can measure subsystem ablation impact", "can record quality document", "can document run quality and next improvement priorities", "can record continuity state", "can confirm course alignment", "can prove verified completion rate", "can leave clean state"],
      cleanExit: ["build or compile passes", "required validators pass or explicitly block", "environment readiness confirmed", "instruction router passes", "context budget ready", "source of record confirmed", "worker/function registry passes", "provider replacement registry passes", "tool safety registry passes", "function dispatch plan passes", "runtime bus passes", "function invocation ledger passes", "startup readiness confirmed", "policy, approval, and budget gates pass", "hook ledger recorded", "trace context propagated", "architecture boundary rules enforced", "evaluator rubric recorded", "completion authority confirmed", "feedback promotion recorded", "diagnostic loop recorded", "repair guidance recorded", "harness subsystem audit recorded", "harness ablation comparison recorded", "quality document recorded", "harness quality documented", "continuity state recorded", "course alignment confirmed", "lifecycle ledger clean", "verified completion rate passed", "session clean state ready", "feature state updated", "progress and handoff written", "standard run state persisted"],
      handoffArtifacts: ["initialization-checklist.json", "feature-scheduler.json", "environment-readiness-ledger.json", "instruction-routing-ledger.json", "context-budget-ledger.json", "source-of-record-ledger.json", "evaluator-rubric.json", "evaluator-rubric.md", "architecture-boundary-ledger.json", "completion-authority-ledger.json", "continuity-ledger.json", "course-alignment-ledger.json", "lifecycle-ledger.json", "verification-pipeline-ledger.json", "session-clean-state-ledger.json", "feedback-promotion-ledger.json", "harness-diagnostic-ledger.json", "repair-guidance-ledger.json", "harness-subsystem-audit.json", "harness-ablation-comparison.json", "quality-document.json", "quality-document.md", "harness-quality-ledger.json", "feature-list.json", "progress.md", "session-handoff.md", "run-state.json", "worker-function-registry.json", "provider-replacement-registry.json", "tool-safety-ledger.json", "function-dispatch-plan.json", "runtime-bus.json", "function-invocation-ledger.json", "startup-readiness.json", "policy-gate.json", "approval-gate.json", "budget-gate.json", "hook-ledger.json", "trace-context.json"],
    },
  };
}

function buildFeatureList(input: DynamicHarnessModelInput): HarnessFeature[] {
  const sourceNodeIds = nodeIds(input, (node) => node.id.includes("source-availability"));
  const features: HarnessFeature[] = [
    {
      id: "F-000-initialization-readiness",
      behavior: "Before implementation starts, a fresh session can start the project, run verification, see progress, and pick exactly one next scoped feature from repo/run artifacts.",
      verificationCommand: "initialization_checklist_confirmed and feature_scheduler_ready must pass.",
      state: "not_started",
      validatorIds: ["initialization_checklist_confirmed", "feature_scheduler_ready"],
      dependsOn: [],
      evidence: ["package.json", "feature-scheduler.json", "feature-list.json", "progress.md", "sprint-contract.json", "initialization-checklist.json"],
      nodeIds: [],
      artifactIds: ["initialization-checklist", "feature-scheduler"],
      required: true,
      layer: "static",
    },
    {
      id: "F-001-source-readiness",
      behavior: "Declared source refs are checked before any generated artifact depends on them.",
      verificationCommand: "source_availability validation must pass, or dependent features remain blocked.",
      state: "not_started",
      validatorIds: ["source_availability"],
      dependsOn: ["F-000-initialization-readiness"],
      evidence: input.request.sources,
      nodeIds: sourceNodeIds,
      artifactIds: [],
      required: true,
      layer: "static",
    },
    {
      id: "F-002-environment-readiness",
      behavior: "Local runtime metadata, dependency reproducibility, build/test commands, declared sources, output isolation, and repo guidance are inspectable before generation starts.",
      verificationCommand: "environment_readiness_confirmed must pass, warn for source-less requests, or fail on unavailable required sources.",
      state: "not_started",
      validatorIds: ["environment_readiness_confirmed"],
      dependsOn: ["F-000-initialization-readiness", "F-001-source-readiness"],
      evidence: ["environment-readiness-ledger.json", "package.json", "package-lock.json", "tsconfig.json", "README.md", "AGENTS.md"],
      nodeIds: sourceNodeIds,
      artifactIds: ["environment-readiness-ledger"],
      required: true,
      layer: "static",
    },
  ];

  for (const [index, artifact] of input.artifacts.entries()) {
    const validatorIds = unique(artifact.validators);
    features.push({
      id: `F-${String(index + 3).padStart(3, "0")}-${slugify(artifact.id)}`,
      behavior: `Produce ${artifact.type} artifact contract '${artifact.id}' for the requested intent.`,
      verificationCommand: validatorIds.length ? `All artifact validators must pass: ${validatorIds.join(", ")}.` : "Artifact must be present in the run output and reviewed manually.",
      state: "not_started",
      validatorIds,
      dependsOn: ["F-001-source-readiness", "F-002-environment-readiness"],
      evidence: artifact.requiredFiles ?? [],
      nodeIds: unique([artifact.producedBy, ...nodeIdsForArtifact(input, artifact.id)].filter(Boolean) as string[]),
      artifactIds: [artifact.id],
      required: true,
      layer: artifact.humanReviewRequired ? "system" : "runtime",
    });
  }

  features.push({
    id: "F-998-runtime-control-plane",
    behavior: "Register selected workers/functions, resolve replaceable provider slots, classify tool/provider calls with fail-closed concurrency safety, budget context with SELECT/WRITE/COMPRESS/ISOLATE rules, resolve node dispatch routes, connect providers through a shared runtime bus, prove provider invocations, and pass startup, policy, approval, budget, hook, and trace-context gates before runtime work is judged complete.",
    verificationCommand: "worker_function_registry_resolved, provider_replacement_registry_ready, tool_safety_registry_ready, context_budget_ready, function_dispatch_plan_resolved, runtime_bus_resolved, function_invocation_ledger_completed, startup_readiness_confirmed, policy_gate_passed, approval_gate_resolved, budget_gate_passed, hook_ledger_recorded, and trace_context_propagated must pass.",
    state: "not_started",
    validatorIds: ["worker_function_registry_resolved", "provider_replacement_registry_ready", "tool_safety_registry_ready", "context_budget_ready", "function_dispatch_plan_resolved", "runtime_bus_resolved", "function_invocation_ledger_completed", "startup_readiness_confirmed", "policy_gate_passed", "approval_gate_resolved", "budget_gate_passed", "hook_ledger_recorded", "trace_context_propagated"],
    dependsOn: features.map((feature) => feature.id),
    evidence: ["worker-function-registry.json", "provider-replacement-registry.json", "tool-safety-ledger.json", "context-budget-ledger.json", "function-dispatch-plan.json", "runtime-bus.json", "function-invocation-ledger.json", "startup-readiness.json", "policy-gate.json", "approval-gate.json", "budget-gate.json", "hook-ledger.json", "trace-context.json"],
    nodeIds: nodeIds(input, (node) => Boolean(node.agentId || node.capabilityId || node.validatorId)),
    artifactIds: ["runtime-control-plane"],
    required: true,
    layer: "system",
  });

  features.push({
    id: "F-990-source-of-record",
    behavior: "Keep repository and run artifacts sufficient for a fresh session to answer what the system is, how it is organized, how to run it, how to verify it, what progress is current, which sources are authoritative, and whether state is durable.",
    verificationCommand: "source_of_record_confirmed must pass or explicitly warn when source authority is unavailable.",
    state: "not_started",
    validatorIds: ["source_of_record_confirmed"],
    dependsOn: features.map((feature) => feature.id),
    evidence: ["source-of-record-ledger.json", "harness-spec.json", "system-profiles.json", "evidence-graph.json", "initialization-checklist.json", "feature-list.json", "progress.md", "session-handoff.md", "run-plan.json", "verification-hierarchy.json"],
    nodeIds: nodeIds(input, (node) => node.kind === "analyze" || node.kind === "plan" || node.kind === "finalize"),
    artifactIds: ["source-of-record-ledger"],
    required: true,
    layer: "system",
  });

  features.push({
    id: "F-997-feedback-promotion",
    behavior: "Promote repairable validation signals, critic questions, missing evidence, unsafe assumptions, and course corrections into durable harness-improvement candidates.",
    verificationCommand: "feedback_promotion_recorded must pass.",
    state: "not_started",
    validatorIds: ["feedback_promotion_recorded"],
    dependsOn: features.map((feature) => feature.id),
    evidence: ["feedback-promotion-ledger.json", "council-review.json", "validation-report.md"],
    nodeIds: nodeIds(input, (node) => node.id.includes("council") || node.kind === "finalize"),
    artifactIds: ["feedback-promotion-ledger"],
    required: true,
    layer: "system",
  });

  features.push({
    id: "F-996-diagnostic-loop",
    behavior: "Attribute failed, warning, skipped, or unresolved blocker signals to the harness subsystem that needs improvement.",
    verificationCommand: "diagnostic_loop_recorded must pass.",
    state: "not_started",
    validatorIds: ["diagnostic_loop_recorded"],
    dependsOn: features.map((feature) => feature.id),
    evidence: ["harness-diagnostic-ledger.json", "validation-report.md", "council-review.json"],
    nodeIds: nodeIds(input, (node) => node.id.includes("council") || node.kind === "validate" || node.kind === "finalize"),
    artifactIds: ["harness-diagnostic-ledger"],
    required: true,
    layer: "system",
  });

  features.push({
    id: "F-994-repair-guidance",
    behavior: "Convert every failed, warning, skipped, or unresolved blocker signal into agent-oriented repair guidance with what failed, why it matters, how to fix it, the next command, evidence, and owning harness subsystem.",
    verificationCommand: "repair_guidance_recorded must pass.",
    state: "not_started",
    validatorIds: ["repair_guidance_recorded"],
    dependsOn: ["F-996-diagnostic-loop"],
    evidence: ["repair-guidance-ledger.json", "validation-report.md", "council-review.json", "harness-diagnostic-ledger.json"],
    nodeIds: nodeIds(input, (node) => node.id.includes("council") || node.kind === "validate" || node.kind === "finalize"),
    artifactIds: ["repair-guidance-ledger"],
    required: true,
    layer: "system",
  });

  features.push({
    id: "F-993-harness-subsystem-audit",
    behavior: "Score instructions, tools, environment, state, and feedback from runtime evidence, identify the current harness bottleneck, and leave a controlled ablation probe for measuring marginal subsystem value.",
    verificationCommand: "harness_subsystem_audit_recorded must pass.",
    state: "not_started",
    validatorIds: ["harness_subsystem_audit_recorded"],
    dependsOn: ["F-994-repair-guidance"],
    evidence: ["harness-subsystem-audit.json", "harness-diagnostic-ledger.json", "repair-guidance-ledger.json", "validation-report.md"],
    nodeIds: nodeIds(input, (node) => node.id.includes("council") || node.kind === "validate" || node.kind === "finalize"),
    artifactIds: ["harness-subsystem-audit"],
    required: true,
    layer: "system",
  });

  features.push({
    id: "F-992-harness-ablation-comparison",
    behavior: "Measure each subsystem ablation probe with artifact-evidence exclusion so marginal harness value is compared instead of assumed.",
    verificationCommand: "harness_ablation_comparison_recorded must pass.",
    state: "not_started",
    validatorIds: ["harness_ablation_comparison_recorded"],
    dependsOn: ["F-993-harness-subsystem-audit"],
    evidence: ["harness-ablation-comparison.json", "harness-subsystem-audit.json", "harness-diagnostic-ledger.json", "repair-guidance-ledger.json"],
    nodeIds: nodeIds(input, (node) => node.id.includes("council") || node.kind === "validate" || node.kind === "finalize"),
    artifactIds: ["harness-ablation-comparison"],
    required: true,
    layer: "system",
  });

  features.push({
    id: "F-991-architecture-boundaries",
    behavior: "Turn architecture boundary rules into executable checks with agent-oriented what/why/fix failure guidance before full-pipeline completion is accepted.",
    verificationCommand: "architecture_boundary_rules_enforced must pass.",
    state: "not_started",
    validatorIds: ["architecture_boundary_rules_enforced"],
    dependsOn: features.map((feature) => feature.id),
    evidence: ["architecture-boundary-ledger.json", "app-source/", "test-plan.md", "api-contract.json", "persistence-plan.md", "app-acceptance.md"],
    nodeIds: nodeIds(input, (node) => node.kind === "validate" || node.kind === "finalize"),
    artifactIds: ["architecture-boundary-ledger"],
    required: true,
    layer: "system",
  });

  features.push({
    id: "F-988-evaluator-rubric",
    behavior: "Externalize the evaluator rubric with scored correctness, source-grounding, architecture, observability, and handoff dimensions tied to validation, review, and invocation evidence.",
    verificationCommand: "evaluator_rubric_recorded must pass before completion authority can approve the run.",
    state: "not_started",
    validatorIds: ["evaluator_rubric_recorded"],
    dependsOn: features.map((feature) => feature.id),
    evidence: ["evaluator-rubric.json", "evaluator-rubric.md", "sprint-contract.json", "verification-hierarchy.json", "validation-report.md", "council-review.json", "function-invocation-ledger.json"],
    nodeIds: nodeIds(input, (node) => node.id.includes("council") || node.kind === "validate" || node.kind === "finalize"),
    artifactIds: ["evaluator-rubric"],
    required: true,
    layer: "system",
  });

  features.push({
    id: "F-989-completion-authority",
    behavior: "Separate planner, generator, evaluator, and final authority evidence so workers and artifact generators cannot judge their own completion.",
    verificationCommand: "completion_authority_confirmed must pass.",
    state: "not_started",
    validatorIds: ["completion_authority_confirmed"],
    dependsOn: features.map((feature) => feature.id),
    evidence: ["completion-authority-ledger.json", "evaluator-rubric.json", "function-invocation-ledger.json", "council-review.json", "verification-hierarchy.json", "validation-report.md"],
    nodeIds: nodeIds(input, (node) => Boolean(node.agentId || node.kind === "validate" || node.kind === "finalize")),
    artifactIds: ["completion-authority-ledger"],
    required: true,
    layer: "system",
  });

  features.push({
    id: "F-987-harness-quality-document",
    behavior: "Leave a run-level quality document and quality ledger that convert validation posture, completion authority, subsystem health, repair backlog, ablation priority, and handoff artifacts into next improvement priorities.",
    verificationCommand: "quality_document_recorded and harness_quality_documented must pass or explicitly warn/fail with priority repair actions.",
    state: "not_started",
    validatorIds: ["quality_document_recorded", "harness_quality_documented"],
    dependsOn: ["F-988-evaluator-rubric", "F-989-completion-authority", "F-992-harness-ablation-comparison"],
    evidence: ["quality-document.json", "quality-document.md", "harness-quality-ledger.json", "completion-authority-ledger.json", "harness-subsystem-audit.json", "harness-ablation-comparison.json", "harness-diagnostic-ledger.json", "repair-guidance-ledger.json", "feature-list.json", "progress.md", "session-handoff.md"],
    nodeIds: nodeIds(input, (node) => node.id.includes("council") || node.kind === "validate" || node.kind === "finalize"),
    artifactIds: ["harness-quality-ledger"],
    required: true,
    layer: "system",
  });

  features.push({
    id: "F-986-continuity-state",
    behavior: "Persist session continuity state with decision log, restart inputs, verification snapshot, next actions, and rebuild-cost estimate so long-running work resumes without chat history.",
    verificationCommand: "continuity_state_recorded must pass, or explicitly warn/fail when restart artifacts or rebuild-cost evidence are not clean.",
    state: "not_started",
    validatorIds: ["continuity_state_recorded"],
    dependsOn: ["F-990-source-of-record", "F-989-completion-authority", "F-987-harness-quality-document"],
    evidence: ["continuity-ledger.json", "source-of-record-ledger.json", "completion-authority-ledger.json", "harness-quality-ledger.json", "feature-list.json", "progress.md", "session-handoff.md", "run-state.json", "validation-report.md"],
    nodeIds: nodeIds(input, (node) => node.kind === "finalize" || node.kind === "validate" || node.kind === "plan"),
    artifactIds: ["continuity-ledger"],
    required: true,
    layer: "system",
  });

  features.push({
    id: "F-985-course-alignment",
    behavior: "Map the Learn Harness Engineering framework to concrete runtime artifacts, validators, subsystem coverage, and planned clean-handoff gates before claiming the dynamic harness architecture is aligned.",
    verificationCommand: "course_alignment_confirmed must pass, or explicitly warn/fail when course requirements lack artifact, validator, subsystem, or planned gate evidence.",
    state: "not_started",
    validatorIds: ["course_alignment_confirmed"],
    dependsOn: ["F-986-continuity-state", "F-987-harness-quality-document", "F-988-evaluator-rubric", "F-993-harness-subsystem-audit", "F-992-harness-ablation-comparison", "F-989-completion-authority"],
    evidence: ["course-alignment-ledger.json", "evaluator-rubric.json", "quality-document.json", "harness-quality-ledger.json", "continuity-ledger.json", "harness-subsystem-audit.json", "harness-ablation-comparison.json", "verification-hierarchy.json", "feature-list.json"],
    nodeIds: nodeIds(input, (node) => node.kind === "finalize" || node.kind === "validate" || node.kind === "plan"),
    artifactIds: ["course-alignment-ledger"],
    required: true,
    layer: "system",
  });

  features.push({
    id: "F-995-instruction-routing",
    behavior: "Keep entry instructions compact by routing only applicable topic guidance into the run.",
    verificationCommand: "instruction_router_resolved must pass.",
    state: "not_started",
    validatorIds: ["instruction_router_resolved"],
    dependsOn: ["F-000-initialization-readiness"],
    evidence: ["instruction-routing-ledger.json", "AGENTS.md", "capability-packs/"],
    nodeIds: nodeIds(input, (node) => node.kind === "plan" || node.kind === "analyze" || node.kind === "finalize"),
    artifactIds: ["instruction-routing-ledger"],
    required: true,
    layer: "system",
  });

  features.push({
    id: "F-999-clean-handoff",
    behavior: "Persist run state, validation evidence, verified completion-rate evidence, continuity state, course alignment, progress, and session handoff before declaring the run complete.",
    verificationCommand: "run_state_persisted validation must pass and lifecycle artifacts must be written; source_of_record_confirmed, architecture_boundary_rules_enforced, completion_authority_confirmed, continuity_state_recorded, course_alignment_confirmed, lifecycle_ledger_clean, verified_completion_rate_passed, and session_clean_state_ready are enforced as system completion gates.",
    state: "not_started",
    validatorIds: ["run_state_persisted"],
    dependsOn: features.filter((feature) => feature.id !== "F-001-source-readiness").map((feature) => feature.id),
    evidence: ["source-of-record-ledger.json", "architecture-boundary-ledger.json", "completion-authority-ledger.json", "continuity-ledger.json", "course-alignment-ledger.json", "lifecycle-ledger.json", "verification-pipeline-ledger.json", "session-clean-state-ledger.json", "run-state.json", "validation-report.md", "events.jsonl", "progress.md", "session-handoff.md"],
    nodeIds: nodeIds(input, (node) => node.kind === "finalize" || node.id === "finalize"),
    artifactIds: ["run-state"],
    required: true,
    layer: "system",
  });

  return features;
}

function buildVerificationHierarchy(input: DynamicHarnessModelInput, features: HarnessFeature[]) {
  const artifactValidatorIds = unique(input.artifacts.flatMap((artifact) => artifact.validators));
  const declaredValidatorIds = unique(input.validators?.map((validator) => validator.id) ?? []);
  const runtimeValidatorIds = unique([...artifactValidatorIds, ...declaredValidatorIds.filter((id) => !systemValidatorIds().includes(id) && id !== "source_availability" && id !== "initialization_checklist_confirmed" && id !== "feature_scheduler_ready")]);
  return [
    {
      layer: "static" as VerificationLayer,
      purpose: "Prove initialization, feature scheduling, and reject unavailable or untrusted starting inputs before generation.",
      validatorIds: ["initialization_checklist_confirmed", "feature_scheduler_ready", "source_availability", "environment_readiness_confirmed"],
      required: true,
      passCriteria: "Initialization, scheduler readiness, source availability, and environment readiness must not fail.",
    },
    {
      layer: "runtime" as VerificationLayer,
      purpose: "Verify generated artifacts and runnable behavior through registered local validators.",
      validatorIds: runtimeValidatorIds,
      required: true,
      passCriteria: "All artifact/runtime validators for required features must pass.",
    },
    {
      layer: "system" as VerificationLayer,
      purpose: "Prevent premature completion with council review, blocker resolution, evaluator rubric, independent completion authority, quality documentation, continuity state, course alignment, feature-state gating, verified completion-rate accounting, and clean handoff.",
      validatorIds: unique(["worker_function_registry_resolved", "provider_replacement_registry_ready", "tool_safety_registry_ready", "context_budget_ready", "function_dispatch_plan_resolved", "runtime_bus_resolved", "function_invocation_ledger_completed", "startup_readiness_confirmed", "policy_gate_passed", "approval_gate_resolved", "budget_gate_passed", "hook_ledger_recorded", "trace_context_propagated", "instruction_router_resolved", "source_of_record_confirmed", "architecture_boundary_rules_enforced", "evaluator_rubric_recorded", "completion_authority_confirmed", "feedback_promotion_recorded", "diagnostic_loop_recorded", "repair_guidance_recorded", "harness_subsystem_audit_recorded", "harness_ablation_comparison_recorded", "quality_document_recorded", "harness_quality_documented", "continuity_state_recorded", "course_alignment_confirmed", "lifecycle_ledger_clean", "verified_completion_rate_passed", "session_clean_state_ready", "council_review_complete", "critic_questions_present", "blocker_questions_resolved", "app_prd_critic_coverage", "feature_scope_state_gated", "run_state_persisted", ...features.filter((feature) => feature.layer === "system").flatMap((feature) => feature.validatorIds)]),
      required: true,
      passCriteria: "Council and feature gates must pass; warnings keep the run partial.",
    },
  ];
}

function nodeIdsForArtifact(input: DynamicHarnessModelInput, artifactId: string): string[] {
  const fromHarnessNodes = input.harnessNodes
    ?.filter((node) => node.outputs.some((output) => output.id === artifactId) || node.inputs.some((item) => item.ref === artifactId))
    .map((node) => node.id) ?? [];
  const fromWorkflowNodes = input.workflowNodes
    ?.filter((node) => node.artifactId === artifactId || node.produces?.includes(artifactId))
    .map((node) => node.id) ?? [];
  const fromValidatorBindings = input.validatorBindings?.filter((binding) => binding.artifactId === artifactId).map((binding) => binding.nodeId).filter(Boolean) as string[] | undefined;
  return unique([...fromHarnessNodes, ...fromWorkflowNodes, ...(fromValidatorBindings ?? [])]);
}

function nodeIds(input: DynamicHarnessModelInput, predicate: (node: HarnessNode | WorkflowNode) => boolean): string[] {
  return unique([...(input.harnessNodes ?? []), ...(input.workflowNodes ?? [])].filter(predicate).map((node) => node.id));
}

function systemValidatorIds(): string[] {
  return ["initialization_checklist_confirmed", "feature_scheduler_ready", "environment_readiness_confirmed", "worker_function_registry_resolved", "provider_replacement_registry_ready", "tool_safety_registry_ready", "context_budget_ready", "function_dispatch_plan_resolved", "runtime_bus_resolved", "function_invocation_ledger_completed", "startup_readiness_confirmed", "policy_gate_passed", "approval_gate_resolved", "budget_gate_passed", "hook_ledger_recorded", "trace_context_propagated", "instruction_router_resolved", "source_of_record_confirmed", "architecture_boundary_rules_enforced", "evaluator_rubric_recorded", "completion_authority_confirmed", "feedback_promotion_recorded", "diagnostic_loop_recorded", "repair_guidance_recorded", "harness_subsystem_audit_recorded", "harness_ablation_comparison_recorded", "quality_document_recorded", "harness_quality_documented", "continuity_state_recorded", "course_alignment_confirmed", "lifecycle_ledger_clean", "verified_completion_rate_passed", "session_clean_state_ready", "council_review_complete", "critic_questions_present", "blocker_questions_resolved", "app_prd_critic_coverage", "run_state_persisted", "feature_scope_state_gated"];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
