import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(path.join(standalone, "server.js"))) {
  throw new Error("Standalone build output is missing. Run `next build` before preparing the runtime.");
}

const assets = [
  [path.join(root, "public"), path.join(standalone, "public")],
  [path.join(root, ".next", "static"), path.join(standalone, ".next", "static")],
];

for (const [source, destination] of assets) {
  if (existsSync(source)) cpSync(source, destination, { recursive: true, force: true });
}

console.log("Standalone runtime assets prepared.");