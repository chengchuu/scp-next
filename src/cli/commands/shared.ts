import { Option } from "commander";
import type { Command } from "commander";

import { readEnvironment } from "../../config/environment.js";
import { loadConfig } from "../../config/load-config.js";
import {
  resolveTransferConfig,
  type CliTransferOptions
} from "../../config/resolve-config.js";
import type { Output } from "../output.js";
import { createProgressReporter, verbosePlan, writeDryRun } from "../output.js";
import { writeCommandResults } from "../output.js";
import type {
  DownloadOptions,
  ExecResult,
  ResolvedTransferConfig,
  TransferOperation,
  UploadOptions
} from "../../types/index.js";

export interface RawCommandOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
  privateKeyFile?: string;
  passphrase?: string;
  config?: string;
  profile?: string;
  recursive?: boolean;
  overwrite?: boolean;
  createDirectories?: boolean;
  dryRun?: boolean;
  timeout?: number;
  verbose?: boolean;
  quiet?: boolean;
  afterUpload?: string[];
}

export interface TransferHandlers {
  upload(options: UploadOptions): Promise<ExecResult[]>;
  download(options: DownloadOptions): Promise<void>;
}

export function addTransferOptions(
  command: Command,
  options: { afterUpload?: boolean } = {}
) {
  command.option("--host <host>", "SSH server host");
  command.addOption(new Option("--port <port>", "SSH server port").argParser(parseInteger));
  command.option("--username <username>", "SSH username");
  command.option("--password <password>", "SSH password (prefer environment variables or key files)");
  command.option("--private-key <privateKey>", "Private-key content");
  command.option("--private-key-file <privateKeyFile>", "Private-key file path");
  command.option("--passphrase <passphrase>", "Private-key passphrase");
  command.option("--config <path>", "Configuration file path");
  command.option("--profile <name>", "Named server profile");
  command.option("--recursive", "Transfer directories recursively");
  command.option("--overwrite", "Overwrite existing destination files");
  command.option("--create-directories", "Create missing destination directories");
  command.option("--no-create-directories", "Do not create missing destination directories");
  command.option("--dry-run", "Resolve and validate without connecting or transferring");
  command.addOption(
    new Option("--timeout <milliseconds>", "SSH connection ready timeout").argParser(
      parseInteger
    )
  );
  command.option("--verbose", "Print verbose diagnostic output");
  command.option("--quiet", "Disable progress and non-error output");
  if (options.afterUpload) {
    command.option(
      "--after-upload <command>",
      "Run a remote command after a successful upload (repeatable)",
      collectValues
    );
  }
  return command;
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error("Expected a number.");
  }
  return parsed;
}

function collectValues(value: string, previous: string[] | undefined): string[] {
  return [...(previous ?? []), value];
}

function toCliOptions(options: RawCommandOptions): CliTransferOptions {
  return {
    host: options.host,
    port: options.port,
    username: options.username,
    password: options.password,
    privateKey: options.privateKey,
    privateKeyFile: options.privateKeyFile,
    passphrase: options.passphrase,
    profile: options.profile,
    recursive: options.recursive,
    overwrite: options.overwrite,
    createDirectories: options.createDirectories,
    dryRun: options.dryRun,
    timeout: options.timeout,
    afterUpload: options.afterUpload
  };
}

export async function resolveForCli(input: {
  operation?: TransferOperation | undefined;
  source?: string | undefined;
  destination?: string | undefined;
  jobName?: string | undefined;
  options: RawCommandOptions;
  cwd: string;
}): Promise<ResolvedTransferConfig> {
  const loaded = await loadConfig(input.options.config, input.cwd);
  return resolveTransferConfig({
    operation: input.operation,
    source: input.source,
    destination: input.destination,
    jobName: input.jobName,
    cli: toCliOptions(input.options),
    env: readEnvironment(),
    config: loaded.config,
    configDirectory: loaded.directory,
    cwd: input.cwd
  });
}

export async function executeResolvedTransfer(
  config: ResolvedTransferConfig,
  handlers: TransferHandlers,
  output: Output,
  commandOptions: RawCommandOptions
): Promise<void> {
  if (commandOptions.verbose) {
    verbosePlan(output, config);
  }

  if (config.dryRun) {
    if (!commandOptions.quiet) {
      writeDryRun(output, config);
    }
    return;
  }

  const onProgress = createProgressReporter(output, commandOptions.quiet);

  if (config.operation === "upload") {
    const uploadOptions: UploadOptions = {
      ...config,
      localPath: config.source,
      remotePath: config.destination
    };
    if (onProgress) uploadOptions.onProgress = onProgress;
    const results = await handlers.upload(uploadOptions);
    if (!commandOptions.quiet) {
      writeCommandResults(output, results, config);
    }
    return;
  }

  const downloadOptions: DownloadOptions = {
    ...config,
    remotePath: config.source,
    localPath: config.destination
  };
  if (onProgress) downloadOptions.onProgress = onProgress;
  await handlers.download(downloadOptions);
}
