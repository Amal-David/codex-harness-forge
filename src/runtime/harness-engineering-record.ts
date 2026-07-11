import path from "node:path";
import type { HarnessRequest, HarnessSpec, RuntimeAgentRun, ValidationResult } from "../types.js";
import { writeJson } from "../utils/fs.js";
import type { FunctionInvocationLedger } from "./function-invocation-ledger.js";
import type { ExecutorLockEntry, RunPlan, WorkerLockEntry } from "./run-plan.js";
import type { RuntimeControlArtifacts } from "./runtime-control-plane.js";
import type { ArchitectureBoundaryLedger } from "./architecture-boundary-ledger.js";
import type { SourceOfRecordLedger } from "./source-of-record-ledger.js";
import type { SessionCleanStateLedger } from "./session-clean-state-ledger.js";
import type { VerificationPipelineLedger } from "./verification-pipeline-ledger.js";
import type { CompletionAuthorityLedger } from "./completion-authority-ledger.js";
import type { EnvironmentReadinessLedger } from "./environment-readiness-ledger.js";
import type { HarnessQualityLedger } from "./harness-quality-ledger.js";
import type { ContinuityLedger } from "./continuity-ledger.js";
import type { CourseAlignmentLedger } from "./course-alignment-ledger.js";

export const HARNESS_ENGINEERING_RECORD_ARTIFACT = "harness-engineering-record.json";

interface HarnessEngineeringRecordInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  request: HarnessRequest;
  runPlan: RunPlan;
  executorLock: ExecutorLockEntry[];
  workerLock: WorkerLockEntry[];
  runtimeControl: RuntimeControlArtifacts;
  functionInvocationLedger: FunctionInvocationLedger;
  environmentReadinessLedger: EnvironmentReadinessLedger;
  architectureBoundaryLedger: ArchitectureBoundaryLedger;
  sourceOfRecordLedger: SourceOfRecordLedger;
  completionAuthorityLedger: CompletionAuthorityLedger;
  verificationPipelineLedger: VerificationPipelineLedger;
  sessionCleanStateLedger: SessionCleanStateLedger;
  harnessQualityLedger: HarnessQualityLedger;
  continuityLedger: ContinuityLedger;
  courseAlignmentLedger: CourseAlignmentLedger;
  artifacts: string[];
  validations: ValidationResult[];
  agentRuns: RuntimeAgentRun[];
}

export interface HarnessEngineeringRecordResult {
  artifact: string;
  validation: ValidationResult;
}

export async function writeHarnessEngineeringRecord(input: HarnessEngineeringRecordInput): Promise<HarnessEngineeringRecordResult> {
  const artifact = HARNESS_ENGINEERING_RECORD_ARTIFACT;
  const record = buildHarnessEngineeringRecord(input);
  const target = path.join(input.outputDir, artifact);
  await writeJson(target, record);
  return {
    artifact,
    validation: {
      id: "harness_engineering_record_written",
      name: "Harness engineering operational record written",
      status: "pass",
      details: "Run captured startup readiness, scope control, verification, observability, continuity, and clean-exit gates in a machine-readable operational record.",
      evidence: [target],
      repairable: true,
    },
  };
}

