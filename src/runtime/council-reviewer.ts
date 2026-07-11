import path from "node:path";
import type { CouncilReview, CouncilReviewFinding, CriticQuestion, CriticReview, HarnessRequest, HarnessSpec, RuntimeAgentRun, ValidationResult } from "../types.js";
import { writeJson, writeText } from "../utils/fs.js";
import { councilDoctrine, doctrineForElder } from "./council-doctrine.js";

export async function writeCouncilReview(
  outputDir: string,
  runId: string,
  spec: HarnessSpec,
  request: HarnessRequest,
  validations: ValidationResult[],
  agentRuns: RuntimeAgentRun[] = [],
): Promise<{ review: CouncilReview; artifacts: string[]; validation: ValidationResult; criticValidations: ValidationResult[] }> {
  const review = buildCouncilReview(runId, spec, request, validations, agentRuns);
  const criticValidations = buildCriticValidations(review, request, spec);
  const jsonPath = path.join(outputDir, "council-review.json");
  const markdownPath = path.join(outputDir, "council-review.md");
  const doctrinePath = path.join(outputDir, "council-doctrine.json");
  await writeJson(jsonPath, review);
  await writeText(markdownPath, renderCouncilReview(review));
  await writeJson(doctrinePath, { runId, references: councilDoctrine });
  return {
    review,
    artifacts: ["council-review.json", "council-review.md", "council-doctrine.json"],
    validation: {
      id: "council_review_complete",
      name: "Council review complete",
      status: validations.some((validation) => validation.status === "fail") ? "fail" : review.verdict === "course-correct" ? "warning" : "pass",
      details:
        review.verdict === "pass"
          ? "Council of elders completed without required course corrections."
          : `Council of elders proposed ${review.courseCorrections.length} course correction(s).`,
      evidence: [jsonPath, markdownPath, doctrinePath],
      repairable: true,
    },
    criticValidations,
  };
}

