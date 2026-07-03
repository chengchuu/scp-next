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
    if (remotePath === "/var/www") return Promise.resolve("d");
    return Promise.resolve(false);
  });
  mkdir = vi.fn<(remotePath: string, recursive?: boolean) => Promise<void>>().mockResolvedValue(undefined);
  list = vi.fn<(remotePath: string) => Promise<[]>>().mockResolvedValue([]);
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
});
