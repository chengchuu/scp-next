import SftpClient from "ssh2-sftp-client";
import type {
  ConnectOptions as SftpConnectOptions,
  FileInfo,
  TransferOptions as SftpTransferOptions
} from "ssh2-sftp-client";

import {
  ConnectionError,
  HostVerificationError,
  TransferError,
  toScpNextError
} from "../errors/index.js";
import { formatErrorMessage } from "../security/redact.js";
import type { ScpServerOptions } from "../types/index.js";
import { createSshConnectOptions } from "./ssh-options.js";

export interface RemoteFileInfo {
  type: "-" | "d" | "l";
  name: string;
  size: number;
}

export interface TransferStep {
  transferredBytes: number;
  chunkBytes: number;
  totalBytes: number;
}

export interface SftpTransport {
  connect(options: ScpServerOptions): Promise<void>;
  close(): Promise<void>;
  exists(remotePath: string): Promise<false | "-" | "d" | "l">;
  mkdir(remotePath: string, recursive?: boolean): Promise<void>;
  list(remotePath: string): Promise<RemoteFileInfo[]>;
  uploadFile(
    localPath: string,
    remotePath: string,
    onStep?: (step: TransferStep) => void
  ): Promise<void>;
  downloadFile(
    remotePath: string,
    localPath: string,
    onStep?: (step: TransferStep) => void
  ): Promise<void>;
}

function toRemoteFileInfo(info: FileInfo): RemoteFileInfo {
  return {
    type: info.type,
    name: info.name,
    size: info.size
  };
}

export class Ssh2SftpTransport implements SftpTransport {
  private readonly client: SftpClient;

  constructor(name = "scp-next") {
    this.client = new SftpClient(name, {
      error: () => undefined,
      end: () => undefined,
      close: () => undefined
    });
  }

  async connect(options: ScpServerOptions): Promise<void> {
    const connectOptions = await createSshConnectOptions(options);

    try {
      await this.client.connect(connectOptions as SftpConnectOptions);
    } catch (error) {
      const converted = toScpNextError(error);
      if (converted instanceof HostVerificationError) {
        throw new HostVerificationError(
          `SSH host verification failed during connection: ${formatErrorMessage(
            error
          )}.${hostVerificationTroubleshooting(options.host)}`,
          { cause: error, context: connectionContext(options) }
        );
      }
      if (isLikelyHostVerificationFailure(error)) {
        throw new HostVerificationError(
          `SSH host verification failed during connection.${hostVerificationTroubleshooting(
            options.host
          )}`,
          { cause: error, context: connectionContext(options) }
        );
      }
      throw new ConnectionError(`Unable to connect to SSH server: ${formatErrorMessage(error)}`, {
        cause: error,
        context: connectionContext(options)
      });
    }
  }

  async close(): Promise<void> {
    await this.client.end();
  }

  async exists(remotePath: string): Promise<false | "-" | "d" | "l"> {
    return this.client.exists(remotePath);
  }

  async mkdir(remotePath: string, recursive = true): Promise<void> {
    await this.client.mkdir(remotePath, recursive);
  }

  async list(remotePath: string): Promise<RemoteFileInfo[]> {
    const files = await this.client.list(remotePath);
    return files.map(toRemoteFileInfo);
  }

  async uploadFile(
    localPath: string,
    remotePath: string,
    onStep?: (step: TransferStep) => void
  ): Promise<void> {
    try {
      await this.client.fastPut(localPath, remotePath, this.transferOptions(onStep));
    } catch (error) {
      throw new TransferError(`Upload failed for ${localPath}: ${formatErrorMessage(error)}`, {
        cause: error,
        context: { localPath, remotePath }
      });
    }
  }

  async downloadFile(
    remotePath: string,
    localPath: string,
    onStep?: (step: TransferStep) => void
  ): Promise<void> {
    try {
      await this.client.fastGet(remotePath, localPath, this.transferOptions(onStep));
    } catch (error) {
      throw new TransferError(`Download failed for ${remotePath}: ${formatErrorMessage(error)}`, {
        cause: error,
        context: { remotePath, localPath }
      });
    }
  }

  private transferOptions(onStep?: (step: TransferStep) => void): SftpTransferOptions | undefined {
    if (!onStep) {
      return undefined;
    }
    return {
      step(transferredBytes, chunkBytes, totalBytes) {
        onStep({ transferredBytes, chunkBytes, totalBytes });
      }
    };
  }
}

function connectionContext(options: ScpServerOptions): Record<string, unknown> {
  return {
    host: options.host,
    port: options.port,
    username: options.username
  };
}

function isLikelyHostVerificationFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("host") &&
    (message.includes("verif") ||
      message.includes("fingerprint") ||
      message.includes("host key") ||
      message.includes("key mismatch") ||
      message.includes("denied"))
  );
}

function hostVerificationTroubleshooting(host: string | undefined): string {
  const displayHost = host ?? "<host>";
  return [
    "",
    "",
    "Typical fix:",
    `  ssh ${displayHost}`,
    "",
    "If plain ssh works but scp-next fails, check that the host entry is available in",
    "`~/.ssh/known_hosts` for the same host and port used by scp-next. For non-default ports,",
    "OpenSSH usually stores entries as `[host]:port`.",
    "You can also configure hostFingerprint or knownHostsFile explicitly."
  ].join("\n");
}
