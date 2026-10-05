import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const navigation = fs.readFileSync(path.join(root, "src/config/navigation.ts"), "utf8");
const hrefs = [...navigation.matchAll(/href:\s*"(\/dashboard[^"]*)"/gu)].map((match) => match[1]);
const missing = [];
for (const href of new Set(hrefs)) {
  const route = href === "/dashboard" ? "src/app/[locale]/dashboard/page.tsx" : `src/app/[locale]${href}/page.tsx`;
  if (!fs.existsSync(path.join(root, route))) missing.push({ href, route });
}
if (missing.length) throw new Error(`Missing navigation routes:\n${missing.map((item) => `${item.href} -> ${item.route}`).join("\n")}`);
console.log(`Route check passed: ${new Set(hrefs).size} navigation targets have pages.`);
