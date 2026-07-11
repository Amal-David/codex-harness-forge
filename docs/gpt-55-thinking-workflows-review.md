# GPT-5.5 Thinking Review of Workflows Architecture

Date: 2026-06-11

Source: Chrome / ChatGPT using the user's logged-in ChatGPT Pro account. The chat self-reported that it was running GPT-5.5 Thinking, not GPT-5.5 Pro.

## Verdict

Workflows is now meaningfully less hardcoded, but not fully dynamic.

The review's short version was:

- Dynamic graph construction is in place.
- Dynamic capability acquisition is not in place yet.
- Execution is now manifest-bound, but executable modules are still local TypeScript implementations.
- This is no longer just a static keyword router, but it is not yet a system where LLMs can safely invent and evolve workflows end to end.

## P0 Risks

- Executor bindings must become fully declarative and portable. Module exports are a good next step, but the target state is a runnable executor manifest with command, HTTP, MCP, SDK, LLM, or local module backends behind the same contract.
- EvidenceGraph should become the source of executable truth. Every selected capability, node, edge, validator, and executor binding should cite evidence references.
- HarnessIR verification must become semantic, not only structural. A valid DAG can still be wrong if artifacts, validators, permissions, or terminal conditions are mismatched.
- Verified IR should emit a portable run artifact such as `run.plan.json`, `executor.lock.json`, and optionally a generated `run.mjs` that can replay the locked plan.

## P1 Risks

- Local parallel agents are deterministic artifacts, not true independent workers. They should be represented as a worker binding type so the trace says whether a worker was local deterministic, model-backed, SDK-backed, HTTP, or MCP.
- Capability packs still mix capability declaration and execution assumptions. Longer term, split packs, contracts, executors, validators, profilers, prompts, and examples into separately versioned manifests.
- `HarnessSpec` can fossilize the old architecture if runtime continues to depend on it. `HarnessIR` should become canonical, with `HarnessSpec` as a legacy export.
- Profile construction still maps known profile types. Replace that with profiler manifests selected by evidence and source shape.
- Trace events should carry causality: `causedBy`, `inputHash`, `outputHash`, `evidenceRefs`, `validatorRefs`, and `workerId`.

## P2 Risks

- Saved workflows can become stale templates unless they pin pack/executor versions, track compatibility, and reverify before reuse.
- The test suite proves the current spine, not yet safety. Add golden traces, adversarial packs, replay tests, fake executor tests, and mutation-style validator tests.

## Recommended Next Milestone

The review proposed one concrete milestone as the credibility threshold for "dynamic":

> Add one new capability pack, with one new artifact executor and one validator, without touching TypeScript runtime code.

After the module-executor refactor, that milestone is closer: new local module executors should not require runtime adapter branches. The remaining work is to support non-TypeScript executor backends and stronger IR verification.

## Implementation Priority

1. Make `HarnessIR` the canonical execution object.
2. Remove executable meaning from `routeRequest()` entirely; keep it as display and compatibility hints only.
3. Expand executor manifests from `local:module` into a backend-neutral executor schema.
4. Emit `run.plan.json`, `executor.lock.json`, and replayable run artifacts after IR verification.
5. Add semantic IR invariants for executor coverage, artifact lineage, terminal validators, evidence citations, and permissions.
6. Replace hardcoded profile-type routing with profiler manifests.
7. Make council workers real model/SDK/executor bindings or label them as deterministic local reviewers.
8. Add regression tests proving renamed packs still work, missing evidence blocks execution, missing executors fail IR verification, and replay uses the same locked plan.

## Comparison With Claude Code Dynamic Workflows

The review characterized the systems as differently good:

- Claude Code is ahead on flexible live agent execution, background orchestration, and mature user-facing run management.
- Workflows is ahead, directionally, on source-grounded compiler shape, explicit artifact contracts, validator binding, traceability, and the possibility of deterministic verification before execution.
- Workflows should not copy Claude Code's generated JavaScript model wholesale. It should keep verified IR as the source of truth, then generate or bind orchestration from that verified IR.

## Current Status After This Review

Implemented after receiving the review:

- Executor bindings now use `local:module` with `module` and `exportName` fields.
- Artifact and validator execution now run through a generic module executor.
- Runtime no longer switches on adapter-specific strings like motion or design executor names.
- Manifest validation now rejects incomplete `local:module` executor declarations.
- `routeRequest()` now composes display classification from capability-pack `route` metadata instead of hard-coded motion/design/repair/review/migration branches.
- Manifest validation rejects invalid route metadata.
- Runtime, council, and course-correction local workers now resolve through `workerBindings` in `capability-packs/workflow-runtime.json`.
- Parallel group manifests now include the resolved worker binding, adapter, matched agents, matched capabilities, and references.
- Manifest validation rejects worker bindings with unlisted capabilities or unsupported adapters.
- Runs now write `worker-lock.json`, and `run-plan.json` nodes reference worker lock IDs.
- Council review now writes `council-doctrine.json`, with explicit GStack/GBrain principles and MIT/open-source reference metadata.
- Generic fallback report workflows now come from `capability-packs/generic-report.json`.
- Runs now write `executor-lock.json` and `run-plan.json`.
- IR verification now rejects artifact generator nodes that have no executor binding.

Still true after the latest fixes:

- Worker bindings are manifest-owned and module-bound, but the shipped worker executor is still deterministic and local.
- The next credibility milestone remains a backend-neutral worker/executor schema that can launch generated, model-backed, SDK, HTTP, MCP, or command workers after IR verification.
