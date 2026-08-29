# Matrices.fast Frontier Research Program

Generated for the current `Layr-Labs/ssi-ordering-challenge` frontier. All proposed production changes must remain inside `src/ordering/`, deterministic, pattern-only, and standard-library-only beyond dependencies already present in the promoted source. Exact symbolic FLOPS remains the sole admission authority.

## Operating doctrine

1. Pin every experiment wave to one upstream commit. 2. Prefer removal, narrowing, reallocation, and one-for-one replacement over append-only search. 3. Measure isolated contribution and interaction separately. 4. Treat the hidden two-second tail as adversarial. 5. Submit only after a fresh sourceRef check made immediately before `yukon submit`.

## Failure correction

Submission `ce3465bf-6b38-4aeb-b3e0-950f35cfcc39` reached the Yukon queue after local scoring, but no validation PR was created. The final UI error was `GitHub branch submissions/... could not be updated`. The old workflow pinned and checked the source before a long benchmark/test sequence, then refreshed only the submission table. It did not refetch upstream `main` at the final mutation boundary. The frontier advanced during that interval. The replacement workflow therefore pins a wave once for comparability, but any eventual submit workflow must refetch `main` after all expensive validation, reclone/restack on movement, and only then dispatch.

## Council

### P01 — Sparse Direct Solver Theorist

Re-derive the LDLᵀ symbolic objective and attack column-count structure rather than surface heuristics.

### P02 — Chordal Graph Theorist

Treat each ordering as a chordal completion; search the completion lattice and minimal triangulations.

### P03 — Minimum-Degree Algorithm Engineer

Audit quotient-graph AMD/AMF internals, degree approximations, element absorption, and dense-node policy.

### P04 — KKT Structure Specialist

Exploit primal/dual/slack block structure and saddle-point graph motifs without using matrix values.

### P05 — Graph Separator Researcher

Find cheap separators, nested dissection variants, and separator refinements that fit the wall-clock cap.

### P06 — Combinatorial Optimization Scientist

Build bounded local-search moves and exact subproblem solvers with monotone acceptance.

### P07 — Algorithm Portfolio Economist

Measure marginal utility per microsecond, remove dominated arms, and reallocate fixed task slots.

### P08 — Runtime/Systems Optimizer

Reduce allocations, pointer chasing, branch misses, sorting, and redundant graph construction.

### P09 — Parallel Scheduling Engineer

Reorder and batch independent candidates so critical-path latency and starvation fall.

### P10 — Experimental Design Statistician

Create controlled ablations, attribution, interaction tests, and hidden-generalization checks.

### P11 — Adversarial Hidden-Corpus Auditor

Assume every structural gate has an unseen worst case; prefer identity-safe and work-reducing changes.

### P12 — Deterministic Search/Seed Designer

Design low-discrepancy, graph-derived, reproducible seed schedules with no extra work.

### P13 — Graph Reduction Specialist

Contract twins/supernodes, eliminate simplicial vertices, split components and blocks, then lift orders.

### P14 — Treewidth/Elimination-Tree Analyst

Use elimination-tree/frontal statistics to target high-cost subtrees and balance column counts.

### P15 — Surrogate-Objective Designer

Derive cheap pivot scores correlated with Σcⱼ², not merely fill or degree.

### P16 — Local-Search Move Engineer

Design adjacent swap, insertion, block, separator, and subtree moves with bounded exact validation.

### P17 — Completion-Descent Scheduler

Optimize fill-edge deletion order, incremental watchers, and alternate realization policies.

### P18 — Gate/Policy-Tree Learner

Build deterministic structural routing from cheap invariant features, avoiding names and corpus indices.

### P19 — Rust Memory-Layout Engineer

Flatten data structures, use stamps/counting arrays, reuse workspaces, and remove cloning.

### P20 — Proof and Validator Engineer

Prove bijection, determinism, monotonicity, cap bounds, and regression safety for every candidate.

### P21 — Benchmark Archaeologist

Mine all accepted/rejected submissions and memory notes to identify interactions, duplicates, and stale assumptions.

### P22 — Frontier Mathematician

Challenge the current decomposition, derive new invariants, and remove entire conceptual layers.

### P23 — Failure-Mode Reliability Engineer

