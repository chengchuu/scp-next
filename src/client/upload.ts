import { ScpNextClientImpl } from "./client.js";
import type { UploadOptions } from "../types/index.js";

export async function upload(options: UploadOptions): Promise<void> {
  const client = new ScpNextClientImpl(options);
  try {
    await client.upload(options.localPath, options.remotePath, options);
  } finally {
    await client.close();
  }
}
