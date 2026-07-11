import path from "node:path";
import type { HarnessSpec, HarnessSubsystemId, TraceEvent, ValidationResult, ValidatorStatus } from "../types.js";
import { stableId, writeJson } from "../utils/fs.js";
import { traceEvent } from "./trace-ledger.js";

export const COURSE_ALIGNMENT_LEDGER_ARTIFACT = "course-alignment-ledger.json";
export const COURSE_ALIGNMENT_VALIDATION_ID = "course_alignment_confirmed";

type CourseAlignmentStatus = "pass" | "fail" | "warning";
type ArtifactStatus = "present" | "planned" | "missing";
type ObservedValidationStatus = ValidatorStatus | "missing" | "planned";

interface CourseAlignmentLedgerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  artifacts: string[];
  validations: ValidationResult[];
}

interface CourseRequirementSpec {
  id: string;
  lecture: string;
  principle: string;
  subsystem: HarnessSubsystemId;
  sourceUrl: string;
  requiredCurrentArtifacts: string[];
  requiredPlannedArtifacts: string[];
  requiredCurrentValidationIds: string[];
  requiredPlannedValidationIds: string[];
}

interface CourseAlignmentRequirement {
  id: string;
  lecture: string;
  principle: string;
  subsystem: HarnessSubsystemId;
  sourceUrl: string;
  status: CourseAlignmentStatus;
  currentArtifacts: Array<{
    id: string;
    status: ArtifactStatus;
  }>;
  plannedArtifacts: Array<{
    id: string;
    status: ArtifactStatus;
  }>;
  validations: Array<{
    id: string;
    status: ObservedValidationStatus;
    evidence: string[];
  }>;
  plannedValidations: Array<{
    id: string;
    status: ObservedValidationStatus;
  }>;
  missingCurrentArtifacts: string[];
  missingPlannedArtifacts: string[];
  failedValidationIds: string[];
  warningValidationIds: string[];
  missingValidationIds: string[];
}

interface CourseAlignmentCheck {
  id: string;
  status: CourseAlignmentStatus;
  details: string;
  evidence: string[];
}

export interface CourseAlignmentLedgerResult {
  artifact: string;
  ledger: CourseAlignmentLedger;
  validation: ValidationResult;
}

export interface CourseAlignmentLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: CourseAlignmentStatus;
  score: number;
  rule: string;
  course: {
    name: "Learn Harness Engineering";
    homepage: string;
    sourceCount: number;
  };
  summary: {
    requirementCount: number;
    passingRequirementCount: number;
    warningRequirementCount: number;
    failedRequirementCount: number;
    subsystemCount: number;
    coveredSubsystemCount: number;
    currentArtifactCount: number;
    missingCurrentArtifactCount: number;
    plannedArtifactCount: number;
    missingPlannedArtifactCount: number;
    validationCount: number;
    failedValidationCount: number;
    warningValidationCount: number;
    missingValidationCount: number;
    unresolvedCount: number;
  };
  subsystemCoverage: Array<{
    id: HarnessSubsystemId;
    requirementCount: number;
    modelPresent: boolean;
    status: CourseAlignmentStatus;
  }>;
  requirements: CourseAlignmentRequirement[];
  checks: CourseAlignmentCheck[];
  unresolved: Array<{
    id: string;
    status: "fail" | "warning";
    reason: string;
    evidence: string[];
  }>;
}

const COURSE_HOMEPAGE = "https://walkinglabs.github.io/learn-harness-engineering/en/";
const COURSE_SOURCE_COUNT = 12;

export async function writeCourseAlignmentLedger(input: CourseAlignmentLedgerInput): Promise<CourseAlignmentLedgerResult> {
  const ledger = buildCourseAlignmentLedger(input);
  const target = path.join(input.outputDir, COURSE_ALIGNMENT_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: COURSE_ALIGNMENT_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: COURSE_ALIGNMENT_VALIDATION_ID,
      name: "Course alignment confirmed",
      status: ledger.status,
      details: validationDetails(ledger),
      evidence: [target],
      repairable: true,
    },
  };
}

