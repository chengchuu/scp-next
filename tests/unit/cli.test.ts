import { mkdir, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import { Writable } from "node:stream";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { isCliEntrypoint, runCli } from "../../src/cli/index.js";
import { createDownloadCommand } from "../../src/cli/commands/download.js";
import { createRunCommand } from "../../src/cli/commands/run.js";
import { createUploadCommand } from "../../src/cli/commands/upload.js";
import { RemoteCommandError } from "../../src/errors/index.js";
import type {
  DownloadOptions,
  ExecResult,
  UploadOptions
} from "../../src/types/index.js";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json") as { version: string };

class MemoryStream extends Writable {
  output = "";
  isTTY = false;

  _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.output += chunk.toString();
    callback();
  }
}

describe("CLI", () => {
  it("prints the package version", async () => {
    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const exitCode = await runCli({
      argv: ["node", "scp-next", "--version"],
      output: { stdout, stderr },
      handlers: mockHandlers(),
      cwd: process.cwd()
    });

    expect(exitCode).toBe(0);
    expect(stdout.output.trim()).toBe(packageJson.version);
  });

  it("shows source and destination before options in root help", async () => {
    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const exitCode = await runCli({
      argv: ["node", "scp-next", "--help"],
      output: { stdout, stderr },
      handlers: mockHandlers(),
      cwd: process.cwd()
    });

    expect(exitCode).toBe(0);
    expect(stdout.output).toContain("upload <source> <destination> [options]");
    expect(stdout.output).not.toContain("upload [options] [source] [destination]");
    expect(stdout.output).toContain("download <source> <destination> [options]");
    expect(stdout.output).not.toContain("download [options] [source] [destination]");
    expect(stdout.output).toContain("run <job> [source] [destination] [options]");
  });

  it("recognizes symlinked npm bin paths as the CLI entrypoint", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests", "cli-symlink");
    const realFile = path.join(directory, "index.js");
    const linkedFile = path.join(directory, "scp-next");
    await mkdir(directory, { recursive: true });
    await writeFile(realFile, "console.log('cli');\n");
    await symlink(realFile, linkedFile).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") {
        throw error;
      }
    });

    expect(isCliEntrypoint(pathToFileURL(realFile).href, ["node", linkedFile])).toBe(true);
  });

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

  it("allows createDirectories to be disabled from the CLI", async () => {
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
        "--no-create-directories"
      ],
      output: { stdout, stderr },
      handlers,
      cwd: process.cwd()
    });

    expect(exitCode).toBe(0);
    expect(stdout.output).toContain("Dry run: upload");
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

  it("collects repeated post-upload commands in order", async () => {
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
        "--post-upload-command",
        "npm install --omit=dev",
        "--post-upload-command",
        "pm2 reload example"
      ],
      output: { stdout, stderr },
      handlers,
      cwd: "/workspace"
    });

    expect(exitCode).toBe(0);
    expect(handlers.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        postUploadCommands: ["npm install --omit=dev", "pm2 reload example"]
      })
    );
  });

  it("maps post-upload commands for configured upload jobs", async () => {
    const directory = path.join(
      os.tmpdir(),
      "scp-next-tests",
      `cli-run-post-upload-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    const configPath = path.join(directory, "scp-next.config.json");
    await mkdir(directory, { recursive: true });
    await writeFile(
      configPath,
      JSON.stringify({
        jobs: {
          deploy: {
            operation: "upload",
            source: "./dist",
            destination: "/var/www/example"
          }
        }
      })
    );
    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const handlers = mockHandlers();

    const exitCode = await runCli({
      argv: [
        "node",
        "scp-next",
        "run",
        "deploy",
        "--config",
        configPath,
        "--host",
        "example.com",
        "--username",
        "deploy",
        "--password",
        "secret",
        "--post-upload-command",
        "pm2 reload example"
      ],
      output: { stdout, stderr },
      handlers,
      cwd: directory
    });

    expect(exitCode).toBe(0);
    expect(handlers.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        postUploadCommands: ["pm2 reload example"]
      })
    );
  });

  it("does not expose the unreleased after-upload alias", () => {
    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const output = { stdout, stderr };
    const handlers = mockHandlers();
    const uploadOptions = createUploadCommand(handlers, output, "/workspace").options.map(
      (option) => option.long
    );
    const runOptions = createRunCommand(handlers, output, "/workspace").options.map(
      (option) => option.long
    );
    const downloadOptions = createDownloadCommand(
      handlers,
      output,
      "/workspace"
    ).options.map((option) => option.long);

    expect(uploadOptions).toContain("--post-upload-command");
    expect(runOptions).toContain("--post-upload-command");
    expect(downloadOptions).not.toContain("--post-upload-command");
    expect([...uploadOptions, ...runOptions, ...downloadOptions]).not.toContain(
      "--after-upload"
    );
  });

  it("shows redacted post-upload commands during dry-run without executing them", async () => {
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
        "top-secret",
        "--dry-run",
        "--post-upload-command",
        "deploy --token top-secret"
      ],
      output: { stdout, stderr },
      handlers,
      cwd: "/workspace"
    });

    expect(exitCode).toBe(0);
    expect(stdout.output).toContain("Post-upload commands:");
    expect(stdout.output).toContain("deploy --token [REDACTED]");
    expect(`${stdout.output}${stderr.output}`).not.toContain("top-secret");
    expect(handlers.upload).not.toHaveBeenCalled();
  });

  it("rejects empty post-upload commands during dry-run", async () => {
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
        "--dry-run",
        "--post-upload-command",
        "   "
      ],
      output: { stdout, stderr },
      handlers,
      cwd: "/workspace"
    });

    expect(exitCode).toBe(1);
    expect(stderr.output).toContain(
      "Each --post-upload-command value must be a non-empty command."
    );
    expect(handlers.upload).not.toHaveBeenCalled();
  });

  it("returns a non-zero exit code when a post-upload command fails", async () => {
    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const handlers = mockHandlers();
    handlers.upload.mockRejectedValue(
      new RemoteCommandError("Remote command failed with exit code 7.", {
        exitCode: 7,
        stdout: "partial output",
        stderr: "TOKEN=do-not-print"
      })
    );

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
        "--post-upload-command",
        "false"
      ],
      output: { stdout, stderr },
      handlers,
      cwd: "/workspace"
    });

    expect(exitCode).toBe(1);
    expect(stderr.output).toContain("Remote command failed with exit code 7.");
    expect(stdout.output).toContain("partial output");
    expect(stderr.output).toContain("TOKEN=[REDACTED]");
    expect(stderr.output).not.toContain("do-not-print");
    expect(stderr.output).not.toContain("false");
  });
});

function mockHandlers() {
  return {
    upload: vi
      .fn<(options: UploadOptions) => Promise<ExecResult[]>>()
      .mockResolvedValue([]),
    download: vi.fn<(options: DownloadOptions) => Promise<void>>().mockResolvedValue(undefined)
  };
}