Harden branch creation, source pinning, promotion races, retries, and evidence capture.

### P24 — Research Orchestrator

Run the council as a funnel: broad hypotheses → isolated screens → interaction matrix → finalist.

## Hypothesis registry (168)

### P01 — Sparse Direct Solver Theorist

- **H001: Reweight pivot proxy toward squared frontal width.** Replace linear degree/fill surrogates by a bounded integer approximation to ΔΣc², using squared estimated column width.
- **H002: Balance high columns rather than only minimizing total fill.** Add a max/variance frontal-width penalty to one duplicate quotient-metric slot; exact scorer remains final authority.
- **H003: Elimination-tree subtree cost targeting.** Use a cheap first ordering to estimate subtree Σc² concentration, then locally reorder only the top-cost subtree.
- **H004: Ancestor-overlap pivot score.** Penalize vertices whose neighbor reach sets overlap many active elimination-tree ancestors.
- **H005: Column-count sensitivity finite difference.** On small gated graphs, try a few candidate pivots and estimate one-step change in symbolic column counts.
- **H006: Convex-majorization refinement.** Prefer moves that reduce the majorization order of estimated column widths, since Σx² is Schur-convex.
- **H007: Bucket-aware effort allocation.** Spend search only where expected log-ratio gain times bucket weight per matrix exceeds measured cost.

### P02 — Chordal Graph Theorist

- **H008: Reverse-lexicographic terminal deletion.** Run a sibling completion descent with reverse fill-edge order in a task-neutral replacement slot.
- **H009: Low-common-width-first deletion.** Prioritize fill edges by |N(u)∩N(v)| to maximize deletions per charged operation.
- **H010: High-yield orbit bucket deletion.** Rank WL class-pair buckets by prior deletion yield instead of size alone.
- **H011: Minimal-separator-guided deletion.** Test fill edges crossing small minimal separators before intra-clique edges.
- **H012: MCS vs LexBFS realization.** Realize the descended chordal graph with LexBFS/maximum cardinality variants and exact-select the best.
- **H013: Incremental affected-edge queue.** After deleting uv, revisit only fill edges incident to changed common neighborhoods.
- **H014: Two-schedule completion portfolio.** Use two bounded deletion schedules by replacing a measured duplicate phase, not adding a new task.

### P03 — Minimum-Degree Algorithm Engineer

- **H015: RGREEDY mid budget downward sweep.** Sweep 150M→{120,100,90,75,60,45,30,15,0} to test downstream starvation; W1.
- **H016: Dense-node alpha event thresholds.** Choose dense_alpha from integer degree quantiles rather than a fixed global alpha grid.
- **H017: Element-degree squared metric.** Use degree²/(element-size+1) in a duplicate quotient slot to target flop rather than fill.
- **H018: Aggressive absorption ablation.** Disable aggressive absorption only in structural cells where exact evaluation shows distinct basins.
- **H019: Mass-elimination tie policy.** Change equal-score pivot tie ordering using degree moments/element age without extra candidates.
- **H020: Exact degree refresh on narrow frontier.** Periodically recompute exact external degree for only the smallest candidate bucket.
- **H021: Duplicate AMD/AMF trajectory census.** Hash every generated permutation on the eval reconstruction and reclaim all exact duplicate slots.

### P04 — KKT Structure Specialist

- **H022: Constraint-row postponement proxy.** Detect high-degree constraint-like vertices structurally and postpone a bounded terminal set.
- **H023: Primal-dual bipartite core ordering.** Approximate a bipartition from local clustering/odd-cycle signals, order the sparse side first, exact-select.
- **H024: Slack-leaf peeling.** Identify degree-1/2 slack motifs, peel them before the core, and lift deterministically.
- **H025: Bordered block decomposition.** Detect a small dense border attached to a sparse core and order core then border.
- **H026: Schur-complement neighborhood score.** Score a constraint-like pivot by pairwise neighbor coupling it would induce, with capped wedge counts.
- **H027: Time-slice chain detection.** Recognize repeated local signatures along temporal KKT chains and use a separator-at-time-boundaries order.
- **H028: Block-arrow gate.** Use degree histogram and repeated neighborhood fingerprints to route block-arrow graphs to a dedicated order.

### P05 — Graph Separator Researcher