function buildCouncilReview(runId: string, spec: HarnessSpec, request: HarnessRequest, validations: ValidationResult[], agentRuns: RuntimeAgentRun[]): CouncilReview {
  const findings: CouncilReviewFinding[] = [...agentRuns.flatMap((run) => run.findings)];
  const criticReviews = agentRuns.map((run) => run.criticReview).filter((review): review is CriticReview => Boolean(review));
  const criticQuestions = criticReviews.flatMap((review) => review.questions);
  const unresolvedBlockerQuestions = criticQuestions.filter((question) => question.severity === "blocker" && question.answerRequired && question.resolution === "unresolved");
  const agentIds = new Set(spec.agents.map((agent) => agent.id));
  const nodeIds = new Set(spec.graph.map((node) => node.id));
  const validatorIds = new Set(spec.validators.map((validator) => validator.id));
  const agentRunIds = new Set(agentRuns.map((run) => run.agentId));

  if (!agentIds.has("persistence-architect")) {
    findings.push(finding("gbrain-memory", "major", "No persistence architect participated in this run.", ["spec.agents"], "Add the persistence architect to every workflow so memory, run state, and write-back policy are reviewed."));
  }
  if (!agentIds.has("flow-runtime-manager")) {
    findings.push(finding("gstack-process", "major", "No flow runtime manager participated in this run.", ["spec.agents"], "Add the flow runtime manager to own lifecycle state, resumability, and run management."));
  }
  if (!agentIds.has("council-gstack-critic") || !agentIds.has("council-gbrain-memory") || !agentIds.has("council-verifier")) {
    findings.push(finding("verifier", "major", "The council of elders is incomplete.", ["spec.agents"], "Run GStack, GBrain, and verifier elders as parallel reviewers before finalization."));
  }
  if (!agentRunIds.has("council-gstack-critic") || !agentRunIds.has("council-gbrain-memory") || !agentRunIds.has("council-verifier")) {
    findings.push(finding("verifier", "major", "Council elder agent-run artifacts are incomplete.", ["agent-runs"], "Execute all council elders as separate agent runs and attach their artifacts to the council review."));
  }
  if (!nodeIds.has("validate:council-review") || !validatorIds.has("council_review_complete")) {
    findings.push(finding("verifier", "major", "Council output is not bound to a validator.", ["spec.graph", "spec.validators"], "Bind council-review artifacts to a required validator so course-correction cannot be skipped."));
  }
  if (validations.some((validation) => validation.status === "fail")) {
    findings.push(finding("verifier", "blocker", "One or more required validators failed before council review.", validations.filter((validation) => validation.status === "fail").map((validation) => validation.id), "Stop final confidence claims until failed validators are repaired or explicitly marked blocked."));
  }
  if (request.sources.length === 0) {
    findings.push(finding("gbrain-memory", "minor", "The run has no explicit source refs.", ["request.sources"], "Prefer brain-first/source-first retrieval and require named sources for durable workflows."));
  }
  if (!spec.ir) {
    findings.push(finding("verifier", "major", "The run has no verified HarnessIR attached.", ["spec.ir"], "Keep generated orchestration behind verified IR so dynamic execution cannot bypass the compiler."));
  }

  const blockerCorrections = unresolvedBlockerQuestions.map(
    (question) => `Answer blocker question '${question.question}' before final success claims, or record an explicit source-grounded assumption.`,
  );
  const courseCorrections = [...new Set([...findings.map((item) => item.courseCorrection), ...blockerCorrections])];
  const steps = [
    {
      id: "step-gstack-process",
      title: "Review GStack-inspired process discipline",
      status: stepStatus(agentRuns, "council-gstack-critic", findings, "gstack-process", unresolvedBlockerQuestions),
      agentRunIds: agentRuns.filter((run) => run.agentId === "council-gstack-critic").map((run) => run.id),
      doctrinePrincipleIds: doctrineForElder("gstack-process").map((principle) => principle.id),
      notes: [...notesFor(agentRuns, "council-gstack-critic"), ...questionNotesFor(unresolvedBlockerQuestions, "council-gstack-critic")],
    },
    {
      id: "step-gbrain-memory",
      title: "Review GBrain-inspired memory and provenance discipline",
      status: stepStatus(agentRuns, "council-gbrain-memory", findings, "gbrain-memory", unresolvedBlockerQuestions),
      agentRunIds: agentRuns.filter((run) => run.agentId === "council-gbrain-memory").map((run) => run.id),
      doctrinePrincipleIds: doctrineForElder("gbrain-memory").map((principle) => principle.id),
      notes: [...notesFor(agentRuns, "council-gbrain-memory"), ...questionNotesFor(unresolvedBlockerQuestions, "council-gbrain-memory")],
    },
    {
      id: "step-verifier",
      title: "Review verifier gates and failed validations",
      status: stepStatus(agentRuns, "council-verifier", findings, "verifier", unresolvedBlockerQuestions),
      agentRunIds: agentRuns.filter((run) => run.agentId === "council-verifier").map((run) => run.id),
      doctrinePrincipleIds: doctrineForElder("verifier").map((principle) => principle.id),
      notes: [...notesFor(agentRuns, "council-verifier"), ...questionNotesFor(unresolvedBlockerQuestions, "council-verifier")],
    },
    {
      id: "step-course-correction",
      title: "Synthesize course corrections before finalization",
      status: findings.some((item) => item.severity === "blocker") || unresolvedBlockerQuestions.length ? "blocked" : courseCorrections.length ? "course-correct" : "pass",
      agentRunIds: agentRuns.filter((run) => run.agentId === "council-course-corrector").map((run) => run.id),
      doctrinePrincipleIds: doctrineForElder("verifier").map((principle) => principle.id),
      notes: courseCorrections.length ? courseCorrections : ["No course corrections required."],
    },
  ] satisfies CouncilReview["steps"];
  return {
    id: `council-${runId}`,
    runId,
    reviewedAt: new Date().toISOString(),
    agentRunIds: agentRuns.map((run) => run.id),
    references: councilDoctrine,
    elders: [
      {
        id: "gstack-process",
        role: "Review workflow process, specialist coverage, QA/release discipline, and whether dynamic execution is inspectable and resumable.",
        checks: doctrineForElder("gstack-process").map((principle) => principle.check),
      },
      {
        id: "gbrain-memory",
        role: "Review memory, persistence, provenance, source refs, and whether durable learnings can be searched later.",
        checks: doctrineForElder("gbrain-memory").map((principle) => principle.check),
      },
      {
        id: "verifier",
        role: "Review validator coverage, IR grounding, failed checks, and whether finalization is blocked until evidence is strong.",
        checks: doctrineForElder("verifier").map((principle) => principle.check),
      },
    ],
    steps,
    findings,
    criticReviews,
    criticQuestions,
    unresolvedBlockerQuestions,
    courseCorrections,
    verdict: findings.length || unresolvedBlockerQuestions.length ? "course-correct" : "pass",
  };
}

