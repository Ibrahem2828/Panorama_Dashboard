import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextDirectory = path.join(root, ".next");
fs.rmSync(nextDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
console.log("Removed generated .next cache. Start the development server after this command completes.");
