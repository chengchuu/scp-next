import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { ScpNextClientImpl } from "../../src/client/client.js";
import type { CommandExecutor } from "../../src/client/command-executor.js";
import type { SftpTransport, TransferStep } from "../../src/client/transport.js";
import { RemoteCommandError } from "../../src/errors/index.js";
import type {
  ExecOptions,
  ExecResult,
  ScpServerOptions
} from "../../src/types/index.js";

class MockTransport implements SftpTransport {
  connect = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  exists = vi.fn<(remotePath: string) => Promise<false | "-" | "d" | "l">>().mockImplementation((remotePath) => {
    if (remotePath === "/var/www" || remotePath === "/var/www/") return Promise.resolve("d");
    if (remotePath === "/var/log/example.log") return Promise.resolve("-");
    if (remotePath === "/var/log/example") return Promise.resolve("d");
    return Promise.resolve(false);
  });
  mkdir = vi.fn<(remotePath: string, recursive?: boolean) => Promise<void>>().mockResolvedValue(undefined);
  list = vi.fn<(remotePath: string) => Promise<Array<{ type: "-"; name: string; size: number }>>>().mockImplementation((remotePath) => {
    if (remotePath === "/var/log/example") {
      return Promise.resolve([{ type: "-", name: "app.log", size: 4 }]);
    }
    return Promise.resolve([]);
  });
  uploadFile = vi
    .fn<
      (
        localPath: string,
        remotePath: string,
        onStep?: (step: TransferStep) => void
      ) => Promise<void>
    >()
    .mockImplementation((_localPath, _remotePath, onStep) => {
      onStep?.({ transferredBytes: 4, chunkBytes: 4, totalBytes: 4 });
      return Promise.resolve();
    });
  downloadFile = vi
    .fn<
      (
        remotePath: string,
        localPath: string,
        onStep?: (step: TransferStep) => void
      ) => Promise<void>
    >()
    .mockResolvedValue(undefined);
}

class MockCommandExecutor implements CommandExecutor {
  connect = vi
    .fn<(options: ScpServerOptions) => Promise<void>>()
    .mockResolvedValue(undefined);
  exec = vi
    .fn<(command: string, options?: ExecOptions) => Promise<ExecResult>>()
    .mockImplementation((command) =>
      Promise.resolve({
        command,
        stdout: `${command}: stdout\n`,
        stderr: `${command}: stderr\n`,
        exitCode: 0
      })
    );
  close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
}

