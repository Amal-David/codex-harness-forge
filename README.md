# Codex Harness Forge

Codex Harness Forge compiles vague Codex requests plus durable source-of-truth assets into executable, validator-gated agent harnesses.

> **Experimental:** This project is an active research prototype. APIs, artifact formats, and runtime behavior may change without notice, and it is not intended for production use.

The user-facing activation name is **Workflows**. Use `/workflows` in Codex to compile a request into a dynamic, source-grounded workflow; Harness Forge remains the compiler/runtime under that command.

This repo implements the updated PRD's Level 1 + Level 2 MVP:

- Codex skill package: `SKILL.md`
- Local TypeScript CLI runtime: `harness-forge`
- Manifest-backed Pattern Router v0
- `SystemProfile`, `EvidenceGraph`, `HarnessDraft`, `HarnessIR`, `HarnessSpec`, and `HarnessTrace` TypeScript types
- Dynamic harness model for five subsystems, validator-owned feature state, sprint contracts, verification hierarchy, environment-readiness checks, source-of-record checks, context-budget accounting, executable architecture-boundary rules, evaluator-rubric recording, independent completion authority, quality-document recording, run-quality scoring, continuity state, verified completion-rate accounting, five-subsystem audit, ablation comparison, lifecycle handoff, and clean-exit checks
- Capability registry for profilers, agent templates, artifact generators, and validators
- Deterministic draft and IR verification before runtime execution
- Motion/Lottie harness
- Basic Design System harness
- Specialist agent role templates
- Lottie and design-system validators
- Trace, event ledger, validation report, and learning suggestion output
- Durable run-state persistence, saved workflow records, and workflow run management
- Machine-readable initialization/scope/environment/state/feedback primitives: `initialization-checklist.json`, `feature-scheduler.json`, `environment-readiness-ledger.json`, `instruction-routing-ledger.json`, `source-of-record-ledger.json`, `architecture-boundary-ledger.json`, `evaluator-rubric.json`, `evaluator-rubric.md`, `completion-authority-ledger.json`, `feedback-promotion-ledger.json`, `harness-diagnostic-ledger.json`, `repair-guidance-ledger.json`, `harness-subsystem-audit.json`, `harness-ablation-comparison.json`, `quality-document.json`, `quality-document.md`, `harness-quality-ledger.json`, `continuity-ledger.json`, `course-alignment-ledger.json`, `lifecycle-ledger.json`, `verification-pipeline-ledger.json`, `session-clean-state-ledger.json`, `feature-list.json`, `sprint-contract.json`, `verification-hierarchy.json`, `progress.md`, and `session-handoff.md`
- Replayable `executor-lock.json`, `worker-lock.json`, and `run-plan.json` artifacts derived from the verified graph
- Per-run worker/function registry plus `provider-replacement-registry.json`, `tool-safety-ledger.json`, `context-budget-ledger.json`, `function-dispatch-plan.json`, `runtime-bus.json`, `function-invocation-ledger.json`, `startup-readiness.json`, `policy-gate.json`, `approval-gate.json`, `budget-gate.json`, `hook-ledger.json`, and `trace-context.json` runtime-control artifacts
- `harness-engineering-record.json` operational record mapping each run to harness-engineering subsystems, scope gates, verification hierarchy, observability, continuity, and clean-exit checks
- GStack/GBrain-inspired council review with course-correction artifacts before finalization
- Active critic question layer with structured blocker questions, missing evidence, unsafe assumptions, and partial-status gates
- Codex-host critic request artifacts for future model-backed `/workflows` review, with deterministic local critics as the default
- Capability-pack manifests for data-driven workflow selection, route metadata, DAG assembly, executor binding, and worker binding
- Worker/function contract manifests for stable runtime worker replacement boundaries
- Quick, standard, deep, tournament, and automation mode routing
- Research/originality strategy for “think hard” and out-of-distribution exploration runs

## Install

```bash
npm install
npm run build
```

For local command-style use:

```bash
node dist/cli/harnessctl.js --help
```

## How It Works

The current runtime uses this compiler spine:

