import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildHarness } from "../dist/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usecasesPath = path.join(repoRoot, "examples/app-building/usecases.json");
const outputRoot = path.join(repoRoot, "output/app-workflow-evals");
const runsRoot = path.join(outputRoot, "runs");

process.chdir(repoRoot);

const usecases = JSON.parse(await readFile(usecasesPath, "utf8"));

await rm(outputRoot, { recursive: true, force: true });
await mkdir(runsRoot, { recursive: true });

const results = [];

for (const usecase of usecases) {
  const outputDir = path.join(runsRoot, usecase.id);
  const request = {
    harness: "workflows",
    mode: usecase.mode,
    intent: usecase.intent,
    sources: usecase.sources.map((source) => path.resolve(repoRoot, source)),
    durationSeconds: usecase.durationSeconds,
    fps: usecase.fps,
    width: usecase.width,
    height: usecase.height,
    controls: usecase.controls ?? [],
    outputDir,
  };
  const result = await buildHarness(request);
  const route = {
    archetype: result.trace.selectedArchetype,
    mode: result.trace.selectedMode,
    composition: result.trace.routeComposition,
    selectedCapabilityPackIds: result.spec.selectedCapabilityPackIds ?? [],
    reason: `Executed capability pack(s) '${(result.spec.selectedCapabilityPackIds ?? []).join(", ")}'.`,
  };
  const artifacts = new Set(result.artifacts);
  const harnessIr = await readJson(path.join(outputDir, "harness-ir.json"));
  const executorLock = await readJson(path.join(outputDir, "executor-lock.json"));
  const workerLock = await readJson(path.join(outputDir, "worker-lock.json"));
  const runPlan = await readJson(path.join(outputDir, "run-plan.json"));
  const workerFunctionRegistry = await readJson(path.join(outputDir, "worker-function-registry.json"));
  const providerReplacementRegistry = await readJson(path.join(outputDir, "provider-replacement-registry.json"));
  const toolSafetyLedger = await readJson(path.join(outputDir, "tool-safety-ledger.json"));
  const contextBudgetLedger = await readJson(path.join(outputDir, "context-budget-ledger.json"));
  const initializationChecklist = await readJson(path.join(outputDir, "initialization-checklist.json"));
  const featureScheduler = await readJson(path.join(outputDir, "feature-scheduler.json"));
  const environmentReadinessLedger = await readJson(path.join(outputDir, "environment-readiness-ledger.json"));
  const instructionRoutingLedger = await readJson(path.join(outputDir, "instruction-routing-ledger.json"));
  const sourceOfRecordLedger = await readJson(path.join(outputDir, "source-of-record-ledger.json"));
  const lifecycleLedger = await readJson(path.join(outputDir, "lifecycle-ledger.json"));
  const architectureBoundaryLedger = await readJson(path.join(outputDir, "architecture-boundary-ledger.json"));
  const evaluatorRubric = await readJson(path.join(outputDir, "evaluator-rubric.json"));
  const completionAuthorityLedger = await readJson(path.join(outputDir, "completion-authority-ledger.json"));
  const verificationPipelineLedger = await readJson(path.join(outputDir, "verification-pipeline-ledger.json"));
  const sessionCleanStateLedger = await readJson(path.join(outputDir, "session-clean-state-ledger.json"));
  const feedbackPromotionLedger = await readJson(path.join(outputDir, "feedback-promotion-ledger.json"));
  const harnessDiagnosticLedger = await readJson(path.join(outputDir, "harness-diagnostic-ledger.json"));
  const repairGuidanceLedger = await readJson(path.join(outputDir, "repair-guidance-ledger.json"));
  const harnessSubsystemAudit = await readJson(path.join(outputDir, "harness-subsystem-audit.json"));
  const harnessAblationComparison = await readJson(path.join(outputDir, "harness-ablation-comparison.json"));
  const qualityDocument = await readJson(path.join(outputDir, "quality-document.json"));
  const harnessQualityLedger = await readJson(path.join(outputDir, "harness-quality-ledger.json"));
  const continuityLedger = await readJson(path.join(outputDir, "continuity-ledger.json"));
  const courseAlignmentLedger = await readJson(path.join(outputDir, "course-alignment-ledger.json"));
  const policyGate = await readJson(path.join(outputDir, "policy-gate.json"));
  const budgetGate = await readJson(path.join(outputDir, "budget-gate.json"));
  const approvalGate = await readJson(path.join(outputDir, "approval-gate.json"));
  const hookLedger = await readJson(path.join(outputDir, "hook-ledger.json"));
  const runtimeBus = await readJson(path.join(outputDir, "runtime-bus.json"));
  const traceContext = await readJson(path.join(outputDir, "trace-context.json"));
  const dispatchPlan = await readJson(path.join(outputDir, "function-dispatch-plan.json"));
  const invocationLedger = await readJson(path.join(outputDir, "function-invocation-ledger.json"));
  const nodeExecutionLedger = await readJson(path.join(outputDir, "node-execution-ledger.json"));
  const startupReadiness = await readJson(path.join(outputDir, "startup-readiness.json"));
  const councilDoctrine = await readJson(path.join(outputDir, "council-doctrine.json"));
  const councilReview = await readJson(path.join(outputDir, "council-review.json"));
  const observedPackIds = unique([
    ...executorLock.executors.map((executor) => executor.packId),
    ...workerLock.workers.map((worker) => worker.packId),
  ]);
  const missingExpectedPacks = usecase.expectedPackIds.filter((packId) => !observedPackIds.includes(packId));
  const missingExpectedArtifacts = usecase.expectedArtifacts.filter((artifact) => !artifacts.has(artifact));
  const validationStatuses = Object.fromEntries(result.validations.map((validation) => [validation.id, validation.status]));
  const graphNodeIds = result.spec.graph.map((node) => node.id);
  const graphCapabilityIds = unique(result.spec.graph.map((node) => node.capabilityId).filter(Boolean));
  const workerGroups = unique(workerLock.workers.map((worker) => worker.group));
  const checks = evaluateChecks({
    usecase,
    result,
    route,
    harnessIr,
    executorLock,
    workerLock,
    runPlan,
    workerFunctionRegistry,
    providerReplacementRegistry,
    toolSafetyLedger,
    contextBudgetLedger,
    initializationChecklist,
    featureScheduler,
    environmentReadinessLedger,
    instructionRoutingLedger,
    sourceOfRecordLedger,
    lifecycleLedger,
    architectureBoundaryLedger,
    evaluatorRubric,
    completionAuthorityLedger,
    verificationPipelineLedger,
    sessionCleanStateLedger,
    feedbackPromotionLedger,
    harnessDiagnosticLedger,
    repairGuidanceLedger,
    harnessSubsystemAudit,
    harnessAblationComparison,
    qualityDocument,
    harnessQualityLedger,
    continuityLedger,
    courseAlignmentLedger,
    policyGate,
    budgetGate,
    approvalGate,
    hookLedger,
    runtimeBus,
    traceContext,
    dispatchPlan,
    invocationLedger,
    nodeExecutionLedger,
    startupReadiness,
    councilDoctrine,
    councilReview,
    observedPackIds,
    artifacts,
    missingExpectedPacks,
    missingExpectedArtifacts,
  });
  const score = checks.reduce((total, check) => total + (check.pass ? check.weight : 0), 0);
  const gaps = summarizeGaps(usecase, {
    observedPackIds,
    missingExpectedPacks,
    missingExpectedArtifacts,
    route,
    graphNodeIds,
    graphCapabilityIds,
    checks,
  });

  results.push({
    id: usecase.id,
    title: usecase.title,
    notes: usecase.notes,
    outputDir,
    route,
    finalStatus: result.trace.finalStatus,
    selectedArchetype: result.trace.selectedArchetype,
    selectedMode: result.trace.selectedMode,
    observedPackIds,
    expectedPackIds: usecase.expectedPackIds,
    missingExpectedPacks,
    expectedArtifacts: usecase.expectedArtifacts,
    missingExpectedArtifacts,
    artifactContracts: result.spec.artifactContracts.map((contract) => ({
      id: contract.id,
      type: contract.type,
      validators: contract.validators,
    })),
    graphNodeIds,
    graphCapabilityIds,
    workerGroups,
    runtimeControl: {
      workerFunctionCount: workerFunctionRegistry.workerFunctions?.length ?? 0,
      executorFunctionCount: workerFunctionRegistry.executorFunctions?.length ?? 0,
      replacementProviderCount: providerReplacementRegistry.summary?.providerCount ?? 0,
      replacementSlotCount: providerReplacementRegistry.summary?.replacementSlotCount ?? 0,
      replacementUnresolvedCount: providerReplacementRegistry.summary?.unresolvedCount ?? -1,
      toolSafetyStatus: toolSafetyLedger.status,
      toolSafetyCallCount: toolSafetyLedger.summary?.callCount ?? 0,
      toolSafetyConcurrentSafeCallCount: toolSafetyLedger.summary?.concurrentSafeCallCount ?? 0,
      toolSafetySerialCallCount: toolSafetyLedger.summary?.serialCallCount ?? 0,
      toolSafetyDeniedCallCount: toolSafetyLedger.summary?.deniedCallCount ?? -1,
      toolSafetyUnclassifiedCallCount: toolSafetyLedger.summary?.unclassifiedCallCount ?? -1,
      contextBudgetStatus: contextBudgetLedger.status,
      contextBudgetEstimatedTokenCount: contextBudgetLedger.summary?.estimatedTokenCount ?? 0,
      contextBudgetMaxTokenBudget: contextBudgetLedger.summary?.maxTokenBudget ?? 0,
      contextBudgetUsageRatio: contextBudgetLedger.summary?.usageRatio ?? 0,
      contextBudgetIsolationBoundaryCount: contextBudgetLedger.summary?.isolationBoundaryCount ?? 0,
      contextBudgetInvalidationPointCount: contextBudgetLedger.summary?.invalidationPointCount ?? 0,
      contextBudgetUnresolvedCount: contextBudgetLedger.summary?.unresolvedCount ?? -1,
      initializationStatus: initializationChecklist.status,
      featureSchedulerStatus: featureScheduler.status,
      environmentReadinessStatus: environmentReadinessLedger.status,
      environmentReadinessFailedCheckCount: environmentReadinessLedger.summary?.failedCheckCount ?? -1,
      environmentReadinessWarningCheckCount: environmentReadinessLedger.summary?.warningCheckCount ?? -1,
      environmentReadinessUnavailableSourceCount: environmentReadinessLedger.summary?.unavailableSourceCount ?? -1,
      environmentReadinessLockfileCount: environmentReadinessLedger.summary?.lockfileCount ?? 0,
      instructionRouterStatus: instructionRoutingLedger.status,
      instructionTopicCount: instructionRoutingLedger.selectedTopics?.length ?? 0,
      instructionHeldBackTopicCount: instructionRoutingLedger.heldBackTopics?.length ?? 0,
      instructionBudgetStatus: instructionRoutingLedger.instructionBudget?.status ?? "missing",
      instructionEntryEstimatedLineCount: instructionRoutingLedger.instructionBudget?.entryEstimatedLineCount ?? 0,
      instructionRevealRatio: instructionRoutingLedger.instructionBudget?.revealRatio ?? 0,
      sourceOfRecordStatus: sourceOfRecordLedger.status,
      sourceOfRecordAnsweredQuestionCount: sourceOfRecordLedger.summary?.answeredQuestionCount ?? 0,
      sourceOfRecordFailedCheckCount: sourceOfRecordLedger.summary?.failedCheckCount ?? -1,
      activeFeatureCount: featureScheduler.activeFeatureIds?.length ?? 0,
      completionPressure: featureScheduler.summary?.completionPressure ?? 0,
      lifecycleStatus: lifecycleLedger.status,
      lifecyclePhaseCount: lifecycleLedger.phases?.length ?? 0,
      architectureBoundaryStatus: architectureBoundaryLedger.status,
      architectureBoundaryRuleCount: architectureBoundaryLedger.summary?.ruleCount ?? 0,
      architectureBoundaryViolationCount: architectureBoundaryLedger.summary?.violationCount ?? -1,
      evaluatorRubricStatus: evaluatorRubric.status,
      evaluatorRubricDimensionCount: evaluatorRubric.summary?.dimensionCount ?? 0,
      evaluatorRubricPassingDimensionCount: evaluatorRubric.summary?.passingDimensionCount ?? 0,
      evaluatorRubricFailedDimensionCount: evaluatorRubric.summary?.failedDimensionCount ?? -1,
      evaluatorRubricWarningDimensionCount: evaluatorRubric.summary?.warningDimensionCount ?? -1,
      evaluatorRubricLowestScore: evaluatorRubric.summary?.lowestScore ?? 0,
      completionAuthorityStatus: completionAuthorityLedger.status,
      completionAuthorityRoleCount: completionAuthorityLedger.summary?.roleCount ?? 0,
      completionAuthorityGateCount: completionAuthorityLedger.summary?.authorityGateCount ?? 0,
      completionAuthorityFailedGateCount: completionAuthorityLedger.summary?.failedAuthorityGateCount ?? -1,
      completionAuthorityWarningGateCount: completionAuthorityLedger.summary?.warningAuthorityGateCount ?? -1,
      completionAuthorityUnresolvedCount: completionAuthorityLedger.summary?.unresolvedCount ?? -1,
      verificationPipelineStatus: verificationPipelineLedger.status,
      verifiedCompletionRate: verificationPipelineLedger.summary?.verifiedCompletionRate ?? 0,
      verifiedCompletionRequiredFeatureCount: verificationPipelineLedger.summary?.requiredFeatureCount ?? 0,
      verificationPipelineUnresolvedCount: verificationPipelineLedger.summary?.unresolvedCount ?? -1,
      sessionCleanStateStatus: sessionCleanStateLedger.status,
      sessionCleanStatePassedCheckCount: sessionCleanStateLedger.summary?.passedCheckCount ?? 0,
      sessionCleanStateFailedCheckCount: sessionCleanStateLedger.summary?.failedCheckCount ?? -1,
      sessionCleanStateStaleArtifactCount: sessionCleanStateLedger.summary?.staleArtifactCount ?? -1,
      feedbackPromotionStatus: feedbackPromotionLedger.status,
      feedbackPromotionCandidateCount: feedbackPromotionLedger.sourceSummary?.promotionCandidateCount ?? 0,
      diagnosticStatus: harnessDiagnosticLedger.status,
      diagnosticAttributionCount: harnessDiagnosticLedger.sourceSummary?.attributionCount ?? 0,
      repairGuidanceStatus: repairGuidanceLedger.status,
      repairActionCount: repairGuidanceLedger.sourceSummary?.repairActionCount ?? 0,
      repairSignalCount: repairGuidanceLedger.sourceSummary?.repairSignalCount ?? 0,
      subsystemAuditStatus: harnessSubsystemAudit.status,
      subsystemAuditAverageScore: harnessSubsystemAudit.summary?.averageScore ?? 0,
      subsystemAuditPrimaryBottleneck: harnessSubsystemAudit.summary?.primaryBottleneck ?? "none",
      subsystemAuditCount: harnessSubsystemAudit.subsystems?.length ?? 0,
      ablationComparisonStatus: harnessAblationComparison.status,
      ablationMeasuredProbeCount: harnessAblationComparison.summary?.measuredProbeCount ?? 0,
      ablationPrimaryMarginalSubsystem: harnessAblationComparison.summary?.primaryMarginalSubsystem ?? "none",
      ablationUnresolvedCount: harnessAblationComparison.unresolved?.length ?? -1,
      qualityDocumentStatus: qualityDocument.status,
      qualityDocumentGrade: qualityDocument.grade ?? "missing",
      qualityDocumentModuleCount: qualityDocument.summary?.moduleCount ?? 0,
      qualityDocumentHealthyModuleCount: qualityDocument.summary?.healthyModuleCount ?? 0,
      qualityDocumentBlockedModuleCount: qualityDocument.summary?.blockedModuleCount ?? -1,
      qualityDocumentUnresolvedCount: qualityDocument.summary?.unresolvedCount ?? -1,
      harnessQualityStatus: harnessQualityLedger.status,
      harnessQualityScore: harnessQualityLedger.score ?? 0,
      harnessQualityGrade: harnessQualityLedger.grade ?? "missing",
      harnessQualityWarningCheckCount: harnessQualityLedger.summary?.warningCheckCount ?? -1,
      harnessQualityFailedCheckCount: harnessQualityLedger.summary?.failedCheckCount ?? -1,
      harnessQualityPriorityCount: harnessQualityLedger.priorities?.length ?? 0,
      continuityStatus: continuityLedger.status,
      continuityDecisionCount: continuityLedger.summary?.decisionCount ?? 0,
      continuityMissingRestartArtifactCount: continuityLedger.summary?.missingRestartArtifactCount ?? -1,
      continuityNextActionCount: continuityLedger.summary?.nextActionCount ?? 0,
      continuityEstimatedRebuildMinutes: continuityLedger.summary?.estimatedRebuildMinutes ?? 99,
      continuityRebuildCostStatus: continuityLedger.summary?.rebuildCostStatus ?? "missing",
      courseAlignmentStatus: courseAlignmentLedger.status,
      courseAlignmentScore: courseAlignmentLedger.score ?? 0,
      courseAlignmentRequirementCount: courseAlignmentLedger.summary?.requirementCount ?? 0,
      courseAlignmentPassingRequirementCount: courseAlignmentLedger.summary?.passingRequirementCount ?? 0,
      courseAlignmentFailedRequirementCount: courseAlignmentLedger.summary?.failedRequirementCount ?? -1,
      courseAlignmentWarningRequirementCount: courseAlignmentLedger.summary?.warningRequirementCount ?? -1,
      courseAlignmentCoveredSubsystemCount: courseAlignmentLedger.summary?.coveredSubsystemCount ?? 0,
      courseAlignmentUnresolvedCount: courseAlignmentLedger.summary?.unresolvedCount ?? -1,
      policyStatus: policyGate.status,
      approvalStatus: approvalGate.status,
      budgetStatus: budgetGate.status,
      hookEmissionCount: hookLedger.emissions?.length ?? 0,
      runtimeBusStatus: runtimeBus.status,
      runtimeBusTopicCount: runtimeBus.topics?.length ?? 0,
      runtimeBusSubscriberCount: runtimeBus.subscribers?.length ?? 0,
      traceSpanCount: traceContext.spans?.length ?? 0,
      providerRouteCount: dispatchPlan.providerRoutes?.length ?? 0,
      completedInvocationCount: invocationLedger.summary?.completedInvocationCount ?? 0,
      missingInvocationCount: invocationLedger.summary?.missingInvocationCount ?? 0,
      invocationLedgerStatus: invocationLedger.status,
      startupReadinessStatus: startupReadiness.status,
    },
    validationStatuses,
    criticQuestionCount: councilReview.criticQuestions?.length ?? 0,
    unresolvedBlockerQuestionCount: councilReview.unresolvedBlockerQuestions?.length ?? 0,
    criticCategories: unique((councilReview.criticQuestions ?? []).map((question) => question.category)),
    sourceFacts: harnessIr.evidenceGraph.facts.map((fact) => ({
      kind: fact.kind,
      tags: fact.tags ?? [],
      claim: fact.claim,
    })),
    checks,
    score,
    gaps,
  });
}

