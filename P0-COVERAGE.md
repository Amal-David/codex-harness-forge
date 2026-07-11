# P0 Coverage

| ID | Requirement | Evidence |
|---|---|---|
| FR-001 | Invoke Harness Forge from Codex using a skill command | `SKILL.md`; `bin/harness-forge.js`; `src/cli/harnessctl.ts` |
| FR-002 | Classify user request into harness archetype | `src/router/pattern-router.ts`; router test |
| FR-003 | Choose quick, standard, deep, tournament, automation mode | `normalizeMode` and `inferMode` in router |
| FR-004 | Ingest skill instructions | `SKILL.md`; source type `skill`; harness docs under `harnesses/` |
| FR-005 | Build a basic SystemProfile | `src/profiler/source-profiler.ts` |
| FR-006 | Compile a HarnessSpec | `src/compiler/harness-spec-compiler.ts` |
| FR-007 | Define specialist agent roles | `buildAgent`; `harnesses/*/agents/*.md` |
| FR-008 | Spawn or simulate specialist subagents | `src/runtime/trace-writer.ts` records simulated agent runs |
| FR-009 | Generate domain-specific prompts | `src/compiler/domain-prompt-compiler.ts` |
| FR-010 | Run artifact-specific validators | `src/validators/lottie`; `src/validators/design-system` |
| FR-011 | Produce structured trace | `harness-trace.json`; `schemas/trace.schema.json` |
| FR-012 | Propose skill updates after a run | `src/learning/learning-suggestions.ts`; `skill-update-suggestions.md` |
| FR-013 | Lottie/Motion supports SVG input | `src/profiler/motion-profiler.ts`; motion fixture/test |
| FR-014 | Lottie/Motion supports FPS and duration constraints | CLI flags; lottie validators |
| FR-015 | Validates Lottie JSON | `valid_json`; `valid_lottie_schema` |
| FR-016 | Renders preview | `preview.svg` and `preview.html`; `preview_generated` validator |
| FR-017 | Exposes requested controls | `controls.json`; `controls_exist` validator |
| FR-018 | Design System inventories components | `inventoryDesignSystem`; design-system test |
| FR-019 | Detects token usage | `token_usage_detected` validator |
| FR-020 | Detects raw colors | `raw_color_detection` validator |
| FR-021 | Checks valid imports | `valid_import_paths` validator |
| FR-022 | Must not silently modify source-of-truth files | Runtime writes only to output dirs; approval rules in README/SKILL |
| FR-023 | Must request approval for destructive writes | `PermissionSpec`; checkpoints in compiler; README/SKILL |
| FR-024 | Produce final report with artifacts and validation status | `validation-report.md`, `harness-trace.json`, CLI summary |

## Xplore Update: Hard/Original Thinking

| Capability | Evidence |
|---|---|
| User can prompt the harness to think hard | CLI `--think-hard`; natural-language router matches "think hard" |
| User can force original/non-obvious exploration | CLI `--original`; `CognitiveStrategy.originalityRequired` |
| Harness records hypotheses before implementation | `hypotheses.json`; `hypotheses_recorded` validator |
| Harness validates/falsifies hypotheses | `hypothesis_validation_plan_present` validator; `cognitiveStrategy.validationPlan` |
| Harness supports out-of-distribution research candidates | CLI `--ood`; `CognitiveStrategy.outOfDistributionExploration`; research critic and validation strategist agents |
