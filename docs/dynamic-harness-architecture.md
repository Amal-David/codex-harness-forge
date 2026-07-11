# Dynamic Harness Architecture

This document captures how the meta-harness now maps Learn Harness Engineering into the runtime architecture.

## Course-Derived Requirements

- A harness is five subsystems: instructions, tools, environment, state, and feedback.
- The repository and generated run artifacts must be the system of record; conversation memory is not enough.
- Environment readiness is a runtime contract: dependency locks, runtime commands, source paths, and output isolation must be proven before dispatch.
- The entry instruction layer should be a compact router, not a giant file; detailed topic guidance should be revealed on demand.
- Context must be selected progressively, written to durable state, compressed into restart pointers, and isolated across delegated workers.
- Scope must be machine-readable. A feature row needs behavior, verification, and state.
- Passing state is owned by the harness, not the worker. A required feature can pass only through successful verification.
- Verified Completion Rate must be measured from the scope surface; clean completion requires VCR = 1.0.
- Completion requires layered validation: static/source checks, runtime/artifact checks, then system-level completion judgment.
- Completion authority must be external to the artifact generator: planner, generator, evaluator, and final authority roles need separate evidence owners.
- Non-passing signals should be attributed to the harness layer that failed: instructions, tools, environment, state, or feedback.
- Harness improvement should be guided by five-subsystem scores and bottleneck evidence, not by adding rules blindly.
- Harness subsystem value should be measured by controlled exclusions before deeper architectural investment is treated as proven.
- Each run should leave a quality document that turns validation posture, completion authority, subsystem health, repair backlog, ablation evidence, and handoff evidence into next improvement priorities.
- Observability has two layers: runtime signals plus process artifacts explaining why the run should be accepted.
- Every session must leave a clean handoff: progress, current state, validation evidence, and restart artifacts.

## Current Runtime Shape

The compiler now builds a `DynamicHarnessModel` and embeds it in `HarnessIR` and `HarnessSpec`.

```text
HarnessRequest
  -> EvidenceGraph
  -> CapabilityRegistry
  -> RouteDecision + routeComposition
  -> HarnessDraft
  -> HarnessIR + DynamicHarnessModel
  -> HarnessSpec
  -> feature-list.json + sprint-contract.json + verification-hierarchy.json
  -> feature-scheduler.json + initialization-checklist.json
  -> environment-readiness-ledger.json
  -> executor-lock.json + worker-lock.json + run-plan.json
  -> worker-function-registry.json + provider-replacement-registry.json + tool-safety-ledger.json + context-budget-ledger.json + policy-gate.json + approval-gate.json + budget-gate.json
  -> function-dispatch-plan.json + runtime-bus.json + hook-ledger.json + trace-context.json + startup-readiness.json
  -> artifact and validator execution
  -> instruction-routing-ledger.json + function-invocation-ledger.json + architecture-boundary-ledger.json + source-of-record-ledger.json + evaluator-rubric.json + completion-authority-ledger.json + feedback-promotion-ledger.json + harness-diagnostic-ledger.json + repair-guidance-ledger.json + harness-subsystem-audit.json + harness-ablation-comparison.json + quality-document.json + harness-quality-ledger.json + continuity-ledger.json + course-alignment-ledger.json + lifecycle-ledger.json
  -> validator-gated feature-list.json
  -> verification-pipeline-ledger.json
  -> session-clean-state-ledger.json
  -> progress.md + session-handoff.md
  -> harness-engineering-record.json
```

## Runtime Primitives

`feature-list.json` is the authoritative scope/state file. Each row has:

- `behavior`
- `verificationCommand`
- `state`: `not_started`, `active`, `blocked`, or `passing`
- `validatorIds`
- `dependsOn`
- `evidence`

The runtime writes an initial feature list before generation, then rewrites it after validation with validator-owned states. `feature_scope_state_gated` is the acceptance gate for this state machine.

`feature-scheduler.json` is the scheduler-owned scope-control primitive. It enforces WIP=1, selects one dependency-ready active feature before workers run, records ready and waiting queues, and exposes completion pressure. `feature_scheduler_ready` is the acceptance gate for this scheduling layer.

`sprint-contract.json` is the process contract between generator and evaluator. It records scope, exclusions, feature IDs, verification standards, and evaluator rubric dimensions.

`verification-hierarchy.json` records static, runtime, and system validation layers with actual validation statuses after execution.

`progress.md` and `session-handoff.md` are restart artifacts for the next session.