```text
HarnessRequest
  -> SourceRefs
  -> EvidenceGraph
  -> CapabilityRegistry
  -> HarnessDraft
  -> verifyHarnessDraft()
  -> HarnessIR
  -> verifyHarnessIR()
  -> DynamicHarnessModel
  -> HarnessSpec compatibility adapter
  -> feature-list.json + sprint-contract.json + verification-hierarchy.json
  -> feature-scheduler.json + initialization-checklist.json
  -> environment-readiness-ledger.json
  -> manifest-resolved artifact executors
  -> manifest-resolved validator executors
  -> manifest-resolved worker bindings
  -> executor-lock.json + worker-lock.json + run-plan.json
  -> worker-function-registry.json + provider-replacement-registry.json + tool-safety-ledger.json + context-budget-ledger.json + policy-gate.json + approval-gate.json + budget-gate.json
  -> function-dispatch-plan.json + runtime-bus.json + hook-ledger.json + trace-context.json + startup-readiness.json
  -> artifact, validator, and local worker execution
  -> deterministic critic reviews + optional Codex-host critic request artifacts
  -> instruction-routing-ledger.json + function-invocation-ledger.json + architecture-boundary-ledger.json + source-of-record-ledger.json + evaluator-rubric.json + completion-authority-ledger.json + feedback-promotion-ledger.json + harness-diagnostic-ledger.json + repair-guidance-ledger.json + harness-subsystem-audit.json + harness-ablation-comparison.json + quality-document.json + harness-quality-ledger.json + continuity-ledger.json + course-alignment-ledger.json + lifecycle-ledger.json
  -> validator-gated feature state + progress.md + session-handoff.md
  -> verification-pipeline-ledger.json
  -> session-clean-state-ledger.json
  -> harness-engineering-record.json
  -> events.jsonl + harness-trace.json
```

`routeRequest()` still exists as a compatibility/display hint, but its domain classification now comes from capability-pack `route` metadata instead of TypeScript branches for named harnesses. Executable behavior is selected from evidence, artifact contracts, validator bindings, worker bindings, executor bindings, and registered capability IDs. Runtime generation no longer branches on `spec.archetype`.

Capability-pack manifests live in `capability-packs/`. They provide the data-driven selection, route metadata, DAG assembly, artifact contract, validator binding, executor binding, and worker binding layers for runtime, motion, and design-system workflows, so trigger words are not the only source of classification truth and core workflow nodes are not hidden only in TypeScript branches.

Each route also carries `routeComposition` into `harness-spec.json` and `harness-trace.json`: matched packs, scores, match reasons, selected system types, and whether the workflow is composite. The primary archetype remains stable for compatibility, but composite pack selection is now machine-readable.

The repo now provides a `/workflows` Codex command as a thin UX activation layer. The compiler core still works through typed request/evidence/capability inputs instead of scattered trigger words, and `/harness` should not be added as the primary command.

## Dynamic Harness Model

Every compiled workflow now carries a `harnessModel` in both `HarnessIR` and `HarnessSpec`. This is the system-level contract adapted from Learn Harness Engineering:

- **Instructions**: compiled prompt, compact instruction-routing ledger, capability packs, worker contracts, permissions, and checkpoints.
- **Tools**: manifest-resolved executor and worker locks, worker/function registry, provider replacement registry, tool-safety ledger, context-budget ledger, function dispatch plan, runtime bus, function invocation ledger, policy gate, approval gate, budget gate, hook ledger, trace context, and startup-readiness checklist.
- **Environment**: source refs, system profiles, source availability gates, environment-readiness ledger, source authority, freshness metadata, and fresh-session source-of-record answers.
- **State**: initialization checklist, WIP=1 feature scheduler, context-budget write-back and compaction plan, continuity ledger, course-alignment ledger, lifecycle ledger, validator-owned feature list, progress, run state, and session handoff.
- **Feedback**: layered validation hierarchy, evaluator rubric, completion-authority ledger, quality document, run-quality ledger, course-alignment ledger, verified completion-rate ledger, council review, feedback-promotion ledger, diagnostic ledger, repair-guidance ledger, five-subsystem audit ledger, ablation comparison ledger, validation report, and repairable failure evidence.

