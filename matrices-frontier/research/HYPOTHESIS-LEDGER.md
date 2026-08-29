# matrices.fast autonomous frontier research ledger

This is the active, testable hypothesis inventory for the sparse-ordering campaign. Every production change must preserve deterministic bijection, strict exact-score acceptance, safe-Rust/editable-path rules, and wall-clock headroom. Hypotheses are not considered validated by aggregate portfolio score alone; direct candidate attribution and structural reachability are mandatory.

## Council of 30 specialist agents

1. **Sparse-direct-methods theorist** — elimination trees, column counts, fill/flop objective.
2. **Quotient-graph engineer** — AMD/AMF quotient updates, indistinguishable nodes, pivot scores.
3. **Chordal-graph mathematician** — triangulations, minimal completions, PEO realization.
4. **Treewidth researcher** — separators, elimination width, nested dissection.
5. **KKT structure analyst** — primal/slack/dual block structure and dense-row deferral.
6. **Multilevel partitioning specialist** — METIS/KaHIP/Scotch coarsening and FM refinement.
7. **Hypergraph partitioning scientist** — constraint-variable incidence separators.
8. **Symbolic factorization engineer** — GNP counts, exact flop attribution, local deltas.
9. **Graph local-search scientist** — adjacent moves, block moves, ejection chains.
10. **Randomized algorithms researcher** — deterministic seed portfolios and low-discrepancy restarts.
11. **Algorithm portfolio scientist** — best-of ensembles, redundancy and marginal contribution.
12. **Bandit/scheduling engineer** — feature-conditioned time allocation under a hard wall clock.
13. **Performance engineer** — allocation, cache behavior, sorting, bitsets, work accounting.
14. **Rust systems optimizer** — safe-stdlib implementations and deterministic parallelism.
15. **Adversarial cap auditor** — hidden density hazards, tail latency, fail-closed budgets.
16. **Experimental-design scientist** — isolated attribution, ablations, confidence and race control.
17. **Graph feature engineer** — structural gates from n, nnz, degree and component statistics.
18. **Decision-tree selector designer** — task-neutral slot substitutions with auditable predicates.
19. **Exact algorithms specialist** — small-n DP, branch-and-bound, bounded exact subproblems.
20. **Kernelization researcher** — twins, leaves, articulation blocks, simplicial reductions.
21. **Spectral/separator researcher** — cheap Laplacian proxies and geometric cuts.
22. **Combinatorial optimization scientist** — minimum fill, deficiency and potential functions.
23. **Completion-lattice explorer** — edge deletion schedules and minimal triangulation basins.
24. **Seed-space cartographer** — seed prefix value, stratified seed allocation, seed transfer.
25. **KKT corpus reconstruction engineer** — ASL/MINLPLib pattern reconstruction and exact 500-row evaluation.
26. **Hidden-distribution statistician** — bucket weighting, family transfer and promotion margin.
27. **Formal-invariants reviewer** — bijection, determinism, monotonic acceptance and overflow safety.
28. **Frontier integration engineer** — exact-parent restacking and conflict-free task-neutral composition.
29. **Scientific harness architect** — hypothesis ledger, provenance, artifact hashes and reproducibility.
30. **Red-team reviewer** — overfitting, name leakage, unsafe gates and false attribution.

## Operating protocol

1. Freeze the exact promoted parent SHA and reproduce its score.
2. Test a hypothesis as a direct arm before allowing the incumbent portfolio to mask it.
3. Record wins, losses, ties, weighted log-score delta, largest regression, reachability set, and worst runtime.
4. Prefer task-neutral replacement/removal before adding work.
5. Validate on the 300 public rows and the independently reconstructed 500-row eval distribution, with sibling/family holdouts.
6. Submit only when the exact live parent is unchanged and the measured score clears a pessimistic queue-aware cutoff.

## 160 hypotheses

### A. Canonicalization, reductions, and structural features

