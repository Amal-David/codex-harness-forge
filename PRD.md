PRD: Codex Harness Forge

1. Product Summary

Codex Harness Forge is a Codex plugin/skill/runtime layer that turns a vague user request plus durable source-of-truth assets into an executable, multi-agent, eval-gated workflow.

Instead of treating Codex skills as static prompt packs, Harness Forge treats every skill, design system, codebase, Storybook, Figma file, API spec, test suite, brand guide, PRD, and motion prompt guide as a system of record that can be compiled into a task-specific custom agent harness.

The product enables Codex to:

1. Understand the domain-specific language of a task.
2. Read and profile the relevant source of truth.
3. Generate a custom workflow/harness for the task.
4. Spawn specialist subagents with isolated responsibilities.
5. Produce artifacts using the correct domain vocabulary and constraints.
6. Validate outputs with tests, previews, lint rules, visual checks, schema checks, or human checkpoints.
7. Capture learnings back into skills, AGENTS.md, harness templates, and source-sync suggestions.

The initial wedge is a Motion/Lottie Harness using diffusionstudio/lottie, then expansion into Design System Harnesses, Frontend UI Harnesses, PR Review Harnesses, Migration Harnesses, Release Harnesses, and Ops/Data/Docs Harnesses.

⸻

2. Product Thesis

Current coding agents are mostly prompt-driven. They can use skills, plans, repo instructions, and subagents, but they do not reliably transform a domain’s source of truth into a specialized execution system.

The next generation of agents will not be “better chat.” They will be custom task harnesses.

A custom harness is the layer around the model that defines:

* what context to load;
* what source is authoritative;
* what language/domain vocabulary to use;
* what agents to spawn;
* what artifact to produce;
* how to verify correctness;
* when to ask for human approval;
* how to learn from the run.

Harness Forge should make Codex behave less like a single assistant and more like a compiler for task-specific agent systems.

⸻

3. Product Vision

Harness Forge turns systems of record into systems of execution.

Examples:

Source of Truth	Generated Harness
Lottie prompt guide + SVG assets	Motion design and Lottie generation harness
Design system repo + Storybook + Figma	Production UI generation harness
API docs + OpenAPI spec	Integration implementation harness
Test suite + bug report	Repro-patch-verify harness
PR diff + repo rules	Multi-agent review harness
Release checklist + CI/CD	Release readiness harness
Brand guide + screenshots	Brand-conformant landing page harness
Data schemas + notebook	Data report harness
Security policy + auth flow	Security review harness

The long-term product becomes a System Agent Compiler for Codex.

⸻

4. Core Concept

4.1 What is a Harness?

A harness is a structured, executable workflow around Codex.

It includes:

* task classification;
* source-of-truth ingestion;
* context prioritization;
* domain vocabulary extraction;
* agent role assignment;
* prompt generation;
* artifact contracts;
* validation steps;
* retry loops;
* human checkpoints;
* learning capture.

4.2 What is Different from a Plan?

A plan is usually linear and conversational.

A harness is executable, stateful, multi-agent, and verifiable.

Plan	Harness
“Do step 1, then step 2”	Runtime workflow with branching, retries, validators, and agents
Lives in chat context	Lives as a durable spec
Easy to drift	Enforced by source-of-truth profiles
Usually one agent	Multiple specialist agents
Often subjective	Artifact-specific validation
Ends with output	Ends with trace, evaluation, and learning patch

4.3 What is Different from a Skill?

A skill is reusable knowledge.

A harness uses skills, but also orchestrates:

* subagents;
* tools;
* validators;
* artifacts;
* runtime state;
* source sync;
* evals;
* worktrees;
* automation triggers.

A skill teaches Codex how to think about a domain.

A harness makes Codex operate inside that domain reliably.

⸻

5. Initial Product Name

Codex Harness Forge

Alternative names:

* System Agent Forge
* Agent Harness Compiler
* Codex Workflow Forge
* Skill-to-Harness Compiler
* Source-of-Truth Agent Runtime

Preferred name: Codex Harness Forge

Reason: “Forge” implies creation, compilation, and repeated strengthening of task-specific harnesses.

⸻

6. Target Users

6.1 Primary User: Advanced AI-Native Builder

A founder, CTO, engineer, designer-engineer, or research builder who uses Codex heavily and wants higher-order outcomes from agentic workflows.

Needs:

* better outputs than one-shot prompting;
* repeatable workflows;
* task-specific language;
* parallel agents;
* high-quality artifacts;
* eval-gated execution;
* source-of-truth grounding;
* reduced manual prompting.

6.2 Secondary User: Product Engineering Team

Teams that already have:

* design systems;
* Storybook;
* Figma;
* component libraries;
* CI/CD;
* test suites;
* repo instructions;
* release checklists;
* PR review standards.

Needs:

* Codex to respect internal standards;
* fewer hallucinated components;
* better frontend generation;
* safer refactors;
* faster PR review;
* reusable team workflows.

6.3 Tertiary User: Agent Platform Builder

Teams building their own agent systems using Codex, MCP, or Agents SDK.

Needs:

* declarative harness specs;
* traceable workflows;
* reusable agent roles;
* validators;
* evals;
* integrations with repo, design, test, and release tooling.

⸻

7. Problem Statement

Codex can solve many coding tasks, but high-quality results still depend on the user manually prompting it with:

* the right domain vocabulary;
* the right constraints;
* the right examples;
* the right assets;
* the right validation criteria;
* the right decomposition strategy;
* the right agent roles;
* the right definition of done.

This creates several failures:

1. Domain language gap
    Codex may not know how to prompt a motion system, design system, UI library, animation engine, testing framework, or internal API in the correct language.
2. Source-of-truth drift
    Codex may invent components, colors, file structures, APIs, or patterns that do not exist in the real project.
3. Weak orchestration
    Plans are too shallow for complex tasks. They do not automatically spawn critics, validators, researchers, and repair agents.
4. Poor verification
    Generated artifacts are often judged by vibes instead of schema validation, visual previews, tests, accessibility checks, or runtime execution.