The feature list is no longer a memo. It is the runtime scope primitive. Each required feature has a behavior, verification command, dependency list, current state, evidence, and validator IDs. `feature-scheduler.json` enforces WIP=1 before execution, selects exactly one active dependency-ready feature, and records the ready/waiting queue plus completion pressure. Required features can move to `passing` only when their validator results pass; blocked or unfinished required features produce `feature_scope_state_gated` failures or warnings.

The sprint contract and verification hierarchy give the generator and evaluator the same acceptance surface before work begins. `environment-readiness-ledger.json` proves the package manifest, runtime version, dependency lockfile, build/test commands, source availability, output isolation, and repo harness map before dispatch; missing sources fail, while intentionally source-free exploratory runs warn instead of pretending the environment is grounded. `instruction-routing-ledger.json` keeps the entry instruction layer compact by selecting applicable topic guidance on demand, budgeting the entry map and topic documents, holding back non-applicable domain guidance, and requiring source/applicability/expiry metadata for every hard constraint and topic. `context-budget-ledger.json` turns long-context discipline into a runtime gate by budgeting progressive disclosure tiers, recording SELECT/WRITE/COMPRESS/ISOLATE operations, requiring memoized builder invalidation at mutation points, and proving delegated workers have isolation boundaries. `source-of-record-ledger.json` makes the repository and run output prove that a fresh session can answer what the system is, how it is organized, how to run it, how to verify it, what progress is current, which sources are authoritative, whether knowledge may be stale, and whether state is durable. `architecture-boundary-ledger.json` turns generated app architecture rules into executable checks with what/why/fix repair guidance before full-pipeline completion is accepted. `evaluator-rubric.json` and `evaluator-rubric.md` externalize correctness, source-grounding, architecture, observability, and handoff scoring before completion authority runs. `completion-authority-ledger.json` separates planner, generator, evaluator, and final authority roles so artifact generators and workers cannot declare their own completion. `continuity-ledger.json` records the decision log, restart inputs, verification snapshot, next actions, and rebuild-cost estimate so long-running work can resume without chat history. `course-alignment-ledger.json` maps the Learn Harness Engineering lectures to concrete artifacts, validators, subsystem coverage, and planned downstream gates so course alignment is audited by the runtime instead of asserted in prose. `verification-pipeline-ledger.json` computes verified completion rate from required feature states, checks required verification layers, and records full-pipeline evidence before clean success is accepted. `session-clean-state-ledger.json` checks session exit cleanliness: startup commands declared, validation state non-failing, progress and handoff artifacts declared, evaluator rubric recorded, quality document recorded, continuity state recorded, course alignment confirmed, stale temporary artifacts absent, startup readiness available, and completion/handoff gates clean. `feedback-promotion-ledger.json` turns repairable validation signals, critic questions, missing evidence, unsafe assumptions, and course corrections into durable harness-improvement candidates. `harness-diagnostic-ledger.json` attributes failed, warning, skipped, and unresolved blocker signals to the harness subsystem that needs improvement. `repair-guidance-ledger.json` turns those non-passing signals into agent-oriented what/why/fix/next-command actions. `harness-subsystem-audit.json` scores instructions, tools, environment, state, and feedback from runtime evidence, identifies the current bottleneck, and leaves controlled ablation probes for measuring marginal subsystem value. `harness-ablation-comparison.json` measures those probes through artifact-evidence exclusion so subsystem value is compared rather than assumed. `quality-document.json` and `quality-document.md` grade each subsystem and carry the quality snapshot into the next session before the quality ledger finalizes. `harness-quality-ledger.json` scores validation posture, completion authority, subsystem health, repair backlog, ablation evidence, and handoff artifacts into an A-D quality grade plus next improvement priorities. `lifecycle-ledger.json` records ordered phases from planning and initialization through environment readiness, instruction routing, execution evidence, architecture-boundary enforcement, verification judgment, feature-state gating, source-of-record confirmation, feedback promotion, diagnostic attribution, repair guidance, subsystem audit, ablation comparison, evaluator-rubric recording, completion-authority confirmation, quality-document recording, quality documentation, continuity recording, course alignment, and clean handoff, while `progress.md` and `session-handoff.md` make each run restartable without chat history.

