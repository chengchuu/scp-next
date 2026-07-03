import { ScpNextClientImpl } from "./client.js";
import type { DownloadOptions } from "../types/index.js";

export async function download(options: DownloadOptions): Promise<void> {
  const client = new ScpNextClientImpl(options);
  try {
    await client.download(options.remotePath, options.localPath, options);
  } finally {
    await client.close();
  }
}