const summary = {
  generatedAt: new Date().toISOString(),
  usecaseCount: results.length,
  averageScore: Math.round(results.reduce((total, result) => total + result.score, 0) / results.length),
  casesWithGaps: results.filter((result) => result.gaps.length > 0).map((result) => result.id),
  architecturalFindings: architecturalFindings(results),
};

const payload = { summary, results };
await writeFile(path.join(outputRoot, "evaluation-results.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(path.join(outputRoot, "evaluation-report.md"), renderReport(payload), "utf8");

console.log(`Wrote ${path.join(outputRoot, "evaluation-report.md")}`);
console.log(`Average score: ${summary.averageScore}/100`);
for (const result of results) {
  console.log(`${result.id}: ${result.score}/100 ${result.finalStatus} [${result.observedPackIds.join(", ")}]`);
}

if (results.some((result) => result.finalStatus === "failed" || result.checks.some((check) => !check.pass))) {
  process.exitCode = 1;
}

function evaluateChecks({
  usecase,
  result,
  route,
  harnessIr,
  executorLock,
  workerLock,
  runPlan,
  workerFunctionRegistry,
  providerReplacementRegistry,
  toolSafetyLedger,
  contextBudgetLedger,
  initializationChecklist,
  featureScheduler,
  environmentReadinessLedger,
  instructionRoutingLedger,
  sourceOfRecordLedger,
  lifecycleLedger,
  architectureBoundaryLedger,
  evaluatorRubric,
  completionAuthorityLedger,
  verificationPipelineLedger,
  sessionCleanStateLedger,
  feedbackPromotionLedger,
  harnessDiagnosticLedger,
  repairGuidanceLedger,
  harnessSubsystemAudit,
  harnessAblationComparison,
  qualityDocument,
  harnessQualityLedger,
  continuityLedger,
  courseAlignmentLedger,
  policyGate,
  budgetGate,
  approvalGate,
  hookLedger,
  runtimeBus,
  traceContext,
  dispatchPlan,
  invocationLedger,
  nodeExecutionLedger,
  startupReadiness,
  councilDoctrine,
  councilReview,
  observedPackIds,
  artifacts,
  missingExpectedPacks,
  missingExpectedArtifacts,
}) {
  const sourceAvailability = result.validations.find((validation) => validation.id === "source_availability");
  const domainSpecific = domainSpecificFit(usecase, observedPackIds, result.spec.graph);
  const expectedStatus = usecase.expectedFinalStatus;
  const routePackIds = route.composition?.matchedPacks?.map((pack) => pack.packId) ?? [];
  const selectedPackIds = result.spec.selectedCapabilityPackIds ?? [];
  return [
    {
      id: "status",
      label: expectedStatus ? "Run reached the expected final status" : "Run reached a nonfailed final status",
      weight: 10,
      pass: expectedStatus ? result.trace.finalStatus === expectedStatus : result.trace.finalStatus === "success" || result.trace.finalStatus === "partial",
      detail: expectedStatus ? `finalStatus=${result.trace.finalStatus}, expected=${expectedStatus}` : `finalStatus=${result.trace.finalStatus}`,
    },
    {
      id: "expected-packs",
      label: "Expected capability packs resolved",
      weight: 15,
      pass: missingExpectedPacks.length === 0,
      detail: missingExpectedPacks.length ? `missing ${missingExpectedPacks.join(", ")}` : `observed ${observedPackIds.join(", ")}`,
    },
    {
      id: "source-grounding",
      label: "Source evidence grounded the workflow",
      weight: 10,
      pass: sourceAvailability?.status === "pass" && sourceOfRecordLedger.status === "pass" && harnessIr.evidenceGraph.facts.length >= result.request.sources.length,
      detail: `${harnessIr.evidenceGraph.facts.length} facts, source_availability=${sourceAvailability?.status ?? "missing"}, source_of_record=${sourceOfRecordLedger.status}`,
    },
    {
      id: "expected-artifacts",
      label: "Expected artifacts were produced",
      weight: 5,
      pass: missingExpectedArtifacts.length === 0,
      detail: missingExpectedArtifacts.length ? `missing ${missingExpectedArtifacts.join(", ")}` : `${artifacts.size} artifacts`,
    },
    {
      id: "manifest-locks",
      label: "Executor and run-plan locks are manifest-resolved",
      weight: 15,
      pass:
        executorLock.executors.length > 0 &&
        Boolean(runPlan.executorLockDigest) &&
        runPlan.nodes.some((node) => node.executorLockIds.length > 0) &&
        executorLock.executors.every((executor) => executor.adapter === "local:module" && executor.packId),
      detail: `${executorLock.executors.length} executors, ${runPlan.nodeCount} nodes`,
    },
    {
      id: "runtime-workers",
      label: "Runtime workers resolved through contracts and gated before dispatch",
      weight: 10,
      pass:
        Boolean(runPlan.workerLockDigest) &&
        ["domain-planning", "runtime-planning", "council-elders", "course-correction", "finalization"].every((group) => workerLock.workers.some((worker) => worker.group === group)) &&
        workerLock.workers.every((worker) => worker.contractId && worker.functionId && worker.triggerId && worker.replacementCompatibilityKey) &&
        (workerFunctionRegistry.workerFunctions?.length ?? 0) === workerLock.workers.length &&
        providerReplacementRegistry.status === "pass" &&
        result.validations.find((validation) => validation.id === "provider_replacement_registry_ready")?.status === "pass" &&
        (providerReplacementRegistry.summary?.providerCount ?? 0) >= workerLock.workers.length + executorLock.executors.length &&
        (providerReplacementRegistry.summary?.replacementSlotCount ?? 0) > 0 &&
        (providerReplacementRegistry.summary?.unresolvedCount ?? -1) === 0 &&
        toolSafetyLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "tool_safety_registry_ready")?.status === "pass" &&
        (toolSafetyLedger.summary?.callCount ?? 0) >= (dispatchPlan.providerRoutes?.length ?? 0) &&
        (toolSafetyLedger.summary?.deniedCallCount ?? -1) === 0 &&
        (toolSafetyLedger.summary?.unclassifiedCallCount ?? -1) === 0 &&
        (toolSafetyLedger.unresolved?.length ?? -1) === 0 &&
        contextBudgetLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "context_budget_ready")?.status === "pass" &&
        (contextBudgetLedger.protocol?.operations ?? []).join("|") === "SELECT|WRITE|COMPRESS|ISOLATE" &&
        (contextBudgetLedger.summary?.estimatedTokenCount ?? 1) <= (contextBudgetLedger.summary?.maxTokenBudget ?? 0) &&
        (contextBudgetLedger.summary?.invalidationPointCount ?? 0) >= 4 &&
        (contextBudgetLedger.summary?.isolationBoundaryCount ?? 0) >= 2 &&
        (contextBudgetLedger.unresolved?.length ?? -1) === 0 &&
        initializationChecklist.status === "pass" &&
        result.validations.find((validation) => validation.id === "initialization_checklist_confirmed")?.status === "pass" &&
        featureScheduler.status === "pass" &&
        result.validations.find((validation) => validation.id === "feature_scheduler_ready")?.status === "pass" &&
        (featureScheduler.activeFeatureIds?.length ?? 0) <= 1 &&
        environmentReadinessLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "environment_readiness_confirmed")?.status === "pass" &&
        (environmentReadinessLedger.summary?.failedCheckCount ?? -1) === 0 &&
        (environmentReadinessLedger.summary?.warningCheckCount ?? -1) === 0 &&
        (environmentReadinessLedger.summary?.unavailableSourceCount ?? -1) === 0 &&
        (environmentReadinessLedger.summary?.lockfileCount ?? 0) > 0 &&
        instructionRoutingLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "instruction_router_resolved")?.status === "pass" &&
        (instructionRoutingLedger.selectedTopics?.length ?? 0) > 0 &&
        instructionRoutingLedger.instructionBudget?.status === "pass" &&
        (instructionRoutingLedger.instructionBudget?.entryEstimatedLineCount ?? 0) <= (instructionRoutingLedger.instructionBudget?.maxEntryLineCount ?? 0) &&
        (instructionRoutingLedger.instructionBudget?.alwaysLoadedTopicCount ?? 99) <= (instructionRoutingLedger.instructionBudget?.maxAlwaysLoadedTopics ?? 0) &&
        (instructionRoutingLedger.instructionBudget?.checks ?? []).every((check) => check.status === "pass") &&
        (instructionRoutingLedger.topicAudit ?? []).every((topic) => topic.budgetStatus === "pass" && topic.metadataStatus === "pass") &&
        (instructionRoutingLedger.unresolved?.length ?? -1) === 0 &&
        sourceOfRecordLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "source_of_record_confirmed")?.status === "pass" &&
        (sourceOfRecordLedger.summary?.answeredQuestionCount ?? 0) === 5 &&
        (sourceOfRecordLedger.summary?.failedCheckCount ?? -1) === 0 &&
        (sourceOfRecordLedger.unresolved?.length ?? -1) === 0 &&
        lifecycleLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "lifecycle_ledger_clean")?.status === "pass" &&
        (lifecycleLedger.phases?.length ?? 0) >= 23 &&
        (lifecycleLedger.cleanExit?.missingArtifacts?.length ?? -1) === 0 &&
        architectureBoundaryLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "architecture_boundary_rules_enforced")?.status === "pass" &&
        (architectureBoundaryLedger.summary?.violationCount ?? -1) === 0 &&
        evaluatorRubric.status === "pass" &&
        result.validations.find((validation) => validation.id === "evaluator_rubric_recorded")?.status === "pass" &&
        (evaluatorRubric.summary?.dimensionCount ?? 0) === 5 &&
        (evaluatorRubric.summary?.passingDimensionCount ?? 0) === 5 &&
        (evaluatorRubric.summary?.failedDimensionCount ?? -1) === 0 &&
        (evaluatorRubric.summary?.warningDimensionCount ?? -1) === 0 &&
        (evaluatorRubric.summary?.lowestScore ?? 0) >= 4 &&
        completionAuthorityLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "completion_authority_confirmed")?.status === "pass" &&
        (completionAuthorityLedger.roles?.length ?? 0) === 4 &&
        (completionAuthorityLedger.authorityGates?.length ?? 0) >= 7 &&
        (completionAuthorityLedger.summary?.failedAuthorityGateCount ?? -1) === 0 &&
        (completionAuthorityLedger.summary?.warningAuthorityGateCount ?? -1) === 0 &&
        (completionAuthorityLedger.summary?.unresolvedCount ?? -1) === 0 &&
        verificationPipelineLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "verified_completion_rate_passed")?.status === "pass" &&
        (verificationPipelineLedger.summary?.verifiedCompletionRate ?? 0) === 1 &&
        (verificationPipelineLedger.summary?.unresolvedCount ?? -1) === 0 &&
        sessionCleanStateLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "session_clean_state_ready")?.status === "pass" &&
        (sessionCleanStateLedger.summary?.failedCheckCount ?? -1) === 0 &&
        (sessionCleanStateLedger.summary?.staleArtifactCount ?? -1) === 0 &&
        feedbackPromotionLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "feedback_promotion_recorded")?.status === "pass" &&
        (feedbackPromotionLedger.sourceSummary?.promotionCandidateCount ?? 0) > 0 &&
        harnessDiagnosticLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "diagnostic_loop_recorded")?.status === "pass" &&
        repairGuidanceLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "repair_guidance_recorded")?.status === "pass" &&
        (repairGuidanceLedger.unresolved?.length ?? -1) === 0 &&
        harnessSubsystemAudit.status === "pass" &&
        result.validations.find((validation) => validation.id === "harness_subsystem_audit_recorded")?.status === "pass" &&
        (harnessSubsystemAudit.subsystems?.length ?? 0) === 5 &&
        (harnessSubsystemAudit.unresolved?.length ?? -1) === 0 &&
        harnessAblationComparison.status === "pass" &&
        result.validations.find((validation) => validation.id === "harness_ablation_comparison_recorded")?.status === "pass" &&
        (harnessAblationComparison.summary?.measuredProbeCount ?? 0) === 5 &&
        (harnessAblationComparison.unresolved?.length ?? -1) === 0 &&
        qualityDocument.status === "pass" &&
        result.validations.find((validation) => validation.id === "quality_document_recorded")?.status === "pass" &&
        (qualityDocument.summary?.moduleCount ?? 0) === 5 &&
        (qualityDocument.summary?.healthyModuleCount ?? 0) === 5 &&
        (qualityDocument.summary?.blockedModuleCount ?? -1) === 0 &&
        (qualityDocument.summary?.unresolvedCount ?? -1) === 0 &&
        harnessQualityLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "harness_quality_documented")?.status === "pass" &&
        (harnessQualityLedger.score ?? 0) >= 90 &&
        (harnessQualityLedger.summary?.failedCheckCount ?? -1) === 0 &&
        (harnessQualityLedger.summary?.warningCheckCount ?? -1) === 0 &&
        continuityLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "continuity_state_recorded")?.status === "pass" &&
        (continuityLedger.summary?.decisionCount ?? 0) >= 5 &&
        (continuityLedger.summary?.missingRestartArtifactCount ?? -1) === 0 &&
        (continuityLedger.summary?.nextActionCount ?? 0) > 0 &&
        (continuityLedger.summary?.estimatedRebuildMinutes ?? 99) <= 3 &&
        courseAlignmentLedger.status === "pass" &&
        result.validations.find((validation) => validation.id === "course_alignment_confirmed")?.status === "pass" &&
        (courseAlignmentLedger.score ?? 0) >= 90 &&
        (courseAlignmentLedger.summary?.requirementCount ?? 0) === 12 &&
        (courseAlignmentLedger.summary?.passingRequirementCount ?? 0) === 12 &&
        (courseAlignmentLedger.summary?.failedRequirementCount ?? -1) === 0 &&
        (courseAlignmentLedger.summary?.warningRequirementCount ?? -1) === 0 &&
        (courseAlignmentLedger.summary?.coveredSubsystemCount ?? 0) === 5 &&
        (courseAlignmentLedger.summary?.unresolvedCount ?? -1) === 0 &&
        policyGate.status === "pass" &&
        approvalGate.status === "pass" &&
        budgetGate.status === "pass" &&
        runtimeBus.status === "pass" &&
        result.validations.find((validation) => validation.id === "runtime_bus_resolved")?.status === "pass" &&
        (runtimeBus.subscribers?.length ?? 0) >= workerLock.workers.length + executorLock.executors.length &&
        (runtimeBus.topics?.length ?? 0) > 0 &&
        (hookLedger.emissions?.length ?? 0) >= workerLock.workers.length + executorLock.executors.length + 3 &&
        (traceContext.spans?.length ?? 0) >= runPlan.nodes.length + workerLock.workers.length + executorLock.executors.length &&
        dispatchPlan.status === "pass" &&
        invocationLedger.status === "pass" &&
        (invocationLedger.summary?.missingInvocationCount ?? -1) === 0 &&
        result.validations.find((validation) => validation.id === "function_invocation_ledger_completed")?.status === "pass" &&
        nodeExecutionLedger.status === "pass" &&
        (nodeExecutionLedger.summary?.missingNodeCount ?? -1) === 0 &&
        (nodeExecutionLedger.summary?.dependencyViolationCount ?? -1) === 0 &&
        result.validations.find((validation) => validation.id === "node_execution_integrity")?.status === "pass" &&
        result.trace.agentsSpawned.every((agent) => agent.status !== "planned_not_executed") &&
        sameMembers(routePackIds, selectedPackIds) &&
        sameMembers(harnessIr.selectedCapabilityPackIds ?? [], selectedPackIds) &&
        startupReadiness.status !== "fail",
      detail: `${workerLock.workers.map((worker) => `${worker.group}:${worker.functionId}`).join(", ")}; initialization=${initializationChecklist.status}, scheduler=${featureScheduler.status}/${featureScheduler.activeFeatureIds?.length ?? 0}, environment=${environmentReadinessLedger.status}/failed=${environmentReadinessLedger.summary?.failedCheckCount ?? "missing"}/warnings=${environmentReadinessLedger.summary?.warningCheckCount ?? "missing"}/lockfiles=${environmentReadinessLedger.summary?.lockfileCount ?? "missing"}, instructions=${instructionRoutingLedger.status}/${instructionRoutingLedger.selectedTopics?.length ?? 0}/budget=${instructionRoutingLedger.instructionBudget?.status ?? "missing"}/heldBack=${instructionRoutingLedger.heldBackTopics?.length ?? 0}, toolSafety=${toolSafetyLedger.status}/${toolSafetyLedger.summary?.callCount ?? 0}/serial=${toolSafetyLedger.summary?.serialCallCount ?? 0}, context=${contextBudgetLedger.status}/${contextBudgetLedger.summary?.estimatedTokenCount ?? 0}/${contextBudgetLedger.summary?.maxTokenBudget ?? 0}/isolation=${contextBudgetLedger.summary?.isolationBoundaryCount ?? 0}, sourceRecord=${sourceOfRecordLedger.status}/${sourceOfRecordLedger.summary?.answeredQuestionCount ?? 0}, lifecycle=${lifecycleLedger.status}/${lifecycleLedger.phases?.length ?? 0}, architecture=${architectureBoundaryLedger.status}/${architectureBoundaryLedger.summary?.violationCount ?? -1}, rubric=${evaluatorRubric.status}/${evaluatorRubric.summary?.passingDimensionCount ?? 0}/${evaluatorRubric.summary?.dimensionCount ?? 0}, authority=${completionAuthorityLedger.status}/${completionAuthorityLedger.summary?.authorityGateCount ?? 0}/${completionAuthorityLedger.summary?.unresolvedCount ?? -1}, vcr=${verificationPipelineLedger.status}/${verificationPipelineLedger.summary?.verifiedCompletionRate ?? 0}, clean=${sessionCleanStateLedger.status}/${sessionCleanStateLedger.summary?.staleArtifactCount ?? -1}, feedback=${feedbackPromotionLedger.status}/${feedbackPromotionLedger.sourceSummary?.promotionCandidateCount ?? 0}, diagnostic=${harnessDiagnosticLedger.status}/${harnessDiagnosticLedger.sourceSummary?.attributionCount ?? 0}, repair=${repairGuidanceLedger.status}/${repairGuidanceLedger.sourceSummary?.repairActionCount ?? 0}, audit=${harnessSubsystemAudit.status}/${harnessSubsystemAudit.summary?.primaryBottleneck ?? "none"}, ablation=${harnessAblationComparison.status}/${harnessAblationComparison.summary?.primaryMarginalSubsystem ?? "none"}, qualityDoc=${qualityDocument.status}/${qualityDocument.summary?.healthyModuleCount ?? 0}/${qualityDocument.summary?.moduleCount ?? 0}, quality=${harnessQualityLedger.status}/${harnessQualityLedger.score ?? 0}/${harnessQualityLedger.grade ?? "missing"}, continuity=${continuityLedger.status}/${continuityLedger.summary?.decisionCount ?? 0}/${continuityLedger.summary?.estimatedRebuildMinutes ?? "missing"}, course=${courseAlignmentLedger.status}/${courseAlignmentLedger.score ?? 0}/${courseAlignmentLedger.summary?.passingRequirementCount ?? 0}, registry=${workerFunctionRegistry.workerFunctions?.length ?? 0}, replacements=${providerReplacementRegistry.status}/${providerReplacementRegistry.summary?.replacementSlotCount ?? 0}/${providerReplacementRegistry.summary?.unresolvedCount ?? -1}, routes=${dispatchPlan.providerRoutes?.length ?? 0}, bus=${runtimeBus.status}/${runtimeBus.subscribers?.length ?? 0}, invocations=${invocationLedger.summary?.completedInvocationCount ?? 0}/${invocationLedger.invocations?.length ?? 0}, startup=${startupReadiness.status}, policy=${policyGate.status}, approval=${approvalGate.status}, budget=${budgetGate.status}, hooks=${hookLedger.emissions?.length ?? 0}, spans=${traceContext.spans?.length ?? 0}`,
    },
    {
      id: "council-and-validators",
      label: "Council doctrine and required validators completed",
      weight: 10,
      pass:
        result.validations.every((validation) => validation.status === "pass" || validation.status === "warning") &&
        councilDoctrine.references.some((reference) => reference.id === "gstack") &&
        councilDoctrine.references.some((reference) => reference.id === "gbrain") &&
        (councilReview.criticReviews?.length ?? 0) >= 3 &&
        (councilReview.criticQuestions?.length ?? 0) > 0,
      detail: `${result.validations.length} validations, ${councilDoctrine.references.length} doctrine refs, ${councilReview.criticQuestions?.length ?? 0} critic questions`,
    },
    {
      id: "app-domain-fit",
      label: "App-building request used a domain-specific workflow shape",
      weight: 20,
      pass: domainSpecific.pass,
      detail: domainSpecific.detail,
    },
    {
      id: "route-shape",
      label: "Route representation matches the workflow shape",
      weight: 5,
      pass: routeShapeFit(usecase, route),
      detail:
        usecase.domainFit === "composite"
          ? `route reports ${route.archetype}; composed packs ${(route.composition?.matchedPacks ?? []).map((pack) => pack.packId).join(", ") || "none"}`
          : `route reports ${route.archetype}`,
    },
  ];
}

