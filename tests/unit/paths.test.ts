import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { expandHome } from "../../src/paths/local-path.js";
import { normalizeRemotePath, remoteJoin } from "../../src/paths/remote-path.js";

describe("path handling", () => {
  it("expands home directories for local paths", () => {
    expect(expandHome("~/key")).toBe(path.join(os.homedir(), "key"));
  });

  it("uses POSIX behavior for remote paths", () => {
    expect(normalizeRemotePath("/var//www/example")).toBe("/var/www/example");
    expect(remoteJoin("/var/www", "app.js")).toBe("/var/www/app.js");
  });
});
