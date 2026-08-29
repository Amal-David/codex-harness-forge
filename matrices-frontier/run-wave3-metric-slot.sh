#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${HYPOTHESIS_ID:?}"
: "${PERSONA:?}"
: "${METRIC_MODE:?}"
: "${METRIC_NAME:?}"
: "${METRIC_ALPHA:?}"
: "${FRONTIER_SHA:?}"

ROOT="${GITHUB_WORKSPACE:?}"
OUT="$ROOT/matrices-frontier/artifacts-wave3/$HYPOTHESIS_ID"
WORK="$RUNNER_TEMP/ssi-ordering-wave3-$HYPOTHESIS_ID"
mkdir -p "$OUT"
exec > >(tee "$OUT/driver.log") 2>&1

section() { printf '\n\n===== %s =====\n' "$*"; }
write_meta() {
  local phase="$1" status="$2" score="${3:-}" fill="${4:-}"
  {
    printf 'hypothesis\t%s\n' "$HYPOTHESIS_ID"
    printf 'persona\t%s\n' "$PERSONA"
    printf 'metric_mode\t%s\n' "$METRIC_MODE"
    printf 'metric_name\t%s\n' "$METRIC_NAME"
    printf 'metric_alpha\t%s\n' "$METRIC_ALPHA"
    printf 'phase\t%s\n' "$phase"
    printf 'status\t%s\n' "$status"
    printf 'frontier_sha\t%s\n' "$FRONTIER_SHA"
    printf 'score\t%s\n' "$score"
    printf 'fill\t%s\n' "$fill"
  } > "$OUT/meta.tsv"
}
trap 'rc=$?; if [[ ! -f "$OUT/meta.tsv" ]]; then write_meta driver "failed:$rc"; fi' EXIT

section host
uname -a
nproc
free -h

section prerequisites
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends build-essential gcc g++ git git-lfs jq ca-certificates pkg-config bubblewrap
git lfs install
rustup default stable
if [[ "$(cargo deny --version 2>/dev/null || true)" != "cargo-deny 0.20.2" ]]; then
  cargo install cargo-deny --version 0.20.2 --locked
fi
cargo deny --version

section "clone pinned frontier"
rm -rf "$WORK"
git clone https://github.com/Layr-Labs/ssi-ordering-challenge.git "$WORK"
cd "$WORK"
git checkout --detach "$FRONTIER_SHA"
git lfs pull
test "$(git rev-parse HEAD)" = "$FRONTIER_SHA"
test "$(wc -l < corpus/dev/patterns.jsonl)" -eq 300
printf '%s\n' "$FRONTIER_SHA" > "$OUT/frontier-sha.txt"

section "replace exactly one reclaimed medium slot"
python3 - "$METRIC_MODE" "$METRIC_NAME" "$METRIC_ALPHA" "$OUT/replacement.tsv" <<'PY'
from pathlib import Path
import sys

mode, name, alpha, evidence_path = sys.argv[1:]
path = Path("src/ordering/mod.rs")
text = path.read_text()
start_marker = "        if nnz >= 200_000 && medium_metric_hub_safe {\n"
end_marker = "        } else {\n            let amf_opts2 = feral_amf::AmfOptions {"
start = text.find(start_marker)
if start < 0:
    raise SystemExit("medium replacement-slot start marker not found")
end = text.find(end_marker, start)
if end < 0:
    raise SystemExit("medium replacement-slot end marker not found")
block_end = end + len("        } else {\n")
old = text[start:block_end]

if mode == "control":
    new = old
elif mode == "custom":
    new = f'''        if nnz >= 200_000 && medium_metric_hub_safe {{
            consider!(move || custom_metrics::order_variant(
                &core,
                {alpha},
                true,
                custom_metrics::ScoreVariant::{name},
            ));
        }} else {{
'''
elif mode == "generic":
    new = f'''        if nnz >= 200_000 && medium_metric_hub_safe {{
            if let Some(spec) = metric_sweep::EXTRA_METRICS
                .iter()
                .find(|s| s.name == "{name}")
            {{
                consider!(move || metric_sweep::order_generic(&core, {alpha}, true, spec));
            }}
        }} else {{
'''
else:
    raise SystemExit(f"unknown metric mode: {mode}")

if mode != "control" and old == new:
    raise SystemExit("requested mutation is byte-identical to source")
text = text[:start] + new + text[block_end:]
path.write_text(text)
Path(evidence_path).write_text(
    f"mode\t{mode}\nname\t{name}\nalpha\t{alpha}\nold_bytes\t{len(old)}\nnew_bytes\t{len(new)}\n"
)
print(Path(evidence_path).read_text(), end="")
PY

git diff --check -- src/ordering
if git status --porcelain | awk '{print $2}' | grep -v '^src/ordering/' | grep -q .; then
  echo "mutation escaped src/ordering" >&2
  git status --short
  exit 3
fi
git diff --stat -- src/ordering | tee "$OUT/patch.stat"
git diff --binary -- src/ordering > "$OUT/candidate.patch"

section "stock setup"
set +e
bash scripts/prepare-build.sh > "$OUT/setup.log" 2>&1
setup_rc=$?
set -e
cat "$OUT/setup.log"
if [[ $setup_rc -ne 0 ]]; then
  write_meta setup "failed:$setup_rc"
  exit "$setup_rc"
fi
cargo build --release -p ssi-ordering-challenge --offline --locked > "$OUT/parent-build.log" 2>&1
cat "$OUT/parent-build.log"

section "candidate build"
set +e
bash scripts/local-candidate-build.sh > "$OUT/candidate-build.log" 2>&1
build_rc=$?
set -e
cat "$OUT/candidate-build.log"
if [[ $build_rc -ne 0 ]]; then
  write_meta candidate-build "failed:$build_rc"
  exit "$build_rc"
fi

section "full 300-matrix benchmark"
set +e
cargo run --release --offline --locked -- --note "$HYPOTHESIS_ID" > "$OUT/run.log" 2>&1
run_rc=$?
set -e
cat "$OUT/run.log"
[[ -f score.json ]] && cp score.json "$OUT/score.json"
[[ -f results.tsv ]] && cp results.tsv "$OUT/results.tsv"
if [[ $run_rc -ne 0 || ! -f score.json ]]; then
  write_meta benchmark "failed:$run_rc"
  exit "$run_rc"
fi
score="$(jq -r '.score' score.json)"
fill="$(jq -r '.metrics.geomean_fill_ratio' score.json)"
write_meta benchmark ok "$score" "$fill"
sha256sum "$OUT"/* | sort > "$OUT/SHA256SUMS.txt" || true
cat "$OUT/meta.tsv"