function domainSpecificFit(usecase, observedPackIds, graph) {
  const hasDesign = observedPackIds.includes("design-system-ui");
  const hasMotion = observedPackIds.includes("motion-lottie");
  const hasGeneric = observedPackIds.includes("generic-report");
  const hasAppBuilding = observedPackIds.includes("app-building-fullstack");
  if (usecase.domainFit === "specialized") {
    return {
      pass: (hasDesign || hasMotion) && !hasGeneric,
      detail: (hasDesign || hasMotion) && !hasGeneric ? "specialized pack selected" : "specialized request fell back to generic",
    };
  }
  if (usecase.domainFit === "composite") {
    const graphHasDesign = graph.some((node) => node.id.includes("design"));
    const graphHasMotion = graph.some((node) => node.id.includes("lottie") || node.id.includes("svg"));
    return {
      pass: hasDesign && hasMotion && graphHasDesign && graphHasMotion,
      detail: hasDesign && hasMotion ? "design and motion packs composed" : "composite request did not compose required packs",
    };
  }
  if (usecase.domainFit === "app-building") {
    const graphHasApp = graph.some((node) => node.id.includes("app-") || node.capabilityId?.includes("app-"));
    const graphHasApi = graph.some((node) => node.id.includes("app-api") || node.capabilityId?.includes("api-"));
    const graphHasPersistence = graph.some((node) => node.id.includes("app-persistence") || node.capabilityId?.includes("persistence"));
    const graphHasTests = graph.some((node) => node.id.includes("app-tests") || node.capabilityId?.includes("test"));
    return {
      pass: hasAppBuilding && !hasGeneric && graphHasApp && graphHasApi && graphHasPersistence && graphHasTests,
      detail: hasAppBuilding && !hasGeneric ? "app-building pack selected with app/API/persistence/test graph nodes" : "full-stack PRD did not resolve app-building pack",
    };
  }
  return {
    pass: false,
    detail: hasGeneric ? "generic-report fallback; app-building pack was not selected" : "no explicit app-building pack selected",
  };
}