5. Low reuse
    Good prompts and workflows disappear into chat history instead of becoming durable skills or harnesses.
6. Context pollution
    Long multi-agent workflows can overwhelm the main chat context instead of using isolated agents and structured intermediate state.
7. No improvement loop
    Failures are not automatically converted into better instructions, validators, examples, or source updates.

⸻

8. Product Goals

8.1 User Goals

Users should be able to say:

Use the Lottie harness and make this logo animation production-ready.

or:

Use our design system harness and build this onboarding flow from the Figma frame.

or:

Use a repair harness for this bug. Reproduce, patch, verify, and add regression tests.

Harness Forge should then:

1. detect the task type;
2. load the right system profile;
3. compile a harness;
4. spawn specialist agents;
5. validate artifacts;
6. return final output plus trace;
7. propose updates to skills or repo instructions.

8.2 Business Goals

* Make Codex materially better for complex real-world build tasks.
* Create a durable workflow layer on top of Codex.
* Turn skills into executable systems.
* Make design systems, motion systems, and codebases directly usable by agents.
* Enable future marketplace of domain harness packs.

8.3 Product Quality Goals

Harness Forge should improve:

Metric	Goal
First-pass artifact quality	2x improvement over one-shot Codex prompt
Rework reduction	50% fewer manual correction turns
Source conformance	>90% adherence to design/code/system constraints
Validation coverage	Every artifact has at least one objective validator
Reusability	Successful workflows can become reusable harness templates
Traceability	Every run produces a structured trace
Human trust	Users can inspect source assumptions, agent outputs, and validation results

⸻

9. Non-Goals

Harness Forge should not initially:

* replace Codex;
* build a full standalone IDE;
* become a general no-code builder;
* silently modify source-of-truth systems;
* auto-deploy production changes without approval;
* optimize for casual one-shot tasks;
* depend on a single domain like Lottie or UI generation;
* require every task to use heavy multi-agent orchestration.

⸻

10. Core Product Principles

10.1 Source of Truth Over Prompt

The harness should trust durable sources more than vague user instructions.

Priority order:

1. explicit user instruction;
2. repo code;
3. package/component source;
4. tests;
5. AGENTS.md;
6. skill instructions;
7. Storybook/examples;
8. Figma/design files;
9. API/docs;
10. screenshots;
11. previous traces;
12. generic model knowledge.

10.2 Compile, Don’t Merely Prompt

The product should compile a task into:

* a SystemProfile;
* a HarnessSpec;
* agent roles;
* validators;
* artifact contracts;
* execution graph.

10.3 Multi-Agent Only When Useful

Not every task needs subagents. The router should choose:

Mode	Use Case
Quick	Simple direct task
Standard	Normal task with validation
Deep	Complex task with multiple specialists
Tournament	Creative/visual/high-stakes candidate generation
Automation	Recurring background routine

10.4 Validation Is the Spine

Every harness must define what “done” means.

Examples:

* valid Lottie JSON;
* render preview generated;
* TypeScript passes;
* tests pass;
* no raw design tokens;
* no deprecated components;
* visual snapshot passes;
* accessibility checks pass;
* API schema matches;
* regression test added;
* human approval captured.

10.5 Learn From Every Run

Each successful or failed run should produce a learning artifact:

* proposed skill update;
* proposed AGENTS.md update;
* missing validator;
* anti-pattern;
* better example;
* source conflict report;
* future automation suggestion.

⸻

11. Core User Stories

11.1 Lottie / Motion User Story

As a builder, I want to use a Lottie skill that understands motion design language, so that Codex can produce high-quality animations from SVGs, screenshots, and prompt guides.

Example:

$harness-forge motion-lottie deep
Use this logo.svg.
Create a premium product reveal animation.
Duration: 4 seconds.
FPS: 30.
Expose controls for background color, speed, accent color, and camera intensity.

Expected behavior:

* read SVG geometry;
* inspect Lottie skill docs;
* extract motion terminology;
* spawn motion director, prompt specialist, Lottie engineer, and QA critic;
* generate candidates;
* render preview;
* validate JSON;
* check FPS/duration;
* expose requested controls;
* return best artifact and trace.

11.2 Design System User Story

As a frontend engineer, I want Codex to build UI using only our actual design system, so that it does not invent components or styles.

Example:

$harness-forge design-system-ui deep
Sources:
- ./packages/ui
- ./apps/storybook
- Figma selection
- brand-guidelines.pdf
Task:
Build a production-ready onboarding flow.
Use only approved components and tokens.
Create Storybook examples and tests.

Expected behavior:

* profile component library;
* extract tokens, props, import paths, examples;
* detect deprecated components;
* inspect Figma layout;
* generate UI;
* run TypeScript/build/tests;
* run design-system conformance checks;
* produce implementation plus report.

11.3 Bug Repair User Story

As an engineer, I want Codex to reproduce, fix, and verify a bug instead of directly guessing a patch.

Example:

$harness-forge repair standard
Bug:
Users get logged out after refreshing the dashboard.

Expected behavior:

* reproduce the bug;
* isolate root cause;
* patch;
* add regression test;
* run test suite;
* summarize root cause and fix.

11.4 PR Review User Story

As a team lead, I want Codex to review a PR using multiple specialist reviewers.

Example:

$harness-forge review deep
Review this branch against main.
Use security, correctness, performance, API compatibility, and test coverage reviewers.

Expected behavior:

* diff against main;
* spawn isolated reviewers;
* consolidate findings;
* rank severity;
* propose fixes;
* avoid noisy comments.

11.5 Migration User Story

As an engineering team, I want Codex to migrate a codebase safely with phased validation.

Example:

$harness-forge migration deep
Migrate this package from JavaScript to TypeScript.
Do it in safe phases.
Use worktrees if needed.

Expected behavior:

* inventory files;
* identify risky areas;
* propose phases;
* modify in chunks;
* run checks after each phase;
* generate rollback notes.

11.6 Automation User Story

As a CTO, I want proven harnesses to become recurring routines.

Example:

Every morning:
- scan failing CI
- identify likely owner
- propose fix branch
- summarize risk

Expected behavior:

* only automate after manual harness reliability is proven;
* run read-only by default;
* require approval before pushing changes.

⸻

12. Harness Archetypes

Harness Forge should support 9 core archetypes.

Archetype	Primary Use
Explore Harness	Understand repo, architecture, flows, dependencies
Repair Harness	Reproduce, patch, verify bugs
Test Harness	Generate and improve tests
Feature Harness	Build new functionality
Migration Harness	Refactor, upgrade, migrate safely
Visual Harness	UI, design, motion, screenshots, Figma, Lottie
System Harness	Design systems, APIs, brands, release systems
Review Harness	PR review, security review, release review
Ops/Data/Docs Harness	CI, deployment, reports, docs, notebooks

The router should map user requests into one or more archetypes.

⸻

13. Top Usage Pattern Coverage

Harness Forge should be designed around the following 100 high-value Codex usage patterns.

Codebase Understanding

1. Explain repo architecture
2. Trace request flow
3. Explain data model
4. Map service boundaries
5. Summarize module responsibilities
6. Find entrypoints
7. Identify dangerous files
8. Explain auth/session flow
9. Explain state management
10. Build change-safety checklist

Bug Investigation and Repair

11. Reproduce bug
12. Trace stack error
13. Fix UI behavior
14. Fix backend 500
15. Fix async/concurrency issue
16. Fix memory leak
17. Fix flaky behavior
18. Fix integration failure
19. Fix auth/permission bug
20. Add regression test

Testing and Quality

21. Write unit tests
22. Write integration tests
23. Write E2E tests
24. Improve flaky tests
25. Increase coverage
26. Generate test fixtures
27. Mock external APIs
28. Add snapshot tests
29. Add visual regression checks
30. Add property/fuzz tests

Feature Implementation

31. Build endpoint
32. Add UI page
33. Add form validation
34. Add auth-gated feature
35. Add dashboard
36. Add notifications
37. Add import/export flow
38. Add billing/payment flow
39. Add admin panel
40. Add background job

Refactoring and Migration

41. Split large module
42. Remove circular imports
43. Migrate framework version
44. Convert JS to TS
45. Convert REST to GraphQL/client SDK
46. Replace deprecated APIs
47. Upgrade packages
48. Migrate state library
49. Extract shared package
50. Normalize folder structure

UI and Frontend Generation

51. Build UI from screenshot
52. Build UI from Figma
53. Build landing page
54. Build settings page
55. Build dashboard
56. Build onboarding flow
57. Improve responsive layout
58. Improve empty/error states
59. Iterate visual polish
60. Convert prototype to production component

Design System and Brand Workflows

61. Import component library
62. Generate component inventory
63. Enforce token usage
64. Replace raw CSS with tokens
65. Detect deprecated components
66. Build using approved components only
67. Update app to latest design-system version
68. Generate Storybook examples
69. Create design-system docs
70. Validate accessibility rules

PR, Review, and Release

71. Review local diff
72. Review GitHub PR
73. Generate PR summary
74. Find security issues
75. Find breaking API changes
76. Review migration safety
77. Address reviewer comments
78. Generate changelog
79. Prepare release notes
80. Run release checklist

DevOps and Operations

81. Fix CI failure
82. Diagnose deployment failure
83. Improve Dockerfile
84. Update GitHub Actions
85. Add environment config
86. Add observability/logging
87. Add health checks
88. Debug production logs
89. Optimize build time
90. Harden permissions/secrets

Data, ML, Docs, and Research

91. Analyze dataset
92. Clean notebook
93. Generate report
94. Build charts
95. Package spreadsheet output
96. Summarize research
97. Compare libraries/models
98. Update docs
99. Create reusable skill
100. Create automation/routine

⸻

14. Core Objects

14.1 SystemProfile

A normalized representation of a source-of-truth system.

type SystemProfile = {
  id: string;
  name: string;
  type:
    | "motion-system"
    | "design-system"
    | "codebase"
    | "api-system"
    | "brand-system"
    | "release-system"
    | "security-system"
    | "data-system"
    | "docs-system"
    | "custom-skill";
  sources: SourceRef[];
  trustRank: SourceTrustRank[];
  version?: string;
  freshness: FreshnessMetadata;
  vocabulary: string[];
  rules: Rule[];
  examples: Example[];
  antiPatterns: AntiPattern[];
  artifactContracts: ArtifactContract[];
  validators: ValidatorSpec[];
  humanReviewPoints: ReviewPoint[];
};

14.2 SourceRef

type SourceRef = {
  id: string;
  type:
    | "repo"
    | "file"
    | "directory"
    | "skill"
    | "agents-md"
    | "storybook"
    | "figma"
    | "npm-package"
    | "openapi"
    | "pdf"
    | "screenshot"
    | "url"
    | "test-suite"
    | "ci-config"
    | "previous-trace";
  location: string;
  trust: "highest" | "high" | "medium" | "low";
  lastSyncedAt?: string;
};

14.3 HarnessSpec

A compiled execution spec.

type HarnessSpec = {
  id: string;
  name: string;
  archetype: HarnessArchetype;
  mode: "quick" | "standard" | "deep" | "tournament" | "automation";
  userIntent: string;
  systemProfiles: SystemProfileRef[];
  sources: SourceRef[];
  agents: AgentSpec[];
  graph: WorkflowNode[];
  validators: ValidatorSpec[];
  artifactContracts: ArtifactContract[];
  permissions: PermissionSpec;
  checkpoints: CheckpointSpec[];
  learning: LearningSpec;
};

14.4 AgentSpec

type AgentSpec = {
  id: string;
  name: string;
  role: string;
  goal: string;
  writeAccess: boolean;
  tools: string[];
  allowedSources: string[];
  outputSchema: object;
  stopConditions: string[];
};

14.5 ArtifactContract

