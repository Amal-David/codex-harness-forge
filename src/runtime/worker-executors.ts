import type { CouncilReviewFinding, CriticQuestion, CriticReview } from "../types.js";
import type { WorkerExecutorContext, WorkerExecutorOutcome } from "./worker-runner.js";

export async function runWorkflowRuntimeWorker(context: WorkerExecutorContext): Promise<WorkerExecutorOutcome> {
  const failed = (context.validations ?? []).filter((validation) => validation.status === "fail");
  const warnings = (context.validations ?? []).filter((validation) => validation.status === "warning" || validation.status === "skipped");
  const agentId = context.node.agentId;
  const appContext = appSignal(context);
  if (agentId === "persistence-architect") {
    return {
      summary: "Planned durable run-state persistence, saved workflow records, provenance, and memory write-back boundaries.",
      findings: [],
      courseCorrections: [],
    };
  }
  if (agentId === "flow-runtime-manager") {
    return {
      summary: "Planned workflow lifecycle, run inspection, saved workflow replay, resume behavior, and generated-orchestration boundary.",
      findings: [],
      courseCorrections: [],
    };
  }
  if (agentId === "council-gstack-critic") {
    const findings: CouncilReviewFinding[] = [];
    const questions: CriticQuestion[] = [
      question(
        "council-gstack-critic",
        "workflow-shape",
        "note",
        "Does the selected workflow shape expose the right specialist roles before finalization?",
        "Workflow outcomes degrade when routing hides missing roles behind a generic artifact path.",
        ["spec.graph", "spec.agents"],
        false,
        "Runtime, persistence, and council roles are present in the verified graph.",
      ),
      question(
        "council-gstack-critic",
        "finalization-quality",
        "note",
        "Can the final response make only claims that are backed by validators or artifacts?",
        "The run should not claim success beyond what the artifact and validator contract proves.",
        ["spec.validators", "spec.artifactContracts"],
        false,
        "Finalization is constrained by validator results and council course corrections.",
      ),
    ];
    if (!context.spec.graph.some((item) => item.agentId === "flow-runtime-manager")) {
      findings.push(finding("gstack-process", "major", "Flow runtime manager is absent from the DAG.", ["spec.graph"], "Add flow-runtime management as a required parallel planning agent."));
    }
    if (!context.spec.graph.some((item) => item.id === "validate:council-review")) {
      findings.push(finding("gstack-process", "major", "Council review is not a finalization gate.", ["spec.graph"], "Make finalization wait on validate:council-review."));
    }
    if (appContext.isApp && appContext.usesGenericReport) {
      findings.push(
        finding(
          "gstack-process",
          "major",
          "Application-building intent fell back to the generic report workflow.",
          ["request.intent", "spec.artifactContracts:final-report"],
          "Add app-building roles and artifact contracts before presenting the run as a complete app workflow.",
        ),
      );
      questions.push(
        question(
          "council-gstack-critic",
          "product-acceptance",
          "blocker",
          "What user-visible product acceptance criteria must the app satisfy before this run can be called complete?",
          "A generic report cannot prove that the app matches the PRD or that the intended user workflow works end to end.",
          appContext.evidence,
          true,
          "Treat the run as an architecture/report pass until product acceptance criteria are extracted from the PRD.",
        ),
        question(
          "council-gstack-critic",
          "ui-flow",
          "blocker",
          "Which screens, states, and navigation paths must exist for the primary habit tracking flow?",
          "The workflow cannot validate UX completeness without explicit screen and state coverage.",
          appContext.evidence,
          true,
          "Assume the PRD requires at least onboarding, habit list, habit detail/edit, completion history, and empty/error states until proven otherwise.",
        ),
        question(
          "council-gstack-critic",
          "deployment",
          "blocker",
          "What deploy target, runtime constraints, environment variables, and release checks are required?",
          "A deployable architecture claim is unsafe without a named target and release evidence.",
          appContext.evidence,
          true,
          "Keep deployment as a missing decision and avoid claiming deploy readiness.",
        ),
      );
    } else if (appContext.isApp) {
      questions.push(
        question(
          "council-gstack-critic",
          "ui-flow",
          "minor",
          "Are the primary app screens, states, and navigation boundaries represented in the artifact plan?",
          "App requests need workflow shape coverage beyond a single artifact when the source asks for user-facing behavior.",
          appContext.evidence,
          false,
          "Domain-specific artifacts and validators are present, so this is a coverage reminder rather than a blocker.",
        ),
      );
    }
    const criticReview = reviewFor(
      "council-gstack-critic",
      findings.length ? "GStack critic found workflow shape and finalization concerns." : "GStack critic generated workflow-shape and finalization questions.",
      questions,
      appContext.usesGenericReport ? ["app-specific workflow roles", "product acceptance criteria", "deployment target"] : [],
      appContext.usesGenericReport ? ["Generic report fallback may be mistaken for an app-building workflow."] : [],
      appContext.usesGenericReport ? ["role coverage", "generic fallback risk", "release readiness"] : ["role coverage", "finalization quality"],
    );
    return {
      summary: findings.length ? "GStack process elder found workflow-process course corrections." : "GStack process elder found the runtime process inspectable and gated.",
      findings,
      courseCorrections: findings.map((item) => item.courseCorrection),
      criticReview,
    };
  }
  if (agentId === "council-gbrain-memory") {
    const findings: CouncilReviewFinding[] = [];
    const questions: CriticQuestion[] = [
      question(
        "council-gbrain-memory",
        "source-grounding",
        "note",
        "Which source facts directly ground the workflow shape, assumptions, and final artifacts?",
        "Grounding needs to be inspectable so the system can distinguish evidence from model inference.",
        ["request.sources", "spec.evidenceGraph"],
        false,
        "Use available source refs and evidence-graph facts as the grounding boundary.",
      ),
      question(
        "council-gbrain-memory",
        "assumption-quality",
        "note",
        "Which assumptions are weak, stale, or derived from absent source material?",
        "Future runs need explicit assumptions to evolve the workflow instead of silently preserving accidental defaults.",
        ["spec.ir.task.assumptions", "request.sources"],
        false,
        "Assumptions remain advisory unless a blocker question requires an answer.",
      ),
    ];
    if (!context.spec.graph.some((item) => item.agentId === "persistence-architect")) {
      findings.push(finding("gbrain-memory", "major", "Persistence architect is absent from the DAG.", ["spec.graph"], "Add persistence planning as a required parallel agent."));
    }
    if (context.request.sources.length === 0) {
      findings.push(finding("gbrain-memory", "minor", "The workflow has no explicit source refs.", ["request.sources"], "Require named source refs or prior traces for durable workflows."));
    }
    if (appContext.isPrd && appContext.usesGenericReport) {
      questions.push(
        question(
          "council-gbrain-memory",
          "persistence-model",
          "blocker",
          "What durable entities, ownership boundaries, retention rules, and sync/offline expectations does the PRD require?",
          "A habit tracker is persistence-heavy; without this, the generated workflow cannot judge data safety or product viability.",
          appContext.evidence,
          true,
          "Treat persistence as unresolved and require an explicit model before implementation or success claims.",
        ),
        question(
          "council-gbrain-memory",
          "data-schema",
          "blocker",
          "What schema fields, constraints, indexes, and migration path are needed for habits, completions, users, and history?",
          "Tests and API contracts depend on stable schema decisions, and generic reporting does not extract them.",
          appContext.evidence,
          true,
          "Assume no schema is approved until the PRD is parsed into entities and constraints.",
        ),
      );
    } else if (appContext.isApp) {
      questions.push(
        question(
          "council-gbrain-memory",
          "persistence-model",
          "minor",
          "Does this app request need persisted domain state, and if so where is that model recorded?",
          "App workflows should not infer persistence from UI wording alone.",
          appContext.evidence,
          false,
          "The current domain-specific workflow does not claim persistence completeness unless explicit artifacts do.",
        ),
      );
    }
    const criticReview = reviewFor(
      "council-gbrain-memory",
      findings.length ? "GBrain critic found grounding, provenance, or persistence concerns." : "GBrain critic generated source-grounding and assumption questions.",
      questions,
      appContext.isPrd && appContext.usesGenericReport ? ["parsed PRD requirements", "entity schema", "persistence contract"] : [],
      appContext.isPrd && appContext.usesGenericReport ? ["Persistence and schema are only implied by intent, not extracted into artifacts."] : [],
      appContext.isPrd && appContext.usesGenericReport ? ["stale/weak facts", "schema ambiguity", "assumption drift"] : ["source grounding", "assumption quality"],
    );
    return {
      summary: findings.length ? "GBrain memory elder found memory/provenance course corrections." : "GBrain memory elder found source refs and durable persistence coverage present.",
      findings,
      courseCorrections: findings.map((item) => item.courseCorrection),
      criticReview,
    };
  }
  if (agentId === "council-verifier") {
    const findings: CouncilReviewFinding[] = [];
    const questions: CriticQuestion[] = [
      question(
        "council-verifier",
        "validator-coverage",
        "note",
        "Do validators cover every required artifact contract and finalization claim?",
        "A run should become partial when validator coverage is weaker than the requested outcome.",
        ["spec.validators", "spec.artifactContracts", "validations"],
        false,
        "Existing validators define the maximum confidence boundary for this run.",
      ),
      question(
        "council-verifier",
        "artifact-contract",
        "note",
        "Are required artifact manifests and run locks present for replay and audit?",
        "The workflow is only future-proof if the execution contract is inspectable and reproducible.",
        ["run-plan.json", "worker-lock.json", "agent-runs/*-manifest.json"],
        false,
        "Runtime artifacts and locks are expected to be written by the workflow runner.",
      ),
    ];
    for (const validation of failed) {
      findings.push(finding("verifier", "blocker", `Required validator '${validation.id}' failed.`, validation.evidence ?? [validation.id], "Block final confidence claims until failed validators are repaired or explicitly marked blocked."));
      questions.push(
        question(
          "council-verifier",
          "validator-coverage",
          "blocker",
          `How will failed validator '${validation.id}' be resolved or explicitly scoped out?`,
          "A failed validator means the run cannot safely finalize as complete.",
          validation.evidence ?? [validation.id],
          true,
          "Keep the run failed until the validator is repaired or the requirement is changed.",
        ),
      );
    }
    if (warnings.length > 0) {
      findings.push(finding("verifier", "minor", `${warnings.length} validator warning(s) require review.`, warnings.map((validation) => validation.id), "Keep warnings visible in the council report and trace."));
    }
    if (!context.spec.ir) {
      findings.push(finding("verifier", "major", "Verified HarnessIR is missing from the run.", ["spec.ir"], "Keep generated orchestration behind verified IR."));
    }
    if (appContext.isPrd && appContext.usesGenericReport) {
      questions.push(
        question(
          "council-verifier",
          "api-contract",
          "blocker",
          "What API routes, request/response schemas, auth assumptions, and error cases must be validated?",
          "The plan asks for API routes, but the generic report path has no API contract artifact or validator.",
          appContext.evidence,
          true,
          "Do not claim API readiness until route contracts are extracted and tested.",
        ),
        question(
          "council-verifier",
          "tests",
          "blocker",
          "Which unit, integration, end-to-end, and data migration tests prove the habit tracker works?",
          "Test coverage determines whether the workflow can catch broken requirements instead of only generating a report.",
          appContext.evidence,
          true,
          "Require a test plan and runnable validators before treating the app workflow as successful.",
        ),
        question(
          "council-verifier",
          "accessibility",
          "blocker",
          "What accessibility requirements apply to habit creation, completion, editing, charts, and notifications?",
          "UI acceptance is incomplete without accessibility gates for repeated daily use.",
          appContext.evidence,
          true,
          "Assume accessibility requirements are unresolved until captured as validators or acceptance criteria.",
        ),
      );
    } else if (appContext.isApp) {
      questions.push(
        question(
          "council-verifier",
          "tests",
          "minor",
          "What runnable checks prove this app-facing workflow did not regress the primary interaction?",
          "App workflows need at least one user-flow-oriented validation story.",
          appContext.evidence,
          false,
          "Current domain validators set the confidence boundary for this run.",
        ),
      );
    }
    if (appContext.securitySensitive) {
      questions.push(
        question(
          "council-verifier",
          "security-review",
          "minor",
          "Which security-specific checks cover authorization, secret handling, auditability, and abuse-prone admin actions?",
          "Security-sensitive app workflows need explicit security review coverage in addition to generic API and deployment planning.",
          appContext.evidence,
          false,
          "Treat current artifacts as planning coverage; require runnable security tests before source-tree implementation claims.",
        ),
      );
    }
    const criticReview = reviewFor(
      "council-verifier",
      findings.length ? "Verifier critic found validation and artifact-contract concerns." : "Verifier critic generated validator and artifact-contract questions.",
      questions,
      appContext.isPrd && appContext.usesGenericReport ? ["API contract", "test matrix", "accessibility gates"] : [],
      appContext.isPrd && appContext.usesGenericReport ? ["Generic final-report validation cannot prove API, test, or accessibility readiness."] : [],
      appContext.isPrd && appContext.usesGenericReport ? ["validator coverage", "artifact contract gaps", "unresolved blockers"] : ["validator coverage", "artifact contracts"],
    );
    return {
      summary: findings.length ? "Verifier elder found validation course corrections." : "Verifier elder found validators, IR, and finalization gates intact.",
      findings,
      courseCorrections: findings.map((item) => item.courseCorrection),
      criticReview,
    };
  }
  if (agentId === "council-course-corrector") {
    const courseCorrections = context.review?.courseCorrections ?? [];
    return {
      summary: courseCorrections.length
        ? `Synthesized ${courseCorrections.length} council course correction(s) before finalization.`
        : "Council passed without required course corrections.",
      findings: [],
      courseCorrections,
    };
  }
  return {
    summary: `Completed ${context.group} local worker '${agentId}'.`,
    findings: [],
    courseCorrections: [],
  };
}

