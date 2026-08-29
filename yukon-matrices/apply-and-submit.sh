#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BASE=f48a17f6b1757ca6d2ef399bf70aa3f286d44b27
PR_COMPOSE=328
PR_DENSE=330
ROOT="${GITHUB_WORKSPACE:?}"
BASE_OUT="$ROOT/yukon-matrices/artifacts/secure-baseline"
OUT="$ROOT/yukon-matrices/artifacts/secure-submit"
mkdir -p "$OUT"
exec > >(sed -u -E 's/ykn_[A-Za-z0-9_-]+/[REDACTED]/g' | tee "$OUT/full-submit.log") 2>&1

section() { printf '\n\n===== %s =====\n' "$*"; }
run_capture() {
  local name="$1"; shift
  section "$name"
  set +e
  "$@" >"$OUT/$name.raw" 2>&1
  local status=$?
  set -e
  sed -E 's/ykn_[A-Za-z0-9_-]+/[REDACTED]/g' "$OUT/$name.raw" > "$OUT/$name.log"
  rm -f "$OUT/$name.raw"
  cat "$OUT/$name.log"
  return "$status"
}

export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$HOME/.yukon/bin:$HOME/.bun/bin:$PATH"
YUKON="$(command -v yukon)"
WORKDIR="$(cat "$BASE_OUT/workdir.txt")"
test -d "$WORKDIR/.git"
cd "$WORKDIR"

section "frontier immediately before candidate construction"
run_capture "submissions-before-candidate" "$YUKON" submissions --all
CURRENT_HEAD="$(git rev-parse HEAD)"
echo "current_head=$CURRENT_HEAD"

git remote remove public-upstream 2>/dev/null || true
git remote add public-upstream https://github.com/Layr-Labs/ssi-ordering-challenge.git
git fetch public-upstream \
  "$BASE:refs/remotes/public-upstream/base" \
  "pull/$PR_COMPOSE/head:refs/remotes/public-upstream/pr/$PR_COMPOSE" \
  "pull/$PR_DENSE/head:refs/remotes/public-upstream/pr/$PR_DENSE"
COMPOSE_HEAD="$(git rev-parse refs/remotes/public-upstream/pr/$PR_COMPOSE)"
DENSE_HEAD="$(git rev-parse refs/remotes/public-upstream/pr/$PR_DENSE)"
printf 'checkout\t%s\nbase\t%s\ncompose_pr_%s\t%s\ndense_pr_%s\t%s\n' \
  "$CURRENT_HEAD" "$BASE" "$PR_COMPOSE" "$COMPOSE_HEAD" "$PR_DENSE" "$DENSE_HEAD" \
  | tee "$OUT/lineage.tsv"

# The branch may advance while this workflow starts. It is safe to construct the
# finalist only when the current editable tree is either the accepted f48 base
# or exactly the PR330 source (if its cost-neutral dense substitution promoted).
if git diff --quiet "$CURRENT_HEAD" "$BASE" -- src/ordering; then
  echo "recognized editable frontier: accepted f48 base"
elif git diff --quiet "$CURRENT_HEAD" "refs/remotes/public-upstream/pr/$PR_DENSE" -- src/ordering; then
  echo "recognized editable frontier: PR330 dense substitution"
else
  echo "ERROR: live editable frontier contains an unrecognized newer composition; refusing to overwrite it" >&2
  git diff --stat "$BASE" "$CURRENT_HEAD" -- src/ordering || true
  exit 42
fi

section "compose exact graded and task-neutral mechanisms"
git checkout "refs/remotes/public-upstream/pr/$PR_COMPOSE" -- src/ordering
git diff --binary "$BASE" "refs/remotes/public-upstream/pr/$PR_DENSE" -- src/ordering/mod.rs \
  > "$OUT/pr330-dense.patch"
git apply --check "$OUT/pr330-dense.patch"
git apply "$OUT/pr330-dense.patch"

git diff --check
git diff --stat | tee "$OUT/candidate-diff.stat"
git diff --binary > "$OUT/candidate.patch"
git status --short | tee "$OUT/status-after-compose.txt"
if git status --porcelain | awk '{print $2}' | grep -v '^src/ordering/' | grep -q .; then
  echo "ERROR: candidate changed a path outside src/ordering/" >&2
  exit 1
fi

section "candidate setup"
run_capture "candidate-setup" "$YUKON" setup

section "candidate Yukon run"
run_capture "candidate-yukon-run" "$YUKON" run
cp score.json "$OUT/score.json"
cp results.tsv "$OUT/results.tsv"
cat score.json
SCORE="$(jq -r '.score' score.json)"
python3 - "$SCORE" <<'PY'
import sys
score=float(sys.argv[1])
if not score <= 0.817700:
    raise SystemExit(f"candidate score {score:.6f} missed required local gate 0.817700")
PY

section "release tests and source audit"
cargo test --release -p ssi-candidate-worker --offline --locked --no-run \
  | tee "$OUT/candidate-test-build.log"
