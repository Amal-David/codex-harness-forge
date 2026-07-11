import path from "node:path";
import type { HarnessSpec, TraceEvent, ValidationResult } from "../types.js";
import { stableId, writeJson } from "../utils/fs.js";
import { buildContextBudgetLedger, type ContextBudgetLedger } from "./context-budget-ledger.js";
import { isIntrinsicRuntimeNode } from "./node-execution-policy.js";
import {
  ALLOWED_ADAPTERS,
  SENSITIVE_PERMISSIONS,
  buildApprovalGate,
  buildBudgetGate,
  buildPolicyGate,
  type ApprovalGate,
  type ApprovalRequest,
  type BudgetGate,
  type PolicyDecision,
  type PolicyGate,
} from "./runtime-policy-gates.js";
import type { ExecutorLockEntry, RunPlan, WorkerLockEntry } from "./run-plan.js";
import {
  APPROVAL_GATE_ARTIFACT,
  BUDGET_GATE_ARTIFACT,
  CONTEXT_BUDGET_LEDGER_ARTIFACT,
  FUNCTION_DISPATCH_PLAN_ARTIFACT,
  FUNCTION_INVOCATION_LEDGER_ARTIFACT,
  HOOK_LEDGER_ARTIFACT,
  POLICY_GATE_ARTIFACT,
  PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT,
  RUNTIME_BUS_ARTIFACT,
  STARTUP_READINESS_ARTIFACT,
  TOOL_SAFETY_LEDGER_ARTIFACT,
  TRACE_CONTEXT_ARTIFACT,
  WORKER_FUNCTION_REGISTRY_ARTIFACT,
} from "./runtime-control-artifacts.js";
export type { ContextBudgetLedger } from "./context-budget-ledger.js";
export type { ApprovalGate, BudgetGate, PolicyGate } from "./runtime-policy-gates.js";

export {
  APPROVAL_GATE_ARTIFACT,
  BUDGET_GATE_ARTIFACT,
  CONTEXT_BUDGET_LEDGER_ARTIFACT,
  FUNCTION_DISPATCH_PLAN_ARTIFACT,
  FUNCTION_INVOCATION_LEDGER_ARTIFACT,
  HOOK_LEDGER_ARTIFACT,
  POLICY_GATE_ARTIFACT,
  PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT,
  RUNTIME_BUS_ARTIFACT,
  STARTUP_READINESS_ARTIFACT,
  TOOL_SAFETY_LEDGER_ARTIFACT,
  TRACE_CONTEXT_ARTIFACT,
  WORKER_FUNCTION_REGISTRY_ARTIFACT,
} from "./runtime-control-artifacts.js";

interface RuntimeControlInput {
  outputDir: string;
  runId: string;
  spec: HarnessSpec;
  executorLock: ExecutorLockEntry[];
  workerLock: WorkerLockEntry[];
  runPlan: RunPlan;
}

export interface RuntimeControlArtifacts {
  artifacts: string[];
  validations: ValidationResult[];
  registry: WorkerFunctionRegistry;
  policyGate: PolicyGate;
  budgetGate: BudgetGate;
  approvalGate: ApprovalGate;
  toolSafetyLedger: ToolSafetyLedger;
  contextBudgetLedger: ContextBudgetLedger;
  hookLedger: HookLedger;
  traceContext: TraceContext;
  dispatchPlan: FunctionDispatchPlan;
  providerReplacementRegistry: ProviderReplacementRegistry;
  runtimeBus: RuntimeBus;
  startupReadiness: StartupReadiness;
}

export interface WorkerFunctionRegistry {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  protocol: {
    name: "harness.worker-function";
    dispatchRule: string;
    traceContext: {
      runId: string;
      eventLedger: string;
      traceArtifact: string;
    };
  };
  workerFunctions: WorkerFunctionRegistration[];
  executorFunctions: ExecutorFunctionRegistration[];
  eventTopics: string[];
  stateNamespaces: string[];
  replacementCompatibilityKeys: string[];
}

interface WorkerFunctionRegistration {
  id: string;
  workerLockId: string;
  packId: string;
  workerBindingId: string;
  group: WorkerLockEntry["group"];
  contract: {
    id: string;
    functionId: string;
    triggerId: string;
    version: string;
    stateNamespace: string;
    eventTopics: string[];
    replacementCompatibilityKey: string;
  };
  adapter: {
    selected: string;
    allowed: string[];
    module?: string;
    exportName?: string;
    executionModel?: string;
  };
  criticContract?: WorkerLockEntry["criticContract"];
  agentIds: string[];
  matchedAgentIds: string[];
  capabilityIds: string[];
  matchedCapabilityIds: string[];
  nodeIds: string[];
  traceSpanId: string;
}

interface ExecutorFunctionRegistration {
  id: string;
  executorLockId: string;
  packId: string;
  executorId: string;
  kind: ExecutorLockEntry["kind"];
  adapter: string;
  module?: string;
  exportName?: string;
  capabilityIds: string[];
  matchedCapabilityIds: string[];
  validatorIds?: string[];
  produces?: string[];
  nodeIds: string[];
  traceSpanId: string;
}

export interface ToolSafetyLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  protocol: {
    name: "harness.tool-safety";
    defaultRule: string;
    concurrencyRule: string;
    permissionPipelineOrder: ToolPermissionLayer[];
  };
  summary: {
    callCount: number;
    readOnlyCallCount: number;
    mutatingCallCount: number;
    concurrentSafeCallCount: number;
    serialCallCount: number;
    protectedCallCount: number;
    deniedCallCount: number;
    unclassifiedCallCount: number;
  };
  calls: ToolCallClassification[];
  concurrencyPlan: ToolConcurrencySegment[];
  protectedPatterns: ToolProtectedPattern[];
  unresolved: Array<{
    callId: string;
    reason: string;
    evidence: string[];
  }>;
}

type ToolPermissionLayer = "policy" | "user-settings" | "project-rules" | "local-overrides" | "session-grants";

interface ToolCallClassification {
  id: string;
  subjectType: "gate" | "worker" | "executor";
  subjectId: string;
  functionId: string;
  routeId?: string;
  nodeIds: string[];
  adapter: string;
  requiredPermissions: string[];
  isReadOnly: boolean;
  mutatesWorkspace: boolean;
  isConcurrentSafe: boolean;
  concurrencyScope: "global-read" | "isolated-output" | "serial";
  classificationSource: "policy-gate" | "inferred-executor" | "runtime-gate";
  permissionPipeline: Array<{
    layer: ToolPermissionLayer;
    outcome: "allow" | "deny" | "defer";
    reason: string;
    evidence: string[];
  }>;
  protected: boolean;
  status: "allow" | "deny";
  evidence: string[];
}

interface ToolConcurrencySegment {
  id: string;
  mode: "parallel" | "serial";
  reason: string;
  callIds: string[];
}

interface ToolProtectedPattern {
  id: string;
  kind: "permission" | "adapter" | "operation";
  pattern: string;
  rule: string;
}

export interface HookLedger {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  rule: string;
  subscriptions: Array<{
    hookId: string;
    eventTopic: string;
    delivery: "local-ledger";
    required: boolean;
  }>;
  emissions: HookEmission[];
}

interface HookEmission {
  id: string;
  hookId: string;
  eventTopic: string;
  subjectId: string;
  functionId?: string;
  nodeId?: string;
  status: "recorded" | "planned";
  traceSpanId: string;
  evidence: string[];
}

export interface TraceContext {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  rootSpanId: string;
  propagationRule: string;
  spans: TraceSpan[];
}

export interface FunctionDispatchPlan {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  protocol: {
    name: "harness.function-dispatch";
    routingRule: string;
  };
  providerRoutes: ProviderRoute[];
  nodeDispatches: NodeDispatch[];
  unresolved: Array<{
    nodeId: string;
    lockId: string;
    reason: string;
  }>;
}

export interface ProviderReplacementRegistry {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  protocol: {
    name: "harness.provider-replacement";
    registrationRule: string;
    compatibilityRule: string;
    validationRule: string;
  };
  summary: {
    providerCount: number;
    workerProviderCount: number;
    executorProviderCount: number;
    replaceableProviderCount: number;
    replacementSlotCount: number;
    compatibilityKeyCount: number;
    unresolvedCount: number;
  };
  providers: ReplacementProvider[];
  replacementSlots: ReplacementSlot[];
  unresolved: ReplacementUnresolved[];
}

interface ReplacementProvider {
  id: string;
  providerType: "worker" | "executor";
  providerId: string;
  routeId?: string;
  subjectId: string;
  functionId: string;
  triggerId?: string;
  contractId?: string;
  packId: string;
  nodeIds: string[];
  capabilityIds: string[];
  adapter: {
    selected: string;
    allowed: string[];
    module?: string;
    exportName?: string;
    executionModel?: string;
  };
  replacementCompatibilityKey: string;
  replacementSlotId: string;
  gateArtifacts: string[];
  traceSpanId: string;
  status: "replaceable" | "unresolved";
  unresolvedReasons: string[];
  evidence: string[];
}

interface ReplacementSlot {
  id: string;
  compatibilityKey: string;
  providerTypes: Array<ReplacementProvider["providerType"]>;
  functionIds: string[];
  providerIds: string[];
  adapterTypes: string[];
  nodeIds: string[];
  evidence: string[];
}

interface ReplacementUnresolved {
  providerId: string;
  providerType: ReplacementProvider["providerType"];
  subjectId: string;
  reason: string;
  evidence: string[];
}

export interface RuntimeBus {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail";
  protocol: {
    name: "harness.runtime-bus";
    delivery: "local-ledger";
    registrationRule: string;
    publicationRule: string;
  };
  topics: RuntimeBusTopic[];
  subscribers: RuntimeBusSubscriber[];
  publications: RuntimeBusPublication[];
  stateNamespaces: RuntimeBusStateNamespace[];
  unresolved: RuntimeBusUnresolved[];
}

interface RuntimeBusTopic {
  id: string;
  name: string;
  kind: "lifecycle" | "worker-contract" | "executor-contract" | "gate" | "hook" | "trace";
  producerIds: string[];
  subscriberIds: string[];
  required: boolean;
  evidence: string[];
}

interface RuntimeBusSubscriber {
  id: string;
  subjectType: "worker" | "executor";
  subjectId: string;
  functionId: string;
  routeIds: string[];
  nodeIds: string[];
  stateNamespace: string;
  subscribesTo: string[];
  publishesTo: string[];
  traceSpanId: string;
  replacementCompatibilityKey?: string;
  evidence: string[];
}

interface RuntimeBusPublication {
  id: string;
  topic: string;
  producerType: "worker" | "executor" | "gate" | "hook" | "trace";
  producerId: string;
  functionId?: string;
  nodeId?: string;
  status: "recorded" | "declared" | "planned";
  traceSpanId: string;
  evidence: string[];
}

interface RuntimeBusStateNamespace {
  id: string;
  namespace: string;
  ownerIds: string[];
  artifact: string;
}

interface RuntimeBusUnresolved {
  subjectId: string;
  reason: string;
  evidence: string[];
}

