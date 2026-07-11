# iii Agent Harness Reference Evaluation

Reference: Mike Piccolo, "How to Build Your Own Agent Harness", May 28, 2026, https://iii.dev/blog/how-to-build-your-own-agent-harness/

Related user reference: https://x.com/mfpiccolo/status/2060069083878408689

Evaluated system: Codex Harness Forge / Workflows in `/Users/amal/listenowl/experiments/meta-harness`

Evaluation date: 2026-06-25

## Verdict

Against the iii reference architecture, Workflows is not yet a production-grade composable agent harness.

It is currently a source-grounded workflow compiler with manifest-backed local executors, replay artifacts, validators, structured critic questions, council review, and useful app-building evaluation outputs. That is a good MVP spine, but it is still missing the core architectural property in the reference: a set of independently replaceable workers on one shared trigger/function bus.

Score against the iii-style harness substrate bar after the initialization/environment-readiness/instruction-routing/provider-replacement/dispatch/runtime-bus/invocation/startup/evaluator-rubric/feedback/diagnostic/repair-guidance/subsystem-audit/ablation-comparison/quality-document/quality/continuity/course-alignment/lifecycle runtime artifact pass: **79/100**.

Score as a workflow compiler MVP: **90/100**.

The architectural concern is real: we have moved some behavior out of TypeScript branches into capability-pack manifests, added stable worker/function contract manifests for the current runtime workers, added a dedicated initialization checklist, added an environment-readiness ledger, added an instruction-routing ledger, added a source-of-record ledger, added per-run worker/function registry, provider-replacement registry, dispatch-plan, runtime-bus, invocation-ledger, architecture-boundary-ledger, evaluator-rubric, verification-pipeline-ledger, session-clean-state-ledger, feedback-promotion-ledger, harness-diagnostic-ledger, repair-guidance-ledger, harness-subsystem-audit, harness-ablation-comparison, quality-document, harness-quality-ledger, continuity-ledger, course-alignment-ledger, and lifecycle-ledger artifacts, and added startup-readiness, policy, approval, budget, hook, and trace-context artifacts that participate in final validation. We have still not decomposed the harness into a live external shared worker bus with interactive approval handoff/resume, session trees, context compaction, externally enforced budget accounting, and connected distributed traces.

## Reference Bar

The reference argues that an agent harness is not one framework-shaped object. It is a set of jobs that should be independently replaceable:

- turn request intake and persistence;
- provider credentials;
- model capability catalog;
- durable turn state machine;
- skill/function body serving;
- prompt assembly;
- token streaming;
- tool-call policy checks;
- human approval routing;
- budget tracking;
- before/after hook fanout;
- branching sessions and resume;
- context compaction;
- UI event stream;
- one trace across every step.

The key design claim is not just "use workers". It is that every layer talks through one shared trigger/function protocol, so replacing a model catalog, policy engine, provider, approval surface, or turn orchestrator does not require rewriting neighboring layers.

## Current Evidence

The current system has these strong pieces:

- `HarnessRequest -> SourceRefs -> EvidenceGraph -> CapabilityRegistry -> HarnessDraft -> HarnessIR -> HarnessSpec`.
- Capability-pack manifests for `workflow-runtime`, `design-system-ui`, `motion-lottie`, `app-building-fullstack`, and `generic-report`.
- Manifest-resolved artifact executors, validator executors, and worker bindings.
- Worker/function contracts in `worker-contracts/` with stable contract IDs, function IDs, trigger IDs, schemas, state namespaces, event topics, adapter compatibility, and replacement keys.
- Structured `CriticReview` and `CriticQuestion` outputs from all council elders, aggregated into `council-review.json` and `council-review.md`.
- Critic validation gates: `critic_questions_present`, `blocker_questions_resolved`, and `app_prd_critic_coverage`.
- Codex-host critic request artifacts under `agent-runs/codex-host-critic-request.{json,md}`, while local deterministic critics remain the default CLI path.
- `executor-lock.json`, `worker-lock.json`, `run-plan.json`, `events.jsonl`, and `harness-trace.json`.
- `initialization-checklist.json`, `feature-scheduler.json`, `environment-readiness-ledger.json`, `instruction-routing-ledger.json`, `source-of-record-ledger.json`, `architecture-boundary-ledger.json`, `evaluator-rubric.json`, `completion-authority-ledger.json`, `feedback-promotion-ledger.json`, `harness-diagnostic-ledger.json`, `repair-guidance-ledger.json`, `harness-subsystem-audit.json`, `harness-ablation-comparison.json`, `quality-document.json`, `harness-quality-ledger.json`, `continuity-ledger.json`, `course-alignment-ledger.json`, `lifecycle-ledger.json`, `verification-pipeline-ledger.json`, `session-clean-state-ledger.json`, `worker-function-registry.json`, `provider-replacement-registry.json`, `function-dispatch-plan.json`, `runtime-bus.json`, `function-invocation-ledger.json`, `startup-readiness.json`, `policy-gate.json`, `approval-gate.json`, `budget-gate.json`, `hook-ledger.json`, and `trace-context.json` with validations `initialization_checklist_confirmed`, `feature_scheduler_ready`, `environment_readiness_confirmed`, `instruction_router_resolved`, `source_of_record_confirmed`, `architecture_boundary_rules_enforced`, `evaluator_rubric_recorded`, `completion_authority_confirmed`, `feedback_promotion_recorded`, `diagnostic_loop_recorded`, `repair_guidance_recorded`, `harness_subsystem_audit_recorded`, `harness_ablation_comparison_recorded`, `quality_document_recorded`, `harness_quality_documented`, `continuity_state_recorded`, `course_alignment_confirmed`, `lifecycle_ledger_clean`, `verified_completion_rate_passed`, `session_clean_state_ready`, `worker_function_registry_resolved`, `provider_replacement_registry_ready`, `function_dispatch_plan_resolved`, `runtime_bus_resolved`, `function_invocation_ledger_completed`, `startup_readiness_confirmed`, `policy_gate_passed`, `approval_gate_resolved`, `budget_gate_passed`, `hook_ledger_recorded`, and `trace_context_propagated`.
- Structured `routeComposition` in `HarnessSpec` and `harness-trace.json`, including matched packs, match reasons, scores, and composite-route status.
- Semantic PRD conflict notes for simple contradictions and security-specific critic questions for auth/billing/secrets/admin-risk signals.
- Runtime-planning, council-elders, and course-correction local worker groups.
- App-building evaluation cases in `examples/app-building/usecases.json`.
- Generated app-building report in `output/app-workflow-evals/evaluation-report.md`.

The app-building eval proves two things:

- Mixed UI plus motion requests can compose `design-system-ui`, `motion-lottie`, and `workflow-runtime` in one IR and run plan.
- Composite routes now expose matched packs and scores through `routeComposition` instead of only a primary archetype string.
- Broad full-stack PRDs now resolve `app-building-fullstack`, producing structured UI-flow, API-contract, persistence-plan, dependency-free `app-source/` scaffold, test-plan, acceptance, and deployment-planning artifacts. The generated source scaffold is smoke-tested, but it is still not a live framework-specific implementation worker editing a user repo.

## Scorecard

