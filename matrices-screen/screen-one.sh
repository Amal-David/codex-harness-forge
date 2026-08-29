#!/usr/bin/env bash
set -Eeuo pipefail

BASE=f48a17f6b1757ca6d2ef399bf70aa3f286d44b27
PR_COMPOSE=328
ID="${HYPOTHESIS_ID:?}"
METRIC="${HYPOTHESIS_METRIC:?}"
ALPHA="${HYPOTHESIS_ALPHA:?}"
ROOT="${GITHUB_WORKSPACE:?}"
OUT="$ROOT/matrices-screen/artifacts/$ID"
WORK="$RUNNER_TEMP/matrices-screen-$ID"
mkdir -p "$OUT" "$WORK"
exec > >(tee "$OUT/run.log") 2>&1

sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  git git-lfs gcc g++ build-essential pkg-config libssl-dev >/dev/null
git lfs install

if ! command -v rustup >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
fi
export PATH="$HOME/.cargo/bin:$PATH"
rustup toolchain install stable --profile minimal >/dev/null
rustup default stable >/dev/null
if [[ "$(cargo deny --version 2>/dev/null || true)" != "cargo-deny 0.20.2" ]]; then
  cargo install cargo-deny --version 0.20.2 --locked --force >/dev/null
fi

cd "$WORK"
GIT_LFS_SKIP_SMUDGE=1 git clone -q https://github.com/Layr-Labs/ssi-ordering-challenge.git repo
cd repo
git checkout -q --detach "$BASE"
git fetch -q origin "pull/$PR_COMPOSE/head:refs/remotes/origin/pr/$PR_COMPOSE"
git checkout -q "refs/remotes/origin/pr/$PR_COMPOSE" -- src/ordering

python3 - "$METRIC" "$ALPHA" "$ID" <<'PY'
from pathlib import Path
import sys
metric, alpha, ident = sys.argv[1:]
p = Path('src/ordering/mod.rs')
s = p.read_text()
old = '''            let amd_opts_075 = feral_amd::AmdOptions {
                aggressive: true,
                dense_alpha: 0.75,
            };
            consider!(move || feral_amd::amd_order_opts(&core, &amd_opts_075).map(|(p, ..)| p));
'''
if old not in s:
    raise SystemExit('dense AMD control block not found exactly')
if metric != 'AMD075':
    new = f'''            if nnz >= D_WIDE_MAX_DENSITY * n {{
                consider!(move || custom_metrics::order_variant(
                    &core,
                    {alpha},
                    true,
                    custom_metrics::ScoreVariant::{metric},
                ));
            }} else {{
                let amd_opts_075 = feral_amd::AmdOptions {{
                    aggressive: true,
                    dense_alpha: 0.75,
                }};
                consider!(move || feral_amd::amd_order_opts(&core, &amd_opts_075).map(|(p, ..)| p));
            }}
'''
    s = s.replace(old, new, 1)
