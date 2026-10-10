import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "src");
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (/\.(?:ts|tsx|js|mjs)$/u.test(entry.name)) files.push(target);
  }
}
walk(sourceRoot);
const rules = [
  { name: "JWT stored in local/session storage", pattern: /(?:localStorage|sessionStorage)\.(?:setItem|getItem)\([^\n]*(?:access|refresh|jwt|token)/iu },
  { name: "public backend API environment variable", pattern: /NEXT_PUBLIC_(?:API|BACKEND)/u },
  { name: "legacy token-storage import", pattern: /from\s+["']@\/lib\/auth\/token-storage["']/u },
  { name: "direct Axios import", pattern: /from\s+["']axios["']/u },
  { name: "client bearer authorization", pattern: /["']use client["'][\s\S]*Authorization\s*[:,][\s\S]*Bearer/u },
  { name: "hard-coded bearer token", pattern: /Authorization["']?\s*[:,]\s*["']Bearer\s+[A-Za-z0-9._-]{16,}/u },
  { name: "dangerouslySetInnerHTML", pattern: /dangerouslySetInnerHTML/u },
  { name: "production secret literal", pattern: /(?:SECRET_KEY|DATABASE_URL|REDIS_URL)\s*=\s*["'][^"']{8,}["']/u },
];
const failures = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const rule of rules) if (rule.pattern.test(text)) failures.push(`${rule.name}: ${path.relative(root, file)}`);
}
const proxy = fs.readFileSync(path.join(root, "src/app/api/backend/[...path]/route.ts"), "utf8");
if (!proxy.includes("assertCsrf(request)")) failures.push("Secure proxy does not enforce CSRF on mutations.");
const cookies = fs.readFileSync(path.join(root, "src/lib/auth/cookies.ts"), "utf8");
if (!cookies.includes("httpOnly: true")) failures.push("Session cookies are not HttpOnly.");
if (!cookies.includes("sameSite: \"lax\"")) failures.push("Session cookies do not use SameSite=Lax.");
if (failures.length) throw new Error(`Security source check failed:\n- ${failures.join("\n- ")}`);
console.log(`Security source check passed across ${files.length} source files.`);

