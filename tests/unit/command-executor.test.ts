import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import type { Client, ClientChannel } from "ssh2";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SshCommandExecutor } from "../../src/client/command-executor.js";
import { ConnectionError, RemoteCommandError } from "../../src/errors/index.js";
import { hostVerificationDiagnostics } from "../../src/security/host-verification-diagnostics.js";

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
    vi.restoreAllMocks();
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

  it("uses the shared host-verification diagnostics and closes the failed connection", async () => {
    const client = new FakeSshClient();
    const cause = new Error("Host verification failed: secret-password");
    vi.spyOn(client, "connect").mockImplementation(() => {
      queueMicrotask(() => client.emit("error", cause));
      return client;
    });
    const end = vi.spyOn(client, "end");
    const exec = vi.spyOn(client, "exec");
    const options = {
      host: "example.com",
      port: 2222,
      hostFingerprint: "aa",
      password: "secret-password"
    };
    const executor = new SshCommandExecutor(client as unknown as Client);
    await expect(executor.connect(options)).rejects.toMatchObject({
      code: "SCP_NEXT_HOST_VERIFICATION_ERROR",
      cause,
      message: `The host key could not be verified.${hostVerificationDiagnostics(options)}`
    });
    expect(end).toHaveBeenCalledOnce();
    expect(exec).not.toHaveBeenCalled();
    await expect(executor.exec("deploy")).rejects.toBeInstanceOf(ConnectionError);
    await executor.close();
    expect(end).toHaveBeenCalledOnce();
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