export interface ProviderRoute {
  id: string;
  routeType: "worker" | "executor";
  subjectId: string;
  functionId: string;
  implementationId: string;
  adapter: string;
  module?: string;
  exportName?: string;
  packId: string;
  nodeIds: string[];
  capabilityIds: string[];
  executorKind?: ExecutorLockEntry["kind"];
  produces?: string[];
  validatorIds?: string[];
  gateArtifacts: string[];
  traceSpanId: string;
  replacementCompatibilityKey?: string;
}

export interface NodeDispatch {
  nodeId: string;
  title: string;
  kind?: string;
  status: "dispatchable" | "no_registered_function" | "no_dispatch_required";
  workerRouteIds: string[];
  executorRouteIds: string[];
  expectedLockIds: string[];
  missingLockIds: string[];
}

export interface StartupReadiness {
  schemaVersion: 1;
  id: string;
  runId: string;
  specId: string;
  status: "pass" | "fail" | "warning";
  rule: string;
  checklist: StartupReadinessCheck[];
  resumeArtifacts: string[];
}

interface StartupReadinessCheck {
  id: string;
  status: "pass" | "fail" | "warning";
  details: string;
  evidence: string[];
}

interface TraceSpan {
  id: string;
  parentSpanId?: string;
  kind: "run" | "plan" | "gate" | "hook" | "node" | "worker-function" | "executor-function" | "provider-replacement-registry" | "runtime-bus" | "tool-safety" | "context-budget";
  name: string;
  subjectId: string;
  functionId?: string;
  nodeId?: string;
  artifactId?: string;
  eventTopics: string[];
}

const TOOL_PERMISSION_PIPELINE: ToolPermissionLayer[] = ["policy", "user-settings", "project-rules", "local-overrides", "session-grants"];
const TOOL_PROTECTED_PATTERNS: ToolProtectedPattern[] = [
  {
    id: "protected-destructive-write",
    kind: "permission",
    pattern: "destructive-write",
    rule: "Destructive writes are never auto-concurrent and require an approval checkpoint.",
  },
  {
    id: "protected-source-of-truth-write",
    kind: "permission",
    pattern: "source-of-truth-write",
    rule: "Source-of-truth writes require explicit approval and cannot be hidden in provider dispatch.",
  },
  {
    id: "protected-external-side-effect",
    kind: "permission",
    pattern: "external-side-effect",
    rule: "External side effects require explicit approval before dispatch.",
  },
  {
    id: "protected-unknown-adapter",
    kind: "adapter",
    pattern: "not in allowed adapter list",
    rule: "Unknown adapters fail closed before runtime dispatch.",
  },
];

export async function writeRuntimeControlArtifacts(input: RuntimeControlInput): Promise<RuntimeControlArtifacts> {
  const registry = buildWorkerFunctionRegistry(input);
  const policyGate = buildPolicyGate(input);
  const budgetGate = buildBudgetGate(input);
  const approvalGate = buildApprovalGate(input, policyGate);
  const hookLedger = buildHookLedger(input, registry, policyGate, budgetGate, approvalGate);
  const dispatchPlan = buildFunctionDispatchPlan(input, registry);
  const providerReplacementRegistry = buildProviderReplacementRegistry(input, registry, dispatchPlan);
  const toolSafetyLedger = buildToolSafetyLedger(input, policyGate, approvalGate, dispatchPlan);
  const contextBudgetLedger = buildContextBudgetLedger(input, dispatchPlan);
  const runtimeBus = buildRuntimeBus(input, registry, hookLedger, dispatchPlan);
  const traceContext = buildTraceContext(input, registry, providerReplacementRegistry, policyGate, budgetGate, approvalGate, toolSafetyLedger, contextBudgetLedger, hookLedger, runtimeBus);
  const startupReadiness = buildStartupReadiness(input, registry, providerReplacementRegistry, policyGate, budgetGate, approvalGate, toolSafetyLedger, contextBudgetLedger, hookLedger, traceContext, dispatchPlan, runtimeBus);
  const artifacts = [
    WORKER_FUNCTION_REGISTRY_ARTIFACT,
    PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT,
    TOOL_SAFETY_LEDGER_ARTIFACT,
    CONTEXT_BUDGET_LEDGER_ARTIFACT,
    POLICY_GATE_ARTIFACT,
    BUDGET_GATE_ARTIFACT,
    APPROVAL_GATE_ARTIFACT,
    HOOK_LEDGER_ARTIFACT,
    RUNTIME_BUS_ARTIFACT,
    TRACE_CONTEXT_ARTIFACT,
    FUNCTION_DISPATCH_PLAN_ARTIFACT,
    STARTUP_READINESS_ARTIFACT,
  ];
  await writeJson(path.join(input.outputDir, WORKER_FUNCTION_REGISTRY_ARTIFACT), registry);
  await writeJson(path.join(input.outputDir, PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT), providerReplacementRegistry);
  await writeJson(path.join(input.outputDir, TOOL_SAFETY_LEDGER_ARTIFACT), toolSafetyLedger);
  await writeJson(path.join(input.outputDir, CONTEXT_BUDGET_LEDGER_ARTIFACT), contextBudgetLedger);
  await writeJson(path.join(input.outputDir, POLICY_GATE_ARTIFACT), policyGate);
  await writeJson(path.join(input.outputDir, BUDGET_GATE_ARTIFACT), budgetGate);
  await writeJson(path.join(input.outputDir, APPROVAL_GATE_ARTIFACT), approvalGate);
  await writeJson(path.join(input.outputDir, HOOK_LEDGER_ARTIFACT), hookLedger);
  await writeJson(path.join(input.outputDir, RUNTIME_BUS_ARTIFACT), runtimeBus);
  await writeJson(path.join(input.outputDir, TRACE_CONTEXT_ARTIFACT), traceContext);
  await writeJson(path.join(input.outputDir, FUNCTION_DISPATCH_PLAN_ARTIFACT), dispatchPlan);
  await writeJson(path.join(input.outputDir, STARTUP_READINESS_ARTIFACT), startupReadiness);
  const validations = buildRuntimeControlValidations(input.outputDir, registry, providerReplacementRegistry, policyGate, budgetGate, approvalGate, toolSafetyLedger, contextBudgetLedger, hookLedger, traceContext, dispatchPlan, runtimeBus, startupReadiness);
  return { artifacts, validations, registry, policyGate, budgetGate, approvalGate, toolSafetyLedger, contextBudgetLedger, hookLedger, traceContext, dispatchPlan, providerReplacementRegistry, runtimeBus, startupReadiness };
}

export function runtimeControlEvents(runId: string, control: RuntimeControlArtifacts): TraceEvent[] {
  return [
    {
      id: stableId("event", `${runId}:runtime.registry.created:${control.registry.id}`),
      runId,
      type: "runtime.registry.created",
      timestamp: new Date().toISOString(),
      artifactId: WORKER_FUNCTION_REGISTRY_ARTIFACT,
      status: control.validations.find((validation) => validation.id === "worker_function_registry_resolved")?.status,
      message: `Registered ${control.registry.workerFunctions.length} worker function(s) and ${control.registry.executorFunctions.length} executor function(s).`,
      evidence: [WORKER_FUNCTION_REGISTRY_ARTIFACT],
    },
    {
      id: stableId("event", `${runId}:runtime.provider_registry.created:${control.providerReplacementRegistry.id}`),
      runId,
      type: "runtime.provider_registry.created",
      timestamp: new Date().toISOString(),
      artifactId: PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT,
      status: control.validations.find((validation) => validation.id === "provider_replacement_registry_ready")?.status,
      message: `Registered ${control.providerReplacementRegistry.summary.providerCount} replaceable provider(s) across ${control.providerReplacementRegistry.summary.replacementSlotCount} compatibility slot(s).`,
      evidence: [PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT],
    },
    {
      id: stableId("event", `${runId}:runtime.tool_safety.classified:${control.toolSafetyLedger.id}`),
      runId,
      type: "runtime.tool_safety.classified",
      timestamp: new Date().toISOString(),
      artifactId: TOOL_SAFETY_LEDGER_ARTIFACT,
      status: control.validations.find((validation) => validation.id === "tool_safety_registry_ready")?.status,
      message: `Classified ${control.toolSafetyLedger.summary.callCount} tool/provider call(s); ${control.toolSafetyLedger.summary.serialCallCount} require serial dispatch.`,
      evidence: [TOOL_SAFETY_LEDGER_ARTIFACT],
    },
    {
      id: stableId("event", `${runId}:runtime.context_budget.recorded:${control.contextBudgetLedger.id}`),
      runId,
      type: "runtime.context_budget.recorded",
      timestamp: new Date().toISOString(),
      artifactId: CONTEXT_BUDGET_LEDGER_ARTIFACT,
      status: control.validations.find((validation) => validation.id === "context_budget_ready")?.status,
      message: `Recorded context budget with ${control.contextBudgetLedger.summary.estimatedTokenCount}/${control.contextBudgetLedger.summary.maxTokenBudget} estimated tokens and ${control.contextBudgetLedger.summary.isolationBoundaryCount} isolation boundary(ies).`,
      evidence: [CONTEXT_BUDGET_LEDGER_ARTIFACT],
    },
    ...control.validations.map((validation) => ({
      id: stableId("event", `${runId}:runtime.gate.checked:${validation.id}`),
      runId,
      type: "runtime.gate.checked" as const,
      timestamp: new Date().toISOString(),
      validatorId: validation.id,
      artifactId: validation.evidence?.[0] ? path.basename(validation.evidence[0]) : undefined,
      status: validation.status,
      message: validation.details,
      evidence: validation.evidence,
    })),
    {
      id: stableId("event", `${runId}:runtime.hook.recorded:${control.hookLedger.id}`),
      runId,
      type: "runtime.hook.recorded",
      timestamp: new Date().toISOString(),
      artifactId: HOOK_LEDGER_ARTIFACT,
      status: control.validations.find((validation) => validation.id === "hook_ledger_recorded")?.status,
      message: `Recorded ${control.hookLedger.emissions.length} runtime hook emission(s).`,
      evidence: [HOOK_LEDGER_ARTIFACT],
    },
    {
      id: stableId("event", `${runId}:runtime.bus.created:${control.runtimeBus.id}`),
      runId,
      type: "runtime.bus.created",
      timestamp: new Date().toISOString(),
      artifactId: RUNTIME_BUS_ARTIFACT,
      status: control.validations.find((validation) => validation.id === "runtime_bus_resolved")?.status,
      message: `Resolved runtime bus with ${control.runtimeBus.topics.length} topic(s), ${control.runtimeBus.subscribers.length} subscriber(s), and ${control.runtimeBus.publications.length} publication(s).`,
      evidence: [RUNTIME_BUS_ARTIFACT],
    },
    {
      id: stableId("event", `${runId}:runtime.trace_context.created:${control.traceContext.id}`),
      runId,
      type: "runtime.trace_context.created",
      timestamp: new Date().toISOString(),
      artifactId: TRACE_CONTEXT_ARTIFACT,
      status: control.validations.find((validation) => validation.id === "trace_context_propagated")?.status,
      message: `Created trace context with ${control.traceContext.spans.length} span(s).`,
      evidence: [TRACE_CONTEXT_ARTIFACT],
    },
    {
      id: stableId("event", `${runId}:runtime.dispatch_plan.created:${control.dispatchPlan.id}`),
      runId,
      type: "runtime.dispatch_plan.created",
      timestamp: new Date().toISOString(),
      artifactId: FUNCTION_DISPATCH_PLAN_ARTIFACT,
      status: control.validations.find((validation) => validation.id === "function_dispatch_plan_resolved")?.status,
      message: `Created dispatch plan with ${control.dispatchPlan.providerRoutes.length} provider route(s).`,
      evidence: [FUNCTION_DISPATCH_PLAN_ARTIFACT],
    },
    {
      id: stableId("event", `${runId}:runtime.startup_readiness.checked:${control.startupReadiness.id}`),
      runId,
      type: "runtime.startup_readiness.checked",
      timestamp: new Date().toISOString(),
      artifactId: STARTUP_READINESS_ARTIFACT,
      status: control.validations.find((validation) => validation.id === "startup_readiness_confirmed")?.status,
      message: `Startup readiness completed with status ${control.startupReadiness.status}.`,
      evidence: [STARTUP_READINESS_ARTIFACT],
    },
  ];
}

