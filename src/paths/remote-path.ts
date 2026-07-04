import path from "node:path";

import { ValidationError } from "../errors/index.js";

export function assertRemotePath(inputPath: string, label = "remote path"): void {
  if (!inputPath || inputPath.trim().length === 0) {
    throw new ValidationError(`Invalid ${label}: remote paths must not be empty.`, {
      context: { path: inputPath }
    });
  }
}

export function normalizeRemotePath(inputPath: string): string {
  assertRemotePath(inputPath);
  return path.posix.normalize(inputPath.replace(/\\/g, "/"));
}

export function restoreMsysConvertedRemotePath(inputPath: string): string {
  const normalized = inputPath.replace(/\\/g, "/");
  const match = /^[A-Za-z]:\/(?:Program Files\/Git|Program Files \(x86\)\/Git|Git|msys64)\/(.+)$/i.exec(
    normalized
  );

  return match ? `/${match[1]}` : inputPath;
}

export function remoteJoin(...parts: string[]): string {
  const joined = path.posix.join(...parts);
  assertRemotePath(joined);
  return joined;
}

export function remoteDirname(inputPath: string): string {
  assertRemotePath(inputPath);
  return path.posix.dirname(inputPath);
}
