import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import type { Client, ClientChannel } from "ssh2";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SshCommandExecutor } from "../../src/client/command-executor.js";
import { ConnectionError, RemoteCommandError } from "../../src/errors/index.js";

class FakeChannel extends PassThrough {
  readonly stderr = new PassThrough();
  readonly close = vi.fn(() => {
    this.emit("close");
  });

  finish(exitCode?: number, signal?: string): void {
    this.end();
    this.stderr.end();
    this.emit("close", exitCode, signal);
  }
}

class FakeSshClient extends EventEmitter {
  readonly channel = new FakeChannel();

  connect(): this {
    queueMicrotask(() => this.emit("ready"));
    return this;
  }

  exec(
    _command: string,
    callback: (error: Error | undefined, channel: ClientChannel) => void
  ): this {
    callback(undefined, this.channel as unknown as ClientChannel);
    return this;
  }

  end(): this {
    queueMicrotask(() => this.emit("close"));
    return this;
  }
}

async function connectedExecutor(): Promise<{
  executor: SshCommandExecutor;
  client: FakeSshClient;
}> {
  const client = new FakeSshClient();
  const executor = new SshCommandExecutor(client as unknown as Client);
  await executor.connect({
    host: "example.com",
    hostFingerprint: "aa"
  });
  return { executor, client };
}

describe("SshCommandExecutor", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("captures output and normalizes a missing exit status to null", async () => {
    const { executor, client } = await connectedExecutor();
    const pending = executor.exec("deploy");

    client.channel.write("stdout");
    client.channel.stderr.write("stderr");
    client.channel.finish();

    await expect(pending).resolves.toEqual({
      command: "deploy",
      stdout: "stdout",
      stderr: "stderr",
      exitCode: null
    });
  });

  it("rejects stream errors without emitting an uncaught error", async () => {
    const { executor, client } = await connectedExecutor();
    const pending = executor.exec("deploy");

    client.channel.emit("error", new Error("socket lost"));

    await expect(pending).rejects.toBeInstanceOf(RemoteCommandError);
  });

  it("bounds captured command output", async () => {
    const { executor, client } = await connectedExecutor();
    const pending = executor.exec("deploy", { maxBuffer: 4 });

    client.channel.write("12345");

    await expect(pending).rejects.toMatchObject({
      message: "Remote command output exceeded maxBuffer of 4 bytes.",
      exitCode: null
    });
    expect(client.channel.close).toHaveBeenCalledOnce();
  });

  it("times out with captured partial output and closes the channel", async () => {
    const { executor, client } = await connectedExecutor();
    vi.useFakeTimers();
    const pending = executor.exec("deploy", { timeout: 50 });

    client.channel.write("partial");
    const rejection = expect(pending).rejects.toMatchObject({
      message: "Remote command timed out after 50 ms.",
      stdout: "partial",
      exitCode: null
    });
    await vi.advanceTimersByTimeAsync(50);

    await rejection;
    expect(client.channel.close).toHaveBeenCalledOnce();
  });

  it("marks the executor disconnected after a client error", async () => {
    const { executor, client } = await connectedExecutor();

    expect(() => client.emit("error", new Error("connection lost"))).not.toThrow();
    await expect(executor.exec("deploy")).rejects.toBeInstanceOf(ConnectionError);
    await expect(executor.close()).resolves.toBeUndefined();
  });
});
