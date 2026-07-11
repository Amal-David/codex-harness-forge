import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  buildEvidenceGraph,
  buildSourceRefs,
  compileHarnessIR,
  createDefaultCapabilityRegistry,
  loadWorkerFunctionContracts,
  resolveWorkerBindings,
  routeRequest,
  synthesizeHarnessDraft,
  validateWorkerContractCatalog,
  verifyHarnessDraft,
  verifyHarnessIR,
} from "../dist/index.js";
import { validateCapabilityPack } from "../dist/registry/capability-packs.js";

test("evidence graph and registry expose motion and design capabilities", async () => {
  const sources = await buildSourceRefs([path.resolve("fixtures/motion/logo.svg"), path.resolve("fixtures/design-system")]);
  const graph = await buildEvidenceGraph(sources);
  const registry = createDefaultCapabilityRegistry();
  assert.ok(graph.facts.some((fact) => fact.tags?.includes("lottie")));
  assert.ok(graph.facts.some((fact) => fact.tags?.includes("design-system")));
  assert.ok(registry.capabilities.some((capability) => capability.id === "artifact-generator:lottie-basic-reveal"));
  assert.ok(registry.capabilities.some((capability) => capability.id === "artifact-generator:design-system-report"));
  assert.ok(registry.packs.some((pack) => pack.id === "workflow-runtime" && pack.required));
  assert.ok(registry.packs.some((pack) => pack.id === "motion-lottie"));
  assert.ok(registry.packs.some((pack) => pack.id === "design-system-ui"));
  assert.ok(registry.packs.find((pack) => pack.id === "motion-lottie")?.executors?.some((executor) => executor.adapter === "local:module" && executor.exportName === "generateMotionArtifacts"));
  assert.ok(registry.packs.find((pack) => pack.id === "design-system-ui")?.executors?.some((executor) => executor.adapter === "local:module" && executor.exportName === "generateDesignSystemArtifacts"));
});

test("evidence-aware routing and compilation share one capability-pack selection", async () => {
  const sources = await buildSourceRefs([path.resolve("README.md")]);
  const evidenceGraph = await buildEvidenceGraph(sources);
  const registry = createDefaultCapabilityRegistry();
  const request = {
    mode: "standard",
    intent: "Explain the architecture and dependency boundaries in this project.",
    sources: [path.resolve("README.md")],
    controls: [],
    outputDir: "output/test",
  };
  const route = routeRequest(request, { evidenceGraph, packs: registry.packs });
  const draft = synthesizeHarnessDraft({
    request,
    evidenceGraph,
    registry,
    selectedPackIds: route.selectedCapabilityPackIds,
  });
  const ir = compileHarnessIR(request, draft, evidenceGraph);

  assert.ok(route.selectedCapabilityPackIds.includes("workflow-runtime"));
  assert.deepEqual(new Set(draft.selectedCapabilityPackIds), new Set(route.selectedCapabilityPackIds));
  assert.deepEqual(new Set(ir.selectedCapabilityPackIds), new Set(route.selectedCapabilityPackIds));
  assert.deepEqual(new Set(route.composition.matchedPacks.map((pack) => pack.packId)), new Set(route.selectedCapabilityPackIds));
});

test("worker contract registry exposes stable runtime function contracts", () => {
  const contracts = loadWorkerFunctionContracts();
  assert.ok(contracts.some((contract) => contract.id === "contract:workflow-runtime-planning" && contract.functionId === "workflow.runtime.plan"));
  assert.ok(contracts.some((contract) => contract.id === "contract:workflow-council-elders" && contract.triggerId === "workflow.group.council-elders"));
  assert.ok(contracts.some((contract) => contract.id === "contract:workflow-course-correction" && contract.replacement.compatibilityKey === "workflow.council.course_correct@1"));
  assert.ok(contracts.every((contract) => contract.adapterTypes.includes("local:module")));
  assert.ok(contracts.find((contract) => contract.id === "contract:workflow-council-elders")?.adapterTypes.includes("codex:host"));
});

test("worker contract validation rejects incomplete function contracts", () => {
  assert.throws(
    () =>
      validateWorkerContractCatalog(
        {
          id: "bad-contracts",
          name: "Bad Contracts",
          description: "Invalid contracts used to prove worker contract validation fails loudly.",
          contracts: [
            {
              id: "contract:bad",
              workerId: "worker:bad",
              triggerId: "workflow.bad",
              version: "1.0.0",
              stateNamespace: "workflow.bad",
              eventTopics: ["workflow.bad"],
              adapterTypes: ["local:module"],
              requiredPermissions: ["filesystem-read"],
              inputSchema: { type: "object" },
              outputSchema: { type: "object" },
              replacement: { compatibilityKey: "bad@1" },
            },
          ],
        },
        "bad-contracts.json",
      ),
    /functionId must be a non-empty string/,
  );
});

