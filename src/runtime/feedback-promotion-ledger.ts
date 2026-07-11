import path from "node:path";
import type { CouncilReview, CriticQuestion, CriticReview, HarnessSpec, TraceEvent, ValidationResult } from "../types.js";
import { stableId, writeJson } from "../utils/fs.js";

export const FEEDBACK_PROMOTION_LEDGER_ARTIFACT = "feedback-promotion-ledger.json";

interface FeedbackPromotionLedgerInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  councilReview: CouncilReview;
  validations: ValidationResult[];
}

export interface FeedbackPromotionLedgerResult {
  artifact: string;
  ledger: FeedbackPromotionLedger;
  validation: ValidationResult;
}

interface FeedbackPromotionLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail" | "warning";
  rule: string;
  sourceSummary: {
    validationSignalCount: number;
    criticQuestionCount: number;
    findingCount: number;
    courseCorrectionCount: number;
    promotionCandidateCount: number;
  };
  candidates: FeedbackPromotionCandidate[];
  unresolved: Array<{
    sourceType: string;
    sourceId: string;
    reason: string;
    evidence: string[];
  }>;
}

interface FeedbackPromotionCandidate {
  id: string;
  sourceType: "validation" | "critic-question" | "council-finding" | "course-correction" | "missing-evidence" | "unsafe-assumption";
  sourceId: string;
  target: "validator" | "harness-rule" | "agent-instruction" | "evidence-check" | "capability-pack" | "approval-gate";
  severity: "blocker" | "major" | "minor" | "note";
  title: string;
  body: string;
  suggestedAction: string;
  evidence: string[];
}

export async function writeFeedbackPromotionLedger(input: FeedbackPromotionLedgerInput): Promise<FeedbackPromotionLedgerResult> {
  const ledger = buildFeedbackPromotionLedger(input);
  const target = path.join(input.outputDir, FEEDBACK_PROMOTION_LEDGER_ARTIFACT);
  await writeJson(target, ledger);
  return {
    artifact: FEEDBACK_PROMOTION_LEDGER_ARTIFACT,
    ledger,
    validation: {
      id: "feedback_promotion_recorded",
      name: "Feedback promotion recorded",
      status: ledger.status,
      details:
        ledger.status === "pass"
          ? `Promoted ${ledger.candidates.length} review or validation signal(s) into durable harness-improvement candidate(s).`
          : ledger.status === "warning"
            ? "Feedback promotion ran, but there were no concrete candidates in this run."
            : `Feedback promotion missed ${ledger.unresolved.length} required signal(s).`,
      evidence: [target],
      repairable: true,
    },
  };
}

export function feedbackPromotionEvents(runId: string, result: FeedbackPromotionLedgerResult): TraceEvent[] {
  return [
    {
      id: stableId("event", `${runId}:runtime.feedback_promotion.recorded:${result.ledger.id}`),
      runId,
      type: "runtime.feedback_promotion.recorded",
      timestamp: new Date().toISOString(),
      artifactId: FEEDBACK_PROMOTION_LEDGER_ARTIFACT,
      status: result.validation.status,
      message: `Recorded ${result.ledger.candidates.length} feedback promotion candidate(s).`,
      evidence: [FEEDBACK_PROMOTION_LEDGER_ARTIFACT],
    },
  ];
}

