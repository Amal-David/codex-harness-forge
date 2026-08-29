# 24-agent council for `matrices.fast`

The council is organized around independent falsifiable responsibilities rather than generic “try another ordering” prompts. Every agent must preserve the AMD floor, deterministic output, the `src/ordering/` boundary, and the hard per-matrix watchdog. No agent may use matrix names, corpus indices, wall-clock branching, persistent state, or hidden-answer memorization.

## Mathematical agents

### P01 — Exact symbolic flop analyst
Derive local and global surrogates for `Σ c_j²`; identify where fill and flop objectives disagree; design exact local rescoring tests.

### P02 — Elimination-tree analyst
Study how candidate moves change ancestor reach, front width, and subtree coupling; propose leverage-ranked local moves.

### P03 — Chordal completion theorist
Work on safe fill-edge deletion, minimal triangulations, alternative deletion schedules, and proofs that candidate completions remain chordal.

### P04 — Graph-width and separator theorist
Detect low-treewidth or separator-rich structure and determine when nested dissection can plausibly beat the quotient-graph family.

### P05 — Quotient-graph mathematician
Design degree, deficiency, supernode-weight, external-boundary, and second-moment pivot objectives compatible with near-linear quotient updates.

### P06 — KKT structural mathematician
Infer primal/dual/slack, arrowhead, block-angular, temporal, network, and scenario structure from the unlabeled sparsity pattern.

## Algorithm engineers

### P07 — AMD/AMF kernel engineer
Audit pivot queues, absorption, tie breaks, dense-element policy, quotient-state reuse, and task-neutral alpha/metric replacements.

### P08 — Completion-descent engineer
Implement affected-edge queues, incremental common-neighbor tests, bounded deletion yield, and alternative completion realizations.

### P09 — Nested-dissection engineer
Audit partitioner gates, separator order, leaf solvers, component reuse, and zero-win partitioner removal.

### P10 — Local-search engineer
Design adjacent-swap, insertion, block reversal, subtree permutation, and exact-small-block improvements under strict operation budgets.

### P11 — Graph kernelization engineer
Develop connected-component, bridge, articulation, biconnected, twin, simplicial, almost-simplicial, leaf, and degree-two reductions.

### P12 — Portfolio selector engineer
Instrument winner attribution, duplicate permutations, runner-up margins, cost/benefit, and structural class selection.

## Systems agents

### P13 — Rust hot-loop engineer
Remove allocation, cloning, clearing, sorting, and binary-search overhead; reuse buffers and packed sparse structures without changing output.

### P14 — Parallelism engineer
Eliminate nested oversubscription, rebalance waves, preserve deterministic merge order, and price task-carrier overhead.

### P15 — Memory-cap engineer
Audit peak allocations against the 4 GiB hidden limit and ensure compact representations on the largest patterns.

### P16 — Compiler/codegen engineer
Inspect monomorphization, inlining, branch predictability, integer arithmetic, and compile-time elimination of disabled phases.

### P17 — Watchdog-risk engineer
Model the asymmetric 2 s failure risk; prefer operation-count proofs, reductions in work, and robust headroom over noisy local timing.

### P18 — Sandbox/purity engineer
Continuously verify pure Rust, approved dependencies, no FFI/build tricks, sandboxed builds, and strict source-path containment.

## Scientific-method agents

### P19 — Causal ablation scientist
Run phase-off and downward-budget curves; distinguish a phase’s own candidate quality from downstream seed/slack effects.

### P20 — Experimental-design scientist
Pin exact source SHAs, use paired per-matrix deltas, archive evidence, avoid cross-frontier comparisons, and require reproducibility.

### P21 — Hidden-distribution adversary
Stress every gate against unseen hubs, stars, cliques, arrows, power-law graphs, block-angular graphs, and structural family shifts.

### P22 — Eval-transfer scientist
Compare development, reconstructed evaluation, and held-out family behavior; reject gates that merely memorize one observed family.

### P23 — Frontier integrator
Restack only orthogonal, individually measured mechanisms; check overlap, shared budgets, seed interactions, and task count.

### P24 — Submission/reliability orchestrator
Re-fetch `main` immediately before submission, abort on source movement, validate branch/PR creation, and retry only confirmed infrastructure failures.

## Council protocol

1. **Map the mechanism.** Identify exact inputs, state, outputs, complexity, downstream consumers, and objective effect.
2. **Create at least four interventions.** Remove it, halve it, replace it task-neutrally, and improve its mathematics.
3. **Screen causally.** Prefer one-factor mutations on one pinned source; use paired per-matrix comparisons.
4. **Attribute.** Record which matrices changed, which bucket moved, which phase won, operation count, task count, and output hashes.
5. **Adversarial review.** P17, P18, P21, and P24 can veto any candidate lacking a cap, purity, hidden-transfer, or freshness argument.
6. **Integrate conservatively.** P23 may combine only mechanisms with disjoint gates or a measured positive interaction.
7. **Submit reliably.** The measured source SHA must still equal remote `main` immediately before `yukon submit`; otherwise restart on the new frontier.

## Current research waves

- **Wave 1:** downward budgets for RGREEDY, pair descent, and MINL.
- **Wave 2:** whole-phase ablations and architecture simplification.
- **Wave 3:** one-for-one D_WIDE quotient-metric slot replacements.
- **Wave 4:** downward budgets for ORBIT, PHARMAKOS, and TELOS multistart.
- **Next:** confirmation/interaction tests on only the best subtractive candidates, then an incremental completion-descent wave and a buffer-reuse/runtime wave.