## Codex Slash Command

`/workflows` is installed globally at `/Users/amal/.codex/prompts/workflows.md` and mirrored in this repo at `.codex/prompts/workflows.md`.

The command should:

- normalize the user request into goal, mode, constraints, and source refs;
- load source-of-truth assets before selecting roles or steps;
- select capabilities by artifact contract and validator fit;
- verify the draft and IR before runtime execution;
- write traces, validation reports, and learning suggestions.

Trigger words can activate classification, but they must not define executable behavior.

See `docs/claude-code-vs-workflows.md` for the comparison with Claude Code dynamic workflows and the recommended architecture direction.
See `docs/gpt-55-thinking-workflows-review.md` for the external ChatGPT architecture review captured from Chrome.
See `docs/iii-agent-harness-reference-evaluation.md` for the evaluation against Mike Piccolo's iii worker-based agent harness reference.

## Run Workflows

The generic workflow surface avoids making domain harnesses the primary API:

```bash
node dist/cli/harnessctl.js workflows start standard \
  --source ./fixtures/design-system \
  --intent "Build a reusable design-system workflow" \
  --output output/workflow-demo
```

Each run writes local artifacts, `initialization-checklist.json`, `feature-scheduler.json`, `environment-readiness-ledger.json`, `instruction-routing-ledger.json`, `source-of-record-ledger.json`, `architecture-boundary-ledger.json`, `evaluator-rubric.json`, `evaluator-rubric.md`, `completion-authority-ledger.json`, `feedback-promotion-ledger.json`, `harness-diagnostic-ledger.json`, `repair-guidance-ledger.json`, `harness-subsystem-audit.json`, `harness-ablation-comparison.json`, `quality-document.json`, `quality-document.md`, `harness-quality-ledger.json`, `continuity-ledger.json`, `course-alignment-ledger.json`, `lifecycle-ledger.json`, `verification-pipeline-ledger.json`, `session-clean-state-ledger.json`, `feature-list.json`, `sprint-contract.json`, `verification-hierarchy.json`, `progress.md`, `session-handoff.md`, `executor-lock.json`, `worker-lock.json`, `run-plan.json`, `worker-function-registry.json`, `provider-replacement-registry.json`, `tool-safety-ledger.json`, `context-budget-ledger.json`, `function-dispatch-plan.json`, `runtime-bus.json`, `function-invocation-ledger.json`, `startup-readiness.json`, `policy-gate.json`, `approval-gate.json`, `budget-gate.json`, `hook-ledger.json`, `trace-context.json`, and trace files to the output directory, plus durable run state to `.harness/runs/<run-id>/run-state.json`.

