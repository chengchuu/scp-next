import path from "node:path";

import { selectJob } from "./jobs.js";
import { selectProfile } from "./profiles.js";
import type { EnvironmentConfig } from "./environment.js";
import type {
  ResolvedTransferConfig,
  ScpNextConfig,
  ScpServerOptions,
  TransferJob,
  TransferOperation,
  TransferOptions
} from "../types/index.js";
import { resolveLocalPath } from "../paths/local-path.js";

export interface CliTransferOptions extends ScpServerOptions, Omit<TransferOptions, "onProgress"> {
  profile?: string | undefined;
}

export interface ResolveTransferInput {
  operation?: TransferOperation | undefined;
  source?: string | undefined;
  destination?: string | undefined;
  cli?: CliTransferOptions | undefined;
  env?: EnvironmentConfig | undefined;
  config?: ScpNextConfig | undefined;
  configDirectory?: string | undefined;
  cwd?: string | undefined;
  jobName?: string | undefined;
}

const DEFAULT_TRANSFER: Omit<ResolvedTransferConfig, "operation" | "source" | "destination"> = {
  port: 22,
  recursive: false,
  overwrite: false,
  createDirectories: true,
  dryRun: false
};

function assignDefined<T extends object>(target: T, source: object | undefined): T {
  if (!source) {
    return target;
  }

  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (value !== undefined) {
      Object.assign(target, { [key]: value });
    }
  }

  return target;
}

function rootServer(config: ScpNextConfig): ScpServerOptions {
  const result: ScpServerOptions = {};
  assignDefined(result, config.server);
  assignDefined(result, {
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    privateKey: config.privateKey,
    privateKeyFile: config.privateKeyFile,
    passphrase: config.passphrase,
    agent: config.agent,
    timeout: config.timeout,
    hostFingerprint: config.hostFingerprint,
    knownHostsFile: config.knownHostsFile
  });
  return result;
}

function jobTransfer(job: TransferJob | undefined): Omit<TransferOptions, "onProgress"> {
  const result: Omit<TransferOptions, "onProgress"> = {};
  if (!job) {
    return result;
  }
  return assignDefined(result, {
    recursive: job.recursive,
    overwrite: job.overwrite,
    createDirectories: job.createDirectories,
    dryRun: job.dryRun,
    timeout: job.timeout
  });
}

function resolveConfigRelatedPaths(
  resolved: ResolvedTransferConfig,
  operation: TransferOperation,
  configDirectory: string
): ResolvedTransferConfig {
  const next = { ...resolved };

  if (next.privateKeyFile && !next.privateKeyFile.startsWith("~")) {
    next.privateKeyFile = path.isAbsolute(next.privateKeyFile)
      ? next.privateKeyFile
      : resolveLocalPath(next.privateKeyFile, configDirectory);
  }

  if (next.knownHostsFile && !next.knownHostsFile.startsWith("~")) {
    next.knownHostsFile = path.isAbsolute(next.knownHostsFile)
      ? next.knownHostsFile
      : resolveLocalPath(next.knownHostsFile, configDirectory);
  }

  if (operation === "upload" && !next.source.startsWith("~")) {
    next.source = path.isAbsolute(next.source)
      ? next.source
      : resolveLocalPath(next.source, configDirectory);
  }

  if (operation === "download" && !next.destination.startsWith("~")) {
    next.destination = path.isAbsolute(next.destination)
      ? next.destination
      : resolveLocalPath(next.destination, configDirectory);
  }

  return next;
}

export function resolveTransferConfig(input: ResolveTransferInput): ResolvedTransferConfig {
  const config = input.config ?? {};
  const env = input.env ?? {};
  const cli = input.cli ?? {};
  const configDirectory = input.configDirectory ?? process.cwd();
  const cwd = input.cwd ?? process.cwd();
  const job = input.jobName ? selectJob(config, input.jobName) : undefined;
  const operation = input.operation ?? job?.operation;

  if (!operation) {
    throw new Error("Transfer operation is required.");
  }

  const selectedProfileName =
    cli.profile ?? env.profile ?? job?.profile ?? config.defaultProfile;
  const profile = selectProfile(config, selectedProfileName);

  const resolved: ResolvedTransferConfig = {
    ...DEFAULT_TRANSFER,
    operation,
    source: job?.source ?? "",
    destination: job?.destination ?? ""
  };

  assignDefined(resolved, jobTransfer(job));
  assignDefined(resolved, config.transfer);
  assignDefined(resolved, rootServer(config));
  assignDefined(resolved, profile);
  assignDefined(resolved, {
    host: env.host,
    port: env.port,
    username: env.username,
    password: env.password,
    privateKey: env.privateKey,
    privateKeyFile: env.privateKeyFile,
    passphrase: env.passphrase,
    timeout: env.timeout
  });
  assignDefined(resolved, {
    source: input.source,
    destination: input.destination
  });
  assignDefined(resolved, cli);

  if (selectedProfileName) {
    resolved.profile = selectedProfileName;
  }

  const pathResolved = resolveConfigRelatedPaths(resolved, operation, configDirectory);

  if (input.source && operation === "upload") {
    pathResolved.source = resolveLocalPath(input.source, cwd);
  }

  if (input.destination && operation === "download") {
    pathResolved.destination = resolveLocalPath(input.destination, cwd);
  }

  return pathResolved;
}