function buildHarnessEngineeringRecord(input: HarnessEngineeringRecordInput) {
  const sourceAvailability = input.validations.find((validation) => validation.id === "source_availability");
  const requiredValidators = input.validations.filter((validation) => validation.status !== "skipped");
  const failedValidators = input.validations.filter((validation) => validation.status === "fail");
  const warningValidators = input.validations.filter((validation) => validation.status === "warning");
  const unresolvedBlockerValidation = input.validations.find((validation) => validation.id === "blocker_questions_resolved");
  const initializationValidation = input.validations.find((validation) => validation.id === "initialization_checklist_confirmed");
  const featureSchedulerValidation = input.validations.find((validation) => validation.id === "feature_scheduler_ready");
  const instructionRouterValidation = input.validations.find((validation) => validation.id === "instruction_router_resolved");
  const registryValidation = input.validations.find((validation) => validation.id === "worker_function_registry_resolved");
  const providerReplacementValidation = input.validations.find((validation) => validation.id === "provider_replacement_registry_ready");
  const toolSafetyValidation = input.validations.find((validation) => validation.id === "tool_safety_registry_ready");
  const contextBudgetValidation = input.validations.find((validation) => validation.id === "context_budget_ready");
  const dispatchValidation = input.validations.find((validation) => validation.id === "function_dispatch_plan_resolved");
  const runtimeBusValidation = input.validations.find((validation) => validation.id === "runtime_bus_resolved");
  const invocationValidation = input.validations.find((validation) => validation.id === "function_invocation_ledger_completed");
  const startupReadinessValidation = input.validations.find((validation) => validation.id === "startup_readiness_confirmed");
  const policyValidation = input.validations.find((validation) => validation.id === "policy_gate_passed");
  const approvalValidation = input.validations.find((validation) => validation.id === "approval_gate_resolved");
  const budgetValidation = input.validations.find((validation) => validation.id === "budget_gate_passed");
  const hookValidation = input.validations.find((validation) => validation.id === "hook_ledger_recorded");
  const traceContextValidation = input.validations.find((validation) => validation.id === "trace_context_propagated");
  const environmentReadinessValidation = input.validations.find((validation) => validation.id === "environment_readiness_confirmed");
  const architectureBoundaryValidation = input.validations.find((validation) => validation.id === "architecture_boundary_rules_enforced");
  const evaluatorRubricValidation = input.validations.find((validation) => validation.id === "evaluator_rubric_recorded");
  const completionAuthorityValidation = input.validations.find((validation) => validation.id === "completion_authority_confirmed");
  const sourceOfRecordValidation = input.validations.find((validation) => validation.id === "source_of_record_confirmed");
  const feedbackPromotionValidation = input.validations.find((validation) => validation.id === "feedback_promotion_recorded");
  const diagnosticLoopValidation = input.validations.find((validation) => validation.id === "diagnostic_loop_recorded");
  const repairGuidanceValidation = input.validations.find((validation) => validation.id === "repair_guidance_recorded");
  const subsystemAuditValidation = input.validations.find((validation) => validation.id === "harness_subsystem_audit_recorded");
  const ablationComparisonValidation = input.validations.find((validation) => validation.id === "harness_ablation_comparison_recorded");
  const qualityDocumentValidation = input.validations.find((validation) => validation.id === "quality_document_recorded");
  const qualityValidation = input.validations.find((validation) => validation.id === "harness_quality_documented");
  const continuityValidation = input.validations.find((validation) => validation.id === "continuity_state_recorded");
  const courseAlignmentValidation = input.validations.find((validation) => validation.id === "course_alignment_confirmed");
  const lifecycleValidation = input.validations.find((validation) => validation.id === "lifecycle_ledger_clean");
  const verifiedCompletionValidation = input.validations.find((validation) => validation.id === "verified_completion_rate_passed");
  const sessionCleanStateValidation = input.validations.find((validation) => validation.id === "session_clean_state_ready");
  const nodeEvidence = input.runPlan.nodes.map((node) => ({
    nodeId: node.id,
    title: node.title,
    dependsOn: node.dependsOn,
    produces: node.produces,
    executorLockIds: node.executorLockIds,
    workerLockIds: node.workerLockIds,
  }));

  return {
    schemaVersion: 1,
    framework: {
      name: "Learn Harness Engineering",
      appliedAt: new Date().toISOString(),
      sources: [
        "https://walkinglabs.github.io/learn-harness-engineering/en/",
        "https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-01-why-capable-agents-still-fail/",
        "https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-02-what-a-harness-actually-is/",
        "https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-03-why-the-repository-must-become-the-system-of-record/",
        "https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-04-why-one-giant-instruction-file-fails/",
        "https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-05-why-long-running-tasks-lose-continuity/",
        "https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-06-why-initialization-needs-its-own-phase/",
        "https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-07-why-agents-overreach-and-under-finish/",
        "https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-08-why-feature-lists-are-harness-primitives/",
        "https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-09-why-agents-declare-victory-too-early/",
        "https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-10-why-end-to-end-testing-changes-results/",
        "https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-11-why-observability-belongs-inside-the-harness/",
        "https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-12-why-every-session-must-leave-a-clean-state/",
        "https://walkinglabs.github.io/learn-harness-engineering/en/resources/templates/",
      ],
    },
    run: {
      runId: input.runId,
      harnessSpecId: input.spec.id,
      mode: input.spec.mode,
      archetype: input.spec.archetype,
      intent: input.request.intent,
      outputDir: input.outputDir,
    },
    subsystems: input.spec.harnessModel.subsystems.map((subsystem) => ({
      id: subsystem.id,
      implementation: subsystem.purpose,
      evidence: subsystem.plannedArtifacts,
      evaluationCriteria: subsystem.evaluationCriteria,
    })),
    startupReadiness: {
      canInitialize: statusGate(initializationValidation?.status === "pass", initializationValidation?.details ?? "Initialization checklist validation was not produced."),
      canScheduleFeature: statusGate(featureSchedulerValidation?.status === "pass", featureSchedulerValidation?.details ?? "Feature scheduler validation was not produced."),
      canRouteInstructions: statusGate(instructionRouterValidation?.status === "pass", instructionRouterValidation?.details ?? "Instruction router validation was not produced."),
      canStart: statusGate(!failedValidators.some((validation) => validation.id === "source_availability"), sourceAvailability?.details ?? "No source availability validator was produced."),
      canTest: statusGate(initializationValidation?.status === "pass" && input.runPlan.nodes.some((node) => node.executorLockIds.length > 0), `${input.executorLock.length} executor binding(s) locked for artifact generation or validation.`),
      canDispatchFunctions: statusGate(dispatchValidation?.status === "pass", dispatchValidation?.details ?? "Function dispatch plan validation was not produced."),
      canResolveProviderReplacements: statusGate(providerReplacementValidation?.status === "pass", providerReplacementValidation?.details ?? "Provider replacement registry validation was not produced."),
      canResolveRuntimeBus: statusGate(runtimeBusValidation?.status === "pass", runtimeBusValidation?.details ?? "Runtime bus validation was not produced."),
      canProveFunctionInvocations: statusGate(invocationValidation?.status === "pass", invocationValidation?.details ?? "Function invocation ledger validation was not produced."),
      canAuthorize: statusGate(policyValidation?.status === "pass", policyValidation?.details ?? "Policy gate validation was not produced."),
      canResolveApprovals: statusGate(approvalValidation?.status === "pass", approvalValidation?.details ?? "Approval gate validation was not produced."),
      canBudget: statusGate(budgetValidation?.status === "pass", budgetValidation?.details ?? "Budget gate validation was not produced."),
      canBudgetContext: statusGate(contextBudgetValidation?.status === "pass", contextBudgetValidation?.details ?? "Context budget validation was not produced."),
      canPublishHooks: statusGate(hookValidation?.status === "pass", hookValidation?.details ?? "Hook ledger validation was not produced."),
      canPropagateTraceContext: statusGate(traceContextValidation?.status === "pass", traceContextValidation?.details ?? "Trace context validation was not produced."),
      canEnforceArchitectureBoundaries: statusGate(architectureBoundaryValidation?.status === "pass", architectureBoundaryValidation?.details ?? "Architecture boundary validation was not produced."),
      canRecordEvaluatorRubric: statusGate(evaluatorRubricValidation?.status === "pass" || evaluatorRubricValidation?.status === "warning", evaluatorRubricValidation?.details ?? "Evaluator rubric validation was not produced."),
      canConfirmCompletionAuthority: statusGate(completionAuthorityValidation?.status === "pass", completionAuthorityValidation?.details ?? "Completion authority validation was not produced."),
      canAnswerFreshSessionQuestions: statusGate(sourceOfRecordValidation?.status === "pass" || sourceOfRecordValidation?.status === "warning", sourceOfRecordValidation?.details ?? "Source-of-record validation was not produced."),
      canConfirmEnvironmentReadiness: statusGate(environmentReadinessValidation?.status === "pass" || environmentReadinessValidation?.status === "warning", environmentReadinessValidation?.details ?? "Environment readiness validation was not produced."),
      canPromoteFeedback: statusGate(feedbackPromotionValidation?.status === "pass" || feedbackPromotionValidation?.status === "warning", feedbackPromotionValidation?.details ?? "Feedback promotion validation was not produced."),
      canDiagnoseFailures: statusGate(diagnosticLoopValidation?.status === "pass", diagnosticLoopValidation?.details ?? "Diagnostic loop validation was not produced."),
      canRepairFromFeedback: statusGate(repairGuidanceValidation?.status === "pass", repairGuidanceValidation?.details ?? "Repair guidance validation was not produced."),
      canScoreSubsystems: statusGate(subsystemAuditValidation?.status === "pass", subsystemAuditValidation?.details ?? "Harness subsystem audit validation was not produced."),
      canMeasureAblations: statusGate(ablationComparisonValidation?.status === "pass", ablationComparisonValidation?.details ?? "Harness ablation comparison validation was not produced."),
      canRecordQualityDocument: statusGate(qualityDocumentValidation?.status === "pass" || qualityDocumentValidation?.status === "warning", qualityDocumentValidation?.details ?? "Quality document validation was not produced."),
      canDocumentQuality: statusGate(qualityValidation?.status === "pass" || qualityValidation?.status === "warning", qualityValidation?.details ?? "Harness quality validation was not produced."),
      canRecordContinuity: statusGate(continuityValidation?.status === "pass" || continuityValidation?.status === "warning", continuityValidation?.details ?? "Continuity validation was not produced."),
      canConfirmCourseAlignment: statusGate(courseAlignmentValidation?.status === "pass" || courseAlignmentValidation?.status === "warning", courseAlignmentValidation?.details ?? "Course alignment validation was not produced."),
      canProveLifecycle: statusGate(lifecycleValidation?.status === "pass" || lifecycleValidation?.status === "warning", lifecycleValidation?.details ?? "Lifecycle ledger validation was not produced."),
      canProveVerifiedCompletionRate: statusGate(verifiedCompletionValidation?.status === "pass", verifiedCompletionValidation?.details ?? "Verified completion-rate validation was not produced."),
      canLeaveCleanState: statusGate(sessionCleanStateValidation?.status === "pass", sessionCleanStateValidation?.details ?? "Session clean-state validation was not produced."),
      canResumeFreshSession: statusGate(startupReadinessValidation?.status === "pass" || startupReadinessValidation?.status === "warning", startupReadinessValidation?.details ?? "Startup readiness validation was not produced."),
      canSeeProgress: statusGate(input.artifacts.includes("feature-list.json") && input.artifacts.includes("progress.md") && input.artifacts.includes("events.jsonl"), "Feature list, progress note, and event ledger are emitted for session reconstruction."),
      canPickNext: statusGate(input.spec.harnessModel.featureList.length > 0, `${input.spec.harnessModel.featureList.length} feature row(s) are present in the compiled harness model.`),
    },
    scopeControl: {
      scopeSurface: {
        artifact: "feature-list.json",
        featureCount: input.spec.harnessModel.featureList.length,
        features: input.spec.harnessModel.featureList,
        backingRunPlan: {
          artifact: "run-plan.json",
          nodeCount: input.runPlan.nodeCount,
          nodes: nodeEvidence,
        },
      },
      activationPolicy: {
        strategy: input.runPlan.schedule.strategy,
        maxConcurrency: input.runPlan.schedule.maxConcurrency,
        retryPolicy: input.runPlan.schedule.retryPolicy,
        parallelismBoundary: "Parallelism is allowed only where the verified graph and worker bindings make dependencies explicit.",
        policyGate: {
          artifact: "policy-gate.json",
          status: input.runtimeControl.policyGate.status,
          allowedDecisionCount: input.runtimeControl.policyGate.decisions.filter((decision) => decision.status === "allow").length,
          deniedDecisionCount: input.runtimeControl.policyGate.decisions.filter((decision) => decision.status === "deny").length,
        },
        approvalGate: {
          artifact: "approval-gate.json",
          status: input.runtimeControl.approvalGate.status,
          requiredRequestCount: input.runtimeControl.approvalGate.requiredRequestCount,
          resolvedRequestCount: input.runtimeControl.approvalGate.resolvedRequestCount,
        },
        budgetGate: {
          artifact: "budget-gate.json",
          status: input.runtimeControl.budgetGate.status,
          estimatedUsage: input.runtimeControl.budgetGate.estimatedUsage,
          limits: input.runtimeControl.budgetGate.limits,
        },
      },
      runtimeFunctionRegistry: {
        artifact: "worker-function-registry.json",
        validationStatus: registryValidation?.status ?? "missing",
        workerFunctionCount: input.runtimeControl.registry.workerFunctions.length,
        executorFunctionCount: input.runtimeControl.registry.executorFunctions.length,
        eventTopics: input.runtimeControl.registry.eventTopics,
        stateNamespaces: input.runtimeControl.registry.stateNamespaces,
        replacementCompatibilityKeys: input.runtimeControl.registry.replacementCompatibilityKeys,
      },
      providerReplacementRegistry: {
        artifact: "provider-replacement-registry.json",
        validationStatus: providerReplacementValidation?.status ?? "missing",
        status: input.runtimeControl.providerReplacementRegistry.status,
        providerCount: input.runtimeControl.providerReplacementRegistry.summary.providerCount,
        replacementSlotCount: input.runtimeControl.providerReplacementRegistry.summary.replacementSlotCount,
        unresolvedCount: input.runtimeControl.providerReplacementRegistry.summary.unresolvedCount,
      },
      toolSafetyLedger: {
        artifact: "tool-safety-ledger.json",
        validationStatus: toolSafetyValidation?.status ?? "missing",
        status: input.runtimeControl.toolSafetyLedger.status,
        callCount: input.runtimeControl.toolSafetyLedger.summary.callCount,
        concurrentSafeCallCount: input.runtimeControl.toolSafetyLedger.summary.concurrentSafeCallCount,
        serialCallCount: input.runtimeControl.toolSafetyLedger.summary.serialCallCount,
        deniedCallCount: input.runtimeControl.toolSafetyLedger.summary.deniedCallCount,
      },
      contextBudgetLedger: {
        artifact: "context-budget-ledger.json",
        validationStatus: contextBudgetValidation?.status ?? "missing",
        status: input.runtimeControl.contextBudgetLedger.status,
        estimatedTokenCount: input.runtimeControl.contextBudgetLedger.summary.estimatedTokenCount,
        maxTokenBudget: input.runtimeControl.contextBudgetLedger.summary.maxTokenBudget,
        usageRatio: input.runtimeControl.contextBudgetLedger.summary.usageRatio,
        isolationBoundaryCount: input.runtimeControl.contextBudgetLedger.summary.isolationBoundaryCount,
        invalidationPointCount: input.runtimeControl.contextBudgetLedger.summary.invalidationPointCount,
        unresolvedCount: input.runtimeControl.contextBudgetLedger.summary.unresolvedCount,
      },
      featureScheduler: {
        artifact: "feature-scheduler.json",
        validationStatus: featureSchedulerValidation?.status ?? "missing",
        wipLimit: 1,
        schedulingRule: "Only the scheduler may activate one unfinished feature before the run proceeds.",
      },
      instructionRouter: {
        artifact: "instruction-routing-ledger.json",
        validationStatus: instructionRouterValidation?.status ?? "missing",
        rule: "The entry instruction layer stays compact by routing to relevant topic guidance on demand.",
      },
      functionDispatchPlan: {
        artifact: "function-dispatch-plan.json",
        validationStatus: dispatchValidation?.status ?? "missing",
        providerRouteCount: input.runtimeControl.dispatchPlan.providerRoutes.length,
        dispatchableNodeCount: input.runtimeControl.dispatchPlan.nodeDispatches.filter((node) => node.status === "dispatchable").length,
        unresolvedCount: input.runtimeControl.dispatchPlan.unresolved.length,
      },
      runtimeBus: {
        artifact: "runtime-bus.json",
        validationStatus: runtimeBusValidation?.status ?? "missing",
        status: input.runtimeControl.runtimeBus.status,
        topicCount: input.runtimeControl.runtimeBus.topics.length,
        subscriberCount: input.runtimeControl.runtimeBus.subscribers.length,
        publicationCount: input.runtimeControl.runtimeBus.publications.length,
        stateNamespaceCount: input.runtimeControl.runtimeBus.stateNamespaces.length,
        unresolvedCount: input.runtimeControl.runtimeBus.unresolved.length,
      },
      functionInvocationLedger: {
        artifact: "function-invocation-ledger.json",
        validationStatus: invocationValidation?.status ?? "missing",
        status: input.functionInvocationLedger.status,
        completedInvocationCount: input.functionInvocationLedger.summary.completedInvocationCount,
        missingInvocationCount: input.functionInvocationLedger.summary.missingInvocationCount,
        blockedInvocationCount: input.functionInvocationLedger.summary.blockedInvocationCount,
      },
      startupReadiness: {
        artifact: "startup-readiness.json",
        validationStatus: startupReadinessValidation?.status ?? "missing",
        status: input.runtimeControl.startupReadiness.status,
        checklist: input.runtimeControl.startupReadiness.checklist.map((check) => ({
          id: check.id,
          status: check.status,
          details: check.details,
        })),
      },
      hookLedger: {
        artifact: "hook-ledger.json",
        validationStatus: hookValidation?.status ?? "missing",
        subscriptionCount: input.runtimeControl.hookLedger.subscriptions.length,
        emissionCount: input.runtimeControl.hookLedger.emissions.length,
      },
      traceContext: {
        artifact: "trace-context.json",
        validationStatus: traceContextValidation?.status ?? "missing",
        rootSpanId: input.runtimeControl.traceContext.rootSpanId,
        spanCount: input.runtimeControl.traceContext.spans.length,
      },
      lifecycleLedger: {
        artifact: "lifecycle-ledger.json",
        validationStatus: lifecycleValidation?.status ?? "missing",
        rule: "Initialization, environment readiness, scheduling, runtime control, execution evidence, architecture-boundary enforcement, completion authority, verification, feature state, source-of-record confirmation, and clean handoff must be recorded in order.",
      },
      environmentReadinessLedger: {
        artifact: "environment-readiness-ledger.json",
        validationStatus: environmentReadinessValidation?.status ?? "missing",
        status: input.environmentReadinessLedger.status,
        checkCount: input.environmentReadinessLedger.summary.checkCount,
        failedCheckCount: input.environmentReadinessLedger.summary.failedCheckCount,
        warningCheckCount: input.environmentReadinessLedger.summary.warningCheckCount,
        sourceCount: input.environmentReadinessLedger.summary.sourceCount,
        unavailableSourceCount: input.environmentReadinessLedger.summary.unavailableSourceCount,
        lockfileCount: input.environmentReadinessLedger.summary.lockfileCount,
        unresolvedCount: input.environmentReadinessLedger.summary.unresolvedCount,
      },
      sourceOfRecordLedger: {
        artifact: "source-of-record-ledger.json",
        validationStatus: sourceOfRecordValidation?.status ?? "missing",
        status: input.sourceOfRecordLedger.status,
        answeredQuestionCount: input.sourceOfRecordLedger.summary.answeredQuestionCount,
        questionCount: input.sourceOfRecordLedger.summary.questionCount,
        failedCheckCount: input.sourceOfRecordLedger.summary.failedCheckCount,
        warningCheckCount: input.sourceOfRecordLedger.summary.warningCheckCount,
        authoritativeSourceCount: input.sourceOfRecordLedger.summary.authoritativeSourceCount,
        unavailableSourceCount: input.sourceOfRecordLedger.summary.unavailableSourceCount,
      },
      architectureBoundaryLedger: {
        artifact: "architecture-boundary-ledger.json",
        validationStatus: architectureBoundaryValidation?.status ?? "missing",
        status: input.architectureBoundaryLedger.status,
        ruleCount: input.architectureBoundaryLedger.summary.ruleCount,
        passedRuleCount: input.architectureBoundaryLedger.summary.passedRuleCount,
        failedRuleCount: input.architectureBoundaryLedger.summary.failedRuleCount,
        warningRuleCount: input.architectureBoundaryLedger.summary.warningRuleCount,
        sourceFileCount: input.architectureBoundaryLedger.summary.sourceFileCount,
        violationCount: input.architectureBoundaryLedger.summary.violationCount,
      },
      evaluatorRubric: {
        artifact: "evaluator-rubric.json",
        markdownArtifact: "evaluator-rubric.md",
        validationStatus: evaluatorRubricValidation?.status ?? "missing",
        rule: "Evaluator dimensions are externalized before completion authority so acceptance criteria are evidence-backed rather than subjective.",
      },
      verificationPipelineLedger: {
        artifact: "verification-pipeline-ledger.json",
        validationStatus: verifiedCompletionValidation?.status ?? "missing",
        status: input.verificationPipelineLedger.status,
        verifiedCompletionRate: input.verificationPipelineLedger.summary.verifiedCompletionRate,
        requiredFeatureCount: input.verificationPipelineLedger.summary.requiredFeatureCount,
        verifiedFeatureCount: input.verificationPipelineLedger.summary.verifiedFeatureCount,
        requiredLevelCount: input.verificationPipelineLedger.summary.requiredLevelCount,
        unresolvedCount: input.verificationPipelineLedger.summary.unresolvedCount,
      },
      completionAuthorityLedger: {
        artifact: "completion-authority-ledger.json",
        validationStatus: completionAuthorityValidation?.status ?? "missing",
        status: input.completionAuthorityLedger.status,
        roleCount: input.completionAuthorityLedger.summary.roleCount,
        authorityGateCount: input.completionAuthorityLedger.summary.authorityGateCount,
        failedAuthorityGateCount: input.completionAuthorityLedger.summary.failedAuthorityGateCount,
        warningAuthorityGateCount: input.completionAuthorityLedger.summary.warningAuthorityGateCount,
        plannerEvidenceCount: input.completionAuthorityLedger.summary.plannerEvidenceCount,
        generatorEvidenceCount: input.completionAuthorityLedger.summary.generatorEvidenceCount,
        evaluatorEvidenceCount: input.completionAuthorityLedger.summary.evaluatorEvidenceCount,
        unresolvedCount: input.completionAuthorityLedger.summary.unresolvedCount,
      },
      sessionCleanStateLedger: {
        artifact: "session-clean-state-ledger.json",
        validationStatus: sessionCleanStateValidation?.status ?? "missing",
        status: input.sessionCleanStateLedger.status,
        passedCheckCount: input.sessionCleanStateLedger.summary.passedCheckCount,
        warningCheckCount: input.sessionCleanStateLedger.summary.warningCheckCount,
        failedCheckCount: input.sessionCleanStateLedger.summary.failedCheckCount,
        staleArtifactCount: input.sessionCleanStateLedger.summary.staleArtifactCount,
        unresolvedCount: input.sessionCleanStateLedger.unresolved.length,
      },
      feedbackPromotionLedger: {
        artifact: "feedback-promotion-ledger.json",
        validationStatus: feedbackPromotionValidation?.status ?? "missing",
        rule: "Repairable validation signals, critic questions, missing evidence, unsafe assumptions, and course corrections become durable improvement candidates.",
      },
      harnessDiagnosticLedger: {
        artifact: "harness-diagnostic-ledger.json",
        validationStatus: diagnosticLoopValidation?.status ?? "missing",
        rule: "Failed, warning, skipped, and unresolved blocker signals are attributed to instructions, tools, environment, state, or feedback.",
      },
      repairGuidanceLedger: {
        artifact: "repair-guidance-ledger.json",
        validationStatus: repairGuidanceValidation?.status ?? "missing",
        rule: "Failed, warning, skipped, and unresolved blocker signals carry what/why/fix/next-command guidance for the next agent turn.",
      },
      harnessSubsystemAudit: {
        artifact: "harness-subsystem-audit.json",
        validationStatus: subsystemAuditValidation?.status ?? "missing",
        rule: "Instructions, tools, environment, state, and feedback are scored from runtime evidence so the next harness investment targets the weakest subsystem.",
      },
      harnessAblationComparison: {
        artifact: "harness-ablation-comparison.json",
        validationStatus: ablationComparisonValidation?.status ?? "missing",
        rule: "Subsystem audit probes are measured through artifact-evidence exclusion so marginal harness value is compared instead of assumed.",
      },
      qualityDocument: {
        artifact: "quality-document.json",
        markdownArtifact: "quality-document.md",
        validationStatus: qualityDocumentValidation?.status ?? "missing",
        rule: "Subsystem quality is summarized as a fresh-session quality document before clean handoff.",
      },
      harnessQualityLedger: {
        artifact: "harness-quality-ledger.json",
        validationStatus: qualityValidation?.status ?? "missing",
        status: input.harnessQualityLedger.status,
        score: input.harnessQualityLedger.score,
        grade: input.harnessQualityLedger.grade,
        nonPassingValidationCount: input.harnessQualityLedger.summary.nonPassingValidationCount,
        repairActionCount: input.harnessQualityLedger.summary.repairActionCount,
        lowestSubsystemScore: input.harnessQualityLedger.summary.lowestSubsystemScore,
        priorityCount: input.harnessQualityLedger.priorities.length,
      },
      continuityLedger: {
        artifact: "continuity-ledger.json",
        validationStatus: continuityValidation?.status ?? "missing",
        status: input.continuityLedger.status,
        decisionCount: input.continuityLedger.summary.decisionCount,
        missingRestartArtifactCount: input.continuityLedger.summary.missingRestartArtifactCount,
        nextActionCount: input.continuityLedger.summary.nextActionCount,
        estimatedRebuildMinutes: input.continuityLedger.summary.estimatedRebuildMinutes,
        rebuildCostStatus: input.continuityLedger.summary.rebuildCostStatus,
      },
      courseAlignmentLedger: {
        artifact: "course-alignment-ledger.json",
        validationStatus: courseAlignmentValidation?.status ?? "missing",
        status: input.courseAlignmentLedger.status,
        score: input.courseAlignmentLedger.score,
        requirementCount: input.courseAlignmentLedger.summary.requirementCount,
        passingRequirementCount: input.courseAlignmentLedger.summary.passingRequirementCount,
        warningRequirementCount: input.courseAlignmentLedger.summary.warningRequirementCount,
        failedRequirementCount: input.courseAlignmentLedger.summary.failedRequirementCount,
        coveredSubsystemCount: input.courseAlignmentLedger.summary.coveredSubsystemCount,
      },
      completionEvidenceRequired: input.spec.graph.flatMap((node) => node.evidenceRequired ?? []),
    },
    termination: {
      judgmentOwner: "completion authority ledger backed by runtime validators and council review",
      completionPriority: ["source availability", "environment readiness", "source-of-record confirmation", "artifact and runtime validation", "architecture-boundary enforcement", "validator-owned feature state", "evaluator rubric", "independent completion authority", "quality document", "quality ledger", "continuity state", "course alignment", "verified completion rate", "clean state", "council review", "diagnostic attribution", "clean handoff"],
      completionAuthority: {
        artifact: "completion-authority-ledger.json",
        status: input.completionAuthorityLedger.status,
        protocol: input.completionAuthorityLedger.protocol,
        roles: input.completionAuthorityLedger.roles.map((role) => ({
          role: role.role,
          owner: role.owner,
          status: role.status,
          ownerIds: role.ownerIds,
          evidence: role.evidence,
        })),
        unresolved: input.completionAuthorityLedger.unresolved,
      },
      validationHierarchy: requiredValidators.map((validation) => ({
        id: validation.id,
        status: validation.status,
        evidence: validation.evidence ?? [],
      })),
      unresolvedBlockers: unresolvedBlockerValidation?.status === "warning" ? unresolvedBlockerValidation.details : "No unresolved blocker validation warning.",
    },
    observability: {
      runtimeArtifacts: ["events.jsonl", "harness-trace.json", "run-state.json"],
      processArtifacts: ["initialization-checklist.json", "feature-scheduler.json", "environment-readiness-ledger.json", "instruction-routing-ledger.json", "context-budget-ledger.json", "source-of-record-ledger.json", "architecture-boundary-ledger.json", "evaluator-rubric.json", "evaluator-rubric.md", "completion-authority-ledger.json", "quality-document.json", "quality-document.md", "continuity-ledger.json", "course-alignment-ledger.json", "lifecycle-ledger.json", "verification-pipeline-ledger.json", "session-clean-state-ledger.json", "feedback-promotion-ledger.json", "harness-diagnostic-ledger.json", "repair-guidance-ledger.json", "harness-subsystem-audit.json", "harness-ablation-comparison.json", "harness-quality-ledger.json", "feature-list.json", "sprint-contract.json", "verification-hierarchy.json", "progress.md", "session-handoff.md", "run-plan.json", "executor-lock.json", "worker-lock.json", "worker-function-registry.json", "provider-replacement-registry.json", "tool-safety-ledger.json", "function-dispatch-plan.json", "runtime-bus.json", "function-invocation-ledger.json", "startup-readiness.json", "policy-gate.json", "approval-gate.json", "budget-gate.json", "hook-ledger.json", "trace-context.json", "validation-report.md", "council-review.json", "skill-update-suggestions.md"],
      agentRunCount: input.agentRuns.length,
      agentRunArtifacts: input.agentRuns.flatMap((run) => run.artifacts),
      validationSummary: {
        total: input.validations.length,
        failed: failedValidators.length,
        warnings: warningValidators.length,
      },
    },
    continuity: {
      continuityLedger: {
        artifact: "continuity-ledger.json",
        status: input.continuityLedger.status,
        decisionCount: input.continuityLedger.summary.decisionCount,
        nextActionCount: input.continuityLedger.summary.nextActionCount,
        estimatedRebuildMinutes: input.continuityLedger.summary.estimatedRebuildMinutes,
        missingRestartArtifactCount: input.continuityLedger.summary.missingRestartArtifactCount,
      },
      durableStateArtifacts: ["initialization-checklist.json", "feature-scheduler.json", "environment-readiness-ledger.json", "instruction-routing-ledger.json", "context-budget-ledger.json", "source-of-record-ledger.json", "architecture-boundary-ledger.json", "evaluator-rubric.json", "evaluator-rubric.md", "completion-authority-ledger.json", "quality-document.json", "quality-document.md", "continuity-ledger.json", "course-alignment-ledger.json", "lifecycle-ledger.json", "verification-pipeline-ledger.json", "session-clean-state-ledger.json", "feedback-promotion-ledger.json", "harness-diagnostic-ledger.json", "repair-guidance-ledger.json", "harness-subsystem-audit.json", "harness-ablation-comparison.json", "harness-quality-ledger.json", "feature-list.json", "progress.md", "session-handoff.md", "run-state.json", "harness-trace.json", "events.jsonl", "run-plan.json", "executor-lock.json", "worker-lock.json", "worker-function-registry.json", "provider-replacement-registry.json", "tool-safety-ledger.json", "function-dispatch-plan.json", "runtime-bus.json", "function-invocation-ledger.json", "startup-readiness.json", "policy-gate.json", "approval-gate.json", "budget-gate.json", "hook-ledger.json", "trace-context.json"],
      stateStore: ".harness/runs/<run-id>/run-state.json",
      resumeInputs: input.spec.sources.map((source) => ({
        id: source.id,
        location: source.location,
        availability: source.availability,
      })),
    },
    cleanExit: {
      requiredGates: [
        statusGate(!failedValidators.length, failedValidators.length ? `Failed validators: ${failedValidators.map((validation) => validation.id).join(", ")}.` : "No failed validators."),
        statusGate(initializationValidation?.status === "pass", initializationValidation?.details ?? "Initialization checklist validation was not produced."),
        statusGate(featureSchedulerValidation?.status === "pass", featureSchedulerValidation?.details ?? "Feature scheduler validation was not produced."),
        statusGate(instructionRouterValidation?.status === "pass", instructionRouterValidation?.details ?? "Instruction router validation was not produced."),
        statusGate(input.artifacts.includes("feature-list.json"), "Feature list is written before completion."),
        statusGate(input.artifacts.includes("progress.md"), "Progress file is written before completion."),
        statusGate(input.artifacts.includes("session-handoff.md"), "Session handoff is written before completion."),
        statusGate(input.artifacts.includes("run-state.json"), "Run state is written before completion."),
        statusGate(input.artifacts.includes("events.jsonl"), "Event ledger is written before completion."),
        statusGate(input.artifacts.includes("validation-report.md"), "Validation report is written before completion."),
        statusGate(registryValidation?.status === "pass", registryValidation?.details ?? "Worker/function registry validation was not produced."),
        statusGate(providerReplacementValidation?.status === "pass", providerReplacementValidation?.details ?? "Provider replacement registry validation was not produced."),
        statusGate(contextBudgetValidation?.status === "pass", contextBudgetValidation?.details ?? "Context budget validation was not produced."),
        statusGate(dispatchValidation?.status === "pass", dispatchValidation?.details ?? "Function dispatch plan validation was not produced."),
        statusGate(runtimeBusValidation?.status === "pass", runtimeBusValidation?.details ?? "Runtime bus validation was not produced."),
        statusGate(invocationValidation?.status === "pass", invocationValidation?.details ?? "Function invocation ledger validation was not produced."),
        statusGate(startupReadinessValidation?.status === "pass" || startupReadinessValidation?.status === "warning", startupReadinessValidation?.details ?? "Startup readiness validation was not produced."),
        statusGate(policyValidation?.status === "pass", policyValidation?.details ?? "Policy gate validation was not produced."),
        statusGate(approvalValidation?.status === "pass", approvalValidation?.details ?? "Approval gate validation was not produced."),
        statusGate(budgetValidation?.status === "pass", budgetValidation?.details ?? "Budget gate validation was not produced."),
        statusGate(hookValidation?.status === "pass", hookValidation?.details ?? "Hook ledger validation was not produced."),
        statusGate(traceContextValidation?.status === "pass", traceContextValidation?.details ?? "Trace context validation was not produced."),
        statusGate(environmentReadinessValidation?.status === "pass", environmentReadinessValidation?.details ?? "Environment readiness validation was not produced."),
        statusGate(sourceOfRecordValidation?.status === "pass", sourceOfRecordValidation?.details ?? "Source-of-record validation was not produced."),
        statusGate(architectureBoundaryValidation?.status === "pass", architectureBoundaryValidation?.details ?? "Architecture boundary validation was not produced."),
        statusGate(evaluatorRubricValidation?.status === "pass", evaluatorRubricValidation?.details ?? "Evaluator rubric validation was not produced."),
        statusGate(completionAuthorityValidation?.status === "pass", completionAuthorityValidation?.details ?? "Completion authority validation was not produced."),
        statusGate(feedbackPromotionValidation?.status === "pass" || feedbackPromotionValidation?.status === "warning", feedbackPromotionValidation?.details ?? "Feedback promotion validation was not produced."),
        statusGate(diagnosticLoopValidation?.status === "pass", diagnosticLoopValidation?.details ?? "Diagnostic loop validation was not produced."),
        statusGate(repairGuidanceValidation?.status === "pass", repairGuidanceValidation?.details ?? "Repair guidance validation was not produced."),
        statusGate(subsystemAuditValidation?.status === "pass", subsystemAuditValidation?.details ?? "Harness subsystem audit validation was not produced."),
        statusGate(ablationComparisonValidation?.status === "pass", ablationComparisonValidation?.details ?? "Harness ablation comparison validation was not produced."),
        statusGate(qualityDocumentValidation?.status === "pass", qualityDocumentValidation?.details ?? "Quality document validation was not produced."),
        statusGate(qualityValidation?.status === "pass", qualityValidation?.details ?? "Harness quality validation was not produced."),
        statusGate(continuityValidation?.status === "pass", continuityValidation?.details ?? "Continuity validation was not produced."),
        statusGate(courseAlignmentValidation?.status === "pass", courseAlignmentValidation?.details ?? "Course alignment validation was not produced."),
        statusGate(lifecycleValidation?.status === "pass", lifecycleValidation?.details ?? "Lifecycle ledger validation was not produced."),
        statusGate(verifiedCompletionValidation?.status === "pass", verifiedCompletionValidation?.details ?? "Verified completion-rate validation was not produced."),
        statusGate(sessionCleanStateValidation?.status === "pass", sessionCleanStateValidation?.details ?? "Session clean-state validation was not produced."),
      ],
      warnings: warningValidators.map((validation) => ({ id: validation.id, details: validation.details })),
    },
  };
}

function statusGate(pass: boolean, details: string) {
  return {
    status: pass ? "pass" : "fail",
    details,
  };
}
