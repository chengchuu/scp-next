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

export function createDownloadCommand(handlers: TransferHandlers, output: Output, cwd: string): Command {
  const command = new Command("download")
    .description("Download a remote source path to a local destination path")
    .usage("<source> <destination> [options]")
    .argument("[source]", "Remote file or directory path")
    .argument("[destination]", "Local file or directory")
    .action(async (source: string | undefined, destination: string | undefined, options: RawCommandOptions) => {
      assertSourceDestination("download", source, destination);
      const resolved = await resolveForCli({
        operation: "download",
        source,
        destination,
        options,
        cwd
      });
      await executeResolvedTransfer(resolved, handlers, output, options);
    });

  addTransferOptions(command);
  return command;
}
