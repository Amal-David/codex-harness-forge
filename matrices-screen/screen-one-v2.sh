#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${GITHUB_WORKSPACE:?}"
BASE="$ROOT/matrices-screen/screen-one.sh"
PATCHED="$RUNNER_TEMP/screen-one-v2.sh"
sed 's/let local = 34 + (i % 13);/let local = 50 + (i % 13);/' "$BASE" > "$PATCHED"
chmod 700 "$PATCHED"
exec bash "$PATCHED"
