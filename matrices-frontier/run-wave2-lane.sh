#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${HYPOTHESIS_ID:?}"
: "${PERSONA:?}"
: "${PATCH_ID:?}"
: "${FRONTIER_SHA:?}"

ROOT="${GITHUB_WORKSPACE:?}"
OUT="$ROOT/matrices-frontier/artifacts-wave2/$HYPOTHESIS_ID"
WORK="$RUNNER_TEMP/ssi-ordering-wave2-$HYPOTHESIS_ID"
mkdir -p "$OUT"
exec > >(tee "$OUT/driver.log") 2>&1

section() { printf '\n\n===== %s =====\n' "$*"; }
write_meta() {
  local phase="$1" status="$2" score="${3:-}" fill="${4:-}"
  {
    printf 'hypothesis\t%s\n' "$HYPOTHESIS_ID"
    printf 'persona\t%s\n' "$PERSONA"
    printf 'patch_id\t%s\n' "$PATCH_ID"
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
# Ubuntu 24.04 hosted runners otherwise deny Bubblewrap's loopback namespace.
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
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

section "apply architecture ablation"
python3 - "$PATCH_ID" "$OUT/replacements.tsv" <<'PY'
from pathlib import Path
import re
import sys

patch_id = sys.argv[1]
evidence = Path(sys.argv[2])
path = Path("src/ordering/mod.rs")
text = path.read_text()
changes = []

def exact(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one exact match, found {count}")
    text = text.replace(old, new, 1)
    changes.append((label, old.replace("\n", "\\n"), new.replace("\n", "\\n")))

def regex(pattern: str, repl: str, label: str) -> None:
    global text
    text2, count = re.subn(pattern, repl, text, count=1, flags=re.M)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one regex match, found {count}")
    text = text2
    changes.append((label, pattern, repl))

def set_const(name: str, value: str) -> None:
    regex(rf"^(\s*const\s+{re.escape(name)}\s*:\s*[^=;\n]+\s*=\s*)[^;\n]+(;)",
          rf"\g<1>{value}\g<2>", f"const:{name}")

wrapper = "order_with_options(pattern, relabel_cap, true, true, true, true, usize::MAX)"

def set_options(orbit="true", pharm="true", midx="true", rgreedy="true", telos="usize::MAX"):
    exact(wrapper,
          f"order_with_options(pattern, relabel_cap, {orbit}, {pharm}, {midx}, {rgreedy}, {telos})",
          "order-options")

if patch_id == "control":
    pass
elif patch_id == "no-orbit":
    set_options(orbit="false")
elif patch_id == "no-pharmakos":
    set_options(pharm="false")
elif patch_id == "no-midx":
    set_options(midx="false")
elif patch_id == "no-rgreedy-all":
    set_options(rgreedy="false")
elif patch_id == "no-telos-ms":
    set_options(telos="0")
elif patch_id.startswith("telos-ms-"):
    set_options(telos=patch_id.rsplit("-", 1)[1])
elif patch_id.startswith("relabel-cap-"):
    cap = patch_id.rsplit("-", 1)[1]
    exact("order_with_relabel_cap(pattern, usize::MAX)",
          f"order_with_relabel_cap(pattern, {cap})", "relabel-cap")
elif patch_id == "no-early-minl":
    exact("if nnz > 0 && nnz < MINL_MAX_NNZ && !minl_off() {",
          "if false && nnz > 0 && nnz < MINL_MAX_NNZ && !minl_off() {",
          "early-minl")
elif patch_id == "no-terminal-minl":
    exact("let terminal_minl_gate = (n <= 30_000 && nnz <= 100_000)",
          "let terminal_minl_gate = false && (n <= 30_000 && nnz <= 100_000)",
          "terminal-minl")
elif patch_id == "no-pair-descent":
    exact("if pair_descent_gate {", "if false && pair_descent_gate {", "pair-descent")
elif patch_id == "terminal-only-completion":
    exact("if nnz > 0 && nnz < MINL_MAX_NNZ && !minl_off() {",
          "if false && nnz > 0 && nnz < MINL_MAX_NNZ && !minl_off() {",
          "early-minl")
    set_options(orbit="false")
elif patch_id == "no-completion-all":
    exact("if nnz > 0 && nnz < MINL_MAX_NNZ && !minl_off() {",
          "if false && nnz > 0 && nnz < MINL_MAX_NNZ && !minl_off() {",
          "early-minl")
    exact("let terminal_minl_gate = (n <= 30_000 && nnz <= 100_000)",
          "let terminal_minl_gate = false && (n <= 30_000 && nnz <= 100_000)",
          "terminal-minl")
    set_options(orbit="false")
elif patch_id == "no-orbit-no-pharmakos":
    set_options(orbit="false", pharm="false")
elif patch_id == "no-midx-no-pharmakos":
    set_options(pharm="false", midx="false")
elif patch_id == "no-main-telos-all":
    set_const("TELOS_MAX_NNZ", "0")
elif patch_id == "no-hillclimb":
    set_const("HC_MAX_NNZ", "0")
elif patch_id == "no-peel-countrel":
    exact("if nnz > 0 && nnz < PEEL_CNTREL_MAX_NNZ {",
          "if false && nnz > 0 && nnz < PEEL_CNTREL_MAX_NNZ {",
          "peel-countrel")
elif patch_id == "no-shot3":
    exact("if nnz > 0 && nnz < FILLG_STRIPV2_MAX_NNZ {",
          "if false && nnz > 0 && nnz < FILLG_STRIPV2_MAX_NNZ {",
          "shot3")
elif patch_id == "no-whole-rgreedy-only":
    exact("if rgreedy_enabled\n        && ((n <= RGREEDY_MAX_N && (rgreedy_pep_gate || rgreedy_rgs_gate)) || rgreedy_mid_gate)",
          "if false && rgreedy_enabled\n        && ((n <= RGREEDY_MAX_N && (rgreedy_pep_gate || rgreedy_rgs_gate)) || rgreedy_mid_gate)",
          "whole-rgreedy")
elif patch_id == "no-rgsub-only":
    exact("if rgreedy_enabled && n >= 500 && nnz > 0 && nnz <= RGSUB_MAX_NNZ {",
          "if false && rgreedy_enabled && n >= 500 && nnz > 0 && nnz <= RGSUB_MAX_NNZ {",
          "rgsub")
elif patch_id == "no-pair-and-terminal":
    exact("if pair_descent_gate {", "if false && pair_descent_gate {", "pair-descent")
    exact("let terminal_minl_gate = (n <= 30_000 && nnz <= 100_000)",
          "let terminal_minl_gate = false && (n <= 30_000 && nnz <= 100_000)",
          "terminal-minl")
else:
    raise SystemExit(f"unknown patch id: {patch_id}")

path.write_text(text)
with evidence.open("w") as f:
    for label, old, new in changes:
        f.write(f"{label}\t{old}\t{new}\n")
print(evidence.read_text(), end="")
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