export function courseAlignmentLedgerEvents(runId: string, result: CourseAlignmentLedgerResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.course_alignment.recorded",
      artifactId: COURSE_ALIGNMENT_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Recorded Learn Harness Engineering alignment: ${result.ledger.summary.passingRequirementCount}/${result.ledger.summary.requirementCount} requirement(s) passing, score ${result.ledger.score}.`,
      evidence: [COURSE_ALIGNMENT_LEDGER_ARTIFACT],
    }),
  ];
}

function buildCourseAlignmentLedger(input: CourseAlignmentLedgerInput): CourseAlignmentLedger {
  const currentArtifacts = new Set([...input.artifacts, COURSE_ALIGNMENT_LEDGER_ARTIFACT]);
  const plannedArtifacts = plannedArtifactSet(input.spec, currentArtifacts);
  const validationsById = new Map(input.validations.map((validation) => [validation.id, validation]));
  const plannedValidations = new Set(input.spec.harnessModel.verificationHierarchy.flatMap((level) => level.validatorIds));
  const requirements = courseRequirements().map((requirement) => materializeRequirement(requirement, currentArtifacts, plannedArtifacts, validationsById, plannedValidations));
  const subsystemCoverage = buildSubsystemCoverage(input.spec, requirements);
  const checks = buildChecks(requirements, subsystemCoverage);
  const unresolved = checks.flatMap((check) =>
    check.status === "pass"
      ? []
      : [
          {
            id: check.id,
            status: check.status,
            reason: check.details,
            evidence: check.evidence,
          },
        ],
  );
  const status = checks.some((check) => check.status === "fail") ? "fail" : checks.some((check) => check.status === "warning") ? "warning" : "pass";
  const score = alignmentScore(requirements, checks);
  const allCurrentArtifacts = unique(requirements.flatMap((requirement) => requirement.currentArtifacts.map((artifact) => artifact.id)));
  const allPlannedArtifacts = unique(requirements.flatMap((requirement) => requirement.plannedArtifacts.map((artifact) => artifact.id)));
  const allValidations = requirements.flatMap((requirement) => requirement.validations);
  return {
    schemaVersion: 1,
    id: stableId("course-alignment-ledger", `${input.runId}:${requirements.map((requirement) => `${requirement.id}:${requirement.status}`).join("|")}:${score}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    score,
    rule: "Every dynamic harness run must map Learn Harness Engineering principles to concrete artifacts, validators, subsystem coverage, and planned clean-handoff gates before claiming the architecture is aligned with the course.",
    course: {
      name: "Learn Harness Engineering",
      homepage: COURSE_HOMEPAGE,
      sourceCount: COURSE_SOURCE_COUNT,
    },
    summary: {
      requirementCount: requirements.length,
      passingRequirementCount: requirements.filter((requirement) => requirement.status === "pass").length,
      warningRequirementCount: requirements.filter((requirement) => requirement.status === "warning").length,
      failedRequirementCount: requirements.filter((requirement) => requirement.status === "fail").length,
      subsystemCount: subsystemCoverage.length,
      coveredSubsystemCount: subsystemCoverage.filter((coverage) => coverage.status === "pass").length,
      currentArtifactCount: allCurrentArtifacts.length,
      missingCurrentArtifactCount: requirements.reduce((total, requirement) => total + requirement.missingCurrentArtifacts.length, 0),
      plannedArtifactCount: allPlannedArtifacts.length,
      missingPlannedArtifactCount: requirements.reduce((total, requirement) => total + requirement.missingPlannedArtifacts.length, 0),
      validationCount: allValidations.length,
      failedValidationCount: requirements.reduce((total, requirement) => total + requirement.failedValidationIds.length, 0),
      warningValidationCount: requirements.reduce((total, requirement) => total + requirement.warningValidationIds.length, 0),
      missingValidationCount: requirements.reduce((total, requirement) => total + requirement.missingValidationIds.length, 0),
      unresolvedCount: unresolved.length,
    },
    subsystemCoverage,
    requirements,
    checks,
    unresolved,
  };
}

