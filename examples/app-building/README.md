# App-Building Workflow Usecases

These samples exercise the public Workflows surface with app-building flavored requests.

Run them with:

```bash
npm run eval:app-workflows
```

The evaluator writes:

- `output/app-workflow-evals/evaluation-results.json`
- `output/app-workflow-evals/evaluation-report.md`
- per-usecase workflow run artifacts under `output/app-workflow-evals/runs/`

The fourth usecase checks the `app-building-fullstack` pack. A full-stack app PRD should produce UI-flow, API-contract, persistence-plan, dependency-free `app-source/` files with a Node smoke test, test-plan, and acceptance artifacts rather than falling back to the generic report pack.