function buildWorkerFunctionRegistry(input: RuntimeControlInput): WorkerFunctionRegistry {
  const workerFunctions = input.workerLock.map((worker) => {
    const nodeIds = nodeIdsForWorker(input.runPlan, worker.id);
    return {
      id: stableId("worker-function", `${input.runId}:${worker.id}:${worker.functionId}`),
      workerLockId: worker.id,
      packId: worker.packId,
      workerBindingId: worker.workerBindingId,
      group: worker.group,
      contract: {
        id: worker.contractId,
        functionId: worker.functionId,
        triggerId: worker.triggerId,
        version: worker.contractVersion,
        stateNamespace: worker.stateNamespace,
        eventTopics: worker.eventTopics,
        replacementCompatibilityKey: worker.replacementCompatibilityKey,
      },
      adapter: {
        selected: worker.adapter,
        allowed: worker.adapterTypes,
        module: worker.module,
        exportName: worker.exportName,
        executionModel: worker.executionModel,
      },
      criticContract: worker.criticContract,
      agentIds: worker.agentIds,
      matchedAgentIds: worker.matchedAgentIds,
      capabilityIds: worker.capabilityIds,
      matchedCapabilityIds: worker.matchedCapabilityIds,
      nodeIds,
      traceSpanId: stableId("span", `${input.runId}:${worker.functionId}:${nodeIds.join("|")}`),
    };
  });
  const executorFunctions = input.executorLock.map((executor) => {
    const nodeIds = nodeIdsForExecutor(input.runPlan, executor.id);
    return {
      id: stableId("executor-function", `${input.runId}:${executor.id}:${executor.executorId}`),
      executorLockId: executor.id,
      packId: executor.packId,
      executorId: executor.executorId,
      kind: executor.kind,
      adapter: executor.adapter,
      module: executor.module,
      exportName: executor.exportName,
      capabilityIds: executor.capabilityIds,
      matchedCapabilityIds: executor.matchedCapabilityIds,
      validatorIds: executor.validatorIds,
      produces: executor.produces,
      nodeIds,
      traceSpanId: stableId("span", `${input.runId}:${executor.executorId}:${nodeIds.join("|")}`),
    };
  });
  return {
    schemaVersion: 1,
    id: stableId("worker-function-registry", `${input.runId}:${input.spec.id}:${workerFunctions.length}:${executorFunctions.length}`),
    runId: input.runId,
    specId: input.spec.id,
    protocol: {
      name: "harness.worker-function",
      dispatchRule: "Only functions present in this registry may be dispatched for this run; policy, approval, budget, hook, and trace-context gates must pass first.",
      traceContext: {
        runId: input.runId,
        eventLedger: "events.jsonl",
        traceArtifact: "harness-trace.json",
      },
    },
    workerFunctions,
    executorFunctions,
    eventTopics: unique(input.workerLock.flatMap((worker) => worker.eventTopics)),
    stateNamespaces: unique(input.workerLock.map((worker) => worker.stateNamespace)),
    replacementCompatibilityKeys: unique(input.workerLock.map((worker) => worker.replacementCompatibilityKey)),
  };
}

