#!/usr/bin/env bash
set -Eeuo pipefail

BASE=f48a17f6b1757ca6d2ef399bf70aa3f286d44b27
PR_COMPOSE=328
PR_DENSE=330
ROOT="${GITHUB_WORKSPACE:?}"
OUT="$ROOT/matrices-candidate/artifacts/328-330"
WORK="$RUNNER_TEMP/matrices-candidate-328-330"
mkdir -p "$OUT" "$WORK"
exec > >(tee "$OUT/full.log") 2>&1

section() { printf '\n\n===== %s =====\n' "$*"; }

section "host and prerequisites"
uname -a
nproc
free -h
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  git git-lfs gcc g++ build-essential bubblewrap jq curl ca-certificates \
  pkg-config libssl-dev
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
git lfs install

if ! command -v rustup >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
fi
export PATH="$HOME/.cargo/bin:$PATH"
rustup toolchain install stable --profile minimal
rustup default stable
if [[ "$(cargo deny --version 2>/dev/null || true)" != "cargo-deny 0.20.2" ]]; then
  cargo install cargo-deny --version 0.20.2 --locked --force
fi
git --version
git lfs version
gcc --version | head -1
cargo --version
rustc --version
cargo deny --version

section "clone exact accepted base"
cd "$WORK"
git clone https://github.com/Layr-Labs/ssi-ordering-challenge.git repo
cd repo
git checkout --detach "$BASE"
git lfs pull
(( $(wc -c < corpus/dev/patterns.jsonl) > 10000000 ))
git status --short

section "fetch exact source agents"
git fetch origin \
  "pull/$PR_COMPOSE/head:refs/remotes/origin/pr/$PR_COMPOSE" \
  "pull/$PR_DENSE/head:refs/remotes/origin/pr/$PR_DENSE"
COMPOSE_HEAD="$(git rev-parse refs/remotes/origin/pr/$PR_COMPOSE)"
DENSE_HEAD="$(git rev-parse refs/remotes/origin/pr/$PR_DENSE)"
printf 'base\t%s\ncompose_pr_%s\t%s\ndense_pr_%s\t%s\n' \
  "$BASE" "$PR_COMPOSE" "$COMPOSE_HEAD" "$PR_DENSE" "$DENSE_HEAD" \
  | tee "$OUT/lineage.tsv"

section "compose source only"
git checkout "refs/remotes/origin/pr/$PR_COMPOSE" -- src/ordering
git diff --binary "$BASE" "refs/remotes/origin/pr/$PR_DENSE" -- src/ordering/mod.rs \
  > "$WORK/pr330-dense.patch"
git apply --check "$WORK/pr330-dense.patch"
git apply "$WORK/pr330-dense.patch"
cp "$WORK/pr330-dense.patch" "$OUT/pr330-dense.patch"

git diff --check
git diff --stat | tee "$OUT/diff.stat"
git diff --binary > "$OUT/candidate.patch"
git status --short | tee "$OUT/status.txt"

# Enforce the challenge mutation boundary.
if git status --porcelain | awk '{print $2}' | grep -v '^src/ordering/' | grep -q .; then
  echo "ERROR: candidate changed a path outside src/ordering/" >&2
  exit 1
fi

section "prepare and build"
bash scripts/prepare-build.sh
cargo build --release -p ssi-ordering-challenge --offline --locked
bash scripts/local-candidate-build.sh

section "full 300-matrix dev run"
/usr/bin/time -v cargo run --release --offline --locked -- \
  --note "PR328 graded composition plus PR330 task-neutral DegSqrt substitution" \
  | tee "$OUT/dev-run.log"
cp score.json "$OUT/score.json"
cp results.tsv "$OUT/results.tsv"
cat score.json

section "candidate and time-cap tests"
cargo test --release -p ssi-candidate-worker --offline --locked --no-run \
  | tee "$OUT/candidate-test-build.log"
cargo test --release -p ssi-ordering-challenge --offline --locked --test time_cap \
  | tee "$OUT/time-cap.log"

section "final source audit"
git diff --check
git status --short
cp src/ordering/mod.rs "$OUT/mod.rs"
cp src/ordering/rgreedy.rs "$OUT/rgreedy.rs"
sha256sum "$OUT"/* | tee "$OUT/SHA256SUMS.txt"
