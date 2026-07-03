import { createRequire } from "node:module";
import { access } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createClient, download, upload } from "../../src/index.js";

describe("package exports", () => {
  it("exposes ESM exports from source", () => {
    expect(upload).toBeTypeOf("function");
    expect(download).toBeTypeOf("function");
    expect(createClient).toBeTypeOf("function");
  });

  it("exposes CommonJS exports after build", async () => {
    try {
      await access("dist/index.cjs");
    } catch {
      return;
    }

    const require = createRequire(import.meta.url);
    const cjs = require("../../dist/index.cjs") as Record<string, unknown>;
    expect(cjs.upload).toBeTypeOf("function");
    expect(cjs.download).toBeTypeOf("function");
    expect(cjs.createClient).toBeTypeOf("function");
  });
});
