import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { RemoteFileInfo, SftpTransport } from "./transport.js";
import { resolveLocalPath } from "../paths/local-path.js";
import { remoteJoin } from "../paths/remote-path.js";

export interface LocalFileEntry {
  absolutePath: string;
  relativePath: string;
  size: number;
}

export async function walkLocalFiles(rootPath: string): Promise<LocalFileEntry[]> {
  const resolvedRoot = resolveLocalPath(rootPath);
  const stats = await stat(resolvedRoot);

  if (stats.isFile()) {
    return [
      {
        absolutePath: resolvedRoot,
        relativePath: path.basename(resolvedRoot),
        size: stats.size
      }
    ];
  }

  const files: LocalFileEntry[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        const entryStats = await stat(absolutePath);
        files.push({
          absolutePath,
          relativePath: path.relative(resolvedRoot, absolutePath),
          size: entryStats.size
        });
      }
    }
  }

  await visit(resolvedRoot);
  return files;
}

export interface RemoteFileEntry {
  remotePath: string;
  relativePath: string;
  size: number;
}

export async function walkRemoteFiles(
  transport: SftpTransport,
  rootPath: string
): Promise<RemoteFileEntry[]> {
  const rootEntries = await transport.list(rootPath);
  const files: RemoteFileEntry[] = [];

  async function visit(directory: string, relativeBase: string, entries: RemoteFileInfo[]): Promise<void> {
    for (const entry of entries) {
      const fullPath = remoteJoin(directory, entry.name);
      const relativePath = relativeBase ? remoteJoin(relativeBase, entry.name) : entry.name;
      if (entry.type === "d") {
        await visit(fullPath, relativePath, await transport.list(fullPath));
      } else if (entry.type === "-") {
        files.push({
          remotePath: fullPath,
          relativePath,
          size: entry.size
        });
      }
    }
  }

  await visit(rootPath, "", rootEntries);
  return files;
}
