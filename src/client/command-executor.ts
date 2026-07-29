import { Client } from "ssh2";
import type { ClientChannel } from "ssh2";

import {
  ConnectionError,
  HostVerificationError,
  RemoteCommandError,
  toScpNextError
} from "../errors/index.js";
import { formatErrorMessage } from "../security/redact.js";
import type { ExecOptions, ExecResult, ScpServerOptions } from "../types/index.js";
import { createSshConnectOptions } from "./ssh-options.js";

export interface CommandExecutor {
  connect(options: ScpServerOptions): Promise<void>;
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;
  close(): Promise<void>;
}

export class SshCommandExecutor implements CommandExecutor {
  private readonly client: Client;
  private connected = false;
  private closed = true;

  constructor(client: Client = new Client()) {
    this.client = client;
    this.client.on("error", () => {
      this.connected = false;
    });
    this.client.on("close", () => {
      this.connected = false;
      this.closed = true;
    });
  }

  async connect(options: ScpServerOptions): Promise<void> {
    const connectOptions = await createSshConnectOptions(options);
    this.closed = false;

    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup();
        this.connected = true;
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        this.connected = false;
        this.closed = true;
        try {
          this.client.end();
        } catch {
          // The failed connection may not have a writable socket.
        }
        const converted = toScpNextError(error);
        if (converted instanceof HostVerificationError) {
          reject(converted);
          return;
        }
        reject(
          new ConnectionError(
            `Unable to connect command executor to SSH server: ${formatErrorMessage(error)}`,
            {
              cause: error,
              context: {
                host: options.host,
                port: options.port,
                username: options.username
              }
            }
          )
        );
      };
      const onClose = () => {
        cleanup();
        reject(new ConnectionError("SSH connection closed before it was ready."));
      };
      const cleanup = () => {
        this.client.off("ready", onReady);
        this.client.off("error", onError);
        this.client.off("close", onClose);
      };

      this.client.once("ready", onReady);
      this.client.once("error", onError);
      this.client.once("close", onClose);
      try {
        this.client.connect(connectOptions);
      } catch (error) {
        cleanup();
        this.closed = true;
        reject(
          new ConnectionError(
            `Unable to start SSH connection: ${formatErrorMessage(error)}`
          )
        );
      }
    });
  }

  async exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
    if (!this.connected) {
      throw new ConnectionError("Command executor is not connected.");
    }

    return new Promise<ExecResult>((resolve, reject) => {
      try {
        this.client.exec(command, (error, stream) => {
          if (error) {
            reject(
              new RemoteCommandError("Unable to start remote command.", {
                exitCode: null
              })
            );
            return;
          }
          collectCommandResult(command, stream, options, resolve, reject);
        });
      } catch (error) {
        reject(
          new ConnectionError(
            `Unable to start remote command: ${formatErrorMessage(error)}`
          )
        );
      }
    });
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.connected = false;
    await new Promise<void>((resolve) => {
      this.client.once("close", resolve);
      this.client.end();
    });
  }
}

function collectCommandResult(
  command: string,
  stream: ClientChannel,
  options: ExecOptions,
  resolve: (result: ExecResult) => void,
  reject: (error: RemoteCommandError) => void
): void {
  let stdout = "";
  let stderr = "";
  let outputBytes = 0;
  let settled = false;
  const maxBuffer = options.maxBuffer ?? 10 * 1024 * 1024;
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    stream.off("data", onStdoutData);
    stream.stderr.off("data", onStderrData);
    stream.off("close", onClose);
    stream.off("error", onStreamError);
    stream.stderr.off("error", onStreamError);
  };
  const fail = (error: RemoteCommandError) => {
    if (settled) return;
    settled = true;
    cleanup();
    try {
      stream.close();
    } catch {
      // The connection may already be closed.
    }
    reject(error);
  };
  const appendOutput = (target: "stdout" | "stderr", chunk: string) => {
    outputBytes += Buffer.byteLength(chunk);
    if (outputBytes > maxBuffer) {
      fail(
        new RemoteCommandError(
          `Remote command output exceeded maxBuffer of ${maxBuffer} bytes.`,
          {
            exitCode: null,
            stdout,
            stderr
          }
        )
      );
      return;
    }
    if (target === "stdout") stdout += chunk;
    else stderr += chunk;
  };
  const onStreamError = () => {
    fail(
      new RemoteCommandError("Remote command stream failed.", {
        exitCode: null,
        stdout,
        stderr
      })
    );
  };
  const onStdoutData = (chunk: string) => {
    appendOutput("stdout", chunk);
  };
  const onStderrData = (chunk: string) => {
    appendOutput("stderr", chunk);
  };
  const onClose = (exitCode: number | null | undefined, signal: string | undefined) => {
    if (settled) return;
    settled = true;
    cleanup();
    resolve({
      command,
      stdout,
      stderr,
      exitCode: typeof exitCode === "number" ? exitCode : null,
      ...(signal ? { signal } : {})
    });
  };
  const timer =
    options.timeout === undefined
      ? undefined
      : setTimeout(() => {
          fail(
            new RemoteCommandError(
              `Remote command timed out after ${options.timeout} ms.`,
              {
                exitCode: null,
                stdout,
                stderr
              }
            )
          );
        }, options.timeout);

  stream.setEncoding("utf8");
  stream.stderr.setEncoding("utf8");
  stream.on("data", onStdoutData);
  stream.stderr.on("data", onStderrData);
  stream.once("error", onStreamError);
  stream.stderr.once("error", onStreamError);
  stream.once("close", onClose);
}