function buildCriticValidations(review: CouncilReview, request: HarnessRequest, spec: HarnessSpec): ValidationResult[] {
  const expectedCritics = ["council-gstack-critic", "council-gbrain-memory", "council-verifier"];
  const reviewsByCritic = new Map(review.criticReviews.map((item) => [item.criticId, item]));
  const missingCritics = expectedCritics.filter((criticId) => !reviewsByCritic.has(criticId));
  const emptyQuestionCritics = expectedCritics.filter((criticId) => (reviewsByCritic.get(criticId)?.questions.length ?? 0) === 0);
  const appPrd = isAppPrdRequest(request, spec);
  const requiredCategories = ["product-acceptance", "ui-flow", "api-contract", "persistence-model", "data-schema", "tests", "accessibility", "deployment"];
  const observedCategories = new Set(review.criticQuestions.map((question) => question.category));
  const artifactCategories = appArtifactCoverage(spec);
  const missingCategories = appPrd ? requiredCategories.filter((category) => !observedCategories.has(category) && !artifactCategories.has(category)) : [];
  const coveredCategories = requiredCategories.filter((category) => observedCategories.has(category) || artifactCategories.has(category));
  return [
    {
      id: "critic_questions_present",
      name: "Critic questions present",
      status: missingCritics.length || emptyQuestionCritics.length ? "fail" : "pass",
      details:
        missingCritics.length || emptyQuestionCritics.length
          ? `Missing critic reviews: ${missingCritics.join(", ") || "none"}; empty question lists: ${emptyQuestionCritics.join(", ") || "none"}.`
          : `Structured critic questions were emitted by ${expectedCritics.length} council critic(s).`,
      evidence: ["council-review.json", "agent-runs/council-elders-manifest.json"],
      repairable: true,
    },
    {
      id: "blocker_questions_resolved",
      name: "Blocker questions resolved",
      status: review.unresolvedBlockerQuestions.length ? "warning" : "pass",
      details: review.unresolvedBlockerQuestions.length
        ? `${review.unresolvedBlockerQuestions.length} unresolved blocker critic question(s) require answers before success claims.`
        : "No unresolved blocker critic questions remain.",
      evidence: ["council-review.json", "council-review.md"],
      repairable: true,
    },
    {
      id: "app_prd_critic_coverage",
      name: "App PRD critic coverage",
      status: missingCategories.length ? "fail" : "pass",
      details: appPrd
        ? missingCategories.length
          ? `Missing app critic categories: ${missingCategories.join(", ")}.`
          : `App/PRD coverage present through critic questions or artifacts: ${coveredCategories.join(", ")}.`
        : "No app/PRD signals required app-specific critic coverage.",
      evidence: ["council-review.json", ...request.sources],
      repairable: true,
    },
  ];
}