- **H029: Cheap BFS separator refinement.** Take an existing partitioner order and shift the separator boundary by bounded local exact search.
- **H030: Articulation-first nested dissection.** Split at articulation points/biconnected blocks before invoking existing leaf orderers.
- **H031: Low-diameter multiseed BFS ND.** Use fixed graph-derived farthest-point seeds, replacing a dominated separator slot.
- **H032: Separator width squared objective.** Rank candidate separators by estimated sum of squared frontal widths, not cut size alone.
- **H033: Postorder child balancing.** Permute nested-dissection child subtrees to reduce cross-child frontal imbalance.
- **H034: Hub-excluded separator graph.** Temporarily remove top hubs when finding separators, append them to the separator block.
- **H035: Separator leaf policy tree.** Select AMD, AMF, or degree order for leaves from density and degree-skew features.

### P06 — Combinatorial Optimization Scientist

- **H036: Pair-descent budget downward sweep.** Sweep 128M→{96,64,48,32,16,0}; W1.
- **H037: Pair-descent sweep-count ablation.** Sweep 4→{3,2,1,0}; W1.
- **H038: Bounded insertion descent.** Try moving one high-cost vertex within a radius-k window with exact local/full scoring.
- **H039: 3-cycle permutation moves.** Replace two adjacent swaps with one 3-cycle candidate under equal operation budget.
- **H040: Block move around separator.** Move a short contiguous block across a detected separator boundary.
- **H041: Exact DP on tiny biconnected blocks.** Solve blocks n≤20 exactly and splice into the global order.
- **H042: Beam search on last k eliminations.** For k≤12, enumerate/beam-search suffix orders using exact incremental fill simulation.

### P07 — Algorithm Portfolio Economist

- **H043: Phase marginal-utility ledger.** Measure argmin wins and log-score contribution per phase, then delete zero-win phases.
- **H044: One-for-one slot auction.** Assign each candidate slot to the hypothesis with highest marginal gain per cost in its gate cell.
- **H045: Critical-path candidate pruning.** Remove an arm that never wins but sits on the slowest parallel wave.
- **H046: Scorer-call deduplication.** Hash candidate permutations and skip exact scoring of duplicates.
- **H047: Gate-level dominance pruning.** If arm A dominates B on all reachable reconstructed-eval rows, replace B with a new metric.
- **H048: Work budget shadow price.** Estimate how one phase's operations reduce later-phase opportunity; optimize global rather than local value.
- **H049: Pareto frontier over score and worst-time.** Keep only configurations nondominated in exact score and conservative operation-count bound.

### P08 — Runtime/Systems Optimizer

- **H050: Reuse filled graph across MINL/ORBIT/PHARMAKOS.** Cache one immutable construction and clone only mutated adjacency where needed.
- **H051: CSR flat adjacency for completion descent.** Replace Vec<Vec<u32>> with offsets+flat storage and tombstone/stamp deletion.
- **H052: Counting-sort fill edges.** Bucket by bounded degree/common-width keys instead of comparison sorting.
- **H053: Workspace reuse across candidates.** Preallocate marks, permutations, degrees, and queues once per order() call.
- **H054: Avoid full permutation clones.** Use index buffers/swap logs and clone only when a candidate becomes incumbent.
- **H055: Stamp arrays instead of clearing.** Replace O(n) boolean/vector clears in repeated searches by generation counters.
- **H056: Early abort exact scoring.** During candidate flop accumulation, stop once partial cost already exceeds incumbent, when scorer semantics permit.

### P09 — Parallel Scheduling Engineer

- **H057: Move work off the critical wave.** Reorder candidate batches so long arms overlap with short independent arms.
- **H058: Downstream starvation instrumentation.** Record deterministic op-budget consumption per phase and remaining slack for successors.
- **H059: Fixed-wave task packing.** Bin-pack candidate tasks by measured structural cost while preserving deterministic merge order.
- **H060: Sequentialize tiny tasks.** Run sub-millisecond arms inline to avoid thread/spawn/channel overhead.
- **H061: Parallelize independent realizations.** Run MCS and AMD realizations of the same descended completion in parallel if a slot is free.
- **H062: Avoid nested oversubscription.** Propagate worker-context flags through all newly added inner batches.
- **H063: Phase-order permutation experiment.** Test safe reorderings where candidates are seed-independent; reject any changing seed semantics unless measured.

