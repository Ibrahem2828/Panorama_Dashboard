import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const raw = fs.readFileSync(path.join(root, "contracts/backend/openapi.json"), "utf8");
const contract = JSON.parse(raw);
const target = JSON.parse(fs.readFileSync(path.join(root, "contracts/backend/contract-target.json"), "utf8"));
const metaSource = fs.readFileSync(path.join(root, "src/contracts/generated/contract-meta.ts"), "utf8");
const operationsSource = fs.readFileSync(path.join(root, "src/contracts/generated/operations.ts"), "utf8");
const typesSource = fs.readFileSync(path.join(root, "src/contracts/generated/types.ts"), "utf8");
const resourcesSource = fs.readFileSync(path.join(root, "src/contracts/generated/resources.ts"), "utf8");
const endpointSource = fs.readFileSync(path.join(root, "src/lib/api/endpoints.ts"), "utf8");
const methods = new Set(["get", "post", "put", "patch", "delete"]);
const operationIds = [];
for (const [route, pathItem] of Object.entries(contract.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem ?? {})) {
    if (!methods.has(method)) continue;
    if (!operation.operationId) throw new Error(`${method.toUpperCase()} ${route} has no operationId`);
    operationIds.push(operation.operationId);
  }
}
const duplicated = operationIds.filter((value, index) => operationIds.indexOf(value) !== index);
if (duplicated.length) throw new Error(`Duplicate operationId values: ${[...new Set(duplicated)].join(", ")}`);
const expected = {
  sha256: crypto.createHash("sha256").update(raw).digest("hex"),
  pathCount: Object.keys(contract.paths ?? {}).length,
  operationCount: operationIds.length,
  schemaCount: Object.keys(contract.components?.schemas ?? {}).length,
};
for (const key of ["sha256", "pathCount", "operationCount", "schemaCount"]) {
  if (expected[key] !== target[key]) {
    throw new Error(`Canonical contract mismatch for ${key}: expected ${target[key]}, received ${expected[key]}. Run npm run contracts:sync with the approved ${target.canonicalSource} artifact.`);
  }
}
for (const [key, value] of Object.entries(expected)) {
  if (!metaSource.includes(`"${key}": ${typeof value === "string" ? `"${value}"` : value}`)) {
    throw new Error(`Generated contract metadata is stale for ${key}. Run npm run contracts:generate.`);
  }
}
for (const operationId of operationIds) {
  if (!operationsSource.includes(`"operationId": "${operationId}"`)) throw new Error(`Missing generated operation ${operationId}`);
  if (!typesSource.includes(`"${operationId}"`)) throw new Error(`Missing generated operation type ${operationId}`);
  if (!resourcesSource.includes(`"${operationId}":`)) throw new Error(`Missing generated operation path ${operationId}`);
}
for (const match of endpointSource.matchAll(/operationPath\("([^"]+)"/gu)) {
  const operationId = match[1];
  if (!operationIds.includes(operationId)) {
    throw new Error(`Legacy endpoint adapter references an operation removed from the canonical contract: ${operationId}`);
  }
}
if (!typesSource.includes("export interface BackendSchemas") || !typesSource.includes("export interface BackendOperations")) {
  throw new Error("Generated DTO contracts are incomplete. Run npm run contracts:generate.");
}
const curatedPaths = [...resourcesSource.matchAll(/"collectionPath": "([^"]+)"/gu)].map((match) => match[1]);
for (const route of curatedPaths) if (!contract.paths?.[route]) throw new Error(`Generated resource path no longer exists: ${route}`);
console.log(`Contract check passed: ${expected.pathCount} paths, ${expected.operationCount} operations, ${Object.keys(contract.components?.schemas ?? {}).length} schemas, ${curatedPaths.length} curated resources.`);
