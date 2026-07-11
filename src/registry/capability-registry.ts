import type { CapabilityKind, CapabilitySpec, SourceFactKind } from "../types.js";
import { loadCapabilityPacks, type CapabilityPackManifest } from "./capability-packs.js";

export interface CapabilityRegistry {
  capabilities: CapabilitySpec[];
  packs: CapabilityPackManifest[];
}

export function createDefaultCapabilityRegistry(): CapabilityRegistry {
  const capabilities: CapabilitySpec[] = [
    profiler("profiler:source-availability", "Source availability profiler", "Classify requested source paths as available, missing, or unverified.", ["runtime-constraint"]),
    profiler("profiler:svg-profile", "SVG profiler", "Extract SVG dimensions, colors, and asset properties.", ["asset-property"]),
    profiler("profiler:design-inventory", "Design inventory profiler", "Extract component exports, token references, raw colors, and import signals.", ["component", "token", "rule"]),
    agent("agent:source-auditor", "Source auditor", "Identify source availability, conflicts, authority, and missing context.", false, ["rule", "runtime-constraint"]),
    agent("agent:asset-analyst", "Asset analyst", "Inspect motion assets, SVG groups, colors, dimensions, and animation affordances.", false, ["asset-property"]),
    agent("agent:component-inventory", "Component inventory", "Analyze design-system components and import conventions.", false, ["component"]),
    agent("agent:token-agent", "Token agent", "Analyze design tokens, raw colors, and styling constraints.", false, ["token", "rule"]),
    agent("agent:app-product-analyst", "App product analyst", "Extract product flows, acceptance criteria, and user-facing requirements from app PRDs.", false, ["example", "rule", "capability-hint"]),
    agent("agent:api-architect", "API architect", "Derive API routes, contracts, auth boundaries, and integration responsibilities from requirements.", false, ["api", "schema", "rule"]),
    agent("agent:persistence-designer", "Persistence designer", "Derive data model, schema, migration, and storage responsibilities from requirements.", false, ["schema", "runtime-constraint", "rule"]),
    agent("agent:test-planner", "Test planner", "Derive unit, integration, end-to-end, accessibility, and deployment validation plans for app workflows.", false, ["test-command", "validator", "rule"]),
    agent("agent:implementation-agent", "Implementation agent", "Produce source-grounded implementation artifacts inside the declared artifact contract.", true, ["component", "token", "rule"]),
    agent("agent:lottie-engineer", "Lottie engineer", "Produce Lottie JSON and controls from motion evidence.", true, ["asset-property", "rule"]),
    agent("agent:repair-agent", "Repair agent", "Repair artifacts in response to validator failures within scoped permissions.", true, ["validator", "rule"]),
    agent("agent:finalizer", "Finalizer", "Package accepted artifacts, trace, validation report, and learning proposals.", false, ["validator", "runtime-constraint"]),
    agent("agent:hypothesis-generator", "Hypothesis generator", "Generate competing source-grounded hypotheses before artifact creation.", false, ["rule", "capability-hint"]),
    agent("agent:research-critic", "Research critic", "Challenge default assumptions and flag weakly supported candidates.", false, ["rule", "anti-pattern"]),
    agent("agent:validation-strategist", "Validation strategist", "Tie hypotheses and artifacts to concrete validators and falsification checks.", false, ["validator", "rule"]),
    agent("agent:persistence-architect", "Persistence architect", "Design durable run state, saved workflow, memory write-back, provenance, and sync boundaries.", false, ["runtime-constraint", "rule"]),
    agent("agent:flow-runtime-manager", "Flow runtime manager", "Own workflow lifecycle, resumability, run management, and generated orchestration boundaries.", false, ["runtime-constraint", "capability-hint"]),
    agent("agent:council-gstack-critic", "GStack process elder", "Adversarially review specialist coverage, QA/release discipline, routing, and inspectable workflow process using GStack-inspired practices.", false, ["rule", "anti-pattern"]),
    agent("agent:council-gbrain-memory", "GBrain memory elder", "Adversarially review brain-first lookup, durable memory, provenance, write-back, sync, and contradiction handling using GBrain-inspired practices.", false, ["rule", "runtime-constraint"]),
    agent("agent:council-verifier", "Verifier elder", "Adversarially review validator coverage, IR grounding, course correction, and finalization gates.", false, ["validator", "runtime-constraint"]),
    agent("agent:council-course-corrector", "Council course corrector", "Synthesize council findings into concrete course corrections before finalization.", false, ["validator", "rule", "runtime-constraint"]),
    generator("artifact-generator:lottie-basic-reveal", "Basic Lottie reveal generator", "Generate a source-grounded Lottie JSON, controls, and preview bundle.", ["lottie-json"], ["asset-property", "rule"]),
    generator("artifact-generator:design-system-report", "Design system report generator", "Generate component inventory and conformance report artifacts.", ["markdown-doc"], ["component", "token", "rule"]),
    generator("artifact-generator:app-blueprint", "App blueprint generator", "Generate app UI flow, API contract, persistence plan, source tree, test plan, and acceptance artifacts from PRD evidence.", ["react-component", "api-client", "migration-patch", "source-tree", "test-file", "release-report"], ["api", "schema", "test-command", "example", "rule"]),
    generator("artifact-generator:final-report", "Final report generator", "Generate a generic source-grounded markdown harness report.", ["markdown-doc"], ["runtime-constraint", "rule"]),
    validator("validator:source-availability", "Source availability validator", "Fail or warn when requested sources are missing or unverified.", ["runtime-constraint"]),
    validator("validator:trace-complete", "Trace completeness validator", "Validate that the run can produce a final trace.", ["markdown-doc"], ["runtime-constraint"]),
    validator("validator:svg-source-available", "SVG source validator", "Require at least one available SVG source for motion harnesses.", ["asset-property"]),
    validator("validator:lottie-json", "Lottie JSON validator", "Validate basic Lottie JSON structure.", ["lottie-json"], ["schema"]),
    validator("validator:lottie-controls", "Lottie controls validator", "Validate requested reusable controls.", ["lottie-json"], ["runtime-constraint"]),
    validator("validator:lottie-preview", "Lottie preview validator", "Validate generated preview wiring.", ["lottie-json"], ["validator"]),
    validator("validator:design-component-inventory", "Design component inventory validator", "Validate discovered design-system component inventory.", ["markdown-doc"], ["component"]),
    validator("validator:design-token-usage", "Design token usage validator", "Validate token usage detection.", ["markdown-doc"], ["token"]),
    validator("validator:design-raw-color", "Raw color validator", "Warn when raw colors appear outside token definitions.", ["markdown-doc"], ["rule", "token"]),
    validator("validator:design-import-paths", "Import path validator", "Validate relative import paths in profiled design-system files.", ["markdown-doc"], ["component"]),
    validator("validator:app-requirements", "App requirement extraction validator", "Validate that app workflow artifacts capture source-grounded product requirements.", ["markdown-doc"], ["example", "rule"]),
    validator("validator:app-api-contract", "App API contract validator", "Validate generated app API route contracts.", ["api-client"], ["api", "schema"]),
    validator("validator:app-persistence-plan", "App persistence plan validator", "Validate generated schema and persistence migration planning.", ["migration-patch"], ["schema", "runtime-constraint"]),
    validator("validator:app-source-tree", "App source tree validator", "Validate generated app source files, package scripts, and smoke tests.", ["source-tree"], ["test-command", "schema", "rule"]),
    validator("validator:app-test-plan", "App test plan validator", "Validate generated full-pipeline verification plan.", ["test-file"], ["test-command", "validator"]),
    validator("validator:app-acceptance-plan", "App acceptance validator", "Validate product acceptance, accessibility, deployment, and clean-handoff coverage.", ["release-report"], ["validator", "rule"]),
    validator("validator:run-state", "Run state validator", "Require durable run state for persistence and workflow management.", ["workflow-state"], ["runtime-constraint"]),
    validator("validator:council-review", "Council review validator", "Require the GStack/GBrain/verifier council review before finalization.", ["review-report"], ["validator", "runtime-constraint"]),
  ];
  return { capabilities, packs: loadCapabilityPacks() };
}

