import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(root, "contracts/backend/openapi.json");
const outputDir = path.join(root, "src/contracts/generated");
const contractRaw = fs.readFileSync(contractPath, "utf8");
const contract = JSON.parse(contractRaw);
const schemas = contract.components?.schemas ?? {};
const supportedMethods = new Set(["get", "post", "put", "patch", "delete"]);

const curatedResources = {
  users: "/api/v1/dashboard/users/",
  universities: "/api/v1/dashboard/universities/",
  faculties: "/api/v1/dashboard/faculties/",
  majors: "/api/v1/dashboard/majors/",
  "academic-years": "/api/v1/dashboard/academic-years/",
  semesters: "/api/v1/dashboard/semesters/",
  subjects: "/api/v1/dashboard/subjects/",
  verifications: "/api/v1/dashboard/verifications/",
  lectures: "/api/v1/dashboard/lectures/",
  files: "/api/v1/dashboard/files/",
  groups: "/api/v1/dashboard/groups/",
  announcements: "/api/v1/dashboard/announcements/",
  "printing-orders": "/api/v1/dashboard/printing/orders/",
  "printing-pricing-rules": "/api/v1/dashboard/printing/pricing-rules/",
  "printing-binding-prices": "/api/v1/dashboard/printing/binding-prices/",
  "printing-pickup-locations": "/api/v1/dashboard/printing/pickup-locations/",
  "support-tickets": "/api/v1/dashboard/support/tickets/",
  feedback: "/api/v1/dashboard/feedback/",
  "feedback-prompt-policies": "/api/v1/dashboard/feedback-prompt-policies/",
  "mobile-release-policies": "/api/v1/dashboard/mobile-release-policies/",
  "maintenance-modes": "/api/v1/dashboard/maintenance-modes/",
  "feature-flags": "/api/v1/dashboard/feature-flags/",
  "privacy-policy-versions": "/api/v1/dashboard/privacy-policy-versions/",
  "terms-versions": "/api/v1/dashboard/terms-versions/",
  "audit-logs": "/api/v1/dashboard/audit-logs/"
};

function resolveSchema(schema, depth = 0) {
  if (!schema || depth > 12) return {};
  if (schema.$ref) {
    const name = schema.$ref.split("/").at(-1);
    return resolveSchema(schemas[name], depth + 1);
  }
  if (schema.allOf) {
    return schema.allOf.reduce((result, item) => {
      const resolved = resolveSchema(item, depth + 1);
      return {
        ...result,
        ...resolved,
        properties: { ...(result.properties ?? {}), ...(resolved.properties ?? {}) },
        required: [...new Set([...(result.required ?? []), ...(resolved.required ?? [])])]
      };
    }, {});
  }
  if (schema.oneOf || schema.anyOf) {
    const candidates = schema.oneOf ?? schema.anyOf;
    const nonNull = candidates.find((item) => item.type !== "null") ?? candidates[0];
    return { ...resolveSchema(nonNull, depth + 1), nullable: candidates.some((item) => item.type === "null") };
  }
  return schema;
}

function schemaFromOperation(operation) {
  const content = operation?.requestBody?.content ?? {};
  const preferred = content["application/json"] ?? content["multipart/form-data"] ?? content["application/x-www-form-urlencoded"];
  return preferred?.schema ? resolveSchema(preferred.schema) : null;
}

function enumValues(schema) {
  const resolved = resolveSchema(schema);
  if (Array.isArray(resolved.enum)) return resolved.enum;
  if (resolved.oneOf) return resolved.oneOf.flatMap((entry) => enumValues(entry));
  return undefined;
}

function typePropertyName(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name) ? name : JSON.stringify(name);
}