function reviewFor(
  criticId: string,
  summary: string,
  questions: CriticQuestion[],
  missingEvidence: string[],
  unsafeAssumptions: string[],
  domainRisks: string[],
): CriticReview {
  const mustAnswerBeforeFinalize = questions.filter((item) => item.answerRequired && item.resolution === "unresolved").map((item) => item.id);
  return {
    criticId,
    summary,
    questions,
    missingEvidence,
    unsafeAssumptions,
    domainRisks,
    mustAnswerBeforeFinalize,
    confidenceScore: mustAnswerBeforeFinalize.length ? 0.45 : 0.82,
  };
}

function question(
  criticId: string,
  category: string,
  severity: CriticQuestion["severity"],
  questionText: string,
  whyItMatters: string,
  evidence: string[],
  answerRequired: boolean,
  suggestedAssumption: string,
): CriticQuestion {
  return {
    id: `${criticId}-${category}-${Math.abs(hashCode(questionText))}`,
    criticId,
    category,
    severity,
    question: questionText,
    whyItMatters,
    evidence,
    answerRequired,
    suggestedAssumption,
    resolution: answerRequired ? "unresolved" : "not-required",
  };
}

function appSignal(context: WorkerExecutorContext): { isApp: boolean; isPrd: boolean; usesGenericReport: boolean; securitySensitive: boolean; evidence: string[] } {
  const haystack = [
    context.request.intent,
    ...context.request.sources,
    context.spec.userIntent,
    ...context.spec.sources.map((source) => source.location),
    ...context.spec.artifactContracts.map((contract) => `${contract.id}:${contract.type}`),
  ]
    .join(" ")
    .toLowerCase();
  const hasProductSignal = /\b(app|application|prd|product|user|screen|flow|ui|frontend|backend|api|route|endpoint|full-stack)\b/.test(haystack);
  const hasDataSignal = /\b(persistence|schema|database|model)\b/.test(haystack);
  const securitySensitive = /\b(security|auth|authentication|authorization|rbac|role-based|sso|billing|audit|api keys?|secret|impersonation|privilege|denial)\b/.test(haystack);
  const hasAppArtifact = context.spec.artifactContracts.some((contract) => contract.id.startsWith("app-"));
  const isApp = hasAppArtifact || hasProductSignal;
  const isPrd = hasAppArtifact || hasProductSignal || (hasProductSignal && hasDataSignal);
  const usesGenericReport =
    context.spec.artifactContracts.some((contract) => contract.id === "final-report" || contract.type === "markdown-doc") &&
    context.spec.graph.some((node) => node.capabilityId === "artifact-generator:final-report");
  const evidence = [
    "request.intent",
    ...context.request.sources.map((source) => `source:${source}`),
    ...context.spec.artifactContracts.map((contract) => `artifact:${contract.id}`),
  ];
  return { isApp, isPrd, usesGenericReport, securitySensitive, evidence };
}

function finding(
  elder: CouncilReviewFinding["elder"],
  severity: CouncilReviewFinding["severity"],
  findingText: string,
  evidence: string[],
  courseCorrection: string,
): CouncilReviewFinding {
  return {
    id: `${elder}-${severity}-${Math.abs(hashCode(findingText))}`,
    elder,
    severity,
    finding: findingText,
    evidence,
    courseCorrection,
  };
}

function hashCode(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}