type ArtifactContract = {
  id: string;
  type:
    | "lottie-json"
    | "react-component"
    | "storybook-story"
    | "test-file"
    | "markdown-doc"
    | "api-client"
    | "migration-patch"
    | "release-report"
    | "data-report";
  requiredFiles?: string[];
  schema?: object;
  validators: string[];
  humanReviewRequired?: boolean;
};

14.6 Trace

type HarnessTrace = {
  runId: string;
  harnessSpecId: string;
  startedAt: string;
  completedAt?: string;
  userIntent: string;
  selectedArchetype: string;
  selectedMode: string;
  sourcesLoaded: SourceRef[];
  sourceConflicts: SourceConflict[];
  agentsSpawned: AgentRun[];
  validations: ValidationResult[];
  artifacts: ArtifactRef[];
  finalStatus: "success" | "partial" | "failed" | "needs-human-review";
  learningSuggestions: LearningSuggestion[];
};

⸻

15. Product Architecture

User Request
  ↓
Pattern Router
  ↓
Source-of-Truth Profiler
  ↓
SystemProfile Builder
  ↓
Domain Prompt Compiler
  ↓
HarnessSpec Compiler
  ↓
Agent Runtime
  ↓
Artifact Generator
  ↓
Validator Layer
  ↓
Human Checkpoint Layer
  ↓
Learning Loop
  ↓
Skill / AGENTS.md / Source Sync Proposals

⸻

16. Main Components

16.1 Pattern Router

Classifies the request into:

* archetype;
* mode;
* required sources;
* required validators;
* agent roles.

Example classification:

{
  "intent": "create lottie animation from svg",
  "archetype": "visual-harness",
  "mode": "deep",
  "systemProfiles": ["motion-system"],
  "requiredAgents": [
    "asset-analyst",
    "motion-director",
    "prompt-specialist",
    "lottie-engineer",
    "render-qa",
    "motion-critic"
  ]
}

16.2 Source-of-Truth Profiler

Reads relevant sources and ranks authority.

For Lottie:

* skill instructions;
* prompt guide;
* SVGs;
* sample animations;
* package docs;
* validation scripts.

For design systems:

* component source;
* tokens;
* Storybook;
* npm package;
* Figma;
* docs;
* screenshots;
* examples.

For bug repair:

* repo;
* failing test;
* logs;
* issue text;
* previous similar bugs;
* CI config.

16.3 SystemProfile Builder

Converts raw sources into structured profiles.

For MotionSystemProfile:

{
  "type": "motion-system",
  "vocabulary": [
    "ease-in",
    "ease-out",
    "ease-in-out",
    "camera push",
    "pan",
    "zoom",
    "rig-like motion",
    "anticipation",
    "overshoot",
    "stagger",
    "parallax"
  ],
  "rules": [
    "ground animation in SVG geometry",
    "specify FPS and duration",
    "expose requested controls",
    "validate Lottie JSON",
    "render preview before final"
  ]
}

For DesignSystemProfile:

{
  "type": "design-system",
  "components": [
    {
      "name": "Button",
      "importPath": "@company/ui/button",
      "props": ["variant", "size", "disabled"]
    }
  ],
  "tokens": {
    "color": [],
    "spacing": [],
    "typography": []
  },
  "rules": [
    "do not use raw hex colors",
    "do not invent components",
    "use approved tokens",
    "preserve import conventions"
  ]
}

16.4 Domain Prompt Compiler

Transforms user intent into expert task language.

Example input:

Make this logo animation look premium.

Compiled motion prompt:

Create a 4-second 30 FPS premium logo reveal using SVG-grounded geometry.
Use an ease-in-out camera push, subtle parallax between grouped paths,
staggered opacity and scale reveal, slight overshoot on the final lockup,
and a soft accent sweep. Expose controls for background color, accent color,
animation speed, and camera intensity. Validate final output as Lottie JSON.

16.5 HarnessSpec Compiler

Builds the actual execution graph.

Example:

1. Asset analyst reads SVG and extracts animatable groups.
2. Motion director creates 3 possible motion directions.
3. Prompt specialist rewrites directions in Lottie/motion vocabulary.
4. Lottie engineer generates candidate animations.
5. Renderer previews candidates.
6. Motion critic scores them.
7. Repair agent fixes schema/render issues.
8. Finalizer packages best artifact.

16.6 Agent Runtime

Runs specialist agents.

Agent types:

* researcher;
* source auditor;
* prompt specialist;
* implementation agent;
* critic;
* validator;
* repair agent;
* finalizer.

16.7 Validator Layer

Runs artifact-specific checks.

Examples:

For Lottie:

* valid JSON;
* valid Lottie schema;
* duration matches requested seconds;
* FPS matches requested FPS;
* render preview generated;
* no missing assets;
* controls exposed.

For UI:

* TypeScript passes;
* build passes;
* approved components only;
* tokens only;
* no raw hex colors;
* accessibility check;
* responsive check;
* visual snapshot.

For PR review:

* diff parsed;
* severity ranking present;
* false-positive filter applied;
* tests considered;
* security reviewer completed.

16.8 Human Checkpoint Layer

Used when:

* output is taste-sensitive;
* multiple candidates exist;
* write operations are destructive;
* source-of-truth conflict exists;
* production/release step is requested;
* automation wants to open a PR or deploy.

16.9 Learning Loop

Each run can propose:

* skill update;
* new anti-pattern;
* new validator;
* new example;
* AGENTS.md patch;
* design-system sync note;
* missing documentation;
* automation candidate.

⸻

17. Lottie / Motion Harness MVP

17.1 Goal

Create the first domain-specific harness for high-quality Lottie animation generation using diffusionstudio/lottie and related assets.

17.2 Inputs

The harness should accept:

* SVG files;
* screenshots;
* existing Lottie JSON;
* brand colors;
* motion reference notes;
* desired duration;
* FPS;
* output dimensions;
* required controls;
* prompt guide;
* examples.

17.3 Motion Prompt Guide Rules

The harness should internalize these principles:

1. Ground the model with concrete assets.
2. Use motion design terminology.
3. Think like a camera operator.
4. Request explicit controls.
5. Specify FPS and duration.
6. Use animation curves intentionally.
7. Prefer staged, readable movement over random motion.
8. Validate with preview.
9. Repair schema errors.
10. Package reusable controls.

17.4 Required Agents

Agent	Responsibility
Asset Analyst	Inspect SVG, groups, layers, colors, dimensions
Motion Director	Define animation concept and movement language
Prompt Specialist	Rewrite task in domain-specific motion terms
Lottie Engineer	Generate animation artifact
Render QA	Preview/render and catch technical issues
Motion Critic	Judge taste, pacing, clarity, premium feel
Repair Agent	Fix validation/render issues
Finalizer	Package final artifact and controls

17.5 Candidate Modes

Mode	Behavior
Quick	One animation, basic validation
Standard	Two directions, one final
Deep	Three directions, critic, repair loop
Tournament	Multiple competing motion concepts, ranked
Automation	Batch-generate animations from asset folder

17.6 Output

output/
  animation.json
  preview.mp4
  preview.gif
  controls.json
  motion-rationale.md
  validation-report.md
  harness-trace.json
  skill-update-suggestions.md

17.7 Validators

* JSON parse pass;
* Lottie schema pass;
* render pass;
* duration match;
* FPS match;
* dimensions match;
* controls exist;
* no missing image references;
* no unsupported feature usage;
* preview generated.

⸻

18. Design System Harness

18.1 Goal

Enable Codex to build production UI using real design-system components, tokens, and conventions.

18.2 Inputs

* local component repo;
* npm package;
* Storybook;
* Figma selection;
* screenshots;
* brand guide;
* docs;
* existing pages;
* design tokens;
* accessibility rules.

18.3 Required Agents

Agent	Responsibility
Source Auditor	Identify source conflicts, stale docs, missing context
Component Inventory Agent	Extract approved components, props, imports
Token Agent	Extract colors, spacing, typography, radius, shadows
UX Flow Agent	Convert user request into screen/flow spec
Frontend Builder	Implement using approved components
Storybook Agent	Create stories and examples
Visual QA Agent	Compare against visual/design constraints
Accessibility Agent	Check keyboard, contrast, ARIA, semantics
Repair Agent	Fix validated issues
Finalizer	Package implementation and conformance report

18.4 Validators

* approved components only;
* no raw colors;
* no raw spacing if tokens exist;
* valid import paths;
* no deprecated components;
* TypeScript pass;
* build pass;
* Storybook build pass;
* accessibility pass;
* responsive states present;
* visual snapshot generated.

18.5 Output

output/
  implementation/
  stories/
  tests/
  design-system-conformance.md
  accessibility-report.md
  visual-snapshots/
  harness-trace.json
  source-sync-suggestions.md

⸻

19. Functional Requirements

P0 Requirements

ID	Requirement
FR-001	User can invoke Harness Forge from Codex using a skill command
FR-002	System can classify user request into harness archetype
FR-003	System can choose quick, standard, deep, tournament, or automation mode
FR-004	System can ingest skill instructions
FR-005	System can build a basic SystemProfile
FR-006	System can compile a HarnessSpec
FR-007	System can define specialist agent roles
FR-008	System can spawn or simulate specialist subagents
FR-009	System can generate domain-specific prompts
FR-010	System can run artifact-specific validators
FR-011	System can produce a structured trace
FR-012	System can propose skill updates after a run
FR-013	Lottie/Motion harness supports SVG input
FR-014	Lottie/Motion harness supports FPS and duration constraints
FR-015	Lottie/Motion harness validates Lottie JSON
FR-016	Lottie/Motion harness renders preview
FR-017	Lottie/Motion harness exposes requested controls
FR-018	Design System harness can inventory components
FR-019	Design System harness can detect token usage
FR-020	Design System harness can detect raw colors
FR-021	Design System harness can check valid imports
FR-022	Harness must not silently modify source-of-truth files
FR-023	Harness must request approval for destructive writes
FR-024	Harness must produce final report with artifacts and validation status

P1 Requirements

ID	Requirement
FR-025	Source trust ranking
FR-026	Source conflict detection
FR-027	Source freshness tracking
FR-028	Worktree isolation for risky changes
FR-029	Multi-candidate generation
FR-030	Critic and tournament workflows
FR-031	Visual snapshot comparison
FR-032	Accessibility validation
FR-033	Storybook integration
FR-034	Figma context ingestion
FR-035	API/OpenAPI profiling
FR-036	PR review harness
FR-037	Repair harness
FR-038	Migration harness
FR-039	Release harness
FR-040	Automation promotion flow

P2 Requirements

ID	Requirement
FR-041	Harness marketplace
FR-042	Cross-project harness sharing
FR-043	Trace dashboard
FR-044	Cost/time optimization
FR-045	Harness reliability scoring
FR-046	Auto-generated eval suites
FR-047	Code-to-design roundtrip
FR-048	Organization-level source registry
FR-049	Team approval workflows
FR-050	Long-running background agent routines

⸻

20. Non-Functional Requirements

20.1 Reliability

* Harness should fail safely.
* Validators should run before final success.
* Source conflicts should be surfaced.
* Partial success should be explicitly marked.

20.2 Security

* Default to read-only for analysis agents.
* Write agents need scoped permissions.
* Destructive changes require approval.
* Secrets must never be printed in traces.
* External tool access must be explicit.

20.3 Performance

Target performance:

Mode	Expected Runtime
Quick	<2 minutes
Standard	2-8 minutes
Deep	8-30 minutes
Tournament	15-60 minutes
Automation	Configurable

20.4 Observability

Every run should log:

* selected archetype;
* selected sources;
* agents spawned;
* prompts generated;
* tool calls;
* validations;
* artifacts;
* failures;
* repair loops;
* final status;
* learning suggestions.

20.5 Extensibility

New harness packs should be easy to add using:

harnesses/
  motion-lottie/
    HARNESS.md
    profile.schema.json
    validators/
    agents/
    examples/
    evals/

⸻

21. Skill Package Structure

A Harness Forge skill should use this structure:

codex-harness-forge/
  SKILL.md
  harnesses/
    motion-lottie/
      HARNESS.md
      agents/
        asset-analyst.md
        motion-director.md
        prompt-specialist.md
        lottie-engineer.md
        render-qa.md
        motion-critic.md
        repair-agent.md
      validators/
        validate-lottie.ts
        render-preview.ts
        check-duration.ts
        check-controls.ts
      examples/
        logo-reveal/
        icon-loop/
        product-hero/
      evals/
        motion-quality-rubric.md
        lottie-schema-eval.json
    design-system-ui/
      HARNESS.md
      agents/
      validators/
      examples/
      evals/
    repair/
    review/
    migration/
  schemas/
    system-profile.schema.json
    harness-spec.schema.json
    trace.schema.json
  scripts/
    harnessctl.ts
    profile-source.ts
    compile-harness.ts
    run-harness.ts
    validate-artifact.ts

⸻

22. CLI / Codex Invocation Design

22.1 Basic Invocation

$harness-forge

Codex asks:

What source of truth should I use?
What artifact should I produce?
How deep should the harness run?

22.2 Direct Harness Invocation

$harness-forge motion-lottie deep

22.3 Source-Aware Invocation

$harness-forge design-system-ui deep
Sources:
- ./packages/ui
- ./apps/storybook
- ./brand-guidelines.pdf
Task:
Build the onboarding flow from this screenshot.

22.4 Repair Invocation

$harness-forge repair standard
Bug:
Dashboard refresh logs users out.

22.5 Review Invocation

$harness-forge review deep
Review current branch against main.
Use security, correctness, performance, test coverage, and API compatibility agents.

⸻

23. Example HarnessSpec: Lottie

version: "0.1"
name: "premium-logo-reveal"
archetype: "visual-harness"
mode: "deep"
user_intent: "Create a premium logo animation from logo.svg"
sources:
  - id: "logo-svg"
    type: "file"
    location: "./logo.svg"
    trust: "highest"
  - id: "lottie-skill"
    type: "skill"
    location: "./skills/lottie"
    trust: "high"
  - id: "motion-guide"
    type: "file"
    location: "./motion-prompt-guide.md"
    trust: "high"
system_profiles:
  - id: "motion-system"
    type: "motion-system"
agents:
  - id: "asset-analyst"
    role: "Inspect SVG geometry and identify animatable groups"
    write_access: false
  - id: "motion-director"
    role: "Create three motion directions using professional animation language"
    write_access: false
  - id: "prompt-specialist"
    role: "Convert selected direction into exact Lottie generation prompt"
    write_access: false
  - id: "lottie-engineer"
    role: "Generate Lottie JSON"
    write_access: true
  - id: "render-qa"
    role: "Render preview and find technical issues"
    write_access: false
  - id: "motion-critic"
    role: "Evaluate pacing, clarity, premium feel, and brand fit"
    write_access: false
  - id: "repair-agent"
    role: "Fix validation and render issues"
    write_access: true
validators:
  - "valid_json"
  - "valid_lottie_schema"
  - "duration_matches_request"
  - "fps_matches_request"
  - "controls_exist"
  - "preview_renders"
outputs:
  - "animation.json"
  - "preview.mp4"
  - "controls.json"
  - "validation-report.md"
  - "harness-trace.json"
learning:
  propose_skill_updates: true
  update_without_approval: false

⸻

24. Example HarnessSpec: Design System UI

version: "0.1"
name: "onboarding-flow-design-system"
archetype: "system-harness"
mode: "deep"
user_intent: "Build a production onboarding flow using the company design system"
sources:
  - id: "ui-package"
    type: "directory"
    location: "./packages/ui"
    trust: "highest"
  - id: "storybook"
    type: "directory"
    location: "./apps/storybook"
    trust: "high"
  - id: "figma"
    type: "figma"
    location: "$FIGMA_SELECTION"
    trust: "high"
  - id: "brand-guide"
    type: "pdf"
    location: "./brand-guidelines.pdf"
    trust: "medium"
system_profiles:
  - id: "design-system"
    type: "design-system"
agents:
  - id: "source-auditor"
    role: "Identify source conflicts and deprecated components"
    write_access: false
  - id: "component-inventory"
    role: "Extract approved components, props, imports, and examples"
    write_access: false
  - id: "token-agent"
    role: "Extract approved design tokens"
    write_access: false
  - id: "ux-flow-agent"
    role: "Create flow specification using approved components"
    write_access: false
  - id: "frontend-builder"
    role: "Implement production UI"
    write_access: true
  - id: "storybook-agent"
    role: "Create Storybook stories"
    write_access: true
  - id: "a11y-agent"
    role: "Validate accessibility"
    write_access: false
  - id: "visual-qa"
    role: "Validate visual conformance"
    write_access: false
  - id: "repair-agent"
    role: "Fix validated issues"
    write_access: true
validators:
  - "typescript_check"
  - "build_check"
  - "storybook_build"
  - "approved_components_only"
  - "no_raw_hex_colors"
  - "valid_token_usage"
  - "valid_import_paths"
  - "no_deprecated_components"
  - "accessibility_check"
  - "visual_snapshot_check"
outputs:
  - "implementation/"
  - "stories/"
  - "tests/"
  - "design-system-conformance.md"
  - "accessibility-report.md"
  - "harness-trace.json"
  - "source-sync-suggestions.md"
learning:
  propose_agents_md_updates: true
  propose_skill_updates: true
  update_without_approval: false

⸻

25. UX Flow

25.1 First-Time Setup

User runs:

$harness-forge init

Codex asks:

1. What types of work should Harness Forge optimize for?
2. Which sources of truth exist?
3. Where are repo instructions?
4. Where are design-system files?
5. What commands validate correctness?
6. What should require approval?

Output:

.harness/
  config.yaml
  profiles/
  traces/
  validators/
  harnesses/

25.2 Normal Run

User:

$harness-forge motion-lottie deep

Harness Forge:

1. loads config;
2. profiles sources;
3. compiles harness;
4. shows brief execution summary;
5. asks for approval if needed;
6. runs agents;
7. validates outputs;
8. returns artifacts.

25.3 End of Run

Output summary:

Status: success
Artifacts:
- animation.json
- preview.mp4
- controls.json
Validation:
- valid JSON: pass
- Lottie schema: pass
- render preview: pass
- duration: pass
- FPS: pass
- controls: pass
Learning suggestions:
- Add "premium logo reveal" example to motion-lottie skill
- Add validator for unsupported masks
- Add brand accent color to MotionSystemProfile

⸻

26. Human Approval Rules

Approval required for:

* destructive file operations;
* deleting files;
* changing source-of-truth docs;
* modifying design-system components;
* modifying release config;
* opening PRs;
* deploying;
* sending external messages;
* running long/costly tournament workflows;
* changing generated harness templates permanently.

Approval not required for:

* reading files;
* creating temporary profiles;
* creating traces;
* generating local candidate artifacts;
* running safe validation commands;
* proposing updates.

⸻

27. Validation Strategy

27.1 Validator Types

Validator Type	Examples
Schema	Lottie JSON, OpenAPI, package config
Static	TypeScript, ESLint, import paths
Runtime	tests, build, render, app launch
Visual	screenshot diff, preview render
Accessibility	contrast, ARIA, keyboard flow
Source Conformance	tokens, approved components, API contract
Human Rubric	motion taste, brand fit, UX quality
Security	secret leakage, unsafe permissions
Release	changelog, migration note, CI status

27.2 Validation Result Format

type ValidationResult = {
  id: string;
  name: string;
  status: "pass" | "fail" | "warning" | "skipped";
  details: string;
  evidence?: string[];
  repairable: boolean;
};

⸻

28. Learning Loop

At the end of every run, Harness Forge should generate:

learning-suggestions.md

It should include:

1. what worked;
2. what failed;
3. what sources were missing;
4. what validator should be added;
5. what instruction should be added to skill;
6. what anti-pattern was observed;
7. what should be added to AGENTS.md;
8. whether this harness is ready for automation.

Example:

## Proposed Skill Update
Add this to motion-lottie/HARNESS.md:
When animating logos with multiple SVG paths, first group paths into:
- base structure
- accent marks
- typography
- decorative details
Animate base structure before decorative details.
Avoid animating all paths simultaneously unless the user requests chaotic motion.

⸻

29. Metrics

29.1 Product Metrics

Metric	Definition
Harness success rate	Runs ending in validated success
First-pass acceptance	User accepts output without major correction
Manual correction turns	Number of user turns after output
Validation pass rate	Percentage of validators passing
Source conformance score	Degree of adherence to source-of-truth rules
Reuse rate	Number of repeated harness runs
Promotion rate	Manual harnesses promoted to reusable templates
Automation readiness	Harnesses with enough successful traces
Learning adoption	Suggested updates accepted by user
Time saved	User-estimated or measured workflow time reduction

29.2 Lottie-Specific Metrics

Metric	Definition
JSON validity	Valid Lottie JSON
Render success	Preview can render
Duration accuracy	Output matches requested duration
FPS accuracy	Output matches requested FPS
Control coverage	Requested controls exposed
Candidate quality	Critic score
User selection rate	Candidate chosen without regeneration

29.3 Design-System Metrics

Metric	Definition
Approved component usage	No invented components
Token compliance	No raw colors/spacing when tokens exist
Import correctness	Valid import paths
Build pass	App builds
Storybook pass	Stories build
A11y pass	Accessibility checks pass
Visual conformance	Snapshot/rubric score
Rework rate	Manual UI corrections required

⸻

30. MVP Scope

30.1 MVP Must Include

* Codex skill package for Harness Forge;
* Pattern Router v0;
* SystemProfile schema;
* HarnessSpec schema;
* trace schema;
* Motion/Lottie harness;
* basic Design System harness;
* agent role templates;
* validator interface;
* Lottie validators;
* basic UI conformance validators;
* learning suggestions;
* quick/standard/deep modes.

30.2 MVP Can Exclude

* full marketplace;
* full automation;
* production dashboard;
* multi-user permission model;
* advanced trace visualization;
* full Figma roundtrip;
* advanced visual diff;
* organization-wide registry.

⸻

31. MVP User Experience

31.1 Install

Install Harness Forge as a Codex skill.

31.2 Configure

$harness-forge init

Creates:

.harness/config.yaml
.harness/profiles/
.harness/traces/

31.3 Run Lottie Harness

$harness-forge motion-lottie deep
Use ./logo.svg.
Create a 4-second 30 FPS premium reveal.
Expose controls for background, accent color, speed, and camera intensity.

31.4 Run Design System Harness

$harness-forge design-system-ui standard
Use ./packages/ui and ./apps/storybook.
Build a settings page using approved components only.

31.5 Review Output

Codex returns:

Status
Artifacts
Validation report
Trace
Learning suggestions

⸻

32. Technical Design

32.1 Runtime Options

Harness Forge can be implemented in three levels.

Level 1: Skill-Only MVP

* Codex skill with markdown instructions;
* scripts inside skill folder;
* Codex manually follows harness logic;
* suitable for quick MVP.

Level 2: Local CLI Runtime

* harnessctl;
* local profile generation;
* structured HarnessSpec;
* validator scripts;
* trace files;
* Codex invokes CLI.

Level 3: SDK/MCP Runtime

* Codex as coding agent;
* external orchestrator;
* true subagent scheduling;
* worktree management;
* trace dashboard;
* automation integration.

MVP should start with Level 1 + Level 2.

32.2 Recommended Stack

Layer	Choice
CLI	TypeScript / Node
Config	YAML
Schemas	JSON Schema / Zod
Traces	JSONL
Validators	TypeScript scripts
Preview	local render scripts
Worktree	Git worktrees
UI testing	Playwright
Lottie rendering	package-specific renderer
Design-system profiling	static AST + package inspection
Storybook	static story discovery + build command
Future orchestration	Agents SDK / MCP

⸻

