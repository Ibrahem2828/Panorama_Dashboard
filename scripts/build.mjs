import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

function runNext(args, env = {}) {
  return spawnSync(process.execPath, [nextBin, ...args], {
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });
}

function printResult(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

const normalBuild = runNext(["build"]);

if (normalBuild.status === 0) {
  printResult(normalBuild);
  process.exit(0);
}

const output = `${normalBuild.stdout ?? ""}\n${normalBuild.stderr ?? ""}`;
const canUseWasmFallback =
  output.includes("Failed to load SWC binary") ||
  output.includes("native bindings are not available") ||
  output.includes("not a valid Win32 application");

if (!canUseWasmFallback) {
  printResult(normalBuild);
  process.exit(normalBuild.status ?? 1);
}

const wasmDir = dirname(require.resolve("@next/swc-wasm-nodejs/wasm.js"));
process.stdout.write("\nFalling back to Next.js webpack build with SWC WASM bindings.\n\n");

const fallbackBuild = runNext(["build", "--webpack"], {
  NEXT_TEST_WASM_DIR: wasmDir,
});

if (fallbackBuild.status !== 0) {
  process.stderr.write("The normal Next.js build failed before the fallback attempt:\n\n");
  printResult(normalBuild);
}

printResult(fallbackBuild);
process.exit(fallbackBuild.status ?? 1);