function routeShapeFit(usecase, route) {
  if (usecase.domainFit === "composite") {
    const matchedPackIds = route.composition?.matchedPacks?.map((pack) => pack.packId) ?? [];
    return Boolean(route.composition?.composite) && ["design-system-ui", "motion-lottie"].every((packId) => matchedPackIds.includes(packId));
  }
  return Boolean(route.archetype);
}

function summarizeGaps(usecase, context) {
  const gaps = [];
  if (context.missingExpectedPacks.length) {
    gaps.push(`Expected pack(s) missing: ${context.missingExpectedPacks.join(", ")}.`);
  }
  if (context.missingExpectedArtifacts.length) {
    gaps.push(`Expected artifact(s) missing: ${context.missingExpectedArtifacts.join(", ")}.`);
  }
  const failedChecks = context.checks.filter((check) => !check.pass);
  for (const check of failedChecks) {
    gaps.push(`${check.label}: ${check.detail}.`);
  }
  if (usecase.domainFit === "app-building" && !context.observedPackIds.includes("app-building-fullstack")) {
    gaps.push("Full-stack PRD did not resolve the app-building/API/persistence capability pack.");
  }
  if (usecase.domainFit === "app-building" && context.observedPackIds.includes("generic-report")) {
    gaps.push("Full-stack PRD still selected generic-report alongside the app-building pack.");
  }
  if (usecase.domainFit === "composite" && !context.route.composition?.composite) {
    gaps.push(`Composite route did not expose pack composition; primary archetype is ${context.route.archetype}.`);
  }
  return unique(gaps);
}