function materializeRequirement(
  requirement: CourseRequirementSpec,
  currentArtifacts: Set<string>,
  plannedArtifacts: Set<string>,
  validationsById: Map<string, ValidationResult>,
  plannedValidations: Set<string>,
): CourseAlignmentRequirement {
  const currentArtifactResults = requirement.requiredCurrentArtifacts.map((artifact) => ({
    id: artifact,
    status: currentArtifacts.has(artifact) ? ("present" as const) : ("missing" as const),
  }));
  const plannedArtifactResults = requirement.requiredPlannedArtifacts.map((artifact) => ({
    id: artifact,
    status: currentArtifacts.has(artifact) ? ("present" as const) : plannedArtifacts.has(artifact) ? ("planned" as const) : ("missing" as const),
  }));
  const validationResults = requirement.requiredCurrentValidationIds.map((id) => {
    const validation = validationsById.get(id);
    return {
      id,
      status: validation?.status ?? ("missing" as const),
      evidence: validation?.evidence ?? [],
    };
  });
  const plannedValidationResults = requirement.requiredPlannedValidationIds.map((id) => ({
    id,
    status: validationsById.has(id) ? (validationsById.get(id)?.status ?? "missing") : plannedValidations.has(id) ? ("planned" as const) : ("missing" as const),
  }));
  const missingCurrentArtifacts = currentArtifactResults.filter((artifact) => artifact.status === "missing").map((artifact) => artifact.id);
  const missingPlannedArtifacts = plannedArtifactResults.filter((artifact) => artifact.status === "missing").map((artifact) => artifact.id);
  const failedValidationIds = validationResults.filter((validation) => validation.status === "fail").map((validation) => validation.id);
  const warningValidationIds = validationResults.filter((validation) => validation.status === "warning" || validation.status === "skipped").map((validation) => validation.id);
  const missingValidationIds = [
    ...validationResults.filter((validation) => validation.status === "missing").map((validation) => validation.id),
    ...plannedValidationResults.filter((validation) => validation.status === "missing").map((validation) => validation.id),
  ];
  const status =
    missingCurrentArtifacts.length || missingPlannedArtifacts.length || failedValidationIds.length || missingValidationIds.length
      ? "fail"
      : warningValidationIds.length
        ? "warning"
        : "pass";
  return {
    ...requirement,
    status,
    currentArtifacts: currentArtifactResults,
    plannedArtifacts: plannedArtifactResults,
    validations: validationResults,
    plannedValidations: plannedValidationResults,
    missingCurrentArtifacts,
    missingPlannedArtifacts,
    failedValidationIds,
    warningValidationIds,
    missingValidationIds,
  };
}

function buildSubsystemCoverage(spec: HarnessSpec, requirements: CourseAlignmentRequirement[]): CourseAlignmentLedger["subsystemCoverage"] {
  const modelSubsystems = new Set(spec.harnessModel.subsystems.map((subsystem) => subsystem.id));
  const subsystemIds: HarnessSubsystemId[] = ["instructions", "tools", "environment", "state", "feedback"];
  return subsystemIds.map((id) => {
    const requirementCount = requirements.filter((requirement) => requirement.subsystem === id).length;
    const modelPresent = modelSubsystems.has(id);
    return {
      id,
      requirementCount,
      modelPresent,
      status: modelPresent && requirementCount > 0 ? "pass" : "fail",
    };
  });
}