function schemaType(schema, depth = 0) {
  if (!schema || depth > 16) return "unknown";
  if (schema.$ref) {
    const name = schema.$ref.split("/").at(-1);
    return name ? `BackendSchemas[${JSON.stringify(name)}]` : "unknown";
  }
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.oneOf || schema.anyOf) {
    const values = schema.oneOf ?? schema.anyOf;
    return values.map((entry) => schemaType(entry, depth + 1)).join(" | ");
  }
  if (schema.allOf) return schema.allOf.map((entry) => schemaType(entry, depth + 1)).join(" & ");
  const resolved = resolveSchema(schema, depth + 1);
  if (Array.isArray(resolved.enum) && resolved.enum.length) return resolved.enum.map((value) => JSON.stringify(value)).join(" | ");
  if (resolved.type === "array") return `Array<${schemaType(resolved.items, depth + 1)}>`;
  if (resolved.type === "boolean") return "boolean";
  if (resolved.type === "integer" || resolved.type === "number") return "number";
  if (resolved.type === "string") return "string";
  if (resolved.type === "object" || resolved.properties) {
    const required = new Set(resolved.required ?? []);
    const fields = Object.entries(resolved.properties ?? {}).map(([name, property]) =>
      `${typePropertyName(name)}${required.has(name) ? "" : "?"}: ${schemaType(property, depth + 1)};`,
    );
    if (resolved.additionalProperties && typeof resolved.additionalProperties === "object") {
      fields.push(`[key: string]: ${schemaType(resolved.additionalProperties, depth + 1)};`);
    }
    return fields.length ? `{ ${fields.join(" ")} }` : "Record<string, unknown>";
  }
  return "unknown";
}

function responseSchema(operation) {
  const response = Object.entries(operation?.responses ?? {}).find(([status]) => /^2\d\d$/u.test(status))?.[1];
  const content = response?.content ?? {};
  const preferred = content["application/json"] ?? content["application/problem+json"] ?? Object.values(content)[0];
  return preferred?.schema ?? null;
}

function inferField(name, schema, required) {
  const resolved = resolveSchema(schema);
  const type = resolved.type ?? (resolved.properties ? "object" : "string");
  const format = resolved.format;
  let input = "text";
  if (format === "binary") input = "file";
  else if (format === "date-time") input = "datetime-local";
  else if (format === "date") input = "date";
  else if (type === "boolean") input = "switch";
  else if (type === "integer" || type === "number") input = "number";
  else if (type === "array" || type === "object") input = "json";
  else if ((resolved.maxLength ?? 0) > 255 || name.includes("description") || name.includes("message") || name.includes("notes")) input = "textarea";
  if (enumValues(resolved)?.length) input = "select";
  return {
    name,
    type,
    input,
    format: format ?? null,
    required,
    nullable: Boolean(resolved.nullable),
    readOnly: Boolean(resolved.readOnly),
    writeOnly: Boolean(resolved.writeOnly),
    minLength: resolved.minLength ?? null,
    maxLength: resolved.maxLength ?? null,
    minimum: resolved.minimum ?? null,
    maximum: resolved.maximum ?? null,
    pattern: resolved.pattern ?? null,
    enum: enumValues(resolved) ?? null,
    defaultValue: resolved.default ?? null,
    description: resolved.description ?? null
  };
}

function operationMethods(pathItem) {
  return Object.keys(pathItem ?? {}).filter((method) => supportedMethods.has(method));
}

function detailPathFor(collectionPath) {
  const prefix = collectionPath.endsWith("/") ? collectionPath : `${collectionPath}/`;
  return Object.keys(contract.paths).find((candidate) => candidate.startsWith(prefix) && /\{(?:id|pk)\}\/$/u.test(candidate)) ?? null;
}

const resources = {};
for (const [key, collectionPath] of Object.entries(curatedResources)) {
  const collection = contract.paths[collectionPath] ?? {};
  const detailPath = detailPathFor(collectionPath);
  const detail = detailPath ? contract.paths[detailPath] ?? {} : {};
  const writeOperation = collection.post ?? detail.patch ?? detail.put ?? null;
  const requestSchema = schemaFromOperation(writeOperation);
  const required = new Set(requestSchema?.required ?? []);
  const fields = Object.entries(requestSchema?.properties ?? {})
    .map(([name, schema]) => inferField(name, schema, required.has(name)))
    .filter((field) => !field.readOnly);
  resources[key] = {
    key,
    collectionPath,
    detailPath,
    collectionMethods: operationMethods(collection),
    detailMethods: operationMethods(detail),
    operationIds: {
      list: collection.get?.operationId ?? null,
      create: collection.post?.operationId ?? null,
      retrieve: detail.get?.operationId ?? null,
      update: detail.put?.operationId ?? null,
      partialUpdate: detail.patch?.operationId ?? null,
      destroy: detail.delete?.operationId ?? null
    },
    fields
  };
}

