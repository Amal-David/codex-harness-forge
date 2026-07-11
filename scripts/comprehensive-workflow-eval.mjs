import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeComprehensiveWorkflowFixtures } from "./comprehensive-workflow-fixtures.mjs";
import { renderComprehensiveWorkflowReport } from "./comprehensive-workflow-report.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(repoRoot, "output/comprehensive-workflow-eval");
const fixturesRoot = path.join(outputRoot, "fixtures");
const runsRoot = path.join(outputRoot, "runs");
const cliPath = path.join(repoRoot, "dist/cli/harnessctl.js");

process.chdir(repoRoot);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(fixturesRoot, { recursive: true });
await mkdir(runsRoot, { recursive: true });

const fixturePaths = await writeComprehensiveWorkflowFixtures(fixturesRoot);
const usecases = [
  {
    id: "design-system-settings",
    title: "Specialized design-system settings screen",
    mode: "standard",
    intent: "Build a settings app screen using only approved design-system components and tokens.",
    sources: [path.join(repoRoot, "fixtures/design-system")],
    expected: { finalStatus: "success", packs: ["design-system-ui"], minCriticQuestions: 3, unresolvedBlockers: 0 },
  },
  {
    id: "motion-logo-reveal",
    title: "Specialized Lottie logo reveal",
    mode: "deep",
    intent: "Build a premium animated onboarding logo reveal with reusable Lottie controls.",
    sources: [path.join(repoRoot, "fixtures/motion/logo.svg")],
    expected: { finalStatus: "success", packs: ["motion-lottie"], minCriticQuestions: 3, unresolvedBlockers: 0 },
  },
  {
    id: "mixed-ui-motion",
    title: "Composite UI plus motion onboarding",
    mode: "deep",
    intent: "Build a polished onboarding app flow using the design system and a logo reveal animation.",
    sources: [path.join(repoRoot, "fixtures/design-system"), path.join(repoRoot, "fixtures/motion/logo.svg")],
    expected: { finalStatus: "success", packs: ["design-system-ui", "motion-lottie"], compositeRoute: true, minCriticQuestions: 3, unresolvedBlockers: 0 },
  },
  {
    id: "habit-tracker-prd",
    title: "Existing full-stack habit tracker PRD",
    mode: "standard",
    intent: "Build a full-stack habit tracker app with API routes, persistence, schema, tests, accessibility, and deployable architecture.",
    sources: [path.join(repoRoot, "examples/app-building/sources/habit-tracker-prd.md")],
    expected: { finalStatus: "success", packs: ["app-building-fullstack"], appCoverage: true, appPlan: true, unresolvedBlockers: 0 },
  },
  {
    id: "finance-dashboard-prd",
    title: "Finance dashboard with charts and CSV import",
    mode: "standard",
    intent: "Build a finance dashboard app from this PRD with API routes, persistence, CSV import, charts, tests, accessibility, and deployment.",
    sources: [fixturePaths.financePrd],
    expected: { finalStatus: "success", packs: ["app-building-fullstack"], appCoverage: true, appPlan: true, unresolvedBlockers: 0 },
  },
  {
    id: "ecommerce-checkout-prd",
    title: "E-commerce checkout with payments",
    mode: "standard",
    intent: "Build a checkout app from this PRD with cart state, payment API, order persistence, tests, accessibility, and deployment.",
    sources: [fixturePaths.checkoutPrd],
    expected: { finalStatus: "success", packs: ["app-building-fullstack"], appCoverage: true, appPlan: true, unresolvedBlockers: 0 },
  },
  {
    id: "offline-field-notes-prd",
    title: "Offline-first field notes app",
    mode: "deep",
    intent: "Build an offline-first field notes app from this PRD with sync, conflict resolution, local persistence, API, tests, accessibility, and deployment.",
    sources: [fixturePaths.offlinePrd],
    expected: { finalStatus: "success", packs: ["app-building-fullstack"], appCoverage: true, appPlan: true, unresolvedBlockers: 0 },
  },
  {
    id: "api-only-openapi",
    title: "API-only workflow from OpenAPI spec",
    mode: "standard",
    intent: "Build an implementation workflow for this OpenAPI service with route contracts, persistence, integration tests, and deployment gates.",
    sources: [fixturePaths.openapi],
    expected: { finalStatus: "success", packs: ["app-building-fullstack"], appCoverage: true, appPlan: true, unresolvedBlockers: 0 },
  },
  {
    id: "docs-only-runbook",
    title: "Docs-only operational runbook",
    mode: "standard",
    intent: "Create a source-grounded operational runbook and validation plan from this document.",
    sources: [fixturePaths.runbook],
    expected: { finalStatus: "success", packs: ["generic-report"], minCriticQuestions: 3, unresolvedBlockers: 0 },
  },
  {
    id: "vague-app-no-source",
    title: "Vague app request without sources",
    mode: "standard",
    intent: "Build me a social habit app with reminders, streaks, sharing, backend, tests, and deployment. Infer what is missing.",
    sources: [],
    expected: { finalStatus: "partial", packs: ["app-building-fullstack"], appCoverage: true, appPlan: true, sourceWarning: true, shouldNotSuccess: true },
  },
  {
    id: "missing-prd-source",
    title: "Missing PRD source",
    mode: "standard",
    intent: "Build a full-stack app from a PRD that is not actually available.",
    sources: [path.join(fixturesRoot, "missing-prd.md")],
    expected: { finalStatus: "failed", sourceFail: true },
  },
  {
    id: "empty-design-system",
    title: "Design-system request with empty design source",
    mode: "standard",
    intent: "Build a settings page using approved design-system components only.",
    sources: [fixturePaths.emptyDesignSystem],
    expected: { finalStatus: "partial", packs: ["design-system-ui"], validatorWarningOrFail: true },
  },
  {
    id: "conflicting-product-prds",
    title: "Conflicting product PRDs",
    mode: "standard",
    intent: "Build a product workflow from these conflicting PRDs. Detect conflicts before implementation readiness claims.",
    sources: [fixturePaths.conflictA, fixturePaths.conflictB],
    expected: { packs: ["app-building-fullstack"], appCoverage: true, appPlan: true, conflictExpected: true },
  },
  {
    id: "security-sensitive-auth-prd",
    title: "Security-sensitive auth and billing PRD",
    mode: "deep",
    intent: "Build a SaaS admin app from this PRD with authentication, roles, billing, audit logs, tests, security review, accessibility, and deployment.",
    sources: [fixturePaths.securityPrd],
    expected: { finalStatus: "success", packs: ["app-building-fullstack"], appCoverage: true, appPlan: true, unresolvedBlockers: 0, securityCoverageExpected: true },
  },
  {
    id: "repo-source-meta-harness",
    title: "Repo-source workflow over meta-harness src",
    mode: "standard",
    intent: "Analyze this codebase and create a workflow to improve runtime architecture, tests, validators, and artifact contracts.",
    sources: [path.join(repoRoot, "src")],
    expected: { finalStatus: "success", minCriticQuestions: 3, unresolvedBlockers: 0 },
  },
];

const results = [];
for (const usecase of usecases) {
  results.push(await runUsecase(usecase));
}

const analysis = analyzeResults(results);
const payload = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  outputRoot,
  usecaseCount: usecases.length,
  summary: analysis.summary,
  systemicFindings: analysis.systemicFindings,
  results,
};

await writeFile(path.join(outputRoot, "comprehensive-results.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(path.join(outputRoot, "comprehensive-report.md"), renderComprehensiveWorkflowReport(payload), "utf8");

console.log(`Wrote ${path.join(outputRoot, "comprehensive-report.md")}`);
console.log(JSON.stringify(analysis.summary, null, 2));
if (analysis.summary.failedChecks > 0) {
  process.exitCode = 1;
}

function runCommand(args, options = {}) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 80,
    ...options,
  });
}

