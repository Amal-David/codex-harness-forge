---
description: Compile a request into an evidence-backed Codex workflow harness
argument-hint: "[goal, sources, mode, constraints]"
---

# Workflows

Use this command to turn the user request into a source-grounded, validator-backed Codex workflow.

<workflow_request>
$ARGUMENTS
</workflow_request>

## Operating Rules

- Treat Workflows as the public name for Harness Flow and Codex Harness Forge.
- If the `$workflows` skill is available, load it and follow it.
- Use this workspace's `PRD.md`, `README.md`, `AGENTS.md`, schemas, source files, harnesses, fixtures, and existing traces as authoritative context.
- Do not route by fixed trigger words alone. Build the workflow from the goal, source refs, constraints, available capabilities, artifact contracts, and validators.
- Use capability-pack `route` metadata for display classification when the local runtime supports it.
- Resolve artifact and validator execution through capability-pack executor bindings when the runtime supports them.
- Resolve runtime, council, and course-correction worker groups through capability-pack worker bindings when the runtime supports them.
- Do not set up or prefer `/harness`; `/workflows` is the activation command.
- Ask for clarification only when the workflow cannot be safely inferred from the request or local sources.

## Dynamic Workflow Shape

1. Normalize the goal, mode, constraints, and source refs from the request.
2. Build an evidence graph from source-of-truth files, repo rules, examples, schemas, tests, assets, and prior traces.
3. Select capability packs and capabilities by artifact contract and validator fit, not by hard-coded archetype names.
4. Synthesize a draft workflow with roles, artifacts, validation, retry policy, approvals, and learning capture.
5. Compile a dynamic harness model: five subsystems, validator-owned feature state, sprint contract, verification hierarchy, lifecycle handoff.
6. Include persistence and flow-runtime planning as required parallel agents.
7. Include the GStack/GBrain/verifier council review before finalization.
8. Verify the draft for grounded sources, complete artifact contracts, validator coverage, feature-state coverage, and explicit human checkpoints.
9. Execute with the narrowest safe tool surface, persist run state, record traces, run validators, update feature state, and report unverified gaps plainly.

## Local Runtime

Build before CLI execution:

```bash
npm run build
```

Inspect available runtime options:

```bash
node dist/cli/harnessctl.js --help
```

## Done Means

- The workflow is grounded in named sources.
- Roles and steps are derived from capabilities and validators.
- Required artifacts have contracts.
- `feature-list.json` exists and required features only reach `passing` through runtime-owned validator results.
- `sprint-contract.json`, `verification-hierarchy.json`, `progress.md`, and `session-handoff.md` are present for process/state continuity.
- Validation is run or explicitly marked unverified.
- Learnings or source-sync suggestions are captured when the run changes future behavior.
- Run state and council review artifacts are present.
- Council doctrine artifacts are present when council review runs.
- Executor lock, worker lock, and run plan artifacts are present when a runtime executes.
- Parallel agent-run manifests include resolved worker bindings when runtime or council agents execute.