const operations = [];
for (const [apiPath, pathItem] of Object.entries(contract.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!supportedMethods.has(method)) continue;
    operations.push({
      method: method.toUpperCase(),
      path: apiPath,
      operationId: operation.operationId ?? `${method}_${apiPath}`,
      tags: operation.tags ?? [],
      authenticated: !((operation.security ?? []).some((entry) => Object.keys(entry).length === 0))
    });
  }
}

const digest = crypto.createHash("sha256").update(contractRaw).digest("hex");
const operationPaths = Object.fromEntries(operations.map((operation) => [operation.operationId, operation.path]));
const schemaNames = Object.keys(schemas).sort();
const contractPaths = Object.keys(contract.paths ?? {}).sort();
const generatedSchemas = schemaNames.map((name) => `  ${JSON.stringify(name)}: ${schemaType(schemas[name])};`).join("\n");
const generatedOperationContracts = operations.map((summary) => {
  const operation = contract.paths[summary.path]?.[summary.method.toLowerCase()];
  const request = schemaFromOperation(operation);
  const response = responseSchema(operation);
  return `  ${JSON.stringify(summary.operationId)}: { method: ${JSON.stringify(summary.method)}; path: ${JSON.stringify(summary.path)}; request: ${request ? schemaType(request) : "undefined"}; response: ${response ? schemaType(response) : "unknown"}; };`;
}).join("\n");
fs.mkdirSync(outputDir, { recursive: true });
const banner = `/* AUTO-GENERATED by scripts/generate-contracts.mjs. Do not edit manually. */\n`;
fs.writeFileSync(
  path.join(outputDir, "contract-meta.ts"),
  `${banner}export const CONTRACT_META = ${JSON.stringify({
    title: contract.info?.title ?? "Panorama API",
    version: contract.info?.version ?? "unknown",
    sha256: digest,
    pathCount: Object.keys(contract.paths ?? {}).length,
    operationCount: operations.length,
    schemaCount: Object.keys(schemas).length,
  }, null, 2)} as const;\n`
);
fs.writeFileSync(
  path.join(outputDir, "operations.ts"),
  `${banner}export const API_OPERATIONS = ${JSON.stringify(operations, null, 2)} as const;\n`
);
fs.writeFileSync(
  path.join(outputDir, "types.ts"),
  `${banner}export type BackendSchemaName = ${schemaNames.map((name) => JSON.stringify(name)).join(" | ") || "never"};\n\nexport interface BackendSchemas {\n${generatedSchemas}\n}\n\nexport type BackendSchema<Name extends BackendSchemaName> = BackendSchemas[Name];\n\nexport type BackendOperationId = ${operations.map((operation) => JSON.stringify(operation.operationId)).join(" | ") || "never"};\nexport type BackendContractPath = ${contractPaths.map((route) => JSON.stringify(route)).join(" | ") || "never"};\n\nexport interface BackendOperations {\n${generatedOperationContracts}\n}\n\nexport type BackendOperation<Name extends BackendOperationId> = BackendOperations[Name];\n`
);
fs.writeFileSync(
  path.join(outputDir, "resources.ts"),
  `${banner}import type { ResourceDefinition } from "@/contracts/types";\n\nexport const RESOURCE_DEFINITIONS = ${JSON.stringify(resources, null, 2)} as const satisfies Record<string, ResourceDefinition>;\n`
    + `\nexport const OPERATION_PATHS = ${JSON.stringify(operationPaths, null, 2)} as const;\n`
    + `\nexport function operationPath(operationId: keyof typeof OPERATION_PATHS, parameters: Record<string, string | number> = {}) {\n  return OPERATION_PATHS[operationId].replace(/\\{([^}]+)\\}/gu, (_match, name) => {\n    const value = parameters[name];\n    if (value === undefined) throw new Error(\`Missing contract path parameter: \${name}\`);\n    return encodeURIComponent(String(value));\n  });\n}\n`
);
fs.writeFileSync(
  path.join(outputDir, "resource-definitions.ts"),
  `${banner}export { RESOURCE_DEFINITIONS } from "@/contracts/generated/resources";\n`
);
console.log(`Generated ${operations.length} operations, ${schemaNames.length} schemas and ${Object.keys(resources).length} resource definitions.`);
