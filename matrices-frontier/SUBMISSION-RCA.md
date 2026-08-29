# Submission `ce3465bf...` branch-update failure RCA

## What is proven

The local workflow completed a full 300-matrix run at `0.817133`, compiled the release candidate, passed the repository time-cap test, and invoked `yukon submit`. Yukon returned submission ID `ce3465bf-6b38-4aeb-b3e0-950f35cfcc39` with status `validating`.

The public Yukon UI later marked it `Failed` before a FLOPS score existed and reported:

```text
GitHub branch submissions/ce3465bf-6b38-4aeb-b3e0-950f35cfcc39 could not be updated:
```

There is no public validation PR for that ID and the corresponding Git branch no longer exists. Therefore the candidate never reached grader compilation or scoring. This was a submission-branch materialization failure, not an algorithmic rejection, purity failure, timeout, or bad permutation.

## Race in the old orchestration

The clone was pinned to `6a886223...`, then the workflow ran a long baseline, candidate benchmark, and test sequence. It checked `yukon submissions --all` immediately before submission, but it did not refetch and compare the GitHub `main` source ref after those long tests.

During the same run, the promoted frontier moved from `0.815285` to `0.813547`. The submit therefore attempted to create/update a unique submission branch from an older source lineage while the benchmark branch was being promoted repeatedly.

The backend suppressed the underlying GitHub error text after the colon, so the precise API response is unavailable. The strongest explanation is a stale-parent/non-fast-forward branch update race. A transient GitHub branch API failure is also possible. A signed-commit ruleset is less likely because neighboring Yukon-created validation branches and commits were successfully created with verified signatures.

## Required correction

1. Pin one upstream SHA for an experiment wave.
2. Run all expensive setup, benchmark, tests, and cap validation.
3. **After** those steps, fetch `refs/heads/main` again.
4. If it differs from the pinned source, do not submit. Reclone the new frontier and restack the proven editable-path patch.
5. Re-run the candidate on that exact source.
6. Seconds before `yukon submit`, compare both Git `main` and the benchmark sourceRef again.
7. Capture the submission ID and poll it. If the branch operation fails, first verify whether a branch, commit, PR, or terminal submission already exists; never blindly repeat an unknown mutation.
8. Keep one active submission per source lineage.

The Wave 1 research workflow implements step 1 for comparable experiments. The next finalist workflow will implement the full pre-submit transaction above.
