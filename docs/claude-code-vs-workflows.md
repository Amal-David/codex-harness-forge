# Claude Code Dynamic Workflows vs Codex Workflows

Date: 2026-06-11

This is an objective comparison between Claude Code dynamic workflows and this repo's Workflows architecture, formerly called Harness Flow. The public command name for this project should be **Workflows**; Codex Harness Forge remains the compiler/runtime implementation.

## Source Boundary

Claude Code is publicly hosted, but it is not open source in the normal OSI sense. The public `anthropics/claude-code` repository describes Claude Code as an agentic coding tool and includes plugins, docs, and install entry points. Its license file says Anthropic retains all rights and use is governed by Anthropic's commercial terms:

- https://github.com/anthropics/claude-code
- https://github.com/anthropics/claude-code/blob/main/LICENSE.md

I did not decompile the installed binary or use leaked source. I used public Anthropic docs plus black-box local inspection of user-visible settings and session artifact shape. Locally, Claude Code is installed as `2.1.173`, `~/.claude/settings.json` enables hooks and experimental agent teams, and prior session storage shows workflow run artifacts under `~/.claude/projects/.../workflows/` and `~/.claude/projects/.../subagents/workflows/<wf_id>/`.

## What Claude Code Implements

Claude Code has a first-party dynamic workflows feature:

- A workflow is a JavaScript orchestration script that Claude writes for the task.
- The runtime executes that script in the background while the main session stays responsive.
- The script coordinates many subagents; intermediate results live in script variables rather than in the main conversation context.
- The generated script is written under the session directory, can be inspected, edited, relaunched, and saved for reuse.
- Saved workflows live at `.claude/workflows/` for project scope or `~/.claude/workflows/` for personal scope, and later run as `/<name>`.
- `/workflows` in Claude Code is a run-management view for active/completed workflow runs.

The official docs also define constraints that matter architecturally:

- no mid-run user input except agent permission prompts;
- the workflow script itself has no direct filesystem or shell access;
- agents do the reading, writing, and command execution;
- up to 16 concurrent agents, capped by local resources;
- up to 1,000 agents per run;
- spawned agents run in `acceptEdits` mode and inherit the user's tool allowlist.

Claude Code's surrounding dynamic system includes:

- skills, where `.claude/skills/<name>/SKILL.md` creates `/<name>` and can also be invoked automatically when relevant;
- custom slash commands, where markdown files expand into prompts;
- subagents with isolated context windows, focused system prompts, tool restrictions, and description-based delegation;
- hooks such as `UserPromptSubmit`, `UserPromptExpansion`, `PreToolUse`, and `PostToolUse`, which provide deterministic lifecycle interception.

## What Our Workflows Architecture Implements

Codex Workflows currently has a compiler-like spine:

```text
HarnessRequest
  -> SourceRefs
  -> EvidenceGraph
  -> CapabilityRegistry
  -> HarnessDraft
  -> verifyHarnessDraft()
  -> HarnessIR
  -> verifyHarnessIR()
  -> HarnessSpec compatibility adapter
  -> manifest-resolved artifact executors
  -> manifest-resolved validator executors
  -> manifest-resolved worker bindings
  -> executor-lock.json + worker-lock.json + run-plan.json
  -> events.jsonl + harness-trace.json
```

The important design choice is that executable behavior should be selected from evidence, artifact contracts, validator bindings, worker bindings, executor bindings, and registered capability IDs. `routeRequest()` is allowed as a compatibility/display hint, but its domain classification is now read from capability-pack `route` metadata rather than named harness branches in TypeScript.

This is the right core, because it makes Workflows verifiable. The weak part is the activation and evolution surface: the current product still exposes domain-shaped CLI affordances such as `motion-lottie` and `design-system-ui`, and much of the repo still includes seeded harness folders. Those should be treated as starter capabilities and docs, not the architecture.

## Direct Comparison

| Dimension | Claude Code Dynamic Workflows | Codex Workflows |
| --- | --- | --- |
| Primary abstraction | Generated JavaScript orchestration script | Verified evidence/capability/IR pipeline |
| Who holds the plan | Script runtime | HarnessDraft/HarnessIR plus runtime runner |
| Dynamic generation | Claude writes a task-specific script | LLM/compiler synthesizes a draft and IR from evidence |
| Grounding model | Prompt, subagent context, files/tools used by agents | EvidenceGraph with explicit source refs |
| Verification | Cross-checking agents and final synthesis, depending on generated script | Deterministic draft/IR checks plus bound validators |
| Parallelism | First-class background runtime, many subagents | Verified DAG exposes parallel branches; local MVP resolves runtime/council roles from manifest worker bindings and executes bound local worker modules |
| Reuse | Save generated scripts as commands in `.claude/workflows` or `~/.claude/workflows` | Save run records as named workflows in `.harness/workflows/`, then rerun or resume from CLI |
| User control | Approval card, `/workflows` run view, `/tasks`, settings toggles | `workflows start/list/show/save/saved/run/resume`, trace files, validation report, council review |
| Evolvability | Script can be inspected, edited, saved, rerun | Registry, validators, traces, and learning suggestions can evolve the compiler |
| Failure mode | Generated script may encode weak assumptions but run very efficiently | Compiler may be over-structured and still domain-shaped if registries are too static |

