import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts"
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    target: "node18",
    platform: "node",
    shims: false
  },
  {
    entry: {
      "cli/index": "src/cli/index.ts"
    },
    format: ["esm"],
    dts: false,
    sourcemap: true,
    clean: false,
    splitting: false,
    target: "node18",
    platform: "node",
    shims: false,
    banner: {
      js: "#!/usr/bin/env node"
    }
  }
]);
