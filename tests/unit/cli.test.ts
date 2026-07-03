import { Writable } from "node:stream";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { runCli } from "../../src/cli/index.js";
import type { DownloadOptions, UploadOptions } from "../../src/types/index.js";

class MemoryStream extends Writable {
  output = "";
  isTTY = false;

  _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.output += chunk.toString();
    callback();
  }
}

describe("CLI", () => {
  it("returns readable missing source errors", async () => {
    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const exitCode = await runCli({
      argv: ["node", "scp-next", "upload"],
      output: { stdout, stderr },
      handlers: mockHandlers(),
      cwd: process.cwd()
    });

    expect(exitCode).toBe(1);
    expect(stderr.output).toContain("Error: Missing source path.");
    expect(stderr.output).toContain("scp-next upload <source> <destination> [options]");
  });

  it("dry-runs without calling transfer handlers and redacts secrets", async () => {
    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const handlers = mockHandlers();
    const exitCode = await runCli({
      argv: [
        "node",
        "scp-next",
        "upload",
        "./dist",
        "/var/www/example",
        "--host",
        "example.com",
        "--username",
        "deploy",
        "--password",
        "secret",
        "--dry-run",
        "--recursive"
      ],
      output: { stdout, stderr },
      handlers,
      cwd: process.cwd()
    });

    expect(exitCode).toBe(0);
    expect(stdout.output).toContain("Dry run: upload");
    expect(stdout.output).toContain("Recursive: yes");
    expect(`${stdout.output}${stderr.output}`).not.toContain("secret");
    expect(handlers.upload).not.toHaveBeenCalled();
  });

  it("maps upload source to localPath and destination to remotePath", async () => {
    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const handlers = mockHandlers();
    const exitCode = await runCli({
      argv: [
        "node",
        "scp-next",
        "upload",
        "./dist",
        "/var/www/example",
        "--host",
        "example.com",
        "--username",
        "deploy",
        "--password",
        "secret"
      ],
      output: { stdout, stderr },
      handlers,
      cwd: "/workspace"
    });

    expect(exitCode).toBe(0);
    expect(handlers.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        localPath: path.resolve("/workspace", "./dist"),
        remotePath: "/var/www/example"
      })
    );
  });

  it("maps download source to remotePath and destination to localPath", async () => {
    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const handlers = mockHandlers();
    const exitCode = await runCli({
      argv: [
        "node",
        "scp-next",
        "download",
        "/var/log/example.log",
        "./logs/example.log",
        "--host",
        "example.com",
        "--username",
        "deploy",
        "--password",
        "secret"
      ],
      output: { stdout, stderr },
      handlers,
      cwd: "/workspace"
    });

    expect(exitCode).toBe(0);
    expect(handlers.download).toHaveBeenCalledWith(
      expect.objectContaining({
        remotePath: "/var/log/example.log",
        localPath: path.resolve("/workspace", "./logs/example.log")
      })
    );
  });
});

function mockHandlers() {
  return {
    upload: vi.fn<(options: UploadOptions) => Promise<void>>().mockResolvedValue(undefined),
    download: vi.fn<(options: DownloadOptions) => Promise<void>>().mockResolvedValue(undefined)
  };
}
