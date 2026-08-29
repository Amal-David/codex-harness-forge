#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${GITHUB_WORKSPACE:?}"
SOURCE="$ROOT/yukon-matrices/apply-and-submit.sh"
GENERATED="$RUNNER_TEMP/apply-and-submit-v3.generated.sh"

python3 - "$SOURCE" "$GENERATED" <<'PY'
from pathlib import Path
import sys
src = Path(sys.argv[1]).read_text()

# Use the strongest current same-lineage composition. PR339 already contains
# PR328's graded sparse/seed stack, PR330's promoted DegSqrt substitution, the
# validated terminal low-alpha relabel complement, and equal-work round-keyed
# RGSUB seeds.
src = src.replace('PR_COMPOSE=328', 'PR_COMPOSE=339', 1)

# The required untouched Yukon run appends a row to tracked results.tsv. Restore
# that benchmark-generated log before enforcing the source-only mutation gate.
needle = '''cd "$WORKDIR"

section "frontier immediately before candidate construction"
'''
replacement = '''cd "$WORKDIR"
git restore --source=HEAD --worktree -- results.tsv 2>/dev/null || true

section "frontier immediately before candidate construction"
'''
if needle not in src:
    raise SystemExit('could not locate workdir entry')
src = src.replace(needle, replacement, 1)

# PR339 already carries PR330. Keep the PR330 patch as lineage evidence, but do
# not apply it a second time.
old_compose = '''git checkout "refs/remotes/public-upstream/pr/$PR_COMPOSE" -- src/ordering
git diff --binary "$BASE" "refs/remotes/public-upstream/pr/$PR_DENSE" -- src/ordering/mod.rs \\
  > "$OUT/pr330-dense.patch"
git apply --check "$OUT/pr330-dense.patch"
git apply "$OUT/pr330-dense.patch"

git diff --check
'''
new_compose = '''git checkout "refs/remotes/public-upstream/pr/$PR_COMPOSE" -- src/ordering
git diff --binary "$BASE" "refs/remotes/public-upstream/pr/$PR_DENSE" -- src/ordering/mod.rs \\
  > "$OUT/pr330-dense.patch"
# PR339 contains the promoted PR330 hunk already.

# Reuse the exact duplicate D_WIDE alpha-2.0 task slot for the measured
# extra_deg2_div_nv_wf05(alpha=2.5) quotient objective. Alpha 2.0 remains in the
# earlier D_WIDE sweep, so candidate count and wave width stay unchanged.
python3 - <<'PY_SLOT'
from pathlib import Path
p = Path("src/ordering/mod.rs")
s = p.read_text()
old = """            if nnz < D_WIDE_MAX_DENSITY * n {
                let opts_20 = feral_amf::AmfOptions {
                    dense_alpha: 2.0,
                    ..Default::default()
                };
                consider!(move || feral_amf::amf_order_opts(&core, &opts_20).map(|(p, ..)| p));
            }
"""
new = """            if nnz < D_WIDE_MAX_DENSITY * n {
                // Alpha 2.0 is already queued by D_WIDE EXTRA ALPHAS above.
                // Reuse the exact duplicate slot for an orthogonal quotient
                // metric without increasing task count or the timing envelope.
                if let Some(spec) = metric_sweep::EXTRA_METRICS
                    .iter()
                    .find(|s| s.name == "extra_deg2_div_nv_wf05")
                {
                    consider!(move || metric_sweep::order_generic(&core, 2.5, true, spec));
                }
            }
"""
if s.count(old) != 1:
    raise SystemExit(f"expected one duplicate alpha-2.0 slot, found {s.count(old)}")
p.write_text(s.replace(old, new, 1))
PY_SLOT

git diff --check -- src/ordering
'''
if old_compose not in src:
    raise SystemExit('could not locate original composition block')
src = src.replace(old_compose, new_compose, 1)

# Scope all later whitespace audits to the only editable tree. The baseline run
# is allowed to emit score/results files, but they are not candidate source.
src = src.replace('git diff --check\n', 'git diff --check -- src/ordering\n')

# The measured PR339 tree is 0.817636 on dev; the duplicate-slot replacement
# was measured around 0.817128 in the corresponding composed tree.
src = src.replace('0.817700', '0.817300')

src = src.replace(
    '# Cost-neutral dense quotient substitution composed with the graded sparse/seed portfolio',
    '# PR339 graded composition plus a task-neutral duplicate-slot quotient metric',
    1,
)

note_marker = '''## Initial context and objective
'''
note_prefix = '''## Current-lineage clarification

This archive is constructed on promoted commit `6a886223797ac9d54b4e3eeb2cf618f3985f92f3`, official score `0.815285`. It imports the exact `src/ordering/` tree from public PR 339, which already composes the independently graded PR328 sparse/seed stack, the promoted PR330 high-density `DegSqrt(0.75)` substitution, the validated terminal low-alpha relabel complement, and equal-work round-keyed RGSUB seeds. It then makes one additional one-for-one replacement: the duplicate D_WIDE AMF alpha-2.0 task becomes `extra_deg2_div_nv_wf05` at alpha 2.5. The earlier alpha-2.0 task remains present.

The untouched checkpoint in this same clone is run before construction. The candidate is dispatched only when its full 300-matrix development score is at most `0.817300`, all release/time-cap checks pass, and the live frontier still matches the recognized lineage.

## Initial context and objective
'''
if note_marker not in src:
    raise SystemExit('could not locate note heading')
src = src.replace(note_marker, note_prefix, 1)

# Append an explicit fifth-mechanism section before reproduction instructions.
marker = '''## Reproduction protocol
'''
addition = '''### Exact PR339 composition and duplicate-slot extension

PR339 is used as a source snapshot rather than retyping its hunks. Its source contains the officially graded PR328 sparse/seed composition, the promoted PR330 dense substitution, the direct-child terminal relabel mechanism, and a round-keyed equal-work RGSUB seed extension. No new operation budget is introduced by the round-key change; it only prevents later rounds from repeating byte-identical seeds.

The additional extension in this archive targets an exact duplicate: inside D_WIDE density 20–50, AMF alpha 2.0 is already queued by the earlier extra-alpha loop and was queued again in the dense-low-alpha tail. The second byte-identical task is replaced by `metric_sweep::extra_deg2_div_nv_wf05` at alpha 2.5. On the public structural sibling `pooling_sppc3pq`, the completed portfolio moved from 532470788 to 492663446 predicted FLOPS. Because the original alpha-2.0 trajectory remains in the earlier loop, the replacement cannot remove that basin and does not increase task count.

## Reproduction protocol
'''
if marker not in src:
    raise SystemExit('could not locate reproduction heading')
src = src.replace(marker, addition, 1)

Path(sys.argv[2]).write_text(src)
PY

chmod 700 "$GENERATED"
exec bash "$GENERATED"