33. Repo Structure

codex-harness-forge/
  README.md
  SKILL.md
  package.json
  src/
    cli/
      harnessctl.ts
    router/
      pattern-router.ts
    profiler/
      source-profiler.ts
      motion-profiler.ts
      design-system-profiler.ts
    compiler/
      system-profile-builder.ts
      domain-prompt-compiler.ts
      harness-spec-compiler.ts
    runtime/
      agent-runtime.ts
      workflow-runner.ts
      trace-writer.ts
    validators/
      lottie/
      design-system/
      common/
    learning/
      learning-suggestions.ts
  harnesses/
    motion-lottie/
    design-system-ui/
    repair/
    review/
    migration/
  schemas/
    system-profile.schema.json
    harness-spec.schema.json
    trace.schema.json
  examples/
    lottie-logo-reveal/
    design-system-settings-page/

⸻

34. Risk Analysis

34.1 Risk: Too Abstract

If the product starts as a generic meta-agent framework, it may become vague.

Mitigation:

* start with Lottie;
* add design-system harness second;
* prove measurable quality improvements;
* only then expand.

34.2 Risk: Too Heavy for Simple Tasks

Users may not want multi-agent overhead.

Mitigation:

* quick mode;
* router chooses lightweight path;
* only deep mode when requested or needed.

34.3 Risk: Validators Are Hard

Some domains are subjective.

Mitigation:

* combine objective validators with human rubrics;
* use preview artifacts;
* use candidate ranking;
* ask for approval on taste-sensitive work.

34.4 Risk: Source Conflicts

Design system docs may conflict with code.

Mitigation:

* source trust ranking;
* conflict report;
* do not guess silently;
* prefer code over stale docs.

34.5 Risk: Agent Drift

Subagents may produce inconsistent outputs.

Mitigation:

* strict output schemas;
* scoped source access;
* final synthesis agent;
* validator-first workflow.

34.6 Risk: Overfitting to Codex Current Capabilities

Codex APIs and product primitives may evolve.

Mitigation:

* keep harness specs model/tool-agnostic;
* isolate Codex-specific adapter;
* support CLI and SDK runtime;
* design around source profiles and validators.

⸻

35. Roadmap

Phase 0: Prototype

Timeline: 1-2 weeks

Build:

* skill structure;
* Motion/Lottie harness;
* simple HarnessSpec;
* simple trace;
* basic validators;
* manual multi-agent prompt templates.

Success:

* produce better Lottie outputs than one-shot prompting;
* render preview;
* validation report generated.

Phase 1: MVP

Timeline: 3-5 weeks

Build:

* CLI runtime;
* Pattern Router v0;
* SystemProfile;
* HarnessSpec;
* trace files;
* MotionSystemProfile;
* DesignSystemProfile v0;
* quick/standard/deep modes.

Success:

* repeatable Lottie workflow;
* basic design-system UI workflow;
* artifact validation;
* learning suggestions.

Phase 2: Design System Agent

Timeline: 4-8 weeks

Build:

* component inventory;
* token extraction;
* Storybook integration;
* import path validation;
* no raw color validator;
* a11y check;
* visual snapshot generation.

Success:

* Codex builds UI with approved components;
* conformance report passes;
* reduced UI rework.

Phase 3: Harness Library

Timeline: 8-12 weeks

Build:

* repair harness;
* review harness;
* migration harness;
* release harness;
* ops/data/docs harness;
* reusable templates.

Success:

* 9 archetypes usable;
* pattern router covers most Codex tasks.

Phase 4: SDK Orchestrator

Timeline: 12-20 weeks

Build:

* true multi-agent orchestrator;
* worktree isolation;
* trace dashboard;
* parallel candidates;
* repair loops;
* human approval UI.

Success:

* complex workflows run outside main chat context;
* reproducible traces;
* reliable retry loops.

Phase 5: Automation and Marketplace

Timeline: 20+ weeks

Build:

* automation promotion flow;
* background routines;
* harness marketplace;
* team sharing;
* organization source registry;
* eval scoring.

Success:

* proven harnesses become scheduled routines;
* teams share harness packs;
* source-of-truth systems become executable.

⸻

36. Example Final User Experience

User:

$harness-forge motion-lottie tournament
Use logo.svg and brand.json.
Make a premium reveal animation for a landing page hero.
Duration 4 seconds, 30 FPS.
Expose controls for background, accent color, speed, and camera intensity.

Harness Forge:

Selected archetype: Visual Harness
Selected system: MotionSystemProfile
Selected mode: Tournament
Loaded:
- logo.svg
- brand.json
- motion-lottie skill
- Lottie validators
Agents:
- Asset Analyst
- Motion Director
- Prompt Specialist
- Lottie Engineer x3
- Render QA
- Motion Critic
- Repair Agent
- Finalizer
Validation:
- JSON: pass
- Lottie schema: pass
- render: pass
- FPS: pass
- duration: pass
- controls: pass
Artifacts:
- animation.json
- preview.mp4
- controls.json
- validation-report.md
- harness-trace.json
Learning:
- Proposed new example: premium-logo-reveal
- Proposed new validator: max layer count

⸻

37. Strategic Positioning

Harness Forge should be positioned as:

A meta-agent layer for Codex that compiles skills, source-of-truth systems, and task intent into executable custom harnesses.

It is not merely:

* a prompt library;
* a workflow checklist;
* a subagent wrapper;
* a skill pack;
* a design-system importer.

It is a source-of-truth-to-agent-runtime compiler.

⸻

38. Future Direction

In the future, every serious team will likely have multiple internal system agents:

* Design System Agent;
* Motion System Agent;
* API Integration Agent;
* QA Agent;
* Security Review Agent;
* Release Agent;
* Data Report Agent;
* Docs Agent;
* Brand Agent;
* Customer Support Agent;
* Frontend Agent;
* Infra Agent.

Harness Forge should become the way these agents are created, versioned, evaluated, reused, and improved.

The core long-term bet:

The best agents will not be the ones with the longest prompts.
They will be the ones with the best harnesses.