### P10 — Experimental Design Statistician

- **H064: Candidate-attribution run mode.** Log which arm produced the incumbent and its marginal delta for every matrix.
- **H065: A/B same-process timing harness.** Alternate base/variant calls per matrix to reduce load drift, while keeping score evidence separate.
- **H066: Full interaction matrix.** For top five isolated wins, test all pairs and triples before composing.
- **H067: Leave-one-family-out validation.** Tune on three structural families and validate on the fourth to detect brittle gates.
- **H068: Bootstrap bucket log-ratio uncertainty.** Estimate how concentrated each gain is and penalize one-matrix wins.
- **H069: Structural nearest-neighbor controls.** For every gated winner, test all corpus rows near it in invariant-feature space.
- **H070: Sequential halving experiment scheduler.** Use cheap smoke/attribution filters before full 300-row runs, never as final evidence.

### P11 — Adversarial Hidden-Corpus Auditor

- **H071: Identity-safe gate narrowing.** Prefer changes that make excluded rows byte-identical to an accepted frontier.
- **H072: Operation-count monotone changes.** Prioritize only variants that provably do no more work on every input.
- **H073: Worst-feature synthetic stress.** Generate hub, clique-border, chain, star, and dense-bipartite patterns at gate boundaries.
- **H074: Gate boundary fuzzing.** Test n/nnz/max-degree values immediately below and above every structural threshold.
- **H075: Memory-cap audit.** Bound every vector by n/nnz/fill caps and test near 4 GiB worst cases analytically.
- **H076: Panic/overflow audit.** Replace risky products/squares with saturating or u128 arithmetic and fuzz degenerate patterns.
- **H077: Hidden-tail prior.** Treat any widening as unsafe unless it replaces work or has an input-derived hard operation bound.

### P12 — Deterministic Search/Seed Designer

- **H078: Round-keyed RGSUB seeds.** Ensure each round/stream receives a distinct deterministic key without increasing work.
- **H079: Low-discrepancy permutation seeds.** Generate affine/bit-reversal label permutations rather than independent Fisher-Yates starts.
- **H080: Graph-hash seed derivation.** Derive seeds from invariant degree/color histograms so isomorphic inputs route consistently.
- **H081: Incumbent-perturbation seeds.** Relabel around high-frontal vertices while retaining fixed candidate count.
- **H082: Antithetic seed pairs.** Use a permutation and its deterministic inverse/reversal to cover opposite tie-breaking basins.
- **H083: Seed diversity by Kendall distance.** Reject near-duplicate relabelings and replace them within the same fixed restart budget.
- **H084: Adaptive deterministic seed schedule.** Use early candidate diversity/yield to choose later seeds from a fixed decision tree.

### P13 — Graph Reduction Specialist

- **H085: Connected-component independent ordering.** Order components independently, then choose component concatenation by predicted cost/size.
- **H086: Biconnected block decomposition.** Solve articulation-separated blocks independently and splice via block-cut tree.
- **H087: True/false twin contraction.** Contract equal open/closed neighborhoods, order quotient, expand twins with tie refinement.
- **H088: Simplicial vertex pre-elimination.** Peel certified simplicial vertices with a policy on when early elimination lowers squared widths.
- **H089: Almost-simplicial bounded test.** For low degree, test whether removing one neighbor makes a clique and branch safely.
- **H090: Supernode quotient compression.** Merge vertices with identical active adjacency in custom local searches.
- **H091: Pendant-tree stripping.** Remove tree appendages, order the cyclic core, and restore trees in reverse peel order.

### P14 — Treewidth/Elimination-Tree Analyst

- **H092: High-cost subtree reordering.** Identify elimination-tree subtrees with largest Σc² and rerun one local candidate there.
- **H093: Parent-choice tie refinement.** When symbolic parents tie, prefer choices that balance subtree cost.
- **H094: Supernode frontal split.** Detect oversized fundamental supernodes and seek a local separator within them.
- **H095: Postorder permutation search.** Try bounded child-order permutations at high-degree elimination-tree nodes.
- **H096: Column-width quantile gate.** Route expensive refinement only when top column-count quantiles dominate total flops.
- **H097: Tree-height vs width policy.** Choose separator/local-search strategy from elimination-tree height/width signatures.
- **H098: Ancestor compression.** Cache reach/ancestor stamps to accelerate repeated column-count-like local estimates.

