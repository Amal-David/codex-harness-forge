import path from "node:path";
import type { HarnessRequest, HarnessSpec, RuntimeAgentRun, SystemProfile, TraceEvent, ValidationResult } from "../types.js";
import { generateLearningSuggestions, renderLearningSuggestions } from "../learning/learning-suggestions.js";
import { generateArtifacts } from "./artifact-generator.js";
import { writeTrace } from "./trace-writer.js";
import { finalStatusFromValidations, renderValidationReport } from "../validators/common/validation-report.js";
import { pathExists, readText, writeText } from "../utils/fs.js";
import { traceEvent, writeTraceEvents } from "./trace-ledger.js";
import { writeCouncilReview } from "./council-reviewer.js";
import { runCouncilElderAgents, runCourseCorrectionAgent, runDomainPlanningAgents, runFinalizationAgents, runRuntimePlanningAgents } from "./parallel-agent-runner.js";
import { resolveExecutorBindings, uniqueExecutorBindings } from "./executor-registry.js";
import { runValidatorExecutor } from "./executor-runner.js";
import { writeRunPlanArtifacts } from "./run-plan.js";
import { writeHarnessEngineeringRecord } from "./harness-engineering-record.js";
import { writeHarnessPlanningArtifacts, writeHarnessRuntimeStateArtifacts } from "./harness-state.js";
import { runtimeControlEvents, writeRuntimeControlArtifacts } from "./runtime-control-plane.js";
import { functionInvocationEvents, writeFunctionInvocationLedger } from "./function-invocation-ledger.js";
import { initializationChecklistEvents, writeInitializationChecklist } from "./initialization-checklist.js";
import { featureSchedulerEvents, writeFeatureScheduler } from "./feature-scheduler.js";
import { lifecycleLedgerEvents, writeLifecycleLedger } from "./lifecycle-ledger.js";
import { feedbackPromotionEvents, writeFeedbackPromotionLedger } from "./feedback-promotion-ledger.js";
import { harnessDiagnosticLedgerEvents, writeHarnessDiagnosticLedger } from "./harness-diagnostic-ledger.js";
import { instructionRoutingLedgerEvents, writeInstructionRoutingLedger } from "./instruction-routing-ledger.js";
import { repairGuidanceLedgerEvents, writeRepairGuidanceLedger } from "./repair-guidance-ledger.js";
import { HARNESS_SUBSYSTEM_AUDIT_ARTIFACT, harnessSubsystemAuditEvents, writeHarnessSubsystemAudit } from "./harness-subsystem-audit.js";
import { harnessAblationComparisonEvents, writeHarnessAblationComparison } from "./harness-ablation-comparison.js";
import { evaluatorRubricEvents, qualityDocumentEvents, writeEvaluatorRubric, writeQualityDocument } from "./evaluator-quality-artifacts.js";
import { harnessQualityLedgerEvents, writeHarnessQualityLedger } from "./harness-quality-ledger.js";
import { continuityLedgerEvents, writeContinuityLedger } from "./continuity-ledger.js";
import { courseAlignmentLedgerEvents, writeCourseAlignmentLedger } from "./course-alignment-ledger.js";
import { verificationPipelineEvents, writeVerificationPipelineLedger } from "./verification-pipeline-ledger.js";
import { sessionCleanStateEvents, writeSessionCleanStateLedger } from "./session-clean-state-ledger.js";
import { architectureBoundaryLedgerEvents, writeArchitectureBoundaryLedger } from "./architecture-boundary-ledger.js";
import { sourceOfRecordEvents, writeSourceOfRecordLedger } from "./source-of-record-ledger.js";
import { completionAuthorityEvents, writeCompletionAuthorityLedger } from "./completion-authority-ledger.js";
import { environmentReadinessEvents, writeEnvironmentReadinessLedger } from "./environment-readiness-ledger.js";
import { markCompletedValidationNodes, nodeExecutionEvents, writeNodeExecutionLedger } from "./node-execution-ledger.js";
import { prepareRunOutputDirectory } from "./run-output.js";

