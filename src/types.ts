export type HarnessMode = "quick" | "standard" | "deep" | "tournament" | "automation";

export type ReasoningEffort = "normal" | "hard" | "original";

export type HarnessArchetype =
  | "explore-harness"
  | "repair-harness"
  | "test-harness"
  | "feature-harness"
  | "migration-harness"
  | "visual-harness"
  | "system-harness"
  | "review-harness"
  | "ops-data-docs-harness";

export type SystemProfileType =
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

export type SourceRefType =
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

export type SourceTrust = "highest" | "high" | "medium" | "low";

export type SourceAvailability = "available" | "missing" | "unverified";

export type ValidatorStatus = "pass" | "fail" | "warning" | "skipped";

export type HarnessSubsystemId = "instructions" | "tools" | "environment" | "state" | "feedback";

export type FeatureState = "not_started" | "active" | "blocked" | "passing";

export type VerificationLayer = "static" | "runtime" | "system";

export type SourceFactKind =
  | "rule"
  | "component"
  | "token"
  | "api"
  | "schema"
  | "test-command"
  | "validator"
  | "example"
  | "anti-pattern"
  | "asset-property"
  | "runtime-constraint"
  | "capability-hint";

export type EvidenceExtractorType = "static" | "ast" | "schema" | "runtime" | "llm";

export type CapabilityKind = "agent-template" | "tool" | "validator" | "artifact-generator" | "profiler" | "repair-strategy";

export type HarnessNodeKind = "profile" | "analyze" | "plan" | "generate" | "validate" | "repair" | "rank" | "human-gate" | "finalize";

export type HarnessDraftNodeStatus = "draft" | "verified" | "rejected";

export type TraceEventType =
  | "draft.created"
  | "draft.verified"
  | "ir.compiled"
  | "executor.bound"
  | "worker.bound"
  | "runtime.registry.created"
  | "runtime.provider_registry.created"
  | "runtime.tool_safety.classified"
  | "runtime.context_budget.recorded"
  | "runtime.feature_scheduler.created"
  | "runtime.gate.checked"
  | "runtime.hook.recorded"
  | "runtime.bus.created"
  | "runtime.trace_context.created"
  | "runtime.dispatch_plan.created"
  | "runtime.startup_readiness.checked"
  | "runtime.invocation_ledger.created"
  | "runtime.node_execution.recorded"
  | "runtime.initialization.checked"
  | "runtime.environment_readiness.recorded"
  | "runtime.instruction_router.created"
  | "runtime.lifecycle_ledger.created"
  | "runtime.feedback_promotion.recorded"
  | "runtime.diagnostic_ledger.created"
  | "runtime.repair_guidance.recorded"
  | "runtime.subsystem_audit.recorded"
  | "runtime.ablation_comparison.recorded"
  | "runtime.evaluator_rubric.recorded"
  | "runtime.quality_document.recorded"
  | "runtime.quality_ledger.recorded"
  | "runtime.continuity_ledger.recorded"
  | "runtime.course_alignment.recorded"
  | "runtime.completion_authority.recorded"
  | "runtime.verification_pipeline.recorded"
  | "runtime.clean_state.recorded"
  | "runtime.architecture_boundary.recorded"
  | "runtime.source_of_record.recorded"
  | "run.plan.created"
  | "run.started"
  | "run.persisted"
  | "workflow.saved"
  | "workflow.resumed"
  | "parallel_group.started"
  | "parallel_group.completed"
  | "agent.started"
  | "agent.completed"
  | "node.started"
  | "node.completed"
  | "node.blocked"
  | "validator.started"
  | "validator.completed"
  | "artifact.written"
  | "council.reviewed"
  | "course_correction.proposed"
  | "learning.proposed"
  | "run.completed";

export interface SourceRef {
  id: string;
  type: SourceRefType;
  location: string;
  trust: SourceTrust;
  availability: SourceAvailability;
  lastSyncedAt?: string;
  notes?: string[];
}

export interface ProvenanceRef {
  sourceId: string;
  location: string;
  lineStart?: number;
  lineEnd?: number;
  excerpt?: string;
}

export interface SourceFact {
  id: string;
  sourceId: string;
  kind: SourceFactKind;
  claim: string;
  provenance: ProvenanceRef[];
  extractor: EvidenceExtractorType;
  confidence: number;
  stale: boolean;
  tags?: string[];
}

export interface EvidenceEdge {
  id: string;
  fromFactId: string;
  toFactId: string;
  relation: "supports" | "conflicts" | "supersedes" | "requires" | "derived-from";
  reason: string;
}