- **H001 [queued]** Pre-eliminate degree-0/1 vertices and append their exact-safe order before the portfolio. **Test:** Run identity + exact score; retain only if every changed row is non-worse and runtime falls.
- **H002 [queued]** Detect true twins and quotient them before expensive candidate families. **Test:** Compare quotient expansion against unchanged source on all 300 and reconstructed 500.
- **H003 [queued]** Detect false twins and use deterministic tie classes to diversify AMD without full relabeling. **Test:** Direct attribution versus equal-cost relabel slots.
- **H004 [queued]** Extract connected components and solve/order components independently by predicted work. **Test:** Verify that component concatenation orientation minimizes cross-component scoring invariants.
- **H005 [queued]** Use articulation/biconnected decomposition as a hard kernel, not only a candidate. **Test:** A/B on component-heavy rows; audit separator-node placement.
- **H006 [queued]** Identify simplicial vertices from bounded-degree neighborhoods and peel them exactly. **Test:** Charge clique checks; test peel-front versus peel-back realization.
- **H007 [queued]** Identify almost-simplicial vertices and defer their unique obstruction. **Test:** Bounded neighborhood test; direct flop delta on small/medium rows.
- **H008 [queued]** Compute degeneracy/core numbers once and expose them to every selector. **Test:** Measure feature cost and selector separability on public/reconstructed rows.
- **H009 [queued]** Compute degree quantiles, Gini, hub mass, and bipartite-likeness for gate learning. **Test:** Train shallow auditable trees; cross-family leave-one-out validation.
- **H010 [queued]** Replace repeated full-symmetric scans with one canonical adjacency/features pass. **Test:** Output identity plus wall-time/alloc counters.

### B. Quotient-graph pivot mathematics (AMD/AMF/custom metrics)

- **H011 [queued]** Replace degree by exact local flop proxy `(d+1)^2` with quotient-element correction. **Test:** Candidate-only sweep at alpha grid; no portfolio masking.
- **H012 [queued]** Use marginal sum-of-squares potential instead of fill count for AMF. **Test:** Implement bounded quotient estimate; compare to exact chosen-pivot delta on probes.
- **H013 [queued]** Blend degree and element external degree with a density-adaptive exponent. **Test:** Latin-hypercube sweep over 12 parameter tuples.
- **H014 [queued]** Use sqrt-degree only in late elimination and AMF early. **Test:** Pivot-rank switch by active quotient size; direct attribution.
- **H015 [queued]** Use log-degree to compress hub influence in dense KKT blocks. **Test:** Replace one duplicate metric slot in hub-heavy cells.
- **H016 [queued]** Penalize pivots adjacent to high second-moment degree neighborhoods. **Test:** Incremental neighbor-moment cache; budgeted experiment.
- **H017 [queued]** Reward pivots whose quotient neighbors are highly indistinguishable. **Test:** Supernode-potential term; validate on pooling/telecom families.
- **H018 [queued]** Use deficiency divided by future-work estimate, not raw deficiency. **Test:** Test `dfill/(1+sum neighbor degree)` variants.
- **H019 [queued]** Use `min(max-degree-after-elimination, flop proxy)` lexicographic key. **Test:** Small/medium candidate sweep.
- **H020 [queued]** Use Pareto bucket queues for `(degree, fill, square-work)` rather than scalar alpha. **Test:** Bound queue width; compare 8 deterministic tie policies.
- **H021 [queued]** Adaptive `dense_alpha` from degree histogram instead of fixed global alpha. **Test:** Regression tree with integer predicates, direct-arm measurements.
- **H022 [queued]** Different `dense_alpha` for primal-like and dual-like graph regions inferred structurally. **Test:** Infer KKT side via bipartite score; task-neutral AMD slot.
- **H023 [queued]** Recompute exact degree only near the bucket minimum; keep approximations elsewhere. **Test:** Identity relative to exact metric and speed gain.
- **H024 [queued]** Delay quotient absorption when it destroys separator information. **Test:** Toggle absorption on selected density bands; compare fill/flops and time.
- **H025 [queued]** Aggressive absorption only for low-entropy neighbor signatures. **Test:** Feature-gated absorption A/B.