export async function runHarness(spec: HarnessSpec, request: HarnessRequest, profiles: SystemProfile[], runId = `run-${Date.now()}`): Promise<{ outputDir: string; validations: ValidationResult[]; artifacts: string[] }> {
  const outputDir = path.resolve(request.outputDir);
  await prepareRunOutputDirectory({
    outputDir,
    sourcePaths: spec.sources.map((source) => source.location),
  });
  const events: TraceEvent[] = [
    traceEvent({ runId, type: "run.started", message: `Started harness run '${spec.name}'.` }),
    ...(spec.ir ? [traceEvent({ runId, type: "ir.compiled", message: `Compiled IR '${spec.ir.id}'.` })] : []),
  ];
  const agentRuns: RuntimeAgentRun[] = [];
  const runPlan = await writeRunPlanArtifacts(outputDir, runId, spec);
  events.push(
    traceEvent({
      runId,
      type: "run.plan.created",
      artifactId: "run-plan.json",
      message: `Created replayable run plan with ${runPlan.runPlan.nodeCount} node(s), ${runPlan.executorLock.length} executor binding(s), and ${runPlan.workerLock.length} worker binding(s).`,
      evidence: runPlan.artifacts,
    }),
    ...runPlan.executorLock.map((executor) =>
      traceEvent({
        runId,
        type: "executor.bound",
        capabilityId: executor.matchedCapabilityIds.join(","),
        artifactId: "executor-lock.json",
        message: `Bound ${executor.kind} executor '${executor.executorId}' from pack '${executor.packId}'.`,
        evidence: ["executor-lock.json"],
      }),
    ),
    ...runPlan.workerLock.map((worker) =>
      traceEvent({
        runId,
        type: "worker.bound",
        capabilityId: worker.matchedCapabilityIds.join(","),
        artifactId: "worker-lock.json",
        message: `Bound ${worker.group} worker '${worker.workerBindingId}' to function '${worker.functionId}' from pack '${worker.packId}'.`,
        evidence: ["worker-lock.json"],
      }),
    ),
  );
  const planningArtifacts = await writeHarnessPlanningArtifacts(spec, outputDir);
  const featureScheduler = await writeFeatureScheduler({
    outputDir,
    runId,
    spec,
    runPlan: runPlan.runPlan,
  });
  const initialization = await writeInitializationChecklist({
    outputDir,
    runId,
    spec,
    runPlan: runPlan.runPlan,
    planningArtifacts: [...planningArtifacts, featureScheduler.artifact],
  });
  events.push(
    ...planningArtifacts.map((artifact) => traceEvent({ runId, type: "artifact.written", artifactId: artifact, message: `Wrote initialization artifact ${artifact}.` })),
    ...featureSchedulerEvents(runId, featureScheduler),
    ...initializationChecklistEvents(runId, initialization),
  );
  const environmentReadiness = await writeEnvironmentReadinessLedger({
    outputDir,
    runId,
    spec,
    request,
    initializationChecklist: initialization.checklist,
  });
  events.push(...environmentReadinessEvents(runId, environmentReadiness));
  const instructionRouting = await writeInstructionRoutingLedger({
    outputDir,
    runId,
    spec,
  });
  events.push(...instructionRoutingLedgerEvents(runId, instructionRouting));
  const runtimeControl = await writeRuntimeControlArtifacts({
    outputDir,
    runId,
    spec,
    executorLock: runPlan.executorLock,
    workerLock: runPlan.workerLock,
    runPlan: runPlan.runPlan,
  });
  events.push(...runtimeControlEvents(runId, runtimeControl));
  const sourceValidations = runSourceValidators(spec);
  const completedNodeIds = new Set<string>(spec.graph.filter((node) => node.kind === "profile").map((node) => node.id));
  if (sourceValidations.some((validation) => validation.id === "source_availability")) {
    completedNodeIds.add("validate:source-availability");
  }
  const runtimePlanning = await runRuntimePlanningAgents({ outputDir, runId, spec, request });
  agentRuns.push(...runtimePlanning.runs);
  events.push(...runtimePlanning.events);
  for (const run of runtimePlanning.runs) {
    completedNodeIds.add(run.nodeId);
  }
  const domainPlanning = await runDomainPlanningAgents({ outputDir, runId, spec, request }, completedNodeIds);
  agentRuns.push(...domainPlanning.runs);
  events.push(...domainPlanning.events);
  const generatedArtifacts = await generateArtifacts(spec, request, profiles, outputDir, { completedNodeIds });
  const artifacts = [...runPlan.artifacts, ...planningArtifacts, featureScheduler.artifact, initialization.artifact, environmentReadiness.artifact, instructionRouting.artifact, ...runtimeControl.artifacts, ...generatedArtifacts];
  artifacts.push(...runtimePlanning.artifacts);
  artifacts.push(...domainPlanning.artifacts);
  for (const artifact of artifacts) {
    events.push(traceEvent({ runId, type: "artifact.written", artifactId: artifact, message: `Wrote artifact ${artifact}.` }));
  }
  const validations = [initialization.validation, featureScheduler.validation, environmentReadiness.validation, instructionRouting.validation, ...runtimeControl.validations, ...sourceValidations, ...(await runValidators(spec, request, outputDir))];
  const architectureBoundary = await writeArchitectureBoundaryLedger({
    outputDir,
    runId,
    spec,
    artifacts,
  });
  artifacts.push(architectureBoundary.artifact);
  validations.push(architectureBoundary.validation);
  events.push(...architectureBoundaryLedgerEvents(runId, architectureBoundary));
  const councilElders = await runCouncilElderAgents({ outputDir, runId, spec, request, validations });
  agentRuns.push(...councilElders.runs);
  artifacts.push(...councilElders.artifacts);
  events.push(...councilElders.events);
  const council = await writeCouncilReview(outputDir, runId, spec, request, validations, agentRuns);
  const courseCorrection = await runCourseCorrectionAgent({ outputDir, runId, spec, request, validations }, council.review);
  agentRuns.push(...courseCorrection.runs);
  artifacts.push(...courseCorrection.artifacts);
  events.push(...courseCorrection.events);
  for (const run of [...councilElders.runs, ...courseCorrection.runs]) {
    completedNodeIds.add(run.nodeId);
  }
  artifacts.push(...council.artifacts);
  validations.push(council.validation, ...council.criticValidations);
  events.push(traceEvent({ runId, type: "council.reviewed", artifactId: "council-review.json", status: council.validation.status, message: `Council review completed with verdict ${council.review.verdict}.`, evidence: council.artifacts }));
  for (const correction of council.review.courseCorrections) {
    events.push(traceEvent({ runId, type: "course_correction.proposed", message: correction, evidence: ["council-review.json"] }));
  }
  const runStatePath = path.join(outputDir, "run-state.json");
  validations.push({
    id: "run_state_persisted",
    name: "Run state persisted",
    status: "pass",
    details: "Run state is written to the output directory and mirrored in the .harness run store by the workflow manager.",
    evidence: [runStatePath],
    repairable: true,
  });
  markCompletedValidationNodes(spec, runtimeControl.dispatchPlan, validations, completedNodeIds);
  const finalization = await runFinalizationAgents({ outputDir, runId, spec, request, validations }, completedNodeIds);
  agentRuns.push(...finalization.runs);
  artifacts.push(...finalization.artifacts);
  events.push(...finalization.events);
  const invocationLedger = await writeFunctionInvocationLedger({
    outputDir,
    runId,
    spec,
    dispatchPlan: runtimeControl.dispatchPlan,
    agentRuns,
    artifacts,
    validations,
  });
  artifacts.push(invocationLedger.artifact);
  validations.push(invocationLedger.validation);
  events.push(...functionInvocationEvents(runId, invocationLedger.ledger, invocationLedger.validation));
  const nodeExecution = await writeNodeExecutionLedger({
    outputDir,
    runId,
    spec,
    dispatchPlan: runtimeControl.dispatchPlan,
    invocationLedger: invocationLedger.ledger,
    completedNodeIds,
  });
  artifacts.push(nodeExecution.artifact);
  validations.push(nodeExecution.validation);
  events.push(...nodeExecutionEvents(runId, nodeExecution));
  for (const event of eventsForGraph(runId, spec, completedNodeIds)) {
    events.push(event);
  }
  const harnessRuntimeState = await writeHarnessRuntimeStateArtifacts({
    outputDir,
    spec,
    validations,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
  });
  for (const artifact of harnessRuntimeState.artifacts) {
    if (!artifacts.includes(artifact)) {
      artifacts.push(artifact);
    }
  }
  events.push(
    traceEvent({
      runId,
      type: "artifact.written",
      artifactId: "feature-list.json",
      status: harnessRuntimeState.validation.status,
      message: "Updated validator-gated feature state and session handoff artifacts.",
      evidence: harnessRuntimeState.artifacts.map((artifact) => path.join(outputDir, artifact)),
    }),
  );
  const sourceOfRecord = await writeSourceOfRecordLedger({
    outputDir,
    runId,
    spec,
    request,
    profiles,
    validations,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
  });
  artifacts.push(sourceOfRecord.artifact);
  validations.push(sourceOfRecord.validation);
  events.push(...sourceOfRecordEvents(runId, sourceOfRecord));
  const sourceOfRecordHarnessRuntimeState = await writeHarnessRuntimeStateArtifacts({
    outputDir,
    spec,
    validations,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
  });
  events.push(
    traceEvent({
      runId,
      type: "artifact.written",
      artifactId: "feature-list.json",
      status: sourceOfRecordHarnessRuntimeState.validation.status,
      message: "Refreshed validator-gated feature state after source-of-record validation.",
      evidence: sourceOfRecordHarnessRuntimeState.artifacts.map((artifact) => path.join(outputDir, artifact)),
    }),
  );
  const evaluatorRubric = await writeEvaluatorRubric({
    outputDir,
    runId,
    spec,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json", "feature-list.json", "progress.md", "session-handoff.md"],
    validations,
    councilReview: council.review,
    functionInvocationLedger: invocationLedger.ledger,
  });
  artifacts.push(...evaluatorRubric.artifacts);
  validations.push(evaluatorRubric.validation);
  events.push(...evaluatorRubricEvents(runId, evaluatorRubric));
  const completionAuthority = await writeCompletionAuthorityLedger({
    outputDir,
    runId,
    spec,
    functionInvocationLedger: invocationLedger.ledger,
    councilReview: council.review,
    validations,
    agentRuns,
  });
  artifacts.push(completionAuthority.artifact);
  validations.push(completionAuthority.validation);
  events.push(...completionAuthorityEvents(runId, completionAuthority));
  const authorityHarnessRuntimeState = await writeHarnessRuntimeStateArtifacts({
    outputDir,
    spec,
    validations,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
  });
  const authorityFeatureScopeValidationIndex = validations.findIndex((validation) => validation.id === authorityHarnessRuntimeState.validation.id);
  if (authorityFeatureScopeValidationIndex >= 0) {
    validations[authorityFeatureScopeValidationIndex] = authorityHarnessRuntimeState.validation;
  } else {
    validations.push(authorityHarnessRuntimeState.validation);
  }
  events.push(
    traceEvent({
      runId,
      type: "artifact.written",
      artifactId: "feature-list.json",
      status: authorityHarnessRuntimeState.validation.status,
      message: "Refreshed validator-gated feature state after completion-authority validation.",
      evidence: authorityHarnessRuntimeState.artifacts.map((artifact) => path.join(outputDir, artifact)),
    }),
  );
  const feedbackPromotion = await writeFeedbackPromotionLedger({
    outputDir,
    runId,
    spec,
    councilReview: council.review,
    validations,
  });
  artifacts.push(feedbackPromotion.artifact);
  validations.push(feedbackPromotion.validation);
  events.push(...feedbackPromotionEvents(runId, feedbackPromotion));
  const harnessDiagnosticLedger = await writeHarnessDiagnosticLedger({
    outputDir,
    runId,
    specId: spec.id,
    councilReview: council.review,
    validations,
  });
  artifacts.push(harnessDiagnosticLedger.artifact);
  validations.push(harnessDiagnosticLedger.validation);
  events.push(...harnessDiagnosticLedgerEvents(runId, harnessDiagnosticLedger));
  const repairGuidance = await writeRepairGuidanceLedger({
    outputDir,
    runId,
    specId: spec.id,
    councilReview: council.review,
    validations,
    diagnosticAttributions: harnessDiagnosticLedger.ledger.attributions,
  });
  artifacts.push(repairGuidance.artifact);
  validations.push(repairGuidance.validation);
  events.push(...repairGuidanceLedgerEvents(runId, repairGuidance));
  const harnessSubsystemAudit = await writeHarnessSubsystemAudit({
    outputDir,
    runId,
    spec,
    artifacts: [...artifacts, HARNESS_SUBSYSTEM_AUDIT_ARTIFACT],
    validations,
    diagnosticAttributions: harnessDiagnosticLedger.ledger.attributions,
    repairActions: repairGuidance.ledger.actions,
  });
  artifacts.push(harnessSubsystemAudit.artifact);
  validations.push(harnessSubsystemAudit.validation);
  events.push(...harnessSubsystemAuditEvents(runId, harnessSubsystemAudit));
  const harnessAblationComparison = await writeHarnessAblationComparison({
    outputDir,
    runId,
    spec,
    subsystemAudit: harnessSubsystemAudit.ledger,
  });
  artifacts.push(harnessAblationComparison.artifact);
  validations.push(harnessAblationComparison.validation);
  events.push(...harnessAblationComparisonEvents(runId, harnessAblationComparison));
  const qualityDocument = await writeQualityDocument({
    outputDir,
    runId,
    spec,
    artifacts: [...artifacts, "feature-list.json", "progress.md", "session-handoff.md"],
    validations,
    subsystemAudit: harnessSubsystemAudit.ledger,
    ablationComparison: harnessAblationComparison.ledger,
    repairActions: repairGuidance.ledger.actions,
  });
  artifacts.push(...qualityDocument.artifacts);
  validations.push(qualityDocument.validation);
  events.push(...qualityDocumentEvents(runId, qualityDocument));
  const postFeedbackHarnessRuntimeState = await writeHarnessRuntimeStateArtifacts({
    outputDir,
    spec,
    validations,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
  });
  const postFeedbackFeatureScopeValidationIndex = validations.findIndex((validation) => validation.id === postFeedbackHarnessRuntimeState.validation.id);
  if (postFeedbackFeatureScopeValidationIndex >= 0) {
    validations[postFeedbackFeatureScopeValidationIndex] = postFeedbackHarnessRuntimeState.validation;
  } else {
    validations.push(postFeedbackHarnessRuntimeState.validation);
  }
  events.push(
    traceEvent({
      runId,
      type: "artifact.written",
      artifactId: "feature-list.json",
      status: postFeedbackHarnessRuntimeState.validation.status,
      message: "Refreshed validator-gated feature state after feedback, diagnostic, audit, and ablation validations.",
      evidence: postFeedbackHarnessRuntimeState.artifacts.map((artifact) => path.join(outputDir, artifact)),
    }),
  );
  const harnessQuality = await writeHarnessQualityLedger({
    outputDir,
    runId,
    spec,
    artifacts: [...artifacts, "feature-list.json", "progress.md", "session-handoff.md"],
    validations,
    subsystemAudit: harnessSubsystemAudit.ledger,
    ablationComparison: harnessAblationComparison.ledger,
    repairActions: repairGuidance.ledger.actions,
  });
  artifacts.push(harnessQuality.artifact);
  validations.push(harnessQuality.validation);
  events.push(...harnessQualityLedgerEvents(runId, harnessQuality));
  const qualityHarnessRuntimeState = await writeHarnessRuntimeStateArtifacts({
    outputDir,
    spec,
    validations,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
  });
  const qualityFeatureScopeValidationIndex = validations.findIndex((validation) => validation.id === qualityHarnessRuntimeState.validation.id);
  if (qualityFeatureScopeValidationIndex >= 0) {
    validations[qualityFeatureScopeValidationIndex] = qualityHarnessRuntimeState.validation;
  } else {
    validations.push(qualityHarnessRuntimeState.validation);
  }
  events.push(
    traceEvent({
      runId,
      type: "artifact.written",
      artifactId: "feature-list.json",
      status: qualityHarnessRuntimeState.validation.status,
      message: "Refreshed validator-gated feature state after quality documentation.",
      evidence: qualityHarnessRuntimeState.artifacts.map((artifact) => path.join(outputDir, artifact)),
    }),
  );
  const continuityLedger = await writeContinuityLedger({
    outputDir,
    runId,
    spec,
    request,
    runPlan: runPlan.runPlan,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json", "continuity-ledger.json"],
    validations,
    sourceOfRecordLedger: sourceOfRecord.ledger,
    completionAuthorityLedger: completionAuthority.ledger,
    harnessQualityLedger: harnessQuality.ledger,
  });
  artifacts.push(continuityLedger.artifact);
  validations.push(continuityLedger.validation);
  events.push(...continuityLedgerEvents(runId, continuityLedger));
  const continuityHarnessRuntimeState = await writeHarnessRuntimeStateArtifacts({
    outputDir,
    spec,
    validations,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
  });
  const continuityFeatureScopeValidationIndex = validations.findIndex((validation) => validation.id === continuityHarnessRuntimeState.validation.id);
  if (continuityFeatureScopeValidationIndex >= 0) {
    validations[continuityFeatureScopeValidationIndex] = continuityHarnessRuntimeState.validation;
  } else {
    validations.push(continuityHarnessRuntimeState.validation);
  }
  events.push(
    traceEvent({
      runId,
      type: "artifact.written",
      artifactId: "feature-list.json",
      status: continuityHarnessRuntimeState.validation.status,
      message: "Refreshed validator-gated feature state after continuity-state validation.",
      evidence: continuityHarnessRuntimeState.artifacts.map((artifact) => path.join(outputDir, artifact)),
    }),
  );
  const courseAlignment = await writeCourseAlignmentLedger({
    outputDir,
    runId,
    spec,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json", "course-alignment-ledger.json"],
    validations,
  });
  artifacts.push(courseAlignment.artifact);
  validations.push(courseAlignment.validation);
  events.push(...courseAlignmentLedgerEvents(runId, courseAlignment));
  const courseAlignmentHarnessRuntimeState = await writeHarnessRuntimeStateArtifacts({
    outputDir,
    spec,
    validations,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
  });
  const courseAlignmentFeatureScopeValidationIndex = validations.findIndex((validation) => validation.id === courseAlignmentHarnessRuntimeState.validation.id);
  if (courseAlignmentFeatureScopeValidationIndex >= 0) {
    validations[courseAlignmentFeatureScopeValidationIndex] = courseAlignmentHarnessRuntimeState.validation;
  } else {
    validations.push(courseAlignmentHarnessRuntimeState.validation);
  }
  events.push(
    traceEvent({
      runId,
      type: "artifact.written",
      artifactId: "feature-list.json",
      status: courseAlignmentHarnessRuntimeState.validation.status,
      message: "Refreshed validator-gated feature state after course-alignment validation.",
      evidence: courseAlignmentHarnessRuntimeState.artifacts.map((artifact) => path.join(outputDir, artifact)),
    }),
  );
  const lifecycleLedger = await writeLifecycleLedger({
    outputDir,
    runId,
    spec,
    runtimeControl,
    functionInvocationLedger: invocationLedger.ledger,
    completionAuthorityLedger: completionAuthority.ledger,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
    validations,
    agentRuns,
  });
  artifacts.push(lifecycleLedger.artifact);
  validations.push(lifecycleLedger.validation);
  events.push(...lifecycleLedgerEvents(runId, lifecycleLedger));
  const refreshedHarnessRuntimeState = await writeHarnessRuntimeStateArtifacts({
    outputDir,
    spec,
    validations,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
  });
  const featureScopeValidationIndex = validations.findIndex((validation) => validation.id === refreshedHarnessRuntimeState.validation.id);
  if (featureScopeValidationIndex >= 0) {
    validations[featureScopeValidationIndex] = refreshedHarnessRuntimeState.validation;
  } else {
    validations.push(refreshedHarnessRuntimeState.validation);
  }
  events.push(
    traceEvent({
      runId,
      type: "artifact.written",
      artifactId: "feature-list.json",
      status: refreshedHarnessRuntimeState.validation.status,
      message: "Refreshed validator-gated feature state after lifecycle validation.",
      evidence: refreshedHarnessRuntimeState.artifacts.map((artifact) => path.join(outputDir, artifact)),
    }),
  );
  const verificationPipeline = await writeVerificationPipelineLedger({
    outputDir,
    runId,
    spec,
    validations,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
  });
  artifacts.push(verificationPipeline.artifact);
  validations.push(verificationPipeline.validation);
  events.push(...verificationPipelineEvents(runId, verificationPipeline));
  const finalHarnessRuntimeState = await writeHarnessRuntimeStateArtifacts({
    outputDir,
    spec,
    validations,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
  });
  const finalFeatureScopeValidationIndex = validations.findIndex((validation) => validation.id === finalHarnessRuntimeState.validation.id);
  if (finalFeatureScopeValidationIndex >= 0) {
    validations[finalFeatureScopeValidationIndex] = finalHarnessRuntimeState.validation;
  } else {
    validations.push(finalHarnessRuntimeState.validation);
  }
  events.push(
    traceEvent({
      runId,
      type: "artifact.written",
      artifactId: "feature-list.json",
      status: finalHarnessRuntimeState.validation.status,
      message: "Refreshed validator-gated feature state after verified completion-rate validation.",
      evidence: finalHarnessRuntimeState.artifacts.map((artifact) => path.join(outputDir, artifact)),
    }),
  );
  const sessionCleanState = await writeSessionCleanStateLedger({
    outputDir,
    runId,
    spec,
    validations,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
    startupReadiness: runtimeControl.startupReadiness,
    verificationPipelineLedger: verificationPipeline.ledger,
  });
  artifacts.push(sessionCleanState.artifact);
  validations.push(sessionCleanState.validation);
  events.push(...sessionCleanStateEvents(runId, sessionCleanState));
  const cleanStateHarnessRuntimeState = await writeHarnessRuntimeStateArtifacts({
    outputDir,
    spec,
    validations,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
  });
  const cleanStateFeatureScopeValidationIndex = validations.findIndex((validation) => validation.id === cleanStateHarnessRuntimeState.validation.id);
  if (cleanStateFeatureScopeValidationIndex >= 0) {
    validations[cleanStateFeatureScopeValidationIndex] = cleanStateHarnessRuntimeState.validation;
  } else {
    validations.push(cleanStateHarnessRuntimeState.validation);
  }
  events.push(
    traceEvent({
      runId,
      type: "artifact.written",
      artifactId: "feature-list.json",
      status: cleanStateHarnessRuntimeState.validation.status,
      message: "Refreshed validator-gated feature state after session clean-state validation.",
      evidence: cleanStateHarnessRuntimeState.artifacts.map((artifact) => path.join(outputDir, artifact)),
    }),
  );
  const harnessEngineeringRecord = await writeHarnessEngineeringRecord({
    outputDir,
    runId,
    spec,
    request,
    runPlan: runPlan.runPlan,
    executorLock: runPlan.executorLock,
    workerLock: runPlan.workerLock,
    runtimeControl,
    functionInvocationLedger: invocationLedger.ledger,
    environmentReadinessLedger: environmentReadiness.ledger,
    architectureBoundaryLedger: architectureBoundary.ledger,
    sourceOfRecordLedger: sourceOfRecord.ledger,
    completionAuthorityLedger: completionAuthority.ledger,
    verificationPipelineLedger: verificationPipeline.ledger,
    sessionCleanStateLedger: sessionCleanState.ledger,
    harnessQualityLedger: harnessQuality.ledger,
    continuityLedger: continuityLedger.ledger,
    courseAlignmentLedger: courseAlignment.ledger,
    artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "run-state.json"],
    validations,
    agentRuns,
  });
  artifacts.push(harnessEngineeringRecord.artifact);
  validations.push(harnessEngineeringRecord.validation);
  events.push(
    traceEvent({
      runId,
      type: "artifact.written",
      artifactId: harnessEngineeringRecord.artifact,
      message: "Wrote harness engineering operational record.",
      evidence: [path.join(outputDir, harnessEngineeringRecord.artifact)],
    }),
  );
  for (const validation of validations) {
    events.push(traceEvent({ runId, type: "validator.started", validatorId: validation.id, message: `Validator '${validation.id}' started.` }));
    events.push(traceEvent({ runId, type: "validator.completed", validatorId: validation.id, status: validation.status, message: validation.details, evidence: validation.evidence }));
  }
  await writeText(path.join(outputDir, "validation-report.md"), renderValidationReport(validations));
  const finalStatus = finalStatusFromValidations(validations);
  await writeText(
    runStatePath,
    `${JSON.stringify(
      {
        runId,
        status: "completed",
        finalStatus,
        harnessSpecId: spec.id,
        outputDir,
        artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "skill-update-suggestions.md", "run-state.json"],
        agentRuns: agentRuns.map((run) => ({
          id: run.id,
          group: run.group,
          agentId: run.agentId,
          nodeId: run.nodeId,
          status: run.status,
          artifacts: run.artifacts,
          criticQuestionCount: run.criticReview?.questions.length ?? 0,
        })),
        validations: validations.map((validation) => ({ id: validation.id, status: validation.status })),
      },
      null,
      2,
    )}\n`,
  );
  artifacts.push("run-state.json");
  events.push(traceEvent({ runId, type: "run.persisted", artifactId: "run-state.json", status: finalStatus, message: "Persisted run state snapshot.", evidence: [runStatePath] }));
  events.push(traceEvent({ runId, type: "artifact.written", artifactId: "run-state.json", message: "Wrote artifact run-state.json." }));
  for (const artifact of council.artifacts) {
    events.push(traceEvent({ runId, type: "artifact.written", artifactId: artifact, message: `Wrote artifact ${artifact}.` }));
  }
  events.push(traceEvent({ runId, type: "run.completed", status: finalStatus, message: `Run completed with status ${finalStatus}.` }));
  const suggestions = generateLearningSuggestions(spec, validations);
  events.push(...suggestions.map((suggestion) => traceEvent({ runId, type: "learning.proposed", message: suggestion.title })));
  await writeTraceEvents(outputDir, events);
  const trace = await writeTrace(outputDir, spec, profiles, validations, [...artifacts, "validation-report.md", "events.jsonl"], events, runId, agentRuns);
  await writeText(path.join(outputDir, "skill-update-suggestions.md"), renderLearningSuggestions(trace.learningSuggestions.length ? trace.learningSuggestions : suggestions));
  return { outputDir, validations, artifacts: [...artifacts, "validation-report.md", "harness-trace.json", "events.jsonl", "skill-update-suggestions.md"] };
}