function buildToolSafetyLedger(input: RuntimeControlInput, policyGate: PolicyGate, approvalGate: ApprovalGate, dispatchPlan: FunctionDispatchPlan): ToolSafetyLedger {
  const policyBySubject = new Map(policyGate.decisions.map((decision) => [providerRouteKey(decision.subjectType, decision.subjectId, decision.functionId), decision]));
  const approvalBySubject = new Map(approvalGate.requests.map((request) => [providerRouteKey(request.subjectType, request.subjectId, request.functionId), request]));
  const gateCalls = buildGateToolCalls(input.runId, policyGate, approvalGate);
  const routeDrafts = dispatchPlan.providerRoutes.map((route) => {
    const policyDecision = policyBySubject.get(providerRouteKey(route.routeType, route.subjectId, route.functionId));
    const approvalRequest = approvalBySubject.get(providerRouteKey(route.routeType, route.subjectId, route.functionId));
    const requiredPermissions = policyDecision?.requiredPermissions ?? [];
    const outputKeys = routeOutputKeys(route);
    return {
      route,
      policyDecision,
      approvalRequest,
      requiredPermissions,
      outputKeys,
    };
  });
  const outputUseCounts = countOutputKeys(routeDrafts.flatMap((draft) => (draft.requiredPermissions.includes("filesystem-write") ? draft.outputKeys : [])));
  const routeCalls = routeDrafts.map((draft) => classifyProviderRoute(input.runId, draft.route, draft.policyDecision, draft.approvalRequest, draft.requiredPermissions, draft.outputKeys, outputUseCounts));
  const calls = [...gateCalls, ...routeCalls];
  const concurrencyPlan = buildToolConcurrencyPlan(input.runId, calls);
  const unresolved = calls.flatMap((call) => {
    const reasons = [
      call.status === "deny" ? "Permission pipeline denied this tool/provider call." : undefined,
      !call.classificationSource ? "Tool/provider call is missing an explicit safety classification." : undefined,
      call.mutatesWorkspace && call.isConcurrentSafe && call.concurrencyScope !== "isolated-output" ? "Mutating calls may only be concurrent when isolated output evidence exists." : undefined,
    ].filter((reason): reason is string => Boolean(reason));
    return reasons.map((reason) => ({
      callId: call.id,
      reason,
      evidence: call.evidence,
    }));
  });
  return {
    schemaVersion: 1,
    id: stableId("tool-safety-ledger", `${input.runId}:${calls.map((call) => `${call.subjectId}:${call.status}:${call.isConcurrentSafe}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status: unresolved.length ? "fail" : "pass",
    protocol: {
      name: "harness.tool-safety",
      defaultRule: "Tool and provider calls default to non-read-only and non-concurrent-safe until classified by runtime policy evidence.",
      concurrencyRule: "Read-only calls may run in parallel; mutating calls may run in parallel only when isolated output or state evidence proves they cannot race; protected calls stay serial.",
      permissionPipelineOrder: TOOL_PERMISSION_PIPELINE,
    },
    summary: {
      callCount: calls.length,
      readOnlyCallCount: calls.filter((call) => call.isReadOnly).length,
      mutatingCallCount: calls.filter((call) => call.mutatesWorkspace).length,
      concurrentSafeCallCount: calls.filter((call) => call.isConcurrentSafe).length,
      serialCallCount: calls.filter((call) => !call.isConcurrentSafe).length,
      protectedCallCount: calls.filter((call) => call.protected).length,
      deniedCallCount: calls.filter((call) => call.status === "deny").length,
      unclassifiedCallCount: calls.filter((call) => !call.classificationSource).length,
    },
    calls,
    concurrencyPlan,
    protectedPatterns: TOOL_PROTECTED_PATTERNS,
    unresolved,
  };
}

function buildGateToolCalls(runId: string, policyGate: PolicyGate, approvalGate: ApprovalGate): ToolCallClassification[] {
  return [
    gateToolCall({
      runId,
      subjectId: "policy-gate",
      functionId: "policy.check",
      artifact: POLICY_GATE_ARTIFACT,
      traceSpanId: spanId(runId, "gate", "policy"),
      readOnly: true,
      status: policyGate.status === "pass" ? "allow" : "deny",
      reason: `${policyGate.decisions.length} policy decision(s) evaluated.`,
    }),
    gateToolCall({
      runId,
      subjectId: "budget-gate",
      functionId: "budget.check",
      artifact: BUDGET_GATE_ARTIFACT,
      traceSpanId: spanId(runId, "gate", "budget"),
      readOnly: true,
      status: "allow",
      reason: "Budget gate reads deterministic local allocations before dispatch.",
    }),
    gateToolCall({
      runId,
      subjectId: "approval-gate",
      functionId: "approval.resolve",
      artifact: APPROVAL_GATE_ARTIFACT,
      traceSpanId: spanId(runId, "gate", "approval"),
      readOnly: approvalGate.requiredRequestCount === 0,
      status: approvalGate.status === "pass" ? "allow" : "deny",
      reason:
        approvalGate.requiredRequestCount === 0
          ? "No approval state mutation is needed for this run."
          : `Approval gate resolved ${approvalGate.resolvedRequestCount}/${approvalGate.requiredRequestCount} request(s).`,
    }),
  ];
}

function gateToolCall(input: {
  runId: string;
  subjectId: string;
  functionId: string;
  artifact: string;
  traceSpanId: string;
  readOnly: boolean;
  status: "allow" | "deny";
  reason: string;
}): ToolCallClassification {
  return {
    id: stableId("tool-call", `${input.runId}:gate:${input.subjectId}:${input.functionId}`),
    subjectType: "gate",
    subjectId: input.subjectId,
    functionId: input.functionId,
    nodeIds: [],
    adapter: "local:ledger",
    requiredPermissions: [],
    isReadOnly: input.readOnly,
    mutatesWorkspace: !input.readOnly,
    isConcurrentSafe: input.readOnly,
    concurrencyScope: input.readOnly ? "global-read" : "serial",
    classificationSource: "runtime-gate",
    permissionPipeline: [
      { layer: "policy", outcome: input.status, reason: input.reason, evidence: [input.artifact] },
      { layer: "user-settings", outcome: "defer", reason: "No user setting override is attached to this generated run.", evidence: [] },
      { layer: "project-rules", outcome: "allow", reason: "Runtime-control gates are generated by the project harness.", evidence: [input.artifact] },
      { layer: "local-overrides", outcome: "defer", reason: "No local override is attached to this generated run.", evidence: [] },
      { layer: "session-grants", outcome: input.status, reason: input.status === "allow" ? "No interactive grant is required." : "Gate did not pass.", evidence: [input.artifact] },
    ],
    protected: !input.readOnly,
    status: input.status,
    evidence: [input.artifact, input.traceSpanId],
  };
}

function classifyProviderRoute(
  runId: string,
  route: ProviderRoute,
  policyDecision: PolicyDecision | undefined,
  approvalRequest: ApprovalRequest | undefined,
  requiredPermissions: string[],
  outputKeys: string[],
  outputUseCounts: Map<string, number>,
): ToolCallClassification {
  const isReadOnly = requiredPermissions.length > 0 && requiredPermissions.every((permission) => permission === "filesystem-read");
  const mutatesWorkspace = requiredPermissions.some((permission) => permission.includes("write") || permission === "external-side-effect" || permission === "human-review");
  const protectedCall = requiredPermissions.some((permission) => SENSITIVE_PERMISSIONS.has(permission)) || !ALLOWED_ADAPTERS.includes(route.adapter);
  const hasIsolatedOutputs = outputKeys.length > 0 && outputKeys.every((key) => (outputUseCounts.get(key) ?? 0) === 1);
  const isConcurrentSafe = isReadOnly || (mutatesWorkspace && hasIsolatedOutputs && !protectedCall);
  const status = policyDecision?.status === "allow" && (!approvalRequest || approvalRequest.status === "resolved" || approvalRequest.status === "not_required") ? "allow" : "deny";
  return {
    id: stableId("tool-call", `${runId}:${route.routeType}:${route.subjectId}:${route.functionId}`),
    subjectType: route.routeType,
    subjectId: route.subjectId,
    functionId: route.functionId,
    routeId: route.id,
    nodeIds: route.nodeIds,
    adapter: route.adapter,
    requiredPermissions,
    isReadOnly,
    mutatesWorkspace,
    isConcurrentSafe,
    concurrencyScope: isReadOnly ? "global-read" : isConcurrentSafe ? "isolated-output" : "serial",
    classificationSource: route.routeType === "worker" ? "policy-gate" : "inferred-executor",
    permissionPipeline: buildToolPermissionPipeline(route, policyDecision, approvalRequest),
    protected: protectedCall,
    status,
    evidence: unique([TOOL_SAFETY_LEDGER_ARTIFACT, FUNCTION_DISPATCH_PLAN_ARTIFACT, POLICY_GATE_ARTIFACT, APPROVAL_GATE_ARTIFACT, ...route.gateArtifacts, ...outputKeys]),
  };
}

function buildToolPermissionPipeline(route: ProviderRoute, policyDecision: PolicyDecision | undefined, approvalRequest: ApprovalRequest | undefined): ToolCallClassification["permissionPipeline"] {
  const policyOutcome = policyDecision?.status ?? "deny";
  const sessionOutcome = approvalRequest ? (approvalRequest.status === "resolved" || approvalRequest.status === "not_required" ? "allow" : "deny") : "allow";
  return [
    {
      layer: "policy",
      outcome: policyOutcome,
      reason: policyDecision?.reasons.join(" ") ?? "No policy decision exists for this route.",
      evidence: [POLICY_GATE_ARTIFACT],
    },
    {
      layer: "user-settings",
      outcome: "defer",
      reason: "No user-setting override is attached to this generated run.",
      evidence: [],
    },
    {
      layer: "project-rules",
      outcome: route.gateArtifacts.includes(TOOL_SAFETY_LEDGER_ARTIFACT) ? "allow" : "deny",
      reason: route.gateArtifacts.includes(TOOL_SAFETY_LEDGER_ARTIFACT) ? "Dispatch route requires the tool-safety ledger gate." : "Dispatch route does not include the tool-safety ledger gate.",
      evidence: [FUNCTION_DISPATCH_PLAN_ARTIFACT],
    },
    {
      layer: "local-overrides",
      outcome: "defer",
      reason: "No local override is attached to this generated run.",
      evidence: [],
    },
    {
      layer: "session-grants",
      outcome: sessionOutcome,
      reason: approvalRequest
        ? approvalRequest.status === "resolved" || approvalRequest.status === "not_required"
          ? "Required approval is resolved."
          : "Required approval remains pending."
        : "No session grant is required.",
      evidence: approvalRequest ? [APPROVAL_GATE_ARTIFACT] : [],
    },
  ];
}

function routeOutputKeys(route: ProviderRoute): string[] {
  if (route.routeType === "worker") {
    return route.nodeIds.length ? route.nodeIds.map((nodeId) => `worker-node:${nodeId}:${route.subjectId}`) : [`worker:${route.subjectId}`];
  }
  if (route.executorKind === "validator") {
    return (route.validatorIds ?? []).map((validatorId) => `validator:${validatorId}`);
  }
  return (route.produces ?? []).map((artifact) => `artifact:${artifact}`);
}

function countOutputKeys(keys: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function buildToolConcurrencyPlan(runId: string, calls: ToolCallClassification[]): ToolConcurrencySegment[] {
  const parallelCalls = calls.filter((call) => call.isConcurrentSafe).map((call) => call.id);
  const serialCalls = calls.filter((call) => !call.isConcurrentSafe);
  return [
    ...(parallelCalls.length
      ? [
          {
            id: stableId("tool-concurrency-segment", `${runId}:parallel:${parallelCalls.join("|")}`),
            mode: "parallel" as const,
            reason: "Read-only and isolated-output calls may run together.",
            callIds: parallelCalls,
          },
        ]
      : []),
    ...serialCalls.map((call) => ({
      id: stableId("tool-concurrency-segment", `${runId}:serial:${call.id}`),
      mode: "serial" as const,
      reason: call.protected ? "Protected or approval-sensitive calls remain serial." : "Call lacks isolated-output evidence and therefore stays serial by default.",
      callIds: [call.id],
    })),
  ];
}

function buildHookLedger(input: RuntimeControlInput, registry: WorkerFunctionRegistry, policyGate: PolicyGate, budgetGate: BudgetGate, approvalGate: ApprovalGate): HookLedger {
  const gateEmissions: HookEmission[] = [
    hookEmission(input.runId, "runtime.policy.checked", "policy-gate", "policy.check", POLICY_GATE_ARTIFACT, spanId(input.runId, "gate", "policy")),
    hookEmission(input.runId, "runtime.budget.checked", "budget-gate", "budget.check", BUDGET_GATE_ARTIFACT, spanId(input.runId, "gate", "budget")),
    hookEmission(input.runId, "runtime.approval.checked", "approval-gate", "approval.resolve", APPROVAL_GATE_ARTIFACT, spanId(input.runId, "gate", "approval")),
  ];
  const dispatchEmissions: HookEmission[] = [
    ...registry.workerFunctions.map((worker) => ({
      id: stableId("hook-emission", `${input.runId}:runtime.before_worker_dispatch:${worker.workerBindingId}:${worker.contract.functionId}`),
      hookId: "runtime.before_worker_dispatch",
      eventTopic: "runtime.before_worker_dispatch",
      subjectId: worker.workerBindingId,
      functionId: worker.contract.functionId,
      nodeId: worker.nodeIds[0],
      status: "planned" as const,
      traceSpanId: worker.traceSpanId,
      evidence: [WORKER_FUNCTION_REGISTRY_ARTIFACT],
    })),
    ...registry.executorFunctions.map((executor) => ({
      id: stableId("hook-emission", `${input.runId}:runtime.before_executor_dispatch:${executor.executorId}:${executor.kind}`),
      hookId: "runtime.before_executor_dispatch",
      eventTopic: "runtime.before_executor_dispatch",
      subjectId: executor.executorId,
      functionId: `${executor.kind}.${executor.executorId}`,
      nodeId: executor.nodeIds[0],
      status: "planned" as const,
      traceSpanId: executor.traceSpanId,
      evidence: [WORKER_FUNCTION_REGISTRY_ARTIFACT],
    })),
  ];
  const emissions = [...gateEmissions, ...dispatchEmissions];
  const requiredFunctionEmissions = registry.workerFunctions.length + registry.executorFunctions.length + 3;
  return {
    schemaVersion: 1,
    id: stableId("hook-ledger", `${input.runId}:${emissions.length}:${policyGate.status}:${budgetGate.status}:${approvalGate.status}`),
    runId: input.runId,
    specId: input.spec.id,
    status: emissions.length >= requiredFunctionEmissions ? "pass" : "fail",
    rule: "Every gate and dispatchable function emits a local hook record before the run is summarized.",
    subscriptions: [
      { hookId: "runtime.policy.checked", eventTopic: "runtime.policy.checked", delivery: "local-ledger", required: true },
      { hookId: "runtime.budget.checked", eventTopic: "runtime.budget.checked", delivery: "local-ledger", required: true },
      { hookId: "runtime.approval.checked", eventTopic: "runtime.approval.checked", delivery: "local-ledger", required: true },
      { hookId: "runtime.before_worker_dispatch", eventTopic: "runtime.before_worker_dispatch", delivery: "local-ledger", required: true },
      { hookId: "runtime.before_executor_dispatch", eventTopic: "runtime.before_executor_dispatch", delivery: "local-ledger", required: true },
    ],
    emissions,
  };
}

function buildRuntimeBus(input: RuntimeControlInput, registry: WorkerFunctionRegistry, hookLedger: HookLedger, dispatchPlan: FunctionDispatchPlan): RuntimeBus {
  const routesBySubject = new Map<string, ProviderRoute[]>();
  for (const route of dispatchPlan.providerRoutes) {
    routesBySubject.set(route.subjectId, [...(routesBySubject.get(route.subjectId) ?? []), route]);
  }
  const workerSubscribers: RuntimeBusSubscriber[] = registry.workerFunctions.map((worker) => {
    const routeIds = (routesBySubject.get(worker.workerBindingId) ?? []).map((route) => route.id);
    return {
      id: stableId("bus-subscriber", `${input.runId}:worker:${worker.workerBindingId}`),
      subjectType: "worker",
      subjectId: worker.workerBindingId,
      functionId: worker.contract.functionId,
      routeIds,
      nodeIds: worker.nodeIds,
      stateNamespace: worker.contract.stateNamespace,
      subscribesTo: unique(["workflow.run.started", "runtime.before_worker_dispatch", ...worker.contract.eventTopics]),
      publishesTo: unique([...worker.contract.eventTopics, "workflow.agent.completed"]),
      traceSpanId: worker.traceSpanId,
      replacementCompatibilityKey: worker.contract.replacementCompatibilityKey,
      evidence: [WORKER_FUNCTION_REGISTRY_ARTIFACT, FUNCTION_DISPATCH_PLAN_ARTIFACT],
    };
  });
  const executorSubscribers: RuntimeBusSubscriber[] = registry.executorFunctions.map((executor) => {
    const routeIds = (routesBySubject.get(executor.executorId) ?? []).map((route) => route.id);
    return {
      id: stableId("bus-subscriber", `${input.runId}:executor:${executor.executorId}`),
      subjectType: "executor",
      subjectId: executor.executorId,
      functionId: `${executor.kind}.${executor.executorId}`,
      routeIds,
      nodeIds: executor.nodeIds,
      stateNamespace: `executor.${executor.kind}`,
      subscribesTo: ["runtime.before_executor_dispatch"],
      publishesTo: executorBusTopics(executor),
      traceSpanId: executor.traceSpanId,
      evidence: [WORKER_FUNCTION_REGISTRY_ARTIFACT, FUNCTION_DISPATCH_PLAN_ARTIFACT],
    };
  });
  const subscribers = [...workerSubscribers, ...executorSubscribers];
  const hookPublications = hookLedger.emissions.map((emission) =>
    busPublication({
      runId: input.runId,
      topic: emission.eventTopic,
      producerType: emission.eventTopic.includes("before_") ? "hook" : "gate",
      producerId: emission.subjectId,
      functionId: emission.functionId,
      nodeId: emission.nodeId,
      status: emission.status,
      traceSpanId: emission.traceSpanId,
      evidence: emission.evidence,
    }),
  );
  const workerPublications = registry.workerFunctions.flatMap((worker) =>
    worker.contract.eventTopics.map((topic) =>
      busPublication({
        runId: input.runId,
        topic,
        producerType: "worker",
        producerId: worker.workerBindingId,
        functionId: worker.contract.functionId,
        nodeId: worker.nodeIds[0],
        status: "declared",
        traceSpanId: worker.traceSpanId,
        evidence: [WORKER_FUNCTION_REGISTRY_ARTIFACT],
      }),
    ),
  );
  const executorPublications = registry.executorFunctions.flatMap((executor) =>
    executorBusTopics(executor).map((topic) =>
      busPublication({
        runId: input.runId,
        topic,
        producerType: "executor",
        producerId: executor.executorId,
        functionId: `${executor.kind}.${executor.executorId}`,
        nodeId: executor.nodeIds[0],
        status: "planned",
        traceSpanId: executor.traceSpanId,
        evidence: [WORKER_FUNCTION_REGISTRY_ARTIFACT],
      }),
    ),
  );
  const tracePublication = busPublication({
    runId: input.runId,
    topic: "runtime.trace_context.created",
    producerType: "trace",
    producerId: TRACE_CONTEXT_ARTIFACT,
    status: "planned",
    traceSpanId: spanId(input.runId, "trace", "context"),
    evidence: [TRACE_CONTEXT_ARTIFACT],
  });
  const publications = [...hookPublications, ...workerPublications, ...executorPublications, tracePublication];
  const topicNames = unique([
    "workflow.run.started",
    "workflow.run.completed",
    ...subscribers.flatMap((subscriber) => [...subscriber.subscribesTo, ...subscriber.publishesTo]),
    ...publications.map((publication) => publication.topic),
  ]);
  const topics = topicNames.map((topic) => {
    const topicPublications = publications.filter((publication) => publication.topic === topic);
    const topicSubscribers = subscribers.filter((subscriber) => subscriber.subscribesTo.includes(topic));
    return {
      id: stableId("bus-topic", `${input.runId}:${topic}`),
      name: topic,
      kind: runtimeTopicKind(topic),
      producerIds: unique(topicPublications.map((publication) => publication.producerId)),
      subscriberIds: unique(topicSubscribers.map((subscriber) => subscriber.id)),
      required: topic.startsWith("runtime.") || topic.startsWith("workflow."),
      evidence: unique([...topicPublications.flatMap((publication) => publication.evidence), ...topicSubscribers.flatMap((subscriber) => subscriber.evidence)]),
    };
  });
  const stateNamespaces = unique(subscribers.map((subscriber) => subscriber.stateNamespace)).map((namespace) => ({
    id: stableId("bus-state-namespace", `${input.runId}:${namespace}`),
    namespace,
    ownerIds: subscribers.filter((subscriber) => subscriber.stateNamespace === namespace).map((subscriber) => subscriber.subjectId),
    artifact: RUNTIME_BUS_ARTIFACT,
  }));
  const unresolved: RuntimeBusUnresolved[] = [
    ...subscribers
      .filter((subscriber) => subscriber.routeIds.length === 0)
      .map((subscriber) => ({
        subjectId: subscriber.subjectId,
        reason: "Subscriber has no provider route in the function dispatch plan.",
        evidence: [FUNCTION_DISPATCH_PLAN_ARTIFACT],
      })),
    ...subscribers
      .filter((subscriber) => subscriber.subscribesTo.length === 0 || subscriber.publishesTo.length === 0 || !subscriber.stateNamespace)
      .map((subscriber) => ({
        subjectId: subscriber.subjectId,
        reason: "Subscriber is missing a topic or state namespace contract.",
        evidence: [WORKER_FUNCTION_REGISTRY_ARTIFACT],
      })),
    ...dispatchPlan.providerRoutes
      .filter((route) => !subscribers.some((subscriber) => subscriber.subjectId === route.subjectId))
      .map((route) => ({
        subjectId: route.subjectId,
        reason: "Provider route has no runtime bus subscriber.",
        evidence: [FUNCTION_DISPATCH_PLAN_ARTIFACT],
      })),
    ...(dispatchPlan.status === "pass"
      ? []
      : [
          {
            subjectId: dispatchPlan.id,
            reason: "Runtime bus cannot pass while provider dispatch has unresolved routes.",
            evidence: [FUNCTION_DISPATCH_PLAN_ARTIFACT],
          },
        ]),
  ];
  return {
    schemaVersion: 1,
    id: stableId("runtime-bus", `${input.runId}:${topicNames.join("|")}:${subscribers.length}:${publications.length}`),
    runId: input.runId,
    specId: input.spec.id,
    status: unresolved.length || subscribers.length === 0 || topics.length === 0 ? "fail" : "pass",
    protocol: {
      name: "harness.runtime-bus",
      delivery: "local-ledger",
      registrationRule: "Every dispatchable worker or executor must register bus topics, state namespace ownership, provider routes, and trace spans before execution is accepted.",
      publicationRule: "Gate, hook, worker, executor, and trace events must publish to named topics so runtime decisions can be replayed from artifacts.",
    },
    topics,
    subscribers,
    publications,
    stateNamespaces,
    unresolved,
  };
}

function buildTraceContext(
  input: RuntimeControlInput,
  registry: WorkerFunctionRegistry,
  providerReplacementRegistry: ProviderReplacementRegistry,
  policyGate: PolicyGate,
  budgetGate: BudgetGate,
  approvalGate: ApprovalGate,
  toolSafetyLedger: ToolSafetyLedger,
  contextBudgetLedger: ContextBudgetLedger,
  hookLedger: HookLedger,
  runtimeBus: RuntimeBus,
): TraceContext {
  const rootSpanId = spanId(input.runId, "run", input.spec.id);
  const planSpanId = spanId(input.runId, "plan", input.runPlan.id);
  const gateParentSpanId = spanId(input.runId, "gate", "runtime-control");
  const nodeSpans = input.runPlan.nodes.map((node) => ({
    id: spanId(input.runId, "node", node.id),
    parentSpanId: planSpanId,
    kind: "node" as const,
    name: node.title,
    subjectId: node.id,
    nodeId: node.id,
    eventTopics: [],
  }));
  const workerSpans = registry.workerFunctions.map((worker) => ({
    id: worker.traceSpanId,
    parentSpanId: firstNodeSpanId(input.runId, worker.nodeIds) ?? planSpanId,
    kind: "worker-function" as const,
    name: worker.workerBindingId,
    subjectId: worker.workerBindingId,
    functionId: worker.contract.functionId,
    nodeId: worker.nodeIds[0],
    artifactId: WORKER_FUNCTION_REGISTRY_ARTIFACT,
    eventTopics: worker.contract.eventTopics,
  }));
  const executorSpans = registry.executorFunctions.map((executor) => ({
    id: executor.traceSpanId,
    parentSpanId: firstNodeSpanId(input.runId, executor.nodeIds) ?? planSpanId,
    kind: "executor-function" as const,
    name: executor.executorId,
    subjectId: executor.executorId,
    functionId: `${executor.kind}.${executor.executorId}`,
    nodeId: executor.nodeIds[0],
    artifactId: WORKER_FUNCTION_REGISTRY_ARTIFACT,
    eventTopics: [],
  }));
  const gateSpans = [
    gateSpan(input.runId, gateParentSpanId, "policy-gate", "policy.check", POLICY_GATE_ARTIFACT, policyGate.status),
    gateSpan(input.runId, gateParentSpanId, "budget-gate", "budget.check", BUDGET_GATE_ARTIFACT, budgetGate.status),
    gateSpan(input.runId, gateParentSpanId, "approval-gate", "approval.resolve", APPROVAL_GATE_ARTIFACT, approvalGate.status),
  ];
  const toolSafetySpan = {
    id: spanId(input.runId, "tool-safety", toolSafetyLedger.id),
    parentSpanId: gateParentSpanId,
    kind: "tool-safety" as const,
    name: "Tool safety ledger",
    subjectId: toolSafetyLedger.id,
    artifactId: TOOL_SAFETY_LEDGER_ARTIFACT,
    eventTopics: ["runtime.tool_safety.classified"],
  };
  const contextBudgetSpan = {
    id: spanId(input.runId, "context-budget", contextBudgetLedger.id),
    parentSpanId: gateParentSpanId,
    kind: "context-budget" as const,
    name: "Context budget ledger",
    subjectId: contextBudgetLedger.id,
    artifactId: CONTEXT_BUDGET_LEDGER_ARTIFACT,
    eventTopics: ["runtime.context_budget.recorded"],
  };
  const providerReplacementSpan = {
    id: spanId(input.runId, "provider-replacement", providerReplacementRegistry.id),
    parentSpanId: gateParentSpanId,
    kind: "provider-replacement-registry" as const,
    name: "Provider replacement registry",
    subjectId: providerReplacementRegistry.id,
    artifactId: PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT,
    eventTopics: ["runtime.provider_registry.created"],
  };
  const hookSpan = {
    id: spanId(input.runId, "hook", hookLedger.id),
    parentSpanId: gateParentSpanId,
    kind: "hook" as const,
    name: "Runtime hook ledger",
    subjectId: hookLedger.id,
    artifactId: HOOK_LEDGER_ARTIFACT,
    eventTopics: hookLedger.subscriptions.map((subscription) => subscription.eventTopic),
  };
  const busSpan = {
    id: spanId(input.runId, "bus", runtimeBus.id),
    parentSpanId: rootSpanId,
    kind: "runtime-bus" as const,
    name: "Runtime bus",
    subjectId: runtimeBus.id,
    artifactId: RUNTIME_BUS_ARTIFACT,
    eventTopics: runtimeBus.topics.map((topic) => topic.name),
  };
  return {
    schemaVersion: 1,
    id: stableId("trace-context", `${input.runId}:${rootSpanId}:${registry.workerFunctions.length}:${registry.executorFunctions.length}:${providerReplacementRegistry.summary.replacementSlotCount}`),
    runId: input.runId,
    specId: input.spec.id,
    rootSpanId,
    propagationRule: "Every node, worker function, executor function, provider replacement slot, gate, and hook record receives a deterministic span with a parent span inside this run.",
    spans: [
      {
        id: rootSpanId,
        kind: "run",
        name: input.spec.name,
        subjectId: input.spec.id,
        eventTopics: ["run.started", "run.completed"],
      },
      {
        id: planSpanId,
        parentSpanId: rootSpanId,
        kind: "plan",
        name: "Run plan",
        subjectId: input.runPlan.id,
        artifactId: "run-plan.json",
        eventTopics: ["run.plan.created"],
      },
      {
        id: gateParentSpanId,
        parentSpanId: rootSpanId,
        kind: "gate",
        name: "Runtime control gates",
        subjectId: "runtime-control",
        eventTopics: ["runtime.gate.checked"],
      },
      busSpan,
      ...gateSpans,
      toolSafetySpan,
      contextBudgetSpan,
      providerReplacementSpan,
      hookSpan,
      ...nodeSpans,
      ...workerSpans,
      ...executorSpans,
    ],
  };
}

function buildFunctionDispatchPlan(input: RuntimeControlInput, registry: WorkerFunctionRegistry): FunctionDispatchPlan {
  const workerRoutes: ProviderRoute[] = registry.workerFunctions.map((worker) => ({
    id: stableId("provider-route", `${input.runId}:worker:${worker.workerLockId}:${worker.contract.functionId}`),
    routeType: "worker",
    subjectId: worker.workerBindingId,
    functionId: worker.contract.functionId,
    implementationId: stableId("implementation", `${worker.adapter.selected}:${worker.adapter.module ?? ""}:${worker.adapter.exportName ?? ""}:${worker.contract.functionId}`),
    adapter: worker.adapter.selected,
    module: worker.adapter.module,
    exportName: worker.adapter.exportName,
    packId: worker.packId,
    nodeIds: worker.nodeIds,
    capabilityIds: worker.matchedCapabilityIds,
    gateArtifacts: [
      PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT,
      TOOL_SAFETY_LEDGER_ARTIFACT,
      POLICY_GATE_ARTIFACT,
      APPROVAL_GATE_ARTIFACT,
      BUDGET_GATE_ARTIFACT,
      HOOK_LEDGER_ARTIFACT,
      RUNTIME_BUS_ARTIFACT,
      TRACE_CONTEXT_ARTIFACT,
    ],
    traceSpanId: worker.traceSpanId,
    replacementCompatibilityKey: worker.contract.replacementCompatibilityKey,
  }));
  const executorRoutes: ProviderRoute[] = registry.executorFunctions.map((executor) => ({
    id: stableId("provider-route", `${input.runId}:executor:${executor.executorLockId}:${executor.executorId}`),
    routeType: "executor",
    subjectId: executor.executorId,
    functionId: `${executor.kind}.${executor.executorId}`,
    implementationId: stableId("implementation", `${executor.adapter}:${executor.module ?? ""}:${executor.exportName ?? ""}:${executor.kind}:${executor.executorId}`),
    adapter: executor.adapter,
    module: executor.module,
    exportName: executor.exportName,
    packId: executor.packId,
    nodeIds: executor.nodeIds,
    capabilityIds: executor.matchedCapabilityIds,
    executorKind: executor.kind,
    produces: executor.produces,
    validatorIds: executor.validatorIds,
    gateArtifacts: [
      PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT,
      TOOL_SAFETY_LEDGER_ARTIFACT,
      POLICY_GATE_ARTIFACT,
      APPROVAL_GATE_ARTIFACT,
      BUDGET_GATE_ARTIFACT,
      HOOK_LEDGER_ARTIFACT,
      RUNTIME_BUS_ARTIFACT,
      TRACE_CONTEXT_ARTIFACT,
    ],
    traceSpanId: executor.traceSpanId,
  }));
  const providerRoutes = [...workerRoutes, ...executorRoutes];
  const routeByWorkerLockId = new Map(registry.workerFunctions.map((worker, index) => [worker.workerLockId, workerRoutes[index]?.id]));
  const routeByExecutorLockId = new Map(registry.executorFunctions.map((executor, index) => [executor.executorLockId, executorRoutes[index]?.id]));
  const specNodeById = new Map(input.spec.graph.map((node) => [node.id, node]));
  const nodeDispatches = input.runPlan.nodes.map((node) => {
    const workerRouteIds = node.workerLockIds.map((lockId) => routeByWorkerLockId.get(lockId)).filter((routeId): routeId is string => Boolean(routeId));
    const executorRouteIds = node.executorLockIds.map((lockId) => routeByExecutorLockId.get(lockId)).filter((routeId): routeId is string => Boolean(routeId));
    const expectedLockIds = [...node.workerLockIds, ...node.executorLockIds];
    const resolvedLockIds = [
      ...node.workerLockIds.filter((lockId) => routeByWorkerLockId.has(lockId)),
      ...node.executorLockIds.filter((lockId) => routeByExecutorLockId.has(lockId)),
    ];
    const missingLockIds = expectedLockIds.filter((lockId) => !resolvedLockIds.includes(lockId));
    const intrinsic = specNodeById.has(node.id) && isIntrinsicRuntimeNode(specNodeById.get(node.id) as HarnessSpec["graph"][number]);
    const status: NodeDispatch["status"] = expectedLockIds.length === 0
      ? intrinsic
        ? "no_dispatch_required"
        : "no_registered_function"
      : missingLockIds.length
        ? "no_registered_function"
        : "dispatchable";
    return {
      nodeId: node.id,
      title: node.title,
      kind: node.kind,
      status,
      workerRouteIds,
      executorRouteIds,
      expectedLockIds,
      missingLockIds,
    };
  });
  const unresolved = nodeDispatches.flatMap((node) => {
    const missingLocks = node.missingLockIds.map((lockId) => ({ nodeId: node.nodeId, lockId, reason: "No provider route resolved for locked function." }));
    return node.status === "no_registered_function" && node.expectedLockIds.length === 0
      ? [...missingLocks, { nodeId: node.nodeId, lockId: "required-execution-route", reason: "Required executable node has no worker or executor route." }]
      : missingLocks;
  });
  return {
    schemaVersion: 1,
    id: stableId("function-dispatch-plan", `${input.runId}:${providerRoutes.map((route) => route.id).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status: unresolved.length ? "fail" : "pass",
    protocol: {
      name: "harness.function-dispatch",
      routingRule: "Graph nodes dispatch only through provider routes resolved from locked worker and executor functions.",
    },
    providerRoutes,
    nodeDispatches,
    unresolved,
  };
}

function buildProviderReplacementRegistry(input: RuntimeControlInput, registry: WorkerFunctionRegistry, dispatchPlan: FunctionDispatchPlan): ProviderReplacementRegistry {
  const routesByKey = new Map(dispatchPlan.providerRoutes.map((route) => [providerRouteKey(route.routeType, route.subjectId, route.functionId), route]));
  const workerProviders: ReplacementProvider[] = registry.workerFunctions.map((worker) => {
    const route = routesByKey.get(providerRouteKey("worker", worker.workerBindingId, worker.contract.functionId));
    const compatibilityKey = worker.contract.replacementCompatibilityKey;
    const unresolvedReasons = [
      !worker.contract.id ? "Worker provider is missing a stable contract id." : undefined,
      !worker.contract.functionId ? "Worker provider is missing a stable function id." : undefined,
      !worker.contract.triggerId ? "Worker provider is missing a stable trigger id." : undefined,
      !compatibilityKey ? "Worker provider is missing a replacement compatibility key." : undefined,
      worker.adapter.allowed.length === 0 ? "Worker provider is missing allowed adapter types." : undefined,
      !route ? "Worker provider is missing a dispatch route." : undefined,
      route && !route.gateArtifacts.includes(PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT) ? "Worker dispatch route does not require the provider replacement registry gate." : undefined,
    ].filter((reason): reason is string => Boolean(reason));
    return {
      id: stableId("replacement-provider", `${input.runId}:worker:${worker.workerLockId}:${compatibilityKey}`),
      providerType: "worker",
      providerId: worker.id,
      routeId: route?.id,
      subjectId: worker.workerBindingId,
      functionId: worker.contract.functionId,
      triggerId: worker.contract.triggerId,
      contractId: worker.contract.id,
      packId: worker.packId,
      nodeIds: worker.nodeIds,
      capabilityIds: worker.matchedCapabilityIds,
      adapter: worker.adapter,
      replacementCompatibilityKey: compatibilityKey,
      replacementSlotId: replacementSlotId(input.runId, compatibilityKey),
      gateArtifacts: route?.gateArtifacts ?? [],
      traceSpanId: worker.traceSpanId,
      status: unresolvedReasons.length ? "unresolved" : "replaceable",
      unresolvedReasons,
      evidence: [WORKER_FUNCTION_REGISTRY_ARTIFACT, FUNCTION_DISPATCH_PLAN_ARTIFACT, "worker-lock.json"],
    };
  });
  const executorProviders: ReplacementProvider[] = registry.executorFunctions.map((executor) => {
    const route = routesByKey.get(providerRouteKey("executor", executor.executorId, `${executor.kind}.${executor.executorId}`));
    const compatibilityKey = executorCompatibilityKey(executor);
    const unresolvedReasons = [
      !executor.executorId ? "Executor provider is missing a stable executor id." : undefined,
      executor.capabilityIds.length === 0 ? "Executor provider is missing capability ids." : undefined,
      !compatibilityKey ? "Executor provider is missing a derived replacement compatibility key." : undefined,
      executor.adapter === "local:module" && (!executor.module || !executor.exportName) ? "Local executor provider is missing module or export binding." : undefined,
      !route ? "Executor provider is missing a dispatch route." : undefined,
      route && !route.gateArtifacts.includes(PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT) ? "Executor dispatch route does not require the provider replacement registry gate." : undefined,
    ].filter((reason): reason is string => Boolean(reason));
    return {
      id: stableId("replacement-provider", `${input.runId}:executor:${executor.executorLockId}:${compatibilityKey}`),
      providerType: "executor",
      providerId: executor.id,
      routeId: route?.id,
      subjectId: executor.executorId,
      functionId: `${executor.kind}.${executor.executorId}`,
      packId: executor.packId,
      nodeIds: executor.nodeIds,
      capabilityIds: executor.matchedCapabilityIds,
      adapter: {
        selected: executor.adapter,
        allowed: [executor.adapter],
        module: executor.module,
        exportName: executor.exportName,
      },
      replacementCompatibilityKey: compatibilityKey,
      replacementSlotId: replacementSlotId(input.runId, compatibilityKey),
      gateArtifacts: route?.gateArtifacts ?? [],
      traceSpanId: executor.traceSpanId,
      status: unresolvedReasons.length ? "unresolved" : "replaceable",
      unresolvedReasons,
      evidence: [WORKER_FUNCTION_REGISTRY_ARTIFACT, FUNCTION_DISPATCH_PLAN_ARTIFACT, "executor-lock.json"],
    };
  });
  const providers = [...workerProviders, ...executorProviders];
  const unresolved = providers.flatMap((provider) => replacementProviderUnresolved(provider));
  const replacementSlots = buildReplacementSlots(input.runId, providers);
  const compatibilityKeys = unique(providers.map((provider) => provider.replacementCompatibilityKey).filter(Boolean));
  return {
    schemaVersion: 1,
    id: stableId("provider-replacement-registry", `${input.runId}:${providers.map((provider) => `${provider.id}:${provider.status}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status: providers.length > 0 && unresolved.length === 0 && replacementSlots.length > 0 ? "pass" : "fail",
    protocol: {
      name: "harness.provider-replacement",
      registrationRule: "Every dispatchable worker or executor must expose a stable provider id, function id, adapter binding, and dispatch route before execution.",
      compatibilityRule: "Workers are replaceable by contract replacementCompatibilityKey; executors are replaceable by executor kind plus sorted capability ids.",
      validationRule: "Startup cannot pass while a provider lacks a compatibility key, implementation binding, dispatch route, or provider-registry gate artifact.",
    },
    summary: {
      providerCount: providers.length,
      workerProviderCount: workerProviders.length,
      executorProviderCount: executorProviders.length,
      replaceableProviderCount: providers.filter((provider) => provider.status === "replaceable").length,
      replacementSlotCount: replacementSlots.length,
      compatibilityKeyCount: compatibilityKeys.length,
      unresolvedCount: unresolved.length,
    },
    providers,
    replacementSlots,
    unresolved,
  };
}

function buildStartupReadiness(
  input: RuntimeControlInput,
  registry: WorkerFunctionRegistry,
  providerReplacementRegistry: ProviderReplacementRegistry,
  policyGate: PolicyGate,
  budgetGate: BudgetGate,
  approvalGate: ApprovalGate,
  toolSafetyLedger: ToolSafetyLedger,
  contextBudgetLedger: ContextBudgetLedger,
  hookLedger: HookLedger,
  traceContext: TraceContext,
  dispatchPlan: FunctionDispatchPlan,
  runtimeBus: RuntimeBus,
): StartupReadiness {
  const missingSources = input.spec.sources.filter((source) => source.availability === "missing");
  const unverifiedSources = input.spec.sources.filter((source) => source.availability === "unverified");
  const checklist: StartupReadinessCheck[] = [
    {
      id: "sources-declared",
      status: missingSources.length ? "fail" : unverifiedSources.length || input.spec.sources.length === 0 ? "warning" : "pass",
      details: missingSources.length
        ? `Missing source(s): ${missingSources.map((source) => source.location).join(", ")}.`
        : input.spec.sources.length
          ? `${input.spec.sources.length} source ref(s) are available or explicitly unverified.`
          : "No source refs were provided; runtime may proceed only with explicit assumptions.",
      evidence: input.spec.sources.map((source) => source.location),
    },
    {
      id: "run-plan-locked",
      status: input.runPlan.nodeCount > 0 && Boolean(input.runPlan.executorLockDigest) && Boolean(input.runPlan.workerLockDigest) ? "pass" : "fail",
      details: `${input.runPlan.nodeCount} graph node(s), ${input.executorLock.length} executor lock(s), and ${input.workerLock.length} worker lock(s) are present.`,
      evidence: ["run-plan.json", "executor-lock.json", "worker-lock.json"],
    },
    {
      id: "functions-registered",
      status: registry.workerFunctions.length && dispatchPlan.status === "pass" ? "pass" : "fail",
      details: `${registry.workerFunctions.length} worker function(s), ${registry.executorFunctions.length} executor function(s), and ${dispatchPlan.providerRoutes.length} provider route(s) are dispatchable.`,
      evidence: [WORKER_FUNCTION_REGISTRY_ARTIFACT, FUNCTION_DISPATCH_PLAN_ARTIFACT],
    },
    {
      id: "provider-replacements-ready",
      status: providerReplacementRegistry.status,
      details: `${providerReplacementRegistry.summary.replaceableProviderCount}/${providerReplacementRegistry.summary.providerCount} provider(s) are mapped into ${providerReplacementRegistry.summary.replacementSlotCount} replacement slot(s).`,
      evidence: [PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT, FUNCTION_DISPATCH_PLAN_ARTIFACT],
    },
    {
      id: "runtime-gates-ready",
      status: policyGate.status === "pass" && approvalGate.status === "pass" && budgetGate.status === "pass" ? "pass" : "fail",
      details: `policy=${policyGate.status}, approval=${approvalGate.status}, budget=${budgetGate.status}.`,
      evidence: [POLICY_GATE_ARTIFACT, APPROVAL_GATE_ARTIFACT, BUDGET_GATE_ARTIFACT],
    },
    {
      id: "tool-safety-ready",
      status: toolSafetyLedger.status,
      details: `${toolSafetyLedger.summary.callCount} tool/provider call(s) classified; ${toolSafetyLedger.summary.concurrentSafeCallCount} concurrent-safe and ${toolSafetyLedger.summary.serialCallCount} serial.`,
      evidence: [TOOL_SAFETY_LEDGER_ARTIFACT, FUNCTION_DISPATCH_PLAN_ARTIFACT, POLICY_GATE_ARTIFACT],
    },
    {
      id: "context-budget-ready",
      status: contextBudgetLedger.status,
      details: `${contextBudgetLedger.summary.estimatedTokenCount}/${contextBudgetLedger.summary.maxTokenBudget} estimated context tokens, ${contextBudgetLedger.summary.tierCount} tier(s), ${contextBudgetLedger.summary.isolationBoundaryCount} isolation boundary(ies), and ${contextBudgetLedger.summary.invalidationPointCount} invalidation point(s).`,
      evidence: [CONTEXT_BUDGET_LEDGER_ARTIFACT, "instruction-routing-ledger.json", "source-of-record-ledger.json", "worker-lock.json"],
    },
    {
      id: "hooks-and-trace-ready",
      status: hookLedger.status === "pass" && traceContext.spans.length > 0 ? "pass" : "fail",
      details: `${hookLedger.emissions.length} hook emission(s) and ${traceContext.spans.length} trace span(s) are ready for inspection.`,
      evidence: [HOOK_LEDGER_ARTIFACT, TRACE_CONTEXT_ARTIFACT],
    },
    {
      id: "runtime-bus-ready",
      status: runtimeBus.status === "pass" ? "pass" : "fail",
      details: `${runtimeBus.topics.length} bus topic(s), ${runtimeBus.subscribers.length} subscriber(s), ${runtimeBus.publications.length} publication(s), and ${runtimeBus.stateNamespaces.length} state namespace(s) are registered.`,
      evidence: [RUNTIME_BUS_ARTIFACT],
    },
    {
      id: "handoff-artifacts-declared",
      status: "pass",
      details: "Runtime will write feature state, environment readiness, instruction routing, context-budget evidence, source-of-record answers, executable architecture-boundary evidence, evaluator-rubric evidence, completion-authority evidence, quality-document evidence, continuity state, course-alignment evidence, lifecycle state, verified completion-rate evidence, session clean-state evidence, feedback promotion, diagnostic attribution, repair guidance, subsystem audit, ablation comparison, quality documentation, provider replacement slots, tool-safety classification, progress, validation report, trace, bus, and run-state artifacts before completion.",
      evidence: ["feature-list.json", "environment-readiness-ledger.json", "instruction-routing-ledger.json", CONTEXT_BUDGET_LEDGER_ARTIFACT, "source-of-record-ledger.json", "architecture-boundary-ledger.json", "evaluator-rubric.json", "completion-authority-ledger.json", "quality-document.json", "continuity-ledger.json", "course-alignment-ledger.json", "lifecycle-ledger.json", "verification-pipeline-ledger.json", "session-clean-state-ledger.json", "feedback-promotion-ledger.json", "harness-diagnostic-ledger.json", "repair-guidance-ledger.json", "harness-subsystem-audit.json", "harness-ablation-comparison.json", "harness-quality-ledger.json", PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT, TOOL_SAFETY_LEDGER_ARTIFACT, "progress.md", "session-handoff.md", "validation-report.md", "harness-trace.json", "run-state.json"],
    },
  ];
  const status = checklist.some((check) => check.status === "fail") ? "fail" : checklist.some((check) => check.status === "warning") ? "warning" : "pass";
  return {
    schemaVersion: 1,
    id: stableId("startup-readiness", `${input.runId}:${checklist.map((check) => `${check.id}:${check.status}`).join("|")}`),
    runId: input.runId,
    specId: input.spec.id,
    status,
    rule: "A fresh session may proceed only when sources, locks, dispatch routes, provider replacement slots, gates, context budget, bus, hooks, trace context, source-of-record answers, and handoff artifacts are explicit.",
    checklist,
    resumeArtifacts: [
      "feature-list.json",
      "progress.md",
      "session-handoff.md",
      "validation-report.md",
      "harness-trace.json",
      "run-state.json",
      "instruction-routing-ledger.json",
      "environment-readiness-ledger.json",
      "source-of-record-ledger.json",
      "architecture-boundary-ledger.json",
      "evaluator-rubric.json",
      "evaluator-rubric.md",
      "completion-authority-ledger.json",
      "quality-document.json",
      "quality-document.md",
      "continuity-ledger.json",
      "course-alignment-ledger.json",
      "lifecycle-ledger.json",
      "verification-pipeline-ledger.json",
      "session-clean-state-ledger.json",
      "feedback-promotion-ledger.json",
      "harness-diagnostic-ledger.json",
      "repair-guidance-ledger.json",
      "harness-subsystem-audit.json",
      "harness-ablation-comparison.json",
      "harness-quality-ledger.json",
      WORKER_FUNCTION_REGISTRY_ARTIFACT,
      PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT,
      TOOL_SAFETY_LEDGER_ARTIFACT,
      CONTEXT_BUDGET_LEDGER_ARTIFACT,
      FUNCTION_DISPATCH_PLAN_ARTIFACT,
      RUNTIME_BUS_ARTIFACT,
      STARTUP_READINESS_ARTIFACT,
      FUNCTION_INVOCATION_LEDGER_ARTIFACT,
    ],
  };
}

function buildRuntimeControlValidations(
  outputDir: string,
  registry: WorkerFunctionRegistry,
  providerReplacementRegistry: ProviderReplacementRegistry,
  policyGate: PolicyGate,
  budgetGate: BudgetGate,
  approvalGate: ApprovalGate,
  toolSafetyLedger: ToolSafetyLedger,
  contextBudgetLedger: ContextBudgetLedger,
  hookLedger: HookLedger,
  traceContext: TraceContext,
  dispatchPlan: FunctionDispatchPlan,
  runtimeBus: RuntimeBus,
  startupReadiness: StartupReadiness,
): ValidationResult[] {
  const unboundWorkers = registry.workerFunctions.filter((worker) => worker.nodeIds.length === 0 || !worker.contract.functionId || !worker.contract.triggerId || !worker.contract.stateNamespace);
  const expectedHookCount = registry.workerFunctions.length + registry.executorFunctions.length + 3;
  const spanIds = new Set(traceContext.spans.map((span) => span.id));
  const missingFunctionSpans = [...registry.workerFunctions.map((worker) => worker.traceSpanId), ...registry.executorFunctions.map((executor) => executor.traceSpanId)].filter((span) => !spanIds.has(span));
  const orphanSpans = traceContext.spans.filter((span) => span.parentSpanId && !spanIds.has(span.parentSpanId));
  return [
    {
      id: "worker_function_registry_resolved",
      name: "Worker function registry resolved",
      status: registry.workerFunctions.length && unboundWorkers.length === 0 ? "pass" : "fail",
      details: unboundWorkers.length
        ? `Unbound worker function registration(s): ${unboundWorkers.map((worker) => worker.workerBindingId).join(", ")}.`
        : `Registered ${registry.workerFunctions.length} worker function(s), ${registry.executorFunctions.length} executor function(s), ${registry.eventTopics.length} event topic(s), and ${registry.stateNamespaces.length} state namespace(s).`,
      evidence: [path.join(outputDir, WORKER_FUNCTION_REGISTRY_ARTIFACT)],
      repairable: true,
    },
    {
      id: "provider_replacement_registry_ready",
      name: "Provider replacement registry ready",
      status: providerReplacementRegistry.status,
      details:
        providerReplacementRegistry.status === "pass"
          ? `${providerReplacementRegistry.summary.providerCount} provider(s) are mapped into ${providerReplacementRegistry.summary.replacementSlotCount} replacement compatibility slot(s).`
          : `Unresolved replacement provider(s): ${providerReplacementRegistry.unresolved.map((item) => `${item.subjectId}: ${item.reason}`).join(", ")}.`,
      evidence: [path.join(outputDir, PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT)],
      repairable: true,
    },
    {
      id: "tool_safety_registry_ready",
      name: "Tool safety registry ready",
      status: toolSafetyLedger.status,
      details:
        toolSafetyLedger.status === "pass"
          ? `${toolSafetyLedger.summary.callCount} tool/provider call(s) classified with ${toolSafetyLedger.summary.concurrentSafeCallCount} concurrent-safe and ${toolSafetyLedger.summary.serialCallCount} serial call(s).`
          : `Unsafe tool/provider call(s): ${toolSafetyLedger.unresolved.map((item) => `${item.callId}: ${item.reason}`).join(", ")}.`,
      evidence: [path.join(outputDir, TOOL_SAFETY_LEDGER_ARTIFACT)],
      repairable: true,
    },
    {
      id: "context_budget_ready",
      name: "Context budget ready",
      status: contextBudgetLedger.status,
      details:
        contextBudgetLedger.status === "pass"
          ? `Context budget recorded SELECT/WRITE/COMPRESS/ISOLATE with ${contextBudgetLedger.summary.estimatedTokenCount}/${contextBudgetLedger.summary.maxTokenBudget} estimated token use and ${contextBudgetLedger.summary.invalidationPointCount} invalidation point(s).`
          : `Context budget unresolved item(s): ${contextBudgetLedger.unresolved.map((item) => `${item.id}: ${item.reason}`).join(", ")}.`,
      evidence: [path.join(outputDir, CONTEXT_BUDGET_LEDGER_ARTIFACT)],
      repairable: true,
    },
    {
      id: "policy_gate_passed",
      name: "Policy gate passed",
      status: policyGate.status,
      details:
        policyGate.status === "pass"
          ? `${policyGate.decisions.length} worker/executor policy decision(s) allowed before dispatch.`
          : `Denied policy decision(s): ${policyGate.decisions.filter((decision) => decision.status === "deny").map((decision) => decision.subjectId).join(", ")}.`,
      evidence: [path.join(outputDir, POLICY_GATE_ARTIFACT)],
      repairable: true,
    },
    {
      id: "budget_gate_passed",
      name: "Budget gate passed",
      status: budgetGate.status,
      details: `Allocated ${budgetGate.estimatedUsage.localDeterministicCalls}/${budgetGate.limits.maxLocalDeterministicCalls} deterministic local call(s) across ${budgetGate.estimatedUsage.nodes} node(s).`,
      evidence: [path.join(outputDir, BUDGET_GATE_ARTIFACT)],
      repairable: true,
    },
    {
      id: "approval_gate_resolved",
      name: "Approval gate resolved",
      status: approvalGate.status,
      details:
        approvalGate.requiredRequestCount === 0
          ? "No destructive, source-of-truth, external-side-effect, or human-review approvals were required for this run."
          : `Resolved ${approvalGate.resolvedRequestCount}/${approvalGate.requiredRequestCount} approval request(s).`,
      evidence: [path.join(outputDir, APPROVAL_GATE_ARTIFACT)],
      repairable: true,
    },
    {
      id: "hook_ledger_recorded",
      name: "Hook ledger recorded",
      status: hookLedger.status,
      details: `Recorded ${hookLedger.emissions.length}/${expectedHookCount} required gate/function hook emission(s).`,
      evidence: [path.join(outputDir, HOOK_LEDGER_ARTIFACT)],
      repairable: true,
    },
    {
      id: "trace_context_propagated",
      name: "Trace context propagated",
      status: missingFunctionSpans.length || orphanSpans.length ? "fail" : "pass",
      details:
        missingFunctionSpans.length || orphanSpans.length
          ? `Missing function span(s): ${missingFunctionSpans.join(", ") || "none"}; orphan span(s): ${orphanSpans.map((span) => span.id).join(", ") || "none"}.`
          : `Trace context includes ${traceContext.spans.length} span(s) with parent links for every registered worker and executor function.`,
      evidence: [path.join(outputDir, TRACE_CONTEXT_ARTIFACT)],
      repairable: true,
    },
    {
      id: "function_dispatch_plan_resolved",
      name: "Function dispatch plan resolved",
      status: dispatchPlan.status,
      details:
        dispatchPlan.status === "pass"
          ? `${dispatchPlan.providerRoutes.length} provider route(s) resolve locked worker/executor functions across ${dispatchPlan.nodeDispatches.length} node(s).`
          : `Unresolved dispatch route(s): ${dispatchPlan.unresolved.map((item) => `${item.nodeId}:${item.lockId}`).join(", ")}.`,
      evidence: [path.join(outputDir, FUNCTION_DISPATCH_PLAN_ARTIFACT)],
      repairable: true,
    },
    {
      id: "runtime_bus_resolved",
      name: "Runtime bus resolved",
      status: runtimeBus.status,
      details:
        runtimeBus.status === "pass"
          ? `${runtimeBus.topics.length} topic(s), ${runtimeBus.subscribers.length} subscriber(s), ${runtimeBus.publications.length} publication(s), and ${runtimeBus.stateNamespaces.length} state namespace(s) connect runtime providers.`
          : `Unresolved runtime bus item(s): ${runtimeBus.unresolved.map((item) => `${item.subjectId}: ${item.reason}`).join(", ")}.`,
      evidence: [path.join(outputDir, RUNTIME_BUS_ARTIFACT)],
      repairable: true,
    },
    {
      id: "startup_readiness_confirmed",
      name: "Startup readiness confirmed",
      status: startupReadiness.status,
      details: `Startup readiness is ${startupReadiness.status}; ${startupReadiness.checklist.length} readiness check(s) recorded for fresh-session rebuild.`,
      evidence: [path.join(outputDir, STARTUP_READINESS_ARTIFACT)],
      repairable: true,
    },
  ];
}

function hookEmission(runId: string, eventTopic: string, subjectId: string, functionId: string, artifactId: string, traceSpanId: string): HookEmission {
  return {
    id: stableId("hook-emission", `${runId}:${eventTopic}:${subjectId}:${functionId}`),
    hookId: eventTopic,
    eventTopic,
    subjectId,
    functionId,
    status: "recorded",
    traceSpanId,
    evidence: [artifactId],
  };
}

function busPublication(input: {
  runId: string;
  topic: string;
  producerType: RuntimeBusPublication["producerType"];
  producerId: string;
  functionId?: string;
  nodeId?: string;
  status: RuntimeBusPublication["status"];
  traceSpanId: string;
  evidence: string[];
}): RuntimeBusPublication {
  return {
    id: stableId("bus-publication", `${input.runId}:${input.topic}:${input.producerId}:${input.functionId ?? ""}:${input.status}`),
    topic: input.topic,
    producerType: input.producerType,
    producerId: input.producerId,
    functionId: input.functionId,
    nodeId: input.nodeId,
    status: input.status,
    traceSpanId: input.traceSpanId,
    evidence: input.evidence,
  };
}

function executorBusTopics(executor: ExecutorFunctionRegistration): string[] {
  return unique([
    "workflow.executor.completed",
    ...(executor.produces ?? []).map((artifact) => `artifact.${artifact}.written`),
    ...(executor.validatorIds ?? []).map((validator) => `validator.${validator}.completed`),
  ]);
}

function replacementProviderUnresolved(provider: ReplacementProvider): ReplacementUnresolved[] {
  return provider.unresolvedReasons.map((reason) => ({
    providerId: provider.providerId,
    providerType: provider.providerType,
    subjectId: provider.subjectId,
    reason,
    evidence: provider.evidence,
  }));
}

function buildReplacementSlots(runId: string, providers: ReplacementProvider[]): ReplacementSlot[] {
  const byCompatibilityKey = new Map<string, ReplacementProvider[]>();
  for (const provider of providers) {
    if (!provider.replacementCompatibilityKey) {
      continue;
    }
    byCompatibilityKey.set(provider.replacementCompatibilityKey, [...(byCompatibilityKey.get(provider.replacementCompatibilityKey) ?? []), provider]);
  }
  return [...byCompatibilityKey.entries()].map(([compatibilityKey, slotProviders]) => ({
    id: replacementSlotId(runId, compatibilityKey),
    compatibilityKey,
    providerTypes: unique(slotProviders.map((provider) => provider.providerType)),
    functionIds: unique(slotProviders.map((provider) => provider.functionId)),
    providerIds: slotProviders.map((provider) => provider.id),
    adapterTypes: unique(slotProviders.flatMap((provider) => provider.adapter.allowed)),
    nodeIds: unique(slotProviders.flatMap((provider) => provider.nodeIds)),
    evidence: unique([PROVIDER_REPLACEMENT_REGISTRY_ARTIFACT, ...slotProviders.flatMap((provider) => provider.evidence)]),
  }));
}

function replacementSlotId(runId: string, compatibilityKey: string): string {
  return stableId("replacement-slot", `${runId}:${compatibilityKey}`);
}

function executorCompatibilityKey(executor: ExecutorFunctionRegistration): string {
  const capabilityKey = (executor.matchedCapabilityIds.length ? executor.matchedCapabilityIds : executor.capabilityIds).slice().sort().join("+");
  return `executor:${executor.kind}:${capabilityKey || executor.executorId}`;
}

function providerRouteKey(routeType: ProviderRoute["routeType"], subjectId: string, functionId: string): string {
  return `${routeType}:${subjectId}:${functionId}`;
}

function runtimeTopicKind(topic: string): RuntimeBusTopic["kind"] {
  if (topic.includes("policy") || topic.includes("approval") || topic.includes("budget")) {
    return "gate";
  }
  if (topic.includes("before_") || topic.includes("hook")) {
    return "hook";
  }
  if (topic.includes("trace")) {
    return "trace";
  }
  if (topic.startsWith("artifact.") || topic.startsWith("validator.") || topic === "workflow.executor.completed") {
    return "executor-contract";
  }
  if (topic.startsWith("workflow.")) {
    return "worker-contract";
  }
  return "lifecycle";
}

function gateSpan(runId: string, parentSpanId: string, subjectId: string, functionId: string, artifactId: string, status: string): TraceSpan {
  return {
    id: spanId(runId, "gate", subjectId),
    parentSpanId,
    kind: "gate",
    name: `${subjectId} (${status})`,
    subjectId,
    functionId,
    artifactId,
    eventTopics: ["runtime.gate.checked"],
  };
}

function firstNodeSpanId(runId: string, nodeIds: string[]): string | undefined {
  return nodeIds[0] ? spanId(runId, "node", nodeIds[0]) : undefined;
}

function spanId(runId: string, kind: string, subjectId: string): string {
  return stableId("span", `${runId}:${kind}:${subjectId}`);
}

function nodeIdsForWorker(runPlan: RunPlan, workerLockId: string): string[] {
  return runPlan.nodes.filter((node) => node.workerLockIds.includes(workerLockId)).map((node) => node.id);
}

function nodeIdsForExecutor(runPlan: RunPlan, executorLockId: string): string[] {
  return runPlan.nodes.filter((node) => node.executorLockIds.includes(executorLockId)).map((node) => node.id);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
