import path from "node:path";
import type { HarnessRequest, HarnessSpec, SourceRef, SystemProfile, TraceEvent, ValidationResult, ValidatorStatus } from "../types.js";
import { pathExists, readJson, stableId, writeJson } from "../utils/fs.js";
import { traceEvent } from "./trace-ledger.js";

export const SOURCE_OF_RECORD_LEDGER_ARTIFACT = "source-of-record-ledger.json";
export const SOURCE_OF_RECORD_VALIDATION_ID = "source_of_record_confirmed";

type SourceOfRecordStatus = "pass" | "fail" | "warning";

interface SourceOfRecordLedgerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  request: HarnessRequest;
  profiles: SystemProfile[];
  artifacts: string[];
  validations: ValidationResult[];
}

export interface SourceOfRecordLedgerResult {
  artifact: string;
  ledger: SourceOfRecordLedger;
  validation: ValidationResult;
}

export interface SourceOfRecordLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: SourceOfRecordStatus;
  rule: string;
  summary: {
    questionCount: number;
    answeredQuestionCount: number;
    checkCount: number;
    passedCheckCount: number;
    warningCheckCount: number;
    failedCheckCount: number;
    authoritativeSourceCount: number;
    unavailableSourceCount: number;
    staleProfileCount: number;
    unresolvedCount: number;
  };
  freshSessionAnswers: FreshSessionAnswer[];
  sourceAuthority: {
    sources: SourceAuthorityEntry[];
    trustOrder: string[];
  };
  stateDiscipline: AcidStateDiscipline[];
  checks: SourceOfRecordCheck[];
  unresolved: Array<{
    id: string;
    status: "fail" | "warning";
    reason: string;
    evidence: string[];
  }>;
}

interface FreshSessionAnswer {
  id: "system-identity" | "organization" | "run-command" | "verification" | "progress";
  question: string;
  status: SourceOfRecordStatus;
  answer: string;
  evidence: string[];
}

interface SourceAuthorityEntry {
  id: string;
  location: string;
  type: SourceRef["type"];
  trust: SourceRef["trust"];
  availability: SourceRef["availability"];
  lastSyncedAt?: string;
  notes: string[];
}

interface AcidStateDiscipline {
  id: "atomicity" | "consistency" | "isolation" | "durability";
  status: SourceOfRecordStatus;
  details: string;
  evidence: string[];
}

interface SourceOfRecordCheck {
  id: string;
  status: SourceOfRecordStatus;
  details: string;
  evidence: string[];
}

interface InitializationChecklist {
  commands?: {
    install?: string;
    build?: string;
    test?: string;
    appWorkflowEval?: string;
  };
}

export async function writeSourceOfRecordLedger(input: SourceOfRecordLedgerInput): Promise<SourceOfRecordLedgerResult> {
  const ledger = await buildSourceOfRecordLedger(input);
  const target = path.join(input.outputDir, SOURCE_OF_RECORD_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: SOURCE_OF_RECORD_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: SOURCE_OF_RECORD_VALIDATION_ID,
      name: "Source of record confirmed",
      status: ledger.status,
      details: validationDetails(ledger),
      evidence: [target],
      repairable: true,
    },
  };
}

