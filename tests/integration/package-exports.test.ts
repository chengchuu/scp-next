import { createRequire } from "node:module";
import { access } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createClient, download, upload } from "../../src/index.js";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json") as {
  exports: {
    ".": {
      import: { types: string; default: string };
      require: { types: string; default: string };
    };
  };
};

describe("package exports", () => {
  it("exposes ESM exports from source", () => {
    expect(upload).toBeTypeOf("function");
    expect(download).toBeTypeOf("function");
    expect(createClient).toBeTypeOf("function");
  });

  it("provides module-specific declarations for ESM and CommonJS", () => {
    expect(packageJson.exports["."].import).toEqual({
      types: "./dist/index.d.ts",
      default: "./dist/index.js"
    });
    expect(packageJson.exports["."].require).toEqual({
      types: "./dist/index.d.cts",
      default: "./dist/index.cjs"
    });
  });

  it("exposes CommonJS exports after build", async () => {
    try {
      await access("dist/index.cjs");
    } catch {
      return;
    }

    const cjs = require("../../dist/index.cjs") as Record<string, unknown>;
    expect(cjs.upload).toBeTypeOf("function");
    expect(cjs.download).toBeTypeOf("function");
    expect(cjs.createClient).toBeTypeOf("function");
  });
});
