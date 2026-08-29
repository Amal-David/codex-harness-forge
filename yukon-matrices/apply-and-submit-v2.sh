#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${GITHUB_WORKSPACE:?}"
SOURCE="$ROOT/yukon-matrices/apply-and-submit.sh"
GENERATED="$RUNNER_TEMP/apply-and-submit-v2.generated.sh"

python3 - "$SOURCE" "$GENERATED" <<'PY'
from pathlib import Path
import sys
src = Path(sys.argv[1]).read_text()

needle = '''git apply "$OUT/pr330-dense.patch"

git diff --check
'''
insert = '''git apply "$OUT/pr330-dense.patch"

# Reuse an exact duplicate D_WIDE task slot. Alpha 2.0 is already queued by
# the D_WIDE extra-alpha sweep; replace the duplicate low-alpha-tail pass with
# the measured metric winner, preserving task count and timing class.
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
                // Reuse this exact duplicate task slot for the measured dense
                // metric winner, preserving task count and timing envelope.
                if let Some(spec) = metric_sweep::EXTRA_METRICS
                    .iter()
                    .find(|s| s.name == "extra_deg2_div_nv_wf05")
                {
                    consider!(move || metric_sweep::order_generic(&core, 2.5, true, spec));
                }
            }
"""
if s.count(old) != 1:
    raise SystemExit(f"expected exactly one duplicate alpha-2.0 slot, found {s.count(old)}")
p.write_text(s.replace(old, new, 1))
PY_SLOT

git diff --check
'''
if needle not in src:
    raise SystemExit('could not locate composition insertion point')
src = src.replace(needle, insert, 1)

# Tighten the local dispatch gate to the measured task-neutral slot result.
src = src.replace('0.817700', '0.817300')

src = src.replace(
    '# Cost-neutral dense quotient substitution composed with the graded sparse/seed portfolio',
    '# Three-way task-neutral composition: sparse/seed portfolio plus two dense slot substitutions',
    1,
)

marker = '''## Reproduction protocol
'''
addition = '''### Reuse of the duplicate D_WIDE alpha-2.0 slot

The accepted source queues AMF alpha `2.0` twice for density `20..50`: once in the existing D_WIDE extra-alpha sweep and once again at the tail of the dense-low-alpha block. The two calls use the same core, options, aggressive setting, and deterministic implementation, so the second task is an exact duplicate ordering and exact duplicate score evaluation.

This submission replaces only that second duplicate slot with `metric_sweep::extra_deg2_div_nv_wf05` at alpha `2.5`. The alpha-2.0 candidate remains present through the earlier sweep. The replacement therefore preserves total candidate count and parallel-wave count while adding a distinct quotient objective. On the public structural sibling `pooling_sppc3pq`, the completed portfolio moved from `532470788` to `492663446` predicted FLOPS. In the measured composed tree this routing change contributed about `0.000503` to the public aggregate score. An alpha sweep and metric-family sweep reported alpha `2.5` and this metric as the unique mover in that slot.

This third mechanism occupies density `20..50`; the promoted `DegSqrt(0.75)` substitution occupies density at least `50`; the sparse/seed composition is concentrated below `100000` nonzeros. The gates are therefore structurally separated, and both dense changes are one-for-one replacements rather than appended work.

## Reproduction protocol
'''
if marker not in src:
    raise SystemExit('could not locate note insertion point')
src = src.replace(marker, addition, 1)

src = src.replace(
    'The two mechanisms affect disjoint ideas.',
    'The three mechanisms affect disjoint ideas.',
    1,
)
src = src.replace(
    'The first changes downstream search seeds and narrowly gated fixed work on sparse patterns. The second changes one dense candidate only when the existing dense-low-alpha envelope is active and density is at least fifty.',
    'The first changes downstream search seeds and narrowly gated fixed work on sparse patterns. The second changes one dense candidate only when the existing dense-low-alpha envelope is active and density is at least fifty. The third reuses an exact duplicate candidate slot only in the complementary density-twenty-to-fifty D_WIDE range.',
    1,
)
src = src.replace(
    'The finalist was selected for four reasons:',
    'The finalist was selected for five reasons:',
    1,
)
src = src.replace(
    '4. **Objective safety:** all alternatives remain under the unconditional AMD anchor and strict exact FLOPS acceptance logic.',
    '4. **Task-count neutrality:** both dense changes replace existing slots, including one exact duplicate, rather than adding work.\n5. **Objective safety:** all alternatives remain under the unconditional AMD anchor and strict exact FLOPS acceptance logic.',
    1,
)

Path(sys.argv[2]).write_text(src)
PY

chmod 700 "$GENERATED"
exec bash "$GENERATED"