## Objective Verdict

Claude Code is still ahead on high-scale external subagent orchestration. It has a real background workflow runtime, interactive run management, persistence, resumability, script inspection, and many-agent execution.

Codex Workflows is ahead on verifier shape and now has a first durable run-management layer. It has the more future-proof core if the goal is to make outputs source-grounded, contract-aware, council-reviewed, and validator-gated rather than merely well-orchestrated.

The best architecture is not to copy Claude's workflow script model wholesale. The right path is to combine the two:

```text
User request
  -> /workflows activation
  -> request normalizer
  -> EvidenceGraph
  -> dynamic capability selection
  -> verified HarnessDraft
  -> verified HarnessIR
  -> generated orchestrator/run plan
  -> agents and tools
  -> validators
  -> trace
  -> learning proposal
```

In other words: keep our compiler/verifier as the source of truth, then add a generated orchestration layer after IR verification.

## Implemented Since This Review

The repo now implements the first version of the recommended control plane:

- `harnessctl workflows start` as the domain-neutral compile/run surface;
- `.harness/runs/<run-id>/run-state.json` plus `.harness/runs/index.json` for durable run persistence;
- `.harness/workflows/<name>.json` for saved reusable workflows;
- `workflows list`, `show`, `save`, `saved`, `run`, and `resume`;
- `persistence-architect` and `flow-runtime-manager` as parallel runtime planning agents in the verified DAG;
- a GStack/GBrain/verifier council review that writes `council-review.json`, `council-review.md`, and `council-doctrine.json`;
- separate `agent-runs/*` artifacts and parallel group manifests for runtime planning, council elders, and course correction;
- capability-pack manifests in `capability-packs/` for workflow-runtime, motion-lottie, design-system-ui, and generic-report selection, route metadata, and DAG assembly;
- pack validation that rejects nodes referencing capabilities not declared by the pack;
- route metadata validation that rejects invalid harness archetypes and profile hints;
- manifest-declared executor bindings that map active graph capability IDs to local module exports for artifact and validator execution;
- manifest-declared worker bindings that map runtime planning, council elders, and course correction to bound local worker modules;
- `council-doctrine.json`, which records MIT-licensed GStack/GBrain reference doctrine and connects review steps to explicit principles;
- replay artifacts, `executor-lock.json`, `worker-lock.json`, and `run-plan.json`, derived from the active graph, executor bindings, and worker bindings;
- IR verification that rejects artifact generator nodes with no executor binding;
- pack validation that rejects worker bindings with unlisted capabilities or unsupported adapters;
- `run_state_persisted` and `council_review_complete` validators, with finalization downstream of council validation.

See `docs/gpt-55-thinking-workflows-review.md` for the external ChatGPT review requested through Chrome. That review self-reported GPT-5.5 Thinking, not GPT-5.5 Pro, and its main critique was that Workflows now has dynamic graph construction but still needs dynamic capability acquisition, portable run plans, and stronger semantic IR verification.

## Architecture Fixes Still Needed

1. Make execution fully externalizable.

   Capability-pack selection, DAG assembly, local module executor binding, worker module binding, worker locking, and replay artifacts are now manifest-backed, but executable modules and workers are still local TypeScript/deterministic implementations. The next step is schema-validated execution definitions that can launch generated/model-backed workers after verified IR.

2. Treat seeded harnesses as registry data.

   `harnesses/motion-lottie` and `harnesses/design-system-ui` should become examples of capability packs. The compiler should select them because their contracts match the request, not because an archetype branch won.

3. Add generated orchestration after IR verification.

   Do not let generated scripts replace the compiler. Generate orchestration from verified IR so it can parallelize agents without smuggling in unverified sources or missing validators.

4. Keep trigger-word discipline.

   Slash commands, keywords, and natural-language cues should activate classification only. Route classification now comes from pack metadata, and workflow structure must continue to come from source refs, capability contracts, and validators.

5. Add an evolution protocol.

   Traces should produce reviewable patches to capability packs, skills, validators, or repo instructions. No source-of-truth file should be silently modified.

## Naming Decision

Use **Workflows** as the public name:

- Codex command: `/workflows`
- Product surface: Workflows
- Internal compiler/runtime: Codex Harness Forge
- Legacy phrase: Harness Flow

Avoid `/harness` as the public command. It sounds internal and will push users toward static harness thinking. `/workflows` points at the actual user value: dynamic, evolving execution systems.

## Bottom Line

The worry that the current repo is still too hard-coded remains partly valid at the concrete execution layer, but the control plane is now moving in the right direction. The core compiler is good, and Workflows now has a more dynamic entry point, durable run state, saved workflow reuse, manifest-backed capability-pack DAG assembly, manifest-backed worker groups, separate local agent-run artifacts, and a required council review. Claude Code proves that generated orchestration scripts are a strong way to scale subagents, but it also shows why our verifier-first design matters: a script can coordinate many agents without necessarily proving that the right sources, contracts, validators, and approval boundaries were selected.

The next major implementation step should be: schema-validated capability-pack execution -> verified IR -> optional generated/model-backed orchestrator.