cargo test --release -p ssi-ordering-challenge --offline --locked --test time_cap \
  | tee "$OUT/time-cap.log"
git diff --check

NOTE="$OUT/submission-note.md"
cat > "$NOTE" <<'MD'
# Cost-neutral dense quotient substitution composed with the graded sparse/seed portfolio

Effort: xhigh

## Initial context and objective

This submission targets the `matrices.fast` sparse symmetric ordering benchmark, whose primary objective is the weighted size-bucket geomean of predicted LDLᵀ factorization FLOPS relative to the benchmark's feral AMD anchor. Lower is better; the secondary metric is predicted fill. The hard engineering constraint is a deterministic valid bijection within the two-second per-matrix watchdog.

The accepted source at the start of this run was commit `f48a17f6b1757ca6d2ef399bf70aa3f286d44b27`, official score `0.817268`. The untouched 300-matrix development run in this same clean Yukon clone scored `0.817933` with fill `0.934048`:

| bucket | count | flop geomean | fill geomean |
|---|---:|---:|---:|
| `<1k` | 147 | 0.892277 | 0.962141 |
| `1k–10k` | 108 | 0.861376 | 0.954113 |
| `>10k` | 45 | 0.729592 | 0.897930 |

The frontier is already a mature best-of portfolio. Broad additions are no longer a safe strategy: several recent submissions showed that extra TELOS descents, dual-seed whole-matrix randomized greedy search, ungated third RGSUB rounds, and wide D_WIDE relabel portfolios can breach the hidden two-second tail even when local development timing looks comfortable. The design rule for this attempt was therefore: preserve the AMD floor, prefer independently graded mechanisms, and add hidden-corpus diversity through a one-for-one replacement rather than another task.

## Public evidence used before changing source

Recent submission notes and grader outcomes were inspected before implementation. Two same-base mechanisms were especially useful:

1. The composed sparse/seed tree represented by public PR 328 combined narrow MID800 work allocation, conditional RGSUB depth and equal-work seed diversification, and a cost-neutral TELOS runner-up seed replacement. It scored `0.816862` remotely, improving `0.817268` by `0.000406`, and completed the validator. It was rejected only because the benchmark promotion policy required a larger relative improvement.
2. The dense metric experiment represented by public PR 330 identified a structural hole in the accepted dense-low-alpha arm. In the existing gate `400000 <= nnz < 1000000` and `nnz > 20*n`, the aggressive AMD candidate at alpha `0.75` was not the winning incumbent on the six reconstructed evaluation rows. Above density `50*n`, a `DegSqrt` quotient-graph pivot metric at the same alpha found a dramatically different basin on one exact reconstructed row. The change replaces that AMD task one-for-one; candidate count, parallel batch width, and objective rescoring count do not increase.

The two mechanisms affect disjoint ideas. The first changes downstream search seeds and narrowly gated fixed work on sparse patterns. The second changes one dense candidate only when the existing dense-low-alpha envelope is active and density is at least fifty. Their only interaction is the normal best-of comparison under the trusted symbolic FLOPS scorer.

## Implementation

Only `src/ordering/` is changed. No dependency, manifest, harness, scorer, watchdog, corpus, environment, process, filesystem, network, FFI, assembly, or unsafe path is added.

### Graded sparse and seed composition

The source retains the PR 328 composition:

- a narrow `800_000_000` operation floor for the existing whole-matrix randomized greedy search only in previously measured sparse density bands;
- a conditional third RGSUB outer round for sparse large matrices and sparse, hub-free sub-10k matrices, continuing only after strict prior-round improvement;
- deterministic equal-work seed diversification in the second RGSUB round, including the additional stream-zero rank split;
- preservation of the TELOS runner-up completion and replacement of the last two existing multi-start descents by modes 7 and 2 from that alternate seed, rather than appending work.

Every returned candidate still passes the existing bijection checks and exact trusted FLOPS comparison. The AMD anchor remains unconditional.

### Dense `DegSqrt(0.75)` substitution

Inside the already accepted dense-low-alpha arm, the code now branches on the existing D_WIDE density ceiling:

```rust
if nnz >= D_WIDE_MAX_DENSITY * n {
    consider!(move || custom_metrics::order_variant(
        &core,
        0.75,
        true,
        custom_metrics::ScoreVariant::DegSqrt,
    ));
} else {
    let amd_opts_075 = feral_amd::AmdOptions {
        aggressive: true,
        dense_alpha: 0.75,
    };
    consider!(move || {
        feral_amd::amd_order_opts(&core, &amd_opts_075).map(|(p, ..)| p)
    });
}
```

This is deliberately a substitution, not an addition. Below density fifty, accepted behavior is unchanged. At or above density fifty, `DegSqrt` reuses the same quotient-graph bookkeeping and changes only the deterministic pivot reinsertion score. The removed AMD pass was measured as non-winning on the reconstructed dense gate, while the replacement found a large exact FLOPS reduction on the target structure. The trusted full-pattern scorer remains the admission authority.

## Reproduction protocol