Worker bindings are resolved through contract manifests in `worker-contracts/`. `worker-lock.json` records each selected worker's stable `contractId`, `functionId`, `triggerId`, state namespace, event topics, required permissions, and replacement compatibility key before the local adapter is dispatched. `worker-function-registry.json` turns those locks into the run's dispatchable function table, `provider-replacement-registry.json` maps worker and executor providers into compatibility slots that must be safe to replace, `tool-safety-ledger.json` classifies every gate/provider call as read-only or mutating, concurrent-safe or serial, and records the policy/user/project/local/session permission pipeline, `context-budget-ledger.json` records the selected context tiers, durable write-back, compaction artifacts, builder invalidation points, and worker isolation boundaries, `function-dispatch-plan.json` maps graph nodes to worker/executor provider routes, `runtime-bus.json` connects those providers to bus topics, publications, and state namespaces, `function-invocation-ledger.json` proves those routes produced agent-run, artifact-output, or validator-result evidence, `environment-readiness-ledger.json` proves the runtime environment can safely run the workflow, `instruction-routing-ledger.json` records which topic guidance is relevant, `source-of-record-ledger.json` records fresh-session answers, source authority, knowledge freshness, and ACID-style state discipline, `architecture-boundary-ledger.json` records executable layer and side-effect boundary checks, `evaluator-rubric.json` records evidence-backed evaluator dimensions, `completion-authority-ledger.json` records separated planner/generator/evaluator authority and final completion gates, `continuity-ledger.json` records decisions, restart inputs, verification posture, next actions, and rebuild cost, `course-alignment-ledger.json` records course-principle coverage, subsystem coverage, artifact coverage, and validator coverage, `verification-pipeline-ledger.json` records VCR and full-pipeline verification evidence, `session-clean-state-ledger.json` records exit cleanliness and stale-artifact checks, `feedback-promotion-ledger.json` records reusable harness-improvement candidates from review and validation signals, `harness-diagnostic-ledger.json` records which harness subsystem owns non-passing signals, `repair-guidance-ledger.json` records concrete repair actions for those signals, `harness-subsystem-audit.json` records five-subsystem health scores and the current bottleneck, `harness-ablation-comparison.json` records artifact-exclusion measurements for each subsystem probe, `quality-document.json` records per-subsystem quality modules, `harness-quality-ledger.json` records run quality score, grade, and next priorities, and `startup-readiness.json` records the fresh-session checklist. Those artifacts plus `environment-readiness-ledger.json`, `source-of-record-ledger.json`, `architecture-boundary-ledger.json`, `evaluator-rubric.json`, `completion-authority-ledger.json`, `quality-document.json`, `harness-quality-ledger.json`, `continuity-ledger.json`, `course-alignment-ledger.json`, `lifecycle-ledger.json`, `verification-pipeline-ledger.json`, `session-clean-state-ledger.json`, `provider-replacement-registry.json`, `tool-safety-ledger.json`, `context-budget-ledger.json`, `policy-gate.json`, `approval-gate.json`, `budget-gate.json`, `hook-ledger.json`, and `trace-context.json` must pass before the run can report clean success.

Run management commands:

```bash
node dist/cli/harnessctl.js workflows list
node dist/cli/harnessctl.js workflows show <run-id>
node dist/cli/harnessctl.js workflows save <run-id> --name <name>
node dist/cli/harnessctl.js workflows saved
node dist/cli/harnessctl.js workflows run <name> --output output/rerun
node dist/cli/harnessctl.js workflows resume <run-id>
```

Saved workflows live in `.harness/workflows/<name>.json`.

## Evaluate App-Building Workflows

Sample app-building usecases live in `examples/app-building/usecases.json`. They run through the public Workflows request path and score the generated harnesses for source grounding, capability-pack selection, artifact contracts, executor locks, worker locks, council review, and app-domain fit.

```bash
npm run eval:app-workflows
```

The evaluator writes:

- `output/app-workflow-evals/evaluation-results.json`
- `output/app-workflow-evals/evaluation-report.md`
- per-usecase run artifacts under `output/app-workflow-evals/runs/`

The full-stack habit-tracker case now exercises the `app-building-fullstack` pack. It should emit UI-flow, API-contract, persistence-plan, a dependency-free `app-source/` implementation scaffold, test-plan, acceptance, and deployment-planning artifacts, then pass through validator-gated feature state. The `app_source_tree_present` validator runs the generated Node smoke test, so app-building success includes executable source evidence rather than only planning contracts.

## Council Review

Every compiled workflow includes the `workflow-runtime` capability pack, whose `workerBindings` define:

- `persistence-architect`: plans durable run state, memory write-back, provenance, and sync boundaries;
- `flow-runtime-manager`: plans lifecycle, resumability, saved workflow behavior, and generated-orchestration boundaries;
- `council-gstack-critic`: reviews specialist coverage, QA/release process, routing, and inspectability using GStack-inspired practices;
- `council-gbrain-memory`: reviews brain-first lookup, durable memory, provenance, write-back, sync, and contradiction handling using GBrain-inspired practices;
- `council-verifier`: reviews validator coverage, IR grounding, failed checks, and finalization gates.

The council writes `council-review.json`, `council-review.md`, and `council-doctrine.json`. The doctrine artifact records the MIT-licensed GStack/GBrain references and the exact principles the elders applied. Finalization waits on `council_review_complete`, so course corrections are part of the workflow trace rather than a side comment.

Each council elder also emits a structured `CriticReview` with `CriticQuestion` entries. Questions include `category`, `severity`, `whyItMatters`, `evidence`, `answerRequired`, `suggestedAssumption`, and `resolution`. The aggregate council review includes a readable "Questions To Answer" section plus these validator gates:

