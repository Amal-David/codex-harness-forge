import path from "node:path";
import type { HarnessRequest, HarnessSpec, HarnessTrace, SystemProfile, ValidationResult } from "./types.js";
import { routeRequest } from "./router/pattern-router.js";
import { buildSourceRefs, buildSystemProfiles } from "./profiler/source-profiler.js";
import { compileHarnessSpecFromIR } from "./compiler/harness-spec-compiler.js";
import { buildEvidenceGraph } from "./evidence/evidence-graph.js";
import { createDefaultCapabilityRegistry } from "./registry/capability-registry.js";
import { synthesizeHarnessDraft } from "./compiler/harness-draft-synthesizer.js";
import { verifyHarnessDraft, type CompilerError } from "./compiler/harness-draft-verifier.js";
import { compileHarnessIR, verifyHarnessIR } from "./compiler/dag-planner.js";
import { runHarness } from "./runtime/workflow-runner.js";
import { writeJson } from "./utils/fs.js";
import { completeRunRecord, createRunId, createRunRecord } from "./runtime/run-store.js";
export { HARNESS_DIAGNOSTIC_LEDGER_ARTIFACT, harnessDiagnosticLedgerEvents, writeHarnessDiagnosticLedger } from "./runtime/harness-diagnostic-ledger.js";
export { INSTRUCTION_ROUTING_LEDGER_ARTIFACT, instructionRoutingLedgerEvents, writeInstructionRoutingLedger } from "./runtime/instruction-routing-ledger.js";
export { REPAIR_GUIDANCE_LEDGER_ARTIFACT, repairGuidanceLedgerEvents, writeRepairGuidanceLedger } from "./runtime/repair-guidance-ledger.js";
export { HARNESS_SUBSYSTEM_AUDIT_ARTIFACT, harnessSubsystemAuditEvents, writeHarnessSubsystemAudit } from "./runtime/harness-subsystem-audit.js";
export { HARNESS_ABLATION_COMPARISON_ARTIFACT, harnessAblationComparisonEvents, writeHarnessAblationComparison } from "./runtime/harness-ablation-comparison.js";
export { EVALUATOR_RUBRIC_JSON_ARTIFACT, EVALUATOR_RUBRIC_MD_ARTIFACT, EVALUATOR_RUBRIC_VALIDATION_ID, QUALITY_DOCUMENT_JSON_ARTIFACT, QUALITY_DOCUMENT_MD_ARTIFACT, QUALITY_DOCUMENT_VALIDATION_ID, evaluatorRubricEvents, qualityDocumentEvents, writeEvaluatorRubric, writeQualityDocument } from "./runtime/evaluator-quality-artifacts.js";
export { VERIFICATION_PIPELINE_LEDGER_ARTIFACT, VERIFIED_COMPLETION_RATE_VALIDATION_ID, verificationPipelineEvents, writeVerificationPipelineLedger } from "./runtime/verification-pipeline-ledger.js";
export { SESSION_CLEAN_STATE_LEDGER_ARTIFACT, SESSION_CLEAN_STATE_VALIDATION_ID, sessionCleanStateEvents, writeSessionCleanStateLedger } from "./runtime/session-clean-state-ledger.js";
export { ARCHITECTURE_BOUNDARY_LEDGER_ARTIFACT, ARCHITECTURE_BOUNDARY_VALIDATION_ID, architectureBoundaryLedgerEvents, writeArchitectureBoundaryLedger } from "./runtime/architecture-boundary-ledger.js";
export { SOURCE_OF_RECORD_LEDGER_ARTIFACT, SOURCE_OF_RECORD_VALIDATION_ID, sourceOfRecordEvents, writeSourceOfRecordLedger } from "./runtime/source-of-record-ledger.js";

export interface BuildHarnessResult {
  request: HarnessRequest;
  spec: HarnessSpec;
  profiles: SystemProfile[];
  outputDir: string;
  validations: ValidationResult[];
  artifacts: string[];
  trace: HarnessTrace;
}

