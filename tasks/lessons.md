# Lessons

- After a user correction, re-read the local project PRD and treat it as authoritative before using any sibling PRD or generated artifact. In this repo, `/Users/amal/listenowl/experiments/meta-harness/PRD.md` defines Codex Harness Forge; PocketDM files came from the wrong sibling PRD and must not guide implementation.
- Treat Workflows as the user-facing name for Harness Flow. Prefer `/workflows` as the Codex slash command and keep Harness Forge as the underlying compiler/runtime; do not add `/harness` as the primary command.
- Workflows should avoid static harness routing by making persistence, flow-runtime management, and the GStack/GBrain/verifier council review required compiler/runtime primitives rather than optional prompt advice.
- Capability-pack manifests are the migration path away from hard-coded harness routing; keep adding source/artifact/validator metadata there before adding new domain branches.
- Capability-pack manifests now own runtime, motion, and design-system DAG assembly; future domains should add manifest packs before adding TypeScript branches.
- Council review is not enough unless critics ask structured questions. Emit `CriticReview`/`CriticQuestion` artifacts, turn unresolved blockers into `partial` runs, and let app-PRD coverage come from either blocker questions or first-class app artifacts and validators.
- When the user asks to learn from an external harness framework and update the meta-harness, do not satisfy it with a single report or operational record. Derive architecture requirements, compare them to the compiler/runtime model, and implement first-class harness primitives where the system is out of alignment.