export interface EvidenceGraph {
  id: string;
  builtAt: string;
  sources: SourceRef[];
  facts: SourceFact[];
  edges: EvidenceEdge[];
}

export interface SourceTrustRank {
  sourceId: string;
  rank: number;
  reason: string;
}

export interface FreshnessMetadata {
  profiledAt: string;
  stale: boolean;
  notes: string[];
}

export interface Rule {
  id: string;
  text: string;
  sourceId?: string;
}

export interface Example {
  id: string;
  title: string;
  location?: string;
  notes?: string;
}

export interface AntiPattern {
  id: string;
  text: string;
  sourceId?: string;
}

export interface ValidatorSpec {
  id: string;
  name: string;
  type: "schema" | "static" | "runtime" | "visual" | "accessibility" | "source-conformance" | "human-rubric" | "security" | "release";
  command?: string;
  required: boolean;
}

export interface CapabilitySpec {
  id: string;
  kind: CapabilityKind;
  name: string;
  description: string;
  supports: {
    artifactTypes?: string[];
    sourceFactKinds?: SourceFactKind[];
    taskKinds?: string[];
    modes?: HarnessMode[];
  };
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  deterministic: boolean;
  permissionRequired: Array<"filesystem-read" | "filesystem-write" | "destructive-write" | "source-of-truth-write" | "external-side-effect" | "human-review">;
}

export interface ReviewPoint {
  id: string;
  reason: string;
  requiredBefore: "write" | "destructive-write" | "external-side-effect" | "finalize";
}

export interface ArtifactContract {
  id: string;
  type:
    | "lottie-json"
    | "react-component"
    | "storybook-story"
    | "test-file"
    | "markdown-doc"
    | "api-client"
    | "migration-patch"
    | "source-tree"
    | "release-report"
    | "data-report"
    | "workflow-state"
    | "review-report";
  requiredFiles?: string[];
  schema?: Record<string, unknown>;
  validators: string[];
  humanReviewRequired?: boolean;
}

export interface ArtifactContractV2 extends ArtifactContract {
  producedBy?: string;
  requiredEvidence?: string[];
  validatorBindings: string[];
}

export interface SystemProfile {
  id: string;
  name: string;
  type: SystemProfileType;
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
  evidenceGraph?: EvidenceGraph;
}

export interface SystemProfileRef {
  id: string;
  type: SystemProfileType;
}

export interface AgentSpec {
  id: string;
  name: string;
  role: string;
  goal: string;
  writeAccess: boolean;
  tools: string[];
  allowedSources: string[];
  outputSchema: Record<string, unknown>;
  stopConditions: string[];
}

export interface WorkflowNode {
  id: string;
  title: string;
  kind?: HarnessNodeKind;
  capabilityId?: string;
  agentId?: string;
  validatorId?: string;
  artifactId?: string;
  dependsOn: string[];
  produces?: string[];
  evidenceRequired?: string[];
}

export interface NodeInputRef {
  id: string;
  kind: "source" | "artifact" | "fact" | "validator-result" | "human-decision";
  ref: string;
}

export interface NodeOutputContract {
  id: string;
  kind: "artifact" | "fact" | "validator-result" | "report" | "decision";
  schema?: Record<string, unknown>;
  required: boolean;
}

export interface HarnessNode {
  id: string;
  kind: HarnessNodeKind;
  title: string;
  capabilityId?: string;
  agentId?: string;
  validatorId?: string;
  inputs: NodeInputRef[];
  outputs: NodeOutputContract[];
  evidenceRequired: string[];
  allowedSources: string[];
  permissions: CapabilitySpec["permissionRequired"];
  retryPolicy?: { maxAttempts: number; repairNodeId?: string };
  onFail?: string;
}

export interface HarnessEdge {
  from: string;
  to: string;
  reason: string;
}

export interface ValidatorBinding {
  id: string;
  validatorId: string;
  artifactId?: string;
  nodeId?: string;
  required: boolean;
  evidenceRequired: string[];
}

export interface HarnessSubsystem {
  id: HarnessSubsystemId;
  purpose: string;
  plannedArtifacts: string[];
  evaluationCriteria: string[];
}

export interface HarnessFeature {
  id: string;
  behavior: string;
  verificationCommand: string;
  state: FeatureState;
  validatorIds: string[];
  dependsOn: string[];
  evidence: string[];
  nodeIds: string[];
  artifactIds: string[];
  required: boolean;
  layer: VerificationLayer;
}

export interface VerificationLevel {
  layer: VerificationLayer;
  purpose: string;
  validatorIds: string[];
  required: boolean;
  passCriteria: string;
}

