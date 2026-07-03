import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { ScpNextClientImpl } from "../../src/client/client.js";
import type { SftpTransport, TransferStep } from "../../src/client/transport.js";

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
});
