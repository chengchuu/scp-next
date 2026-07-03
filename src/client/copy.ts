import { download } from "./download.js";
import { upload } from "./upload.js";
import { ValidationError } from "../errors/index.js";
import type { CopyOptions } from "../types/index.js";

export async function copy(options: CopyOptions): Promise<void> {
  if (options.source.type === "local" && options.destination.type === "remote") {
    await upload({
      ...options,
      localPath: options.source.path,
      remotePath: options.destination.path
    });
    return;
  }

  if (options.source.type === "remote" && options.destination.type === "local") {
    await download({
      ...options,
      remotePath: options.source.path,
      localPath: options.destination.path
    });
    return;
  }

  throw new ValidationError("copy() supports only local-to-remote or remote-to-local transfers.", {
    context: {
      sourceType: options.source.type,
      destinationType: options.destination.type
    }
  });
}