test("worker resolver rejects unknown worker contract references", () => {
  assert.throws(
    () =>
      resolveWorkerBindings(
        {
          graph: [
            {
              id: "analyze:bad",
              title: "Bad worker",
              agentId: "bad-agent",
              capabilityId: "agent:bad",
              dependsOn: [],
            },
          ],
        },
        "runtime-planning",
        [
          {
            id: "bad-pack",
            name: "Bad Pack",
            description: "Invalid pack used to prove worker contract lookup fails loudly.",
            capabilityIds: ["agent:bad"],
            workerBindings: [
              {
                id: "worker:bad",
                contractId: "contract:not-registered",
                group: "runtime-planning",
                adapter: "local:module",
                module: "dist/runtime/worker-executors.js",
                exportName: "runWorkflowRuntimeWorker",
                agentIds: ["bad-agent"],
                capabilityIds: ["agent:bad"],
              },
            ],
          },
        ],
      ),
    /unknown contract 'contract:not-registered'/,
  );
});

test("draft verifier rejects unknown capabilities before runtime", async () => {
  const sources = await buildSourceRefs([path.resolve("fixtures/motion/logo.svg")]);
  const evidenceGraph = await buildEvidenceGraph(sources);
  const registry = createDefaultCapabilityRegistry();
  const draft = synthesizeHarnessDraft({
    request: {
      harness: "motion-lottie",
      mode: "deep",
      intent: "Create a logo reveal.",
      sources: [path.resolve("fixtures/motion/logo.svg")],
      controls: [],
      outputDir: "output/test",
    },
    evidenceGraph,
    registry,
  });
  draft.proposedNodes[0].capabilityId = "agent:not-registered";
  const verification = verifyHarnessDraft(draft, evidenceGraph, registry);
  assert.equal(verification.ok, false);
  assert.ok(verification.errors.some((error) => error.code === "UNKNOWN_CAPABILITY"));
});

test("capability pack validation rejects nodes that reference unlisted capabilities", () => {
  assert.throws(
    () =>
      validateCapabilityPack(
        {
          id: "bad-pack",
          name: "Bad Pack",
          description: "Invalid pack used to prove pack validation fails loudly.",
          capabilityIds: ["agent:allowed"],
          nodes: [
            {
              id: "analyze:bad",
              kind: "analyze",
              title: "Bad node",
              capabilityId: "agent:not-listed",
              inputs: ["$sources"],
              outputs: [{ id: "bad-output", kind: "report", required: true }],
            },
          ],
        },
        "bad-pack.json",
      ),
    /not listed in capabilityIds/,
  );
});

test("capability pack route metadata drives router classification", () => {
  const decision = routeRequest({
    intent: "Explain the entrypoint and architecture dependencies.",
    sources: [path.resolve("src/index.ts")],
    outputDir: "output/test",
  });
  assert.equal(decision.archetype, "explore-harness");
  assert.deepEqual(decision.systemTypes, ["codebase"]);
  assert.ok(decision.requiredValidators.includes("trace_complete"));
  assert.match(decision.reason, /capability pack\(s\) 'generic-report'/);
});

test("capability pack validation rejects invalid route metadata", () => {
  assert.throws(
    () =>
      validateCapabilityPack(
        {
          id: "bad-route-pack",
          name: "Bad Route Pack",
          description: "Invalid pack used to prove route metadata fails loudly.",
          capabilityIds: ["agent:allowed"],
          route: {
            archetype: "magic-harness",
            systemTypes: ["codebase"],
          },
        },
        "bad-route-pack.json",
      ),
    /route\.archetype must be a known harness archetype/,
  );
});

test("capability pack validation rejects executors that reference unlisted capabilities", () => {
  assert.throws(
    () =>
      validateCapabilityPack(
        {
          id: "bad-executor-pack",
          name: "Bad Executor Pack",
          description: "Invalid pack used to prove executor bindings fail loudly.",
          capabilityIds: ["artifact-generator:allowed"],
          executors: [
            {
              id: "exec:bad",
              kind: "artifact-generator",
              capabilityIds: ["artifact-generator:not-listed"],
              adapter: "local:bad",
            },
          ],
        },
        "bad-executor-pack.json",
      ),
    /not listed in capabilityIds/,
  );
});

test("capability pack validation rejects worker bindings that reference unlisted capabilities", () => {
  assert.throws(
    () =>
      validateCapabilityPack(
        {
          id: "bad-worker-pack",
          name: "Bad Worker Pack",
          description: "Invalid pack used to prove worker bindings fail loudly.",
          capabilityIds: ["agent:allowed"],
          workerBindings: [
            {
              id: "worker:bad",
              contractId: "contract:workflow-runtime-planning",
              group: "runtime-planning",
              adapter: "local:module",
              module: "dist/runtime/worker-executors.js",
              exportName: "runWorkflowRuntimeWorker",
              agentIds: ["allowed-agent"],
              capabilityIds: ["agent:not-listed"],
            },
          ],
        },
        "bad-worker-pack.json",
      ),
    /not listed in capabilityIds/,
  );
});

