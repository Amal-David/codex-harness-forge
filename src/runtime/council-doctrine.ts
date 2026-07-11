import type { CouncilReviewFinding } from "../types.js";

export interface CouncilDoctrinePrinciple {
  id: string;
  title: string;
  check: string;
  evidence: string[];
}

export interface CouncilDoctrineReference {
  id: "gstack" | "gbrain";
  title: string;
  url: string;
  license: string;
  sourceKind: "open-source-project";
  lesson: string;
  principles: CouncilDoctrinePrinciple[];
}

export const councilDoctrine: CouncilDoctrineReference[] = [
  {
    id: "gstack",
    title: "GStack",
    url: "https://github.com/garrytan/gstack",
    license: "MIT",
    sourceKind: "open-source-project",
    lesson: "Use explicit specialist roles, review rituals, QA gates, release discipline, safety guardrails, cross-model challenge, and persisted work context as workflow primitives.",
    principles: [
      {
        id: "gstack-specialist-team",
        title: "Specialist team instead of generic assistant",
        check: "The workflow has explicit specialist roles for planning, implementation, QA/review, release/finalization, and second-opinion critique where needed.",
        evidence: ["spec.agents", "agent-runs/*"],
      },
      {
        id: "gstack-review-rituals",
        title: "Review rituals and adversarial challenge",
        check: "The workflow runs independent reviewers before finalization and records their findings as durable artifacts.",
        evidence: ["council-review.json", "agent-runs/council-elders-manifest.json"],
      },
      {
        id: "gstack-qa-release-gates",
        title: "QA and release gates",
        check: "The workflow exposes validators, finalization gates, failed checks, and course corrections before declaring success.",
        evidence: ["validation-report.md", "harness-trace.json", "run-plan.json"],
      },
      {
        id: "gstack-run-context",
        title: "Persisted run context",
        check: "The workflow can be inspected, resumed, saved, and rerun from durable state rather than disappearing into chat history.",
        evidence: ["run-state.json", ".harness/runs", ".harness/workflows"],
      },
    ],
  },
  {
    id: "gbrain",
    title: "GBrain",
    url: "https://github.com/garrytan/gbrain",
    license: "MIT",
    sourceKind: "open-source-project",
    lesson: "Use brain-first lookup, synthesized answers with citations, graph-aware memory, gap analysis, scoped access, sync, and contradiction handling as memory primitives.",
    principles: [
      {
        id: "gbrain-source-first",
        title: "Source-first retrieval",
        check: "The workflow names source refs and uses source/evidence artifacts before producing final claims.",
        evidence: ["request.sources", "evidence-graph.json", "harness-ir.json"],
      },
      {
        id: "gbrain-citations-gap-analysis",
        title: "Citations and gap analysis",
        check: "The workflow records what evidence supports the answer and keeps missing or weak evidence visible.",
        evidence: ["council-review.json", "validation-report.md", "skill-update-suggestions.md"],
      },
      {
        id: "gbrain-durable-memory",
        title: "Durable memory and write-back boundaries",
        check: "The workflow persists run state and proposes learning write-backs without silently changing source-of-truth files.",
        evidence: ["run-state.json", "skill-update-suggestions.md"],
      },
      {
        id: "gbrain-scoped-sync",
        title: "Scoped sync and contradiction handling",
        check: "The workflow keeps source scope explicit and surfaces conflicts instead of blending contradictory instructions.",
        evidence: ["harness-trace.json", "request.sources", "sourceConflicts"],
      },
    ],
  },
];

export function doctrineForElder(elder: CouncilReviewFinding["elder"]): CouncilDoctrinePrinciple[] {
  if (elder === "gstack-process") {
    return councilDoctrine.find((reference) => reference.id === "gstack")?.principles ?? [];
  }
  if (elder === "gbrain-memory") {
    return councilDoctrine.find((reference) => reference.id === "gbrain")?.principles ?? [];
  }
  return councilDoctrine.flatMap((reference) => reference.principles);
}
