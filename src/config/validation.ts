import { access } from "node:fs/promises";

import { ValidationError } from "../errors/index.js";
import { assertDownloadDestination, assertLocalPathExists, resolveLocalPath } from "../paths/local-path.js";
import { assertRemotePath } from "../paths/remote-path.js";
import type { DownloadOptions, ScpServerOptions, UploadOptions } from "../types/index.js";

function validatePort(port: number | undefined): void {
  if (port === undefined) {
    return;
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ValidationError("Port must be an integer between 1 and 65535.", {
      context: { port }
    });
  }
}

function validateTimeout(timeout: number | undefined): void {
  if (timeout === undefined) {
    return;
  }
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new ValidationError("Timeout must be a positive number.", {
      context: { timeout }
    });
  }
}

function validateAfterUpload(commands: unknown): void {
  if (commands === undefined) {
    return;
  }
  if (
    !Array.isArray(commands) ||
    commands.some((command) => typeof command !== "string" || !command.trim())
  ) {
    throw new ValidationError(
      "afterUpload must be an array of non-empty command strings."
    );
  }
}

export async function validateServerOptions(options: ScpServerOptions): Promise<void> {
  if (!options.host) {
    throw new ValidationError("Host is required.");
  }
  if (!options.username) {
    throw new ValidationError("Username is required.");
  }

  validatePort(options.port);
  validateTimeout(options.timeout);

  if (options.privateKeyFile) {
    try {
      await access(resolveLocalPath(options.privateKeyFile));
    } catch (error) {
      throw new ValidationError(`Private key file does not exist: ${options.privateKeyFile}`, {
        cause: error,
        context: { privateKeyFile: options.privateKeyFile }
      });
    }
  }

  const hasAuthentication =
    Boolean(options.password) ||
    Boolean(options.privateKey) ||
    Boolean(options.privateKeyFile) ||
    Boolean(options.agent) ||
    Boolean(process.env.SSH_AUTH_SOCK);

  if (!hasAuthentication) {
    throw new ValidationError(
      "Authentication is required. Provide a password, private key, private key file, or SSH agent."
    );
  }
}

export async function validateUploadOptions(options: UploadOptions): Promise<void> {
  if (!options.localPath) {
    throw new ValidationError("Missing localPath.");
  }
  if (!options.remotePath) {
    throw new ValidationError("Missing remotePath.");
  }
  assertRemotePath(options.remotePath, "remotePath");
  validateTimeout(options.timeout);
  validateAfterUpload(options.afterUpload);
  await assertLocalPathExists(options.localPath);

  if (!options.dryRun) {
    await validateServerOptions(options);
  }
}

export async function validateDownloadOptions(options: DownloadOptions): Promise<void> {
  if (!options.remotePath) {
    throw new ValidationError("Missing remotePath.");
  }
  if (!options.localPath) {
    throw new ValidationError("Missing localPath.");
  }
  assertRemotePath(options.remotePath, "remotePath");
  validateTimeout(options.timeout);
  if (options.afterUpload?.length) {
    throw new ValidationError("Post-upload commands are not supported for downloads.");
  }
  await assertDownloadDestination(options.localPath, options.createDirectories ?? true);

  if (!options.dryRun) {
    await validateServerOptions(options);
  }
}
