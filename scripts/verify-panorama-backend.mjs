import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseUrl = (process.env.BACKEND_API_BASE_URL ?? "https://api.xn--mgbaab0cxheq.tech").replace(/\/+$/u, "");
const timeoutMs = Number(process.env.BACKEND_REQUEST_TIMEOUT_MS ?? 12_000);
const healthPaths = ["/api/v1/health/live/", "/api/v1/health/ready/", "/api/v1/health/startup/"];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(fs.readFileSync(path.join(root, "contracts/backend/openapi.json"), "utf8"));
const loginSchema = contract.components?.schemas?.LoginRequest;

if (!loginSchema?.required?.includes("identifier") || !loginSchema.required.includes("password")) {
  throw new Error("The canonical OpenAPI LoginRequest schema no longer supports the safe invalid-login probe.");
}

function isApplicationLevelLoginStatus(status) {
  return status >= 400 && status < 500;
}

function redact(value, depth = 0) {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, item]) => [
      key,
      /(?:access|refresh|token|password|secret|authorization|cookie)/iu.test(key) ? "[redacted]" : redact(item, depth + 1),
    ]));
  }
  return typeof value === "string" && value.length > 300 ? `${value.slice(0, 300)}…` : value;
}

async function safeResponseBody(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return contentType ? `[non-JSON: ${contentType}]` : null;
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return redact(JSON.parse(text));
  } catch {
    return "[invalid JSON response]";
  }
}

async function probe(pathname, init, accepted) {
  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...init,
      headers: { Accept: "application/json", "X-Request-ID": requestId, ...(init.headers ?? {}) },
      redirect: "manual",
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;
    const result = {
      pathname,
      status: response.status,
      requestId: response.headers.get("x-request-id") ?? requestId,
      durationMs,
      location: response.headers.get("location"),
      response: await safeResponseBody(response),
      accepted: accepted(response.status),
    };
    console.log(JSON.stringify(result));
    return result.accepted;
  } catch (error) {
    const result = {
      pathname,
      status: null,
      requestId,
      durationMs: Date.now() - startedAt,
      errorClass: error instanceof Error ? error.constructor.name : "UnknownError",
      errorCode: error && typeof error === "object" && "code" in error ? String(error.code) : null,
      accepted: false,
    };
    console.log(JSON.stringify(result));
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

let healthy = true;
for (const pathname of healthPaths) {
  healthy = (await probe(pathname, {}, (status) => status >= 200 && status < 300)) && healthy;
}
const loginReachedApplication = await probe(
  "/api/v1/auth/login/",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Matches the canonical LoginRequest fields. Values are intentionally
    // invalid and never printed by this script.
    body: JSON.stringify({ identifier: "invalid@example.test", password: "invalid-password" }),
  },
  isApplicationLevelLoginStatus,
);

if (!healthy || !loginReachedApplication) {
  console.error("Panorama backend verification failed.");
  process.exitCode = 1;
} else {
  console.log("Panorama backend verification passed.");
}
