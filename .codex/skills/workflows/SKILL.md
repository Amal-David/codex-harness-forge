---
name: workflows
description: Compile vague Codex requests and durable source-of-truth assets into dynamic, evidence-backed workflows with roles, artifact contracts, validators, traces, and learning capture.
---

# Workflows

Use this skill when the user invokes `/workflows`, asks for Workflows, asks for Harness Flow, wants a dynamic harness, or wants Codex to derive an execution system from a query and source-of-truth assets.

Workflows is the public name. Codex Harness Forge is the compiler and runtime that powers it.

## Core Contract

Workflows must be dynamic and source-grounded. Do not treat trigger words, slash commands, or named harnesses as the architecture. They are activation hints only.

Every workflow should be derived from:

- the user's goal and requested mode;
- durable source refs such as PRDs, repo rules, design systems, specs, assets, schemas, tests, examples, traces, or existing skills;
- available capabilities and their input/output contracts;
- artifact contracts;
- validator bindings;
- approval boundaries;
- learning-capture targets.
- durable run-management state.
- capability-pack manifests.

## Compiler Spine

Inside this repo, prefer the typed runtime spine:

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

`routeRequest()` may be used as a display or compatibility hint. It must not be the source of executable truth.
Its classification metadata should come from capability-pack `route` declarations, not TypeScript branches for named harnesses.

## Workflow Procedure

1. Normalize the request into goal, mode, constraints, source refs, expected artifacts, and risk level.
2. Load authoritative sources before deciding roles or steps.
3. Create or inspect the evidence graph.
4. Select capabilities by contract fit and validation coverage.
5. Synthesize a draft workflow containing:
   - purpose and scope;
   - required sources;
   - specialist roles;
   - artifacts and schemas;
   - validators;
   - retry/repair loops;
   - approval checkpoints;
   - trace and learning outputs.
6. Verify the draft before execution.
7. Compile to IR and verify the IR before runtime execution.
8. Execute the workflow only within the approved tool and filesystem boundaries.
9. Persist run state, trace artifacts, and saved-workflow metadata.
10. Run the GStack/GBrain/verifier council review before finalization.
11. Run validators and write trace artifacts.
12. Report what passed, what failed, and what remains unverified.

## Dynamic Design Rules

- A new domain should be expressible by registering sources, capabilities, artifact contracts, and validators rather than by hard-coding another archetype branch.
- The LLM can propose new capabilities or validators, but executable use requires an explicit registration point and a verification path.
- Trigger phrases such as "review", "motion", "design system", or "migration" should influence classification only after source evidence and capability fit are checked.
- Slash commands should activate the workflow compiler; they should not replace the compiler.
- Workflows may evolve from traces and learning suggestions, but source-of-truth files must not be silently modified.
- Persistence and flow-runtime planning are required sibling agents in every workflow.
- The council of elders is required before finalization and must produce course corrections when evidence is weak.
- Local parallel phases must write `agent-runs/*` artifacts and group manifests.
- Domain selection and DAG assembly should prefer capability-pack manifests over hard-coded trigger branches.
- Route classification should resolve from capability-pack `route` metadata, not hard-coded named harness branches.
- Artifact and validator execution should resolve from capability-pack executor bindings, not harness names.
- Runtime, council, and course-correction worker groups should resolve from capability-pack worker bindings, not private runtime agent sets.
- Council review must write `council-doctrine.json` and tie review steps to explicit GStack/GBrain doctrine principle IDs.

## Local Commands

Build first:

```bash
npm run build
```

Inspect the CLI:

```bash
node dist/cli/harnessctl.js --help
```

Start a generic workflow:

```bash
node dist/cli/harnessctl.js workflows start standard --source ./fixtures/design-system --intent "Build a reusable workflow" --output output/workflow-demo
```

Manage workflow runs:

```bash
node dist/cli/harnessctl.js workflows list
node dist/cli/harnessctl.js workflows show <run-id>
node dist/cli/harnessctl.js workflows save <run-id> --name <name>
node dist/cli/harnessctl.js workflows run <name>
node dist/cli/harnessctl.js workflows resume <run-id>
```

Run the motion workflow:

```bash
node dist/cli/harnessctl.js motion-lottie deep --source ./fixtures/motion/logo.svg --intent "Create a 4-second 30 FPS premium reveal" --output output/motion-demo
```

Run the design-system workflow:

```bash
node dist/cli/harnessctl.js design-system-ui standard --source ./fixtures/design-system --intent "Build a settings page using approved components only" --output output/design-demo
```

## Done Means

- Source refs are explicit.
- Artifact contracts are explicit.
- Validators are bound or gaps are disclosed.
- Run state is persisted.
- Executor lock, worker lock, and run plan artifacts are present.
- Council review artifacts are present.
- Council doctrine artifacts are present.
- Runtime-planning and council-elders manifests are present.
- Parallel group manifests include worker binding IDs, adapters, matched agents, and matched capabilities.
- Execution produces trace output.
- Learnings are suggested when the workflow reveals a reusable improvement.
