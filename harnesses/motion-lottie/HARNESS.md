# Motion/Lottie Harness

Generates source-grounded Lottie artifacts from SVGs, motion notes, brand colors, timing constraints, and requested controls.

## Agents

- Asset Analyst: inspect SVG groups, dimensions, paths, colors, and animatable structure.
- Motion Director: define camera language, pacing, staging, anticipation, overshoot, and final lockup.
- Prompt Specialist: rewrite the user task in precise motion/Lottie vocabulary.
- Lottie Engineer: generate `animation.json` and `controls.json`.
- Render QA: generate/inspect preview artifacts and detect technical issues.
- Motion Critic: score pacing, clarity, taste, and premium feel.
- Repair Agent: fix validation failures.
- Finalizer: package trace, report, artifacts, and learning suggestions.

## Validators

- `valid_json`
- `valid_lottie_schema`
- `duration_matches_request`
- `fps_matches_request`
- `dimensions_match_request`
- `controls_exist`
- `no_missing_image_references`
- `no_unsupported_lottie_features`
- `preview_generated`

## Outputs

- `animation.json`
- `controls.json`
- `preview.svg`
- `preview.html`
- `motion-rationale.md`
- `validation-report.md`
- `harness-trace.json`
- `skill-update-suggestions.md`
