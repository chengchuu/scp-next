import { ScpNextClientImpl } from "./client.js";
import type { ExecResult, UploadOptions } from "../types/index.js";

export async function upload(options: UploadOptions): Promise<ExecResult[]> {
  const client = new ScpNextClientImpl(options);
  let result: ExecResult[];
  try {
    result = await client.upload(options.localPath, options.remotePath, options);
  } catch (error) {
    try {
      await client.close();
    } catch {
      // Preserve the upload or command failure as the primary error.
    }
    throw error;
  }
  await client.close();
  return result;
}
