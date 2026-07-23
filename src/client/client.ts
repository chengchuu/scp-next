import { access, mkdir, stat } from "node:fs/promises";
import path from "node:path";

import { Ssh2SftpTransport } from "./transport.js";
import type { SftpTransport } from "./transport.js";
import { SshCommandExecutor } from "./command-executor.js";
import type { CommandExecutor } from "./command-executor.js";
import { walkLocalFiles, walkRemoteFiles } from "./walk.js";
import { RemoteCommandError, TransferError, ValidationError } from "../errors/index.js";
import { getLocalPathKind, resolveLocalPath } from "../paths/local-path.js";
import { redactKnownSensitiveValues } from "../security/redact.js";
import { normalizeRemotePath, remoteDirname, remoteJoin } from "../paths/remote-path.js";
import type {
  DownloadOptions,
  ExecOptions,
  ExecResult,
  ScpNextClient,
  ScpServerOptions,
  TransferOptions,
  UploadOptions
} from "../types/index.js";
import {
  validateDownloadOptions,
  validateServerOptions,
  validateUploadOptions
} from "../config/validation.js";

export interface ScpNextClientDependencies {
  transport?: SftpTransport;
  commandExecutor?: CommandExecutor;
}

function percentage(transferredBytes: number, totalBytes?: number): number | undefined {
  if (!totalBytes || totalBytes <= 0) {
    return undefined;
  }
  return Math.min(100, Math.round((transferredBytes / totalBytes) * 100));
}

function mergeOptions<T extends TransferOptions>(
  serverOptions: ScpServerOptions,
  transferOptions: T | undefined
): ScpServerOptions & T {
  return { ...serverOptions, ...(transferOptions ?? {}) } as ScpServerOptions & T;
}

function shouldCreateDirectories(options: TransferOptions): boolean {
  return options.createDirectories ?? true;
}

function hasTrailingPathSeparator(inputPath: string): boolean {
  return /[\\/]$/.test(inputPath);
}

function trimmedRemoteDirectory(remotePath: string): string {
  return remotePath.replace(/\/+$/g, "") || "/";
}

function remoteBasename(remotePath: string): string {
  return path.posix.basename(trimmedRemoteDirectory(remotePath));
}

async function isExistingLocalDirectory(localPath: string): Promise<boolean> {
  try {
    return (await stat(localPath)).isDirectory();
  } catch {
    return false;
  }
}

async function ensureLocalDirectory(localPath: string, createParents = false): Promise<void> {
  try {
    const stats = await stat(localPath);
    if (stats.isDirectory()) {
      return;
    }
    throw new TransferError(`Local destination already exists and is not a directory: ${localPath}`, {
      context: { localPath }
    });
  } catch (error) {
    if (error instanceof TransferError) {
      throw error;
    }
    await mkdir(localPath, { recursive: createParents });
  }
}

export class ScpNextClientImpl implements ScpNextClient {
  private readonly serverOptions: ScpServerOptions;
  private readonly transport: SftpTransport;
  private readonly commandExecutor: CommandExecutor;
  private connected = false;
  private commandExecutorConnected = false;

  constructor(serverOptions: ScpServerOptions, dependencies: ScpNextClientDependencies = {}) {
    this.serverOptions = serverOptions;
    this.transport = dependencies.transport ?? new Ssh2SftpTransport();
    this.commandExecutor = dependencies.commandExecutor ?? new SshCommandExecutor();
  }

  async connect(): Promise<void> {
    await validateServerOptions(this.serverOptions);
    await this.transport.connect(this.serverOptions);
    this.connected = true;
  }

  async upload(
    localPath: string,
    remotePath: string,
    options: TransferOptions = {}
  ): Promise<ExecResult[]> {
    const uploadOptions: UploadOptions = {
      ...mergeOptions(this.serverOptions, options),
      localPath,
      remotePath
    };
    await validateUploadOptions(uploadOptions);

    if (options.dryRun) {
      return [];
    }

    await this.ensureConnected();
    await this.uploadWithTransport(uploadOptions);
    const results: ExecResult[] = [];
    for (const command of options.afterUpload ?? []) {
      results.push(await this.exec(command));
    }
    return results;
  }

  async download(
    remotePath: string,
    localPath: string,
    options: TransferOptions = {}
  ): Promise<void> {
    const downloadOptions: DownloadOptions = {
      ...mergeOptions(this.serverOptions, options),
      remotePath,
      localPath
    };
    await validateDownloadOptions(downloadOptions);

    if (options.dryRun) {
      return;
    }

    await this.ensureConnected();
    await this.downloadWithTransport(downloadOptions);
  }

