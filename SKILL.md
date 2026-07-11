---
name: codex-harness-forge
description: Compile source-of-truth assets, skills, repo rules, and user intent into executable Codex harnesses with specialist roles, validators, traces, and learning suggestions.
---

# Codex Harness Forge

Use this skill when a user asks for a reusable harness, a source-grounded multi-agent workflow, a Lottie/motion harness, a design-system UI harness, or a validated traceable build/review/repair workflow.

## Workflow

1. Identify the requested harness archetype and mode from capability-pack route metadata and source evidence.
2. Load durable sources of truth before relying on generic knowledge.
3. Compile a `SystemProfile`, `HarnessIR`, `HarnessSpec`, and dynamic harness model.
4. Externalize scope into `feature-list.json`, `sprint-contract.json`, and `verification-hierarchy.json`.
5. Run or simulate specialist agents with scoped source access.
6. Validate artifacts before declaring success; only the runtime may move required features to `passing`.
7. Produce artifacts, `progress.md`, `session-handoff.md`, `harness-trace.json`, `validation-report.md`, council review/doctrine artifacts, and `skill-update-suggestions.md`.
8. Propose source-of-truth updates; do not silently modify AGENTS.md, skills, design-system files, release config, or external systems.

## Hard/Original Thinking

When the user asks to "think hard", "think really hard", "come up with original stuff", conduct research, or explore out-of-distribution candidates, compile a cognitive strategy into the harness:

- generate multiple explicit hypotheses before implementation;
- add hypothesis generator, research critic, and validation strategist roles;
- validate or falsify hypotheses with source evidence and artifact validators;
- produce `hypotheses.json` and `originality-rationale.md`;
- prefer original candidates only when they still pass source-conformance and safety checks.

## Local Runtime

```bash
npm install
npm run build
node dist/cli/harnessctl.js init
node dist/cli/harnessctl.js motion-lottie deep --source ./logo.svg --intent "Create a 4-second 30 FPS premium reveal" --duration 4 --fps 30 --control background --control accentColor --control speed --control cameraIntensity
node dist/cli/harnessctl.js motion-lottie deep --source ./logo.svg --intent "Think hard and find an original reveal" --original --hypotheses 5 --ood
```

## Approval Rules

Approval is required for destructive writes, source-of-truth writes, external side effects, deployments, PR creation, and long/costly tournament workflows. Reading sources, creating local traces, generating local artifacts, and running safe validators can proceed without approval.
