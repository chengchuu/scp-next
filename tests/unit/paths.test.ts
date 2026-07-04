import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { expandHome } from "../../src/paths/local-path.js";
import {
  normalizeRemotePath,
  remoteJoin,
  restoreMsysConvertedRemotePath
} from "../../src/paths/remote-path.js";

describe("path handling", () => {
  it("expands home directories for local paths", () => {
    expect(expandHome("~/key")).toBe(path.join(os.homedir(), "key"));
  });

  it("uses POSIX behavior for remote paths", () => {
    expect(normalizeRemotePath("/var//www/example")).toBe("/var/www/example");
    expect(remoteJoin("/var/www", "app.js")).toBe("/var/www/app.js");
  });

  it("restores remote paths converted by Git Bash path rewriting", () => {
    expect(restoreMsysConvertedRemotePath("C:/Program Files/Git/web-test-26-0703/T01.md")).toBe(
      "/web-test-26-0703/T01.md"
    );
    expect(restoreMsysConvertedRemotePath("C:\\Program Files\\Git\\var\\www\\app.js")).toBe(
      "/var/www/app.js"
    );
    expect(restoreMsysConvertedRemotePath("/var/www/app.js")).toBe("/var/www/app.js");
  });
});
