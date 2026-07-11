import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { afterEach } from "node:test";

import {
  buildEvidenceGraph,
  buildHarness,
  buildSourceRefs,
  compileHarnessIR,
  createDefaultCapabilityRegistry,
  resolveExecutorBindings,
  resolveWorkerBindings,
  routeRequest,
  synthesizeHarnessDraft,
  verifyHarnessDraft,
} from "../dist/index.js";
import { generateArtifacts } from "../dist/runtime/artifact-generator.js";
import { writeCouncilReview } from "../dist/runtime/council-reviewer.js";
import { runLottieValidators } from "../dist/validators/lottie/validate-lottie.js";

const testRuntimeRoot = path.resolve(".harness/tests", String(process.pid));
process.env.HARNESS_RUNTIME_ROOT = testRuntimeRoot;

afterEach(async () => {
  await rm(testRuntimeRoot, { recursive: true, force: true });
});

test("router classifies motion-lottie deep requests", () => {
  const decision = routeRequest({
    harness: "motion-lottie",
    mode: "deep",
    intent: "Create a premium Lottie logo reveal from SVG.",
    sources: ["fixtures/motion/logo.svg"],
    controls: ["background", "speed"],
    outputDir: "output/test",
  });
  assert.equal(decision.archetype, "visual-harness");
  assert.equal(decision.mode, "deep");
  assert.ok(decision.requiredAgents.includes("motion-director"));
  assert.ok(decision.requiredValidators.includes("valid_lottie_schema"));
  assert.equal(decision.composition.primaryPackId, "motion-lottie");
  assert.equal(decision.composition.composite, false);
  assert.ok(decision.composition.matchedPacks.some((pack) => pack.packId === "motion-lottie" && pack.score > 0));
  assert.match(decision.reason, /capability pack\(s\) 'motion-lottie'/);
});

test("router exposes scored composition for mixed domain requests", () => {
  const decision = routeRequest({
    harness: "workflows",
    mode: "deep",
    intent: "Build a polished onboarding app flow using the design system and a logo reveal animation.",
    sources: ["fixtures/design-system", "fixtures/motion/logo.svg"],
    controls: ["background", "speed"],
    outputDir: "output/test",
  });
  const packIds = decision.composition.matchedPacks.map((pack) => pack.packId);
  assert.equal(decision.composition.composite, true);
  assert.ok(packIds.includes("design-system-ui"));
  assert.ok(packIds.includes("motion-lottie"));
  assert.equal(decision.composition.primaryArchetype, decision.archetype);
  assert.ok(decision.composition.matchedPacks.every((pack) => pack.matchedBy.length > 0));
});