export interface EvaluatorRubricDimension {
  id: string;
  name: string;
  minimumScore: number;
  passCriteria: string;
}

export interface SprintContract {
  id: string;
  scope: string[];
  exclusions: string[];
  featureIds: string[];
  verificationStandards: string[];
  evaluatorRubric: EvaluatorRubricDimension[];
}

export interface HarnessLifecycle {
  startupReadiness: string[];
  cleanExit: string[];
  handoffArtifacts: string[];
}

export interface DynamicHarnessModel {
  schemaVersion: 1;
  subsystems: HarnessSubsystem[];
  featureList: HarnessFeature[];
  sprintContract: SprintContract;
  verificationHierarchy: VerificationLevel[];
  lifecycle: HarnessLifecycle;
}

export interface HarnessIR {
  id: string;
  selectedCapabilityPackIds: string[];
  task: {
    userGoal: string;
    explicitConstraints: string[];
    impliedArtifacts: string[];
    assumptions: string[];
  };
  mode: HarnessMode;
  evidenceGraph: EvidenceGraph;
  artifacts: ArtifactContractV2[];
  nodes: HarnessNode[];
  edges: HarnessEdge[];
  validators: ValidatorBinding[];
  permissions: PermissionSpec;
  checkpoints: CheckpointSpec[];
  harnessModel: DynamicHarnessModel;
}

export interface HarnessDraft {
  id: string;
  selectedCapabilityPackIds: string[];
  taskKindHypotheses: Array<{ kind: string; confidence: number; evidence: string[] }>;
  selectedArtifacts: ArtifactContractV2[];
  proposedNodes: HarnessNode[];
  proposedEdges: HarnessEdge[];
  proposedValidators: ValidatorBinding[];
  assumptions: string[];
  evidenceUse: Array<{ decision: string; evidenceFactIds: string[] }>;
}

export interface PermissionSpec {
  defaultWriteAccess: boolean;
  destructiveWritesRequireApproval: boolean;
  sourceOfTruthWritesRequireApproval: boolean;
  externalSideEffectsRequireApproval: boolean;
}

export interface CheckpointSpec {
  id: string;
  reason: string;
  required: boolean;
  beforeNodeId?: string;
}

export interface LearningSpec {
  proposeSkillUpdates: boolean;
  proposeAgentsMdUpdates: boolean;
  updateWithoutApproval: boolean;
  automationCandidate: boolean;
}

export interface HarnessSpec {
  id: string;
  name: string;
  archetype: HarnessArchetype;
  mode: HarnessMode;
  routeComposition?: RouteComposition;
  selectedCapabilityPackIds?: string[];
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
  cognitiveStrategy: CognitiveStrategy;
  harnessModel: DynamicHarnessModel;
  compiledPrompt: string;
  evidenceGraph?: EvidenceGraph;
  ir?: HarnessIR;
}

export interface CognitiveStrategy {
  reasoningEffort: ReasoningEffort;
  originalityRequired: boolean;
  hypothesisCount: number;
  outOfDistributionExploration: boolean;
  validationPlan: string[];
  stopWhen: string[];
}

export interface SourceConflict {
  id: string;
  description: string;
  sourceIds: string[];
  resolution: string;
}

export interface AgentRun {
  agentId: string;
  status: "completed" | "planned_not_executed" | "blocked" | "skipped";
  summary: string;
  artifacts: string[];
}

export type RuntimeAgentGroup = "domain-planning" | "runtime-planning" | "council-elders" | "course-correction" | "finalization";

export interface CriticQuestion {
  id: string;
  criticId: string;
  category: string;
  severity: "blocker" | "major" | "minor" | "note";
  question: string;
  whyItMatters: string;
  evidence: string[];
  answerRequired: boolean;
  suggestedAssumption?: string;
  resolution: "unresolved" | "assumed" | "answered" | "not-required";
}

export interface CriticReview {
  criticId: string;
  summary: string;
  questions: CriticQuestion[];
  missingEvidence: string[];
  unsafeAssumptions: string[];
  domainRisks: string[];
  mustAnswerBeforeFinalize: string[];
  confidenceScore: number;
}

export interface RuntimeAgentRun {
  id: string;
  runId: string;
  group: RuntimeAgentGroup;
  nodeId: string;
  agentId: string;
  status: "completed" | "blocked";
  startedAt: string;
  completedAt: string;
  summary: string;
  artifacts: string[];
  inputs: string[];
  evidence: string[];
  findings: CouncilReviewFinding[];
  courseCorrections: string[];
  criticReview?: CriticReview;
  references: string[];
}