function architecturalFindings(results) {
  const findings = [];
  const mixed = results.find((result) => result.id === "mixed-onboarding-flow");
  if (mixed?.observedPackIds.includes("design-system-ui") && mixed.observedPackIds.includes("motion-lottie")) {
    findings.push("Mixed app requests can compose multiple domain packs in the IR and run plan. That is the strongest evidence that workflow assembly is not purely hard-coded by named harness.");
  }
  const genericGap = results.find((result) => result.id === "full-stack-habit-tracker-app");
  if (genericGap?.observedPackIds.includes("app-building-fullstack") && !genericGap.observedPackIds.includes("generic-report")) {
    findings.push("Full-stack app PRDs now resolve the app-building-fullstack pack and emit UI, API, persistence, source-tree, test, acceptance, and deployment-planning artifacts.");
    findings.push("The app-building pack now writes a dependency-free source tree with a Node smoke test, so the evaluator checks a runnable implementation surface instead of only planning contracts.");
  } else if (genericGap?.observedPackIds.includes("generic-report")) {
    findings.push("Full-stack app PRDs still fall back to generic-report. Future-proofing needs an app-building capability pack with UI, API, persistence, test, accessibility, and release artifact contracts.");
    findings.push("The full-stack PRD was under-grounded for app planning; inspect evidence facts, route matching, and app validators before accepting the fallback.");
    if (genericGap.unresolvedBlockerQuestionCount > 0 && genericGap.finalStatus === "partial") {
      findings.push("The critic layer now catches the generic app fallback as unresolved blocker questions and marks the run partial instead of clean success.");
    }
  }
  if (mixed?.route?.composition?.composite) {
    findings.push("Composite workflows now expose scored route composition while retaining a primary archetype for compatibility.");
  }
  if (results.every((result) => result.workerGroups.includes("runtime-planning") && result.workerGroups.includes("council-elders"))) {
    findings.push("Runtime planning, council review, course correction, executor locks, worker locks, function contract IDs, and run plans are present across the sample matrix.");
  }
  if (results.every((result) => result.runtimeControl.initializationStatus === "pass" && result.runtimeControl.featureSchedulerStatus === "pass" && result.runtimeControl.environmentReadinessStatus === "pass" && result.runtimeControl.environmentReadinessFailedCheckCount === 0 && result.runtimeControl.environmentReadinessWarningCheckCount === 0 && result.runtimeControl.environmentReadinessUnavailableSourceCount === 0 && result.runtimeControl.environmentReadinessLockfileCount > 0 && result.runtimeControl.instructionRouterStatus === "pass" && result.runtimeControl.instructionTopicCount > 0 && result.runtimeControl.contextBudgetStatus === "pass" && result.runtimeControl.contextBudgetEstimatedTokenCount <= result.runtimeControl.contextBudgetMaxTokenBudget && result.runtimeControl.contextBudgetIsolationBoundaryCount >= 2 && result.runtimeControl.contextBudgetInvalidationPointCount >= 4 && result.runtimeControl.contextBudgetUnresolvedCount === 0 && result.runtimeControl.sourceOfRecordStatus === "pass" && result.runtimeControl.sourceOfRecordAnsweredQuestionCount === 5 && result.runtimeControl.sourceOfRecordFailedCheckCount === 0 && result.runtimeControl.activeFeatureCount <= 1 && result.runtimeControl.lifecycleStatus === "pass" && result.runtimeControl.lifecyclePhaseCount >= 23 && result.runtimeControl.architectureBoundaryStatus === "pass" && result.runtimeControl.architectureBoundaryViolationCount === 0 && result.runtimeControl.evaluatorRubricStatus === "pass" && result.runtimeControl.evaluatorRubricPassingDimensionCount === 5 && result.runtimeControl.evaluatorRubricFailedDimensionCount === 0 && result.runtimeControl.evaluatorRubricWarningDimensionCount === 0 && result.runtimeControl.completionAuthorityStatus === "pass" && result.runtimeControl.completionAuthorityRoleCount === 4 && result.runtimeControl.completionAuthorityFailedGateCount === 0 && result.runtimeControl.completionAuthorityWarningGateCount === 0 && result.runtimeControl.completionAuthorityUnresolvedCount === 0 && result.runtimeControl.verificationPipelineStatus === "pass" && result.runtimeControl.verifiedCompletionRate === 1 && result.runtimeControl.verificationPipelineUnresolvedCount === 0 && result.runtimeControl.sessionCleanStateStatus === "pass" && result.runtimeControl.sessionCleanStateFailedCheckCount === 0 && result.runtimeControl.sessionCleanStateStaleArtifactCount === 0 && result.runtimeControl.feedbackPromotionStatus === "pass" && result.runtimeControl.feedbackPromotionCandidateCount > 0 && result.runtimeControl.diagnosticStatus === "pass" && result.runtimeControl.repairGuidanceStatus === "pass" && result.runtimeControl.subsystemAuditStatus === "pass" && result.runtimeControl.subsystemAuditCount === 5 && result.runtimeControl.ablationComparisonStatus === "pass" && result.runtimeControl.ablationMeasuredProbeCount === 5 && result.runtimeControl.qualityDocumentStatus === "pass" && result.runtimeControl.qualityDocumentModuleCount === 5 && result.runtimeControl.qualityDocumentHealthyModuleCount === 5 && result.runtimeControl.qualityDocumentBlockedModuleCount === 0 && result.runtimeControl.qualityDocumentUnresolvedCount === 0 && result.runtimeControl.harnessQualityStatus === "pass" && result.runtimeControl.harnessQualityScore >= 90 && result.runtimeControl.harnessQualityFailedCheckCount === 0 && result.runtimeControl.harnessQualityWarningCheckCount === 0 && result.runtimeControl.continuityStatus === "pass" && result.runtimeControl.continuityDecisionCount >= 5 && result.runtimeControl.continuityMissingRestartArtifactCount === 0 && result.runtimeControl.continuityEstimatedRebuildMinutes <= 3 && result.runtimeControl.courseAlignmentStatus === "pass" && result.runtimeControl.courseAlignmentScore >= 90 && result.runtimeControl.courseAlignmentRequirementCount === 12 && result.runtimeControl.courseAlignmentPassingRequirementCount === 12 && result.runtimeControl.courseAlignmentFailedRequirementCount === 0 && result.runtimeControl.courseAlignmentWarningRequirementCount === 0 && result.runtimeControl.courseAlignmentCoveredSubsystemCount === 5 && result.runtimeControl.courseAlignmentUnresolvedCount === 0 && result.runtimeControl.policyStatus === "pass" && result.runtimeControl.approvalStatus === "pass" && result.runtimeControl.budgetStatus === "pass" && result.runtimeControl.workerFunctionCount > 0 && result.runtimeControl.replacementProviderCount > 0 && result.runtimeControl.replacementSlotCount > 0 && result.runtimeControl.replacementUnresolvedCount === 0 && result.runtimeControl.toolSafetyStatus === "pass" && result.runtimeControl.toolSafetyCallCount > 0 && result.runtimeControl.toolSafetyDeniedCallCount === 0 && result.runtimeControl.toolSafetyUnclassifiedCallCount === 0 && result.runtimeControl.providerRouteCount > 0 && result.runtimeControl.runtimeBusStatus === "pass" && result.runtimeControl.runtimeBusSubscriberCount > 0 && result.runtimeControl.invocationLedgerStatus === "pass" && result.runtimeControl.missingInvocationCount === 0 && result.runtimeControl.hookEmissionCount > 0 && result.runtimeControl.traceSpanCount > 0 && result.runtimeControl.startupReadinessStatus !== "fail")) {
    findings.push("Runs now emit an initialization checklist, feature scheduler, environment-readiness ledger, instruction-routing ledger, context-budget ledger, source-of-record ledger, continuity ledger, course-alignment ledger, lifecycle ledger, architecture-boundary ledger, evaluator rubric, completion-authority ledger, verification-pipeline ledger, session clean-state ledger, feedback-promotion ledger, harness diagnostic ledger, repair-guidance ledger, harness subsystem audit, ablation comparison ledger, quality document, harness quality ledger, worker/function registry, provider replacement registry, tool-safety ledger, dispatch plan, runtime bus, invocation ledger, startup readiness, and policy/approval/budget/hook/trace-context artifacts, so runtime control is inspectable, runtime environment assumptions are checked before dispatch, topic instructions are revealed on demand with entry/topic budgets and source/applicability/expiry metadata, context is governed through SELECT/WRITE/COMPRESS/ISOLATE plus explicit invalidation and isolation boundaries, tool/provider calls are fail-closed and concurrency-classified, fresh-session system/run/verify/progress questions are answered from repo artifacts, continuity decisions/restart inputs/next actions/rebuild cost are machine-readable, Learn Harness Engineering requirements are mapped to concrete artifacts and validators, ordered lifecycle phases are explicit, architecture boundaries are executable with repair guidance, completion authority is separated across planner/generator/evaluator roles after an evidence-backed rubric, quality score and quality-document priorities are recorded, verified completion rate must reach 1.0, session exits must have clean-state evidence, review signals become durable improvement candidates, non-passing signals are attributed to harness subsystems, repair actions carry what/why/fix/next-command guidance, five-subsystem bottlenecks are scored, artifact-exclusion ablation probes measure subsystem evidence loss, dispatch routes must have execution evidence, and provider swaps must declare compatibility slots.");
  }
  return findings;
}