### C. Deterministic relabeling and restart allocation

- **H026 [queued]** Replace splitmix seeds by low-discrepancy affine permutations. **Test:** Prefix-value curves over 300 seeds on leverage rows.
- **H027 [queued]** Seed from degree-rank rotations instead of arbitrary labels. **Test:** Same-cost restart substitution.
- **H028 [queued]** Seed from constraint-side versus variable-side reversal inferred by bipartite coloring. **Test:** KKT-like rows only; exact selector test.
- **H029 [queued]** Stratify seeds by high-degree vertex positions. **Test:** Measure diversity of returned completions per seed.
- **H030 [queued]** Deduplicate restarts by cheap permutation/completion signature before exact scoring. **Test:** Count saved scorer calls and output identity.
- **H031 [queued]** Allocate seed count by historical gain-per-million-operations, not `budget/nnz` alone. **Test:** Replay prefix curves and optimize knapsack allocation.
- **H032 [queued]** Use sequential-halving: cheap surrogate screen many seeds, exact-score finalists. **Test:** Validate surrogate recall of top-3 exact seeds.
- **H033 [queued]** Warm-start relabel AMF from the current incumbent numbering. **Test:** Compose Q around incumbent order versus natural labels.
- **H034 [queued]** Use inverse incumbent numbering as a second deterministic basin. **Test:** One-for-one replacement of lowest-value relabel seed.
- **H035 [queued]** Generate seeds from Weisfeiler-Lehman color classes. **Test:** Class-preserving permutations; test completion diversity.
- **H036 [queued]** Generate seeds from articulation/block order. **Test:** Task-neutral substitution in component-heavy cells.
- **H037 [queued]** Use antithetic seed pairs `Q` and `reverse(Q)`. **Test:** Prefix marginal contribution experiment.
- **H038 [queued]** Stop relabel restarts when k consecutive completion signatures repeat. **Test:** Runtime savings without output loss on exhaustive logs.
- **H039 [queued]** Transfer winning seed families across size-scaled siblings. **Test:** Leave-one-sibling-out validation, no names in production predicate.
- **H040 [queued]** Use different restart objectives by active density phase. **Test:** AMD sparse, AMF middle, DegSqrt dense; exact budget partition.

### D. Partitioning and nested dissection

- **H041 [finalist-running]** Use METIS seed 5 in the exact mid-dense pooling selector. **Test:** Current finalist reuses the default-METIS slot; exact 500 gate reaches two rows.
- **H042 [accepted-parent]** Retain accepted D_WIDE METIS seed 2 separator arm. **Test:** Already promoted at 0.807688; treat as parent invariant.
- **H043 [queued]** Sweep METIS seed/options as task-neutral substitutions per structural cell. **Test:** 60-candidate reconstructed-eval battery, shallow selector tree.
- **H044 [queued]** Vary `nd_to_amd_switch` by separator-to-subproblem density. **Test:** Grid over 32/64/128/256; direct attribution.
- **H045 [queued]** Use more initial partitions only when coarse graph entropy is high. **Test:** Feature-conditioned `niparts`, same slot.
- **H046 [queued]** Use FM passes proportional to cut boundary, not fixed. **Test:** Time-normalized score delta.
- **H047 [queued]** Run METIS on the primal projection of KKT incidence, then lift dual/slack nodes. **Test:** Reconstruction corpus experiment; block-aware ordering.
- **H048 [queued]** Run METIS on the dual constraint-intersection projection. **Test:** Compare primal/dual projection by family.
- **H049 [queued]** Hypergraph partition constraints as nets and variables as pins. **Test:** Implement lightweight recursive bisection for medium rows.
- **H050 [queued]** Use separator post-order based on exact boundary degree. **Test:** Task-neutral realization variants.
- **H051 [queued]** Apply AMD/AMF separately inside separator leaves with leaf-specific alpha. **Test:** Factorial sweep on reconstructed rows.
- **H052 [queued]** Refine METIS separators using bounded exact vertex moves scored by cut and flop proxy. **Test:** One FM-like pass with hard budget.
- **H053 [queued]** Try nested dissection only after removing dense KKT rows. **Test:** Strip-partition-lift composition.
- **H054 [queued]** Use component-aware multiway dissection rather than binary recursion. **Test:** k=2/4/8 comparison under equal work.
- **H055 [queued]** Cache and reuse partition hierarchy for sibling candidate realizations. **Test:** Output identity and extra candidate budget from saved time.