`initialization-checklist.json` is the dedicated pre-implementation initialization artifact. It proves a fresh session can find install/build/test commands, see progress, feature scope, and the scheduler-owned next feature, understand the core project structure, and pick next work before runtime workers or artifact executors run.

`environment-readiness-ledger.json` is the environment-subsystem proof. It checks that the package manifest is readable, Node/runtime expectations are declared, a dependency lockfile is present, build/test scripts exist, requested source paths are available, the output directory is isolated from sources, and repo harness guidance is present. `environment_readiness_confirmed` fails missing sources, warns for intentionally source-free exploratory runs, and passes only when the environment can support dispatch without hidden assumptions.

`instruction-routing-ledger.json` is the instruction-subsystem routing artifact. It keeps always-loaded entry guidance compact, records hard constraints, selects applicable topic documents or capability-pack guidance, proves every harness subsystem has instruction coverage, and emits `instruction_router_resolved`. The ledger now includes an instruction budget: estimated entry-map lines, hard-constraint and always-loaded-topic caps, selected versus held-back topics, per-topic line budgets, and source/applicability/expiry metadata checks so instruction bloat fails before it becomes the default startup context.

`routeComposition` is carried on both `HarnessSpec` and `harness-trace.json`. It records matched capability packs, scores, match reasons, system types, and whether the route is composite. The primary archetype remains for compatibility, but composite workflows no longer hide their pack composition in prose.

`source-of-record-ledger.json` is the repo-as-system-of-record artifact. It answers the fresh-session questions from Learn Harness Engineering: what the system is, how it is organized, how to run it, how to verify it, and what progress is current. It also records source authority, source trust order, profile freshness, and ACID-style state discipline: atomicity, consistency, isolation, and durability. `source_of_record_confirmed` is a system gate, so source authority or missing fresh-session evidence cannot be silently skipped.

`worker-function-registry.json` is the per-run function registry derived from the locked run plan. It records selected worker functions, executor functions, trigger IDs, state namespaces, event topics, adapter compatibility, node bindings, replacement keys, and deterministic trace span IDs.

`provider-replacement-registry.json` is the per-run replacement slot registry derived from the worker/function registry and dispatch plan. It records worker contract compatibility keys, executor capability compatibility keys, selected adapters, implementation bindings, route IDs, gate artifacts, node bindings, unresolved provider gaps, and `provider_replacement_registry_ready`.

`tool-safety-ledger.json` is the per-run fail-closed tool registry. It classifies gate, worker, and executor calls as read-only or mutating, concurrent-safe or serial, records protected permission patterns, and preserves the policy/user/project/local/session permission pipeline before `tool_safety_registry_ready` can pass.

`context-budget-ledger.json` is the per-run context-engineering ledger. It records progressive disclosure tiers, enforces a deterministic context budget, proves SELECT/WRITE/COMPRESS/ISOLATE operations, records memoized builder invalidation points for mutated source, artifact, provider, and validation state, and checks worker isolation boundaries before `context_budget_ready` can pass.

`function-dispatch-plan.json` maps the graph's locked nodes to provider routes derived from registered worker and executor functions. It records route IDs, provider types, implementation IDs, adapter modules, export names, gate artifacts, and trace spans so a later runtime can swap providers without changing the graph contract.

`runtime-bus.json` is the per-run shared bus contract derived from the registry, dispatch plan, and hook ledger. It records bus topics, worker/executor subscribers, declared or recorded publications, state namespace owners, and unresolved bus gaps. `runtime_bus_resolved` is a clean-success gate, so dispatchable providers must be connected to named topics and state namespaces before their execution evidence can support completion.

`function-invocation-ledger.json` compares the dispatch plan with observed execution evidence. Worker routes must have `agent-runs/*` evidence, artifact-generator routes must produce their declared artifacts, and validator routes must emit their declared validation IDs. `function_invocation_ledger_completed` is now a final-status gate, so a route that is only planned cannot silently support a clean success.

`architecture-boundary-ledger.json` records executable architecture rules for generated app source before completion judgment. It checks that generated source-tree artifacts are readable, runtime source does not directly import filesystem or child-process APIs, layer imports do not point backward from model/API/runtime code, generated package tests are rerunnable, and full-pipeline app artifacts are present. Violations include what failed, why it matters, and how to fix it, so boundary failures enter the repair loop instead of staying as vague architecture prose.

`completion-authority-ledger.json` records the independent completion-judgment protocol before VCR and clean handoff. It proves planner evidence, artifact-generator evidence, validator/council-verifier evidence, runtime invocation signals, three-layer verification coverage, and clean authority validations are present. `completion_authority_confirmed` is a system gate: workers and artifact generators can produce evidence, but they cannot authorize their own completion.