function buildChecks(requirements: CourseAlignmentRequirement[], subsystemCoverage: CourseAlignmentLedger["subsystemCoverage"]): CourseAlignmentCheck[] {
  const failedRequirements = requirements.filter((requirement) => requirement.status === "fail");
  const warningRequirements = requirements.filter((requirement) => requirement.status === "warning");
  const missingCurrentArtifacts = unique(requirements.flatMap((requirement) => requirement.missingCurrentArtifacts));
  const missingPlannedArtifacts = unique(requirements.flatMap((requirement) => requirement.missingPlannedArtifacts));
  const failedValidationIds = unique(requirements.flatMap((requirement) => requirement.failedValidationIds));
  const warningValidationIds = unique(requirements.flatMap((requirement) => requirement.warningValidationIds));
  const missingValidationIds = unique(requirements.flatMap((requirement) => requirement.missingValidationIds));
  const uncoveredSubsystems = subsystemCoverage.filter((coverage) => coverage.status !== "pass");
  return [
    {
      id: "course-requirements-covered",
      status: requirements.length === COURSE_SOURCE_COUNT && requirements.every((requirement) => requirement.sourceUrl && requirement.principle) ? "pass" : "fail",
      details: `${requirements.length}/${COURSE_SOURCE_COUNT} course requirement mapping(s) are represented with source URLs and principles.`,
      evidence: requirements.map((requirement) => requirement.sourceUrl),
    },
    {
      id: "five-subsystems-covered",
      status: uncoveredSubsystems.length ? "fail" : "pass",
      details: uncoveredSubsystems.length ? `Missing subsystem coverage: ${uncoveredSubsystems.map((coverage) => coverage.id).join(", ")}.` : "Instructions, tools, environment, state, and feedback all have course-alignment requirements and model subsystem entries.",
      evidence: subsystemCoverage.map((coverage) => coverage.id),
    },
    {
      id: "current-course-evidence-present",
      status: missingCurrentArtifacts.length ? "fail" : "pass",
      details: missingCurrentArtifacts.length ? `Missing current course-alignment artifact(s): ${missingCurrentArtifacts.join(", ")}.` : "All current course-alignment artifacts are present at alignment time.",
      evidence: unique(requirements.flatMap((requirement) => requirement.currentArtifacts.map((artifact) => artifact.id))),
    },
    {
      id: "planned-course-gates-present",
      status: missingPlannedArtifacts.length || missingValidationIds.length ? "fail" : "pass",
      details:
        missingPlannedArtifacts.length || missingValidationIds.length
          ? `Missing planned artifact(s): ${missingPlannedArtifacts.join(", ") || "none"}; missing validation(s): ${missingValidationIds.join(", ") || "none"}.`
          : "Downstream lifecycle, VCR, trace, run-state, and clean-state gates are planned in the harness model.",
      evidence: unique([...requirements.flatMap((requirement) => requirement.plannedArtifacts.map((artifact) => artifact.id)), ...requirements.flatMap((requirement) => requirement.plannedValidations.map((validation) => validation.id))]),
    },
    {
      id: "course-validation-posture-clean",
      status: failedValidationIds.length || failedRequirements.length ? "fail" : warningValidationIds.length || warningRequirements.length ? "warning" : "pass",
      details:
        failedValidationIds.length || failedRequirements.length
          ? `Failed course-alignment validation(s): ${failedValidationIds.join(", ") || "requirement status failure"}.`
          : warningValidationIds.length || warningRequirements.length
            ? `Warning course-alignment validation(s): ${warningValidationIds.join(", ") || "requirement warning"}.`
            : "All current course-alignment validations are passing.",
      evidence: unique(requirements.flatMap((requirement) => requirement.validations.flatMap((validation) => validation.evidence.length ? validation.evidence : [validation.id]))),
    },
  ];
}