export interface ValidationResult {
  id: string;
  name: string;
  status: ValidatorStatus;
  details: string;
  evidence?: string[];
  repairable: boolean;
}

export interface ArtifactRef {
  id: string;
  type: string;
  path: string;
}

export interface LearningSuggestion {
  id: string;
  target: "skill" | "agents-md" | "validator" | "example" | "source-sync" | "automation";
  title: string;
  body: string;
}

export interface HarnessTrace {
  runId: string;
  harnessSpecId: string;
  startedAt: string;
  completedAt?: string;
  userIntent: string;
  selectedArchetype: HarnessArchetype;
  selectedMode: HarnessMode;
  routeComposition?: RouteComposition;
  sourcesLoaded: SourceRef[];
  sourceConflicts: SourceConflict[];
  agentsSpawned: AgentRun[];
  validations: ValidationResult[];
  artifacts: ArtifactRef[];
  finalStatus: "success" | "partial" | "failed" | "needs-human-review";
  learningSuggestions: LearningSuggestion[];
  events?: TraceEvent[];
}

export type WorkflowRunLifecycleStatus = "running" | "completed" | "failed";

export interface WorkflowRunRecord {
  runId: string;
  status: WorkflowRunLifecycleStatus;
  startedAt: string;
  completedAt?: string;
  request: HarnessRequest;
  harnessSpecId?: string;
  finalStatus?: HarnessTrace["finalStatus"];
  outputDir: string;
  tracePath?: string;
  artifacts: string[];
  validations: ValidationResult[];
  resumedFromRunId?: string;
}

export interface SavedWorkflow {
  name: string;
  sourceRunId: string;
  savedAt: string;
  request: HarnessRequest;
  harnessSpecId?: string;
  notes: string[];
}

export interface CouncilReviewFinding {
  id: string;
  elder: "gstack-process" | "gbrain-memory" | "verifier";
  severity: "blocker" | "major" | "minor" | "note";
  finding: string;
  evidence: string[];
  courseCorrection: string;
}

export interface CouncilReview {
  id: string;
  runId: string;
  reviewedAt: string;
  agentRunIds: string[];
  references: Array<{
    id: "gstack" | "gbrain";
    title: string;
    url: string;
    license: string;
    sourceKind: "open-source-project";
    lesson: string;
    principles: Array<{
      id: string;
      title: string;
      check: string;
      evidence: string[];
    }>;
  }>;
  elders: Array<{
    id: CouncilReviewFinding["elder"];
    role: string;
    checks: string[];
  }>;
  steps: Array<{
    id: string;
    title: string;
    status: "pass" | "course-correct" | "blocked";
    agentRunIds: string[];
    doctrinePrincipleIds: string[];
    notes: string[];
  }>;
  findings: CouncilReviewFinding[];
  criticReviews: CriticReview[];
  criticQuestions: CriticQuestion[];
  unresolvedBlockerQuestions: CriticQuestion[];
  courseCorrections: string[];
  verdict: "pass" | "course-correct";
}

export interface TraceEvent {
  id: string;
  runId: string;
  type: TraceEventType;
  timestamp: string;
  nodeId?: string;
  capabilityId?: string;
  validatorId?: string;
  artifactId?: string;
  status?: ValidatorStatus | AgentRun["status"] | RuntimeAgentRun["status"] | HarnessTrace["finalStatus"];
  message: string;
  evidence?: string[];
}

export interface HarnessRequest {
  harness?: string;
  mode?: HarnessMode;
  intent: string;
  sources: string[];
  durationSeconds?: number;
  fps?: number;
  width?: number;
  height?: number;
  controls: string[];
  reasoningEffort?: ReasoningEffort;
  originalityRequired?: boolean;
  hypothesisCount?: number;
  outOfDistributionExploration?: boolean;
  outputDir: string;
}

export interface RouteDecision {
  archetype: HarnessArchetype;
  mode: HarnessMode;
  systemTypes: SystemProfileType[];
  requiredAgents: string[];
  requiredValidators: string[];
  selectedCapabilityPackIds: string[];
  composition: RouteComposition;
  reason: string;
}

export interface RouteComposition {
  primaryArchetype: HarnessArchetype;
  primaryPackId?: string;
  composite: boolean;
  matchedPacks: RoutePackMatch[];
  systemTypes: SystemProfileType[];
  conflictWarnings: string[];
}

export interface RoutePackMatch {
  packId: string;
  name: string;
  archetype?: HarnessArchetype;
  score: number;
  selected: boolean;
  matchedBy: Array<{
    type: "term" | "source-extension" | "evidence-tag" | "required";
    value: string;
  }>;
  reason: string;
}