describe("ScpNextClientImpl with mock transport", () => {
  it("uploads a local file through the transport and emits progress", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests", "client");
    await mkdir(directory, { recursive: true });
    const localFile = path.join(directory, "app.txt");
    await writeFile(localFile, "test");
    const transport = new MockTransport();
    const progress = vi.fn();
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport }
    );

    await client.upload(localFile, "/var/www/app.txt", {
      overwrite: false,
      onProgress: progress
    });

    expect(transport.connect).toHaveBeenCalled();
    expect(transport.uploadFile).toHaveBeenCalledWith(
      localFile,
      "/var/www/app.txt",
      expect.any(Function)
    );
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "upload",
        source: localFile,
        destination: "/var/www/app.txt",
        transferredBytes: 4,
        percentage: 100
      })
    );
  });

  it("uploads a local file into a remote directory destination", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests", "client-directory-destination");
    await mkdir(directory, { recursive: true });
    const localFile = path.join(directory, "README.md");
    await writeFile(localFile, "readme");
    const transport = new MockTransport();
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport }
    );

    await client.upload(localFile, "/var/www/", {
      overwrite: false
    });

    expect(transport.uploadFile).toHaveBeenCalledWith(
      localFile,
      "/var/www/README.md",
      expect.any(Function)
    );
  });

  it("creates a missing remote directory destination for file uploads when enabled", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests", "client-create-remote-directory");
    await mkdir(directory, { recursive: true });
    const localFile = path.join(directory, "README.md");
    await writeFile(localFile, "readme");
    const transport = new MockTransport();
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport }
    );

    await client.upload(localFile, "/missing-dir/", {
      overwrite: false
    });

    expect(transport.mkdir).toHaveBeenCalledWith("/missing-dir", true);
    expect(transport.uploadFile).toHaveBeenCalledWith(
      localFile,
      "/missing-dir/README.md",
      expect.any(Function)
    );
  });

  it("suggests --overwrite when a remote upload destination already exists", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests", "client-existing-remote");
    await mkdir(directory, { recursive: true });
    const localFile = path.join(directory, "webmazey-docker-run.sh");
    await writeFile(localFile, "echo deploy");
    const transport = new MockTransport();
    transport.exists.mockImplementation((remotePath) => {
      if (remotePath === "/web/webmazey-docker-run.sh") return Promise.resolve("-");
      return Promise.resolve(false);
    });
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport }
    );

    await expect(
      client.upload(localFile, "/web/webmazey-docker-run.sh", {
        overwrite: false
      })
    ).rejects.toThrow(
      "Remote destination already exists: /web/webmazey-docker-run.sh. Use --overwrite to overwrite it."
    );
  });

  it("uploads a local directory into an existing remote directory destination", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests", "client-upload-directory");
    const localDirectory = path.join(directory, "dist");
    const localFile = path.join(localDirectory, "app.txt");
    await mkdir(localDirectory, { recursive: true });
    await writeFile(localFile, "test");
    const transport = new MockTransport();
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport }
    );

    await client.upload(localDirectory, "/var/www/", {
      recursive: true,
      overwrite: false
    });

    expect(transport.mkdir).toHaveBeenCalledWith("/var/www/dist", true);
    expect(transport.uploadFile).toHaveBeenCalledWith(
      localFile,
      "/var/www/dist/app.txt",
      expect.any(Function)
    );
  });

  it("downloads a remote file into an existing local directory destination", async () => {
    const localDirectory = path.join(os.tmpdir(), "scp-next-tests", "client-download-file");
    await mkdir(localDirectory, { recursive: true });
    const transport = new MockTransport();
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport }
    );

    await client.download("/var/log/example.log", localDirectory, {
      overwrite: false
    });

    expect(transport.downloadFile).toHaveBeenCalledWith(
      "/var/log/example.log",
      path.join(localDirectory, "example.log"),
      expect.any(Function)
    );
  });

  it("downloads a remote file into a trailing-slash local directory destination", async () => {
    const localDirectory = path.join(os.tmpdir(), "scp-next-tests", "client-download-file-slash");
    const transport = new MockTransport();
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport }
    );

    await client.download("/var/log/example.log", `${localDirectory}${path.sep}`, {
      overwrite: false
    });

    expect(transport.downloadFile).toHaveBeenCalledWith(
      "/var/log/example.log",
      path.join(localDirectory, "example.log"),
      expect.any(Function)
    );
  });

  it("downloads a remote directory into an existing local directory destination", async () => {
    const localDirectory = path.join(
      os.tmpdir(),
      "scp-next-tests",
      `client-download-directory-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    await mkdir(localDirectory, { recursive: true });
    const transport = new MockTransport();
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport }
    );

    await client.download("/var/log/example", localDirectory, {
      recursive: true,
      overwrite: false
    });

    expect(transport.downloadFile).toHaveBeenCalledWith(
      "/var/log/example/app.log",
      path.join(localDirectory, "example", "app.log"),
      expect.any(Function)
    );
  });

  it("runs post-upload commands sequentially in configured order and captures output", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests", "client-after-upload");
    await mkdir(directory, { recursive: true });
    const localFile = path.join(directory, "app.txt");
    await writeFile(localFile, "test");
    const transport = new MockTransport();
    const commandExecutor = new MockCommandExecutor();
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport, commandExecutor }
    );

    const results = await client.upload(localFile, "/var/www/app.txt", {
      afterUpload: ["npm install --omit=dev", "pm2 reload example"]
    });
    await client.close();

    expect(commandExecutor.exec.mock.calls.map(([command]) => command)).toEqual([
      "npm install --omit=dev",
      "pm2 reload example"
    ]);
    expect(transport.uploadFile.mock.invocationCallOrder[0]).toBeLessThan(
      commandExecutor.exec.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(results).toEqual([
      expect.objectContaining({
        command: "npm install --omit=dev",
        stdout: "npm install --omit=dev: stdout\n",
        stderr: "npm install --omit=dev: stderr\n"
      }),
      expect.objectContaining({ command: "pm2 reload example" })
    ]);
    expect(transport.close).toHaveBeenCalledOnce();
    expect(commandExecutor.close).toHaveBeenCalledOnce();
  });

  it("does not connect or run commands when upload fails", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests", "client-upload-failure");
    await mkdir(directory, { recursive: true });
    const localFile = path.join(directory, "app.txt");
    await writeFile(localFile, "test");
    const transport = new MockTransport();
    transport.uploadFile.mockRejectedValue(new Error("upload failed"));
    const commandExecutor = new MockCommandExecutor();
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport, commandExecutor }
    );

    await expect(
      client.upload(localFile, "/var/www/app.txt", {
        afterUpload: ["pm2 reload example"]
      })
    ).rejects.toThrow("upload failed");
    expect(commandExecutor.connect).not.toHaveBeenCalled();
    expect(commandExecutor.exec).not.toHaveBeenCalled();
  });

  it("stops at the first failed command and closes both connections", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests", "client-command-failure");
    await mkdir(directory, { recursive: true });
    const localFile = path.join(directory, "app.txt");
    await writeFile(localFile, "test");
    const transport = new MockTransport();
    const commandExecutor = new MockCommandExecutor();
    commandExecutor.exec
      .mockResolvedValueOnce({
        command: "first",
        stdout: "ok",
        stderr: "",
        exitCode: 0
      })
      .mockResolvedValueOnce({
        command: "second",
        stdout: "",
        stderr: "failed with secret",
        exitCode: 9
      });
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport, commandExecutor }
    );

    try {
      await client.upload(localFile, "/var/www/app.txt", {
        afterUpload: ["first", "second", "third"]
      });
      throw new Error("Expected command failure.");
    } catch (error) {
      expect(error).toBeInstanceOf(RemoteCommandError);
      expect((error as RemoteCommandError).exitCode).toBe(9);
      expect((error as RemoteCommandError).stderr).toBe("failed with [REDACTED]");
      expect((error as Error).message).not.toContain("second");
    } finally {
      await client.close();
    }

    expect(commandExecutor.exec.mock.calls.map(([command]) => command)).toEqual([
      "first",
      "second"
    ]);
    expect(transport.close).toHaveBeenCalledOnce();
    expect(commandExecutor.close).toHaveBeenCalledOnce();
  });

  it("does not run commands during dry-run or downloads", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests", "client-command-disabled");
    await mkdir(directory, { recursive: true });
    const localFile = path.join(directory, "app.txt");
    await writeFile(localFile, "test");
    const transport = new MockTransport();
    const commandExecutor = new MockCommandExecutor();
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport, commandExecutor }
    );

    await client.upload(localFile, "/var/www/app.txt", {
      dryRun: true,
      afterUpload: ["should-not-run"]
    });
    await client.download("/var/log/example.log", directory, {
      overwrite: true
    });

    expect(commandExecutor.connect).not.toHaveBeenCalled();
    expect(commandExecutor.exec).not.toHaveBeenCalled();
  });

  it("validates command output limits before connecting", async () => {
    const commandExecutor = new MockCommandExecutor();
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport: new MockTransport(), commandExecutor }
    );

    await expect(client.exec("deploy", { maxBuffer: 0 })).rejects.toThrow(
      "Command maxBuffer must be a positive integer."
    );
    expect(commandExecutor.connect).not.toHaveBeenCalled();
  });

  it("rejects malformed command options from JavaScript callers", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests", "client-invalid-commands");
    await mkdir(directory, { recursive: true });
    const localFile = path.join(directory, "app.txt");
    await writeFile(localFile, "test");
    const commandExecutor = new MockCommandExecutor();
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport: new MockTransport(), commandExecutor }
    );

    await expect(
      client.upload(localFile, "/var/www/app.txt", {
        dryRun: true,
        afterUpload: "deploy" as unknown as string[]
      })
    ).rejects.toThrow(
      "afterUpload must be an array of non-empty command strings."
    );
    await expect(client.exec(42 as unknown as string)).rejects.toThrow(
      "Remote command must not be empty."
    );
    await expect(
      client.exec("deploy", {
        failOnStderr: "yes" as unknown as boolean
      })
    ).rejects.toThrow("Command failOnStderr must be a boolean.");
    expect(commandExecutor.connect).not.toHaveBeenCalled();
  });

  it("redacts captured output from executor failures", async () => {
    const commandExecutor = new MockCommandExecutor();
    commandExecutor.exec.mockRejectedValue(
      new RemoteCommandError("Remote command timed out.", {
        exitCode: null,
        stdout: "partial secret output",
        stderr: "TOKEN=do-not-print"
      })
    );
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport: new MockTransport(), commandExecutor }
    );

    await expect(client.exec("deploy")).rejects.toMatchObject({
      stdout: "partial [REDACTED] output",
      stderr: "TOKEN=[REDACTED]"
    });
  });

  it("attempts every connection close and clears state when one close fails", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests", "client-close-failure");
    await mkdir(directory, { recursive: true });
    const localFile = path.join(directory, "app.txt");
    await writeFile(localFile, "test");
    const transport = new MockTransport();
    transport.close.mockRejectedValue(new Error("SFTP close failed"));
    const commandExecutor = new MockCommandExecutor();
    const client = new ScpNextClientImpl(
      {
        host: "example.com",
        username: "deploy",
        password: "secret"
      },
      { transport, commandExecutor }
    );
    await client.upload(localFile, "/var/www/app.txt", {
      afterUpload: ["deploy"]
    });

    await expect(client.close()).rejects.toThrow("SFTP close failed");
    expect(transport.close).toHaveBeenCalledOnce();
    expect(commandExecutor.close).toHaveBeenCalledOnce();

    await expect(client.close()).resolves.toBeUndefined();
    expect(transport.close).toHaveBeenCalledOnce();
    expect(commandExecutor.close).toHaveBeenCalledOnce();
  });
});
