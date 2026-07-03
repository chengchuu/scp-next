declare module "ssh2-sftp-client" {
  export interface ConnectOptions {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    privateKey?: string | Buffer;
    passphrase?: string;
    agent?: string;
    readyTimeout?: number;
    hostHash?: "md5" | "sha1" | "sha256";
    hostVerifier?: (hashedKey: string) => boolean;
  }

  export interface TransferOptions {
    step?: (transferredBytes: number, chunkBytes: number, totalBytes: number) => void;
  }

  export interface FileInfo {
    type: "-" | "d" | "l";
    name: string;
    size: number;
  }

  export default class SftpClient {
    constructor(
      name?: string,
      callbacks?: {
        error?: (error: Error) => void;
        end?: () => void;
        close?: () => void;
      }
    );
    connect(options: ConnectOptions): Promise<void>;
    end(): Promise<void>;
    exists(remotePath: string): Promise<false | "-" | "d" | "l">;
    mkdir(remotePath: string, recursive?: boolean): Promise<string | boolean>;
    list(remotePath: string): Promise<FileInfo[]>;
    fastPut(localPath: string, remotePath: string, options?: TransferOptions): Promise<string>;
    fastGet(remotePath: string, localPath: string, options?: TransferOptions): Promise<string>;
  }
}