function courseRequirements(): CourseRequirementSpec[] {
  return [
    {
      id: "L01-diagnostic-loop",
      lecture: "Lecture 01: Why Capable Agents Still Fail",
      principle: "Failures must be attributed to harness layers and converted into an explicit definition of done.",
      subsystem: "feedback",
      sourceUrl: `${COURSE_HOMEPAGE}lectures/lecture-01-why-capable-agents-still-fail/`,
      requiredCurrentArtifacts: ["harness-diagnostic-ledger.json", "repair-guidance-ledger.json", "validation-report.md"],
      requiredPlannedArtifacts: [],
      requiredCurrentValidationIds: ["diagnostic_loop_recorded", "repair_guidance_recorded"],
      requiredPlannedValidationIds: [],
    },
    {
      id: "L02-five-subsystems",
      lecture: "Lecture 02: What a Harness Actually Is",
      principle: "The harness must cover instructions, tools, environment, state, and feedback, and measure subsystem value instead of assuming it.",
      subsystem: "feedback",
      sourceUrl: `${COURSE_HOMEPAGE}lectures/lecture-02-what-a-harness-actually-is/`,
      requiredCurrentArtifacts: ["harness-subsystem-audit.json", "harness-ablation-comparison.json", "quality-document.json", "quality-document.md", "harness-quality-ledger.json"],
      requiredPlannedArtifacts: [],
      requiredCurrentValidationIds: ["harness_subsystem_audit_recorded", "harness_ablation_comparison_recorded", "quality_document_recorded", "harness_quality_documented"],
      requiredPlannedValidationIds: [],
    },
    {
      id: "L03-system-of-record",
      lecture: "Lecture 03: Making the Repository the Single Source of Truth",
      principle: "Repository and run artifacts must answer fresh-session questions and preserve durable state.",
      subsystem: "environment",
      sourceUrl: `${COURSE_HOMEPAGE}lectures/lecture-03-why-the-repository-must-become-the-system-of-record/`,
      requiredCurrentArtifacts: ["environment-readiness-ledger.json", "source-of-record-ledger.json", "feature-list.json", "progress.md", "session-handoff.md"],
      requiredPlannedArtifacts: [],
      requiredCurrentValidationIds: ["environment_readiness_confirmed", "source_of_record_confirmed"],
      requiredPlannedValidationIds: [],
    },
    {
      id: "L04-instruction-routing",
      lecture: "Lecture 04: Split Instructions Across Files",
      principle: "Entry instructions stay compact and reveal applicable topic guidance on demand.",
      subsystem: "instructions",
      sourceUrl: `${COURSE_HOMEPAGE}lectures/lecture-04-why-one-giant-instruction-file-fails/`,
      requiredCurrentArtifacts: ["instruction-routing-ledger.json", "context-budget-ledger.json", "sprint-contract.json"],
      requiredPlannedArtifacts: [],
      requiredCurrentValidationIds: ["instruction_router_resolved", "context_budget_ready"],
      requiredPlannedValidationIds: [],
    },
    {
      id: "L05-continuity",
      lecture: "Lecture 05: Keeping Context Alive Across Sessions",
      principle: "Long-running tasks persist decisions, verification state, next actions, and rebuild-cost evidence outside chat history.",
      subsystem: "state",
      sourceUrl: `${COURSE_HOMEPAGE}lectures/lecture-05-why-long-running-tasks-lose-continuity/`,
      requiredCurrentArtifacts: ["continuity-ledger.json", "progress.md", "session-handoff.md"],
      requiredPlannedArtifacts: [],
      requiredCurrentValidationIds: ["continuity_state_recorded"],
      requiredPlannedValidationIds: [],
    },
    {
      id: "L06-initialization",
      lecture: "Lecture 06: Make the Agent Initialize Before Every Work Session",
      principle: "Initialization is a distinct phase that proves start, test, progress visibility, and next scoped work before implementation.",
      subsystem: "state",
      sourceUrl: `${COURSE_HOMEPAGE}lectures/lecture-06-why-initialization-needs-its-own-phase/`,
      requiredCurrentArtifacts: ["initialization-checklist.json", "startup-readiness.json", "feature-scheduler.json"],
      requiredPlannedArtifacts: [],
      requiredCurrentValidationIds: ["initialization_checklist_confirmed", "startup_readiness_confirmed", "feature_scheduler_ready"],
      requiredPlannedValidationIds: [],
    },
    {
      id: "L07-scope-control",
      lecture: "Lecture 07: Draw Clear Task Boundaries for Agents",
      principle: "WIP=1 scope control and completion evidence prevent overreach and under-finish.",
      subsystem: "state",
      sourceUrl: `${COURSE_HOMEPAGE}lectures/lecture-07-why-agents-overreach-and-under-finish/`,
      requiredCurrentArtifacts: ["feature-scheduler.json", "feature-list.json", "sprint-contract.json"],
      requiredPlannedArtifacts: [],
      requiredCurrentValidationIds: ["feature_scheduler_ready"],
      requiredPlannedValidationIds: ["feature_scope_state_gated"],
    },
    {
      id: "L08-feature-list-primitive",
      lecture: "Lecture 08: Use Feature Lists to Constrain What the Agent Does",
      principle: "Feature state must be a machine-readable primitive with behavior, verification, state, and evidence.",
      subsystem: "state",
      sourceUrl: `${COURSE_HOMEPAGE}lectures/lecture-08-why-feature-lists-are-harness-primitives/`,
      requiredCurrentArtifacts: ["feature-list.json", "verification-hierarchy.json", "progress.md"],
      requiredPlannedArtifacts: [],
      requiredCurrentValidationIds: [],
      requiredPlannedValidationIds: ["feature_scope_state_gated", "verified_completion_rate_passed"],
    },
    {
      id: "L09-independent-completion",
      lecture: "Lecture 09: Preventing Agents from Declaring Victory Too Early",
      principle: "Completion judgment is externalized through role separation and independent authority gates.",
      subsystem: "feedback",
      sourceUrl: `${COURSE_HOMEPAGE}lectures/lecture-09-why-agents-declare-victory-too-early/`,
      requiredCurrentArtifacts: ["evaluator-rubric.json", "evaluator-rubric.md", "completion-authority-ledger.json", "council-review.json", "function-invocation-ledger.json"],
      requiredPlannedArtifacts: ["verification-pipeline-ledger.json"],
      requiredCurrentValidationIds: ["evaluator_rubric_recorded", "completion_authority_confirmed", "council_review_complete", "blocker_questions_resolved", "function_invocation_ledger_completed"],
      requiredPlannedValidationIds: ["verified_completion_rate_passed"],
    },
    {
      id: "L10-full-pipeline",
      lecture: "Lecture 10: Only a Full Pipeline Run Counts as Real Verification",
      principle: "System completion requires full-pipeline evidence, executable architecture boundaries, and agent-oriented feedback.",
      subsystem: "feedback",
      sourceUrl: `${COURSE_HOMEPAGE}lectures/lecture-10-why-end-to-end-testing-changes-results/`,
      requiredCurrentArtifacts: ["architecture-boundary-ledger.json", "function-invocation-ledger.json", "repair-guidance-ledger.json"],
      requiredPlannedArtifacts: ["verification-pipeline-ledger.json"],
      requiredCurrentValidationIds: ["architecture_boundary_rules_enforced", "function_invocation_ledger_completed", "repair_guidance_recorded"],
      requiredPlannedValidationIds: ["verified_completion_rate_passed"],
    },
    {
      id: "L11-observability",
      lecture: "Lecture 11: Making the Agent's Runtime Observable",
      principle: "Runtime signals and process artifacts must explain both what happened and why it should be accepted.",
      subsystem: "tools",
      sourceUrl: `${COURSE_HOMEPAGE}lectures/lecture-11-why-observability-belongs-inside-the-harness/`,
      requiredCurrentArtifacts: ["trace-context.json", "function-invocation-ledger.json", "runtime-bus.json", "sprint-contract.json", "evaluator-rubric.json"],
      requiredPlannedArtifacts: ["events.jsonl", "harness-trace.json"],
      requiredCurrentValidationIds: ["trace_context_propagated", "function_invocation_ledger_completed", "runtime_bus_resolved", "hook_ledger_recorded", "evaluator_rubric_recorded"],
      requiredPlannedValidationIds: [],
    },
    {
      id: "L12-clean-state",
      lecture: "Lecture 12: Leave a Clean Handoff at the End of Every Session",
      principle: "Completion requires clean state: build/test posture, progress, no stale artifacts, startup path, quality document, and idempotent handoff.",
      subsystem: "state",
      sourceUrl: `${COURSE_HOMEPAGE}lectures/lecture-12-why-every-session-must-leave-a-clean-state/`,
      requiredCurrentArtifacts: ["quality-document.json", "quality-document.md", "harness-quality-ledger.json", "continuity-ledger.json", "progress.md", "session-handoff.md"],
      requiredPlannedArtifacts: ["lifecycle-ledger.json", "verification-pipeline-ledger.json", "session-clean-state-ledger.json", "run-state.json", "validation-report.md"],
      requiredCurrentValidationIds: ["quality_document_recorded", "harness_quality_documented", "continuity_state_recorded"],
      requiredPlannedValidationIds: ["lifecycle_ledger_clean", "verified_completion_rate_passed", "session_clean_state_ready", "run_state_persisted"],
    },
  ];
}

