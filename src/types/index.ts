export interface ScpServerOptions {
  host?: string | undefined;
  port?: number | undefined;
  username?: string | undefined;
  password?: string | undefined;
  privateKey?: string | Buffer | undefined;
  privateKeyFile?: string | undefined;
  passphrase?: string | undefined;
  agent?: string | undefined;
  timeout?: number | undefined;
  hostFingerprint?: string | undefined;
  knownHostsFile?: string | undefined;
}

export interface TransferOptions {
  recursive?: boolean | undefined;
  overwrite?: boolean | undefined;
  createDirectories?: boolean | undefined;
  dryRun?: boolean | undefined;
  timeout?: number | undefined;
  onProgress?: ((progress: TransferProgress) => void) | undefined;
}

export interface TransferProgress {
  operation: "upload" | "download";
  source: string;
  destination: string;
  transferredBytes: number;
  totalBytes?: number | undefined;
  percentage?: number | undefined;
  currentFile?: string | undefined;
  completedFiles?: number | undefined;
  totalFiles?: number | undefined;
}

export interface UploadOptions extends ScpServerOptions, TransferOptions {
  localPath: string;
  remotePath: string;
}

export interface DownloadOptions extends ScpServerOptions, TransferOptions {
  remotePath: string;
  localPath: string;
}

export interface ScpNextClient {
  connect(): Promise<void>;
  upload(localPath: string, remotePath: string, options?: TransferOptions): Promise<void>;
  download(remotePath: string, localPath: string, options?: TransferOptions): Promise<void>;
  close(): Promise<void>;
}

export interface LocalEndpoint {
  type: "local";
  path: string;
}

export interface RemoteEndpoint {
  type: "remote";
  path: string;
}

export type TransferEndpoint = LocalEndpoint | RemoteEndpoint;

export interface CopyOptions extends ScpServerOptions, TransferOptions {
  source: TransferEndpoint;
  destination: TransferEndpoint;
}

export type TransferOperation = "upload" | "download";

export interface TransferJob {
  operation: TransferOperation;
  profile?: string | undefined;
  source: string;
  destination: string;
  recursive?: boolean | undefined;
  overwrite?: boolean | undefined;
  createDirectories?: boolean | undefined;
  dryRun?: boolean | undefined;
  timeout?: number | undefined;
}

export interface ScpNextConfig {
  defaultProfile?: string | undefined;
  server?: ScpServerOptions | undefined;
  transfer?: Omit<TransferOptions, "onProgress"> | undefined;
  profiles?: Record<string, ScpServerOptions> | undefined;
  jobs?: Record<string, TransferJob> | undefined;
  host?: string | undefined;
  port?: number | undefined;
  username?: string | undefined;
  password?: string | undefined;
  privateKey?: string | undefined;
  privateKeyFile?: string | undefined;
  passphrase?: string | undefined;
  agent?: string | undefined;
  timeout?: number | undefined;
  hostFingerprint?: string | undefined;
  knownHostsFile?: string | undefined;
}

export interface ResolvedTransferConfig extends ScpServerOptions, TransferOptions {
  operation: TransferOperation;
  source: string;
  destination: string;
  profile?: string | undefined;
}
