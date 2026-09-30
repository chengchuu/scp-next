import { builtinModules } from "node:module";
import { rmSync } from "node:fs";

import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { dts } from "rollup-plugin-dts";

import pkg from "../package.json" with { type: "json" };

const dependencies = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`)
]);
const external = (id) =>
  [...dependencies].some(
    (dependency) => id === dependency || id.startsWith(`${dependency}/`)
  );
const sourcePlugin = () =>
  typescript({
    tsconfig: "./tsconfig.json",
    declaration: false,
    declarationMap: false,
    noEmit: false,
    sourceMap: true
  });
const cleanDist = {
  name: "clean-dist",
  buildStart() {
    rmSync("dist", { recursive: true, force: true });
  }
};

export default [
  {
    input: "src/index.ts",
    external,
    plugins: [
      cleanDist,
      nodeResolve({ extensions: [".mjs", ".js", ".json", ".ts"] }),
      sourcePlugin()
    ],
    output: [
      { file: "dist/index.js", format: "esm", sourcemap: true },
      { file: "dist/index.cjs", format: "cjs", exports: "named", sourcemap: true }
    ]
  },
  {
    input: "src/cli/index.ts",
    external,
    plugins: [
      nodeResolve({ extensions: [".mjs", ".js", ".json", ".ts"] }),
      sourcePlugin()
    ],
    output: {
      file: "dist/cli/index.js",
      format: "esm",
      sourcemap: true,
      banner: "#!/usr/bin/env node"
    }
  },
  {
    input: "src/index.ts",
    external,
    plugins: [dts({ tsconfig: "./tsconfig.json" })],
    output: [
      { file: "dist/index.d.ts", format: "esm" },
      { file: "dist/index.d.cts", format: "esm" }
    ]
  }
];
