import { Command } from "commander";

import { assertSourceDestination } from "../operands.js";
import type { Output } from "../output.js";
import {
  addTransferOptions,
  executeResolvedTransfer,
  resolveForCli,
  type RawCommandOptions,
  type TransferHandlers
} from "./shared.js";

export function createUploadCommand(handlers: TransferHandlers, output: Output, cwd: string): Command {
  const command = new Command("upload")
    .description("Upload a local source path to a remote destination path")
    .usage("<source> <destination> [options]")
    .argument("[source]", "Local file or directory")
    .argument("[destination]", "Remote file or directory path")
    .action(async (source: string | undefined, destination: string | undefined, options: RawCommandOptions) => {
      assertSourceDestination("upload", source, destination);
      const resolved = await resolveForCli({
        operation: "upload",
        source,
        destination,
        options,
        cwd
      });
      await executeResolvedTransfer(resolved, handlers, output, options);
    });

  addTransferOptions(command, { afterUpload: true });
  return command;
}