| Dimension | Reference bar | Current state | Score | Priority |
| --- | --- | --- | ---: | --- |
| Worker decomposition | Every harness concern is a separately replaceable worker on the same bus. | We have static `workerBindings`, stable worker contracts for current runtime groups, a per-run worker/function registry, a provider replacement registry with compatibility slots, a provider-route dispatch plan, a local `runtime-bus.json` contract for topics/subscribers/publications/state namespaces, and an invocation ledger that proves routed functions produced evidence. There is still no live worker registration or external shared trigger bus. | 14/20 | P0 |
| Stable function contracts | Workers register function IDs and triggers; replacement means registering the same IDs. | Worker bindings reference contract manifests with function IDs, trigger IDs, schemas, required permissions, adapter compatibility, critic output contracts, event topics, state namespaces, and replacement keys. The run now emits a dispatchable function table, maps nodes to provider routes, connects them through `runtime-bus.json`, and records invocation evidence, but it is still file-backed rather than live registration. | 14/15 | P0 |
| Durable turn/session runtime | A durable FSM persists state, resumes work, handles approvals, streams, and terminal states. | We persist run records and run artifacts. `initialization-checklist.json` proves start/test/progress/next-work readiness before execution, `feature-scheduler.json` enforces WIP=1 active feature selection, `environment-readiness-ledger.json` proves dependency locks, runtime commands, source paths, and output isolation before dispatch, `source-of-record-ledger.json` answers fresh-session system/run/verify/progress questions and records source authority, `continuity-ledger.json` records decisions, restart inputs, verification snapshot, next actions, and rebuild cost, `lifecycle-ledger.json` records ordered run phases through clean handoff, `architecture-boundary-ledger.json` records executable boundary checks, `verification-pipeline-ledger.json` records verified completion rate, `session-clean-state-ledger.json` records exit cleanliness, and `startup-readiness.json` covers sources, locks, functions, dispatch routes, gates, traces, and handoff files. There is still no per-turn FSM, branching session tree, or approval resume path. | 9/15 | P0 |
| Policy, approval, budget, hooks | Tool calls pass through policy, approval, budget, and hook fanout as enforceable runtime gates. | The runner now writes policy, approval, budget, hook-ledger, and runtime-bus artifacts, and their validations affect final status. Approval is local fail-closed rather than interactive, hooks publish into a local file-backed bus rather than an external subscriber fabric, and external budget accounting is still missing. | 10/15 | P0 |
| Observability | One OpenTelemetry trace crosses every worker and function call. | We write `events.jsonl`, `harness-trace.json`, deterministic function span IDs, `trace-context.json` with parent links, `function-invocation-ledger.json` with observed evidence for worker, artifact, and validator calls, `architecture-boundary-ledger.json` with executable boundary rules and repair guidance, `evaluator-rubric.json` with scored acceptance criteria, `continuity-ledger.json` with decisions/restart inputs/next actions/rebuild cost, `course-alignment-ledger.json` with course-principle coverage, `verification-pipeline-ledger.json` with VCR and required-level evidence, `repair-guidance-ledger.json` with what/why/fix/next-command guidance, `harness-subsystem-audit.json` with five-subsystem scores and bottleneck, `harness-ablation-comparison.json` with artifact-exclusion probe measurements, `quality-document.json` with subsystem quality modules, and `harness-quality-ledger.json` with quality score/grade plus next priorities. There is still no OTel span propagation across real model/tool calls. | 8/10 | P1 |
| Source-grounded compiler | Workflow plans are grounded in sources, evidence, artifacts, validators, critic questions, traces, harness-layer failure attribution, repair guidance, subsystem health scoring, ablation evidence, and run-quality scoring. | This is the strongest part of the system. Draft and IR verification, instruction topic routing, artifact contracts, validators, critic gates, feedback promotion, diagnostic attribution, repair guidance, five-subsystem audit scoring, artifact-exclusion comparison, and quality scoring are real. | 15/15 | Keep |
| Dynamic domain evolution | New domains come from registering capabilities/contracts/workers, not named branches or trigger words. | Manifests now cover app-building, design, motion, runtime, and generic report workflows. Route composition is structured, evidence extraction catches simple PRD conflicts and security risk signals, and `feedback-promotion-ledger.json` turns review/validation signals into durable improvement candidates. Source extraction is still shallow beyond these targeted detectors, and candidates are not yet applied automatically. | 9/10 | P0 |

Total: **79/100**.

## What Matches The Reference

1. Capability packs are the right direction.

   Adding `design-system-ui` and `motion-lottie` as manifests is closer to "install a worker" than hard-coding a named harness branch.

2. Executor and worker locks are valuable.

   `executor-lock.json`, `worker-lock.json`, and `run-plan.json` give us replayable execution evidence. `worker-lock.json` now pins each selected worker to a stable `contractId`, `functionId`, `triggerId`, state namespace, event topics, required permissions, and replacement compatibility key.

3. The app-building matrix is an honest feedback loop.

   The evaluator now proves specialized requests can compose packs, broad app PRDs resolve the app-building pack, and route composition is inspectable in the trace.

4. Runtime planning and council review add inspectability.

   The council artifacts are not a replacement for policy/approval/budget workers, but the new structured critic question layer creates a real review surface with blocker gates that can later become a model-backed worker group.

5. Runtime control gates are now visible.

   `initialization-checklist.json`, `feature-scheduler.json`, `environment-readiness-ledger.json`, `instruction-routing-ledger.json`, `source-of-record-ledger.json`, `architecture-boundary-ledger.json`, `evaluator-rubric.json`, `feedback-promotion-ledger.json`, `harness-diagnostic-ledger.json`, `repair-guidance-ledger.json`, `harness-subsystem-audit.json`, `harness-ablation-comparison.json`, `quality-document.json`, `harness-quality-ledger.json`, `continuity-ledger.json`, `course-alignment-ledger.json`, `lifecycle-ledger.json`, `verification-pipeline-ledger.json`, `session-clean-state-ledger.json`, `worker-function-registry.json`, `provider-replacement-registry.json`, `function-dispatch-plan.json`, `runtime-bus.json`, `function-invocation-ledger.json`, `startup-readiness.json`, `policy-gate.json`, `approval-gate.json`, `budget-gate.json`, `hook-ledger.json`, and `trace-context.json` make start/test/progress readiness, WIP=1 active-feature scheduling, dependency/source/output environment readiness, topic-instruction routing, source-of-record answers, source authority, executable architecture-boundary enforcement, evaluator-rubric scoring, review-feedback promotion, harness-layer diagnostic attribution, repair actions, subsystem health and bottleneck scoring, artifact-exclusion ablation measurement, quality-document handoff, run quality score/grade, continuity decisions/restart inputs/next actions/rebuild cost, course-principle coverage, ordered lifecycle phase evidence, verified completion-rate evidence, session clean-state evidence, selected functions, replacement compatibility slots, provider routes, bus topics/subscribers/publications/state namespaces, executed invocation evidence, fresh-session readiness, permission decisions, approval requirements, deterministic local budgets, hook emissions, and span propagation inspectable before completion. Their validators participate in final status and feature-state gating.

