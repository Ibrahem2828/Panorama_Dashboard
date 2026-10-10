import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = JSON.parse(fs.readFileSync(path.join(root, "contracts/backend/contract-target.json"), "utf8"));
const source = process.env.BACKEND_OPENAPI_SOURCE;
const yamlSource = process.env.BACKEND_OPENAPI_YAML_SOURCE;

if (!source) {
  throw new Error("BACKEND_OPENAPI_SOURCE is required. Supply the approved canonical docs/api/openapi.json artifact (HTTPS URL or local file path).");
}

async function readSource(value) {
  if (/^https:\/\//iu.test(value)) {
    const response = await fetch(value, { redirect: "error", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`OpenAPI download failed with HTTP ${response.status}.`);
    return Buffer.from(await response.arrayBuffer());
  }
  if (/^[a-z]+:\/\//iu.test(value)) throw new Error("OpenAPI source must use HTTPS or a local file path.");
  return fs.readFileSync(path.resolve(value));
}

function inspect(raw) {
  const text = raw.toString("utf8");
  const document = JSON.parse(text);
  const methods = new Set(["get", "post", "put", "patch", "delete"]);
  const operationCount = Object.values(document.paths ?? {}).reduce(
    (count, item) => count + Object.keys(item ?? {}).filter((method) => methods.has(method)).length,
    0,
  );
  return {
    sha256: crypto.createHash("sha256").update(raw).digest("hex"),
    pathCount: Object.keys(document.paths ?? {}).length,
    operationCount,
    schemaCount: Object.keys(document.components?.schemas ?? {}).length,
  };
}

const raw = await readSource(source);
const actual = inspect(raw);
for (const key of ["sha256", "pathCount", "operationCount", "schemaCount"]) {
  if (actual[key] !== target[key]) {
    throw new Error(`Rejected non-canonical OpenAPI: expected ${key}=${target[key]}, received ${actual[key]}.`);
  }
}

fs.writeFileSync(path.join(root, "contracts/backend/openapi.json"), raw);
if (yamlSource) {
  const yaml = await readSource(yamlSource);
  if (!yaml.toString("utf8").trimStart().startsWith("openapi:")) {
    throw new Error("The optional BACKEND_OPENAPI_YAML_SOURCE is not an OpenAPI YAML document.");
  }
  fs.writeFileSync(path.join(root, "contracts/backend/openapi.yaml"), yaml);
}
console.log(`Synced canonical OpenAPI: ${actual.sha256}, ${actual.pathCount} paths, ${actual.operationCount} operations, ${actual.schemaCount} schemas.`);
if (yamlSource) console.log("Synced the matching OpenAPI YAML mirror.");
