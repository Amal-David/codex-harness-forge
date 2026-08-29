#!/usr/bin/env bash
set -Eeuo pipefail

# Keep the tested Wave-2 runner unchanged, but repair its one stale source matcher
# in a temporary copy.  The current promoted source mentions the production
# `order_with_relabel_cap(pattern, usize::MAX)` call once and repeats the same
# text in a comment, so matching that fragment alone is ambiguous.  Match the
# complete public order() function instead.

tmp="${RUNNER_TEMP:?}/run-wave2-lane-v2-${HYPOTHESIS_ID:?}.sh"
cp "${GITHUB_WORKSPACE:?}/matrices-frontier/run-wave2-lane.sh" "$tmp"
python3 - "$tmp" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
old = '''    exact("order_with_relabel_cap(pattern, usize::MAX)",
          f"order_with_relabel_cap(pattern, {cap})", "relabel-cap")'''
new = '''    exact("pub fn order(pattern: &Pattern) -> Vec<usize> {\\n    order_with_relabel_cap(pattern, usize::MAX)\\n}",
          f"pub fn order(pattern: &Pattern) -> Vec<usize> {{\\n    order_with_relabel_cap(pattern, {cap})\\n}}", "relabel-cap")'''
count = text.count(old)
if count != 1:
    raise SystemExit(f"expected one relabel matcher in runner, found {count}")
path.write_text(text.replace(old, new, 1))
PY
chmod 700 "$tmp"
exec bash "$tmp"