export async function buildHarness(request: HarnessRequest): Promise<BuildHarnessResult> {
  const sources = await buildSourceRefs(request.sources);
  const evidenceGraph = await buildEvidenceGraph(sources);
  const registry = createDefaultCapabilityRegistry();
  const route = routeRequest(request, { evidenceGraph, packs: registry.packs });
  const normalizedRequest = { ...request, mode: request.mode ?? route.mode };
  const draft = synthesizeHarnessDraft({
    request: normalizedRequest,
    evidenceGraph,
    registry,
    selectedPackIds: route.selectedCapabilityPackIds,
  });
  const draftVerification = verifyHarnessDraft(draft, evidenceGraph, registry);
  if (!draftVerification.ok) {
    throw new Error(`Harness draft verification failed:\n${formatCompilerErrors(draftVerification.errors)}`);
  }
  const ir = compileHarnessIR(normalizedRequest, draft, evidenceGraph);
  const irVerification = verifyHarnessIR(ir, registry);
  if (!irVerification.ok) {
    throw new Error(`Harness IR verification failed:\n${formatCompilerErrors(irVerification.errors)}`);
  }
  const profiles = (await buildSystemProfiles(normalizedRequest, route.systemTypes, sources)).map((profile) => ({ ...profile, evidenceGraph }));
  const spec = compileHarnessSpecFromIR(normalizedRequest, route, profiles, sources, ir, registry);
  const runId = createRunId();
  await createRunRecord({
    runId,
    status: "running",
    startedAt: new Date().toISOString(),
    request: normalizedRequest,
    harnessSpecId: spec.id,
    outputDir: path.resolve(normalizedRequest.outputDir),
    artifacts: [],
    validations: [],
  });
  let run;
  try {
    run = await runHarness(spec, normalizedRequest, profiles, runId);
  } catch (error) {
    await completeRunRecord(runId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      artifacts: [],
      validations: [
        {
          id: "runtime_error",
          name: "Runtime error",
          status: "fail",
          details: error instanceof Error ? error.message : String(error),
          repairable: true,
        },
      ],
    });
    throw error;
  }
  const tracePath = path.join(run.outputDir, "harness-trace.json");
  const trace = (await import("node:fs/promises").then((fs) => fs.readFile(tracePath, "utf8")).then((text) => JSON.parse(text))) as HarnessTrace;
  await writeJson(path.join(run.outputDir, "run-summary.json"), {
    runId,
    status: trace.finalStatus,
    outputDir: run.outputDir,
    artifactCount: run.artifacts.length,
    validationCount: run.validations.length,
  });
  await completeRunRecord(runId, {
    status: trace.finalStatus === "failed" ? "failed" : "completed",
    finalStatus: trace.finalStatus,
    completedAt: trace.completedAt,
    outputDir: run.outputDir,
    tracePath,
    artifacts: [...run.artifacts, "run-summary.json"],
    validations: run.validations,
  });
  return {
    request: normalizedRequest,
    spec,
    profiles,
    outputDir: run.outputDir,
    validations: run.validations,
    artifacts: [...run.artifacts, "run-summary.json"],
    trace,
  };
}

export * from "./types.js";
export { routeRequest } from "./router/pattern-router.js";
export { compileHarnessSpec, compileHarnessSpecFromIR } from "./compiler/harness-spec-compiler.js";
export { compileDomainPrompt } from "./compiler/domain-prompt-compiler.js";
export { buildSourceRefs, buildSystemProfiles } from "./profiler/source-profiler.js";
export { buildEvidenceGraph } from "./evidence/evidence-graph.js";
export { createDefaultCapabilityRegistry } from "./registry/capability-registry.js";
export { synthesizeHarnessDraft } from "./compiler/harness-draft-synthesizer.js";
export { verifyHarnessDraft } from "./compiler/harness-draft-verifier.js";
export { compileHarnessIR, verifyHarnessIR } from "./compiler/dag-planner.js";
export {
  completeRunRecord,
  createRunId,
  createRunRecord,
  listRunRecords,
  listSavedWorkflows,
  mergeRequests,
  readRunRecord,
  readSavedWorkflow,
  saveWorkflowFromRun,
} from "./runtime/run-store.js";
export {
  resolveExecutorBindings,
  resolveExecutorBindingsForCapabilityIds,
  resolveExecutorForCapability,
  resolveExecutorForCapabilityId,
  uniqueExecutorBindings,
} from "./runtime/executor-registry.js";
export { resolveWorkerBindings, workerAgentIdsForGroup } from "./runtime/worker-registry.js";
export { writeRunPlanArtifacts } from "./runtime/run-plan.js";
export {
  APPROVAL_GATE_ARTIFACT,
  BUDGET_GATE_ARTIFACT,
  FUNCTION_DISPATCH_PLAN_ARTIFACT,
  FUNCTION_INVOCATION_LEDGER_ARTIFACT,
  HOOK_LEDGER_ARTIFACT,
  POLICY_GATE_ARTIFACT,
  RUNTIME_BUS_ARTIFACT,
  STARTUP_READINESS_ARTIFACT,
  TRACE_CONTEXT_ARTIFACT,
  WORKER_FUNCTION_REGISTRY_ARTIFACT,
  runtimeControlEvents,
  writeRuntimeControlArtifacts,
} from "./runtime/runtime-control-plane.js";
export { functionInvocationEvents, writeFunctionInvocationLedger } from "./runtime/function-invocation-ledger.js";
export { NODE_EXECUTION_LEDGER_ARTIFACT, NODE_EXECUTION_VALIDATION_ID, markCompletedValidationNodes, nodeExecutionEvents, writeNodeExecutionLedger } from "./runtime/node-execution-ledger.js";
export { INITIALIZATION_CHECKLIST_ARTIFACT, initializationChecklistEvents, writeInitializationChecklist } from "./runtime/initialization-checklist.js";
export { FEATURE_SCHEDULER_ARTIFACT, featureSchedulerEvents, writeFeatureScheduler } from "./runtime/feature-scheduler.js";
export { LIFECYCLE_LEDGER_ARTIFACT, lifecycleLedgerEvents, writeLifecycleLedger } from "./runtime/lifecycle-ledger.js";
export { FEEDBACK_PROMOTION_LEDGER_ARTIFACT, feedbackPromotionEvents, writeFeedbackPromotionLedger } from "./runtime/feedback-promotion-ledger.js";
export { loadWorkerContractCatalogs, loadWorkerFunctionContracts, validateWorkerContractCatalog, validateWorkerFunctionContract } from "./runtime/worker-contracts.js";

function formatCompilerErrors(errors: CompilerError[]): string {
  return errors.map((error) => `- ${error.code} at ${error.path}: ${error.message}${error.repairHint ? ` (${error.repairHint})` : ""}`).join("\n");
}