`evaluator-rubric.json` and `evaluator-rubric.md` record the evaluator's acceptance surface before completion authority is allowed to approve the run. The rubric scores correctness, source grounding, architecture, observability, and handoff from validation, council, invocation, and restart-artifact evidence. `evaluator_rubric_recorded` is a system gate; a run cannot claim independent completion if the scoring rubric is missing, circular, or non-passing.

`continuity-ledger.json` records long-running session continuity before VCR and clean handoff. It preserves the decision log, rejected alternatives, restart inputs, verification snapshot, next actions, and rebuild-cost estimate so a later session can resume from artifacts instead of chat history. `continuity_state_recorded` is a final-status gate; clean runs must have bounded rebuild cost and no missing restart artifacts, while partial or failed runs carry explicit continuity warnings or failures.

`course-alignment-ledger.json` records framework alignment against the Learn Harness Engineering course before VCR and clean handoff. It maps twelve course requirements to current artifacts, planned artifacts, validators, planned downstream gates, and five-subsystem coverage. `course_alignment_confirmed` is a final-status gate; clean runs must pass all course requirements, partial runs carry warning coverage, and failed runs carry explicit failed course-alignment requirements.

`verification-pipeline-ledger.json` records the completion proof for the whole run. It computes verified completion rate from required feature states, checks required static/runtime/system verification levels, ignores its own validator to avoid a self-cycle, and lists the full-pipeline evidence that must exist before clean success. `verified_completion_rate_passed` is a final-status gate; warnings keep runs partial and blocked required features fail the run.

`session-clean-state-ledger.json` records the exit-cleanliness proof for the run. It checks that startup commands are declared, validation state is non-failing, progress and handoff artifacts are declared, continuity state is recorded, course alignment is confirmed, stale temporary artifacts are absent from the run output, startup readiness is available, and completion/handoff gates are clean. `session_clean_state_ready` is a final-status gate that runs after verified completion-rate evidence to avoid circular completion checks.

`feedback-promotion-ledger.json` records the harness-improvement loop for each run. Repairable validation failures or warnings, critic questions, council findings, missing evidence, unsafe assumptions, and course corrections become durable candidates for future validators, harness rules, agent instructions, evidence checks, capability packs, or approval gates. `feedback_promotion_recorded` is a final-status gate, so review feedback cannot stay only in prose when it affects completion quality.

`harness-diagnostic-ledger.json` records the diagnostic loop for each run. Failed, warning, skipped, and unresolved blocker signals are attributed to the harness subsystem that owns the improvement: instructions, tools, environment, state, or feedback. `diagnostic_loop_recorded` is a final-status gate for attribution, but it does not convert underlying failures into success.

`repair-guidance-ledger.json` turns failed, warning, skipped, and unresolved blocker signals into agent-oriented repair actions. Each action records what failed, why it matters, how to fix it, the next command to run, evidence, and the owning harness subsystem. `repair_guidance_recorded` is a final-status gate, so a non-passing signal cannot be left as a vague failure message.

`harness-subsystem-audit.json` scores instructions, tools, environment, state, and feedback from runtime evidence after diagnostic attribution and repair guidance. It records a score, missing audit-stage artifacts, validation summary, repair signals, current bottleneck, next harness investment, and a controlled ablation probe for each subsystem. `harness_subsystem_audit_recorded` is a final-status gate for recording the audit, while underlying subsystem failures still control the run's final status.

`harness-ablation-comparison.json` measures each subsystem audit probe through artifact-evidence exclusion. It records which artifacts, validation gates, diagnostic signals, repair actions, and evidence references would be removed for each subsystem, projects the regression signal, and identifies the primary marginal subsystem for the next isolated branch-level experiment. `harness_ablation_comparison_recorded` is a final-status gate for recording the comparison.

`quality-document.json` and `quality-document.md` record the per-run quality document before the quality ledger finalizes. They grade each harness subsystem, preserve key gaps, summarize repair and ablation posture, and carry next quality priorities into a fresh session. `quality_document_recorded` is a final-status gate that keeps clean handoff from depending only on an aggregate score.

`harness-quality-ledger.json` records run quality after completion authority, subsystem audit, and ablation comparison are available. It scores validation posture, completion authority, subsystem health, repair backlog, ablation coverage, and handoff artifacts into a 0-100 score plus A-D grade, then records the next improvement priorities. `harness_quality_documented` is a final-status gate: clean runs must document pass/A-level quality, partial runs carry warning priorities, and failed runs carry failure priorities.

