#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${HYPOTHESIS_ID:?}"
: "${PERSONA:?}"
: "${PATCH_KIND:?}"
: "${FRONTIER_SHA:?}"

ROOT="${GITHUB_WORKSPACE:?}"
OUT="$ROOT/matrices-frontier/artifacts/$HYPOTHESIS_ID"
WORK="$RUNNER_TEMP/ssi-ordering-$HYPOTHESIS_ID"
mkdir -p "$OUT"

exec > >(tee "$OUT/driver.log") 2>&1

section() { printf '\n\n===== %s =====\n' "$*"; }

write_meta() {
  local phase="$1"
  local status="$2"
  local score="${3:-}"
  local fill="${4:-}"
  {
    printf 'hypothesis\t%s\n' "$HYPOTHESIS_ID"
    printf 'persona\t%s\n' "$PERSONA"
    printf 'phase\t%s\n' "$phase"
    printf 'status\t%s\n' "$status"
    printf 'frontier_sha\t%s\n' "$FRONTIER_SHA"
    printf 'patch_kind\t%s\n' "$PATCH_KIND"
    printf 'const_name\t%s\n' "${CONST_NAME:-}"
    printf 'const_value\t%s\n' "${CONST_VALUE:-}"
    printf 'score\t%s\n' "$score"
    printf 'fill\t%s\n' "$fill"
  } > "$OUT/meta.tsv"
}

trap 'rc=$?; if [[ ! -f "$OUT/meta.tsv" ]]; then write_meta "driver" "failed:$rc"; fi' EXIT

section "host"
uname -a
nproc
free -h

section "prerequisites"
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends \
  build-essential gcc g++ git git-lfs jq ca-certificates pkg-config bubblewrap
# Ubuntu's AppArmor default blocks Bubblewrap's loopback setup unless
# unprivileged user namespaces are explicitly enabled for this ephemeral runner.
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
git lfs install
rustup default stable
cargo --version
rustc --version
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
git log -1 --format=fuller > "$OUT/frontier-commit.txt"

section "apply isolated mutation"
if [[ "$PATCH_KIND" == "control" ]]; then
  echo "control lane: source unchanged"
elif [[ "$PATCH_KIND" == "const" ]]; then
  : "${CONST_NAME:?}"
  : "${CONST_VALUE:?}"
  python3 - "$CONST_NAME" "$CONST_VALUE" "$OUT/replacement.tsv" <<'PY'
from pathlib import Path
import re
import sys

name, value, evidence = sys.argv[1], sys.argv[2], Path(sys.argv[3])
root = Path("src/ordering")
pattern = re.compile(
    rf"(?m)^(\s*const\s+{re.escape(name)}\s*:\s*[^=;\n]+\s*=\s*)([^;\n]+)(;)"
)
hits = []
for path in sorted(root.rglob("*.rs")):
    text = path.read_text()
    for match in pattern.finditer(text):
        hits.append((path, match.start(), match.group(2).strip()))
if len(hits) != 1:
    raise SystemExit(f"expected exactly one definition of {name}, found {len(hits)}: {hits}")
path, _, old = hits[0]
text = path.read_text()
new_text, count = pattern.subn(lambda m: m.group(1) + value + m.group(3), text, count=1)
if count != 1:
    raise SystemExit(f"replacement count for {name}: {count}")
path.write_text(new_text)
evidence.write_text(f"{path}\t{name}\t{old}\t{value}\n")
print(evidence.read_text(), end="")
PY
else
  echo "unknown PATCH_KIND=$PATCH_KIND" >&2
  exit 2
fi

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
  write_meta "setup" "failed:$setup_rc"
  exit "$setup_rc"
fi

cargo build --release -p ssi-ordering-challenge --offline --locked \
  > "$OUT/parent-build.log" 2>&1
cat "$OUT/parent-build.log"

section "candidate build"
set +e
bash scripts/local-candidate-build.sh > "$OUT/candidate-build.log" 2>&1
build_rc=$?
set -e
cat "$OUT/candidate-build.log"
if [[ $build_rc -ne 0 ]]; then
  write_meta "candidate-build" "failed:$build_rc"
  exit "$build_rc"
fi

section "full 300-matrix benchmark"
set +e
cargo run --release --offline --locked -- --note "$HYPOTHESIS_ID" \
  > "$OUT/run.log" 2>&1
run_rc=$?
set -e
cat "$OUT/run.log"

if [[ -f score.json ]]; then
  cp score.json "$OUT/score.json"
fi
if [[ -f results.tsv ]]; then
  cp results.tsv "$OUT/results.tsv"
fi

if [[ $run_rc -ne 0 || ! -f score.json ]]; then
  write_meta "benchmark" "failed:$run_rc"
  exit "$run_rc"
fi

score="$(jq -r '.score' score.json)"
fill="$(jq -r '.metrics.geomean_fill_ratio' score.json)"
write_meta "benchmark" "ok" "$score" "$fill"

section "source audit"
git diff --check -- src/ordering
sha256sum "$OUT"/* | sort > "$OUT/SHA256SUMS.txt" || true
cat "$OUT/meta.tsv"
