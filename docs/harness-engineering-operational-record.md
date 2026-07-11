# Harness Engineering Operational Record

This repo now emits `harness-engineering-record.json` for every workflow run. The artifact summarizes the dynamic harness primitives emitted by the compiler/runtime rather than acting as the only bridge to the Learn Harness Engineering course.

The course frames a reliable agent harness as five subsystems: instructions, tools, environment, state, and feedback. It also emphasizes the repository as the system of record, context selection/write-back/compaction/isolation, machine-readable scope state, external completion judgment, full-pipeline verification, layered observability, and a clean session exit. In this repo those ideas map to existing runtime artifacts rather than to a separate prompt-only checklist.

## Runtime Mapping

| Course concept | Meta-harness surface |
| --- | --- |
| Instructions | `HarnessSpec`, capability packs, worker contracts, compiled prompt, `instruction-routing-ledger.json` |
| Tools | `executor-lock.json`, `worker-lock.json`, `worker-function-registry.json`, `provider-replacement-registry.json`, `tool-safety-ledger.json`, `context-budget-ledger.json`, `function-dispatch-plan.json`, `runtime-bus.json`, `function-invocation-ledger.json`, `policy-gate.json`, `approval-gate.json`, `budget-gate.json`, `hook-ledger.json`, `trace-context.json` |
| Environment | `environment-readiness-ledger.json`, source availability validation, source refs, `source-of-record-ledger.json`, source authority, dependency lock evidence, command readiness, output isolation, and freshness metadata |
| State | `initialization-checklist.json`, `feature-scheduler.json`, `context-budget-ledger.json`, `continuity-ledger.json`, `course-alignment-ledger.json`, `lifecycle-ledger.json`, `session-clean-state-ledger.json`, `feature-list.json`, `progress.md`, `session-handoff.md`, `startup-readiness.json`, `run-state.json`, `.harness/runs/<run-id>/run-state.json` |
| Feedback | `architecture-boundary-ledger.json`, `evaluator-rubric.json`, `completion-authority-ledger.json`, `course-alignment-ledger.json`, `verification-pipeline-ledger.json`, `feedback-promotion-ledger.json`, `harness-diagnostic-ledger.json`, `repair-guidance-ledger.json`, `harness-subsystem-audit.json`, `harness-ablation-comparison.json`, `quality-document.json`, `harness-quality-ledger.json`, `validation-report.md`, `council-review.json`, `harness-trace.json` |
| Scope surface | `feature-scheduler.json` WIP=1 active feature plus `feature-list.json` feature rows, dependencies, verification commands, state, evidence |
| Termination gates | validator statuses, independent completion-authority validation, run-quality validation, continuity validation, course-alignment validation, verified completion-rate validation, plus council critic validations |
| Process contract | `sprint-contract.json`, `verification-hierarchy.json` |
| Observability | `events.jsonl`, `agent-runs/*`, `environment-readiness-ledger.json`, `instruction-routing-ledger.json`, `source-of-record-ledger.json`, `provider-replacement-registry.json`, `tool-safety-ledger.json`, `context-budget-ledger.json`, `runtime-bus.json`, `function-invocation-ledger.json`, `architecture-boundary-ledger.json`, `evaluator-rubric.json`, `completion-authority-ledger.json`, `continuity-ledger.json`, `course-alignment-ledger.json`, `verification-pipeline-ledger.json`, `feedback-promotion-ledger.json`, `harness-diagnostic-ledger.json`, `repair-guidance-ledger.json`, `harness-subsystem-audit.json`, `harness-ablation-comparison.json`, `quality-document.json`, `harness-quality-ledger.json`, `lifecycle-ledger.json`, `hook-ledger.json`, `trace-context.json`, `harness-trace.json`, `harness-engineering-record.json` |
| Clean exit | validation result, feature state, progress, handoff, event ledger, run state |

## Why It Exists

Earlier eval work in this repo showed that workflow artifacts alone can look successful even when app-building workers were only planned and not truly executed. The operational record makes that distinction explicit by keeping control-plane artifacts, runtime agent evidence, validator outcomes, and clean-exit gates in one machine-readable file.

## How To Check It

Run any workflow and inspect:

```bash
node dist/cli/harnessctl.js workflows start standard \
  --source ./fixtures/design-system \
  --intent "Build a settings page using approved components only" \
  --output output/workflow-demo
```

Then inspect:

```text
output/workflow-demo/feature-list.json
output/workflow-demo/feature-scheduler.json
output/workflow-demo/environment-readiness-ledger.json
output/workflow-demo/instruction-routing-ledger.json
output/workflow-demo/source-of-record-ledger.json
output/workflow-demo/lifecycle-ledger.json
output/workflow-demo/architecture-boundary-ledger.json
output/workflow-demo/evaluator-rubric.json
output/workflow-demo/completion-authority-ledger.json
output/workflow-demo/continuity-ledger.json
output/workflow-demo/course-alignment-ledger.json
output/workflow-demo/verification-pipeline-ledger.json
output/workflow-demo/session-clean-state-ledger.json
output/workflow-demo/sprint-contract.json
output/workflow-demo/verification-hierarchy.json
output/workflow-demo/progress.md
output/workflow-demo/initialization-checklist.json
output/workflow-demo/session-handoff.md
output/workflow-demo/worker-function-registry.json
output/workflow-demo/provider-replacement-registry.json
output/workflow-demo/tool-safety-ledger.json
output/workflow-demo/context-budget-ledger.json
output/workflow-demo/function-dispatch-plan.json
output/workflow-demo/runtime-bus.json
output/workflow-demo/function-invocation-ledger.json
output/workflow-demo/feedback-promotion-ledger.json
output/workflow-demo/harness-diagnostic-ledger.json
output/workflow-demo/repair-guidance-ledger.json
output/workflow-demo/harness-subsystem-audit.json
output/workflow-demo/harness-ablation-comparison.json
output/workflow-demo/quality-document.json
output/workflow-demo/harness-quality-ledger.json
output/workflow-demo/policy-gate.json
output/workflow-demo/approval-gate.json
output/workflow-demo/budget-gate.json
output/workflow-demo/hook-ledger.json
output/workflow-demo/trace-context.json
output/workflow-demo/startup-readiness.json
output/workflow-demo/harness-engineering-record.json
```

The record should answer twenty-nine fresh-session questions without conversation context:

- Can the run start from the declared sources?
- Can a fresh session find build/test commands, progress, and scoped next work before implementation?
- Are runtime commands, dependency locks, source paths, output isolation, and repo harness guidance proven before dispatch?
- Which instruction topics were routed into this run, and why?
- Can a fresh session answer what the system is, how it is organized, how to run it, how to verify it, and what progress is current from repo/run artifacts?
- Can a fresh session resolve registered functions into dispatch routes?
- Can a fresh session see which providers can be replaced by compatibility slot?
- Can a fresh session see which context is selected, written back, compressed, and isolated before worker dispatch?
- Can a fresh session see the runtime bus topics, subscribers, publications, and state namespaces?
- Did every routed function produce agent-run, artifact-output, or validator-result evidence?
- Which review or validation signals became reusable harness-improvement candidates?
- Which harness subsystem owns each non-passing signal?
- What should the next agent do to repair each non-passing signal?
- Which harness subsystem is the current bottleneck, and what next investment should improve it?
- What evidence would be removed by excluding each harness subsystem?
- What evaluator rubric accepted or rejected the run?
- What quality document grades each harness subsystem?
- What is the run quality score/grade, and which next improvement priority should be handled first?
- Which decisions, restart inputs, next actions, and rebuild-cost estimate carry the run across sessions?
- Which single feature is active under WIP=1, and what completion pressure remains?
- Did the run move through the required lifecycle phases before claiming clean handoff?
- Did executable architecture-boundary checks pass with what/why/fix guidance available for any violation?
- Which separate planner, generator, evaluator, and authority evidence owners decide whether completion is allowed?
- Did required features reach verified completion rate 1.0 across the full verification pipeline?
- Did the session leave clean-state evidence with no stale temporary artifacts?
- Which scope surface controls what work is active?
- Which validations, authority gates, or critic gates decide completion?
- Which artifacts explain what happened and why?
- Is the run clean enough for a later session to resume?

## Course Sources

- https://walkinglabs.github.io/learn-harness-engineering/en/
- https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-01-why-capable-agents-still-fail/
- https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-02-what-a-harness-actually-is/
- https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-03-why-the-repository-must-become-the-system-of-record/
- https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-04-why-one-giant-instruction-file-fails/
- https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-05-why-long-running-tasks-lose-continuity/
- https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-06-why-initialization-needs-its-own-phase/
- https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-07-why-agents-overreach-and-under-finish/
- https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-08-why-feature-lists-are-harness-primitives/
- https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-09-why-agents-declare-victory-too-early/
- https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-10-why-end-to-end-testing-changes-results/
- https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-11-why-observability-belongs-inside-the-harness/
- https://walkinglabs.github.io/learn-harness-engineering/en/lectures/lecture-12-why-every-session-must-leave-a-clean-state/
- https://walkinglabs.github.io/learn-harness-engineering/en/resources/templates/
