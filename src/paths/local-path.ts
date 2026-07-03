import { constants } from "node:fs";
import { access, mkdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { FileSystemError, ValidationError } from "../errors/index.js";

export function expandHome(inputPath: string): string {
  if (inputPath === "~") {
    return os.homedir();
  }
  if (inputPath.startsWith(`~${path.sep}`) || inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

export function resolveLocalPath(inputPath: string, baseDir = process.cwd()): string {
  const expanded = expandHome(inputPath);
  return path.isAbsolute(expanded) ? path.normalize(expanded) : path.resolve(baseDir, expanded);
}

export async function assertLocalPathExists(inputPath: string): Promise<void> {
  try {
    await access(resolveLocalPath(inputPath), constants.F_OK);
  } catch (error) {
    throw new FileSystemError(`Local path does not exist: ${inputPath}`, {
      cause: error,
      context: { path: inputPath }
    });
  }
}

export async function assertLocalFileReadable(inputPath: string): Promise<void> {
  try {
    await access(resolveLocalPath(inputPath), constants.R_OK);
  } catch (error) {
    throw new FileSystemError(`Local file is not readable: ${inputPath}`, {
      cause: error,
      context: { path: inputPath }
    });
  }
}

export async function assertDownloadDestination(inputPath: string, createDirectories = false) {
  const resolved = resolveLocalPath(inputPath);
  const parent = path.dirname(resolved);

  if (createDirectories) {
    await mkdir(parent, { recursive: true });
    return;
  }

  try {
    await access(parent, constants.W_OK);
  } catch (error) {
    throw new FileSystemError(`Local destination parent does not exist or is not writable: ${parent}`, {
      cause: error,
      context: { path: inputPath }
    });
  }
}

export async function getLocalPathKind(inputPath: string): Promise<"file" | "directory"> {
  const stats = await stat(resolveLocalPath(inputPath));
  if (stats.isDirectory()) {
    return "directory";
  }
  if (stats.isFile()) {
    return "file";
  }
  throw new ValidationError(`Local path must be a file or directory: ${inputPath}`, {
    context: { path: inputPath }
  });
}

export async function getLocalFileSize(inputPath: string): Promise<number> {
  const stats = await stat(resolveLocalPath(inputPath));
  return stats.size;
}