async function runUsecase(usecase) {
  const outputDir = path.join(runsRoot, usecase.id);
  const args = [cliPath, "workflows", "start", usecase.mode];
  for (const source of usecase.sources) {
    args.push("--source", source);
  }
  args.push("--intent", usecase.intent, "--output", outputDir);
  const startedAt = new Date().toISOString();
  const proc = runCommand(args);
  const completedAt = new Date().toISOString();
  const runState = await readJsonIfExists(path.join(outputDir, "run-state.json"));
  const trace = await readJsonIfExists(path.join(outputDir, "harness-trace.json"));
  const council = await readJsonIfExists(path.join(outputDir, "council-review.json"));
  const workerLock = await readJsonIfExists(path.join(outputDir, "worker-lock.json"));
  const executorLock = await readJsonIfExists(path.join(outputDir, "executor-lock.json"));
  const runPlan = await readJsonIfExists(path.join(outputDir, "run-plan.json"));
  const workerFunctionRegistry = await readJsonIfExists(path.join(outputDir, "worker-function-registry.json"));
  const providerReplacementRegistry = await readJsonIfExists(path.join(outputDir, "provider-replacement-registry.json"));
  const toolSafetyLedger = await readJsonIfExists(path.join(outputDir, "tool-safety-ledger.json"));
  const contextBudgetLedger = await readJsonIfExists(path.join(outputDir, "context-budget-ledger.json"));
  const initializationChecklist = await readJsonIfExists(path.join(outputDir, "initialization-checklist.json"));
  const featureScheduler = await readJsonIfExists(path.join(outputDir, "feature-scheduler.json"));
  const environmentReadinessLedger = await readJsonIfExists(path.join(outputDir, "environment-readiness-ledger.json"));
  const instructionRoutingLedger = await readJsonIfExists(path.join(outputDir, "instruction-routing-ledger.json"));
  const sourceOfRecordLedger = await readJsonIfExists(path.join(outputDir, "source-of-record-ledger.json"));
  const lifecycleLedger = await readJsonIfExists(path.join(outputDir, "lifecycle-ledger.json"));
  const architectureBoundaryLedger = await readJsonIfExists(path.join(outputDir, "architecture-boundary-ledger.json"));
  const evaluatorRubric = await readJsonIfExists(path.join(outputDir, "evaluator-rubric.json"));
  const completionAuthorityLedger = await readJsonIfExists(path.join(outputDir, "completion-authority-ledger.json"));
  const verificationPipelineLedger = await readJsonIfExists(path.join(outputDir, "verification-pipeline-ledger.json"));
  const sessionCleanStateLedger = await readJsonIfExists(path.join(outputDir, "session-clean-state-ledger.json"));
  const feedbackPromotionLedger = await readJsonIfExists(path.join(outputDir, "feedback-promotion-ledger.json"));
  const harnessDiagnosticLedger = await readJsonIfExists(path.join(outputDir, "harness-diagnostic-ledger.json"));
  const repairGuidanceLedger = await readJsonIfExists(path.join(outputDir, "repair-guidance-ledger.json"));
  const harnessSubsystemAudit = await readJsonIfExists(path.join(outputDir, "harness-subsystem-audit.json"));
  const harnessAblationComparison = await readJsonIfExists(path.join(outputDir, "harness-ablation-comparison.json"));
  const qualityDocument = await readJsonIfExists(path.join(outputDir, "quality-document.json"));
  const harnessQualityLedger = await readJsonIfExists(path.join(outputDir, "harness-quality-ledger.json"));
  const continuityLedger = await readJsonIfExists(path.join(outputDir, "continuity-ledger.json"));
  const courseAlignmentLedger = await readJsonIfExists(path.join(outputDir, "course-alignment-ledger.json"));
  const policyGate = await readJsonIfExists(path.join(outputDir, "policy-gate.json"));
  const budgetGate = await readJsonIfExists(path.join(outputDir, "budget-gate.json"));
  const approvalGate = await readJsonIfExists(path.join(outputDir, "approval-gate.json"));
  const hookLedger = await readJsonIfExists(path.join(outputDir, "hook-ledger.json"));
  const runtimeBus = await readJsonIfExists(path.join(outputDir, "runtime-bus.json"));
  const traceContext = await readJsonIfExists(path.join(outputDir, "trace-context.json"));
  const dispatchPlan = await readJsonIfExists(path.join(outputDir, "function-dispatch-plan.json"));
  const invocationLedger = await readJsonIfExists(path.join(outputDir, "function-invocation-ledger.json"));
  const nodeExecutionLedger = await readJsonIfExists(path.join(outputDir, "node-execution-ledger.json"));
  const startupReadiness = await readJsonIfExists(path.join(outputDir, "startup-readiness.json"));
  const harnessSpec = await readJsonIfExists(path.join(outputDir, "harness-spec.json"));
  const harnessIr = await readJsonIfExists(path.join(outputDir, "harness-ir.json"));
  const agentRunsDir = path.join(outputDir, "agent-runs");
  const agentRunFiles = await listFilesIfExists(agentRunsDir);
  const validationStatuses = Object.fromEntries((runState?.validations ?? trace?.validations ?? []).map((validation) => [validation.id, validation.status]));
  const artifactContracts = harnessSpec?.artifactContracts ?? [];
  const observedPacks = unique([
    ...(workerLock?.workers ?? []).map((worker) => worker.packId),
    ...(executorLock?.executors ?? []).map((executor) => executor.packId),
  ]);
  const criticQuestions = council?.criticQuestions ?? [];
  const unresolvedBlockers = council?.unresolvedBlockerQuestions ?? [];
  const criticCategories = unique(criticQuestions.map((question) => question.category));
  const councilAgentIds = ["council-gstack-critic", "council-gbrain-memory", "council-verifier"];
  const councilAgentArtifacts = Object.fromEntries(
    councilAgentIds.map((agentId) => [
      agentId,
      {
        json: agentRunFiles.some((file) => file.endsWith(`__${agentId}.json`)),
        markdown: agentRunFiles.some((file) => file.endsWith(`__${agentId}.md`)),
      },
    ]),
  );
  const codexHostCriticArtifactsPresent = agentRunFiles.includes("codex-host-critic-request.json") && agentRunFiles.includes("codex-host-critic-request.md");
  const checks = checksFor(usecase, {
    proc,
    runState,
    trace,
    council,
    workerLock,
    executorLock,
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
    harnessSpec,
    harnessIr,
    artifactContracts,
    validationStatuses,
    observedPacks,
    criticQuestions,
    unresolvedBlockers,
    criticCategories,
    councilAgentArtifacts,
    agentRunFiles,
    codexHostCriticArtifactsPresent,
  });
  return {
    id: usecase.id,
    title: usecase.title,
    mode: usecase.mode,
    intent: usecase.intent,
    sources: usecase.sources,
    outputDir,
    startedAt,
    completedAt,
    exitCode: proc.status,
    stdoutBytes: Buffer.byteLength(proc.stdout ?? "", "utf8"),
    stderr: (proc.stderr ?? "").trim(),
    finalStatus: runState?.finalStatus ?? trace?.finalStatus ?? "missing",
    selectedArchetype: trace?.selectedArchetype ?? null,
    selectedMode: trace?.selectedMode ?? null,
    routeComposition: trace?.routeComposition ?? null,
    observedPacks,
    validationStatuses,
    artifactContracts: artifactContracts.map((contract) => `${contract.id}:${contract.type}`),
    criticQuestionCount: criticQuestions.length,
    unresolvedBlockerQuestionCount: unresolvedBlockers.length,
    criticCategories,
    firstFiveBlockers: unresolvedBlockers.slice(0, 5).map((question) => ({
      criticId: question.criticId,
      category: question.category,
      question: question.question,
    })),
    councilVerdict: council?.verdict ?? null,
    councilCourseCorrectionCount: council?.courseCorrections?.length ?? 0,
    sourceConflictCount: trace?.sourceConflicts?.length ?? 0,
    evidenceFactKinds: unique((trace?.sourcesLoaded ?? []).map((source) => source.type)),
    graphNodeCount: runPlan?.nodeCount ?? 0,
    runtimeControl: {
      workerFunctionCount: workerFunctionRegistry?.workerFunctions?.length ?? 0,
      executorFunctionCount: workerFunctionRegistry?.executorFunctions?.length ?? 0,
      replacementProviderCount: providerReplacementRegistry?.summary?.providerCount ?? 0,
      replacementSlotCount: providerReplacementRegistry?.summary?.replacementSlotCount ?? 0,
      replacementUnresolvedCount: providerReplacementRegistry?.summary?.unresolvedCount ?? -1,
      toolSafetyStatus: toolSafetyLedger?.status ?? "missing",
      toolSafetyCallCount: toolSafetyLedger?.summary?.callCount ?? 0,
      toolSafetyConcurrentSafeCallCount: toolSafetyLedger?.summary?.concurrentSafeCallCount ?? 0,
      toolSafetySerialCallCount: toolSafetyLedger?.summary?.serialCallCount ?? 0,
      toolSafetyDeniedCallCount: toolSafetyLedger?.summary?.deniedCallCount ?? -1,
      toolSafetyUnclassifiedCallCount: toolSafetyLedger?.summary?.unclassifiedCallCount ?? -1,
      contextBudgetStatus: contextBudgetLedger?.status ?? "missing",
      contextBudgetEstimatedTokenCount: contextBudgetLedger?.summary?.estimatedTokenCount ?? 0,
      contextBudgetMaxTokenBudget: contextBudgetLedger?.summary?.maxTokenBudget ?? 0,
      contextBudgetUsageRatio: contextBudgetLedger?.summary?.usageRatio ?? 0,
      contextBudgetIsolationBoundaryCount: contextBudgetLedger?.summary?.isolationBoundaryCount ?? 0,
      contextBudgetInvalidationPointCount: contextBudgetLedger?.summary?.invalidationPointCount ?? 0,
      contextBudgetUnresolvedCount: contextBudgetLedger?.summary?.unresolvedCount ?? -1,
      initializationStatus: initializationChecklist?.status ?? "missing",
      featureSchedulerStatus: featureScheduler?.status ?? "missing",
      environmentReadinessStatus: environmentReadinessLedger?.status ?? "missing",
      environmentReadinessFailedCheckCount: environmentReadinessLedger?.summary?.failedCheckCount ?? -1,
      environmentReadinessWarningCheckCount: environmentReadinessLedger?.summary?.warningCheckCount ?? -1,
      environmentReadinessUnavailableSourceCount: environmentReadinessLedger?.summary?.unavailableSourceCount ?? -1,
      environmentReadinessLockfileCount: environmentReadinessLedger?.summary?.lockfileCount ?? 0,
      instructionRouterStatus: instructionRoutingLedger?.status ?? "missing",
      instructionTopicCount: instructionRoutingLedger?.selectedTopics?.length ?? 0,
      instructionHeldBackTopicCount: instructionRoutingLedger?.heldBackTopics?.length ?? 0,
      instructionBudgetStatus: instructionRoutingLedger?.instructionBudget?.status ?? "missing",
      instructionEntryEstimatedLineCount: instructionRoutingLedger?.instructionBudget?.entryEstimatedLineCount ?? 0,
      instructionRevealRatio: instructionRoutingLedger?.instructionBudget?.revealRatio ?? 0,
      sourceOfRecordStatus: sourceOfRecordLedger?.status ?? "missing",
      sourceOfRecordAnsweredQuestionCount: sourceOfRecordLedger?.summary?.answeredQuestionCount ?? 0,
      sourceOfRecordFailedCheckCount: sourceOfRecordLedger?.summary?.failedCheckCount ?? -1,
      activeFeatureCount: featureScheduler?.activeFeatureIds?.length ?? 0,
      completionPressure: featureScheduler?.summary?.completionPressure ?? 0,
      lifecycleStatus: lifecycleLedger?.status ?? "missing",
      lifecyclePhaseCount: lifecycleLedger?.phases?.length ?? 0,
      architectureBoundaryStatus: architectureBoundaryLedger?.status ?? "missing",
      architectureBoundaryRuleCount: architectureBoundaryLedger?.summary?.ruleCount ?? 0,
      architectureBoundaryViolationCount: architectureBoundaryLedger?.summary?.violationCount ?? -1,
      evaluatorRubricStatus: evaluatorRubric?.status ?? "missing",
      evaluatorRubricDimensionCount: evaluatorRubric?.summary?.dimensionCount ?? 0,
      evaluatorRubricPassingDimensionCount: evaluatorRubric?.summary?.passingDimensionCount ?? 0,
      evaluatorRubricFailedDimensionCount: evaluatorRubric?.summary?.failedDimensionCount ?? -1,
      evaluatorRubricWarningDimensionCount: evaluatorRubric?.summary?.warningDimensionCount ?? -1,
      evaluatorRubricLowestScore: evaluatorRubric?.summary?.lowestScore ?? 0,
      completionAuthorityStatus: completionAuthorityLedger?.status ?? "missing",
      completionAuthorityRoleCount: completionAuthorityLedger?.summary?.roleCount ?? 0,
      completionAuthorityGateCount: completionAuthorityLedger?.summary?.authorityGateCount ?? 0,
      completionAuthorityFailedGateCount: completionAuthorityLedger?.summary?.failedAuthorityGateCount ?? -1,
      completionAuthorityWarningGateCount: completionAuthorityLedger?.summary?.warningAuthorityGateCount ?? -1,
      completionAuthorityUnresolvedCount: completionAuthorityLedger?.summary?.unresolvedCount ?? -1,
      verificationPipelineStatus: verificationPipelineLedger?.status ?? "missing",
      verifiedCompletionRate: verificationPipelineLedger?.summary?.verifiedCompletionRate ?? 0,
      verifiedCompletionRequiredFeatureCount: verificationPipelineLedger?.summary?.requiredFeatureCount ?? 0,
      verificationPipelineUnresolvedCount: verificationPipelineLedger?.summary?.unresolvedCount ?? -1,
      sessionCleanStateStatus: sessionCleanStateLedger?.status ?? "missing",
      sessionCleanStatePassedCheckCount: sessionCleanStateLedger?.summary?.passedCheckCount ?? 0,
      sessionCleanStateFailedCheckCount: sessionCleanStateLedger?.summary?.failedCheckCount ?? -1,
      sessionCleanStateStaleArtifactCount: sessionCleanStateLedger?.summary?.staleArtifactCount ?? -1,
      feedbackPromotionStatus: feedbackPromotionLedger?.status ?? "missing",
      feedbackPromotionCandidateCount: feedbackPromotionLedger?.sourceSummary?.promotionCandidateCount ?? 0,
      diagnosticStatus: harnessDiagnosticLedger?.status ?? "missing",
      diagnosticAttributionCount: harnessDiagnosticLedger?.sourceSummary?.attributionCount ?? 0,
      repairGuidanceStatus: repairGuidanceLedger?.status ?? "missing",
      repairActionCount: repairGuidanceLedger?.sourceSummary?.repairActionCount ?? 0,
      repairSignalCount: repairGuidanceLedger?.sourceSummary?.repairSignalCount ?? 0,
      subsystemAuditStatus: harnessSubsystemAudit?.status ?? "missing",
      subsystemAuditCount: harnessSubsystemAudit?.subsystems?.length ?? 0,
      subsystemAuditAverageScore: harnessSubsystemAudit?.summary?.averageScore ?? 0,
      subsystemAuditPrimaryBottleneck: harnessSubsystemAudit?.summary?.primaryBottleneck ?? "none",
      ablationComparisonStatus: harnessAblationComparison?.status ?? "missing",
      ablationMeasuredProbeCount: harnessAblationComparison?.summary?.measuredProbeCount ?? 0,
      ablationPrimaryMarginalSubsystem: harnessAblationComparison?.summary?.primaryMarginalSubsystem ?? "none",
      ablationUnresolvedCount: harnessAblationComparison?.unresolved?.length ?? -1,
      qualityDocumentStatus: qualityDocument?.status ?? "missing",
      qualityDocumentGrade: qualityDocument?.grade ?? "missing",
      qualityDocumentModuleCount: qualityDocument?.summary?.moduleCount ?? 0,
      qualityDocumentHealthyModuleCount: qualityDocument?.summary?.healthyModuleCount ?? 0,
      qualityDocumentBlockedModuleCount: qualityDocument?.summary?.blockedModuleCount ?? -1,
      qualityDocumentUnresolvedCount: qualityDocument?.summary?.unresolvedCount ?? -1,
      harnessQualityStatus: harnessQualityLedger?.status ?? "missing",
      harnessQualityScore: harnessQualityLedger?.score ?? 0,
      harnessQualityGrade: harnessQualityLedger?.grade ?? "missing",
      harnessQualityWarningCheckCount: harnessQualityLedger?.summary?.warningCheckCount ?? -1,
      harnessQualityFailedCheckCount: harnessQualityLedger?.summary?.failedCheckCount ?? -1,
      harnessQualityPriorityCount: harnessQualityLedger?.priorities?.length ?? 0,
      continuityStatus: continuityLedger?.status ?? "missing",
      continuityDecisionCount: continuityLedger?.summary?.decisionCount ?? 0,
      continuityMissingRestartArtifactCount: continuityLedger?.summary?.missingRestartArtifactCount ?? -1,
      continuityNextActionCount: continuityLedger?.summary?.nextActionCount ?? 0,
      continuityEstimatedRebuildMinutes: continuityLedger?.summary?.estimatedRebuildMinutes ?? 99,
      continuityRebuildCostStatus: continuityLedger?.summary?.rebuildCostStatus ?? "missing",
      courseAlignmentStatus: courseAlignmentLedger?.status ?? "missing",
      courseAlignmentScore: courseAlignmentLedger?.score ?? 0,
      courseAlignmentRequirementCount: courseAlignmentLedger?.summary?.requirementCount ?? 0,
      courseAlignmentPassingRequirementCount: courseAlignmentLedger?.summary?.passingRequirementCount ?? 0,
      courseAlignmentFailedRequirementCount: courseAlignmentLedger?.summary?.failedRequirementCount ?? -1,
      courseAlignmentWarningRequirementCount: courseAlignmentLedger?.summary?.warningRequirementCount ?? -1,
      courseAlignmentCoveredSubsystemCount: courseAlignmentLedger?.summary?.coveredSubsystemCount ?? 0,
      courseAlignmentUnresolvedCount: courseAlignmentLedger?.summary?.unresolvedCount ?? -1,
      policyStatus: policyGate?.status ?? "missing",
      approvalStatus: approvalGate?.status ?? "missing",
      budgetStatus: budgetGate?.status ?? "missing",
      hookEmissionCount: hookLedger?.emissions?.length ?? 0,
      runtimeBusStatus: runtimeBus?.status ?? "missing",
      runtimeBusTopicCount: runtimeBus?.topics?.length ?? 0,
      runtimeBusSubscriberCount: runtimeBus?.subscribers?.length ?? 0,
      traceSpanCount: traceContext?.spans?.length ?? 0,
      providerRouteCount: dispatchPlan?.providerRoutes?.length ?? 0,
      completedInvocationCount: invocationLedger?.summary?.completedInvocationCount ?? 0,
      missingInvocationCount: invocationLedger?.summary?.missingInvocationCount ?? 0,
      invocationLedgerStatus: invocationLedger?.status ?? "missing",
      nodeExecutionStatus: nodeExecutionLedger?.status ?? "missing",
      completedNodeCount: nodeExecutionLedger?.summary?.completedNodeCount ?? 0,
      missingNodeCount: nodeExecutionLedger?.summary?.missingNodeCount ?? -1,
      dependencyViolationCount: nodeExecutionLedger?.summary?.dependencyViolationCount ?? -1,
      startupReadinessStatus: startupReadiness?.status ?? "missing",
    },
    agentRunFiles,
    councilAgentArtifacts,
    codexHostCriticArtifactsPresent,
    checks,
    failedChecks: checks.filter((check) => !check.pass),
  };
}