### P15 — Surrogate-Objective Designer

- **H099: DegSqrt alpha sweep in reclaimed slots.** Sweep α around accepted 0.75 using only exact duplicate slots.
- **H100: Estimated Δflop pivot score.** Approximate new clique width k and use k² plus downstream external-degree penalty.
- **H101: Fill-weighted degree curvature.** Score degree + λ·fill + μ·fill² with integer fixed-point coefficients.
- **H102: Neighbor-degree moment score.** Use sum and variance of active neighbor degrees as a proxy for future frontal growth.
- **H103: Element-overlap entropy.** Penalize pivots touching many heterogeneous quotient elements.
- **H104: Hub-tail penalty.** Add a convex penalty when estimated degree exceeds a structural quantile.
- **H105: Multiobjective lexicographic score.** Use estimated flop first, fill second, deterministic id last within a single quotient run.

### P16 — Local-Search Move Engineer

- **H106: Adjacent-swap candidate filtering.** Evaluate swaps only near large column-count gradients or separator boundaries.
- **H107: Variable-radius insertion.** Allocate insertion radius inversely to local degree and remaining op budget.
- **H108: Suffix reversal.** Test bounded reversals of elimination-tree postorder segments.
- **H109: Sibling subtree interchange.** Swap contiguous child-subtree blocks under the elimination tree.
- **H110: Hub delayed insertion.** Move a hub later by a bounded number of positions and exact-select.
- **H111: Constraint-border rotation.** Rotate a small border block among nearby positions.
- **H112: Move tabu by structural signature.** Avoid repeating local moves with the same affected-neighborhood fingerprint.

### P17 — Completion-Descent Scheduler

- **H113: MINL op-budget downward sweep.** Sweep 60M→{45,30,20,10}; W1.
- **H114: MINL round-count downward sweep.** Sweep 8→{4,2}; W1.
- **H115: MINL nnz ceiling sweep.** Sweep 700k→{500k,300k}; W1.
- **H116: ORBIT op-budget cut.** Test 20M→10M; W1.
- **H117: Deletion-yield early stop.** Stop a round when deletions per charged million ops falls below a fixed threshold.
- **H118: Dynamic common-neighbor cap.** Set cap from remaining budget and degree quantiles rather than fixed 2000.
- **H119: Terminal-only completion descent.** Ablate early MINL/ORBIT and spend one bounded pass on the final incumbent.

### P18 — Gate/Policy-Tree Learner

- **H120: Decision tree from invariant features.** Route candidate slots using n, nnz/n, max-degree, degree CV, components, and color entropy.
- **H121: Anchor-fill admission feature.** Use AMD's cheap symbolic fill estimate to gate phases whose true cost tracks completion size.
- **H122: Degree-Gini gate.** Separate hub-heavy from uniformly sparse graphs more robustly than max_deg/n alone.
- **H123: Wedge-density gate.** Estimate local clique-creation risk from capped ∑choose(deg,2).
- **H124: Component-size entropy gate.** Detect many-small-component cases and use decomposition-first ordering.
- **H125: WL-color entropy gate.** Use bounded 1-WL refinement to distinguish repeated block structure.
- **H126: Gate simplification pruning.** Remove thresholds that do not alter reachable candidate attribution on eval reconstruction.

### P19 — Rust Memory-Layout Engineer

- **H127: SmallVec-like inline buffers with arrays.** Use fixed stack arrays for tiny neighborhoods before spilling to Vec, stdlib only.
- **H128: u32 index audit.** Use u32 where n permits and usize only at boundaries to reduce memory traffic.
- **H129: Binary-heap replacement.** Replace stale-entry heaps with bucket queues when keys are bounded.
- **H130: Sort elimination.** Maintain sorted adjacency incrementally or use marks to avoid repeated sort_unstable.
- **H131: Branchless intersection kernels.** Use two-pointer loops with fewer bounds/branch checks and charged early exits.
- **H132: Arena allocation by offsets.** Store per-phase temporary slices in one Vec arena and reset lengths.
- **H133: Clone-on-win only.** Defer materializing full candidate permutations until a cheap hash/score precheck passes.