- `critic_questions_present`: fails if the critic layer did not run or any council critic emitted an empty question list.
- `blocker_questions_resolved`: warns when unresolved blocker questions remain, which makes the final run status `partial` instead of `success`.
- `app_prd_critic_coverage`: requires UI flow, API, persistence, schema, tests, accessibility, deployment, and product-acceptance coverage for app/PRD requests, satisfied by critic questions or app-specific artifact contracts and validators.

The runtime also writes parallel subagent evidence under `agent-runs/`:

```text
agent-runs/runtime-planning-manifest.json
agent-runs/council-elders-manifest.json
agent-runs/codex-host-critic-request.json
agent-runs/codex-host-critic-request.md
agent-runs/course-correction-manifest.json
agent-runs/<node>__<agent>.json
agent-runs/<node>__<agent>.md
```

The manifests declare the execution model, the resolved `workerBindings`, matched agent IDs, node IDs, references, and artifacts for each local phase. `worker-lock.json` pins those bindings into the replayable run plan, including the council critic contract metadata and allowed `codex:host` adapter path. The current adapter is `local:module`, backed by a deterministic local worker executor; future model, SDK, HTTP, MCP, or generated-worker adapters should be added as new explicit worker binding types rather than private runtime branches.

## Capability Packs

Current packs:

- `workflow-runtime`: required pack for persistence, flow runtime, council review, course correction, run-state validation, and council validation.
- `motion-lottie`: selected by SVG/motion/Lottie evidence and declares the motion artifact contract, profiling, generation, and validators.
- `design-system-ui`: selected by component/token/design-system evidence and declares the design artifact contract, analysis, report generation, and validators.

Pack files are validated on load. Nodes may only reference capabilities listed by the pack, and malformed manifests fail before draft synthesis.

Packs may declare `route` metadata. The router uses matching pack metadata for display classification, profile hints, visible role hints, and visible validator hints. Adding a new domain should be possible by adding a new pack route plus capability contracts, not by editing `src/router/pattern-router.ts`.

Packs may also declare `executors`. An executor maps one or more declared capability IDs to a runnable adapter. The current local adapter is `local:module`, which points to a built module path plus export name. Runtime generation and validation resolve those module executors from the active `HarnessSpec` graph instead of branching on the selected harness name or adapter-specific strings.

Packs may declare `workerBindings`. A worker binding maps runtime agent groups to declared agent and capability IDs, plus the worker executor module that implements them. The current worker executor is `local:module`, which writes inspectable `agent-runs/*` evidence. This keeps runtime planning, council elders, and course correction in manifest data rather than hard-coded agent sets or private runner branches.

Every worker binding must reference a stable contract from `worker-contracts/`. The contract declares the function ID, trigger ID, schemas, state namespace, event topics, allowed adapters, permissions, and replacement compatibility key. This is the first substrate layer for future HTTP, MCP, SDK, process, or model-backed worker replacements.

## Configure

```bash
node dist/cli/harnessctl.js init
```

Creates:

```text
.harness/config.yaml
.harness/profiles/
.harness/traces/
.harness/validators/
.harness/harnesses/
```

## Run Motion/Lottie Harness

```bash
node dist/cli/harnessctl.js motion-lottie deep \
  --source ./fixtures/motion/logo.svg \
  --intent "Create a 4-second 30 FPS premium reveal" \
  --duration 4 \
  --fps 30 \
  --width 512 \
  --height 512 \
  --control background \
  --control accentColor \
  --control speed \
  --control cameraIntensity \
  --think-hard \
  --hypotheses 3 \
  --output output/motion-demo
```