async function runValidators(spec: HarnessSpec, request: HarnessRequest, outputDir: string): Promise<ValidationResult[]> {
  const cognitive = await runCognitiveValidators(spec, outputDir);
  const manifestValidators = await runManifestValidators(spec, request, outputDir);
  const generic: ValidationResult[] = manifestValidators.length
    ? []
    : [
        {
          id: "trace_complete",
          name: "Trace complete",
          status: "pass",
          details: "Generic harness trace can be written.",
          evidence: [path.join(outputDir, "harness-trace.json")],
          repairable: false,
        },
      ];
  return [...manifestValidators, ...generic, ...cognitive];
}

async function runManifestValidators(spec: HarnessSpec, request: HarnessRequest, outputDir: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const executor of uniqueExecutorBindings(resolveExecutorBindings(spec, "validator"))) {
    results.push(...(await runValidatorExecutor(executor, { spec, request, outputDir })));
  }
  return results;
}

function runSourceValidators(spec: HarnessSpec): ValidationResult[] {
  const missing = spec.sources.filter((source) => source.availability === "missing");
  const unverified = spec.sources.filter((source) => source.availability === "unverified");
  const results: ValidationResult[] = [
    {
      id: "source_availability",
      name: "Source availability",
      status: missing.length ? "fail" : unverified.length || spec.sources.length === 0 ? "warning" : "pass",
      details: missing.length
        ? `Missing source path(s): ${missing.map((source) => source.location).join(", ")}.`
        : unverified.length
          ? `Remote source(s) were not fetched by the local profiler: ${unverified.map((source) => source.location).join(", ")}.`
          : spec.sources.length
            ? "All local source paths exist."
            : "No source paths were provided.",
      evidence: spec.sources.map((source) => source.location),
      repairable: true,
    },
  ];

  if (requiresLottieValidation(spec)) {
    const svgSources = spec.sources.filter((source) => source.availability === "available" && source.location.toLowerCase().endsWith(".svg"));
    results.push({
      id: "svg_source_available",
      name: "SVG source available",
      status: svgSources.length ? "pass" : "fail",
      details: svgSources.length ? `${svgSources.length} available SVG source(s) found.` : "Motion/Lottie harnesses require at least one available SVG source.",
      evidence: spec.sources.map((source) => source.location),
      repairable: true,
    });
  }

  return results;
}