### P20 — Proof and Validator Engineer

- **H134: Permutation property fuzz suite.** Generate random/synthetic patterns and verify bijection/determinism for every feature gate.
- **H135: Strict-monotone admission proof.** Centralize candidate acceptance so every path uses f < best_flops.
- **H136: Operation-budget accounting proof.** Charge all intersections, lookups, queue pushes, and realization work consistently.
- **H137: Completion deletion criterion test.** Exhaustively verify N(u)∩N(v) clique criterion on small chordal graphs.
- **H138: Gate reachability audit.** List every matrix entering each expensive phase and assert structural predicates.
- **H139: No-external-state audit.** Scan for environment, time, filesystem, global mutable state, and nondeterministic iteration.
- **H140: Overflow/size proof table.** Document worst-case arithmetic and allocation bounds for every new hypothesis.

### P21 — Benchmark Archaeologist

- **H141: Accepted-diff component map.** Map every accepted commit to pipeline phase, gate, score delta, and timing risk.
- **H142: Rejected/failed taxonomy.** Classify score rejection, cap failure, branch failure, purity failure, and stale-frontier race.
- **H143: Duplicate idea detector.** Hash diffs and normalize constants to avoid rerunning already-tested hypotheses.
- **H144: Stale memory reconciliation.** Mark claims invalidated by later compositions or corpus rebaselines.
- **H145: Submission-note evidence miner.** Extract exact per-matrix wins/losses and suggested next experiments from recent PR notes.
- **H146: Frontier ancestry graph.** Build a DAG of promoted sources and restack experiments only on exact descendants.
- **H147: Public-to-hidden transfer ledger.** Track which structural hypotheses repeatedly generalize and which overfit dev.

### P22 — Frontier Mathematician

- **H148: Remove search-before-search layer.** Ablate an upstream phase whose only effect is to seed a stronger downstream phase adversely.
- **H149: Completion-first architecture.** Build one good completion, descend it, then realize multiple PEOs instead of many full orderings.
- **H150: Policy-selected single trajectory.** Replace a broad portfolio by one routed trajectory plus AMD floor, reclaiming cap headroom.
- **H151: Two-level quotient search.** Optimize a contracted structural quotient first, then expand/refine locally.
- **H152: Lagrangian time allocation.** Optimize expected log-flop gain minus λ·operation cost, with λ set by cap risk.
- **H153: Anytime monotone pipeline.** Order phases by value/cost and stop deterministically when structural budget is exhausted.
- **H154: Search-space quotient by symmetries.** Avoid exploring labelings equivalent under detected equitable partitions.

### P23 — Failure-Mode Reliability Engineer

- **H155: Fresh-source pin before every run.** Resolve upstream main once, pin all lanes to that SHA, and record it.
- **H156: Pre-submit sourceRef compare-and-reclone.** Immediately before submit, fetch main; if moved, abort and restack on a fresh clone.
- **H157: Git branch creation retry.** On branch-update failure, query whether ref/commit/PR exists before one bounded idempotent retry.
- **H158: Signed-commit ruleset preflight.** Verify the platform-created commit is signed and branch rules permit the submissions namespace.
- **H159: No long test after frontier check.** Move the final frontier/source check after all expensive tests, seconds before submit.
- **H160: Submission artifact transaction log.** Persist archive hash, source SHA, CLI version, submission ID, and API result atomically.
- **H161: Promotion-aware queue discipline.** Allow one active submission per source lineage; continue local research without dispatching stale children.

### P24 — Research Orchestrator

- **H162: Wave-1 budget-removal council.** Run 30 isolated lanes on one pinned frontier SHA; current launch.
- **H163: Wave-2 slot-replacement council.** Use W1 headroom to test 20 quotient/seed/deletion replacements.
- **H164: Wave-3 structural reductions council.** Test components, biconnected blocks, twins, simplicial and pendant reductions.
- **H165: Wave-4 interaction council.** Test all pairs/triples among top orthogonal wins.
- **H166: Finalist adversarial council.** Stress gate boundaries, synthetic worst cases, double-run determinism, and memory bounds.
- **H167: Live frontier restack council.** When main advances, mechanically rebase only proven mechanisms and rerun attribution.
- **H168: Autonomous evidence funnel.** Maintain statuses: proposed → screened → full-run → composed → cap-proved → submitted → promoted/rejected.