function checksFor(usecase, context) {
  const checks = [];
  const expected = usecase.expected ?? {};
  const startupExpected = expected.sourceFail ? "fail" : "not-fail";
  add(checks, "run-state-present", "Run state was written", Boolean(context.runState), "run-state.json missing");
  add(checks, "trace-present", "Harness trace was written", Boolean(context.trace), "harness-trace.json missing");
  if (expected.finalStatus) {
    add(
      checks,
      "final-status",
      `Final status is ${expected.finalStatus}`,
      (context.runState?.finalStatus ?? context.trace?.finalStatus) === expected.finalStatus,
      `observed ${context.runState?.finalStatus ?? context.trace?.finalStatus ?? "missing"}`,
    );
  }
  if (expected.shouldNotSuccess) {
    add(
      checks,
      "no-false-success",
      "App/gap workflow did not report success",
      (context.runState?.finalStatus ?? context.trace?.finalStatus) !== "success",
      "run reported success despite expected blockers",
    );
  }
  for (const pack of expected.packs ?? []) {
    add(checks, `pack-${pack}`, `Expected pack ${pack} resolved`, context.observedPacks.includes(pack), `observed ${context.observedPacks.join(", ") || "none"}`);
  }
  add(checks, "worker-lock", "Worker lock exists", Boolean(context.workerLock?.workers?.length), "worker-lock missing or empty");
  add(checks, "executor-lock", "Executor lock exists", Boolean(context.executorLock?.executors?.length), "executor-lock missing or empty");
  add(checks, "run-plan", "Run plan exists", Boolean(context.runPlan?.nodeCount), "run-plan missing or empty");
  const routePackIds = context.trace?.routeComposition?.matchedPacks?.map((pack) => pack.packId) ?? [];
  const selectedPackIds = context.harnessSpec?.selectedCapabilityPackIds ?? [];
  add(
    checks,
    "route-compiler-agreement",
    "Trace routing metadata matches the compiler-selected capability packs",
    sameMembers(routePackIds, selectedPackIds) && sameMembers(context.harnessIr?.selectedCapabilityPackIds ?? [], selectedPackIds),
    `trace=${routePackIds.join(", ") || "none"}, spec=${selectedPackIds.join(", ") || "none"}, ir=${context.harnessIr?.selectedCapabilityPackIds?.join(", ") || "none"}`,
  );
  add(
    checks,
    "node-execution-integrity",
    "Every required graph node has dependency-ordered execution evidence",
    context.nodeExecutionLedger?.status === "pass" &&
      context.validationStatuses.node_execution_integrity === "pass" &&
      (context.nodeExecutionLedger?.summary?.missingNodeCount ?? -1) === 0 &&
      (context.nodeExecutionLedger?.summary?.dependencyViolationCount ?? -1) === 0 &&
      (context.invocationLedger?.summary?.missingInvocationCount ?? -1) === 0 &&
      (context.trace?.agentsSpawned ?? []).every((agent) => agent.status !== "planned_not_executed"),
    `nodeExecution=${context.nodeExecutionLedger?.status ?? "missing"}, completed=${context.nodeExecutionLedger?.summary?.completedNodeCount ?? 0}, missing=${context.nodeExecutionLedger?.summary?.missingNodeCount ?? "missing"}, dependencyViolations=${context.nodeExecutionLedger?.summary?.dependencyViolationCount ?? "missing"}, missingInvocations=${context.invocationLedger?.summary?.missingInvocationCount ?? "missing"}`,
  );
  add(
    checks,
    "worker-function-registry",
    "Worker/function registry exists and covers locked workers",
    Boolean(context.workerFunctionRegistry?.workerFunctions?.length) && (context.workerFunctionRegistry?.workerFunctions?.length ?? 0) === (context.workerLock?.workers?.length ?? -1),
    `${context.workerFunctionRegistry?.workerFunctions?.length ?? 0} registered worker function(s), ${context.workerLock?.workers?.length ?? 0} locked worker(s)`,
  );
  add(
    checks,
    "provider-replacement-registry",
    "Provider replacement registry exists and resolves compatibility slots",
    context.providerReplacementRegistry?.status === "pass" &&
      context.validationStatuses.provider_replacement_registry_ready === "pass" &&
      (context.providerReplacementRegistry?.summary?.providerCount ?? 0) >= (context.workerLock?.workers?.length ?? 0) + (context.executorLock?.executors?.length ?? 0) &&
      (context.providerReplacementRegistry?.summary?.replacementSlotCount ?? 0) > 0 &&
      (context.providerReplacementRegistry?.summary?.unresolvedCount ?? -1) === 0,
    `replacement=${context.providerReplacementRegistry?.status ?? "missing"}, validation=${context.validationStatuses.provider_replacement_registry_ready ?? "missing"}, providers=${context.providerReplacementRegistry?.summary?.providerCount ?? 0}, slots=${context.providerReplacementRegistry?.summary?.replacementSlotCount ?? 0}, unresolved=${context.providerReplacementRegistry?.summary?.unresolvedCount ?? "missing"}`,
  );
  add(
    checks,
    "initialization-checklist",
    "Initialization checklist exists and proves fresh-session start/test/progress readiness",
    context.initializationChecklist?.status === "pass" && context.validationStatuses.initialization_checklist_confirmed === "pass",
    `initialization=${context.initializationChecklist?.status ?? "missing"}, validation=${context.validationStatuses.initialization_checklist_confirmed ?? "missing"}`,
  );
  add(
    checks,
    "feature-scheduler",
    "Feature scheduler exists and enforces WIP=1 activation",
    context.featureScheduler?.status === "pass" &&
      context.validationStatuses.feature_scheduler_ready === "pass" &&
      (context.featureScheduler?.activeFeatureIds?.length ?? -1) <= 1 &&
      Boolean(context.featureScheduler?.queue?.length),
    `scheduler=${context.featureScheduler?.status ?? "missing"}, validation=${context.validationStatuses.feature_scheduler_ready ?? "missing"}, active=${context.featureScheduler?.activeFeatureIds?.length ?? "missing"}, pressure=${context.featureScheduler?.summary?.completionPressure ?? "missing"}`,
  );
  const observedFinalStatus = context.runState?.finalStatus ?? context.trace?.finalStatus ?? "missing";
  const environmentReadinessStatus = context.environmentReadinessLedger?.status ?? "missing";
  const environmentReadinessValidationStatus = context.validationStatuses.environment_readiness_confirmed ?? "missing";
  add(
    checks,
    "environment-readiness-ledger",
    "Environment readiness ledger proves dependency, source, command, and output isolation assumptions",
    Boolean(context.environmentReadinessLedger) &&
      (observedFinalStatus === "success"
        ? environmentReadinessStatus === "pass" &&
          environmentReadinessValidationStatus === "pass" &&
          (context.environmentReadinessLedger?.summary?.failedCheckCount ?? -1) === 0 &&
          (context.environmentReadinessLedger?.summary?.warningCheckCount ?? -1) === 0 &&
          (context.environmentReadinessLedger?.summary?.unavailableSourceCount ?? -1) === 0 &&
          (context.environmentReadinessLedger?.summary?.lockfileCount ?? 0) > 0
        : expected.sourceFail
          ? environmentReadinessStatus === "fail" && environmentReadinessValidationStatus === "fail" && (context.environmentReadinessLedger?.summary?.unavailableSourceCount ?? 0) > 0
          : expected.sourceWarning
            ? environmentReadinessStatus === "warning" && environmentReadinessValidationStatus === "warning" && (context.environmentReadinessLedger?.summary?.failedCheckCount ?? -1) === 0
            : environmentReadinessStatus !== "missing" && environmentReadinessValidationStatus !== "missing" && environmentReadinessStatus !== "fail"),
    `environment=${environmentReadinessStatus}, validation=${environmentReadinessValidationStatus}, failed=${context.environmentReadinessLedger?.summary?.failedCheckCount ?? "missing"}, warnings=${context.environmentReadinessLedger?.summary?.warningCheckCount ?? "missing"}, unavailable=${context.environmentReadinessLedger?.summary?.unavailableSourceCount ?? "missing"}, lockfiles=${context.environmentReadinessLedger?.summary?.lockfileCount ?? "missing"}, finalStatus=${observedFinalStatus}`,
  );
  add(
    checks,
    "instruction-routing",
    "Instruction router keeps entry guidance compact and selects applicable topics",
    context.instructionRoutingLedger?.status === "pass" &&
      context.validationStatuses.instruction_router_resolved === "pass" &&
      (context.instructionRoutingLedger?.selectedTopics?.length ?? 0) > 0 &&
      context.instructionRoutingLedger?.instructionBudget?.status === "pass" &&
      (context.instructionRoutingLedger?.instructionBudget?.checks ?? []).every((check) => check.status === "pass") &&
      (context.instructionRoutingLedger?.topicAudit ?? []).every((topic) => topic.budgetStatus === "pass" && topic.metadataStatus === "pass") &&
      (context.instructionRoutingLedger?.unresolved?.length ?? -1) === 0,
    `instructions=${context.instructionRoutingLedger?.status ?? "missing"}, validation=${context.validationStatuses.instruction_router_resolved ?? "missing"}, topics=${context.instructionRoutingLedger?.selectedTopics?.length ?? 0}, heldBack=${context.instructionRoutingLedger?.heldBackTopics?.length ?? 0}, budget=${context.instructionRoutingLedger?.instructionBudget?.status ?? "missing"}, unresolved=${context.instructionRoutingLedger?.unresolved?.length ?? "missing"}`,
  );
  const sourceOfRecordStatus = context.sourceOfRecordLedger?.status ?? "missing";
  const sourceOfRecordValidationStatus = context.validationStatuses.source_of_record_confirmed ?? "missing";
  add(
    checks,
    "source-of-record-ledger",
    "Source-of-record ledger answers fresh-session questions and records source authority",
    Boolean(context.sourceOfRecordLedger) &&
      (observedFinalStatus === "success"
        ? sourceOfRecordStatus === "pass" && sourceOfRecordValidationStatus === "pass" && (context.sourceOfRecordLedger?.summary?.answeredQuestionCount ?? 0) === 5 && (context.sourceOfRecordLedger?.summary?.failedCheckCount ?? -1) === 0
        : expected.sourceFail
          ? sourceOfRecordStatus === "fail" && sourceOfRecordValidationStatus === "fail"
          : sourceOfRecordStatus !== "missing" && sourceOfRecordValidationStatus !== "missing" && sourceOfRecordStatus !== "fail"),
    `sourceRecord=${sourceOfRecordStatus}, validation=${sourceOfRecordValidationStatus}, answered=${context.sourceOfRecordLedger?.summary?.answeredQuestionCount ?? "missing"}, failedChecks=${context.sourceOfRecordLedger?.summary?.failedCheckCount ?? "missing"}, finalStatus=${observedFinalStatus}`,
  );
  add(
    checks,
    "lifecycle-ledger",
    "Lifecycle ledger exists and proves ordered clean-exit phases",
    Boolean(context.lifecycleLedger) &&
      (expected.sourceFail ? context.lifecycleLedger.status === "fail" : context.lifecycleLedger.status !== "fail") &&
      (expected.sourceFail ? context.validationStatuses.lifecycle_ledger_clean === "fail" : context.validationStatuses.lifecycle_ledger_clean !== "fail") &&
      (context.lifecycleLedger?.phases?.length ?? 0) >= 23 &&
      (context.lifecycleLedger?.cleanExit?.missingArtifacts?.length ?? -1) === 0,
    `lifecycle=${context.lifecycleLedger?.status ?? "missing"}, validation=${context.validationStatuses.lifecycle_ledger_clean ?? "missing"}, phases=${context.lifecycleLedger?.phases?.length ?? 0}, missing=${context.lifecycleLedger?.cleanExit?.missingArtifacts?.length ?? "missing"}`,
  );
  const architectureBoundaryStatus = context.architectureBoundaryLedger?.status ?? "missing";
  const architectureBoundaryValidationStatus = context.validationStatuses.architecture_boundary_rules_enforced ?? "missing";
  add(
    checks,
    "architecture-boundary-ledger",
    "Architecture boundary ledger records executable rules and repair-oriented violations",
    Boolean(context.architectureBoundaryLedger) &&
      (observedFinalStatus === "success"
        ? architectureBoundaryStatus === "pass" && architectureBoundaryValidationStatus === "pass" && (context.architectureBoundaryLedger?.summary?.violationCount ?? -1) === 0
        : architectureBoundaryStatus !== "missing" && architectureBoundaryValidationStatus !== "missing"),
    `architecture=${architectureBoundaryStatus}, validation=${architectureBoundaryValidationStatus}, rules=${context.architectureBoundaryLedger?.summary?.ruleCount ?? "missing"}, violations=${context.architectureBoundaryLedger?.summary?.violationCount ?? "missing"}, finalStatus=${observedFinalStatus}`,
  );
  const evaluatorRubricStatus = context.evaluatorRubric?.status ?? "missing";
  const evaluatorRubricValidationStatus = context.validationStatuses.evaluator_rubric_recorded ?? "missing";
  add(
    checks,
    "evaluator-rubric",
    "Evaluator rubric records evidence-backed acceptance dimensions before completion authority",
    Boolean(context.evaluatorRubric) &&
      (observedFinalStatus === "success"
        ? evaluatorRubricStatus === "pass" &&
          evaluatorRubricValidationStatus === "pass" &&
          (context.evaluatorRubric?.summary?.dimensionCount ?? 0) === 5 &&
          (context.evaluatorRubric?.summary?.passingDimensionCount ?? 0) === 5 &&
          (context.evaluatorRubric?.summary?.failedDimensionCount ?? -1) === 0 &&
          (context.evaluatorRubric?.summary?.warningDimensionCount ?? -1) === 0 &&
          (context.evaluatorRubric?.summary?.lowestScore ?? 0) >= 4
        : observedFinalStatus === "failed"
          ? evaluatorRubricStatus === "fail" && evaluatorRubricValidationStatus === "fail"
          : evaluatorRubricStatus !== "missing" && evaluatorRubricValidationStatus !== "missing" && evaluatorRubricStatus !== "fail"),
    `rubric=${evaluatorRubricStatus}, validation=${evaluatorRubricValidationStatus}, dimensions=${context.evaluatorRubric?.summary?.dimensionCount ?? "missing"}, passing=${context.evaluatorRubric?.summary?.passingDimensionCount ?? "missing"}, failed=${context.evaluatorRubric?.summary?.failedDimensionCount ?? "missing"}, warning=${context.evaluatorRubric?.summary?.warningDimensionCount ?? "missing"}, finalStatus=${observedFinalStatus}`,
  );
  const completionAuthorityStatus = context.completionAuthorityLedger?.status ?? "missing";
  const completionAuthorityValidationStatus = context.validationStatuses.completion_authority_confirmed ?? "missing";
  add(
    checks,
    "completion-authority-ledger",
    "Completion authority ledger separates planner, generator, evaluator, and final authority roles",
    Boolean(context.completionAuthorityLedger) &&
      (observedFinalStatus === "success"
        ? completionAuthorityStatus === "pass" &&
          completionAuthorityValidationStatus === "pass" &&
          (context.completionAuthorityLedger?.roles?.length ?? 0) === 4 &&
          (context.completionAuthorityLedger?.authorityGates?.length ?? 0) >= 7 &&
          (context.completionAuthorityLedger?.summary?.failedAuthorityGateCount ?? -1) === 0 &&
          (context.completionAuthorityLedger?.summary?.warningAuthorityGateCount ?? -1) === 0 &&
          (context.completionAuthorityLedger?.summary?.unresolvedCount ?? -1) === 0
        : observedFinalStatus === "failed"
          ? completionAuthorityStatus === "fail" && completionAuthorityValidationStatus === "fail"
          : completionAuthorityStatus !== "missing" && completionAuthorityValidationStatus !== "missing" && completionAuthorityStatus !== "fail"),
    `authority=${completionAuthorityStatus}, validation=${completionAuthorityValidationStatus}, roles=${context.completionAuthorityLedger?.roles?.length ?? "missing"}, gates=${context.completionAuthorityLedger?.summary?.authorityGateCount ?? "missing"}, failed=${context.completionAuthorityLedger?.summary?.failedAuthorityGateCount ?? "missing"}, warning=${context.completionAuthorityLedger?.summary?.warningAuthorityGateCount ?? "missing"}, unresolved=${context.completionAuthorityLedger?.summary?.unresolvedCount ?? "missing"}, finalStatus=${observedFinalStatus}`,
  );
  const verificationPipelineStatus = context.verificationPipelineLedger?.status ?? "missing";
  const verificationPipelineValidationStatus = context.validationStatuses.verified_completion_rate_passed ?? "missing";
  add(
    checks,
    "verification-pipeline-ledger",
    "Verification pipeline ledger records VCR and required check-level completion",
    Boolean(context.verificationPipelineLedger) &&
      (observedFinalStatus === "success"
        ? verificationPipelineStatus === "pass" && verificationPipelineValidationStatus === "pass" && (context.verificationPipelineLedger?.summary?.verifiedCompletionRate ?? 0) === 1 && (context.verificationPipelineLedger?.summary?.unresolvedCount ?? -1) === 0
        : observedFinalStatus === "failed"
          ? verificationPipelineStatus === "fail" && verificationPipelineValidationStatus === "fail"
          : verificationPipelineStatus !== "missing" && verificationPipelineValidationStatus !== "missing" && verificationPipelineStatus !== "fail"),
    `vcr=${verificationPipelineStatus}, validation=${verificationPipelineValidationStatus}, rate=${context.verificationPipelineLedger?.summary?.verifiedCompletionRate ?? "missing"}, unresolved=${context.verificationPipelineLedger?.summary?.unresolvedCount ?? "missing"}, finalStatus=${observedFinalStatus}`,
  );
  const sessionCleanStateStatus = context.sessionCleanStateLedger?.status ?? "missing";
  const sessionCleanStateValidationStatus = context.validationStatuses.session_clean_state_ready ?? "missing";
  add(
    checks,
    "session-clean-state-ledger",
    "Session clean-state ledger records exit cleanliness and stale artifact checks",
    Boolean(context.sessionCleanStateLedger) &&
      (observedFinalStatus === "success"
        ? sessionCleanStateStatus === "pass" && sessionCleanStateValidationStatus === "pass" && (context.sessionCleanStateLedger?.summary?.failedCheckCount ?? -1) === 0 && (context.sessionCleanStateLedger?.summary?.staleArtifactCount ?? -1) === 0
        : observedFinalStatus === "failed"
          ? sessionCleanStateStatus === "fail" && sessionCleanStateValidationStatus === "fail"
          : sessionCleanStateStatus !== "missing" && sessionCleanStateValidationStatus !== "missing" && sessionCleanStateStatus !== "fail"),
    `clean=${sessionCleanStateStatus}, validation=${sessionCleanStateValidationStatus}, failedChecks=${context.sessionCleanStateLedger?.summary?.failedCheckCount ?? "missing"}, staleArtifacts=${context.sessionCleanStateLedger?.summary?.staleArtifactCount ?? "missing"}, finalStatus=${observedFinalStatus}`,
  );
  add(
    checks,
    "feedback-promotion",
    "Feedback promotion ledger exists and records reusable improvement candidates",
    context.feedbackPromotionLedger?.status === "pass" &&
      context.validationStatuses.feedback_promotion_recorded === "pass" &&
      (context.feedbackPromotionLedger?.sourceSummary?.promotionCandidateCount ?? 0) > 0,
    `feedback=${context.feedbackPromotionLedger?.status ?? "missing"}, validation=${context.validationStatuses.feedback_promotion_recorded ?? "missing"}, candidates=${context.feedbackPromotionLedger?.sourceSummary?.promotionCandidateCount ?? 0}`,
  );
  add(
    checks,
    "harness-diagnostic-ledger",
    "Harness diagnostic ledger attributes non-passing signals to harness subsystems",
    context.harnessDiagnosticLedger?.status === "pass" && context.validationStatuses.diagnostic_loop_recorded === "pass",
    `diagnostic=${context.harnessDiagnosticLedger?.status ?? "missing"}, validation=${context.validationStatuses.diagnostic_loop_recorded ?? "missing"}, attributions=${context.harnessDiagnosticLedger?.sourceSummary?.attributionCount ?? 0}`,
  );
  add(
    checks,
    "repair-guidance",
    "Repair guidance ledger gives every non-passing signal agent-oriented what/why/fix/next-command guidance",
    context.repairGuidanceLedger?.status === "pass" &&
      context.validationStatuses.repair_guidance_recorded === "pass" &&
      (context.repairGuidanceLedger?.unresolved?.length ?? -1) === 0 &&
      ((context.repairGuidanceLedger?.sourceSummary?.repairSignalCount ?? 0) === 0 || (context.repairGuidanceLedger?.sourceSummary?.repairActionCount ?? 0) > 0),
    `repair=${context.repairGuidanceLedger?.status ?? "missing"}, validation=${context.validationStatuses.repair_guidance_recorded ?? "missing"}, signals=${context.repairGuidanceLedger?.sourceSummary?.repairSignalCount ?? 0}, actions=${context.repairGuidanceLedger?.sourceSummary?.repairActionCount ?? 0}, unresolved=${context.repairGuidanceLedger?.unresolved?.length ?? "missing"}`,
  );
  add(
    checks,
    "harness-subsystem-audit",
    "Harness subsystem audit scores all five subsystems and identifies bottlenecks from runtime evidence",
    context.harnessSubsystemAudit?.status === "pass" &&
      context.validationStatuses.harness_subsystem_audit_recorded === "pass" &&
      (context.harnessSubsystemAudit?.subsystems?.length ?? 0) === 5 &&
      (context.harnessSubsystemAudit?.unresolved?.length ?? -1) === 0 &&
      ((context.harnessSubsystemAudit?.summary?.nonPassingValidationCount ?? 0) === 0 || Boolean(context.harnessSubsystemAudit?.summary?.primaryBottleneck)),
    `audit=${context.harnessSubsystemAudit?.status ?? "missing"}, validation=${context.validationStatuses.harness_subsystem_audit_recorded ?? "missing"}, subsystems=${context.harnessSubsystemAudit?.subsystems?.length ?? 0}, bottleneck=${context.harnessSubsystemAudit?.summary?.primaryBottleneck ?? "none"}, unresolved=${context.harnessSubsystemAudit?.unresolved?.length ?? "missing"}`,
  );
  add(
    checks,
    "harness-ablation-comparison",
    "Harness ablation comparison measures every subsystem probe through artifact-evidence exclusion",
    context.harnessAblationComparison?.status === "pass" &&
      context.validationStatuses.harness_ablation_comparison_recorded === "pass" &&
      (context.harnessAblationComparison?.summary?.measuredProbeCount ?? 0) === 5 &&
      (context.harnessAblationComparison?.unresolved?.length ?? -1) === 0 &&
      (context.harnessAblationComparison?.probes ?? []).every((probe) => probe.artifactExclusionMeasuredInThisRun === true && probe.branchRerunExecuted === false),
    `ablation=${context.harnessAblationComparison?.status ?? "missing"}, validation=${context.validationStatuses.harness_ablation_comparison_recorded ?? "missing"}, measured=${context.harnessAblationComparison?.summary?.measuredProbeCount ?? 0}, primary=${context.harnessAblationComparison?.summary?.primaryMarginalSubsystem ?? "none"}, unresolved=${context.harnessAblationComparison?.unresolved?.length ?? "missing"}`,
  );
  const qualityDocumentStatus = context.qualityDocument?.status ?? "missing";
  const qualityDocumentValidationStatus = context.validationStatuses.quality_document_recorded ?? "missing";
  add(
    checks,
    "quality-document",
    "Quality document grades subsystem health and records fresh-session next priorities",
    Boolean(context.qualityDocument) &&
      (observedFinalStatus === "success"
        ? qualityDocumentStatus === "pass" &&
          qualityDocumentValidationStatus === "pass" &&
          (context.qualityDocument?.summary?.moduleCount ?? 0) === 5 &&
          (context.qualityDocument?.summary?.healthyModuleCount ?? 0) === 5 &&
          (context.qualityDocument?.summary?.blockedModuleCount ?? -1) === 0 &&
          (context.qualityDocument?.summary?.unresolvedCount ?? -1) === 0
        : observedFinalStatus === "failed"
          ? qualityDocumentStatus === "fail" && qualityDocumentValidationStatus === "fail"
          : qualityDocumentStatus !== "missing" && qualityDocumentValidationStatus !== "missing" && qualityDocumentStatus !== "fail"),
    `qualityDocument=${qualityDocumentStatus}, validation=${qualityDocumentValidationStatus}, grade=${context.qualityDocument?.grade ?? "missing"}, modules=${context.qualityDocument?.summary?.moduleCount ?? "missing"}, healthy=${context.qualityDocument?.summary?.healthyModuleCount ?? "missing"}, blocked=${context.qualityDocument?.summary?.blockedModuleCount ?? "missing"}, unresolved=${context.qualityDocument?.summary?.unresolvedCount ?? "missing"}, finalStatus=${observedFinalStatus}`,
  );
  const qualityStatus = context.harnessQualityLedger?.status ?? "missing";
  const qualityValidationStatus = context.validationStatuses.harness_quality_documented ?? "missing";
  add(
    checks,
    "harness-quality-ledger",
    "Harness quality ledger scores run quality and records next priorities",
    Boolean(context.harnessQualityLedger) &&
      (observedFinalStatus === "success"
        ? qualityStatus === "pass" &&
          qualityValidationStatus === "pass" &&
          (context.harnessQualityLedger?.score ?? 0) >= 90 &&
          (context.harnessQualityLedger?.summary?.failedCheckCount ?? -1) === 0 &&
          (context.harnessQualityLedger?.summary?.warningCheckCount ?? -1) === 0
        : observedFinalStatus === "failed"
          ? qualityStatus === "fail" && qualityValidationStatus === "fail" && (context.harnessQualityLedger?.summary?.failedCheckCount ?? 0) > 0
          : qualityStatus !== "missing" && qualityValidationStatus !== "missing" && qualityStatus !== "fail"),
    `quality=${qualityStatus}, validation=${qualityValidationStatus}, score=${context.harnessQualityLedger?.score ?? "missing"}, grade=${context.harnessQualityLedger?.grade ?? "missing"}, failedChecks=${context.harnessQualityLedger?.summary?.failedCheckCount ?? "missing"}, warningChecks=${context.harnessQualityLedger?.summary?.warningCheckCount ?? "missing"}, priorities=${context.harnessQualityLedger?.priorities?.length ?? "missing"}, finalStatus=${observedFinalStatus}`,
  );
  const continuityStatus = context.continuityLedger?.status ?? "missing";
  const continuityValidationStatus = context.validationStatuses.continuity_state_recorded ?? "missing";
  add(
    checks,
    "continuity-ledger",
    "Continuity ledger records decisions, restart inputs, next actions, and rebuild cost",
    Boolean(context.continuityLedger) &&
      (observedFinalStatus === "success"
        ? continuityStatus === "pass" &&
          continuityValidationStatus === "pass" &&
          (context.continuityLedger?.summary?.decisionCount ?? 0) >= 5 &&
          (context.continuityLedger?.summary?.missingRestartArtifactCount ?? -1) === 0 &&
          (context.continuityLedger?.summary?.nextActionCount ?? 0) > 0 &&
          (context.continuityLedger?.summary?.estimatedRebuildMinutes ?? 99) <= 3
        : observedFinalStatus === "failed"
          ? continuityStatus === "fail" && continuityValidationStatus === "fail" && (context.continuityLedger?.summary?.failedCheckCount ?? 0) > 0
          : continuityStatus !== "missing" && continuityValidationStatus !== "missing" && continuityStatus !== "fail"),
    `continuity=${continuityStatus}, validation=${continuityValidationStatus}, decisions=${context.continuityLedger?.summary?.decisionCount ?? "missing"}, missingRestart=${context.continuityLedger?.summary?.missingRestartArtifactCount ?? "missing"}, nextActions=${context.continuityLedger?.summary?.nextActionCount ?? "missing"}, rebuildMinutes=${context.continuityLedger?.summary?.estimatedRebuildMinutes ?? "missing"}, finalStatus=${observedFinalStatus}`,
  );
  const courseAlignmentStatus = context.courseAlignmentLedger?.status ?? "missing";
  const courseAlignmentValidationStatus = context.validationStatuses.course_alignment_confirmed ?? "missing";
  add(
    checks,
    "course-alignment-ledger",
    "Course alignment ledger maps Learn Harness Engineering requirements to concrete artifacts, validators, and subsystem coverage",
    Boolean(context.courseAlignmentLedger) &&
      (observedFinalStatus === "success"
        ? courseAlignmentStatus === "pass" &&
          courseAlignmentValidationStatus === "pass" &&
          (context.courseAlignmentLedger?.score ?? 0) >= 90 &&
          (context.courseAlignmentLedger?.summary?.requirementCount ?? 0) === 12 &&
          (context.courseAlignmentLedger?.summary?.passingRequirementCount ?? 0) === 12 &&
          (context.courseAlignmentLedger?.summary?.failedRequirementCount ?? -1) === 0 &&
          (context.courseAlignmentLedger?.summary?.warningRequirementCount ?? -1) === 0 &&
          (context.courseAlignmentLedger?.summary?.coveredSubsystemCount ?? 0) === 5 &&
          (context.courseAlignmentLedger?.summary?.unresolvedCount ?? -1) === 0
        : observedFinalStatus === "failed"
          ? courseAlignmentStatus === "fail" && courseAlignmentValidationStatus === "fail" && (context.courseAlignmentLedger?.summary?.failedRequirementCount ?? 0) > 0
          : courseAlignmentStatus !== "missing" && courseAlignmentValidationStatus !== "missing" && courseAlignmentStatus !== "fail"),
    `course=${courseAlignmentStatus}, validation=${courseAlignmentValidationStatus}, score=${context.courseAlignmentLedger?.score ?? "missing"}, requirements=${context.courseAlignmentLedger?.summary?.requirementCount ?? "missing"}, passing=${context.courseAlignmentLedger?.summary?.passingRequirementCount ?? "missing"}, failed=${context.courseAlignmentLedger?.summary?.failedRequirementCount ?? "missing"}, warning=${context.courseAlignmentLedger?.summary?.warningRequirementCount ?? "missing"}, subsystems=${context.courseAlignmentLedger?.summary?.coveredSubsystemCount ?? "missing"}, finalStatus=${observedFinalStatus}`,
  );
  add(
    checks,
    "policy-gate",
    "Policy gate exists and passes",
    context.policyGate?.status === "pass" && context.validationStatuses.policy_gate_passed === "pass",
    `policy=${context.policyGate?.status ?? "missing"}, validation=${context.validationStatuses.policy_gate_passed ?? "missing"}`,
  );
  add(
    checks,
    "tool-safety-ledger",
    "Tool safety ledger fail-closes and concurrency-classifies every provider call",
    context.toolSafetyLedger?.status === "pass" &&
      context.validationStatuses.tool_safety_registry_ready === "pass" &&
      (context.toolSafetyLedger?.summary?.callCount ?? 0) >= (context.dispatchPlan?.providerRoutes?.length ?? 0) &&
      (context.toolSafetyLedger?.summary?.deniedCallCount ?? -1) === 0 &&
      (context.toolSafetyLedger?.summary?.unclassifiedCallCount ?? -1) === 0 &&
      (context.toolSafetyLedger?.unresolved?.length ?? -1) === 0,
    `toolSafety=${context.toolSafetyLedger?.status ?? "missing"}, validation=${context.validationStatuses.tool_safety_registry_ready ?? "missing"}, calls=${context.toolSafetyLedger?.summary?.callCount ?? 0}, serial=${context.toolSafetyLedger?.summary?.serialCallCount ?? 0}, denied=${context.toolSafetyLedger?.summary?.deniedCallCount ?? "missing"}`,
  );
  add(
    checks,
    "context-budget-ledger",
    "Context budget ledger records SELECT/WRITE/COMPRESS/ISOLATE, invalidation, and isolation boundaries",
    context.contextBudgetLedger?.status === "pass" &&
      context.validationStatuses.context_budget_ready === "pass" &&
      (context.contextBudgetLedger?.protocol?.operations ?? []).join("|") === "SELECT|WRITE|COMPRESS|ISOLATE" &&
      (context.contextBudgetLedger?.summary?.estimatedTokenCount ?? 1) <= (context.contextBudgetLedger?.summary?.maxTokenBudget ?? 0) &&
      (context.contextBudgetLedger?.summary?.invalidationPointCount ?? 0) >= 4 &&
      (context.contextBudgetLedger?.summary?.isolationBoundaryCount ?? 0) >= 2 &&
      (context.contextBudgetLedger?.unresolved?.length ?? -1) === 0,
    `context=${context.contextBudgetLedger?.status ?? "missing"}, validation=${context.validationStatuses.context_budget_ready ?? "missing"}, tokens=${context.contextBudgetLedger?.summary?.estimatedTokenCount ?? 0}/${context.contextBudgetLedger?.summary?.maxTokenBudget ?? 0}, isolation=${context.contextBudgetLedger?.summary?.isolationBoundaryCount ?? 0}, invalidation=${context.contextBudgetLedger?.summary?.invalidationPointCount ?? 0}`,
  );
  add(
    checks,
    "approval-gate",
    "Approval gate exists and passes",
    context.approvalGate?.status === "pass" && context.validationStatuses.approval_gate_resolved === "pass",
    `approval=${context.approvalGate?.status ?? "missing"}, validation=${context.validationStatuses.approval_gate_resolved ?? "missing"}`,
  );
  add(
    checks,
    "budget-gate",
    "Budget gate exists and passes",
    context.budgetGate?.status === "pass" && context.validationStatuses.budget_gate_passed === "pass",
    `budget=${context.budgetGate?.status ?? "missing"}, validation=${context.validationStatuses.budget_gate_passed ?? "missing"}`,
  );
  add(
    checks,
    "hook-ledger",
    "Hook ledger exists and covers gates/functions",
    Boolean(context.hookLedger?.emissions?.length) && context.validationStatuses.hook_ledger_recorded === "pass",
    `${context.hookLedger?.emissions?.length ?? 0} hook emission(s), validation=${context.validationStatuses.hook_ledger_recorded ?? "missing"}`,
  );
  add(
    checks,
    "trace-context",
    "Trace context exists and covers registered functions",
    Boolean(context.traceContext?.spans?.length) && context.validationStatuses.trace_context_propagated === "pass",
    `${context.traceContext?.spans?.length ?? 0} span(s), validation=${context.validationStatuses.trace_context_propagated ?? "missing"}`,
  );
  add(
    checks,
    "function-dispatch-plan",
    "Function dispatch plan exists and resolves provider routes",
    context.dispatchPlan?.status === "pass" && context.validationStatuses.function_dispatch_plan_resolved === "pass" && Boolean(context.dispatchPlan?.providerRoutes?.length),
    `dispatch=${context.dispatchPlan?.status ?? "missing"}, validation=${context.validationStatuses.function_dispatch_plan_resolved ?? "missing"}, routes=${context.dispatchPlan?.providerRoutes?.length ?? 0}`,
  );
  add(
    checks,
    "runtime-bus",
    "Runtime bus exists and connects registered providers to topics",
    context.runtimeBus?.status === "pass" &&
      context.validationStatuses.runtime_bus_resolved === "pass" &&
      Boolean(context.runtimeBus?.topics?.length) &&
      Boolean(context.runtimeBus?.subscribers?.length) &&
      (context.runtimeBus?.unresolved?.length ?? -1) === 0,
    `bus=${context.runtimeBus?.status ?? "missing"}, validation=${context.validationStatuses.runtime_bus_resolved ?? "missing"}, topics=${context.runtimeBus?.topics?.length ?? 0}, subscribers=${context.runtimeBus?.subscribers?.length ?? 0}, unresolved=${context.runtimeBus?.unresolved?.length ?? "missing"}`,
  );
  add(
    checks,
    "function-invocation-ledger",
    "Function invocation ledger exists and proves routed functions executed",
    context.invocationLedger?.status === "pass" && context.validationStatuses.function_invocation_ledger_completed === "pass" && (context.invocationLedger?.summary?.missingInvocationCount ?? -1) === 0,
    `invocation=${context.invocationLedger?.status ?? "missing"}, validation=${context.validationStatuses.function_invocation_ledger_completed ?? "missing"}, completed=${context.invocationLedger?.summary?.completedInvocationCount ?? 0}, missing=${context.invocationLedger?.summary?.missingInvocationCount ?? "missing"}`,
  );
  add(
    checks,
    "startup-readiness",
    "Startup readiness exists and matches expected source state",
    Boolean(context.startupReadiness) &&
      (expected.sourceFail ? context.startupReadiness.status === "fail" : context.startupReadiness.status !== "fail") &&
      (expected.sourceFail ? context.validationStatuses.startup_readiness_confirmed === "fail" : context.validationStatuses.startup_readiness_confirmed !== "fail"),
    `startup=${context.startupReadiness?.status ?? "missing"}, expected=${startupExpected}, validation=${context.validationStatuses.startup_readiness_confirmed ?? "missing"}`,
  );
  add(checks, "council-review", "Council review exists", Boolean(context.council), "council-review.json missing");
  add(checks, "critic-present", "Critic questions emitted", context.criticQuestions.length >= (expected.minCriticQuestions ?? 1), `${context.criticQuestions.length} critic questions`);
  add(
    checks,
    "critic-gate-present",
    "critic_questions_present gate exists and passes",
    context.validationStatuses.critic_questions_present === "pass",
    `critic_questions_present=${context.validationStatuses.critic_questions_present ?? "missing"}`,
  );
  if (expected.unresolvedBlockers !== undefined) {
    add(
      checks,
      "unresolved-blocker-count",
      `Unresolved blocker count is ${expected.unresolvedBlockers}`,
      context.unresolvedBlockers.length === expected.unresolvedBlockers,
      `${context.unresolvedBlockers.length} unresolved blockers`,
    );
  }
  if (expected.minUnresolvedBlockers !== undefined) {
    add(
      checks,
      "min-unresolved-blockers",
      `At least ${expected.minUnresolvedBlockers} unresolved blockers emitted`,
      context.unresolvedBlockers.length >= expected.minUnresolvedBlockers,
      `${context.unresolvedBlockers.length} unresolved blockers`,
    );
  }
  if (expected.appCoverage) {
    const required = ["product-acceptance", "ui-flow", "api-contract", "persistence-model", "data-schema", "tests", "accessibility", "deployment"];
    const coverage = appCoverageCategories(context);
    const missing = required.filter((category) => !coverage.has(category));
    add(checks, "app-coverage", "App PRD coverage is present through critics or artifact contracts", missing.length === 0, `missing ${missing.join(", ") || "none"}`);
    add(
      checks,
      "app-prd-validator",
      "app_prd_critic_coverage validator passes",
      context.validationStatuses.app_prd_critic_coverage === "pass",
      `app_prd_critic_coverage=${context.validationStatuses.app_prd_critic_coverage ?? "missing"}`,
    );
  }
  if (expected.appPlan) {
    add(
      checks,
      "app-plan-validators",
      "App planning and source-tree validators pass",
      ["app_requirements_extracted", "app_api_contract_present", "app_persistence_plan_present", "app_source_tree_present", "app_test_plan_full_pipeline", "app_acceptance_coverage"].every((id) => context.validationStatuses[id] === "pass"),
      ["app_requirements_extracted", "app_api_contract_present", "app_persistence_plan_present", "app_source_tree_present", "app_test_plan_full_pipeline", "app_acceptance_coverage"]
        .map((id) => `${id}=${context.validationStatuses[id] ?? "missing"}`)
        .join(", "),
    );
  }
  if (expected.sourceFail) {
    add(checks, "source-fail", "Missing source failed source availability", context.validationStatuses.source_availability === "fail", `source_availability=${context.validationStatuses.source_availability ?? "missing"}`);
  }
  if (expected.sourceWarning) {
    add(checks, "source-warning", "No-source run warns on source availability", context.validationStatuses.source_availability === "warning", `source_availability=${context.validationStatuses.source_availability ?? "missing"}`);
  }
  if (expected.compositeRoute) {
    const matchedRoutePacks = context.trace?.routeComposition?.matchedPacks?.map((pack) => pack.packId) ?? [];
    add(
      checks,
      "composite-route-exposed",
      "Composite route is exposed beyond a single archetype label",
      Boolean(context.trace?.routeComposition?.composite) && (expected.packs ?? []).every((pack) => matchedRoutePacks.includes(pack)),
      `selectedArchetype=${context.trace?.selectedArchetype ?? "missing"}, routePacks=${matchedRoutePacks.join(", ") || "none"}`,
    );
  }
  if (expected.conflictExpected) {
    add(checks, "conflict-detected", "Conflicting PRDs generated source conflicts", (context.trace?.sourceConflicts?.length ?? 0) > 0, `${context.trace?.sourceConflicts?.length ?? 0} source conflicts`);
  }
  if (expected.securityCoverageExpected) {
    const securityQuestion = context.criticQuestions.some((question) => `${question.category} ${question.question} ${question.whyItMatters}`.toLowerCase().includes("security"));
    add(checks, "security-critic-coverage", "Security-sensitive PRD gets security-specific critic coverage", securityQuestion, "no security-specific critic question found");
  }
  for (const [agentId, artifacts] of Object.entries(context.councilAgentArtifacts)) {
    add(checks, `agent-run-${agentId}`, `${agentId} JSON and Markdown artifacts exist`, artifacts.json && artifacts.markdown, JSON.stringify(artifacts));
  }
  add(
    checks,
    "codex-host-artifact",
    "Codex-host critic request artifacts exist",
    context.codexHostCriticArtifactsPresent || (context.runState?.finalStatus === "failed" && expected.sourceFail),
    "codex-host critic request missing",
  );
  const expectedNonzero = ["partial", "failed"].includes(context.runState?.finalStatus ?? "");
  add(
    checks,
    "exit-code-consistency",
    "CLI exit code matches final status convention",
    expectedNonzero ? context.proc.status !== 0 : context.proc.status === 0,
    `exit=${context.proc.status}, finalStatus=${context.runState?.finalStatus ?? "missing"}`,
  );
  return checks;
}