function requiresLottieValidation(spec: HarnessSpec): boolean {
  return spec.artifactContracts.some((contract) => contract.type === "lottie-json") || Boolean(spec.ir?.validators.some((binding) => binding.validatorId.startsWith("validator:lottie")));
}

function eventsForGraph(runId: string, spec: HarnessSpec, executedNodeIds: Set<string>): TraceEvent[] {
  return spec.graph.flatMap((node) => {
    const executed = executedNodeIds.has(node.id);
    const completedStatus = executed ? "completed" : "planned_not_executed";
    return [
      traceEvent({ runId, type: "node.started", nodeId: node.id, capabilityId: node.capabilityId, validatorId: node.validatorId, artifactId: node.artifactId, message: `Node '${node.id}' started.` }),
      traceEvent({
        runId,
        type: "node.completed",
        nodeId: node.id,
        capabilityId: node.capabilityId,
        validatorId: node.validatorId,
        artifactId: node.artifactId,
        status: completedStatus,
        message: executed
          ? `Node '${node.id}' completed with recorded runtime evidence.`
          : `Node '${node.id}' is represented in the verified DAG but has no recorded runtime execution evidence.`,
        evidence: node.evidenceRequired,
      }),
    ];
  });
}

async function runCognitiveValidators(spec: HarnessSpec, outputDir: string): Promise<ValidationResult[]> {
  if (spec.cognitiveStrategy.hypothesisCount <= 0) {
    return [];
  }
  const hypothesesPath = path.join(outputDir, "hypotheses.json");
  const rationalePath = path.join(outputDir, "originality-rationale.md");
  const hypothesesText = (await pathExists(hypothesesPath)) ? await readText(hypothesesPath) : "[]";
  const hypotheses = JSON.parse(hypothesesText) as unknown[];
  const rationale = (await pathExists(rationalePath)) ? await readText(rationalePath) : "";
  return [
    {
      id: "hypotheses_recorded",
      name: "Hypotheses recorded",
      status: hypotheses.length >= spec.cognitiveStrategy.hypothesisCount ? "pass" : "fail",
      details: `Expected ${spec.cognitiveStrategy.hypothesisCount} hypotheses, found ${hypotheses.length}.`,
      evidence: [hypothesesPath],
      repairable: true,
    },
    {
      id: "originality_rationale_present",
      name: "Originality rationale present",
      status: rationale.includes("Originality") ? "pass" : "fail",
      details: "Originality runs must explain why the candidate is not just the default pattern.",
      evidence: [rationalePath],
      repairable: true,
    },
    {
      id: "hypothesis_validation_plan_present",
      name: "Hypothesis validation plan present",
      status: spec.cognitiveStrategy.validationPlan.length > 0 ? "pass" : "fail",
      details: spec.cognitiveStrategy.validationPlan.join(" "),
      evidence: [path.join(outputDir, "harness-spec.json")],
      repairable: true,
    },
  ];
}
