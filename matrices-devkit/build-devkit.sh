#!/usr/bin/env bash
set -Eeuo pipefail

BASE_COMMIT="f48a17f6b1757ca6d2ef399bf70aa3f286d44b27"
ROOT="${GITHUB_WORKSPACE:?}"
WORK="$RUNNER_TEMP/matrices-devkit"
STAGE="$WORK/stage"
OUT="$ROOT/matrices-devkit/artifacts"
mkdir -p "$WORK" "$STAGE" "$OUT"

section() { printf '\n===== %s =====\n' "$*"; }

section "host and prerequisites"
uname -a
nproc
free -h
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  git git-lfs gcc g++ build-essential bubblewrap zstd jq curl ca-certificates \
  pkg-config libssl-dev
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
git lfs install

section "Rust stable and cargo-deny"
if ! command -v rustup >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
fi
export PATH="$HOME/.cargo/bin:$PATH"
rustup toolchain install stable --profile default
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

section "clone exact challenge base with Git LFS"
cd "$WORK"
rm -rf repo
git clone https://github.com/Layr-Labs/ssi-ordering-challenge.git repo
cd repo
git checkout --detach "$BASE_COMMIT"
git lfs pull
bytes="$(wc -c < corpus/dev/patterns.jsonl)"
lines="$(wc -l < corpus/dev/patterns.jsonl)"
echo "corpus bytes=$bytes lines=$lines"
(( bytes > 10000000 ))

section "prepare and build offline workspace"
bash scripts/prepare-build.sh
cargo build --release -p ssi-ordering-challenge --offline --locked
bash scripts/local-candidate-build.sh
SSI_MAX_MATRIX_N=500 cargo run --release --offline --locked -- --note "devkit smoke" | tee "$OUT/smoke.log"

section "stage self-contained workspace"
mkdir -p "$STAGE/bin" "$STAGE/repo"
# Preserve the linked source tree, generated manifests, vendor directory, corpus,
# and release build cache. The LFS object cache duplicates the materialized corpus
# and is unnecessary for offline experimentation.
rm -rf .git/lfs/objects
tar -cf - . | tar -xf - -C "$STAGE/repo"

SYSROOT="$(rustc --print sysroot)"
tar -cf - -C "$(dirname "$SYSROOT")" "$(basename "$SYSROOT")" | tar -xf - -C "$STAGE"
mv "$STAGE/$(basename "$SYSROOT")" "$STAGE/rust-toolchain"
cp "$(command -v cargo-deny)" "$STAGE/bin/cargo-deny"
cp "$(command -v git-lfs)" "$STAGE/bin/git-lfs"

cat > "$STAGE/activate.sh" <<'SH'
#!/usr/bin/env bash
_DEVKIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$_DEVKIT_DIR/rust-toolchain/bin:$_DEVKIT_DIR/bin:$PATH"
export RUSTC="$_DEVKIT_DIR/rust-toolchain/bin/rustc"
export CARGO="$_DEVKIT_DIR/rust-toolchain/bin/cargo"
export SSI_ALLOW_UNSANDBOXED_WORKER=1
cd "$_DEVKIT_DIR/repo"
unset _DEVKIT_DIR
SH
chmod +x "$STAGE/activate.sh" "$STAGE/bin/"*

cat > "$STAGE/README-DEVKIT.md" <<'MD'
# matrices.fast offline dev kit

```bash
source ./activate.sh
bash scripts/local-candidate-build.sh
cargo run --release --offline --locked -- --note "experiment"
```

The workspace is pinned to `f48a17f6b1757ca6d2ef399bf70aa3f286d44b27`, includes the materialized 300-matrix Git LFS corpus, generated manifests, vendored dependencies, release target cache, Rust stable toolchain, cargo-deny 0.20.2, and git-lfs. The activation script opts out of Bubblewrap only inside the disposable local research container; final validation remains sandboxed in GitHub Actions/Yukon.
MD

section "package artifact"
cd "$STAGE"
find . -type f -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256
{
  du -sh .
  du -sh repo repo/target repo/vendor repo/corpus rust-toolchain
  rust-toolchain/bin/rustc --version
  rust-toolchain/bin/cargo --version
  bin/cargo-deny --version
  bin/git-lfs version
} | tee "$OUT/devkit-info.txt"

tar --zstd -cf "$OUT/matrices-fast-devkit.tar.zst" .
sha256sum "$OUT/matrices-fast-devkit.tar.zst" | tee "$OUT/matrices-fast-devkit.tar.zst.sha256"
ls -lh "$OUT/matrices-fast-devkit.tar.zst"