### E. Strip, peel, induced-subgraph, and lifting transforms

- **H056 [queued]** Optimize strip size by degree quantile rather than fixed k. **Test:** Quantile grid 0.1%-10%, task-neutral gate.
- **H057 [queued]** Rank stripped vertices by estimated column flop, not degree. **Test:** Use anchor GNP counts; direct sweep.
- **H058 [queued]** Rank by degree times neighbor-degree moment. **Test:** Compare on dense pooling and power rows.
- **H059 [queued]** Strip low-degree separator-like vertices instead of hubs. **Test:** Reverse-strip hypothesis on grid-like rows.
- **H060 [queued]** Use two-sided strip: peel leaves first, defer hubs last. **Test:** One candidate with exact lift invariant.
- **H061 [queued]** Restore stripped vertices by local minimum incremental flop rather than sorted degree. **Test:** Bounded insertion search.
- **H062 [queued]** Restore in blocks based on twin/WL classes. **Test:** Deterministic block insertion.
- **H063 [queued]** Run different sub-orderers inside the induced core by density band. **Test:** AMF/AMD/DegSqrt/METIS slot sweep.
- **H064 [queued]** Iterate strip-transform-strip with shrinking k. **Test:** Fixed total work; compare one/two/three stages.
- **H065 [queued]** Use anchor completion column counts to strip only vertices causing superlinear work. **Test:** Threshold on `c_j^2` contribution.
- **H066 [queued]** Peel vertices with zero predicted fill under current incumbent. **Test:** Exact local test and monotonic lift.
- **H067 [queued]** Use separator boundary as the deferred set instead of top degree. **Test:** METIS-boundary lifting candidate.
- **H068 [queued]** Run strip transforms on TELOS/RGSUB incumbent, not raw graph. **Test:** Phase-order A/B.
- **H069 [queued]** Replace a no-value heavy metric slot with a strip candidate in a learned cell. **Test:** Task-count-neutral selector.
- **H070 [queued]** Build a Pareto portfolio of strip sizes and remove dominated k values. **Test:** Per-row attribution and runtime knapsack.

### F. TELOS, RGSUB, and incumbent-space descent

- **H071 [queued]** Reorder TELOS priority schedule by measured marginal win per operation. **Test:** Replay candidate attribution logs, exact fixed-budget schedule.
- **H072 [queued]** Allocate TELOS passes by incumbent gap to runner-up. **Test:** Gap-conditioned extra passes.
- **H073 [queued]** Seed TELOS from best distinct completion signature, not best distinct permutation. **Test:** Avoid invariant PEO duplicates.
- **H074 [queued]** Use equal-work round-keyed seeds across TELOS descents. **Test:** Re-evaluate on exact latest parent.
- **H075 [queued]** Run RGSUB before early MINL so it sees a richer completion. **Test:** Phase-order factorial A/B.
- **H076 [queued]** Run a second RGSUB only when first-stage induced-core gain is high. **Test:** Gain predictor with hard cap.
- **H077 [queued]** Choose RGSUB subset by exact `c_j^2` contribution rather than degree. **Test:** Anchor-count subset sweep.
- **H078 [queued]** Use overlapping RGSUB windows with deterministic stagger. **Test:** Fixed task count via replacing duplicate windows.
- **H079 [queued]** Use separator-defined RGSUB regions. **Test:** Partition hierarchy to nested-subgraph search.
- **H080 [queued]** Use completion-edge blame to define RGSUB regions. **Test:** Map fill edges back to eliminated vertices.
- **H081 [queued]** Use multi-resolution subset sizes in one descent via incremental core. **Test:** Cache adjacency and scorer state.
- **H082 [queued]** Stop TELOS when two rounds induce the same completion signature. **Test:** Runtime savings and identity audit.
- **H083 [queued]** Carry runner-up only if its completion edge set differs materially. **Test:** Jaccard threshold, no name gates.
- **H084 [queued]** Replace a low-value TELOS mode with a quotient metric discovered by reconstructed sweep. **Test:** Task-neutral substitution.
- **H085 [queued]** Use best-of-two realization of each TELOS core: MCS PEO and AMD-on-completion. **Test:** Strict exact acceptance, measured time.

