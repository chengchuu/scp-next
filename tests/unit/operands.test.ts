import { describe, expect, it } from "vitest";

import { assertSourceDestination } from "../../src/cli/operands.js";

describe("positional operands", () => {
  it("reports missing source paths", () => {
    expect(() => assertSourceDestination("upload", undefined, "/remote")).toThrow(
      "Missing source path"
    );
  });

  it("reports missing destination paths", () => {
    expect(() => assertSourceDestination("download", "/remote", undefined)).toThrow(
      "Missing destination path"
    );
  });
});