`lifecycle-ledger.json` records ordered lifecycle phases for the run: plan locked, initialization ready, feature scheduled, environment ready, instructions routed, runtime control ready, execution evidenced, architecture boundaries enforced, verification judged, feature-state gated, source-of-record confirmed, feedback promoted, diagnostic loop recorded, repair guidance recorded, subsystem audit recorded, ablation comparison recorded, evaluator rubric recorded, completion authority confirmed, quality document recorded, quality documented, continuity recorded, course alignment confirmed, and clean handoff ready. `lifecycle_ledger_clean` is a final-status gate, so a run cannot report clean success without ordered lifecycle evidence and restart artifacts.

`policy-gate.json` is a fail-closed pre-dispatch policy artifact. It checks selected adapters and required permissions from worker contracts, and it records one allow/deny decision per worker or executor.

`approval-gate.json` is a fail-closed approval resolver artifact. Normal local read/write runs record that no approval is required; any destructive, source-of-truth, external-side-effect, or human-review permission must be resolved before a clean success.

`budget-gate.json` is a deterministic local budget envelope for the run. It records node-level allocations and estimated local calls before runtime work is summarized.

`hook-ledger.json` records local hook fanout for gate checks and dispatchable worker/executor functions. Its emissions are also published into `runtime-bus.json`. The bus is still local and file-backed rather than a live external event broker, but every generated run now has durable hook and bus records.

`trace-context.json` records deterministic parent/child spans for the run, plan, gates, provider replacement registry, tool-safety ledger, context-budget ledger, runtime bus, hook ledger, graph nodes, worker functions, and executor functions. It gives the current local trace a shape that can later map to OpenTelemetry.

`startup-readiness.json` records the fresh-session checklist: declared sources, locked run plan, environment readiness, instruction routing, source-of-record answers, registered functions, provider replacement slots, tool-safety classifications, context-budget accounting, dispatch routes, gates, runtime bus, hook/trace records, architecture-boundary evidence, evaluator-rubric evidence, completion-authority evidence, feedback promotion, diagnostic attribution, repair guidance, subsystem audit, ablation comparison, quality document, quality ledger, continuity ledger, lifecycle ledger, verification-pipeline ledger, session clean-state ledger, and handoff artifacts. It is the machine-readable answer to whether a new session can resume the run without chat history.

The source profiler now emits semantic conflict notes for simple PRD contradictions, and council critics add security-specific review questions when authentication, authorization, billing, audit, API key, impersonation, privilege, or secret-management signals appear.

## Remaining Architecture Gaps

- App-building/API/persistence now has a PRD-grounded capability pack that produces contracts, plans, and a dependency-free `app-source/` scaffold with a Node smoke test. It still needs live implementation workers for framework-specific source-tree changes in real user repos.
- The feature state machine and WIP=1 scheduler are per-run. Persisted cross-run feature state should be added when saved workflows resume multi-session implementation.
- The verification hierarchy is generated from validator metadata, but richer pack-level declarations for static/runtime/system layers would make it less heuristic.
- Worker/function contracts now produce a per-run environment-readiness ledger, instruction-routing ledger, source-of-record ledger, registry, provider replacement registry, tool-safety ledger, context-budget ledger, dispatch plan, runtime bus, invocation ledger, architecture-boundary ledger, evaluator rubric, completion-authority ledger, quality document, continuity ledger, verification-pipeline ledger, session clean-state ledger, feedback-promotion ledger, harness diagnostic ledger, repair-guidance ledger, harness subsystem audit, harness ablation comparison, harness quality ledger, lifecycle ledger, startup-readiness checklist, policy, approval, budget, hook, and trace-context artifacts, but they are still file-backed and locally dispatched. There is not yet live worker registration, interactive approval handoff/resume, an external event broker, externally enforced budget accounting, or OpenTelemetry-style cross-worker trace propagation.
- Instruction routing now records applicable topics per run. It does not yet measure real instruction SNR across repeated task attempts or automatically delete stale guidance.
- Review-feedback promotion now emits durable improvement candidates. Automatically applying repeated candidates as new validators, harness rules, or capability-pack updates remains future work.
- The subsystem audit now records probes and the ablation comparison measures artifact-evidence exclusion per run, but it does not yet execute isolated branch-level reruns or compare before/after score deltas under real disabled subsystem gates.
- Repair guidance now turns non-passing signals into agent-oriented actions. It does not yet execute those repairs automatically or rerun a bounded retry loop after applying them.