test("capability pack validation rejects worker bindings without contract ids", () => {
  assert.throws(
    () =>
      validateCapabilityPack(
        {
          id: "bad-worker-contract-pack",
          name: "Bad Worker Contract Pack",
          description: "Invalid pack used to prove worker bindings must declare stable contracts.",
          capabilityIds: ["agent:allowed"],
          workerBindings: [
            {
              id: "worker:bad-contract",
              group: "runtime-planning",
              adapter: "local:module",
              module: "dist/runtime/worker-executors.js",
              exportName: "runWorkflowRuntimeWorker",
              agentIds: ["allowed-agent"],
              capabilityIds: ["agent:allowed"],
            },
          ],
        },
        "bad-worker-contract-pack.json",
      ),
    /contractId must be a non-empty string/,
  );
});

test("capability pack validation rejects unsupported worker adapters", () => {
  assert.throws(
    () =>
      validateCapabilityPack(
        {
          id: "bad-worker-adapter-pack",
          name: "Bad Worker Adapter Pack",
          description: "Invalid pack used to prove worker adapters are explicit.",
          capabilityIds: ["agent:allowed"],
          workerBindings: [
            {
              id: "worker:bad-adapter",
              contractId: "contract:workflow-runtime-planning",
              group: "runtime-planning",
              adapter: "local:hidden-hardcode",
              agentIds: ["allowed-agent"],
              capabilityIds: ["agent:allowed"],
            },
          ],
        },
        "bad-worker-adapter-pack.json",
      ),
    /adapter must be 'local:deterministic-agent' or 'local:module'/,
  );
});

test("capability pack validation rejects incomplete local module worker bindings", () => {
  assert.throws(
    () =>
      validateCapabilityPack(
        {
          id: "bad-worker-module-pack",
          name: "Bad Worker Module Pack",
          description: "Invalid pack used to prove local module worker bindings declare their entrypoint.",
          capabilityIds: ["agent:allowed"],
          workerBindings: [
            {
              id: "worker:bad-module",
              contractId: "contract:workflow-runtime-planning",
              group: "runtime-planning",
              adapter: "local:module",
              agentIds: ["allowed-agent"],
              capabilityIds: ["agent:allowed"],
            },
          ],
        },
        "bad-worker-module-pack.json",
      ),
    /module must be a non-empty string/,
  );
});

test("capability pack validation rejects incomplete local module executors", () => {
  assert.throws(
    () =>
      validateCapabilityPack(
        {
          id: "bad-module-pack",
          name: "Bad Module Pack",
          description: "Invalid pack used to prove local module executors declare their entrypoint.",
          capabilityIds: ["artifact-generator:allowed"],
          executors: [
            {
              id: "exec:bad-module",
              kind: "artifact-generator",
              capabilityIds: ["artifact-generator:allowed"],
              adapter: "local:module",
            },
          ],
        },
        "bad-module-pack.json",
      ),
    /module must be a non-empty string/,
  );
});

test("ir verifier rejects artifact generators without executor bindings", async () => {
  const sources = await buildSourceRefs([path.resolve("fixtures/motion/logo.svg")]);
  const evidenceGraph = await buildEvidenceGraph(sources);
  const registry = createDefaultCapabilityRegistry();
  registry.capabilities.push({
    id: "artifact-generator:unbound-test",
    kind: "artifact-generator",
    name: "Unbound test generator",
    description: "Registered only to prove executor coverage is verified separately from capability registration.",
    supports: { artifactTypes: ["markdown-doc"], sourceFactKinds: ["rule"] },
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    deterministic: true,
    permissionRequired: ["filesystem-write"],
  });
  const request = {
    harness: "motion-lottie",
    mode: "standard",
    intent: "Create a logo reveal.",
    sources: [path.resolve("fixtures/motion/logo.svg")],
    controls: [],
    outputDir: "output/test",
  };
  const draft = synthesizeHarnessDraft({ request, evidenceGraph, registry });
  const ir = compileHarnessIR(request, draft, evidenceGraph);
  const generator = ir.nodes.find((node) => node.id === "generate:lottie");
  assert.ok(generator);
  generator.capabilityId = "artifact-generator:unbound-test";
  const verification = verifyHarnessIR(ir, registry);
  assert.equal(verification.ok, false);
  assert.ok(verification.errors.some((error) => error.code === "IR_GENERATOR_WITHOUT_EXECUTOR"));
});
