import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const wasmDir = dirname(require.resolve("@next/swc-wasm-nodejs/wasm.js"));

const passthroughArgs = process.argv.slice(2);

const dev = spawn(process.execPath, [nextBin, "dev", "--webpack", ...passthroughArgs], {
  env: {
    ...process.env,
    NEXT_TEST_WASM_DIR: wasmDir,
  },
  stdio: "inherit",
});

dev.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 0);
});