test("motion harness writes artifacts trace and passing core validators", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "harness-motion-"));
  try {
    const result = await buildHarness({
      harness: "motion-lottie",
      mode: "deep",
      intent: "Create a 4-second 30 FPS premium reveal.",
      sources: [path.resolve("fixtures/motion/logo.svg")],
      durationSeconds: 4,
      fps: 30,
      width: 512,
      height: 512,
      controls: ["background", "accentColor", "speed", "cameraIntensity"],
      outputDir,
    });
    assert.equal(result.trace.selectedArchetype, "visual-harness");
    assert.ok(result.artifacts.includes("animation.json"));
    assert.ok(result.artifacts.includes("harness-trace.json"));
    assert.equal(result.validations.find((item) => item.id === "valid_lottie_schema")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "controls_exist")?.status, "pass");
    const agentStatuses = new Map(result.trace.agentsSpawned.map((agent) => [agent.agentId, agent.status]));
    assert.equal(agentStatuses.get("persistence-architect"), "completed");
    assert.equal(agentStatuses.get("flow-runtime-manager"), "completed");
    assert.equal(agentStatuses.get("council-gstack-critic"), "completed");
    assert.equal(agentStatuses.get("council-gbrain-memory"), "completed");
    assert.equal(agentStatuses.get("council-verifier"), "completed");
    assert.equal(agentStatuses.get("council-course-corrector"), "completed");
    assert.equal(agentStatuses.get("lottie-engineer"), "completed");
    assert.equal(agentStatuses.get("finalizer"), "completed");
    assert.ok([...agentStatuses.values()].every((status) => status !== "planned_not_executed"));
    assert.ok(result.artifacts.includes("events.jsonl"));
    assert.ok(result.artifacts.includes("run-state.json"));
    assert.ok(result.artifacts.includes("feature-list.json"));
    assert.ok(result.artifacts.includes("sprint-contract.json"));
    assert.ok(result.artifacts.includes("verification-hierarchy.json"));
    assert.ok(result.artifacts.includes("progress.md"));
    assert.ok(result.artifacts.includes("initialization-checklist.json"));
    assert.ok(result.artifacts.includes("feature-scheduler.json"));
    assert.ok(result.artifacts.includes("environment-readiness-ledger.json"));
    assert.ok(result.artifacts.includes("instruction-routing-ledger.json"));
    assert.ok(result.artifacts.includes("source-of-record-ledger.json"));
    assert.ok(result.artifacts.includes("lifecycle-ledger.json"));
    assert.ok(result.artifacts.includes("feedback-promotion-ledger.json"));
    assert.ok(result.artifacts.includes("harness-diagnostic-ledger.json"));
    assert.ok(result.artifacts.includes("repair-guidance-ledger.json"));
    assert.ok(result.artifacts.includes("harness-subsystem-audit.json"));
    assert.ok(result.artifacts.includes("harness-ablation-comparison.json"));
    assert.ok(result.artifacts.includes("evaluator-rubric.json"));
    assert.ok(result.artifacts.includes("evaluator-rubric.md"));
    assert.ok(result.artifacts.includes("quality-document.json"));
    assert.ok(result.artifacts.includes("quality-document.md"));
    assert.ok(result.artifacts.includes("harness-quality-ledger.json"));
    assert.ok(result.artifacts.includes("continuity-ledger.json"));
    assert.ok(result.artifacts.includes("course-alignment-ledger.json"));
    assert.ok(result.artifacts.includes("architecture-boundary-ledger.json"));
    assert.ok(result.artifacts.includes("completion-authority-ledger.json"));
    assert.ok(result.artifacts.includes("verification-pipeline-ledger.json"));
    assert.ok(result.artifacts.includes("session-clean-state-ledger.json"));
    assert.ok(result.artifacts.includes("session-handoff.md"));
    assert.ok(result.artifacts.includes("harness-engineering-record.json"));
    assert.ok(result.artifacts.includes("executor-lock.json"));
    assert.ok(result.artifacts.includes("worker-lock.json"));
    assert.ok(result.artifacts.includes("run-plan.json"));
    assert.ok(result.artifacts.includes("worker-function-registry.json"));
    assert.ok(result.artifacts.includes("provider-replacement-registry.json"));
    assert.ok(result.artifacts.includes("tool-safety-ledger.json"));
    assert.ok(result.artifacts.includes("context-budget-ledger.json"));
    assert.ok(result.artifacts.includes("function-dispatch-plan.json"));
    assert.ok(result.artifacts.includes("runtime-bus.json"));
    assert.ok(result.artifacts.includes("function-invocation-ledger.json"));
    assert.ok(result.artifacts.includes("startup-readiness.json"));
    assert.ok(result.artifacts.includes("policy-gate.json"));
    assert.ok(result.artifacts.includes("approval-gate.json"));
    assert.ok(result.artifacts.includes("budget-gate.json"));
    assert.ok(result.artifacts.includes("hook-ledger.json"));
    assert.ok(result.artifacts.includes("trace-context.json"));
    assert.ok(result.artifacts.includes("council-review.json"));
    assert.ok(result.artifacts.includes("council-doctrine.json"));
    assert.ok(result.artifacts.includes("agent-runs/runtime-planning-manifest.json"));
    assert.ok(result.artifacts.includes("agent-runs/council-elders-manifest.json"));
    assert.ok(result.artifacts.includes("agent-runs/codex-host-critic-request.json"));
    assert.ok(result.artifacts.includes("agent-runs/codex-host-critic-request.md"));
    assert.ok(result.artifacts.includes("agent-runs/course-correction-manifest.json"));
    assert.ok(result.trace.events.some((event) => event.type === "artifact.written"));
    assert.ok(result.trace.events.some((event) => event.type === "council.reviewed"));
    assert.ok(result.trace.events.some((event) => event.type === "parallel_group.completed" && event.message.includes("runtime-planning")));
    assert.ok(result.trace.events.some((event) => event.type === "parallel_group.completed" && event.message.includes("council-elders")));
    assert.ok(result.trace.events.some((event) => event.type === "artifact.written" && event.artifactId === "feature-list.json"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.feature_scheduler.created"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.initialization.checked"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.environment_readiness.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.instruction_router.created"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.source_of_record.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.lifecycle_ledger.created"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.feedback_promotion.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.diagnostic_ledger.created"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.repair_guidance.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.subsystem_audit.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.ablation_comparison.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.evaluator_rubric.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.quality_document.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.quality_ledger.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.continuity_ledger.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.course_alignment.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.architecture_boundary.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.completion_authority.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.verification_pipeline.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.clean_state.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "artifact.written" && event.artifactId === "harness-engineering-record.json"));
    assert.ok(result.trace.events.some((event) => event.type === "run.plan.created"));
    assert.ok(result.trace.events.some((event) => event.type === "executor.bound"));
    assert.ok(result.trace.events.some((event) => event.type === "worker.bound" && event.message.includes("worker:runtime-planning")));
    assert.ok(result.trace.events.some((event) => event.type === "worker.bound" && event.message.includes("worker:council-elders")));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.registry.created"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.provider_registry.created"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.tool_safety.classified"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.context_budget.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.gate.checked" && event.validatorId === "policy_gate_passed"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.gate.checked" && event.validatorId === "approval_gate_resolved"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.hook.recorded"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.bus.created"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.trace_context.created"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.dispatch_plan.created"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.startup_readiness.checked"));
    assert.ok(result.trace.events.some((event) => event.type === "runtime.invocation_ledger.created"));
    assert.ok(result.spec.graph.some((node) => node.capabilityId === "artifact-generator:lottie-basic-reveal"));
    assert.ok(resolveExecutorBindings(result.spec, "artifact-generator").some((executor) => executor.adapter === "local:module" && executor.exportName === "generateMotionArtifacts"));
    assert.ok(resolveExecutorBindings(result.spec, "validator").some((executor) => executor.adapter === "local:module" && executor.exportName === "runLottieValidatorsExecutor"));
    assert.ok(resolveWorkerBindings(result.spec, "runtime-planning").some((binding) => binding.id === "worker:runtime-planning"));
    assert.ok(resolveWorkerBindings(result.spec, "council-elders").some((binding) => binding.id === "worker:council-elders"));
    assert.ok(resolveWorkerBindings(result.spec, "course-correction").some((binding) => binding.id === "worker:course-correction"));
    assert.equal(result.validations.find((item) => item.id === "initialization_checklist_confirmed")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "feature_scheduler_ready")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "environment_readiness_confirmed")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "instruction_router_resolved")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "run_state_persisted")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "worker_function_registry_resolved")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "provider_replacement_registry_ready")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "tool_safety_registry_ready")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "context_budget_ready")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "function_dispatch_plan_resolved")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "runtime_bus_resolved")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "function_invocation_ledger_completed")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "startup_readiness_confirmed")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "policy_gate_passed")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "approval_gate_resolved")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "budget_gate_passed")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "hook_ledger_recorded")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "trace_context_propagated")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "feedback_promotion_recorded")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "diagnostic_loop_recorded")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "repair_guidance_recorded")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "harness_subsystem_audit_recorded")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "harness_ablation_comparison_recorded")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "evaluator_rubric_recorded")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "quality_document_recorded")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "harness_quality_documented")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "continuity_state_recorded")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "course_alignment_confirmed")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "source_of_record_confirmed")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "architecture_boundary_rules_enforced")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "completion_authority_confirmed")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "lifecycle_ledger_clean")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "verified_completion_rate_passed")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "session_clean_state_ready")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "feature_scope_state_gated")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "harness_engineering_record_written")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "council_review_complete")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "critic_questions_present")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "blocker_questions_resolved")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "app_prd_critic_coverage")?.status, "pass");
    const runtimeManifest = JSON.parse(await readFile(path.join(outputDir, "agent-runs/runtime-planning-manifest.json"), "utf8"));
    assert.equal(runtimeManifest.executionModel, "parallel-promise-all");
    assert.deepEqual(new Set(runtimeManifest.agentIds), new Set(["persistence-architect", "flow-runtime-manager"]));
    assert.equal(runtimeManifest.workerBindings[0].id, "worker:runtime-planning");
    assert.equal(runtimeManifest.workerBindings[0].contractId, "contract:workflow-runtime-planning");
    assert.equal(runtimeManifest.workerBindings[0].functionId, "workflow.runtime.plan");
    assert.equal(runtimeManifest.workerBindings[0].triggerId, "workflow.group.runtime-planning");
    assert.equal(runtimeManifest.workerBindings[0].replacementCompatibilityKey, "workflow.runtime.plan@1");
    assert.equal(runtimeManifest.workerBindings[0].adapter, "local:module");
    assert.equal(runtimeManifest.workerBindings[0].exportName, "runWorkflowRuntimeWorker");
    assert.deepEqual(new Set(runtimeManifest.workerBindings[0].matchedAgentIds), new Set(["persistence-architect", "flow-runtime-manager"]));
    const councilManifest = JSON.parse(await readFile(path.join(outputDir, "agent-runs/council-elders-manifest.json"), "utf8"));
    assert.equal(councilManifest.executionModel, "parallel-promise-all");
    assert.deepEqual(new Set(councilManifest.agentIds), new Set(["council-gstack-critic", "council-gbrain-memory", "council-verifier"]));
    assert.equal(councilManifest.workerBindings[0].id, "worker:council-elders");
    assert.equal(councilManifest.workerBindings[0].contractId, "contract:workflow-council-elders");
    assert.equal(councilManifest.workerBindings[0].functionId, "workflow.council.review");
    assert.equal(councilManifest.criticContract.requiredOutput, "criticReview");
    assert.equal(councilManifest.criticContract.hostAdapter, "codex:host");
    assert.ok(councilManifest.workerBindings[0].adapterTypes.includes("codex:host"));
    assert.ok(councilManifest.workerBindings[0].references.includes("https://github.com/garrytan/gstack"));
    assert.ok(councilManifest.workerBindings[0].references.includes("https://github.com/garrytan/gbrain"));
    const codexHostCriticRequest = JSON.parse(await readFile(path.join(outputDir, "agent-runs/codex-host-critic-request.json"), "utf8"));
    assert.equal(codexHostCriticRequest.adapter, "codex:host");
    assert.equal(codexHostCriticRequest.requiredOutput.criticReview.questions[0].severity, "blocker | major | minor | note");
    const courseCorrectionManifest = JSON.parse(await readFile(path.join(outputDir, "agent-runs/course-correction-manifest.json"), "utf8"));
    assert.equal(courseCorrectionManifest.executionModel, "single-after-council-review");
    assert.equal(courseCorrectionManifest.workerBindings[0].id, "worker:course-correction");
    assert.equal(courseCorrectionManifest.workerBindings[0].contractId, "contract:workflow-course-correction");
    assert.equal(courseCorrectionManifest.workerBindings[0].functionId, "workflow.council.course_correct");
    assert.deepEqual(courseCorrectionManifest.workerBindings[0].matchedAgentIds, ["council-course-corrector"]);
    const persistenceRun = JSON.parse(await readFile(path.join(outputDir, "agent-runs/analyze-persistence__persistence-architect.json"), "utf8"));
    assert.equal(persistenceRun.group, "runtime-planning");
    assert.equal(persistenceRun.agentId, "persistence-architect");
    const councilReview = JSON.parse(await readFile(path.join(outputDir, "council-review.json"), "utf8"));
    assert.equal(councilReview.references.find((reference) => reference.id === "gstack")?.license, "MIT");
    assert.equal(councilReview.references.find((reference) => reference.id === "gbrain")?.license, "MIT");
    assert.ok(councilReview.references.find((reference) => reference.id === "gstack")?.principles.some((principle) => principle.id === "gstack-review-rituals"));
    assert.ok(councilReview.references.find((reference) => reference.id === "gbrain")?.principles.some((principle) => principle.id === "gbrain-citations-gap-analysis"));
    assert.ok(councilReview.steps.some((step) => step.id === "step-gstack-process" && step.status === "pass"));
    assert.ok(councilReview.steps.find((step) => step.id === "step-gstack-process")?.doctrinePrincipleIds.includes("gstack-specialist-team"));
    assert.ok(councilReview.steps.find((step) => step.id === "step-gbrain-memory")?.doctrinePrincipleIds.includes("gbrain-source-first"));
    assert.ok(councilReview.agentRunIds.length >= 3);
    assert.equal(councilReview.criticReviews.length, 3);
    assert.ok(councilReview.criticQuestions.length >= 6);
    assert.equal(councilReview.unresolvedBlockerQuestions.length, 0);
    const verifierRun = JSON.parse(await readFile(path.join(outputDir, "agent-runs/analyze-council-verifier__council-verifier.json"), "utf8"));
    assert.equal(verifierRun.criticReview.criticId, "council-verifier");
    assert.ok(verifierRun.criticReview.questions.length > 0);
    const councilDoctrine = JSON.parse(await readFile(path.join(outputDir, "council-doctrine.json"), "utf8"));
    assert.ok(councilDoctrine.references.some((reference) => reference.id === "gstack" && reference.sourceKind === "open-source-project"));
    assert.ok(councilDoctrine.references.some((reference) => reference.id === "gbrain" && reference.sourceKind === "open-source-project"));
    const executorLock = JSON.parse(await readFile(path.join(outputDir, "executor-lock.json"), "utf8"));
    assert.ok(executorLock.executors.some((executor) => executor.exportName === "generateMotionArtifacts"));
    assert.ok(executorLock.executors.some((executor) => executor.exportName === "runLottieValidatorsExecutor"));
    const workerLock = JSON.parse(await readFile(path.join(outputDir, "worker-lock.json"), "utf8"));
    assert.ok(workerLock.workers.some((worker) => worker.workerBindingId === "worker:runtime-planning" && worker.functionId === "workflow.runtime.plan" && worker.exportName === "runWorkflowRuntimeWorker"));
    assert.ok(workerLock.workers.every((worker) => worker.requiredPermissions.includes("filesystem-read")));
    assert.ok(
      workerLock.workers.some(
        (worker) =>
          worker.workerBindingId === "worker:council-elders" &&
          worker.functionId === "workflow.council.review" &&
          worker.adapterTypes.includes("codex:host") &&
          worker.criticContract.requiredOutput === "criticReview",
      ),
    );
    assert.ok(workerLock.workers.some((worker) => worker.workerBindingId === "worker:course-correction" && worker.replacementCompatibilityKey === "workflow.council.course_correct@1"));
    const workerFunctionRegistry = JSON.parse(await readFile(path.join(outputDir, "worker-function-registry.json"), "utf8"));
    assert.equal(workerFunctionRegistry.protocol.name, "harness.worker-function");
    assert.equal(workerFunctionRegistry.workerFunctions.length, workerLock.workers.length);
    assert.ok(workerFunctionRegistry.workerFunctions.some((worker) => worker.contract.functionId === "workflow.runtime.plan" && worker.nodeIds.includes("analyze:persistence")));
    assert.ok(workerFunctionRegistry.workerFunctions.some((worker) => worker.contract.triggerId === "workflow.group.council-elders" && worker.traceSpanId));
    assert.ok(workerFunctionRegistry.executorFunctions.some((executor) => executor.exportName === "generateMotionArtifacts" && executor.nodeIds.includes("generate:lottie")));
    assert.ok(workerFunctionRegistry.eventTopics.includes("workflow.council.reviewed"));
    assert.ok(workerFunctionRegistry.replacementCompatibilityKeys.includes("workflow.council.course_correct@1"));
    const initializationChecklist = JSON.parse(await readFile(path.join(outputDir, "initialization-checklist.json"), "utf8"));
    assert.equal(initializationChecklist.status, "pass");
    assert.equal(initializationChecklist.lifecyclePhase, "initialization");
    assert.equal(initializationChecklist.commands.build, "npm run build");
    assert.equal(initializationChecklist.commands.test, "npm test");
    assert.ok(initializationChecklist.checks.some((check) => check.id === "progress-surface-ready" && check.status === "pass" && check.evidence.includes("feature-scheduler.json")));
    assert.ok(initializationChecklist.checks.some((check) => check.id === "task-breakdown-ready" && check.status === "pass"));
    const featureScheduler = JSON.parse(await readFile(path.join(outputDir, "feature-scheduler.json"), "utf8"));
    assert.equal(featureScheduler.status, "pass");
    assert.equal(featureScheduler.policy.wipLimit, 1);
    assert.deepEqual(featureScheduler.activeFeatureIds, ["F-000-initialization-readiness"]);
    assert.equal(featureScheduler.summary.activeFeatureCount, 1);
    assert.equal(featureScheduler.summary.completionPressure, 21);
    assert.ok(featureScheduler.queue.find((entry) => entry.featureId === "F-000-initialization-readiness" && entry.scheduledState === "active"));
    assert.ok(featureScheduler.queue.every((entry) => entry.behavior && entry.verificationCommand));
    assert.equal(featureScheduler.unresolved.length, 0);
    const environmentReadinessLedger = JSON.parse(await readFile(path.join(outputDir, "environment-readiness-ledger.json"), "utf8"));
    assert.equal(environmentReadinessLedger.status, "pass");
    assert.equal(environmentReadinessLedger.summary.failedCheckCount, 0);
    assert.equal(environmentReadinessLedger.summary.warningCheckCount, 0);
    assert.equal(environmentReadinessLedger.summary.lockfileCount, 1);
    assert.equal(environmentReadinessLedger.runtime.packageManager, "npm");
    assert.ok(environmentReadinessLedger.checks.some((check) => check.id === "source-paths-available" && check.status === "pass"));
    assert.ok(environmentReadinessLedger.checks.some((check) => check.id === "output-directory-isolated" && check.status === "pass"));
    assert.equal(environmentReadinessLedger.unresolved.length, 0);
    const feedbackPromotionLedger = JSON.parse(await readFile(path.join(outputDir, "feedback-promotion-ledger.json"), "utf8"));
    assert.equal(feedbackPromotionLedger.status, "pass");
    assert.ok(feedbackPromotionLedger.sourceSummary.criticQuestionCount >= 6);
    assert.ok(feedbackPromotionLedger.sourceSummary.promotionCandidateCount >= feedbackPromotionLedger.sourceSummary.criticQuestionCount);
    assert.ok(feedbackPromotionLedger.candidates.some((candidate) => candidate.sourceType === "critic-question"));
    assert.ok(feedbackPromotionLedger.candidates.some((candidate) => candidate.target === "validator" || candidate.target === "harness-rule"));
    assert.equal(feedbackPromotionLedger.unresolved.length, 0);
    const instructionRoutingLedger = JSON.parse(await readFile(path.join(outputDir, "instruction-routing-ledger.json"), "utf8"));
    assert.equal(instructionRoutingLedger.status, "pass");
    assert.equal(instructionRoutingLedger.schemaVersion, 2);
    assert.equal(instructionRoutingLedger.entryFile.role, "router");
    assert.ok(instructionRoutingLedger.entryFile.estimatedLineCount >= instructionRoutingLedger.entryFile.minRecommendedLineCount);
    assert.ok(instructionRoutingLedger.entryFile.estimatedLineCount <= instructionRoutingLedger.entryFile.maxRecommendedLineCount);
    assert.ok(instructionRoutingLedger.entryFile.hardConstraints.length > 0);
    assert.ok(instructionRoutingLedger.entryFile.hardConstraints.length <= instructionRoutingLedger.entryFile.maxHardConstraints);
    assert.ok(instructionRoutingLedger.entryFile.hardConstraints.every((constraint) => constraint.source && constraint.appliesWhen && constraint.expiryCondition));
    assert.equal(instructionRoutingLedger.instructionBudget.status, "pass");
    assert.equal(instructionRoutingLedger.instructionBudget.hardConstraintCount, instructionRoutingLedger.entryFile.hardConstraints.length);
    assert.ok(instructionRoutingLedger.instructionBudget.alwaysLoadedTopicCount <= instructionRoutingLedger.instructionBudget.maxAlwaysLoadedTopics);
    assert.ok(instructionRoutingLedger.instructionBudget.checks.every((check) => check.status === "pass"));
    assert.ok(instructionRoutingLedger.selectedTopics.some((topic) => topic.id === "entry-map" && topic.priority === "entry"));
    assert.ok(instructionRoutingLedger.selectedTopics.some((topic) => topic.id === "motion-lottie" && topic.revealPolicy === "when-source-matches"));
    assert.ok(instructionRoutingLedger.selectedTopics.every((topic) => topic.source && topic.appliesWhen && topic.expiryCondition && topic.estimatedLineCount >= 50 && topic.estimatedLineCount <= 150));
    assert.ok(instructionRoutingLedger.heldBackTopics.some((topic) => topic.id === "app-building-fullstack"));
    assert.ok(instructionRoutingLedger.topicAudit.some((topic) => topic.id === "app-building-fullstack" && topic.selection === "held-back"));
    assert.ok(instructionRoutingLedger.topicAudit.some((topic) => topic.id === "motion-lottie" && topic.selection === "selected"));
    assert.ok(instructionRoutingLedger.topicAudit.every((topic) => topic.budgetStatus === "pass" && topic.metadataStatus === "pass"));
    assert.ok(instructionRoutingLedger.subsystemCoverage.every((coverage) => coverage.status === "covered"));
    assert.equal(instructionRoutingLedger.unresolved.length, 0);
    const harnessDiagnosticLedger = JSON.parse(await readFile(path.join(outputDir, "harness-diagnostic-ledger.json"), "utf8"));
    assert.equal(harnessDiagnosticLedger.status, "pass");
    assert.equal(harnessDiagnosticLedger.sourceSummary.validationSignalCount, 0);
    assert.equal(harnessDiagnosticLedger.sourceSummary.unresolvedBlockerQuestionCount, 0);
    assert.equal(harnessDiagnosticLedger.sourceSummary.attributionCount, 0);
    assert.equal(harnessDiagnosticLedger.layerSummary.length, 5);
    assert.equal(harnessDiagnosticLedger.unresolved.length, 0);
    const repairGuidanceLedger = JSON.parse(await readFile(path.join(outputDir, "repair-guidance-ledger.json"), "utf8"));
    assert.equal(repairGuidanceLedger.status, "pass");
    assert.equal(repairGuidanceLedger.sourceSummary.repairSignalCount, 0);
    assert.equal(repairGuidanceLedger.sourceSummary.repairActionCount, 0);
    assert.equal(repairGuidanceLedger.unresolved.length, 0);
    const harnessSubsystemAudit = JSON.parse(await readFile(path.join(outputDir, "harness-subsystem-audit.json"), "utf8"));
    assert.equal(harnessSubsystemAudit.status, "pass");
    assert.equal(harnessSubsystemAudit.summary.subsystemCount, 5);
    assert.equal(harnessSubsystemAudit.summary.primaryBottleneck, null);
    assert.equal(harnessSubsystemAudit.subsystems.length, 5);
    assert.ok(harnessSubsystemAudit.subsystems.every((subsystem) => subsystem.score === 5));
    assert.equal(harnessSubsystemAudit.ablationPlan.length, 5);
    assert.equal(harnessSubsystemAudit.unresolved.length, 0);
    const harnessAblationComparison = JSON.parse(await readFile(path.join(outputDir, "harness-ablation-comparison.json"), "utf8"));
    assert.equal(harnessAblationComparison.status, "pass");
    assert.equal(harnessAblationComparison.measurementMode, "artifact-evidence-exclusion");
    assert.equal(harnessAblationComparison.summary.measuredProbeCount, 5);
    assert.equal(harnessAblationComparison.summary.branchRerunProbeCount, 0);
    assert.equal(harnessAblationComparison.probes.length, 5);
    assert.ok(harnessAblationComparison.probes.every((probe) => probe.artifactExclusionMeasuredInThisRun === true));
    assert.ok(harnessAblationComparison.probes.every((probe) => probe.branchRerunExecuted === false));
    assert.equal(harnessAblationComparison.unresolved.length, 0);
    const evaluatorRubric = JSON.parse(await readFile(path.join(outputDir, "evaluator-rubric.json"), "utf8"));
    assert.equal(evaluatorRubric.status, "pass");
    assert.equal(evaluatorRubric.summary.dimensionCount, 5);
    assert.equal(evaluatorRubric.summary.passingDimensionCount, 5);
    assert.equal(evaluatorRubric.summary.failedDimensionCount, 0);
    assert.equal(evaluatorRubric.summary.warningDimensionCount, 0);
    assert.equal(evaluatorRubric.summary.lowestScore, 5);
    assert.ok(evaluatorRubric.dimensions.find((dimension) => dimension.id === "handoff")?.observedValidationIds.includes("run_state_persisted"));
    assert.equal(evaluatorRubric.unresolved.length, 0);
    const qualityDocument = JSON.parse(await readFile(path.join(outputDir, "quality-document.json"), "utf8"));
    assert.equal(qualityDocument.status, "pass");
    assert.equal(qualityDocument.grade, "A");
    assert.equal(qualityDocument.summary.moduleCount, 5);
    assert.equal(qualityDocument.summary.healthyModuleCount, 5);
    assert.equal(qualityDocument.summary.blockedModuleCount, 0);
    assert.equal(qualityDocument.summary.unresolvedCount, 0);
    assert.ok(qualityDocument.modules.every((module) => module.status === "healthy"));
    const harnessQualityLedger = JSON.parse(await readFile(path.join(outputDir, "harness-quality-ledger.json"), "utf8"));
    assert.equal(harnessQualityLedger.status, "pass");
    assert.equal(harnessQualityLedger.score, 100);
    assert.equal(harnessQualityLedger.grade, "A");
    assert.equal(harnessQualityLedger.summary.checkCount, 5);
    assert.equal(harnessQualityLedger.summary.failedCheckCount, 0);
    assert.equal(harnessQualityLedger.summary.warningCheckCount, 0);
    assert.equal(harnessQualityLedger.summary.unresolvedCount, 0);
    assert.ok(harnessQualityLedger.checks.every((check) => check.status === "pass"));
    assert.ok(harnessQualityLedger.priorities.length >= 1);
    const continuityLedger = JSON.parse(await readFile(path.join(outputDir, "continuity-ledger.json"), "utf8"));
    assert.equal(continuityLedger.status, "pass");
    assert.equal(continuityLedger.summary.decisionCount, 5);
    assert.equal(continuityLedger.summary.missingRestartArtifactCount, 0);
    assert.equal(continuityLedger.summary.failedCheckCount, 0);
    assert.equal(continuityLedger.summary.warningCheckCount, 0);
    assert.ok(continuityLedger.summary.nextActionCount >= 1);
    assert.ok(continuityLedger.summary.estimatedRebuildMinutes <= 3);
    assert.equal(continuityLedger.rebuildCost.status, "pass");
    assert.ok(continuityLedger.restart.requiredArtifacts.includes("feature-list.json"));
    assert.ok(continuityLedger.restart.requiredArtifacts.includes("progress.md"));
    assert.ok(continuityLedger.restart.requiredArtifacts.includes("session-handoff.md"));
    assert.ok(continuityLedger.restart.requiredArtifacts.includes("source-of-record-ledger.json"));
    assert.ok(continuityLedger.restart.requiredArtifacts.includes("evaluator-rubric.json"));
    assert.ok(continuityLedger.restart.requiredArtifacts.includes("quality-document.json"));
    assert.ok(continuityLedger.restart.requiredArtifacts.includes("completion-authority-ledger.json"));
    assert.ok(continuityLedger.restart.requiredArtifacts.includes("harness-quality-ledger.json"));
    assert.ok(continuityLedger.restart.requiredArtifacts.includes("startup-readiness.json"));
    assert.ok(continuityLedger.restart.requiredArtifacts.includes("run-state.json"));
    assert.ok(continuityLedger.restart.requiredArtifacts.includes("validation-report.md"));
    assert.ok(continuityLedger.restart.requiredArtifacts.includes("continuity-ledger.json"));
    assert.equal(continuityLedger.verificationSnapshot.finalStatusBeforeContinuity, "success");
    assert.equal(continuityLedger.verificationSnapshot.qualityScore, 100);
    assert.ok(continuityLedger.decisions.every((decision) => decision.why && decision.alternativesRejected.length && decision.evidence.length));
    const courseAlignmentLedger = JSON.parse(await readFile(path.join(outputDir, "course-alignment-ledger.json"), "utf8"));
    assert.equal(courseAlignmentLedger.status, "pass");
    assert.equal(courseAlignmentLedger.score, 100);
    assert.equal(courseAlignmentLedger.summary.requirementCount, 12);
    assert.equal(courseAlignmentLedger.summary.passingRequirementCount, 12);
    assert.equal(courseAlignmentLedger.summary.failedRequirementCount, 0);
    assert.equal(courseAlignmentLedger.summary.warningRequirementCount, 0);
    assert.equal(courseAlignmentLedger.summary.coveredSubsystemCount, 5);
    assert.equal(courseAlignmentLedger.summary.missingCurrentArtifactCount, 0);
    assert.equal(courseAlignmentLedger.summary.missingPlannedArtifactCount, 0);
    assert.equal(courseAlignmentLedger.summary.failedValidationCount, 0);
    assert.equal(courseAlignmentLedger.summary.warningValidationCount, 0);
    assert.equal(courseAlignmentLedger.summary.unresolvedCount, 0);
    assert.ok(courseAlignmentLedger.subsystemCoverage.every((coverage) => coverage.status === "pass"));
    assert.ok(courseAlignmentLedger.requirements.some((requirement) => requirement.id === "L05-continuity" && requirement.currentArtifacts.some((artifact) => artifact.id === "continuity-ledger.json" && artifact.status === "present")));
    assert.ok(courseAlignmentLedger.requirements.some((requirement) => requirement.id === "L09-independent-completion" && requirement.currentArtifacts.some((artifact) => artifact.id === "evaluator-rubric.json" && artifact.status === "present")));
    assert.ok(courseAlignmentLedger.requirements.some((requirement) => requirement.id === "L12-clean-state" && requirement.currentArtifacts.some((artifact) => artifact.id === "quality-document.json" && artifact.status === "present")));
    assert.ok(courseAlignmentLedger.requirements.some((requirement) => requirement.id === "L12-clean-state" && requirement.plannedValidations.some((validation) => validation.id === "session_clean_state_ready" && validation.status === "planned")));
    const lifecycleLedger = JSON.parse(await readFile(path.join(outputDir, "lifecycle-ledger.json"), "utf8"));
    assert.equal(lifecycleLedger.status, "pass");
    assert.equal(lifecycleLedger.finalStatusWithoutLifecycle, "success");
    assert.deepEqual(
      lifecycleLedger.phases.map((phase) => phase.id),
      ["plan-locked", "initialization-ready", "feature-scheduled", "environment-ready", "instructions-routed", "runtime-control-ready", "execution-evidenced", "architecture-boundaries-enforced", "verification-judged", "feature-state-gated", "source-of-record-confirmed", "feedback-promoted", "diagnostic-loop-recorded", "repair-guidance-recorded", "subsystem-audit-recorded", "ablation-comparison-recorded", "evaluator-rubric-recorded", "completion-authority-confirmed", "quality-document-recorded", "quality-documented", "continuity-recorded", "course-alignment-confirmed", "clean-handoff-ready"],
    );
    assert.ok(lifecycleLedger.phases.every((phase) => phase.status === "pass"));
    assert.equal(lifecycleLedger.cleanExit.missingArtifacts.length, 0);
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("lifecycle-ledger.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("environment-readiness-ledger.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("instruction-routing-ledger.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("feedback-promotion-ledger.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("harness-diagnostic-ledger.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("repair-guidance-ledger.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("harness-subsystem-audit.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("harness-ablation-comparison.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("evaluator-rubric.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("quality-document.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("harness-quality-ledger.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("continuity-ledger.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("course-alignment-ledger.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("source-of-record-ledger.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("architecture-boundary-ledger.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("completion-authority-ledger.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("provider-replacement-registry.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("tool-safety-ledger.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredArtifacts.includes("context-budget-ledger.json"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("feedback_promotion_recorded"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("environment_readiness_confirmed"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("instruction_router_resolved"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("diagnostic_loop_recorded"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("repair_guidance_recorded"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("harness_subsystem_audit_recorded"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("harness_ablation_comparison_recorded"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("evaluator_rubric_recorded"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("quality_document_recorded"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("harness_quality_documented"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("continuity_state_recorded"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("course_alignment_confirmed"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("source_of_record_confirmed"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("architecture_boundary_rules_enforced"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("completion_authority_confirmed"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("provider_replacement_registry_ready"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("tool_safety_registry_ready"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("context_budget_ready"));
    assert.ok(lifecycleLedger.cleanExit.requiredValidationIds.includes("feature_scope_state_gated"));
    const verificationPipelineLedger = JSON.parse(await readFile(path.join(outputDir, "verification-pipeline-ledger.json"), "utf8"));
    assert.equal(verificationPipelineLedger.status, "pass");
    assert.equal(verificationPipelineLedger.protocol.name, "harness.verification-pipeline");
      assert.equal(verificationPipelineLedger.summary.requiredFeatureCount, 21);
      assert.equal(verificationPipelineLedger.summary.verifiedFeatureCount, 21);
    assert.equal(verificationPipelineLedger.summary.verifiedCompletionRate, 1);
    assert.equal(verificationPipelineLedger.summary.requiredLevelCount, 3);
    assert.equal(verificationPipelineLedger.summary.unresolvedCount, 0);
    assert.ok(verificationPipelineLedger.featureCompletions.every((feature) => !feature.required || feature.countedAsVerified));
    assert.ok(verificationPipelineLedger.verificationLevels.every((level) => !level.required || level.status === "pass"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "function-invocation-ledger.json" && item.status === "present"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "tool-safety-ledger.json" && item.status === "present"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "tool_safety_registry_ready" && item.status === "pass"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "context-budget-ledger.json" && item.status === "present"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "context_budget_ready" && item.status === "pass"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "environment-readiness-ledger.json" && item.status === "present"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "environment_readiness_confirmed" && item.status === "pass"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "source-of-record-ledger.json" && item.status === "present"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "architecture-boundary-ledger.json" && item.status === "present"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "evaluator-rubric.json" && item.status === "present"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "evaluator_rubric_recorded" && item.status === "pass"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "completion-authority-ledger.json" && item.status === "present"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "completion_authority_confirmed" && item.status === "pass"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "quality-document.json" && item.status === "present"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "quality_document_recorded" && item.status === "pass"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "harness-quality-ledger.json" && item.status === "present"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "harness_quality_documented" && item.status === "pass"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "continuity-ledger.json" && item.status === "present"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "continuity_state_recorded" && item.status === "pass"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "course-alignment-ledger.json" && item.status === "present"));
      assert.ok(verificationPipelineLedger.fullPipelineEvidence.some((item) => item.id === "course_alignment_confirmed" && item.status === "pass"));
      const sourceOfRecordLedger = JSON.parse(await readFile(path.join(outputDir, "source-of-record-ledger.json"), "utf8"));
      assert.equal(sourceOfRecordLedger.status, "pass");
      assert.equal(sourceOfRecordLedger.summary.questionCount, 5);
      assert.equal(sourceOfRecordLedger.summary.answeredQuestionCount, 5);
      assert.equal(sourceOfRecordLedger.summary.failedCheckCount, 0);
      assert.equal(sourceOfRecordLedger.summary.warningCheckCount, 0);
      assert.equal(sourceOfRecordLedger.freshSessionAnswers.length, 5);
      assert.ok(sourceOfRecordLedger.freshSessionAnswers.every((answer) => answer.status === "pass"));
      assert.ok(sourceOfRecordLedger.checks.some((check) => check.id === "source-authority-ranked" && check.status === "pass"));
      assert.ok(sourceOfRecordLedger.checks.some((check) => check.id === "knowledge-decay-visible" && check.status === "pass"));
      assert.ok(sourceOfRecordLedger.checks.some((check) => check.id === "acid-state-discipline" && check.status === "pass"));
      assert.deepEqual(
        sourceOfRecordLedger.stateDiscipline.map((item) => item.id),
        ["atomicity", "consistency", "isolation", "durability"],
      );
      const architectureBoundaryLedger = JSON.parse(await readFile(path.join(outputDir, "architecture-boundary-ledger.json"), "utf8"));
    assert.equal(architectureBoundaryLedger.status, "pass");
    assert.equal(architectureBoundaryLedger.summary.ruleCount, 5);
    assert.equal(architectureBoundaryLedger.summary.failedRuleCount, 0);
    assert.equal(architectureBoundaryLedger.summary.violationCount, 0);
    assert.ok(architectureBoundaryLedger.rules.some((rule) => rule.id === "layer-import-direction" && rule.status === "pass"));
    assert.ok(architectureBoundaryLedger.rules.every((rule) => rule.why && rule.fix));
    const completionAuthorityLedger = JSON.parse(await readFile(path.join(outputDir, "completion-authority-ledger.json"), "utf8"));
    assert.equal(completionAuthorityLedger.status, "pass");
    assert.equal(completionAuthorityLedger.protocol.name, "harness.completion-authority");
    assert.deepEqual(
      completionAuthorityLedger.roles.map((role) => role.role),
      ["planner", "generator", "evaluator", "authority"],
    );
    assert.ok(completionAuthorityLedger.roles.every((role) => role.status === "pass"));
    assert.ok(completionAuthorityLedger.roles.find((role) => role.role === "planner")?.ownerIds.includes("persistence-architect"));
    assert.ok(completionAuthorityLedger.roles.find((role) => role.role === "generator")?.ownerIds.some((ownerId) => ownerId.startsWith("artifact-generator.")));
    assert.ok(completionAuthorityLedger.roles.find((role) => role.role === "evaluator")?.ownerIds.includes("council-verifier"));
    assert.equal(completionAuthorityLedger.summary.authorityGateCount, 7);
    assert.equal(completionAuthorityLedger.summary.failedAuthorityGateCount, 0);
    assert.equal(completionAuthorityLedger.summary.warningAuthorityGateCount, 0);
    assert.equal(completionAuthorityLedger.summary.unresolvedCount, 0);
    assert.ok(completionAuthorityLedger.authorityGates.some((gate) => gate.id === "planner-generator-evaluator-separated" && gate.status === "pass"));
    assert.ok(completionAuthorityLedger.authorityGates.some((gate) => gate.id === "three-layer-termination-covered" && gate.status === "pass"));
    assert.ok(completionAuthorityLedger.authorityGates.some((gate) => gate.id === "blockers-do-not-authorize-success" && gate.status === "pass"));
    const sessionCleanStateLedger = JSON.parse(await readFile(path.join(outputDir, "session-clean-state-ledger.json"), "utf8"));
    assert.equal(sessionCleanStateLedger.status, "pass");
    assert.equal(sessionCleanStateLedger.summary.checkCount, 6);
    assert.equal(sessionCleanStateLedger.summary.failedCheckCount, 0);
    assert.equal(sessionCleanStateLedger.summary.warningCheckCount, 0);
    assert.equal(sessionCleanStateLedger.summary.staleArtifactCount, 0);
    assert.equal(sessionCleanStateLedger.unresolved.length, 0);
    assert.ok(sessionCleanStateLedger.checks.some((check) => check.id === "startup-commands-declared" && check.status === "pass"));
    assert.ok(sessionCleanStateLedger.checks.some((check) => check.id === "completion-and-handoff-gates-clean" && check.status === "pass"));
    const functionDispatchPlan = JSON.parse(await readFile(path.join(outputDir, "function-dispatch-plan.json"), "utf8"));
    assert.equal(functionDispatchPlan.status, "pass");
    assert.equal(functionDispatchPlan.protocol.name, "harness.function-dispatch");
    assert.ok(functionDispatchPlan.providerRoutes.some((route) => route.routeType === "worker" && route.functionId === "workflow.runtime.plan" && route.nodeIds.includes("analyze:persistence")));
    assert.ok(functionDispatchPlan.providerRoutes.some((route) => route.routeType === "executor" && route.subjectId === "exec:motion-lottie-artifacts" && route.nodeIds.includes("generate:lottie")));
    assert.ok(functionDispatchPlan.providerRoutes.every((route) => route.gateArtifacts.includes("runtime-bus.json")));
    assert.ok(functionDispatchPlan.providerRoutes.every((route) => route.gateArtifacts.includes("provider-replacement-registry.json")));
    assert.ok(functionDispatchPlan.providerRoutes.every((route) => route.gateArtifacts.includes("tool-safety-ledger.json")));
    assert.ok(functionDispatchPlan.nodeDispatches.some((dispatch) => dispatch.nodeId === "generate:lottie" && dispatch.status === "dispatchable" && dispatch.executorRouteIds.length === 1));
    assert.equal(functionDispatchPlan.unresolved.length, 0);
    const providerReplacementRegistry = JSON.parse(await readFile(path.join(outputDir, "provider-replacement-registry.json"), "utf8"));
    assert.equal(providerReplacementRegistry.status, "pass");
    assert.equal(providerReplacementRegistry.protocol.name, "harness.provider-replacement");
    assert.equal(providerReplacementRegistry.summary.unresolvedCount, 0);
    assert.ok(providerReplacementRegistry.summary.providerCount >= providerReplacementRegistry.summary.workerProviderCount);
    assert.ok(providerReplacementRegistry.replacementSlots.some((slot) => slot.compatibilityKey === "workflow.runtime.plan@1" && slot.providerTypes.includes("worker")));
    assert.ok(providerReplacementRegistry.providers.some((provider) => provider.providerType === "executor" && provider.replacementCompatibilityKey.startsWith("executor:artifact-generator:") && provider.status === "replaceable"));
    const toolSafetyLedger = JSON.parse(await readFile(path.join(outputDir, "tool-safety-ledger.json"), "utf8"));
    assert.equal(toolSafetyLedger.status, "pass");
    assert.equal(toolSafetyLedger.protocol.name, "harness.tool-safety");
    assert.ok(toolSafetyLedger.protocol.permissionPipelineOrder.includes("policy"));
    assert.equal(toolSafetyLedger.summary.deniedCallCount, 0);
    assert.equal(toolSafetyLedger.summary.unclassifiedCallCount, 0);
    assert.ok(toolSafetyLedger.summary.callCount >= functionDispatchPlan.providerRoutes.length);
    assert.ok(toolSafetyLedger.calls.some((call) => call.subjectType === "executor" && call.functionId.includes("validator") && call.isReadOnly && call.isConcurrentSafe));
    assert.ok(toolSafetyLedger.calls.some((call) => call.subjectType === "worker" && call.functionId === "workflow.runtime.plan" && call.mutatesWorkspace && call.concurrencyScope === "isolated-output"));
    assert.ok(toolSafetyLedger.concurrencyPlan.some((segment) => segment.mode === "parallel" && segment.callIds.length > 0));
    assert.equal(toolSafetyLedger.unresolved.length, 0);
    const contextBudgetLedger = JSON.parse(await readFile(path.join(outputDir, "context-budget-ledger.json"), "utf8"));
    assert.equal(contextBudgetLedger.status, "pass");
    assert.equal(contextBudgetLedger.protocol.name, "harness.context-budget");
    assert.deepEqual(contextBudgetLedger.protocol.operations, ["SELECT", "WRITE", "COMPRESS", "ISOLATE"]);
    assert.equal(contextBudgetLedger.summary.tierCount, 3);
    assert.ok(contextBudgetLedger.summary.estimatedTokenCount <= contextBudgetLedger.summary.maxTokenBudget);
    assert.ok(contextBudgetLedger.tiers.some((tier) => tier.id === "tier-1-metadata" && tier.loadPolicy === "always" && tier.status === "pass"));
    assert.ok(contextBudgetLedger.tiers.some((tier) => tier.id === "tier-3-resources" && tier.loadPolicy === "on-demand" && tier.status === "pass"));
    assert.ok(contextBudgetLedger.operations.some((operation) => operation.operation === "SELECT" && operation.status === "pass"));
    assert.ok(contextBudgetLedger.operations.some((operation) => operation.operation === "WRITE" && operation.evidence.includes("session-handoff.md")));
    assert.ok(contextBudgetLedger.operations.some((operation) => operation.operation === "COMPRESS" && operation.evidence.includes("harness-trace.json")));
    assert.ok(contextBudgetLedger.operations.some((operation) => operation.operation === "ISOLATE" && operation.status === "pass"));
    assert.ok(contextBudgetLedger.memoizedBuilders.every((builder) => builder.status === "covered" && builder.invalidatedBy.length > 0));
    assert.ok(contextBudgetLedger.invalidationPoints.some((point) => point.id === "provider-lock-mutated" && point.invalidatesBuilderIds.includes("builder:tool-safety")));
    assert.ok(contextBudgetLedger.isolationBoundaries.some((boundary) => boundary.boundaryType === "coordinator-zero-inheritance" && boundary.contextSharing === "none"));
    assert.equal(contextBudgetLedger.unresolved.length, 0);
    const runtimeBus = JSON.parse(await readFile(path.join(outputDir, "runtime-bus.json"), "utf8"));
    assert.equal(runtimeBus.status, "pass");
    assert.equal(runtimeBus.protocol.name, "harness.runtime-bus");
    assert.ok(runtimeBus.topics.some((topic) => topic.name === "workflow.council.reviewed" && topic.kind === "worker-contract"));
    assert.ok(runtimeBus.topics.some((topic) => topic.name === "runtime.before_worker_dispatch" && topic.kind === "hook"));
    assert.ok(runtimeBus.subscribers.some((subscriber) => subscriber.subjectType === "worker" && subscriber.functionId === "workflow.council.review" && subscriber.routeIds.length > 0));
    assert.ok(runtimeBus.subscribers.some((subscriber) => subscriber.subjectType === "executor" && subscriber.publishesTo.some((topic) => topic.startsWith("artifact."))));
    assert.ok(runtimeBus.publications.some((publication) => publication.topic === "runtime.approval.checked" && publication.status === "recorded"));
    assert.ok(runtimeBus.stateNamespaces.some((namespace) => namespace.namespace === "workflow.council"));
    assert.equal(runtimeBus.unresolved.length, 0);
    const functionInvocationLedger = JSON.parse(await readFile(path.join(outputDir, "function-invocation-ledger.json"), "utf8"));
    assert.equal(functionInvocationLedger.status, "pass");
    assert.equal(functionInvocationLedger.protocol.name, "harness.function-invocation");
    assert.equal(functionInvocationLedger.summary.missingInvocationCount, 0);
    assert.ok(functionInvocationLedger.invocations.some((invocation) => invocation.nodeId === "generate:lottie" && invocation.status === "completed" && invocation.evidence.includes("animation.json")));
    assert.ok(functionInvocationLedger.invocations.some((invocation) => invocation.nodeId === "validate:lottie-json" && invocation.status === "completed" && invocation.evidence.includes("valid_lottie_schema")));
    assert.ok(functionInvocationLedger.invocations.some((invocation) => invocation.nodeId === "analyze:persistence" && invocation.status === "completed" && invocation.evidence.some((artifact) => artifact.endsWith("__persistence-architect.json"))));
    const startupReadiness = JSON.parse(await readFile(path.join(outputDir, "startup-readiness.json"), "utf8"));
    assert.equal(startupReadiness.status, "pass");
    assert.ok(startupReadiness.checklist.some((check) => check.id === "functions-registered" && check.status === "pass"));
    assert.ok(startupReadiness.checklist.some((check) => check.id === "provider-replacements-ready" && check.status === "pass"));
    assert.ok(startupReadiness.checklist.some((check) => check.id === "tool-safety-ready" && check.status === "pass"));
    assert.ok(startupReadiness.checklist.some((check) => check.id === "context-budget-ready" && check.status === "pass"));
    assert.ok(startupReadiness.checklist.some((check) => check.id === "runtime-bus-ready" && check.status === "pass"));
    assert.ok(startupReadiness.resumeArtifacts.includes("provider-replacement-registry.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("tool-safety-ledger.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("context-budget-ledger.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("function-dispatch-plan.json"));
      assert.ok(startupReadiness.resumeArtifacts.includes("runtime-bus.json"));
      assert.ok(startupReadiness.resumeArtifacts.includes("environment-readiness-ledger.json"));
      assert.ok(startupReadiness.resumeArtifacts.includes("instruction-routing-ledger.json"));
      assert.ok(startupReadiness.resumeArtifacts.includes("source-of-record-ledger.json"));
      assert.ok(startupReadiness.resumeArtifacts.includes("lifecycle-ledger.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("evaluator-rubric.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("quality-document.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("completion-authority-ledger.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("feedback-promotion-ledger.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("harness-diagnostic-ledger.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("repair-guidance-ledger.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("harness-subsystem-audit.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("harness-ablation-comparison.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("harness-quality-ledger.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("continuity-ledger.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("course-alignment-ledger.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("architecture-boundary-ledger.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("verification-pipeline-ledger.json"));
    assert.ok(startupReadiness.resumeArtifacts.includes("session-clean-state-ledger.json"));
    const policyGate = JSON.parse(await readFile(path.join(outputDir, "policy-gate.json"), "utf8"));
    assert.equal(policyGate.status, "pass");
    assert.ok(policyGate.decisions.some((decision) => decision.subjectType === "worker" && decision.functionId === "workflow.council.review" && decision.status === "allow"));
    assert.ok(policyGate.decisions.every((decision) => decision.status === "allow"));
    const approvalGate = JSON.parse(await readFile(path.join(outputDir, "approval-gate.json"), "utf8"));
    assert.equal(approvalGate.status, "pass");
    assert.equal(approvalGate.requiredRequestCount, 0);
    const budgetGate = JSON.parse(await readFile(path.join(outputDir, "budget-gate.json"), "utf8"));
    assert.equal(budgetGate.status, "pass");
    assert.equal(budgetGate.estimatedUsage.nodes, result.spec.graph.length);
    assert.ok(budgetGate.allocations.some((allocation) => allocation.nodeId === "generate:lottie" && allocation.executorLockIds.length === 1));
    const hookLedger = JSON.parse(await readFile(path.join(outputDir, "hook-ledger.json"), "utf8"));
    assert.equal(hookLedger.status, "pass");
    assert.ok(hookLedger.subscriptions.some((subscription) => subscription.hookId === "runtime.before_worker_dispatch"));
    assert.ok(hookLedger.emissions.some((emission) => emission.eventTopic === "runtime.approval.checked" && emission.subjectId === "approval-gate"));
    assert.ok(hookLedger.emissions.some((emission) => emission.eventTopic === "runtime.before_worker_dispatch" && emission.functionId === "workflow.council.review"));
    const traceContext = JSON.parse(await readFile(path.join(outputDir, "trace-context.json"), "utf8"));
    assert.equal(traceContext.propagationRule.includes("deterministic span"), true);
    assert.ok(traceContext.rootSpanId);
    assert.ok(traceContext.spans.some((span) => span.kind === "gate" && span.subjectId === "approval-gate" && span.parentSpanId));
    assert.ok(traceContext.spans.some((span) => span.kind === "worker-function" && span.functionId === "workflow.council.review" && span.parentSpanId));
    assert.ok(traceContext.spans.some((span) => span.kind === "hook" && span.artifactId === "hook-ledger.json"));
    assert.ok(traceContext.spans.some((span) => span.kind === "provider-replacement-registry" && span.artifactId === "provider-replacement-registry.json"));
    assert.ok(traceContext.spans.some((span) => span.kind === "tool-safety" && span.artifactId === "tool-safety-ledger.json"));
    assert.ok(traceContext.spans.some((span) => span.kind === "context-budget" && span.artifactId === "context-budget-ledger.json"));
    assert.ok(traceContext.spans.some((span) => span.kind === "runtime-bus" && span.artifactId === "runtime-bus.json"));
    const runPlan = JSON.parse(await readFile(path.join(outputDir, "run-plan.json"), "utf8"));
    assert.equal(runPlan.schedule.strategy, "parallel-topological");
    assert.ok(runPlan.executorLockDigest);
    assert.ok(runPlan.workerLockDigest);
    assert.ok(runPlan.nodes.some((node) => node.id === "generate:lottie" && node.executorLockIds.length === 1));
    assert.ok(runPlan.nodes.some((node) => node.id === "analyze:persistence" && node.workerLockIds.length === 1));
    assert.ok(runPlan.nodes.some((node) => node.id === "analyze:council-gstack" && node.workerLockIds.length === 1));
    assert.equal(result.spec.harnessModel.schemaVersion, 1);
    assert.ok(result.spec.harnessModel.featureList.some((feature) => feature.id === "F-001-source-readiness" && feature.state === "not_started"));
    assert.ok(result.spec.harnessModel.sprintContract.featureIds.includes("F-001-source-readiness"));
    const featureList = JSON.parse(await readFile(path.join(outputDir, "feature-list.json"), "utf8"));
    assert.equal(new Set(featureList.features.map((feature) => feature.id)).size, featureList.features.length);
    assert.equal(featureList.stateMachine.transitionRule, "Only runtime validation results may move required features into passing.");
    assert.ok(featureList.features.every((feature) => feature.state === "passing"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-000-initialization-readiness")?.validatorIds.includes("initialization_checklist_confirmed"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-000-initialization-readiness")?.validatorIds.includes("feature_scheduler_ready"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-002-environment-readiness")?.validatorIds.includes("environment_readiness_confirmed"));
    assert.ok(featureList.features.find((feature) => feature.artifactIds.includes("motion-lottie-output"))?.validatorIds.includes("valid_lottie_schema"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-998-runtime-control-plane")?.validatorIds.includes("policy_gate_passed"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-998-runtime-control-plane")?.validatorIds.includes("provider_replacement_registry_ready"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-998-runtime-control-plane")?.validatorIds.includes("tool_safety_registry_ready"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-998-runtime-control-plane")?.validatorIds.includes("context_budget_ready"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-998-runtime-control-plane")?.validatorIds.includes("function_dispatch_plan_resolved"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-998-runtime-control-plane")?.validatorIds.includes("runtime_bus_resolved"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-998-runtime-control-plane")?.validatorIds.includes("function_invocation_ledger_completed"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-998-runtime-control-plane")?.validatorIds.includes("startup_readiness_confirmed"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-998-runtime-control-plane")?.validatorIds.includes("approval_gate_resolved"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-998-runtime-control-plane")?.validatorIds.includes("trace_context_propagated"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-997-feedback-promotion")?.validatorIds.includes("feedback_promotion_recorded"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-996-diagnostic-loop")?.validatorIds.includes("diagnostic_loop_recorded"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-995-instruction-routing")?.validatorIds.includes("instruction_router_resolved"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-994-repair-guidance")?.validatorIds.includes("repair_guidance_recorded"));
      assert.ok(featureList.features.find((feature) => feature.id === "F-993-harness-subsystem-audit")?.validatorIds.includes("harness_subsystem_audit_recorded"));
      assert.ok(featureList.features.find((feature) => feature.id === "F-992-harness-ablation-comparison")?.validatorIds.includes("harness_ablation_comparison_recorded"));
      assert.ok(featureList.features.find((feature) => feature.id === "F-988-evaluator-rubric")?.validatorIds.includes("evaluator_rubric_recorded"));
      assert.ok(featureList.features.find((feature) => feature.id === "F-988-evaluator-rubric")?.evidence.includes("evaluator-rubric.json"));
      assert.ok(featureList.features.find((feature) => feature.id === "F-987-harness-quality-document")?.validatorIds.includes("quality_document_recorded"));
      assert.ok(featureList.features.find((feature) => feature.id === "F-987-harness-quality-document")?.validatorIds.includes("harness_quality_documented"));
      assert.ok(featureList.features.find((feature) => feature.id === "F-986-continuity-state")?.validatorIds.includes("continuity_state_recorded"));
      assert.ok(featureList.features.find((feature) => feature.id === "F-985-course-alignment")?.validatorIds.includes("course_alignment_confirmed"));
      assert.ok(featureList.features.find((feature) => feature.id === "F-990-source-of-record")?.validatorIds.includes("source_of_record_confirmed"));
      assert.ok(featureList.features.find((feature) => feature.id === "F-991-architecture-boundaries")?.validatorIds.includes("architecture_boundary_rules_enforced"));
    assert.ok(featureList.features.find((feature) => feature.id === "F-989-completion-authority")?.validatorIds.includes("completion_authority_confirmed"));
    const sprintContract = JSON.parse(await readFile(path.join(outputDir, "sprint-contract.json"), "utf8"));
    assert.ok(sprintContract.exclusions.includes("Do not mark a feature passing without the runtime owning the validator result."));
    assert.ok(sprintContract.evaluatorRubric.some((dimension) => dimension.id === "handoff"));
    const verificationHierarchy = JSON.parse(await readFile(path.join(outputDir, "verification-hierarchy.json"), "utf8"));
    assert.deepEqual(
      verificationHierarchy.levels.map((level) => level.layer),
      ["static", "runtime", "system"],
    );
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "static")?.validationResults.some((validation) => validation.id === "initialization_checklist_confirmed" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "static")?.validationResults.some((validation) => validation.id === "feature_scheduler_ready" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "static")?.validationResults.some((validation) => validation.id === "environment_readiness_confirmed" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "runtime")?.validationResults.some((validation) => validation.id === "valid_lottie_schema" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "budget_gate_passed" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "context_budget_ready" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "hook_ledger_recorded" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "function_dispatch_plan_resolved" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "runtime_bus_resolved" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "function_invocation_ledger_completed" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "instruction_router_resolved" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "feedback_promotion_recorded" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "diagnostic_loop_recorded" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "repair_guidance_recorded" && validation.status === "pass"));
      assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "harness_subsystem_audit_recorded" && validation.status === "pass"));
      assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "harness_ablation_comparison_recorded" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "evaluator_rubric_recorded" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "quality_document_recorded" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "harness_quality_documented" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "continuity_state_recorded" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "course_alignment_confirmed" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "source_of_record_confirmed" && validation.status === "pass"));
      assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "architecture_boundary_rules_enforced" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "completion_authority_confirmed" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "lifecycle_ledger_clean" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "verified_completion_rate_passed" && validation.status === "pass"));
    assert.ok(verificationHierarchy.levels.find((level) => level.layer === "system")?.validationResults.some((validation) => validation.id === "session_clean_state_ready" && validation.status === "pass"));
    const progress = await readFile(path.join(outputDir, "progress.md"), "utf8");
      assert.match(progress, /Feature states: 21 passing, 0 active, 0 blocked, 0 not_started/);
    const handoff = await readFile(path.join(outputDir, "session-handoff.md"), "utf8");
    assert.match(handoff, /Final status: success/);
    assert.match(handoff, /F-999-clean-handoff \[passing\]/);
    const harnessEngineeringRecord = JSON.parse(await readFile(path.join(outputDir, "harness-engineering-record.json"), "utf8"));
    assert.equal(harnessEngineeringRecord.framework.name, "Learn Harness Engineering");
    assert.deepEqual(
      harnessEngineeringRecord.subsystems.map((subsystem) => subsystem.id),
      ["instructions", "tools", "environment", "state", "feedback"],
    );
    assert.equal(harnessEngineeringRecord.startupReadiness.canInitialize.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canScheduleFeature.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canRouteInstructions.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canStart.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canDispatchFunctions.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canResolveProviderReplacements.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canResolveRuntimeBus.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canProveFunctionInvocations.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canAuthorize.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canResolveApprovals.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canBudget.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canBudgetContext.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canPublishHooks.status, "pass");
      assert.equal(harnessEngineeringRecord.startupReadiness.canPropagateTraceContext.status, "pass");
      assert.equal(harnessEngineeringRecord.startupReadiness.canEnforceArchitectureBoundaries.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canConfirmEnvironmentReadiness.status, "pass");
      assert.equal(harnessEngineeringRecord.startupReadiness.canAnswerFreshSessionQuestions.status, "pass");
      assert.equal(harnessEngineeringRecord.startupReadiness.canPromoteFeedback.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canRecordEvaluatorRubric.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canDiagnoseFailures.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canRepairFromFeedback.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canScoreSubsystems.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canMeasureAblations.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canRecordQualityDocument.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canDocumentQuality.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canRecordContinuity.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canConfirmCourseAlignment.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canProveLifecycle.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canProveVerifiedCompletionRate.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canConfirmCompletionAuthority.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canLeaveCleanState.status, "pass");
    assert.equal(harnessEngineeringRecord.startupReadiness.canSeeProgress.status, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.scopeSurface.artifact, "feature-list.json");
    assert.equal(harnessEngineeringRecord.scopeControl.scopeSurface.backingRunPlan.artifact, "run-plan.json");
    assert.equal(harnessEngineeringRecord.scopeControl.activationPolicy.parallelismBoundary, "Parallelism is allowed only where the verified graph and worker bindings make dependencies explicit.");
    assert.equal(harnessEngineeringRecord.scopeControl.activationPolicy.policyGate.artifact, "policy-gate.json");
    assert.equal(harnessEngineeringRecord.scopeControl.activationPolicy.approvalGate.artifact, "approval-gate.json");
    assert.equal(harnessEngineeringRecord.scopeControl.activationPolicy.budgetGate.artifact, "budget-gate.json");
    assert.equal(harnessEngineeringRecord.scopeControl.featureScheduler.artifact, "feature-scheduler.json");
    assert.equal(harnessEngineeringRecord.scopeControl.featureScheduler.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.featureScheduler.wipLimit, 1);
    assert.equal(harnessEngineeringRecord.scopeControl.instructionRouter.artifact, "instruction-routing-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.instructionRouter.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.runtimeFunctionRegistry.artifact, "worker-function-registry.json");
    assert.equal(harnessEngineeringRecord.scopeControl.providerReplacementRegistry.artifact, "provider-replacement-registry.json");
    assert.equal(harnessEngineeringRecord.scopeControl.providerReplacementRegistry.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.providerReplacementRegistry.unresolvedCount, 0);
    assert.equal(harnessEngineeringRecord.scopeControl.toolSafetyLedger.artifact, "tool-safety-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.toolSafetyLedger.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.toolSafetyLedger.deniedCallCount, 0);
    assert.equal(harnessEngineeringRecord.scopeControl.contextBudgetLedger.artifact, "context-budget-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.contextBudgetLedger.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.contextBudgetLedger.unresolvedCount, 0);
    assert.ok(harnessEngineeringRecord.scopeControl.contextBudgetLedger.estimatedTokenCount <= harnessEngineeringRecord.scopeControl.contextBudgetLedger.maxTokenBudget);
    assert.ok(harnessEngineeringRecord.scopeControl.contextBudgetLedger.isolationBoundaryCount >= 2);
    assert.equal(harnessEngineeringRecord.scopeControl.functionDispatchPlan.artifact, "function-dispatch-plan.json");
    assert.equal(harnessEngineeringRecord.scopeControl.runtimeBus.artifact, "runtime-bus.json");
    assert.equal(harnessEngineeringRecord.scopeControl.runtimeBus.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.runtimeBus.unresolvedCount, 0);
    assert.equal(harnessEngineeringRecord.scopeControl.functionInvocationLedger.artifact, "function-invocation-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.functionInvocationLedger.missingInvocationCount, 0);
    assert.equal(harnessEngineeringRecord.scopeControl.startupReadiness.artifact, "startup-readiness.json");
    assert.equal(harnessEngineeringRecord.scopeControl.hookLedger.artifact, "hook-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.traceContext.artifact, "trace-context.json");
      assert.equal(harnessEngineeringRecord.scopeControl.lifecycleLedger.artifact, "lifecycle-ledger.json");
      assert.equal(harnessEngineeringRecord.scopeControl.lifecycleLedger.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.environmentReadinessLedger.artifact, "environment-readiness-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.environmentReadinessLedger.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.environmentReadinessLedger.status, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.environmentReadinessLedger.failedCheckCount, 0);
    assert.equal(harnessEngineeringRecord.scopeControl.environmentReadinessLedger.lockfileCount, 1);
      assert.equal(harnessEngineeringRecord.scopeControl.sourceOfRecordLedger.artifact, "source-of-record-ledger.json");
      assert.equal(harnessEngineeringRecord.scopeControl.sourceOfRecordLedger.validationStatus, "pass");
      assert.equal(harnessEngineeringRecord.scopeControl.sourceOfRecordLedger.answeredQuestionCount, 5);
      assert.equal(harnessEngineeringRecord.scopeControl.sourceOfRecordLedger.failedCheckCount, 0);
      assert.equal(harnessEngineeringRecord.scopeControl.architectureBoundaryLedger.artifact, "architecture-boundary-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.architectureBoundaryLedger.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.architectureBoundaryLedger.failedRuleCount, 0);
    assert.equal(harnessEngineeringRecord.scopeControl.architectureBoundaryLedger.violationCount, 0);
    assert.equal(harnessEngineeringRecord.scopeControl.evaluatorRubric.artifact, "evaluator-rubric.json");
    assert.equal(harnessEngineeringRecord.scopeControl.evaluatorRubric.markdownArtifact, "evaluator-rubric.md");
    assert.equal(harnessEngineeringRecord.scopeControl.evaluatorRubric.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.completionAuthorityLedger.artifact, "completion-authority-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.completionAuthorityLedger.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.completionAuthorityLedger.status, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.completionAuthorityLedger.roleCount, 4);
    assert.equal(harnessEngineeringRecord.scopeControl.completionAuthorityLedger.failedAuthorityGateCount, 0);
    assert.equal(harnessEngineeringRecord.scopeControl.completionAuthorityLedger.unresolvedCount, 0);
    assert.equal(harnessEngineeringRecord.scopeControl.verificationPipelineLedger.artifact, "verification-pipeline-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.verificationPipelineLedger.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.verificationPipelineLedger.verifiedCompletionRate, 1);
    assert.equal(harnessEngineeringRecord.scopeControl.verificationPipelineLedger.unresolvedCount, 0);
    assert.equal(harnessEngineeringRecord.scopeControl.sessionCleanStateLedger.artifact, "session-clean-state-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.sessionCleanStateLedger.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.sessionCleanStateLedger.failedCheckCount, 0);
    assert.equal(harnessEngineeringRecord.scopeControl.sessionCleanStateLedger.staleArtifactCount, 0);
    assert.equal(harnessEngineeringRecord.scopeControl.feedbackPromotionLedger.artifact, "feedback-promotion-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.feedbackPromotionLedger.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.harnessDiagnosticLedger.artifact, "harness-diagnostic-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.harnessDiagnosticLedger.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.repairGuidanceLedger.artifact, "repair-guidance-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.repairGuidanceLedger.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.harnessSubsystemAudit.artifact, "harness-subsystem-audit.json");
    assert.equal(harnessEngineeringRecord.scopeControl.harnessSubsystemAudit.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.harnessAblationComparison.artifact, "harness-ablation-comparison.json");
    assert.equal(harnessEngineeringRecord.scopeControl.harnessAblationComparison.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.qualityDocument.artifact, "quality-document.json");
    assert.equal(harnessEngineeringRecord.scopeControl.qualityDocument.markdownArtifact, "quality-document.md");
    assert.equal(harnessEngineeringRecord.scopeControl.qualityDocument.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.harnessQualityLedger.artifact, "harness-quality-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.harnessQualityLedger.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.harnessQualityLedger.status, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.harnessQualityLedger.score, 100);
    assert.equal(harnessEngineeringRecord.scopeControl.harnessQualityLedger.grade, "A");
    assert.equal(harnessEngineeringRecord.scopeControl.harnessQualityLedger.nonPassingValidationCount, 0);
    assert.equal(harnessEngineeringRecord.scopeControl.harnessQualityLedger.lowestSubsystemScore, 5);
    assert.equal(harnessEngineeringRecord.scopeControl.continuityLedger.artifact, "continuity-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.continuityLedger.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.continuityLedger.status, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.continuityLedger.decisionCount, 5);
    assert.equal(harnessEngineeringRecord.scopeControl.continuityLedger.missingRestartArtifactCount, 0);
    assert.ok(harnessEngineeringRecord.scopeControl.continuityLedger.nextActionCount >= 1);
    assert.ok(harnessEngineeringRecord.scopeControl.continuityLedger.estimatedRebuildMinutes <= 3);
    assert.equal(harnessEngineeringRecord.scopeControl.courseAlignmentLedger.artifact, "course-alignment-ledger.json");
    assert.equal(harnessEngineeringRecord.scopeControl.courseAlignmentLedger.validationStatus, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.courseAlignmentLedger.status, "pass");
    assert.equal(harnessEngineeringRecord.scopeControl.courseAlignmentLedger.score, 100);
    assert.equal(harnessEngineeringRecord.scopeControl.courseAlignmentLedger.requirementCount, 12);
    assert.equal(harnessEngineeringRecord.scopeControl.courseAlignmentLedger.coveredSubsystemCount, 5);
      assert.ok(harnessEngineeringRecord.termination.validationHierarchy.some((validation) => validation.id === "feature_scope_state_gated"));
    assert.ok(harnessEngineeringRecord.termination.validationHierarchy.some((validation) => validation.id === "environment_readiness_confirmed"));
      assert.ok(harnessEngineeringRecord.termination.validationHierarchy.some((validation) => validation.id === "source_of_record_confirmed"));
      assert.ok(harnessEngineeringRecord.termination.validationHierarchy.some((validation) => validation.id === "architecture_boundary_rules_enforced"));
    assert.equal(harnessEngineeringRecord.termination.completionAuthority.artifact, "completion-authority-ledger.json");
    assert.equal(harnessEngineeringRecord.termination.completionAuthority.status, "pass");
    assert.ok(harnessEngineeringRecord.termination.completionAuthority.roles.some((role) => role.role === "evaluator" && role.ownerIds.includes("council-verifier")));
    assert.ok(harnessEngineeringRecord.termination.validationHierarchy.some((validation) => validation.id === "evaluator_rubric_recorded"));
    assert.ok(harnessEngineeringRecord.termination.validationHierarchy.some((validation) => validation.id === "completion_authority_confirmed"));
    assert.ok(harnessEngineeringRecord.termination.validationHierarchy.some((validation) => validation.id === "quality_document_recorded"));
    assert.ok(harnessEngineeringRecord.termination.validationHierarchy.some((validation) => validation.id === "harness_quality_documented"));
    assert.ok(harnessEngineeringRecord.termination.validationHierarchy.some((validation) => validation.id === "continuity_state_recorded"));
    assert.ok(harnessEngineeringRecord.termination.validationHierarchy.some((validation) => validation.id === "course_alignment_confirmed"));
    assert.ok(harnessEngineeringRecord.termination.validationHierarchy.some((validation) => validation.id === "verified_completion_rate_passed"));
    assert.ok(harnessEngineeringRecord.termination.validationHierarchy.some((validation) => validation.id === "session_clean_state_ready"));
    assert.ok(harnessEngineeringRecord.observability.runtimeArtifacts.includes("events.jsonl"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("initialization-checklist.json"));
      assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("feature-scheduler.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("environment-readiness-ledger.json"));
      assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("instruction-routing-ledger.json"));
      assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("source-of-record-ledger.json"));
      assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("architecture-boundary-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("evaluator-rubric.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("completion-authority-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("lifecycle-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("feedback-promotion-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("harness-diagnostic-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("repair-guidance-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("harness-subsystem-audit.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("harness-ablation-comparison.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("quality-document.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("harness-quality-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("continuity-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("course-alignment-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("verification-pipeline-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("session-clean-state-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("policy-gate.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("provider-replacement-registry.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("tool-safety-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("context-budget-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("function-dispatch-plan.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("runtime-bus.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("function-invocation-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("startup-readiness.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("approval-gate.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("hook-ledger.json"));
    assert.ok(harnessEngineeringRecord.observability.processArtifacts.includes("sprint-contract.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("initialization-checklist.json"));
      assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("feature-scheduler.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("environment-readiness-ledger.json"));
      assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("instruction-routing-ledger.json"));
      assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("context-budget-ledger.json"));
      assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("source-of-record-ledger.json"));
      assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("architecture-boundary-ledger.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("evaluator-rubric.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("completion-authority-ledger.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("lifecycle-ledger.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("feedback-promotion-ledger.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("harness-diagnostic-ledger.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("repair-guidance-ledger.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("harness-subsystem-audit.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("harness-ablation-comparison.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("quality-document.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("harness-quality-ledger.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("continuity-ledger.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("course-alignment-ledger.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("verification-pipeline-ledger.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("session-clean-state-ledger.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("feature-list.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("worker-function-registry.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("provider-replacement-registry.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("tool-safety-ledger.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("function-dispatch-plan.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("runtime-bus.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("function-invocation-ledger.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("startup-readiness.json"));
    assert.ok(harnessEngineeringRecord.continuity.durableStateArtifacts.includes("trace-context.json"));
    assert.equal(harnessEngineeringRecord.continuity.continuityLedger.artifact, "continuity-ledger.json");
    assert.equal(harnessEngineeringRecord.continuity.continuityLedger.status, "pass");
    assert.equal(harnessEngineeringRecord.continuity.continuityLedger.missingRestartArtifactCount, 0);
    assert.ok(harnessEngineeringRecord.cleanExit.requiredGates.every((gate) => gate.status === "pass"));
    const previewHtml = await readFile(path.join(outputDir, "preview.html"), "utf8");
    assert.match(previewHtml, /lottie\.loadAnimation/);
    assert.match(previewHtml, /animation-data/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("missing local sources fail validation and block planned agents", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "harness-missing-source-"));
  const missingSource = `${outputDir}-missing.svg`;
  try {
    const result = await buildHarness({
      harness: "motion-lottie",
      mode: "deep",
      intent: "Animate a source that does not exist.",
      sources: [missingSource],
      durationSeconds: 4,
      fps: 30,
      controls: [],
      outputDir,
    });
    assert.equal(result.trace.finalStatus, "failed");
    assert.ok(result.artifacts.includes("instruction-routing-ledger.json"));
    assert.ok(result.artifacts.includes("harness-diagnostic-ledger.json"));
    assert.ok(result.artifacts.includes("repair-guidance-ledger.json"));
    assert.ok(result.artifacts.includes("harness-subsystem-audit.json"));
    assert.equal(result.trace.sourcesLoaded[0]?.availability, "missing");
    assert.equal(result.trace.sourcesLoaded[0]?.trust, "low");
    assert.equal(result.validations.find((item) => item.id === "source_availability")?.status, "fail");
    assert.equal(result.validations.find((item) => item.id === "source_of_record_confirmed")?.status, "fail");
    assert.equal(result.validations.find((item) => item.id === "svg_source_available")?.status, "fail");
    assert.equal(result.validations.find((item) => item.id === "instruction_router_resolved")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "diagnostic_loop_recorded")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "repair_guidance_recorded")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "harness_subsystem_audit_recorded")?.status, "pass");
    const diagnosticLedger = JSON.parse(await readFile(path.join(outputDir, "harness-diagnostic-ledger.json"), "utf8"));
    assert.equal(diagnosticLedger.status, "pass");
    assert.ok(diagnosticLedger.sourceSummary.validationSignalCount >= 2);
    assert.ok(diagnosticLedger.attributions.some((attribution) => attribution.sourceId === "source_availability" && attribution.layer === "environment"));
    assert.ok(diagnosticLedger.attributions.some((attribution) => attribution.sourceId === "source_of_record_confirmed" && attribution.layer === "environment"));
    assert.ok(diagnosticLedger.attributions.some((attribution) => attribution.sourceId === "svg_source_available" && attribution.layer === "environment"));
    assert.equal(diagnosticLedger.unresolved.length, 0);
    const sourceOfRecordLedger = JSON.parse(await readFile(path.join(outputDir, "source-of-record-ledger.json"), "utf8"));
    assert.equal(sourceOfRecordLedger.status, "fail");
    assert.ok(sourceOfRecordLedger.unresolved.some((issue) => issue.id === "source-authority-ranked"));
    const repairGuidanceLedger = JSON.parse(await readFile(path.join(outputDir, "repair-guidance-ledger.json"), "utf8"));
    assert.equal(repairGuidanceLedger.status, "pass");
    assert.ok(repairGuidanceLedger.sourceSummary.repairSignalCount >= 2);
    assert.ok(repairGuidanceLedger.actions.some((action) => action.sourceId === "source_availability" && action.layer === "environment" && action.fix && action.nextCommand));
    assert.ok(repairGuidanceLedger.actions.some((action) => action.sourceId === "svg_source_available" && action.layer === "environment" && action.whyItMatters));
    assert.equal(repairGuidanceLedger.unresolved.length, 0);
    const harnessSubsystemAudit = JSON.parse(await readFile(path.join(outputDir, "harness-subsystem-audit.json"), "utf8"));
    assert.equal(harnessSubsystemAudit.status, "pass");
    assert.equal(harnessSubsystemAudit.summary.subsystemCount, 5);
    assert.equal(harnessSubsystemAudit.summary.primaryBottleneck, "environment");
    assert.ok(harnessSubsystemAudit.subsystems.find((subsystem) => subsystem.id === "environment")?.score < 5);
    assert.equal(harnessSubsystemAudit.unresolved.length, 0);
    const harnessAblationComparison = JSON.parse(await readFile(path.join(outputDir, "harness-ablation-comparison.json"), "utf8"));
    assert.equal(harnessAblationComparison.status, "pass");
    assert.equal(harnessAblationComparison.summary.measuredProbeCount, 5);
    assert.equal(harnessAblationComparison.summary.primaryMarginalSubsystem, "environment");
    assert.equal(harnessAblationComparison.unresolved.length, 0);
    assert.ok(result.trace.agentsSpawned.every((agent) => agent.status === "blocked"));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("cli exits nonzero for partial validation status", async () => {
  const sourceDir = await mkdtemp(path.join(os.tmpdir(), "harness-empty-design-source-"));
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "harness-empty-design-output-"));
  try {
    const cli = spawnSync(
      process.execPath,
      [
        path.resolve("dist/cli/harnessctl.js"),
        "design-system-ui",
        "standard",
        "--source",
        sourceDir,
        "--intent",
        "Build a settings page.",
        "--output",
        outputDir,
        "--json",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.notEqual(cli.status, 0);
    const result = JSON.parse(cli.stdout);
    assert.equal(result.trace.finalStatus, "partial");
    const agentStatuses = new Map(result.trace.agentsSpawned.map((agent) => [agent.agentId, agent.status]));
    assert.equal(agentStatuses.get("persistence-architect"), "completed");
    assert.equal(agentStatuses.get("flow-runtime-manager"), "completed");
    assert.equal(agentStatuses.get("council-gstack-critic"), "completed");
    assert.ok(result.artifacts.includes("council-review.json"));
  } finally {
    await rm(sourceDir, { recursive: true, force: true });
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("cli rejects impossible numeric constraints before generation", () => {
  const cli = spawnSync(
    process.execPath,
    [
      path.resolve("dist/cli/harnessctl.js"),
      "motion-lottie",
      "deep",
      "--source",
      path.resolve("fixtures/motion/logo.svg"),
      "--intent",
      "Use invalid numbers.",
      "--duration",
      "-1",
      "--fps",
      "0",
      "--json",
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /--duration must be greater than 0/);
});

test("lottie image validator checks real referenced asset files", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "harness-lottie-assets-"));
  try {
    await mkdir(path.join(outputDir, "images"));
    await writeFile(path.join(outputDir, "images", "hero.png"), "fake image bytes");
    await writeFile(
      path.join(outputDir, "animation.json"),
      JSON.stringify({
        v: "5.12.2",
        fr: 30,
        ip: 0,
        op: 30,
        w: 100,
        h: 100,
        nm: "asset-test",
        assets: [{ id: "image_0", w: 10, h: 10, u: "images/", p: "hero.png" }],
        layers: [],
      }),
    );
    await writeFile(path.join(outputDir, "controls.json"), JSON.stringify({ background: {}, accentColor: {}, speed: {}, cameraIntensity: {} }));
    await writeFile(path.join(outputDir, "preview.svg"), "<svg></svg>");
    await writeFile(path.join(outputDir, "preview.html"), '<script id="animation-data" type="application/json">{}</script><script>lottie.loadAnimation({})</script>');

    const request = {
      intent: "Validate image assets.",
      sources: [],
      durationSeconds: 1,
      fps: 30,
      width: 100,
      height: 100,
      controls: [],
      outputDir,
    };

    let results = await runLottieValidators(outputDir, request);
    assert.equal(results.find((item) => item.id === "no_missing_image_references")?.status, "pass");

    await unlink(path.join(outputDir, "images", "hero.png"));
    results = await runLottieValidators(outputDir, request);
    assert.equal(results.find((item) => item.id === "no_missing_image_references")?.status, "fail");
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("design-system harness inventories components and accepts token-defined colors", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "harness-design-"));
  try {
    const result = await buildHarness({
      harness: "design-system-ui",
      mode: "standard",
      intent: "Build a settings page using approved components only.",
      sources: [path.resolve("fixtures/design-system")],
      controls: [],
      outputDir,
    });
    assert.equal(result.trace.selectedArchetype, "system-harness");
    assert.equal(result.trace.routeComposition?.primaryPackId, "design-system-ui");
    assert.ok(result.artifacts.includes("component-inventory.json"));
    assert.ok(resolveExecutorBindings(result.spec, "artifact-generator").some((executor) => executor.adapter === "local:module" && executor.exportName === "generateDesignSystemArtifacts"));
    assert.ok(resolveExecutorBindings(result.spec, "validator").some((executor) => executor.adapter === "local:module" && executor.exportName === "runDesignSystemValidatorsExecutor"));
    assert.equal(result.validations.find((item) => item.id === "component_inventory")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "raw_color_detection")?.status, "pass");
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("generic fallback workflow is pack-backed and replayable", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "harness-generic-"));
  try {
    const result = await buildHarness({
      mode: "standard",
      intent: "Summarize the provided sources into a workflow report.",
      sources: [],
      controls: [],
      outputDir,
    });
    assert.ok(result.artifacts.includes("final-report.md"));
    assert.ok(result.artifacts.includes("executor-lock.json"));
    assert.ok(result.artifacts.includes("worker-lock.json"));
    assert.ok(result.artifacts.includes("run-plan.json"));
    assert.ok(result.spec.graph.some((node) => node.id === "generate:final-report" && node.capabilityId === "artifact-generator:final-report"));
    assert.ok(resolveExecutorBindings(result.spec, "artifact-generator").some((executor) => executor.exportName === "generateFinalReport"));
    assert.ok(resolveExecutorBindings(result.spec, "validator").some((executor) => executor.exportName === "runTraceCompleteValidatorExecutor"));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("empty council critic question lists fail critic validation", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "harness-empty-critic-"));
  const runId = "run-empty-critic";
  const criticIds = ["council-gstack-critic", "council-gbrain-memory", "council-verifier"];
  try {
    const council = await writeCouncilReview(
      outputDir,
      runId,
      {
        id: "spec-empty-critic",
        name: "Empty critic fixture",
        archetype: "feature-harness",
        mode: "standard",
        userIntent: "Prove empty critic question lists fail validation.",
        sources: [],
        agents: ["persistence-architect", "flow-runtime-manager", ...criticIds].map((id) => ({ id })),
        graph: [
          { id: "analyze:persistence", agentId: "persistence-architect", dependsOn: [] },
          { id: "analyze:flow-runtime", agentId: "flow-runtime-manager", dependsOn: [] },
          ...criticIds.map((agentId) => ({ id: `analyze:${agentId}`, agentId, dependsOn: [] })),
          { id: "validate:council-review", validatorId: "council_review_complete", dependsOn: [] },
        ],
        validators: [{ id: "council_review_complete" }],
        artifactContracts: [],
        ir: { id: "ir-empty-critic" },
      },
      { intent: "Prove empty critic question lists fail validation.", sources: [], controls: [], outputDir },
      [],
      criticIds.map((criticId) => ({
        id: `agent-run-${criticId}`,
        runId,
        group: "council-elders",
        nodeId: `analyze:${criticId}`,
        agentId: criticId,
        status: "completed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        summary: "Emitted an invalid empty critic review.",
        artifacts: [],
        inputs: [],
        evidence: [],
        findings: [],
        courseCorrections: [],
        criticReview: {
          criticId,
          summary: "Invalid empty review.",
          questions: [],
          missingEvidence: [],
          unsafeAssumptions: [],
          domainRisks: [],
          mustAnswerBeforeFinalize: [],
          confidenceScore: 1,
        },
        references: [],
      })),
    );
    assert.equal(council.criticValidations.find((item) => item.id === "critic_questions_present")?.status, "fail");
    assert.match(council.criticValidations.find((item) => item.id === "critic_questions_present")?.details ?? "", /empty question lists/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("full-stack app PRD resolves app-building pack and validator-gated features", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "harness-app-prd-"));
  const dependencyOutputDir = await mkdtemp(path.join(os.tmpdir(), "harness-app-dependency-"));
  try {
    const request = {
      harness: "workflows",
      mode: "standard",
      intent: "Build a full-stack habit tracker app with API routes, persistence, tests, and a deployable architecture workflow from this PRD.",
      sources: [path.resolve("examples/app-building/sources/habit-tracker-prd.md")],
      controls: [],
      outputDir,
    };
    const result = await buildHarness(request);
    assert.equal(result.trace.finalStatus, "success");
    assert.ok(result.artifacts.includes("app-blueprint.json"));
    assert.ok(result.artifacts.includes("ui-flow.md"));
    assert.ok(result.artifacts.includes("api-contract.json"));
    assert.ok(result.artifacts.includes("persistence-plan.md"));
    assert.ok(result.artifacts.includes("app-source/package.json"));
    assert.ok(result.artifacts.includes("app-source/src/app.js"));
    assert.ok(result.artifacts.includes("app-source/src/api.js"));
    assert.ok(result.artifacts.includes("app-source/src/model.js"));
    assert.ok(result.artifacts.includes("app-source/tests/app.test.js"));
    assert.ok(result.artifacts.includes("test-plan.md"));
    assert.ok(result.artifacts.includes("app-acceptance.md"));
    assert.ok(result.artifacts.includes("agent-runs/codex-host-critic-request.json"));
    assert.ok(!result.artifacts.includes("final-report.md"));
    assert.ok(result.spec.artifactContracts.some((contract) => contract.id === "app-api-contract"));
    assert.ok(result.spec.artifactContracts.some((contract) => contract.id === "app-persistence-plan"));
    assert.ok(result.spec.artifactContracts.some((contract) => contract.id === "app-source-tree"));
    assert.ok(result.spec.artifactContracts.some((contract) => contract.id === "app-test-plan"));
    assert.ok(resolveExecutorBindings(result.spec, "artifact-generator").some((executor) => executor.packId === "app-building-fullstack" && executor.exportName === "generateAppBuildingArtifacts"));
    assert.ok(resolveExecutorBindings(result.spec, "validator").some((executor) => executor.packId === "app-building-fullstack" && executor.exportName === "runAppBuildingValidatorsExecutor"));
    assert.equal(result.validations.find((item) => item.id === "app_requirements_extracted")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "app_api_contract_present")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "app_persistence_plan_present")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "app_source_tree_present")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "app_test_plan_full_pipeline")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "app_acceptance_coverage")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "critic_questions_present")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "blocker_questions_resolved")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "app_prd_critic_coverage")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "feature_scope_state_gated")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "node_execution_integrity")?.status, "pass");
    assert.deepEqual(new Set(result.trace.routeComposition?.matchedPacks.map((pack) => pack.packId)), new Set(result.spec.selectedCapabilityPackIds));
    const agentStatuses = new Map(result.trace.agentsSpawned.map((agent) => [agent.agentId, agent.status]));
    for (const agentId of ["app-product-analyst", "api-architect", "persistence-designer", "test-planner", "implementation-agent", "finalizer"]) {
      assert.equal(agentStatuses.get(agentId), "completed", agentId);
    }
    assert.ok([...agentStatuses.values()].every((status) => status !== "planned_not_executed"));
    const executorLock = JSON.parse(await readFile(path.join(outputDir, "executor-lock.json"), "utf8"));
    assert.ok(executorLock.executors.some((executor) => executor.packId === "app-building-fullstack"));
    assert.ok(!executorLock.executors.some((executor) => executor.packId === "generic-report"));
    const councilReview = JSON.parse(await readFile(path.join(outputDir, "council-review.json"), "utf8"));
    assert.equal(councilReview.unresolvedBlockerQuestions.length, 0);
    const categories = new Set(councilReview.criticQuestions.map((question) => question.category));
    assert.ok(categories.has("persistence-model"));
    assert.ok(categories.has("tests"));
    assert.ok(categories.has("ui-flow"));
    assert.ok(!councilReview.courseCorrections.some((correction) => correction.includes("Answer blocker question")));
    const featureList = JSON.parse(await readFile(path.join(outputDir, "feature-list.json"), "utf8"));
    for (const artifactId of ["app-ui-flow", "app-api-contract", "app-persistence-plan", "app-source-tree", "app-test-plan", "app-acceptance-plan"]) {
      const feature = featureList.features.find((item) => item.artifactIds.includes(artifactId));
      assert.equal(feature?.state, "passing", artifactId);
    }
    const blueprint = JSON.parse(await readFile(path.join(outputDir, "app-blueprint.json"), "utf8"));
    assert.ok(blueprint.api.routes.some((route) => route.path.includes("/api/habits")));
    assert.ok(blueprint.persistence.tables.some((table) => table.name === "habit_check_ins"));
    assert.ok(blueprint.tests.e2e.some((check) => check.includes("primary user flow")));
    assert.ok(blueprint.assumptions.some((assumption) => assumption.includes("writes a dependency-free source tree")));
    const packageJson = JSON.parse(await readFile(path.join(outputDir, "app-source/package.json"), "utf8"));
    assert.equal(packageJson.scripts.test, "node --test tests/*.test.js");
    const sourceTest = spawnSync(process.execPath, ["--test", path.join(outputDir, "app-source/tests/app.test.js")], {
      cwd: path.join(outputDir, "app-source"),
      encoding: "utf8",
    });
    assert.equal(sourceTest.status, 0, `${sourceTest.stdout}\n${sourceTest.stderr}`);
    const appSource = await readFile(path.join(outputDir, "app-source/src/app.js"), "utf8");
    assert.match(appSource, /renderAppSummary/);
    const workerLock = JSON.parse(await readFile(path.join(outputDir, "worker-lock.json"), "utf8"));
    assert.ok(workerLock.workers.some((worker) => worker.workerBindingId === "worker:domain-planning"));
    assert.ok(workerLock.workers.some((worker) => worker.workerBindingId === "worker:finalization"));
    const councilWorker = workerLock.workers.find((worker) => worker.workerBindingId === "worker:council-elders");
    assert.ok(councilWorker.adapterTypes.includes("codex:host"));
    assert.equal(councilWorker.criticContract.hostAdapter, "codex:host");
    const verifierManifest = JSON.parse(await readFile(path.join(outputDir, "agent-runs/analyze-council-verifier__council-verifier.json"), "utf8"));
    assert.equal(verifierManifest.criticReview.mustAnswerBeforeFinalize.length, 0);
    const invocationLedger = JSON.parse(await readFile(path.join(outputDir, "function-invocation-ledger.json"), "utf8"));
    assert.equal(invocationLedger.status, "pass");
    assert.equal(invocationLedger.summary.missingInvocationCount, 0);
    await assert.rejects(
      () => generateArtifacts(result.spec, request, result.profiles, dependencyOutputDir, { completedNodeIds: new Set(["profile:source-availability"]) }),
      /unmet required dependencies/,
    );
  } finally {
    await rm(outputDir, { recursive: true, force: true });
    await rm(dependencyOutputDir, { recursive: true, force: true });
  }
});

test("mixed motion and design requests compile to a non-serial capability DAG", async () => {
  const sources = await buildSourceRefs([path.resolve("fixtures/motion/logo.svg"), path.resolve("fixtures/design-system")]);
  const evidenceGraph = await buildEvidenceGraph(sources);
  const registry = createDefaultCapabilityRegistry();
  const request = {
    mode: "standard",
    intent: "Use this SVG and design system to build a premium onboarding animation and component demo.",
    sources: [path.resolve("fixtures/motion/logo.svg"), path.resolve("fixtures/design-system")],
    controls: [],
    outputDir: "output/test",
  };
  const draft = synthesizeHarnessDraft({ request, evidenceGraph, registry });
  const verification = verifyHarnessDraft(draft, evidenceGraph, registry);
  assert.equal(verification.ok, true, verification.errors.map((error) => error.message).join("\n"));
  assert.ok(draft.evidenceUse.some((item) => item.decision.includes("capability pack 'workflow-runtime'")));
  assert.ok(draft.evidenceUse.some((item) => item.decision.includes("capability pack 'motion-lottie'")));
  assert.ok(draft.evidenceUse.some((item) => item.decision.includes("capability pack 'design-system-ui'")));
  assert.ok(draft.evidenceUse.some((item) => item.decision.includes("Built motion-lottie DAG nodes from capability pack 'motion-lottie'")));
  assert.ok(draft.evidenceUse.some((item) => item.decision.includes("Built design-system-ui DAG nodes from capability pack 'design-system-ui'")));
  assert.ok(draft.evidenceUse.some((item) => item.decision.includes("Built workflow-runtime DAG nodes from capability pack 'workflow-runtime'")));
  const ir = compileHarnessIR(request, draft, evidenceGraph);
  const components = ir.nodes.find((node) => node.id === "analyze:components");
  const tokens = ir.nodes.find((node) => node.id === "analyze:tokens");
  const generateDesign = ir.edges.filter((edge) => edge.to === "generate:design-report").map((edge) => edge.from);
  assert.ok(ir.nodes.some((node) => node.capabilityId === "artifact-generator:lottie-basic-reveal"));
  assert.ok(ir.nodes.some((node) => node.capabilityId === "artifact-generator:design-system-report"));
  assert.ok(ir.nodes.some((node) => node.id === "analyze:persistence" && node.capabilityId === "agent:persistence-architect"));
  assert.ok(ir.nodes.some((node) => node.id === "analyze:flow-runtime" && node.capabilityId === "agent:flow-runtime-manager"));
  assert.ok(ir.nodes.some((node) => node.id === "analyze:council-gstack" && node.capabilityId === "agent:council-gstack-critic"));
  assert.ok(ir.nodes.some((node) => node.id === "analyze:council-gbrain" && node.capabilityId === "agent:council-gbrain-memory"));
  assert.ok(ir.nodes.some((node) => node.id === "validate:council-review" && node.capabilityId === "validator:council-review"));
  assert.ok(ir.edges.some((edge) => edge.from === "validate:source-availability" && edge.to === "analyze:persistence"));
  assert.ok(ir.edges.some((edge) => edge.from === "validate:source-availability" && edge.to === "analyze:flow-runtime"));
  assert.ok(!ir.edges.some((edge) => edge.from === "analyze:persistence" && edge.to === "analyze:flow-runtime"));
  assert.ok(!ir.edges.some((edge) => edge.from === "analyze:flow-runtime" && edge.to === "analyze:persistence"));
  assert.ok(ir.edges.some((edge) => edge.from === "validate:council-review" && edge.to === "finalize"));
  assert.deepEqual(new Set(components?.inputs.map((input) => input.ref)), new Set(tokens?.inputs.map((input) => input.ref)));
  assert.deepEqual(new Set(generateDesign), new Set(["analyze:components", "analyze:tokens"]));
  assert.ok(ir.edges.some((edge) => edge.from === "generate:lottie" && edge.to === "validate:lottie-json"));
});

test("workflows command starts persists saves and reruns named workflows", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "harness-workflows-start-"));
  const rerunDir = await mkdtemp(path.join(os.tmpdir(), "harness-workflows-rerun-"));
  try {
    const start = spawnSync(
      process.execPath,
      [
        path.resolve("dist/cli/harnessctl.js"),
        "workflows",
        "start",
        "standard",
        "--source",
        path.resolve("fixtures/design-system"),
        "--intent",
        "Build a reusable design-system workflow.",
        "--output",
        outputDir,
        "--json",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.equal(start.status, 0, start.stderr);
    const first = JSON.parse(start.stdout);
    assert.ok(first.trace.runId.startsWith("run-"));
    assert.ok(first.artifacts.includes("run-state.json"));
    assert.ok(first.artifacts.includes("council-review.json"));

    const list = spawnSync(process.execPath, [path.resolve("dist/cli/harnessctl.js"), "workflows", "list", "--json"], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(list.status, 0, list.stderr);
    const runs = JSON.parse(list.stdout);
    assert.ok(runs.some((run) => run.runId === first.trace.runId && run.status === "completed"));

    const save = spawnSync(process.execPath, [path.resolve("dist/cli/harnessctl.js"), "workflows", "save", first.trace.runId, "--name", "design-system-council", "--json"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    assert.equal(save.status, 0, save.stderr);
    const saved = JSON.parse(save.stdout);
    assert.equal(saved.name, "design-system-council");

    const rerun = spawnSync(
      process.execPath,
      [path.resolve("dist/cli/harnessctl.js"), "workflows", "run", "design-system-council", "--output", rerunDir, "--json"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.equal(rerun.status, 0, rerun.stderr);
    const second = JSON.parse(rerun.stdout);
    assert.notEqual(second.trace.runId, first.trace.runId);
    assert.equal(second.trace.finalStatus, "success");
    const councilReview = await readFile(path.join(rerunDir, "council-review.json"), "utf8");
    assert.match(councilReview, /gstack/);
    assert.match(councilReview, /gbrain/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
    await rm(rerunDir, { recursive: true, force: true });
  }
});

test("originality strategy records hypotheses and validation plan", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "harness-original-"));
  try {
    const result = await buildHarness({
      harness: "motion-lottie",
      mode: "deep",
      intent: "Think really hard and produce an original out-of-distribution reveal.",
      sources: [path.resolve("fixtures/motion/logo.svg")],
      durationSeconds: 4,
      fps: 30,
      width: 512,
      height: 512,
      controls: ["background", "accentColor"],
      reasoningEffort: "original",
      originalityRequired: true,
      hypothesisCount: 5,
      outOfDistributionExploration: true,
      outputDir,
    });
    assert.equal(result.spec.cognitiveStrategy.reasoningEffort, "original");
    assert.equal(result.spec.cognitiveStrategy.hypothesisCount, 5);
    assert.ok(result.spec.agents.some((agent) => agent.id === "hypothesis-generator"));
    assert.equal(result.validations.find((item) => item.id === "hypotheses_recorded")?.status, "pass");
    assert.equal(result.validations.find((item) => item.id === "originality_rationale_present")?.status, "pass");
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