Outputs include `animation.json`, `controls.json`, `preview.svg`, `preview.html`, `motion-rationale.md`, `evidence-graph.json`, `harness-ir.json`, `initialization-checklist.json`, `feature-scheduler.json`, `environment-readiness-ledger.json`, `instruction-routing-ledger.json`, `source-of-record-ledger.json`, `architecture-boundary-ledger.json`, `evaluator-rubric.json`, `evaluator-rubric.md`, `completion-authority-ledger.json`, `feedback-promotion-ledger.json`, `harness-diagnostic-ledger.json`, `repair-guidance-ledger.json`, `harness-subsystem-audit.json`, `harness-ablation-comparison.json`, `quality-document.json`, `quality-document.md`, `harness-quality-ledger.json`, `continuity-ledger.json`, `course-alignment-ledger.json`, `lifecycle-ledger.json`, `verification-pipeline-ledger.json`, `session-clean-state-ledger.json`, `feature-list.json`, `sprint-contract.json`, `verification-hierarchy.json`, `progress.md`, `session-handoff.md`, `executor-lock.json`, `worker-lock.json`, `run-plan.json`, `worker-function-registry.json`, `provider-replacement-registry.json`, `tool-safety-ledger.json`, `context-budget-ledger.json`, `function-dispatch-plan.json`, `runtime-bus.json`, `function-invocation-ledger.json`, `startup-readiness.json`, `policy-gate.json`, `approval-gate.json`, `budget-gate.json`, `hook-ledger.json`, `trace-context.json`, `harness-engineering-record.json`, `events.jsonl`, `validation-report.md`, `harness-trace.json`, `council-review.json`, `council-review.md`, `council-doctrine.json`, `run-state.json`, `skill-update-suggestions.md`, and `run-summary.json`.

## Force Hard or Original Thinking

Harness Forge supports an explicit cognitive strategy for research-oriented tasks:

```bash
node dist/cli/harnessctl.js motion-lottie deep \
  --source ./fixtures/motion/logo.svg \
  --intent "Think really hard and find an original motion direction" \
  --original \
  --hypotheses 5 \
  --ood \
  --output output/original-motion
```

This adds hypothesis-generation agents, a research critic, a validation strategist, `hypotheses.json`, `originality-rationale.md`, and validators for recorded hypotheses and validation plans.

## Run Design System Harness

```bash
node dist/cli/harnessctl.js design-system-ui standard \
  --source ./fixtures/design-system \
  --intent "Build a settings page using approved components only" \
  --output output/design-demo
```

Outputs include `component-inventory.json`, `design-system-conformance.md`, `evidence-graph.json`, `harness-ir.json`, `initialization-checklist.json`, `feature-scheduler.json`, `environment-readiness-ledger.json`, `instruction-routing-ledger.json`, `source-of-record-ledger.json`, `architecture-boundary-ledger.json`, `evaluator-rubric.json`, `evaluator-rubric.md`, `completion-authority-ledger.json`, `feedback-promotion-ledger.json`, `harness-diagnostic-ledger.json`, `repair-guidance-ledger.json`, `harness-subsystem-audit.json`, `harness-ablation-comparison.json`, `quality-document.json`, `quality-document.md`, `harness-quality-ledger.json`, `continuity-ledger.json`, `course-alignment-ledger.json`, `lifecycle-ledger.json`, `verification-pipeline-ledger.json`, `session-clean-state-ledger.json`, `feature-list.json`, `sprint-contract.json`, `verification-hierarchy.json`, `progress.md`, `session-handoff.md`, `executor-lock.json`, `worker-lock.json`, `run-plan.json`, `worker-function-registry.json`, `provider-replacement-registry.json`, `tool-safety-ledger.json`, `context-budget-ledger.json`, `function-dispatch-plan.json`, `runtime-bus.json`, `function-invocation-ledger.json`, `startup-readiness.json`, `policy-gate.json`, `approval-gate.json`, `budget-gate.json`, `hook-ledger.json`, `trace-context.json`, `harness-engineering-record.json`, `events.jsonl`, `validation-report.md`, `harness-trace.json`, `council-review.json`, `council-review.md`, `council-doctrine.json`, `run-state.json`, `skill-update-suggestions.md`, and `run-summary.json`.

## Approval Rules

Harness Forge may read sources, create local profiles/traces/artifacts, and run safe validators without approval. It must not silently modify source-of-truth files. Destructive writes, design-system changes, AGENTS.md/skill updates, PR creation, deployments, external messages, and long/costly tournament workflows require approval.

## Deferred

The MVP does not include marketplace, full automation promotion, dashboard UI, external model-backed subagent scheduling, advanced visual diff, full Figma roundtrip, or organization-level source registry.