function appCoverageCategories(context) {
  const categories = new Set(context.criticCategories);
  const contractIds = new Set(
    (context.artifactContracts ?? [])
      .map((contract) => (typeof contract === "string" ? contract.split(":")[0] : contract?.id))
      .filter(Boolean),
  );
  if (contractIds.has("app-ui-flow")) {
    categories.add("product-acceptance");
    categories.add("ui-flow");
    categories.add("accessibility");
  }
  if (contractIds.has("app-api-contract")) {
    categories.add("api-contract");
  }
  if (contractIds.has("app-persistence-plan")) {
    categories.add("persistence-model");
    categories.add("data-schema");
  }
  if (contractIds.has("app-source-tree")) {
    categories.add("tests");
    categories.add("deployment");
  }
  if (contractIds.has("app-test-plan")) {
    categories.add("tests");
    categories.add("accessibility");
    categories.add("deployment");
  }
  if (contractIds.has("app-acceptance-plan")) {
    categories.add("product-acceptance");
    categories.add("deployment");
  }
  return categories;
}

function analyzeResults(results) {
  const totalChecks = results.reduce((total, result) => total + result.checks.length, 0);
  const failedChecks = results.flatMap((result) => result.failedChecks.map((check) => ({ caseId: result.id, ...check })));
  const appCases = results.filter((result) => result.criticCategories.includes("api-contract") || result.intent.toLowerCase().includes("app"));
  const appBlockerQuestionSets = appCases
    .filter((result) => result.unresolvedBlockerQuestionCount > 0)
    .map((result) => result.firstFiveBlockers.map((blocker) => blocker.question).join("\n"));
  const duplicateAppBlockerShapes = new Set(appBlockerQuestionSets).size < appBlockerQuestionSets.length;
  const systemicFindings = [];
  if (failedChecks.some((check) => check.id === "composite-route-exposed")) {
    systemicFindings.push("Composite design+motion workflows still collapse to one selectedArchetype instead of exposing pack composition as first-class route output.");
  } else if (results.some((result) => result.routeComposition?.composite)) {
    systemicFindings.push("Composite workflows now expose routeComposition with matched packs while retaining a compatible primary archetype.");
  }
  if (failedChecks.some((check) => check.id === "conflict-detected")) {
    systemicFindings.push("Conflicting PRD sources are not detected as sourceConflicts; the evidence layer mostly records availability, not semantic contradictions.");
  }
  if (failedChecks.some((check) => check.id === "security-critic-coverage")) {
    systemicFindings.push("Security-sensitive app PRDs do not trigger security-specific critic categories; app critics are broad but not yet risk-adaptive.");
  }
  if (appBlockerQuestionSets.length > 1 && duplicateAppBlockerShapes) {
    systemicFindings.push("App blocker questions are largely repeated across different product domains, which means critics are structured but still too template-like.");
  }
  if (appCases.some((result) => result.observedPacks.includes("app-building-fullstack"))) {
    systemicFindings.push("Broad app PRDs now resolve app-building-fullstack and generate planning contracts plus a dependency-free source scaffold with a smoke-test validator; live implementation workers still need to apply framework-specific changes in real user repos.");
  } else if (appCases.every((result) => result.observedPacks.includes("generic-report") || result.observedPacks.some((pack) => ["design-system-ui", "motion-lottie"].includes(pack)))) {
    systemicFindings.push("No app-building/API/persistence capability pack was observed in app-like cases; inspect route matching and evidence extraction before accepting generic fallback behavior.");
  }
  if (
    results.every(
      (result) =>
        result.runtimeControl.policyStatus === "pass" &&
        result.runtimeControl.initializationStatus === "pass" &&
        result.runtimeControl.featureSchedulerStatus === "pass" &&
        result.runtimeControl.environmentReadinessStatus !== "missing" &&
        (result.finalStatus === "success"
          ? result.runtimeControl.environmentReadinessStatus === "pass" &&
            result.runtimeControl.environmentReadinessFailedCheckCount === 0 &&
            result.runtimeControl.environmentReadinessWarningCheckCount === 0 &&
            result.runtimeControl.environmentReadinessUnavailableSourceCount === 0 &&
            result.runtimeControl.environmentReadinessLockfileCount > 0
          : result.finalStatus === "failed"
            ? result.runtimeControl.environmentReadinessStatus === "fail"
            : result.runtimeControl.environmentReadinessStatus !== "fail") &&
        result.runtimeControl.instructionRouterStatus === "pass" &&
        result.runtimeControl.instructionTopicCount > 0 &&
        result.runtimeControl.contextBudgetStatus === "pass" &&
        result.runtimeControl.contextBudgetEstimatedTokenCount <= result.runtimeControl.contextBudgetMaxTokenBudget &&
        result.runtimeControl.contextBudgetIsolationBoundaryCount >= 2 &&
        result.runtimeControl.contextBudgetInvalidationPointCount >= 4 &&
        result.runtimeControl.contextBudgetUnresolvedCount === 0 &&
        result.runtimeControl.sourceOfRecordStatus !== "missing" &&
        (result.finalStatus === "success"
          ? result.runtimeControl.sourceOfRecordStatus === "pass" && result.runtimeControl.sourceOfRecordAnsweredQuestionCount === 5 && result.runtimeControl.sourceOfRecordFailedCheckCount === 0
          : result.finalStatus === "partial"
            ? result.runtimeControl.sourceOfRecordStatus !== "fail"
            : true) &&
        result.runtimeControl.activeFeatureCount <= 1 &&
        result.runtimeControl.lifecycleStatus !== "missing" &&
        result.runtimeControl.lifecycleStatus !== "fail" &&
        result.runtimeControl.lifecyclePhaseCount >= 23 &&
        result.runtimeControl.architectureBoundaryStatus !== "missing" &&
        (result.finalStatus === "success" ? result.runtimeControl.architectureBoundaryStatus === "pass" && result.runtimeControl.architectureBoundaryViolationCount === 0 : result.runtimeControl.architectureBoundaryStatus !== "missing") &&
        result.runtimeControl.evaluatorRubricStatus !== "missing" &&
        (result.finalStatus === "success"
          ? result.runtimeControl.evaluatorRubricStatus === "pass" &&
            result.runtimeControl.evaluatorRubricPassingDimensionCount === 5 &&
            result.runtimeControl.evaluatorRubricFailedDimensionCount === 0 &&
            result.runtimeControl.evaluatorRubricWarningDimensionCount === 0
          : result.finalStatus === "failed"
            ? result.runtimeControl.evaluatorRubricStatus === "fail"
            : result.runtimeControl.evaluatorRubricStatus !== "fail") &&
        result.runtimeControl.completionAuthorityStatus !== "missing" &&
        (result.finalStatus === "success"
          ? result.runtimeControl.completionAuthorityStatus === "pass" &&
            result.runtimeControl.completionAuthorityRoleCount === 4 &&
            result.runtimeControl.completionAuthorityFailedGateCount === 0 &&
            result.runtimeControl.completionAuthorityWarningGateCount === 0 &&
            result.runtimeControl.completionAuthorityUnresolvedCount === 0
          : result.finalStatus === "failed"
            ? result.runtimeControl.completionAuthorityStatus === "fail"
            : result.runtimeControl.completionAuthorityStatus !== "fail") &&
        result.runtimeControl.verificationPipelineStatus !== "missing" &&
        (result.finalStatus === "success" ? result.runtimeControl.verificationPipelineStatus === "pass" && result.runtimeControl.verifiedCompletionRate === 1 && result.runtimeControl.verificationPipelineUnresolvedCount === 0 : result.runtimeControl.verificationPipelineStatus !== "pass" || result.finalStatus !== "failed") &&
        result.runtimeControl.sessionCleanStateStatus !== "missing" &&
        (result.finalStatus === "success" ? result.runtimeControl.sessionCleanStateStatus === "pass" && result.runtimeControl.sessionCleanStateFailedCheckCount === 0 && result.runtimeControl.sessionCleanStateStaleArtifactCount === 0 : result.runtimeControl.sessionCleanStateStatus !== "pass" || result.finalStatus !== "failed") &&
        result.runtimeControl.feedbackPromotionStatus === "pass" &&
        result.runtimeControl.feedbackPromotionCandidateCount > 0 &&
        result.runtimeControl.diagnosticStatus === "pass" &&
        result.runtimeControl.repairGuidanceStatus === "pass" &&
        result.runtimeControl.subsystemAuditStatus === "pass" &&
        result.runtimeControl.subsystemAuditCount === 5 &&
        result.runtimeControl.ablationComparisonStatus === "pass" &&
        result.runtimeControl.ablationMeasuredProbeCount === 5 &&
        result.runtimeControl.qualityDocumentStatus !== "missing" &&
        (result.finalStatus === "success"
          ? result.runtimeControl.qualityDocumentStatus === "pass" &&
            result.runtimeControl.qualityDocumentModuleCount === 5 &&
            result.runtimeControl.qualityDocumentHealthyModuleCount === 5 &&
            result.runtimeControl.qualityDocumentBlockedModuleCount === 0 &&
            result.runtimeControl.qualityDocumentUnresolvedCount === 0
          : result.finalStatus === "failed"
            ? result.runtimeControl.qualityDocumentStatus === "fail"
            : result.runtimeControl.qualityDocumentStatus !== "fail") &&
        result.runtimeControl.harnessQualityStatus !== "missing" &&
        (result.finalStatus === "success"
          ? result.runtimeControl.harnessQualityStatus === "pass" &&
            result.runtimeControl.harnessQualityScore >= 90 &&
            result.runtimeControl.harnessQualityFailedCheckCount === 0 &&
            result.runtimeControl.harnessQualityWarningCheckCount === 0
          : result.finalStatus === "failed"
            ? result.runtimeControl.harnessQualityStatus === "fail" && result.runtimeControl.harnessQualityFailedCheckCount > 0
            : result.runtimeControl.harnessQualityStatus !== "fail") &&
        result.runtimeControl.continuityStatus !== "missing" &&
        (result.finalStatus === "success"
          ? result.runtimeControl.continuityStatus === "pass" &&
            result.runtimeControl.continuityDecisionCount >= 5 &&
            result.runtimeControl.continuityMissingRestartArtifactCount === 0 &&
            result.runtimeControl.continuityEstimatedRebuildMinutes <= 3
          : result.finalStatus === "failed"
            ? result.runtimeControl.continuityStatus === "fail"
            : result.runtimeControl.continuityStatus !== "fail") &&
        result.runtimeControl.courseAlignmentStatus !== "missing" &&
        (result.finalStatus === "success"
          ? result.runtimeControl.courseAlignmentStatus === "pass" &&
            result.runtimeControl.courseAlignmentScore >= 90 &&
            result.runtimeControl.courseAlignmentRequirementCount === 12 &&
            result.runtimeControl.courseAlignmentPassingRequirementCount === 12 &&
            result.runtimeControl.courseAlignmentFailedRequirementCount === 0 &&
            result.runtimeControl.courseAlignmentWarningRequirementCount === 0 &&
            result.runtimeControl.courseAlignmentCoveredSubsystemCount === 5 &&
            result.runtimeControl.courseAlignmentUnresolvedCount === 0
          : result.finalStatus === "failed"
            ? result.runtimeControl.courseAlignmentStatus === "fail"
            : result.runtimeControl.courseAlignmentStatus !== "fail") &&
        result.runtimeControl.approvalStatus === "pass" &&
        result.runtimeControl.budgetStatus === "pass" &&
        result.runtimeControl.workerFunctionCount > 0 &&
        result.runtimeControl.replacementProviderCount > 0 &&
        result.runtimeControl.replacementSlotCount > 0 &&
        result.runtimeControl.replacementUnresolvedCount === 0 &&
        result.runtimeControl.toolSafetyStatus === "pass" &&
        result.runtimeControl.toolSafetyCallCount > 0 &&
        result.runtimeControl.toolSafetyDeniedCallCount === 0 &&
        result.runtimeControl.toolSafetyUnclassifiedCallCount === 0 &&
        result.runtimeControl.providerRouteCount > 0 &&
        result.runtimeControl.runtimeBusStatus === "pass" &&
        result.runtimeControl.runtimeBusSubscriberCount > 0 &&
        result.runtimeControl.invocationLedgerStatus === "pass" &&
        result.runtimeControl.missingInvocationCount === 0 &&
        result.runtimeControl.hookEmissionCount > 0 &&
        result.runtimeControl.traceSpanCount > 0 &&
        result.runtimeControl.startupReadinessStatus !== "missing",
    )
  ) {
    systemicFindings.push("Runs now emit an initialization checklist, feature scheduler, environment-readiness ledger, instruction-routing ledger, context-budget ledger, source-of-record ledger, continuity ledger, course-alignment ledger, lifecycle ledger, architecture-boundary ledger, evaluator rubric, completion-authority ledger, verification-pipeline ledger, session clean-state ledger, feedback-promotion ledger, harness diagnostic ledger, repair-guidance ledger, harness subsystem audit, ablation comparison ledger, quality document, harness quality ledger, worker/function registry, provider replacement registry, tool-safety ledger, dispatch plan, runtime bus, invocation ledger, startup-readiness checklist, and policy/approval/budget/hook/trace artifacts, so runtime control is inspectable, runtime environment assumptions are checked before dispatch, topic instructions are revealed on demand with entry/topic budgets and source/applicability/expiry metadata, context is governed through SELECT/WRITE/COMPRESS/ISOLATE plus explicit invalidation and isolation boundaries, tool/provider calls are fail-closed and concurrency-classified, fresh-session source-of-record answers are explicit, continuity decisions/restart inputs/next actions/rebuild cost are machine-readable, Learn Harness Engineering requirements are mapped to concrete artifacts and validators, ordered lifecycle phases are explicit, architecture boundaries are executable with repair guidance, planner/generator/evaluator authority is separated after an evidence-backed rubric, quality score and quality-document priorities are recorded, verified completion rate is recorded, session exits must have clean-state evidence, review signals become durable improvement candidates, non-passing signals are attributed to harness subsystems, repair actions carry what/why/fix/next-command guidance, five-subsystem bottlenecks are scored, artifact-exclusion ablation probes measure subsystem evidence loss, dispatch routes must have execution evidence, and provider swaps must declare compatibility slots.");
  }
  if (results.some((result) => result.codexHostCriticArtifactsPresent)) {
    systemicFindings.push("Codex-host critic request artifacts are emitted, but no Codex-host model-backed critic execution occurs inside the Node CLI.");
  }
  return {
    summary: {
      usecaseCount: results.length,
      totalChecks,
      passedChecks: totalChecks - failedChecks.length,
      failedChecks: failedChecks.length,
      successRuns: results.filter((result) => result.finalStatus === "success").length,
      partialRuns: results.filter((result) => result.finalStatus === "partial").length,
      failedRuns: results.filter((result) => result.finalStatus === "failed").length,
      casesWithFailedChecks: unique(failedChecks.map((check) => check.caseId)),
    },
    systemicFindings,
  };
}

function add(checks, id, label, pass, detail) {
  checks.push({ id, label, pass: Boolean(pass), detail });
}

async function readJsonIfExists(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function listFilesIfExists(dir) {
  try {
    await stat(dir);
    return (await readdir(dir)).sort();
  } catch {
    return [];
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sameMembers(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}
