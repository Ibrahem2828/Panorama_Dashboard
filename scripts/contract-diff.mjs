import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const oldSource = process.env.OLD_OPENAPI_SOURCE;
const newSource = process.env.NEW_OPENAPI_SOURCE ?? path.join(root, "contracts/backend/openapi.json");
const output = process.env.CONTRACT_DIFF_OUTPUT ?? path.join(root, "docs/reports/CONTRACT_DIFF.json");
const methods = new Set(["get", "post", "put", "patch", "delete"]);

if (!oldSource) throw new Error("OLD_OPENAPI_SOURCE is required for a real contract diff.");

function readDocument(source) {
  const raw = fs.readFileSync(path.resolve(source));
  return { source: path.resolve(source), raw, document: JSON.parse(raw.toString("utf8")) };
}

function hash(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

function operationMap(document) {
  const entries = new Map();
  for (const [pathname, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!methods.has(method)) continue;
      entries.set(`${method.toUpperCase()} ${pathname}`, { method: method.toUpperCase(), pathname, operation });
    }
  }
  return entries;
}

function changedFields(oldOperation, newOperation) {
  const fields = ["operationId", "parameters", "requestBody", "responses", "security", "deprecated"];
  return fields.filter((field) => JSON.stringify(stable(oldOperation[field])) !== JSON.stringify(stable(newOperation[field])));
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function pathPattern(template) {
  const pathname = template.split("?", 1)[0].replace(/\$\{[^}]+\}/gu, "{parameter}");
  const escaped = pathname.split(/(\{[^}]+\})/gu)
    .map((part) => part.startsWith("{") ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join("");
  return new RegExp(`^${escaped}$`, "u");
}

function dashboardCalls() {
  const calls = [];
  const sourceRoot = path.join(root, "src");
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (/\.(?:ts|tsx)$/u.test(entry.name)) files.push(target);
    }
  };
  walk(sourceRoot);
  const callPattern = /(?:apiFetch|downloadFromBackend)\(\s*([`"'])([^`"']+)\1([\s\S]{0,240}?)\)/gu;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(callPattern)) {
      const target = match[2];
      if (!target.startsWith("/api/v1/")) continue;
      const details = match[3] ?? "";
      const method = details.match(/method\s*:\s*["'](GET|POST|PUT|PATCH|DELETE)["']/iu)?.[1]?.toUpperCase() ?? "GET";
      calls.push({
        file: path.relative(root, file).replaceAll("\\", "/"),
        line: lineNumber(source, match.index ?? 0),
        method,
        pathTemplate: target.split("?", 1)[0],
      });
    }
  }
  return calls;
}

const oldContract = readDocument(oldSource);
const newContract = readDocument(newSource);
const oldOperations = operationMap(oldContract.document);
const newOperations = operationMap(newContract.document);
const added = [...newOperations.keys()].filter((key) => !oldOperations.has(key)).sort();
const removed = [...oldOperations.keys()].filter((key) => !newOperations.has(key)).sort();
const changed = [...newOperations.keys()]
  .filter((key) => oldOperations.has(key))
  .map((key) => ({ operation: key, fields: changedFields(oldOperations.get(key).operation, newOperations.get(key).operation) }))
  .filter((entry) => entry.fields.length)
  .sort((left, right) => left.operation.localeCompare(right.operation));
const deprecated = [...newOperations.values()]
  .filter(({ operation }) => operation.deprecated === true)
  .map(({ method, pathname }) => `${method} ${pathname}`)
  .sort();

const finalOperations = [...newOperations.values()];
const calls = dashboardCalls().map((call) => {
  const matcher = pathPattern(call.pathTemplate);
  const matchingOperations = finalOperations.filter((operation) => operation.method === call.method && matcher.test(operation.pathname));
  return {
    ...call,
    status: matchingOperations.length === 1 ? "documented" : matchingOperations.length ? "ambiguous_template" : "off_contract",
    matchingOperations: matchingOperations.map((operation) => `${operation.method} ${operation.pathname}`),
  };
});
const unsupportedCalls = calls.filter((call) => call.status === "off_contract");

const report = {
  generatedBy: "scripts/contract-diff.mjs",
  old: { source: oldContract.source, sha256: hash(oldContract.raw), paths: Object.keys(oldContract.document.paths ?? {}).length, operations: oldOperations.size, schemas: Object.keys(oldContract.document.components?.schemas ?? {}).length },
  next: { source: newContract.source, sha256: hash(newContract.raw), paths: Object.keys(newContract.document.paths ?? {}).length, operations: newOperations.size, schemas: Object.keys(newContract.document.components?.schemas ?? {}).length },
  added,
  removed,
  changed,
  deprecated,
  dashboardCallAudit: { calls, unsupportedCalls },
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Contract diff written to ${path.relative(root, output)}: ${added.length} added, ${removed.length} removed, ${changed.length} changed, ${deprecated.length} deprecated, ${unsupportedCalls.length} off-contract dashboard calls.`);
if (unsupportedCalls.length) process.exitCode = 1;