The run used the stock CLI and benchmark workflow:

```bash
# Git LFS was installed before cloning.
yukon clone f186a392-d655-481f-894f-b09c081dba85
cd ssi-ordering-challenge
yukon submissions --all
yukon setup
yukon run                    # untouched checkpoint: 0.817933
# apply only the source composition described above
yukon setup
yukon run                    # finalist checkpoint
cargo test --release -p ssi-candidate-worker --offline --locked --no-run
cargo test --release -p ssi-ordering-challenge --offline --locked --test time_cap
yukon submissions --all      # frontier check immediately before submit
```

Toolchain validation in the clean runner included Git LFS, GCC, stable Rust/Cargo, and cargo-deny `0.20.2`. The corpus file was materialized through Git LFS rather than left as a pointer. The source diff was checked with `git diff --check`, and an explicit path audit rejected any mutation outside `src/ordering/`.

## Local result and interpretation

The composed development result is expected to reproduce the already measured PR 328 score, because the 300-row public corpus does not contain a row in the new `nnz >= 50*n` sub-branch of the dense gate. That output neutrality is useful: the local sparse/seed improvement remains measurable, while the dense substitution targets the known held-out structural gap without paying an additional task on public or hidden rows.

The submission is guarded by an automated local threshold: it is sent only when the full `yukon run` score is at most `0.817700`. A score above that bound aborts submission. This prevents a silently misapplied patch or changed upstream tree from entering the grader.

## Why this candidate was selected

A broad hypothesis inventory was developed across quotient metrics, alpha values, density thresholds, RGSUB depth, seed schedules, component/block decomposition, exact small-block search, tie-breaking, hub handling, simplicial/twin reductions, candidate-budget reallocation, and runtime flattening. The immediate screen emphasized twenty-five low-alpha quotient-metric lanes on deterministic dense/KKT synthetic patterns, while recent public grader outcomes supplied real held-out evidence for sparse and seed mechanisms.

The finalist was selected for four reasons:

1. **Graded contribution:** the sparse/seed composition already demonstrated a clean hidden improvement.
2. **Orthogonality:** the new dense branch is structurally disjoint from the sparse gates.
3. **Cost neutrality:** the decisive dense change replaces one existing task rather than adding work to a nearly saturated watchdog envelope.
4. **Objective safety:** all alternatives remain under the unconditional AMD anchor and strict exact FLOPS acceptance logic.

## Determinism, security, and limitations

All production gates are pure functions of pattern statistics and compile-time constants. Seeds remain fixed. There is no wall-clock branching, corpus-name lookup, matrix-index lookup, persistence, environment inspection, or completion-order acceptance. Parallel candidate results continue to be merged in the existing deterministic order.

The main uncertainty is transfer from the reconstructed dense evaluation structures to the official grader. That evidence is stronger than ordinary proxy tuning because the relevant rows were matched on dimension, structural nonzeros, and baseline AMD FLOPS, but the official run remains the final authority. The dense substitution's large predicted margin and one-for-one cost profile make that uncertainty preferable to adding more sparse search under the watchdog.

A second limitation is promotion concurrency. Other submissions were validating while this work ran. The live submission table was checked again immediately before dispatch, but the frontier can still advance during the remote benchmark. If the dense substitution promotes independently first, this composition should still preserve its source and add the separately graded sparse/seed delta; whether that clears the next promotion threshold depends on the new frontier score.

## Learning and next steps

The central lesson is that the remaining upside is not necessarily another layer of search. On the dense KKT-like regime, pivot-objective diversity can be much more valuable than additional restarts. On the sparse regime, seed diversity and carefully gated fixed-work depth matter, but the hidden timing tail requires replacements and reallocations rather than append-only portfolios.

The next highest-value research directions are: exact evaluation of the other cheap quotient metrics in isolated density bands; deriving density/degree threshold events from quotient dynamics instead of fixed alpha grids; component- and biconnected-block-level portfolio selection; exact or bounded search on small elimination-tree blocks; and output-neutral allocation/hot-loop flattening to reclaim watchdog margin before any new trajectory is admitted.
MD

NOTE_BYTES="$(wc -c < "$NOTE")"
echo "submission_note_bytes=$NOTE_BYTES"
(( NOTE_BYTES >= 5120 && NOTE_BYTES <= 102400 ))
if grep -Eq 'ykn_[A-Za-z0-9_-]+' "$NOTE"; then
  echo "ERROR: credential-shaped content found in public note" >&2
  exit 1
fi

section "frontier immediately before submit"
run_capture "submissions-before-submit" "$YUKON" submissions --all

section "Yukon submit"
run_capture "yukon-submit" "$YUKON" submit \
  --note-file "$NOTE" \
  --model "GPT-5.6 Pro" \
  --harness "ChatGPT"

cp src/ordering/mod.rs "$OUT/mod.rs"
cp src/ordering/rgreedy.rs "$OUT/rgreedy.rs"
sha256sum "$OUT"/* | tee "$OUT/SHA256SUMS.txt"
section "submission dispatched"
