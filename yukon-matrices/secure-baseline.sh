#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BENCHMARK_ID="f186a392-d655-481f-894f-b09c081dba85"
ROOT="${GITHUB_WORKSPACE:?GITHUB_WORKSPACE is required}"
OUT="$ROOT/yukon-matrices/artifacts/secure-baseline"
CLONE_ROOT="$RUNNER_TEMP/yukon-matrices-clone"
SECURE_DIR="$RUNNER_TEMP/yukon-secure-handoff"
mkdir -p "$OUT" "$CLONE_ROOT" "$SECURE_DIR"

# Sanitize any Yukon credential-shaped text before it reaches either Actions logs
# or uploaded artifacts. Sensitive command output is first captured in /tmp and
# only the sanitized copy is printed/persisted.
exec > >(sed -u -E 's/ykn_[A-Za-z0-9_-]+/[REDACTED]/g' | tee "$OUT/full-run.log") 2>&1

ISSUE_NUMBER=""
cleanup() {
  rm -f "$SECURE_DIR"/private.pem "$SECURE_DIR"/public.pem \
        "$SECURE_DIR"/cipher.bin "$SECURE_DIR"/token.txt \
        "$SECURE_DIR"/*.raw 2>/dev/null || true
  if [[ -n "${ISSUE_NUMBER:-}" ]]; then
    gh api --method PATCH "repos/$GITHUB_REPOSITORY/issues/$ISSUE_NUMBER" \
      -f state=closed >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

section() {
  printf '\n\n===== %s =====\n' "$*"
}

sanitize_file() {
  local source="$1"
  local destination="$2"
  sed -E 's/ykn_[A-Za-z0-9_-]+/[REDACTED]/g' "$source" > "$destination"
  rm -f "$source"
}

run_capture() {
  local name="$1"
  shift
  local raw="$SECURE_DIR/${name}.raw"
  local clean="$OUT/${name}.log"
  section "$name"
  set +e
  "$@" >"$raw" 2>&1
  local status=$?
  set -e
  sanitize_file "$raw" "$clean"
  cat "$clean"
  return "$status"
}

section "host"
uname -a
cat /etc/os-release
printf 'logical_cpus='; nproc
lscpu | sed -n '1,24p'
free -h
df -h "$ROOT"

section "install system prerequisites"
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  git git-lfs gcc g++ build-essential bubblewrap jq curl ca-certificates \
  pkg-config libssl-dev openssl

# The official benchmark workflow uses this on GitHub-hosted Ubuntu so bwrap can
# create its unprivileged user/network namespace. Keep the benchmark sandboxed.
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0

git lfs install
git --version
git lfs version
gcc --version | head -1

section "Rust and cargo-deny"
if ! command -v rustup >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
    sh -s -- -y --profile minimal
fi
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$HOME/.yukon/bin:$HOME/.bun/bin:$PATH"
rustup toolchain install stable --profile minimal
rustup default stable
cargo --version
rustc --version
if [[ "$(cargo deny --version 2>/dev/null || true)" != "cargo-deny 0.20.2" ]]; then
  cargo install cargo-deny --version 0.20.2 --locked --force
fi
test "$(cargo deny --version)" = "cargo-deny 0.20.2"
cargo deny --version

section "install Yukon CLI and agent skill"
curl -fsSL https://api.yukon.org/yukon/install.sh | sh
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$HOME/.yukon/bin:$HOME/.bun/bin:$PATH"
YUKON="$(command -v yukon)"
"$YUKON" version | tee "$OUT/yukon-version.txt"
"$YUKON" --help | tee "$OUT/yukon-help.txt"
"$YUKON" install-skill --target agents
"$YUKON" skill | tee "$OUT/yukon-cli-skill.md"
find "$HOME" -maxdepth 10 -type f \
  \( -iname 'SKILL.md' -o -iname '*yukon*.md' \) -print | sort \
  | tee "$OUT/installed-skill-files.txt"
while IFS= read -r skill; do
  [[ -f "$skill" ]] || continue
  case "$skill" in
    *yukon*|*/skills/*/SKILL.md)
      printf '\n--- %s ---\n' "$skill" >> "$OUT/installed-skill-content.md"
      cat "$skill" >> "$OUT/installed-skill-content.md"
      ;;
  esac
done < "$OUT/installed-skill-files.txt"

section "ephemeral encrypted Yukon credential handoff"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 \
  -out "$SECURE_DIR/private.pem" 2>/dev/null
openssl pkey -in "$SECURE_DIR/private.pem" -pubout \
  -out "$SECURE_DIR/public.pem"
PUBLIC_KEY="$(cat "$SECURE_DIR/public.pem")"
FINGERPRINT="$(openssl pkey -pubin -in "$SECURE_DIR/public.pem" -outform DER 2>/dev/null | sha256sum | awk '{print $1}')"
ISSUE_BODY=$(cat <<EOF
This issue is an ephemeral, one-run credential handoff for the matrices.fast benchmark.

- Workflow run: \`$GITHUB_RUN_ID\`
- Branch: \`$GITHUB_REF_NAME\`
- Public-key SHA-256: \`$FINGERPRINT\`

Only the RSA **public** key is published. The private key exists only in this disposable runner and is deleted after use.

\`\`\`pem
$PUBLIC_KEY
\`\`\`

The runner accepts one comment authored by **Amal-David** beginning with \`YUKON_CIPHERTEXT_V1:\`. The ciphertext must use RSA-OAEP with SHA-256 for both OAEP and MGF1, then be base64 encoded on one line.
EOF
)
ISSUE_JSON="$(gh api --method POST "repos/$GITHUB_REPOSITORY/issues" \
  -f title="[ephemeral] Yukon matrices handoff run $GITHUB_RUN_ID" \
  -f body="$ISSUE_BODY")"
ISSUE_NUMBER="$(jq -r '.number' <<<"$ISSUE_JSON")"
echo "SECURE_HANDOFF_ISSUE_NUMBER=$ISSUE_NUMBER"
echo "SECURE_HANDOFF_PUBLIC_KEY_SHA256=$FINGERPRINT"

COMMENT_ID=""
CIPHERTEXT_B64=""
for _ in $(seq 1 900); do
  COMMENT_ROW="$(gh api --paginate \
    "repos/$GITHUB_REPOSITORY/issues/$ISSUE_NUMBER/comments?per_page=100" \
    --jq '.[] | select(.user.login == "Amal-David") | select(.body | startswith("YUKON_CIPHERTEXT_V1:")) | [.id, .body] | @tsv' \
    2>/dev/null | tail -n 1 || true)"
  if [[ -n "$COMMENT_ROW" ]]; then
    COMMENT_ID="${COMMENT_ROW%%$'\t'*}"
    COMMENT_BODY="${COMMENT_ROW#*$'\t'}"
    CIPHERTEXT_B64="${COMMENT_BODY#YUKON_CIPHERTEXT_V1:}"
    CIPHERTEXT_B64="$(tr -d '[:space:]' <<<"$CIPHERTEXT_B64")"
    break
  fi
  sleep 2
done
if [[ -z "$COMMENT_ID" || -z "$CIPHERTEXT_B64" ]]; then
  echo "ERROR: encrypted credential handoff was not received" >&2
  exit 1
fi

printf '%s' "$CIPHERTEXT_B64" | base64 -d > "$SECURE_DIR/cipher.bin"
openssl pkeyutl -decrypt \
  -inkey "$SECURE_DIR/private.pem" \
  -in "$SECURE_DIR/cipher.bin" \
  -pkeyopt rsa_padding_mode:oaep \
  -pkeyopt rsa_oaep_md:sha256 \
  -pkeyopt rsa_mgf1_md:sha256 \
  -out "$SECURE_DIR/token.txt"
TOKEN="$(cat "$SECURE_DIR/token.txt")"
if [[ ! "$TOKEN" =~ ^ykn_[A-Za-z0-9_-]{32,}$ ]]; then
  echo "ERROR: decrypted credential has an invalid format" >&2
  exit 1
fi
printf '::add-mask::%s\n' "$TOKEN"

# Remove the public ciphertext immediately after successful decryption. The
# private key and token are also deleted as soon as login completes.
gh api --method PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$COMMENT_ID" \
  -f body='YUKON_CIPHERTEXT_V1: [consumed and redacted]' >/dev/null

gh api --method PATCH "repos/$GITHUB_REPOSITORY/issues/$ISSUE_NUMBER" \
  -f state=closed >/dev/null

section "Yukon login"
set +e
"$YUKON" login "$TOKEN" >"$SECURE_DIR/login.raw" 2>&1
LOGIN_STATUS=$?
set -e
sanitize_file "$SECURE_DIR/login.raw" "$OUT/yukon-login.log"
unset TOKEN
rm -f "$SECURE_DIR/private.pem" "$SECURE_DIR/cipher.bin" "$SECURE_DIR/token.txt"
if (( LOGIN_STATUS != 0 )); then
  cat "$OUT/yukon-login.log"
  exit "$LOGIN_STATUS"
fi
echo "Yukon login succeeded; credential material has been deleted."

section "clone challenge through Yukon"
cd "$CLONE_ROOT"
run_capture "yukon-clone" "$YUKON" clone "$BENCHMARK_ID"

# Follow the clone command's printed `cd` instruction. Fall back to locating the
# linked benchmark only if the human-facing output format changes.
CD_TARGET="$(python3 - "$OUT/yukon-clone.log" <<'PY'
import re, shlex, sys
text = open(sys.argv[1], encoding='utf-8', errors='replace').read().splitlines()
for line in reversed(text):
    clean = line.replace('`', '').strip()
    m = re.search(r'(?:^|\s)cd\s+(.+?)\s*$', clean)
    if not m:
        continue
    try:
        parts = shlex.split('cd ' + m.group(1))
    except ValueError:
        continue
    if len(parts) >= 2:
        print(parts[1])
        break
PY
)"
if [[ -n "$CD_TARGET" ]]; then
  if [[ "$CD_TARGET" = /* ]]; then
    WORKDIR="$CD_TARGET"
  else
    WORKDIR="$CLONE_ROOT/$CD_TARGET"
  fi
else
  WORKDIR="$(find "$CLONE_ROOT" -mindepth 1 -maxdepth 4 -type f -name benchmark.json -printf '%h\n' | head -1)"
fi
if [[ -z "$WORKDIR" || ! -d "$WORKDIR/.git" || ! -f "$WORKDIR/benchmark.json" ]]; then
  echo "ERROR: could not resolve the benchmark work directory" >&2
  find "$CLONE_ROOT" -maxdepth 4 -print
  exit 1
fi
cd "$WORKDIR"
echo "FOLLOWED_CLONE_CD=$WORKDIR"
printf '%s\n' "$WORKDIR" > "$OUT/workdir.txt"

section "verify Git LFS corpus and linked checkout"
git lfs pull
git lfs ls-files | tee "$OUT/git-lfs-files.txt"
CORPUS="corpus/dev/patterns.jsonl"
test -f "$CORPUS"
CORPUS_BYTES="$(wc -c < "$CORPUS")"
CORPUS_LINES="$(wc -l < "$CORPUS")"
echo "corpus_bytes=$CORPUS_BYTES corpus_lines=$CORPUS_LINES"
if (( CORPUS_BYTES < 10000000 )); then
  echo "ERROR: corpus is an unresolved Git LFS pointer" >&2
  exit 1
fi

git remote -v | tee "$OUT/git-remotes.txt"
git branch --show-current | tee "$OUT/git-branch.txt"
git rev-parse HEAD | tee "$OUT/challenge-head.txt"
git log -40 --date=iso-strict --pretty=format:'%H%x09%ad%x09%an%x09%s' \
  | tee "$OUT/recent-commits.tsv"
printf '\n'
git status --short | tee "$OUT/status-before-setup.txt"

section "read problem and rules before changes"
cat README.md | tee "$OUT/README.md"
cat RULES.md | tee "$OUT/RULES.md"
cat benchmark.json | tee "$OUT/benchmark.json"
cp -a src/ordering "$OUT/ordering-untouched"

section "inspect recent submissions before optimization"
run_capture "yukon-submissions-all" "$YUKON" submissions --all

section "Yukon setup"
run_capture "yukon-setup" "$YUKON" setup
git status --short | tee "$OUT/status-after-setup.txt"

section "untouched Yukon baseline"
# No source file has been edited. This is the required score checkpoint.
run_capture "yukon-run-baseline" "$YUKON" run

section "baseline evidence"
for file in score.json results.tsv; do
  if [[ -f "$file" ]]; then
    cp "$file" "$OUT/$file"
    cat "$file"
  fi
done
git status --short | tee "$OUT/status-after-baseline.txt"
find . -maxdepth 2 -type f \( -name '*.json' -o -name '*.tsv' -o -name '*.log' \) \
  -print | sort | tee "$OUT/benchmark-output-files.txt"

section "secure exact Yukon baseline complete"
