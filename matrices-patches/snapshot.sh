#!/usr/bin/env bash
set -Eeuo pipefail
BASE=f48a17f6b1757ca6d2ef399bf70aa3f286d44b27
PRS=(315 318 326 327 328 329 330 331 332)
ROOT="${GITHUB_WORKSPACE:?}"
WORK="$RUNNER_TEMP/matrices-patches"
OUT="$ROOT/matrices-patches/artifacts"
rm -rf "$WORK" "$OUT"
mkdir -p "$WORK" "$OUT/patches" "$OUT/files"
cd "$WORK"
git clone --filter=blob:none --no-checkout https://github.com/Layr-Labs/ssi-ordering-challenge.git repo
cd repo
git fetch origin "$BASE"
printf 'base\t%s\n' "$(git rev-parse "$BASE")" > "$OUT/heads.tsv"
for pr in "${PRS[@]}"; do
  echo "===== PR $pr ====="
  git fetch origin "pull/$pr/head:refs/remotes/origin/pr/$pr"
  ref="refs/remotes/origin/pr/$pr"
  head="$(git rev-parse "$ref")"
  printf 'pr%s\t%s\n' "$pr" "$head" >> "$OUT/heads.tsv"
  git diff --binary "$BASE" "$ref" -- src/ordering > "$OUT/patches/pr${pr}-ordering.patch"
  git diff --stat "$BASE" "$ref" -- src/ordering > "$OUT/patches/pr${pr}-ordering.stat"
  git log -1 --date=iso-strict --pretty=fuller "$ref" > "$OUT/patches/pr${pr}-commit.txt"
  mkdir -p "$OUT/files/pr$pr"
  for file in src/ordering/mod.rs src/ordering/rgreedy.rs; do
    if git cat-file -e "$ref:$file" 2>/dev/null; then
      git show "$ref:$file" > "$OUT/files/pr$pr/$(basename "$file")"
    fi
  done
  git diff --check "$BASE" "$ref" -- src/ordering || true
done
sha256sum "$OUT"/patches/* "$OUT"/files/*/* > "$OUT/SHA256SUMS"
find "$OUT" -type f -printf '%P\t%s bytes\n' | sort