### G. Completion-lattice descent, MINL, watcher, and ORBIT

- **H086 [queued]** Run terminal completion descent on the final incumbent. **Test:** Retain the promoted mechanism lineage with exact work charging.
- **H087 [queued]** Reverse lexicographic fill-edge deletion as a sibling basin. **Test:** Same budget, direct standalone attribution.
- **H088 [queued]** Order deletions by common-neighborhood width. **Test:** Counting-sort width buckets, exact chordality criterion.
- **H089 [queued]** Order deletions by endpoint degree sum ascending. **Test:** Compare to lexicographic under fixed operations.
- **H090 [queued]** Order deletions by estimated `c_j^2` blame. **Test:** Map endpoints to elimination positions.
- **H091 [queued]** Use an affected-edge watcher queue after successful deletion. **Test:** Incremental rounds versus full rescans.
- **H092 [queued]** Interleave deletion and MCS realization every bounded batch. **Test:** Determine whether realization exposes a lower-cost next completion.
- **H093 [queued]** Try both MCS and LexBFS PEO realizations. **Test:** PEO validity plus exact score.
- **H094 [queued]** Run AMD on the shrunken completion with multiple `dense_alpha` values. **Test:** Task-neutral realization slots.
- **H095 [queued]** Delete batches of pairwise independent fill edges. **Test:** Parallel-safe chordality proof and deterministic batching.
- **H096 [queued]** Use minimal-separator certificates to delete whole fill-edge sets. **Test:** Chordal-graph structural experiment.
- **H097 [queued]** Gate MINL by measured completion fill count, not input nnz. **Test:** Feature computed after incumbent; value/cost model.
- **H098 [queued]** Use deletion yield per million operations to decide another round. **Test:** Adaptive stop rule.
- **H099 [queued]** Apply ORBIT WL classes to choose alternate deletion order within ties. **Test:** Completion-basin diversification.
- **H100 [queued]** Replace early MINL with one cheaper terminal pass when phase interaction is positive. **Test:** 2×2 phase ablation on the exact corpus.

### H. Permutation local search and exact bounded optimization

- **H101 [queued]** Compute exact adjacent-swap flop delta and sweep to local optimum. **Test:** Incremental scorer versus full rescoring identity.
- **H102 [queued]** Use block swaps of adjacent supernodes. **Test:** Bound block sizes 2/4/8.
- **H103 [queued]** Use relocate moves within a bounded elimination window. **Test:** Candidate positions from high `c_j^2` columns.
- **H104 [queued]** Use 2-opt reversal in low-width windows. **Test:** Exact score under hard move budget.
- **H105 [queued]** Use ejection chains around worst columns. **Test:** Depth-2/3 deterministic search.
- **H106 [queued]** Optimize only the last k pivots exactly. **Test:** DP over k=12..24 using the current filled graph.
- **H107 [queued]** Optimize separator ordering exactly when separator size is at most 24. **Test:** Subset DP reusable across an ND candidate.
- **H108 [queued]** Use branch-and-bound minimum fill on tiny connected components. **Test:** Exact lower bounds, timeout-safe fallback.
- **H109 [queued]** Use dynamic programming over the articulation block tree. **Test:** Exact composition for small blocks.
- **H110 [queued]** Search PEOs of a fixed chordal completion only to improve the fill tiebreak. **Test:** Confirm flop invariance and avoid wasted work.
- **H111 [queued]** Search over one safe fill-edge exchange: add one, delete two. **Test:** Move across incomparable completions with chordality checks.
- **H112 [queued]** Use simulated annealing with a deterministic schedule only on tiny rows. **Test:** Compare against exact optimum/DP.
- **H113 [queued]** Use beam search over the first k eliminations with a quotient lower bound. **Test:** k/beam grid under two seconds.
- **H114 [queued]** Use A* on reduced kernels after twin/leaf elimination. **Test:** Exact small-k certification.
- **H115 [queued]** Learn move ordering from public exact-DP cases while keeping exact acceptance. **Test:** Feature-ranked deterministic local moves.

