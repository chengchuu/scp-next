import { readFile } from "node:fs/promises";
import { URL } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  copyExampleText,
  generateCliExample,
  generateTypeScriptExample
} from "../site/examples/index.ts";

const base = {
  exampleInterface: "cli",
  host: "deploy.example",
  localPath: "./build output",
  operation: "upload",
  recursive: true,
  remotePath: "/var/www/example",
  username: "deploy"
};

describe("website example generator", () => {
  it("keeps the copy control hidden until its script initializes", async () => {
    const template = await readFile(
      new URL("../site/examples/index.html", import.meta.url),
      "utf8"
    );

    expect(template).toMatch(/data-copy-example\s+hidden/);
  });

  it("maps upload from local source to remote destination", () => {
    expect(generateCliExample(base)).toContain(
      "scp-next upload './build output' /var/www/example"
    );
    expect(generateCliExample(base)).toContain("--dry-run");
  });

  it("maps download from remote source to local destination", () => {
    const source = generateCliExample({
      ...base,
      operation: "download",
      recursive: false
    });
    expect(source).toContain("scp-next download /var/www/example './build output'");
    expect(source).toContain("  --username deploy \\\n  --dry-run");
    expect(source).not.toContain("--recursive");
  });

  it("uses entered connection values and keeps the password in the environment", () => {
    const source = generateTypeScriptExample({
      ...base,
      exampleInterface: "typescript"
    });
    expect(source).toContain('import { upload } from "scp-next";');
    expect(source).toContain('host: "deploy.example"');
    expect(source).toContain('username: "deploy"');
    expect(source).toContain("password: process.env.SCP_NEXT_PASSWORD");
    expect(source).toContain("dryRun: true");
    expect(source).not.toContain("your-password");
  });

  it("copies the complete generated example", async () => {
    const source = generateCliExample(base);
    const writeText = vi.fn().mockResolvedValue(undefined);

    await copyExampleText(source, writeText);

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith(source);
  });
});