  async exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
    if (typeof command !== "string" || !command.trim()) {
      throw new ValidationError("Remote command must not be empty.");
    }
    if (options.timeout !== undefined && (!Number.isFinite(options.timeout) || options.timeout <= 0)) {
      throw new ValidationError("Command timeout must be a positive number.");
    }
    if (
      options.maxBuffer !== undefined &&
      (!Number.isInteger(options.maxBuffer) || options.maxBuffer <= 0)
    ) {
      throw new ValidationError("Command maxBuffer must be a positive integer.");
    }
    if (
      options.failOnStderr !== undefined &&
      typeof options.failOnStderr !== "boolean"
    ) {
      throw new ValidationError("Command failOnStderr must be a boolean.");
    }

    await this.ensureCommandExecutorConnected();
    let result: ExecResult;
    try {
      result = await this.commandExecutor.exec(command, options);
    } catch (error) {
      if (error instanceof RemoteCommandError) {
        throw new RemoteCommandError(error.message, {
          exitCode: error.exitCode,
          signal: error.signal,
          stdout: redactKnownSensitiveValues(error.stdout, this.serverOptions),
          stderr: redactKnownSensitiveValues(error.stderr, this.serverOptions)
        });
      }
      throw error;
    }
    if (result.exitCode !== 0 || (options.failOnStderr && result.stderr.length > 0)) {
      const reason =
        result.exitCode === null
          ? "Remote command ended without an exit code."
          : result.exitCode !== 0
          ? `Remote command failed with exit code ${String(result.exitCode)}.`
          : "Remote command wrote to stderr.";
      throw new RemoteCommandError(reason, {
        exitCode: result.exitCode,
        signal: result.signal,
        stdout: redactKnownSensitiveValues(result.stdout, this.serverOptions),
        stderr: redactKnownSensitiveValues(result.stderr, this.serverOptions)
      });
    }
    return result;
  }

  async close(): Promise<void> {
    const closures: Promise<void>[] = [];
    if (this.connected) closures.push(this.transport.close());
    if (this.commandExecutorConnected) closures.push(this.commandExecutor.close());
    const results = await Promise.allSettled(closures);
    this.connected = false;
    this.commandExecutorConnected = false;
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    if (failure) {
      throw failure.reason;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  private async ensureCommandExecutorConnected(): Promise<void> {
    if (!this.commandExecutorConnected) {
      await validateServerOptions(this.serverOptions);
      await this.commandExecutor.connect(this.serverOptions);
      this.commandExecutorConnected = true;
    }
  }

  private async uploadWithTransport(options: UploadOptions): Promise<void> {
    const localKind = await getLocalPathKind(options.localPath);
    const remotePath = normalizeRemotePath(options.remotePath);

    if (localKind === "directory" && !options.recursive) {
      throw new ValidationError("Uploading a directory requires recursive mode.");
    }

    if (localKind === "file") {
      const destinationFile = await this.resolveRemoteDestinationForLocalFile(options, remotePath);
      const totalBytes = undefined;
      await this.transport.uploadFile(resolveLocalPath(options.localPath), destinationFile, (step) => {
        options.onProgress?.({
          operation: "upload",
          source: options.localPath,
          destination: options.remotePath,
          transferredBytes: step.transferredBytes,
          totalBytes: step.totalBytes || totalBytes,
          percentage: percentage(step.transferredBytes, step.totalBytes),
          currentFile: options.localPath
        });
      });
      return;
    }

    const files = await walkLocalFiles(options.localPath);
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    let completedBytes = 0;
    let completedFiles = 0;
    const destinationRoot = await this.resolveRemoteDestinationForLocalDirectory(
      options,
      remotePath
    );

    for (const file of files) {
      const destinationFile = remoteJoin(
        destinationRoot,
        file.relativePath.split(path.sep).join("/")
      );
      await this.ensureRemoteParent(destinationFile, true);
      await this.assertRemoteOverwrite(destinationFile, options.overwrite);

      await this.transport.uploadFile(file.absolutePath, destinationFile, (step) => {
        const transferredBytes = completedBytes + step.transferredBytes;
        options.onProgress?.({
          operation: "upload",
          source: options.localPath,
          destination: options.remotePath,
          transferredBytes,
          totalBytes,
          percentage: percentage(transferredBytes, totalBytes),
          currentFile: file.relativePath,
          completedFiles,
          totalFiles: files.length
        });
      });

      completedBytes += file.size;
      completedFiles += 1;
    }
  }

  private async resolveRemoteDestinationForLocalFile(
    options: UploadOptions,
    remotePath: string
  ): Promise<string> {
    const remoteKind = await this.transport.exists(remotePath);
    const isDirectoryLikeDestination = remoteKind === "d" || remotePath.endsWith("/");

    if (!isDirectoryLikeDestination) {
      await this.ensureRemoteParent(remotePath, shouldCreateDirectories(options));
      await this.assertRemoteOverwrite(remotePath, options.overwrite);
      return remotePath;
    }

    if (remoteKind && remoteKind !== "d") {
      throw new TransferError(`Remote destination already exists and is not a directory: ${remotePath}`, {
        context: { remotePath }
      });
    }

    const remoteDirectory = remotePath.replace(/\/+$/g, "") || "/";
    if (!remoteKind) {
      if (!shouldCreateDirectories(options)) {
        throw new TransferError(`Remote destination directory does not exist: ${remoteDirectory}`, {
          context: { remotePath }
        });
      }
      await this.transport.mkdir(remoteDirectory, true);
    }

    const destinationFile = remoteJoin(
      remoteDirectory,
      path.basename(resolveLocalPath(options.localPath))
    );
    await this.assertRemoteOverwrite(destinationFile, options.overwrite);
    return destinationFile;
  }

  private async resolveRemoteDestinationForLocalDirectory(
    options: UploadOptions,
    remotePath: string
  ): Promise<string> {
    const remoteKind = await this.transport.exists(remotePath);
    const isDirectoryLikeDestination = remoteKind === "d" || remotePath.endsWith("/");
    const localDirectoryName = path.basename(resolveLocalPath(options.localPath));

    if (remoteKind && remoteKind !== "d") {
      throw new TransferError(`Remote destination already exists and is not a directory: ${remotePath}`, {
        context: { remotePath }
      });
    }

    if (isDirectoryLikeDestination) {
      const remoteDirectory = trimmedRemoteDirectory(remotePath);
      if (!remoteKind) {
        if (!shouldCreateDirectories(options)) {
          throw new TransferError(`Remote destination directory does not exist: ${remoteDirectory}`, {
            context: { remotePath }
          });
        }
        await this.transport.mkdir(remoteDirectory, true);
      }

      const destinationRoot = remoteJoin(remoteDirectory, localDirectoryName);
      await this.ensureRemoteDirectory(destinationRoot);
      return destinationRoot;
    }

    if (!remoteKind) {
      if (!shouldCreateDirectories(options)) {
        throw new TransferError(`Remote destination directory does not exist: ${remotePath}`, {
          context: { remotePath }
        });
      }
      await this.transport.mkdir(remotePath, true);
    }

    return remotePath;
  }

  private async downloadWithTransport(options: DownloadOptions): Promise<void> {
    const remotePath = normalizeRemotePath(options.remotePath);
    const remoteKind = await this.transport.exists(remotePath);

    if (!remoteKind) {
      throw new TransferError(`Remote path does not exist: ${options.remotePath}`, {
        context: { remotePath: options.remotePath }
      });
    }

    if (remoteKind === "d") {
      if (!options.recursive) {
        throw new ValidationError("Downloading a directory requires recursive mode.");
      }
      await this.downloadDirectory(options);
      return;
    }

    await this.downloadSingleFile(options, remotePath);
  }

  private async downloadSingleFile(options: DownloadOptions, remotePath: string): Promise<void> {
    const localPath = await this.resolveLocalDestinationForRemoteFile(options, remotePath);
    await this.assertLocalOverwrite(localPath, options.overwrite);
    if (shouldCreateDirectories(options)) {
      await mkdir(path.dirname(localPath), { recursive: true });
    }
    await this.transport.downloadFile(remotePath, localPath, (step) => {
      options.onProgress?.({
        operation: "download",
        source: options.remotePath,
        destination: options.localPath,
        transferredBytes: step.transferredBytes,
        totalBytes: step.totalBytes,
        percentage: percentage(step.transferredBytes, step.totalBytes),
        currentFile: options.remotePath
      });
    });
  }

  private async downloadDirectory(options: DownloadOptions): Promise<void> {
    const remotePath = normalizeRemotePath(options.remotePath);
    const localRoot = await this.resolveLocalDestinationForRemoteDirectory(options, remotePath);
    const files = await walkRemoteFiles(this.transport, remotePath);
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    let completedBytes = 0;
    let completedFiles = 0;

    await ensureLocalDirectory(localRoot, shouldCreateDirectories(options));

    for (const file of files) {
      const localFile = path.join(localRoot, ...file.relativePath.split("/"));
      await this.assertLocalOverwrite(localFile, options.overwrite);
      await mkdir(path.dirname(localFile), { recursive: true });
      await this.transport.downloadFile(file.remotePath, localFile, (step) => {
        const transferredBytes = completedBytes + step.transferredBytes;
        options.onProgress?.({
          operation: "download",
          source: options.remotePath,
          destination: options.localPath,
          transferredBytes,
          totalBytes,
          percentage: percentage(transferredBytes, totalBytes),
          currentFile: file.relativePath,
          completedFiles,
          totalFiles: files.length
        });
      });
      completedBytes += file.size;
      completedFiles += 1;
    }
  }

  private async resolveLocalDestinationForRemoteFile(
    options: DownloadOptions,
    remotePath: string
  ): Promise<string> {
    const localDestination = resolveLocalPath(options.localPath);
    const isDirectoryLikeDestination =
      hasTrailingPathSeparator(options.localPath) || (await isExistingLocalDirectory(localDestination));

    if (!isDirectoryLikeDestination) {
      return localDestination;
    }

    if (!(await isExistingLocalDirectory(localDestination))) {
      if (!shouldCreateDirectories(options)) {
        throw new TransferError(`Local destination directory does not exist: ${localDestination}`, {
          context: { localPath: options.localPath }
        });
      }
      await mkdir(localDestination, { recursive: true });
    }

    return path.join(localDestination, remoteBasename(remotePath));
  }

  private async resolveLocalDestinationForRemoteDirectory(
    options: DownloadOptions,
    remotePath: string
  ): Promise<string> {
    const localDestination = resolveLocalPath(options.localPath);
    const isDirectoryLikeDestination =
      hasTrailingPathSeparator(options.localPath) || (await isExistingLocalDirectory(localDestination));

    if (!isDirectoryLikeDestination) {
      return localDestination;
    }

    if (!(await isExistingLocalDirectory(localDestination))) {
      if (!shouldCreateDirectories(options)) {
        throw new TransferError(`Local destination directory does not exist: ${localDestination}`, {
          context: { localPath: options.localPath }
        });
      }
      await mkdir(localDestination, { recursive: true });
    }

    return path.join(localDestination, remoteBasename(remotePath));
  }

  private async ensureRemoteParent(remotePath: string, createDirectories = false): Promise<void> {
    const parent = remoteDirname(remotePath);
    if (parent === "." || parent === "/") {
      return;
    }

    if (createDirectories) {
      await this.transport.mkdir(parent, true);
      return;
    }

    const exists = await this.transport.exists(parent);
    if (exists !== "d") {
      throw new TransferError(`Remote destination parent does not exist: ${parent}`, {
        context: { remotePath }
      });
    }
  }

  private async ensureRemoteDirectory(remotePath: string): Promise<void> {
    const exists = await this.transport.exists(remotePath);
    if (exists && exists !== "d") {
      throw new TransferError(`Remote destination already exists and is not a directory: ${remotePath}`, {
        context: { remotePath }
      });
    }
    if (!exists) {
      await this.transport.mkdir(remotePath, true);
    }
  }

  private async assertRemoteOverwrite(remotePath: string, overwrite = false): Promise<void> {
    if (overwrite) {
      return;
    }
    const exists = await this.transport.exists(remotePath);
    if (exists) {
      throw new TransferError(
        `Remote destination already exists: ${remotePath}. Use --overwrite to overwrite it.`,
        {
          context: { remotePath }
        }
      );
    }
  }

  private async assertLocalOverwrite(localPath: string, overwrite = false): Promise<void> {
    if (overwrite) {
      return;
    }

    try {
      await access(localPath);
      throw new TransferError(`Local destination already exists: ${localPath}`, {
        context: { localPath }
      });
    } catch (error) {
      if (error instanceof TransferError) {
        throw error;
      }
    }
  }
}

export function createClient(options: ScpServerOptions): ScpNextClient {
  return new ScpNextClientImpl(options);
}