### I. Scheduler, scorer, data structures, and time budget

- **H116 [queued]** Remove candidates with zero marginal wins on the reconstructed 500. **Test:** Leave-one-candidate-out attribution; reclaim tasks.
- **H117 [queued]** Replace duplicate candidates with new arms rather than adding tasks. **Test:** Portfolio signature audit.
- **H118 [queued]** Cascade candidates: cheap arms first, expensive arms only when incumbent gap predicts value. **Test:** Feature-conditioned exact-safe scheduler.
- **H119 [queued]** Cache exact scores by permutation hash. **Test:** Count duplicate scorer calls and collision-safe verification.
- **H120 [queued]** Cache completion signatures to skip invariant PEO rescoring. **Test:** Prove score invariance for fixed completion.
- **H121 [queued]** Use pooled scratch buffers per worker to remove allocation churn. **Test:** Allocation probe and output identity.
- **H122 [queued]** Replace HashSet adjacency with sorted-Vec/bitset hybrids by degree. **Test:** Microbenchmark chordality and local-search kernels.
- **H123 [queued]** Use generation counters instead of clearing O(n) marker arrays. **Test:** Runtime reduction, deterministic identity.
- **H124 [queued]** Counting-sort bounded integer pivot keys. **Test:** Compare heap and bucket-queue costs.
- **H125 [queued]** Precompute saturating integer density predicates once. **Test:** Small speed/clarity gain and selector audit.
- **H126 [queued]** Partition the global two-second budget by observed task tail, not nominal operation count. **Test:** Loaded-run p95/p99 calibration.
- **H127 [queued]** Use a fixed deterministic work counter for every expensive phase. **Test:** Cross-hardware reproducibility.
- **H128 [queued]** Schedule disjoint candidate families across four workers to avoid nested oversubscription. **Test:** Phase timing and output identity.
- **H129 [queued]** Score candidates as they finish and cancel dominated optional work only at deterministic checkpoints. **Test:** No clock-based output; work-count checkpoints.
- **H130 [queued]** Compile out test probes and dead branches from production source. **Test:** Binary/cache effect and exact output identity.

### J. Exact-eval reconstruction, selectors, and frontier control

