import { readFile } from "node:fs/promises";

import SftpClient from "ssh2-sftp-client";
import type {
  ConnectOptions as SftpConnectOptions,
  FileInfo,
  TransferOptions as SftpTransferOptions
} from "ssh2-sftp-client";

import { ConnectionError, HostVerificationError, TransferError, toScpNextError } from "../errors/index.js";
import { createHostVerifier, resolveAllowedFingerprints } from "../security/host-verification.js";
import type { ScpServerOptions } from "../types/index.js";
import { expandHome } from "../paths/local-path.js";

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
    this.client = new SftpClient(name);
  }

  async connect(options: ScpServerOptions): Promise<void> {
    const allowedFingerprints = await resolveAllowedFingerprints(options);
    const hostVerifier = createHostVerifier(allowedFingerprints);

    const connectOptions: SftpConnectOptions = {};
    if (options.host !== undefined) connectOptions.host = options.host;
    if (options.port !== undefined) connectOptions.port = options.port;
    if (options.username !== undefined) connectOptions.username = options.username;
    if (options.password !== undefined) connectOptions.password = options.password;
    if (options.privateKey !== undefined) {
      connectOptions.privateKey = options.privateKey;
    } else if (options.privateKeyFile) {
      connectOptions.privateKey = await readFile(expandHome(options.privateKeyFile), "utf8");
    }
    if (options.passphrase !== undefined) connectOptions.passphrase = options.passphrase;
    const agent = options.agent ?? process.env.SSH_AUTH_SOCK;
    if (agent !== undefined) {
      connectOptions.agent = agent;
    }
    if (options.timeout !== undefined) connectOptions.readyTimeout = options.timeout;
    if (hostVerifier) {
      connectOptions.hostHash = "sha256";
      connectOptions.hostVerifier = hostVerifier;
    }

    try {
      await this.client.connect(connectOptions);
    } catch (error) {
      const converted = toScpNextError(error);
      if (converted instanceof HostVerificationError) {
        throw converted;
      }
      throw new ConnectionError("Unable to connect to SSH server.", {
        cause: error,
        context: {
          host: options.host,
          port: options.port,
          username: options.username
        }
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
      throw new TransferError(`Upload failed for ${localPath}.`, {
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
      throw new TransferError(`Download failed for ${remotePath}.`, {
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