function appArtifactCoverage(spec: HarnessSpec): Set<string> {
  const artifactIds = new Set(spec.artifactContracts.map((contract) => contract.id));
  const validatorIds = new Set(spec.validators.map((validator) => validator.id));
  const categories = new Set<string>();
  if (artifactIds.has("app-ui-flow")) {
    categories.add("product-acceptance");
    categories.add("ui-flow");
    categories.add("accessibility");
  }
  if (artifactIds.has("app-api-contract") || validatorIds.has("app_api_contract_present")) {
    categories.add("api-contract");
  }
  if (artifactIds.has("app-persistence-plan") || validatorIds.has("app_persistence_plan_present")) {
    categories.add("persistence-model");
    categories.add("data-schema");
  }
  if (artifactIds.has("app-test-plan") || validatorIds.has("app_test_plan_full_pipeline")) {
    categories.add("tests");
    categories.add("accessibility");
    categories.add("deployment");
  }
  if (artifactIds.has("app-acceptance-plan") || validatorIds.has("app_acceptance_coverage")) {
    categories.add("product-acceptance");
    categories.add("deployment");
  }
  return categories;
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

function renderCouncilReview(review: CouncilReview): string {
  const findings = review.findings.length
    ? review.findings.map((finding) => `- [${finding.severity}] ${finding.elder}: ${finding.finding}\n  Correction: ${finding.courseCorrection}`).join("\n")
    : "- No required course corrections.";
  const questionsToAnswer = review.unresolvedBlockerQuestions.length
    ? review.unresolvedBlockerQuestions
        .map((question) =>
          [
            `- [${question.severity}] ${question.criticId} / ${question.category}: ${question.question}`,
            `  Why: ${question.whyItMatters}`,
            `  Suggested assumption: ${question.suggestedAssumption ?? "none"}`,
            `  Evidence: ${question.evidence.join(", ")}`,
          ].join("\n"),
        )
        .join("\n")
    : "- No unresolved blocker questions.";
  const criticReviews = review.criticReviews.length
    ? review.criticReviews
        .map((critic) =>
          [
            `### ${critic.criticId}`,
            "",
            critic.summary,
            "",
            `Confidence: ${critic.confidenceScore}`,
            "",
            ...critic.questions.map((question) => `- [${question.severity}] ${question.category}: ${question.question} (${question.resolution})`),
          ].join("\n"),
        )
        .join("\n\n")
    : "No critic reviews were emitted.";
  return [
    "# Council Review",
    "",
    `Run: ${review.runId}`,
    `Verdict: ${review.verdict}`,
    "",
    "## References",
    "",
    ...review.references.map((reference) => [`- ${reference.title}: ${reference.url}`, `  License: ${reference.license}`, `  Lesson: ${reference.lesson}`]).flat(),
    "",
    "## Elders",
    "",
    ...review.elders.map((elder) => `- ${elder.id}: ${elder.role}`),
    "",
    "## Steps",
    "",
    ...review.steps.map((step) => `- ${step.status}: ${step.title} (${step.doctrinePrincipleIds.join(", ")})`),
    "",
    "## Findings",
    "",
    findings,
    "",
    "## Questions To Answer",
    "",
    questionsToAnswer,
    "",
    "## Critic Reviews",
    "",
    criticReviews,
    "",
  ].join("\n");
}

function stepStatus(
  runs: RuntimeAgentRun[],
  agentId: string,
  findings: CouncilReviewFinding[],
  elder: CouncilReviewFinding["elder"],
  unresolvedBlockerQuestions: CriticQuestion[],
): CouncilReview["steps"][number]["status"] {
  if (!runs.some((run) => run.agentId === agentId)) {
    return "blocked";
  }
  if (unresolvedBlockerQuestions.some((question) => question.criticId === agentId)) {
    return "blocked";
  }
  if (findings.some((finding) => finding.elder === elder && finding.severity === "blocker")) {
    return "blocked";
  }
  if (findings.some((finding) => finding.elder === elder)) {
    return "course-correct";
  }
  return "pass";
}

function notesFor(runs: RuntimeAgentRun[], agentId: string): string[] {
  const selected = runs.filter((run) => run.agentId === agentId);
  return selected.length ? selected.map((run) => run.summary) : [`${agentId} did not produce an agent-run artifact.`];
}

function questionNotesFor(questions: CriticQuestion[], criticId: string): string[] {
  return questions.filter((question) => question.criticId === criticId).map((question) => `Unresolved blocker: ${question.question}`);
}

function isAppPrdRequest(request: HarnessRequest, spec: HarnessSpec): boolean {
  const haystack = [
    request.intent,
    ...request.sources,
    spec.userIntent,
    ...spec.sources.map((source) => source.location),
    ...spec.artifactContracts.map((contract) => `${contract.id}:${contract.type}`),
  ]
    .join(" ")
    .toLowerCase();
  const hasAppSignal = /\b(app|application|prd|product|user|screen|flow|ui|frontend|backend|api|route|endpoint|full-stack)\b/.test(haystack);
  const usesGenericReport =
    spec.artifactContracts.some((contract) => contract.id === "final-report") &&
    spec.graph.some((node) => node.capabilityId === "artifact-generator:final-report");
  return hasAppSignal && usesGenericReport;
}

function hashCode(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}