6. False success on broad app PRDs is now blocked.

   The full-stack habit tracker PRD now resolves `app-building-fullstack`; evaluator output checks UI, API, persistence, tests, acceptance, deployment planning, and validator-gated feature state.

## Where We Diverge

1. Worker registration is generated, not live.

   `workflow-runtime.json` declares local module worker bindings, `worker-contracts/` declares stable function contracts, and each run emits `worker-function-registry.json`, `provider-replacement-registry.json`, `function-dispatch-plan.json`, `runtime-bus.json`, and `function-invocation-ledger.json`. There is still no engine where independent workers register functions, triggers, topics, state namespaces, or schemas at runtime.

2. The "workers" can be identified by contract, but cannot yet be swapped independently.

   The generated `provider-replacement-registry.json` now proves compatibility slots for locked workers and executors, but replacing the current local worker executor still means editing manifest/module bindings and rebuilding. In the reference model, replacement means another worker registers the same function ID and compatibility key while the rest of the stack is unchanged.

3. The run lifecycle is artifact-oriented, not turn-oriented.

   We can persist a run, resume saved workflow requests, emit `initialization-checklist.json`, WIP=1 `feature-scheduler.json`, and `environment-readiness-ledger.json` before execution, emit `source-of-record-ledger.json` for fresh-session answers and source authority, emit `continuity-ledger.json` for decisions, restart inputs, verification snapshot, next actions, and rebuild cost, emit `course-alignment-ledger.json` for course-principle coverage, emit `lifecycle-ledger.json` for ordered run phases, emit `architecture-boundary-ledger.json` for executable boundary checks, emit `verification-pipeline-ledger.json` for VCR, emit `session-clean-state-ledger.json` for exit cleanliness, and emit `startup-readiness.json` for fresh-session checks, but we do not have a durable turn FSM with explicit states such as provisioning, assistant streaming, function execution, awaiting approval, steering, and teardown.

4. Approval, hooks, and budget are still local artifacts, not live services.

   `policy-gate.json`, `approval-gate.json`, `budget-gate.json`, `hook-ledger.json`, and `runtime-bus.json` fail closed for the local locked plan, but there is no interactive `approval::request` / `approval::resolve` handoff, no external tool-call policy worker, no external hook subscribers, and no budget record stream around individual model/tool calls.

5. Observability is local-file tracing.

   `events.jsonl`, `harness-trace.json`, registry span IDs, `trace-context.json`, and `function-invocation-ledger.json` are useful, but this is not one propagated trace across live workers, function calls, model calls, policy gates, and validators.

6. Domain creation still depends too much on our existing pack vocabulary.

   Full-stack app PRDs now compile to UI, API, persistence, schema, source scaffold, test, accessibility, and release-planning contracts. The remaining gap is live implementation workers that apply framework-specific source-tree changes in user repos.

7. Semantic understanding is targeted, not general.

   The profiler now catches known PRD contradictions and security-sensitive app signals, but this is still pattern-based extraction rather than a general source-understanding worker.

## Architecture Direction

The next architecture should preserve the compiler spine, but place it on top of a worker/function substrate.

### P0: Promote The Generated Runtime Registry Into A Live Registry

The generated runtime registry now exists as `worker-function-registry.json` plus `provider-replacement-registry.json`; `function-dispatch-plan.json` proves node-to-provider routing can be materialized from it, `runtime-bus.json` proves providers are connected to local topics/state namespaces, and `function-invocation-ledger.json` proves the local provider route produced evidence. Next, make it a live registry that defines and resolves:

- worker ID;
- function IDs;
- trigger IDs;
- input and output schemas;
- state namespaces;
- event topics;
- required permissions;
- version;
- adapter type;
- replacement compatibility rules.