probe = r'''

#[cfg(test)]
mod dense_metric_hypothesis_probe {
    use super::*;
    use std::time::Instant;

    const HYPOTHESIS: &str = "__IDENT__";

    fn band_pattern(n: usize, width: usize) -> Pattern {
        let mut edges = Vec::with_capacity(n * width);
        for v in 0..n {
            for d in 1..=width {
                let w = (v + d) % n;
                if v < w { edges.push((v, w)); } else if w < v { edges.push((w, v)); }
            }
        }
        edges.sort_unstable();
        edges.dedup();
        Pattern::from_edges(n, &edges)
    }

    fn bipartite_kkt(n: usize, degree: usize) -> Pattern {
        let half = n / 2;
        let mut edges = Vec::with_capacity(half * degree);
        for i in 0..half {
            for k in 0..degree {
                let j = half + ((i * 17 + k * 83 + (i / 97) * 31) % half);
                edges.push((i, j));
            }
        }
        edges.sort_unstable();
        edges.dedup();
        Pattern::from_edges(n, &edges)
    }

    fn pooled_kkt(n: usize) -> Pattern {
        let half = n / 2;
        let mut edges = Vec::with_capacity(310_000);
        for i in 0..half {
            let local = 34 + (i % 13);
            for k in 0..local {
                let j = half + ((i * 29 + k * 71 + (i / 41) * 19) % half);
                edges.push((i, j));
            }
            for d in 1..=7 {
                let j = (i + d) % half;
                let (a, b) = if i < j { (i, j) } else { (j, i) };
                if a != b { edges.push((a, b)); }
            }
        }
        edges.sort_unstable();
        edges.dedup();
        Pattern::from_edges(n, &edges)
    }

    fn amd_and_ours(name: &str, pat: &Pattern) -> (f64, u128) {
        let col_ptr_i32: Vec<i32> = pat.col_ptr.iter().map(|&x| x as i32).collect();
        let row_idx_i32: Vec<i32> = pat.row_idx.iter().map(|&x| x as i32).collect();
        let core = feral_ordering_core::CscPattern::new(pat.n, &col_ptr_i32, &row_idx_i32).unwrap();
        let amd: Vec<usize> = feral_amd::amd_order(&core).unwrap().into_iter().map(|x| x as usize).collect();
        let scoring = ScoringPattern { n: pat.n, col_ptr: pat.col_ptr.clone(), row_idx: pat.row_idx.clone() };
        let amd_f = flops_of(&scoring, &amd);
        let start = Instant::now();
        let ours = order(pat);
        let elapsed = start.elapsed();
        assert!(is_bijection(&ours, pat.n));
        let ours_f = flops_of(&scoring, &ours);
        assert!(ours_f <= amd_f);
        let ratio = ours_f as f64 / amd_f as f64;
        println!("HYPOTHESIS_RESULT\t{}\t{}\t{}\t{}\t{}\t{:.12}\t{}", HYPOTHESIS, name, pat.n, pat.nnz(), ours_f, ratio, elapsed.as_micros());
        (ratio, elapsed.as_micros())
    }

    #[test]
    fn screen_dense_metric() {
        let patterns = [
            ("regular_band", band_pattern(10_000, 31)),
            ("bipartite_kkt", bipartite_kkt(10_000, 62)),
            ("pooled_kkt", pooled_kkt(10_000)),
        ];
        let mut log_sum = 0.0f64;
        let mut max_us = 0u128;
        for (name, pat) in &patterns {
            assert!(pat.nnz() >= 400_000, "{} did not enter dense gate: {}", name, pat.nnz());
            assert!(pat.nnz() >= 50 * pat.n, "{} did not enter high-density branch: {}", name, pat.nnz());
            let (ratio, us) = amd_and_ours(name, pat);
            log_sum += ratio.ln();
            max_us = max_us.max(us);
        }
        let geomean = (log_sum / patterns.len() as f64).exp();
        println!("HYPOTHESIS_SUMMARY\t{}\t{:.12}\t{}", HYPOTHESIS, geomean, max_us);
    }
}
'''.replace('__IDENT__', ident)
s += probe
p.write_text(s)
PY

git diff --check
if git status --porcelain | awk '{print $2}' | grep -v '^src/ordering/' | grep -q .; then
  echo "mutation escaped src/ordering" >&2
  exit 1
fi

bash scripts/prepare-build.sh >/dev/null
set +e
cargo test --release -p ssi-candidate-worker --offline --locked \
  dense_metric_hypothesis_probe::screen_dense_metric -- --nocapture --test-threads=1 \
  2>&1 | tee "$OUT/test.log"
status=${PIPESTATUS[0]}
set -e

grep '^HYPOTHESIS_RESULT\|^HYPOTHESIS_SUMMARY' "$OUT/test.log" > "$OUT/results.tsv" || true
printf '%s\t%s\t%s\t%s\n' "$ID" "$METRIC" "$ALPHA" "$status" > "$OUT/meta.tsv"
git diff -- src/ordering/mod.rs > "$OUT/source.patch"
exit "$status"