export function sourceOfRecordEvents(runId: string, result: SourceOfRecordLedgerResult): TraceEvent[] {
  return [
    traceEvent({
      runId,
      type: "runtime.source_of_record.recorded",
      artifactId: SOURCE_OF_RECORD_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Recorded ${result.ledger.freshSessionAnswers.length} source-of-record answer(s) with status ${result.ledger.status}.`,
      evidence: [SOURCE_OF_RECORD_LEDGER_ARTIFACT],
    }),
  ];
}

async function buildSourceOfRecordLedger(input: SourceOfRecordLedgerInput): Promise<SourceOfRecordLedger> {
  const artifacts = new Set(input.artifacts);
  const validationsById = new Map(input.validations.map((validation) => [validation.id, validation]));
  const initializationChecklist = await readInitializationChecklist(input.outputDir);
  const freshSessionAnswers = buildFreshSessionAnswers(input, artifacts, validationsById, initializationChecklist);
  const sourceAuthority = buildSourceAuthority(input.spec.sources);
  const stateDiscipline = buildStateDiscipline(input, artifacts, validationsById);
  const checks: SourceOfRecordCheck[] = [
    ...freshSessionAnswers.map((answer) => ({
      id: `fresh-session-${answer.id}`,
      status: answer.status,
      details: answer.answer,
      evidence: answer.evidence,
    })),
    buildSourceAuthorityCheck(input.spec.sources, sourceAuthority.sources),
    buildKnowledgeDecayCheck(input.profiles),
    buildAcidDisciplineCheck(stateDiscipline),
  ];
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
  return {
    schemaVersion: 1,
    id: stableId("source-of-record-ledger", `${input.runId}:${checks.map((check) => `${check.id}:${check.status}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    rule: "The repository and run output are the system of record only when a fresh session can answer what the system is, how it is organized, how to run it, how to verify it, what progress is current, which sources are authoritative, whether knowledge may be stale, and whether state discipline is durable.",
    summary: {
      questionCount: freshSessionAnswers.length,
      answeredQuestionCount: freshSessionAnswers.filter((answer) => answer.status === "pass").length,
      checkCount: checks.length,
      passedCheckCount: checks.filter((check) => check.status === "pass").length,
      warningCheckCount: checks.filter((check) => check.status === "warning").length,
      failedCheckCount: checks.filter((check) => check.status === "fail").length,
      authoritativeSourceCount: sourceAuthority.sources.filter((source) => source.availability === "available").length,
      unavailableSourceCount: sourceAuthority.sources.filter((source) => source.availability !== "available").length,
      staleProfileCount: input.profiles.filter((profile) => profile.freshness.stale).length,
      unresolvedCount: unresolved.length,
    },
    freshSessionAnswers,
    sourceAuthority,
    stateDiscipline,
    checks,
    unresolved,
  };
}

function buildFreshSessionAnswers(
  input: SourceOfRecordLedgerInput,
  artifacts: Set<string>,
  validationsById: Map<string, ValidationResult>,
  initializationChecklist: InitializationChecklist | null,
): FreshSessionAnswer[] {
  const sourceStatus = validationsById.get("source_availability")?.status;
  return [
    {
      id: "system-identity",
      question: "What is this system?",
      status: allPresent(artifacts, ["harness-spec.json", "sprint-contract.json"]) && input.spec.name && input.spec.userIntent ? sourceAwareStatus(sourceStatus) : "fail",
      answer: `${input.spec.name} (${input.spec.archetype}) for intent: ${input.request.intent}.`,
      evidence: ["harness-spec.json", "sprint-contract.json", "system-profiles.json"],
    },
    {
      id: "organization",
      question: "How is it organized?",
      status: allPresent(artifacts, ["harness-ir.json", "run-plan.json", "environment-readiness-ledger.json", "worker-function-registry.json", "tool-safety-ledger.json", "context-budget-ledger.json", "function-dispatch-plan.json", "runtime-bus.json"]) ? "pass" : "fail",
      answer: `The compiled IR, run plan, environment readiness ledger, worker registry, tool-safety ledger, context-budget ledger, dispatch plan, and runtime bus describe ${input.spec.graph.length} workflow node(s) and ${input.spec.harnessModel.subsystems.length} harness subsystem(s).`,
      evidence: ["harness-ir.json", "run-plan.json", "environment-readiness-ledger.json", "worker-function-registry.json", "tool-safety-ledger.json", "context-budget-ledger.json", "function-dispatch-plan.json", "runtime-bus.json"],
    },
    {
      id: "run-command",
      question: "How do I run it?",
      status: initializationChecklist?.commands?.build && initializationChecklist.commands.test ? "pass" : "fail",
      answer: initializationChecklist?.commands?.build && initializationChecklist.commands.test ? `Run ${initializationChecklist.commands.build} and ${initializationChecklist.commands.test}; install with ${initializationChecklist.commands.install ?? "npm install"}.` : "Build and test commands are not recorded in initialization-checklist.json.",
      evidence: ["initialization-checklist.json", "package.json"],
    },
    {
      id: "verification",
      question: "How do I verify it?",
      status: allPresent(artifacts, ["verification-hierarchy.json", "council-review.json"]) ? "pass" : "fail",
      answer: `Use verification-hierarchy.json and validation-report.md; ${input.spec.harnessModel.verificationHierarchy.length} required layer(s) are compiled into the run.`,
      evidence: ["verification-hierarchy.json", "validation-report.md", "council-review.json", "feature-list.json"],
    },
    {
      id: "progress",
      question: "What is the current progress?",
      status: allPresent(artifacts, ["feature-list.json", "progress.md", "session-handoff.md"]) ? "pass" : "fail",
      answer: "Feature-list, progress, session handoff, and run-state artifacts identify current scope, validation signals, and next action without chat history.",
      evidence: ["feature-list.json", "progress.md", "session-handoff.md", "run-state.json"],
    },
  ];
}

function buildSourceAuthority(sources: SourceRef[]): SourceOfRecordLedger["sourceAuthority"] {
  const authoritySources = sources.map((source) => ({
    id: source.id,
    location: source.location,
    type: source.type,
    trust: source.trust,
    availability: source.availability,
    lastSyncedAt: source.lastSyncedAt,
    notes: source.notes ?? [],
  }));
  return {
    sources: authoritySources,
    trustOrder: authoritySources
      .slice()
      .sort((left, right) => trustRank(left.trust) - trustRank(right.trust))
      .map((source) => source.id),
  };
}

function buildStateDiscipline(input: SourceOfRecordLedgerInput, artifacts: Set<string>, validationsById: Map<string, ValidationResult>): AcidStateDiscipline[] {
  return [
    {
      id: "atomicity",
      status: allPresent(artifacts, ["run-plan.json", "feature-scheduler.json"]) ? "pass" : "fail",
      details: "The run has a locked plan and a scheduler-owned WIP=1 activation boundary.",
      evidence: ["run-plan.json", "feature-scheduler.json"],
    },
    {
      id: "consistency",
      status: validationStatusGate(validationsById, ["initialization_checklist_confirmed", "feature_scheduler_ready"], true),
      details: "Initialization and scheduling validations keep source-of-record state consistent before final feature-state validation runs.",
      evidence: ["initialization-checklist.json", "feature-scheduler.json", "feature-list.json", "verification-hierarchy.json"],
    },
    {
      id: "isolation",
      status: input.runId && input.outputDir && allPresent(artifacts, ["trace-context.json", "runtime-bus.json"]) ? "pass" : "fail",
      details: `Run ${input.runId} writes to an isolated output directory with explicit trace context and runtime bus state namespaces.`,
      evidence: ["trace-context.json", "runtime-bus.json", input.outputDir],
    },
    {
      id: "durability",
      status: allPresent(artifacts, ["progress.md", "session-handoff.md"]) && artifacts.has("run-state.json") ? "pass" : "fail",
      details: "Progress, handoff, and run-state artifacts are declared for restartable durability.",
      evidence: ["progress.md", "session-handoff.md", "run-state.json"],
    },
  ];
}

function buildSourceAuthorityCheck(sources: SourceRef[], authoritySources: SourceAuthorityEntry[]): SourceOfRecordCheck {
  const missing = authoritySources.filter((source) => source.availability === "missing");
  const unverified = authoritySources.filter((source) => source.availability === "unverified");
  const status = missing.length ? "fail" : unverified.length || !sources.length ? "warning" : "pass";
  return {
    id: "source-authority-ranked",
    status,
    details: missing.length
      ? `Missing authoritative source(s): ${missing.map((source) => source.location).join(", ")}.`
      : unverified.length
        ? `Unverified source(s) are recorded but cannot be treated as fully authoritative: ${unverified.map((source) => source.location).join(", ")}.`
        : sources.length
          ? `${sources.length} source ref(s) are ranked by trust and availability.`
          : "No source refs were provided; source authority is assumption-based.",
    evidence: sources.map((source) => source.location),
  };
}

function buildKnowledgeDecayCheck(profiles: SystemProfile[]): SourceOfRecordCheck {
  const missingFreshness = profiles.filter((profile) => !profile.freshness?.profiledAt || typeof profile.freshness.stale !== "boolean");
  const stale = profiles.filter((profile) => profile.freshness.stale);
  return {
    id: "knowledge-decay-visible",
    status: missingFreshness.length ? "fail" : stale.length ? "warning" : "pass",
    details: missingFreshness.length
      ? `Profile(s) missing freshness metadata: ${missingFreshness.map((profile) => profile.id).join(", ")}.`
      : stale.length
        ? `Stale profile(s) are visible: ${stale.map((profile) => profile.id).join(", ")}.`
        : `${profiles.length} system profile(s) expose profiledAt and stale metadata.`,
    evidence: ["system-profiles.json"],
  };
}

function buildAcidDisciplineCheck(stateDiscipline: AcidStateDiscipline[]): SourceOfRecordCheck {
  const failed = stateDiscipline.filter((item) => item.status === "fail");
  const warnings = stateDiscipline.filter((item) => item.status === "warning");
  return {
    id: "acid-state-discipline",
    status: failed.length ? "fail" : warnings.length ? "warning" : "pass",
    details: failed.length
      ? `State discipline failed: ${failed.map((item) => item.id).join(", ")}.`
      : warnings.length
        ? `State discipline has warning(s): ${warnings.map((item) => item.id).join(", ")}.`
        : "Atomicity, consistency, isolation, and durability evidence are all present.",
    evidence: unique(stateDiscipline.flatMap((item) => item.evidence)),
  };
}

async function readInitializationChecklist(outputDir: string): Promise<InitializationChecklist | null> {
  const target = path.join(outputDir, "initialization-checklist.json");
  if (!(await pathExists(target))) {
    return null;
  }
  return readJson<InitializationChecklist>(target);
}

function sourceAwareStatus(sourceStatus: ValidatorStatus | undefined): SourceOfRecordStatus {
  if (sourceStatus === "fail") {
    return "fail";
  }
  if (sourceStatus === "warning" || sourceStatus === "skipped" || !sourceStatus) {
    return "warning";
  }
  return "pass";
}

function validationStatusGate(validationsById: Map<string, ValidationResult>, ids: string[], allowWarning = false): SourceOfRecordStatus {
  const statuses = ids.map((id) => validationsById.get(id)?.status ?? "fail");
  if (statuses.some((status) => status === "fail")) {
    return "fail";
  }
  if (statuses.some((status) => status === "warning" || status === "skipped")) {
    return allowWarning ? "pass" : "warning";
  }
  return "pass";
}

function allPresent(artifacts: Set<string>, requiredArtifacts: string[]): boolean {
  return requiredArtifacts.every((artifact) => artifacts.has(artifact));
}

function trustRank(trust: SourceRef["trust"]): number {
  if (trust === "highest") {
    return 0;
  }
  if (trust === "high") {
    return 1;
  }
  if (trust === "medium") {
    return 2;
  }
  return 3;
}

function validationDetails(ledger: SourceOfRecordLedger): string {
  if (ledger.status === "pass") {
    return `Source of record answered ${ledger.summary.answeredQuestionCount}/${ledger.summary.questionCount} fresh-session question(s) and passed ${ledger.summary.passedCheckCount}/${ledger.summary.checkCount} check(s).`;
  }
  if (ledger.status === "warning") {
    return `Source of record has warning check(s): ${ledger.unresolved
      .filter((issue) => issue.status === "warning")
      .map((issue) => issue.id)
      .join(", ")}.`;
  }
  return `Source of record has failed check(s): ${ledger.unresolved
    .filter((issue) => issue.status === "fail")
    .map((issue) => issue.id)
    .join(", ")}.`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