Capability packs now reference worker functions by contract and each run materializes a function table. The next step is to let workers register compatible implementations without editing the capability pack or rebuilding the runtime.

### P0: Split Workflow Runtime Into Replaceable Jobs

Convert `workflow-runtime` from one manifest with three local groups into separate worker contracts:

- `workflow-intake`;
- `workflow-state`;
- `source-profiler`;
- `capability-selector`;
- `dag-compiler`;
- `executor-dispatch`;
- `validator-dispatch`;
- `policy-gate`;
- `approval-gate`;
- `trace-writer`;
- `learning-capture`.

The local module adapter can remain the first implementation, but it should sit behind the same trigger/function interface future HTTP, MCP, SDK, or process workers use.

### P0: Promote App-Building Scaffolds To Implementation Workers

Extend the `app-building-fullstack` capability pack beyond generated scaffold artifacts into implementation workers for:

- UI flow spec;
- component implementation plan;
- API route contract;
- persistence model contract;
- schema validation plan;
- test plan and commands;
- accessibility checklist;
- release checklist.

Keep improving the Markdown PRD extractor so product requirements become structured facts instead of shallow keyword-derived signals.

### P0: Replace Primary-Only Routing With Pack Scoring

Route output should expose:

- all matched packs;
- confidence per pack;
- selected artifact contracts;
- why each pack matched;
- conflicts and missing packs;
- composite workflow shape.

The current `selectedArchetype` field can remain as a compatibility label, but it should not be the main explanation.

### P1: Deepen Runtime Gates

Policy, approval, budget, and hooks now exist as local preflight artifacts. Deepen them into executable contracts:

- `policy::check`;
- `approval::request`;
- `approval::resolve`;
- `budget::check`;
- `budget::record`;
- `hook::publish_collect`.

The runner should fail closed when policy, approval, budget, or hook workers are unavailable.

### P1: Promote Trace Context

`trace-context.json` now has deterministic trace IDs and span IDs. Promote it into propagated runtime context:

- run ID;
- workflow ID;
- node ID;
- worker ID;
- function ID;
- parent span ID;
- source fact IDs;
- artifact IDs.

Later this can map to OpenTelemetry without changing the event model again.

## Bottom Line

The current system is not hard-coded in the old way anymore, and it now has a stable worker-contract boundary plus a pre-execution initialization checklist, WIP=1 feature scheduler, environment-readiness ledger, instruction-routing ledger, architecture-boundary ledger, evaluator rubric, verification-pipeline ledger, session clean-state ledger, feedback-promotion ledger, harness diagnostic ledger, repair-guidance ledger, harness subsystem audit, harness ablation comparison, quality document, harness quality ledger, continuity ledger, course-alignment ledger, lifecycle ledger, generated dispatch routes, a local runtime bus contract, invocation evidence, startup-readiness checks, runtime-control gates, hook records, and trace context. It is still not dynamic in the iii sense.

It dynamically compiles manifests and worker contracts into an initialization checklist, feature scheduler, environment-readiness ledger, instruction-routing ledger, architecture-boundary ledger, evaluator rubric, verification-pipeline ledger, session clean-state ledger, feedback-promotion ledger, harness diagnostic ledger, repair-guidance ledger, harness subsystem audit, harness ablation comparison, quality document, harness quality ledger, continuity ledger, course-alignment ledger, lifecycle ledger, local run plan, function registry, dispatch plan, runtime bus, invocation ledger, startup-readiness checklist, policy/approval/budget gates, hook ledger, and trace context. It does not yet dynamically compose independently swappable live runtime workers from an external shared bus.

The next version should treat Workflows as:

```text
source-grounded compiler
  -> initialization checklist
  -> feature scheduler
  -> environment-readiness ledger
  -> instruction-routing ledger
  -> evaluator rubric
  -> feedback-promotion ledger
  -> harness diagnostic ledger
  -> repair-guidance ledger
  -> harness subsystem audit
  -> harness ablation comparison
  -> quality document
  -> harness quality ledger
  -> continuity ledger
  -> course-alignment ledger
  -> lifecycle ledger
  -> worker/function contract registry
  -> scored capability and worker selection
  -> runtime bus contract
  -> function invocation ledger
  -> durable turn/run state machine
  -> policy/approval/budget/hook gates
  -> distributed trace
  -> replayable artifacts and validators
```

That would make `/workflows` a real harness compiler rather than a nicer command over a static local executor graph.