## Wave 1: 30 isolated agents

| lane | persona | mutation | purpose |
|---|---|---|---|
| W1-00 | P24 | `control` | No source change; authoritative pinned-frontier baseline. |
| W1-01 | P03 | `RGREEDY_MID_BUDGET=120M` | Small work reduction. |
| W1-02 | P03 | `RGREEDY_MID_BUDGET=100M` | Budget cut. |
| W1-03 | P03 | `RGREEDY_MID_BUDGET=90M` | Budget cut. |
| W1-04 | P03 | `RGREEDY_MID_BUDGET=75M` | Budget cut. |
| W1-05 | P03 | `RGREEDY_MID_BUDGET=60M` | Reproduce the recent starvation hypothesis. |
| W1-06 | P03 | `RGREEDY_MID_BUDGET=45M` | Stronger cut. |
| W1-07 | P03 | `RGREEDY_MID_BUDGET=30M` | Stronger cut. |
| W1-08 | P03 | `RGREEDY_MID_BUDGET=15M` | Near-ablation. |
| W1-09 | P03 | `RGREEDY_MID_BUDGET=0` | Full mid-arm budget ablation. |
| W1-10 | P06 | `PAIR_DESCENT_OPS_BUDGET=96M` | Work reduction. |
| W1-11 | P06 | `PAIR_DESCENT_OPS_BUDGET=64M` | Work reduction. |
| W1-12 | P06 | `PAIR_DESCENT_OPS_BUDGET=48M` | Known hardened-class scale. |
| W1-13 | P06 | `PAIR_DESCENT_OPS_BUDGET=32M` | Work reduction. |
| W1-14 | P06 | `PAIR_DESCENT_OPS_BUDGET=16M` | Near-ablation. |
| W1-15 | P06 | `PAIR_DESCENT_OPS_BUDGET=0` | Budget ablation. |
| W1-16 | P06 | `PAIR_DESCENT_SWEEPS=3` | One fewer sweep. |
| W1-17 | P06 | `PAIR_DESCENT_SWEEPS=2` | Half sweeps. |
| W1-18 | P06 | `PAIR_DESCENT_SWEEPS=1` | Single sweep. |
| W1-19 | P06 | `PAIR_DESCENT_SWEEPS=0` | Phase ablation. |
| W1-20 | P17 | `MINL_OPS_BUDGET=45M` | Completion-descent budget cut. |
| W1-21 | P17 | `MINL_OPS_BUDGET=30M` | Completion-descent budget cut. |
| W1-22 | P17 | `MINL_OPS_BUDGET=20M` | Watch-class envelope. |
| W1-23 | P17 | `MINL_OPS_BUDGET=10M` | Near-ablation. |
| W1-24 | P17 | `MINL_MAX_ROUNDS=4` | Round reduction. |
| W1-25 | P17 | `MINL_MAX_ROUNDS=2` | Round reduction. |
| W1-26 | P17 | `MINL_MAX_NNZ=500k` | Gate narrowing. |
| W1-27 | P17 | `MINL_MAX_NNZ=300k` | Gate narrowing near measured win ceiling. |
| W1-28 | P17 | `ORBIT_OPS_BUDGET=10M` | Orbit sibling budget cut. |
| W1-29 | P17 | `PHARMAKOS_MAX_ROUNDS=3` | Scapegoat phase round cut. |

Each lane clones the same pinned upstream SHA, applies exactly one source mutation, runs the stock purity/vendor setup and full 300-matrix benchmark, and uploads score, patch, run log, source SHA, and failure status. The aggregate job ranks exact scores and reports delta from the control.

## Funnel after Wave 1

Promote only repeatable score reductions. For work-reducing winners, compose the best independent cuts and test interactions. Use reclaimed headroom for Wave 2 one-for-one replacements: alternate quotient metrics, deletion schedules, deterministic seed schedules, and structural gate refinements. Run the full adversarial/cap council before any submission. Final dispatch must come from a fresh clone whose upstream sourceRef is rechecked after all long tests.