function renderReport(payload) {
  const lines = [];
  lines.push("# App-Building Workflow Evaluation");
  lines.push("");
  lines.push(`Generated: ${payload.summary.generatedAt}`);
  lines.push(`Average score: ${payload.summary.averageScore}/100`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Usecase | Status | Score | Packs | Key gap |");
  lines.push("| --- | --- | ---: | --- | --- |");
  for (const result of payload.results) {
    lines.push(
      `| ${escapeCell(result.title)} | ${result.finalStatus} | ${result.score} | ${escapeCell(result.observedPackIds.join(", "))} | ${escapeCell(result.gaps[0] ?? "None")} |`,
    );
  }
  lines.push("");
  lines.push("## Architectural Findings");
  lines.push("");
  for (const finding of payload.summary.architecturalFindings) {
    lines.push(`- ${finding}`);
  }
  lines.push("");
  for (const result of payload.results) {
    lines.push(`## ${result.title}`);
    lines.push("");
    lines.push(`- Usecase id: \`${result.id}\``);
    lines.push(`- Output: \`${result.outputDir}\``);
    lines.push(`- Route: \`${result.route.archetype}\` / \`${result.route.mode}\``);
    lines.push(`- Route reason: ${result.route.reason}`);
    lines.push(`- Selected trace: \`${result.selectedArchetype}\` / \`${result.selectedMode}\``);
    lines.push(`- Observed packs: ${result.observedPackIds.map((pack) => `\`${pack}\``).join(", ")}`);
    lines.push(`- Runtime control: \`initialization=${result.runtimeControl.initializationStatus}, scheduler=${result.runtimeControl.featureSchedulerStatus}/${result.runtimeControl.activeFeatureCount}, environment=${result.runtimeControl.environmentReadinessStatus}/${result.runtimeControl.environmentReadinessFailedCheckCount}/${result.runtimeControl.environmentReadinessWarningCheckCount}/${result.runtimeControl.environmentReadinessLockfileCount}, instructions=${result.runtimeControl.instructionRouterStatus}/${result.runtimeControl.instructionTopicCount}, context=${result.runtimeControl.contextBudgetStatus}/${result.runtimeControl.contextBudgetEstimatedTokenCount}/${result.runtimeControl.contextBudgetMaxTokenBudget}, sourceRecord=${result.runtimeControl.sourceOfRecordStatus}/${result.runtimeControl.sourceOfRecordAnsweredQuestionCount}, lifecycle=${result.runtimeControl.lifecycleStatus}/${result.runtimeControl.lifecyclePhaseCount}, architecture=${result.runtimeControl.architectureBoundaryStatus}/${result.runtimeControl.architectureBoundaryViolationCount}, rubric=${result.runtimeControl.evaluatorRubricStatus}/${result.runtimeControl.evaluatorRubricPassingDimensionCount}/${result.runtimeControl.evaluatorRubricDimensionCount}, authority=${result.runtimeControl.completionAuthorityStatus}/${result.runtimeControl.completionAuthorityGateCount}/${result.runtimeControl.completionAuthorityUnresolvedCount}, vcr=${result.runtimeControl.verificationPipelineStatus}/${result.runtimeControl.verifiedCompletionRate}, clean=${result.runtimeControl.sessionCleanStateStatus}/${result.runtimeControl.sessionCleanStateStaleArtifactCount}, feedback=${result.runtimeControl.feedbackPromotionStatus}/${result.runtimeControl.feedbackPromotionCandidateCount}, diagnostic=${result.runtimeControl.diagnosticStatus}/${result.runtimeControl.diagnosticAttributionCount}, repair=${result.runtimeControl.repairGuidanceStatus}/${result.runtimeControl.repairActionCount}, audit=${result.runtimeControl.subsystemAuditStatus}/${result.runtimeControl.subsystemAuditPrimaryBottleneck}, ablation=${result.runtimeControl.ablationComparisonStatus}/${result.runtimeControl.ablationPrimaryMarginalSubsystem}, qualityDoc=${result.runtimeControl.qualityDocumentStatus}/${result.runtimeControl.qualityDocumentHealthyModuleCount}/${result.runtimeControl.qualityDocumentModuleCount}, quality=${result.runtimeControl.harnessQualityStatus}/${result.runtimeControl.harnessQualityScore}/${result.runtimeControl.harnessQualityGrade}, continuity=${result.runtimeControl.continuityStatus}/${result.runtimeControl.continuityDecisionCount}/${result.runtimeControl.continuityEstimatedRebuildMinutes}, course=${result.runtimeControl.courseAlignmentStatus}/${result.runtimeControl.courseAlignmentScore}/${result.runtimeControl.courseAlignmentPassingRequirementCount}, workers=${result.runtimeControl.workerFunctionCount}, replacements=${result.runtimeControl.replacementSlotCount}/${result.runtimeControl.replacementUnresolvedCount}, routes=${result.runtimeControl.providerRouteCount}, bus=${result.runtimeControl.runtimeBusStatus}/${result.runtimeControl.runtimeBusSubscriberCount}, invocations=${result.runtimeControl.completedInvocationCount}, missingInvocations=${result.runtimeControl.missingInvocationCount}, startup=${result.runtimeControl.startupReadinessStatus}, policy=${result.runtimeControl.policyStatus}, approval=${result.runtimeControl.approvalStatus}, budget=${result.runtimeControl.budgetStatus}, hooks=${result.runtimeControl.hookEmissionCount}, spans=${result.runtimeControl.traceSpanCount}\``);
    lines.push(`- Artifact contracts: ${result.artifactContracts.map((contract) => `\`${contract.id}:${contract.type}\``).join(", ")}`);
    lines.push(`- Critic questions: ${result.criticQuestionCount} total, ${result.unresolvedBlockerQuestionCount} unresolved blocker(s)`);
    lines.push(`- Critic categories: ${result.criticCategories.map((category) => `\`${category}\``).join(", ") || "none"}`);
    lines.push("");
    lines.push("| Check | Weight | Result | Detail |");
    lines.push("| --- | ---: | --- | --- |");
    for (const check of result.checks) {
      lines.push(`| ${escapeCell(check.label)} | ${check.weight} | ${check.pass ? "pass" : "fail"} | ${escapeCell(check.detail)} |`);
    }
    lines.push("");
    lines.push("Gaps:");
    if (result.gaps.length) {
      for (const gap of result.gaps) {
        lines.push(`- ${gap}`);
      }
    } else {
      lines.push("- None.");
    }
    lines.push("");
    lines.push("Graph nodes:");
    lines.push(result.graphNodeIds.map((nodeId) => `\`${nodeId}\``).join(", "));
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function readJson(target) {
  return JSON.parse(await readFile(target, "utf8"));
}

function unique(values) {
  return [...new Set(values)];
}

function sameMembers(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}