function buildFeedbackPromotionLedger(input: FeedbackPromotionLedgerInput): FeedbackPromotionLedger {
  const validationSignals = input.validations.filter((validation) => validation.status === "fail" || validation.status === "warning" || validation.status === "skipped");
  const courseCorrections = unique(input.councilReview.courseCorrections);
  const candidates = uniqueCandidates([
    ...validationSignals.map((validation) => validationCandidate(input.runId, validation)),
    ...input.councilReview.criticQuestions.map((question) => criticQuestionCandidate(input.runId, question)),
    ...input.councilReview.findings.map((finding) =>
      findingCandidate(input.runId, finding.id, finding.severity, finding.finding, finding.courseCorrection, finding.evidence),
    ),
    ...courseCorrections.map((correction) => courseCorrectionCandidate(input.runId, correction)),
    ...input.councilReview.criticReviews.flatMap((review) => review.missingEvidence.map((item, index) => missingEvidenceCandidate(input.runId, review, item, index))),
    ...input.councilReview.criticReviews.flatMap((review) => review.unsafeAssumptions.map((item, index) => unsafeAssumptionCandidate(input.runId, review, item, index))),
  ]);
  const unresolved = validationSignals
    .filter((validation) => validation.repairable && !candidates.some((candidate) => candidate.sourceId === validation.id))
    .map((validation) => ({
      sourceType: "validation",
      sourceId: validation.id,
      reason: "Repairable validation signal did not produce a feedback-promotion candidate.",
      evidence: validation.evidence ?? [],
    }));
  const status = unresolved.length ? "fail" : candidates.length ? "pass" : "warning";
  return {
    schemaVersion: 1,
    id: stableId("feedback-promotion-ledger", `${input.runId}:${candidates.map((candidate) => candidate.id).join("|") || "empty"}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    rule: "Every repairable validation issue, critic question, missing-evidence signal, unsafe assumption, or course correction must become a durable candidate for a future harness rule, validator, capability pack, or instruction update.",
    sourceSummary: {
      validationSignalCount: validationSignals.length,
      criticQuestionCount: input.councilReview.criticQuestions.length,
      findingCount: input.councilReview.findings.length,
      courseCorrectionCount: courseCorrections.length,
      promotionCandidateCount: candidates.length,
    },
    candidates,
    unresolved,
  };
}

function validationCandidate(runId: string, validation: ValidationResult): FeedbackPromotionCandidate {
  return {
    id: stableId("feedback-candidate", `${runId}:validation:${validation.id}:${validation.status}`),
    sourceType: "validation",
    sourceId: validation.id,
    target: "validator",
    severity: validation.status === "fail" ? "major" : "minor",
    title: `Promote validation signal: ${validation.name}`,
    body: validation.details,
    suggestedAction: validation.repairable
      ? `Add or refine an automated repair/check path for ${validation.id}.`
      : `Record ${validation.id} as a non-repairable completion signal for evaluator review.`,
    evidence: validation.evidence ?? [],
  };
}

function criticQuestionCandidate(runId: string, question: CriticQuestion): FeedbackPromotionCandidate {
  return {
    id: stableId("feedback-candidate", `${runId}:critic-question:${question.id}`),
    sourceType: "critic-question",
    sourceId: question.id,
    target: targetForCategory(question.category),
    severity: question.severity,
    title: `Promote critic question: ${question.category}`,
    body: `${question.question} Why it matters: ${question.whyItMatters}`,
    suggestedAction: question.answerRequired
      ? "Turn this question into a required source fact, validator, or explicit assumption before future completion claims."
      : "Use this question as a lower-priority rubric or documentation improvement candidate.",
    evidence: question.evidence,
  };
}

function findingCandidate(
  runId: string,
  sourceId: string,
  severity: FeedbackPromotionCandidate["severity"],
  finding: string,
  courseCorrection: string,
  evidence: string[],
): FeedbackPromotionCandidate {
  return {
    id: stableId("feedback-candidate", `${runId}:finding:${sourceId}`),
    sourceType: "council-finding",
    sourceId,
    target: "harness-rule",
    severity,
    title: "Promote council finding",
    body: finding,
    suggestedAction: courseCorrection,
    evidence,
  };
}

function courseCorrectionCandidate(runId: string, correction: string): FeedbackPromotionCandidate {
  return {
    id: stableId("feedback-candidate", `${runId}:course-correction:${correction}`),
    sourceType: "course-correction",
    sourceId: stableId("course-correction", correction),
    target: "agent-instruction",
    severity: correction.includes("blocker") || correction.includes("Blocker") ? "major" : "minor",
    title: "Promote course correction",
    body: correction,
    suggestedAction: "Convert this correction into a durable prompt rule, validator expectation, or capability-pack requirement when it repeats.",
    evidence: ["council-review.json"],
  };
}

function missingEvidenceCandidate(runId: string, review: CriticReview, item: string, index: number): FeedbackPromotionCandidate {
  return {
    id: stableId("feedback-candidate", `${runId}:missing-evidence:${review.criticId}:${index}:${item}`),
    sourceType: "missing-evidence",
    sourceId: `${review.criticId}:missing-evidence:${index}`,
    target: "evidence-check",
    severity: "major",
    title: `Promote missing evidence from ${review.criticId}`,
    body: item,
    suggestedAction: "Require this evidence class in future source profiling, artifact generation, or validation before clean success.",
    evidence: ["council-review.json"],
  };
}

function unsafeAssumptionCandidate(runId: string, review: CriticReview, item: string, index: number): FeedbackPromotionCandidate {
  return {
    id: stableId("feedback-candidate", `${runId}:unsafe-assumption:${review.criticId}:${index}:${item}`),
    sourceType: "unsafe-assumption",
    sourceId: `${review.criticId}:unsafe-assumption:${index}`,
    target: "harness-rule",
    severity: "major",
    title: `Promote unsafe assumption from ${review.criticId}`,
    body: item,
    suggestedAction: "Require this assumption to be answered, rejected, or explicitly marked as a bounded assumption in future runs.",
    evidence: ["council-review.json"],
  };
}

function targetForCategory(category: string): FeedbackPromotionCandidate["target"] {
  if (category.includes("api") || category.includes("schema") || category.includes("tests") || category.includes("security")) {
    return "validator";
  }
  if (category.includes("source") || category.includes("evidence") || category.includes("grounding")) {
    return "evidence-check";
  }
  if (category.includes("approval") || category.includes("permission")) {
    return "approval-gate";
  }
  if (category.includes("generic") || category.includes("capability") || category.includes("pack")) {
    return "capability-pack";
  }
  return "harness-rule";
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function uniqueCandidates(candidates: FeedbackPromotionCandidate[]): FeedbackPromotionCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.sourceType}:${candidate.sourceId}:${candidate.target}:${candidate.body}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