function plannedArtifactSet(spec: HarnessSpec, currentArtifacts: Set<string>): Set<string> {
  return new Set([
    ...currentArtifacts,
    ...spec.harnessModel.subsystems.flatMap((subsystem) => subsystem.plannedArtifacts),
    ...spec.harnessModel.lifecycle.handoffArtifacts,
    "validation-report.md",
    "harness-trace.json",
    "events.jsonl",
    "run-state.json",
    "skill-update-suggestions.md",
    COURSE_ALIGNMENT_LEDGER_ARTIFACT,
  ]);
}

function alignmentScore(requirements: CourseAlignmentRequirement[], checks: CourseAlignmentCheck[]): number {
  const requirementPenalty = requirements.reduce((total, requirement) => total + (requirement.status === "fail" ? 8 : requirement.status === "warning" ? 4 : 0), 0);
  const checkPenalty = checks.reduce((total, check) => total + (check.status === "fail" ? 10 : check.status === "warning" ? 5 : 0), 0);
  return Math.max(0, 100 - requirementPenalty - checkPenalty);
}

function validationDetails(ledger: CourseAlignmentLedger): string {
  if (ledger.status === "pass") {
    return `Course alignment confirmed with ${ledger.summary.passingRequirementCount}/${ledger.summary.requirementCount} passing requirement(s) and score ${ledger.score}.`;
  }
  return `Course alignment ${ledger.status}: ${ledger.summary.failedRequirementCount} failed, ${ledger.summary.warningRequirementCount} warning requirement(s); inspect course-alignment-ledger.json.`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
