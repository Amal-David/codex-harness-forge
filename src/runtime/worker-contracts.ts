import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PACKAGE_ROOT } from "../utils/package-paths.js";

export interface WorkerContractCatalog {
  id: string;
  name: string;
  description: string;
  contracts: WorkerFunctionContract[];
}

export interface WorkerFunctionContract {
  id: string;
  workerId: string;
  functionId: string;
  triggerId: string;
  version: string;
  stateNamespace: string;
  eventTopics: string[];
  adapterTypes: string[];
  requiredPermissions: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  replacement: {
    compatibilityKey: string;
    notes?: string;
  };
}

export function loadWorkerContractCatalogs(rootDir = PACKAGE_ROOT): WorkerContractCatalog[] {
  const contractsDir = path.join(rootDir, "worker-contracts");
  if (!existsSync(contractsDir)) {
    return [];
  }
  return readdirSync(contractsDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => validateWorkerContractCatalog(JSON.parse(readFileSync(path.join(contractsDir, file), "utf8")), file));
}

export function loadWorkerFunctionContracts(rootDir = PACKAGE_ROOT): WorkerFunctionContract[] {
  const contracts = loadWorkerContractCatalogs(rootDir).flatMap((catalog) => catalog.contracts);
  const byId = new Set<string>();
  const byFunctionId = new Set<string>();
  for (const contract of contracts) {
    if (byId.has(contract.id)) {
      throw new Error(`Duplicate worker contract id '${contract.id}'.`);
    }
    if (byFunctionId.has(contract.functionId)) {
      throw new Error(`Duplicate worker functionId '${contract.functionId}'.`);
    }
    byId.add(contract.id);
    byFunctionId.add(contract.functionId);
  }
  return contracts;
}

export function workerContractById(contractId: string, contracts = loadWorkerFunctionContracts()): WorkerFunctionContract | undefined {
  return contracts.find((contract) => contract.id === contractId);
}

export function validateWorkerContractCatalog(value: unknown, source = "worker-contract-catalog"): WorkerContractCatalog {
  if (!isRecord(value)) {
    throw new Error(`${source} must be a JSON object.`);
  }
  stringField(value, "id", source);
  stringField(value, "name", source);
  stringField(value, "description", source);
  const contracts = arrayField(value, "contracts", source);
  if (contracts.length === 0) {
    throw new Error(`${source}.contracts must not be empty.`);
  }
  for (const contract of contracts) {
    validateWorkerFunctionContract(contract, source);
  }
  return value as unknown as WorkerContractCatalog;
}

export function validateWorkerFunctionContract(value: unknown, source = "worker-contract"): WorkerFunctionContract {
  if (!isRecord(value)) {
    throw new Error(`${source}.contracts entries must be objects.`);
  }
  const contractId = stringField(value, "id", `${source}.contracts`);
  for (const field of ["workerId", "functionId", "triggerId", "version", "stateNamespace"] as const) {
    stringField(value, field, `${source}.contracts.${contractId}`);
  }
  for (const field of ["eventTopics", "adapterTypes", "requiredPermissions"] as const) {
    const values = arrayField(value, field, `${source}.contracts.${contractId}`);
    if (values.length === 0) {
      throw new Error(`${source}.contracts.${contractId}.${field} must not be empty.`);
    }
    for (const item of values) {
      if (typeof item !== "string" || !item) {
        throw new Error(`${source}.contracts.${contractId}.${field} entries must be non-empty strings.`);
      }
    }
  }
  objectField(value, "inputSchema", `${source}.contracts.${contractId}`);
  objectField(value, "outputSchema", `${source}.contracts.${contractId}`);
  const replacement = objectField(value, "replacement", `${source}.contracts.${contractId}`);
  stringField(replacement, "compatibilityKey", `${source}.contracts.${contractId}.replacement`);
  return value as unknown as WorkerFunctionContract;
}

function stringField(value: Record<string, unknown>, field: string, source: string): string {
  const item = value[field];
  if (typeof item !== "string" || !item) {
    throw new Error(`${source}.${field} must be a non-empty string.`);
  }
  return item;
}

function arrayField(value: Record<string, unknown>, field: string, source: string): unknown[] {
  const item = value[field];
  if (!Array.isArray(item)) {
    throw new Error(`${source}.${field} must be an array.`);
  }
  return item;
}

function objectField(value: Record<string, unknown>, field: string, source: string): Record<string, unknown> {
  const item = value[field];
  if (!isRecord(item)) {
    throw new Error(`${source}.${field} must be a JSON object.`);
  }
  return item;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