export function getCapability(registry: CapabilityRegistry, id: string): CapabilitySpec | undefined {
  return registry.capabilities.find((capability) => capability.id === id);
}

export function listCapabilitiesByKind(registry: CapabilityRegistry, kind: CapabilityKind): CapabilitySpec[] {
  return registry.capabilities.filter((capability) => capability.kind === kind);
}

function profiler(id: string, name: string, description: string, sourceFactKinds: SourceFactKind[]): CapabilitySpec {
  return capability(id, "profiler", name, description, [], sourceFactKinds, true, ["filesystem-read"]);
}

function agent(id: string, name: string, description: string, writes: boolean, sourceFactKinds: SourceFactKind[]): CapabilitySpec {
  return capability(id, "agent-template", name, description, [], sourceFactKinds, false, writes ? ["filesystem-read", "filesystem-write"] : ["filesystem-read"]);
}

function generator(id: string, name: string, description: string, artifactTypes: string[], sourceFactKinds: SourceFactKind[]): CapabilitySpec {
  return capability(id, "artifact-generator", name, description, artifactTypes, sourceFactKinds, true, ["filesystem-write"]);
}

function validator(id: string, name: string, description: string, artifactTypes: string[], sourceFactKinds: SourceFactKind[]): CapabilitySpec;
function validator(id: string, name: string, description: string, sourceFactKinds: SourceFactKind[]): CapabilitySpec;
function validator(id: string, name: string, description: string, artifactTypesOrFactKinds: string[] | undefined, maybeFactKinds?: SourceFactKind[]): CapabilitySpec {
  const artifactTypes = maybeFactKinds ? artifactTypesOrFactKinds : [];
  const factKinds = maybeFactKinds ?? (artifactTypesOrFactKinds as SourceFactKind[]);
  return capability(id, "validator", name, description, artifactTypes, factKinds, true, ["filesystem-read"]);
}

function capability(
  id: string,
  kind: CapabilityKind,
  name: string,
  description: string,
  artifactTypes: string[] | undefined,
  sourceFactKinds: SourceFactKind[],
  deterministic: boolean,
  permissions: CapabilitySpec["permissionRequired"],
): CapabilitySpec {
  return {
    id,
    kind,
    name,
    description,
    supports: {
      artifactTypes,
      sourceFactKinds,
    },
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    deterministic,
    permissionRequired: permissions,
  };
}