- **H131 [implementation-running]** Reconstruct all 500 eval KKT patterns from MINLPLib `.nl` through ASL. **Test:** First require bit-for-bit reproduction of all 300 dev patterns.
- **H132 [queued]** Extract exact per-row current-frontier ratios on the reconstructed 500. **Test:** Run current source and preserve signed provenance hashes.
- **H133 [queued]** Run 60+ direct candidate arms on every reconstructed row. **Test:** At least 30,000 isolated evaluations with a candidate-attribution table.
- **H134 [queued]** Train depth≤4 integer decision trees selecting task-neutral slot replacements. **Test:** Family-grouped cross-validation and no matrix names/indices.
- **H135 [queued]** Optimize selectors against weighted bucket geomean rather than raw win count. **Test:** Exact score replay.
- **H136 [queued]** Require a structural reachability census for every production gate. **Test:** List all 500 reached rows and public controls.
- **H137 [queued]** Use sibling leave-one-out validation to reject family memorization. **Test:** Hold out each prefix/family cluster.
- **H138 [queued]** Maintain a pending-frontier pessimistic cutoff with two promotion steps of margin. **Test:** Queue-aware submission policy.
- **H139 [queued]** Require exact parent SHA at experiment start and immediately before submit. **Test:** Abort/rebase on any movement.
- **H140 [queued]** Automatically restack isolated mechanisms on a new frontier and rerun reachable controls. **Test:** Source transform plus identity proofs.
- **H141 [queued]** Separate technical validity from competitive validity in the harness. **Test:** Two independent ledgers and fail reasons.
- **H142 [queued]** Archive candidate-only and portfolio-selected attribution for every row. **Test:** No masked hypothesis can be submitted.
- **H143 [queued]** Use exact bucket counts 243/180/77 in projection and verify them against the grader census. **Test:** Projection consistency checks.
- **H144 [queued]** Estimate hidden promotion margin using exact reconstructed score, not dev score. **Test:** Submission gate uses exact eval replay.
- **H145 [queued]** Submit at most one candidate per frontier, and only after active-queue audit. **Test:** Avoid races and duplicate branch failures.

### K. New frontier mathematical mechanisms

- **H146 [queued]** Build a KKT-aware constrained AMD that defers inferred dual/slack nodes. **Test:** Infer bipartition structurally and compare block policies.
- **H147 [queued]** Use the primal Schur-complement graph ordering, then lift duals. **Test:** Projection pattern and exact full-KKT score.
- **H148 [queued]** Use the dual Schur-complement graph ordering, then lift primals. **Test:** Choose projection by block-density features.
- **H149 [queued]** Alternate primal and dual eliminations to control front growth. **Test:** Parameterized block schedule.
- **H150 [queued]** Minimize a potential combining active degree squared and separator boundary. **Test:** Derive incremental key and sweep weights.
- **H151 [queued]** Use entropy of quotient elements as a pivot penalty. **Test:** Determine whether low-entropy pivots preserve blocks.
- **H152 [queued]** Approximate a tree decomposition from the elimination tree and re-order bags. **Test:** Bag-tree local optimization.
- **H153 [queued]** Use elimination-tree rotations analogous to tree balancing. **Test:** Exact score after bounded rotations.
- **H154 [queued]** Use minimal-separator enumeration on small quotient cores. **Test:** Bounded core size and exact lift.
- **H155 [queued]** Use graph sparsification only to propose separators, then score on the original graph. **Test:** Spectral/cut proxy with exact safe acceptance.
- **H156 [queued]** Use deterministic label-propagation communities as ND seeds. **Test:** Linear-time community hierarchy.
- **H157 [queued]** Use WL color refinement to form supernodes beyond AMD indistinguishability. **Test:** Safe expansion and candidate comparison.
- **H158 [queued]** Use reinforcement-learning-style offline policy search over phase schedules, compiled as a small tree. **Test:** Exact corpus replay with no model/runtime dependency.
- **H159 [queued]** Use Bayesian optimization over integer gate boundaries and slot choices. **Test:** Nested family CV and complexity penalty.
- **H160 [queued]** Solve a global knapsack of candidate tasks maximizing exact weighted log-score gain under worst-case time. **Test:** Use measured per-row marginal gains/costs and emit an auditable schedule.

## Computation ledger

- 25-lane quotient-metric screen completed; it exposed portfolio masking and motivated direct-arm attribution.
- 2,030 direct candidate evaluations completed locally across public high-leverage controls; simple global AMD/AMF/METIS/Scotch/KaHIP/MinFill arms were almost entirely dominated.
- A 24-persona GitHub council is executing 1,392 further direct evaluations with independent artifacts.
- Exact 500-row public census extracted, with bucket counts 243/180/77.
- ASL/MINLPLib reconstruction calibration is running against 22 diverse dev patterns; full 500-row reconstruction follows only after bit-for-bit equality.
- The current finalist is a task-neutral METIS seed-5 selector restacked on the accepted 0.807688 parent, with exact-parent and queue-race gates before submission.
