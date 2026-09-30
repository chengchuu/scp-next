import { Command } from "commander";

import type { Output } from "../output.js";
import {
  addTransferOptions,
  executeResolvedTransfer,
  resolveForCli,
  type RawCommandOptions,
  type TransferHandlers
} from "./shared.js";

export function createRunCommand(handlers: TransferHandlers, output: Output, cwd: string): Command {
  const command = new Command("run")
    .description("Run a configured transfer job")
    .usage("<job> [source] [destination] [options]")
    .argument("<job>", "Configured job name")
    .argument("[source]", "Optional source override")
    .argument("[destination]", "Optional destination override")
    .action(
      async (
        jobName: string,
        source: string | undefined,
        destination: string | undefined,
        options: RawCommandOptions
      ) => {
        const resolved = await resolveForCli({
          source,
          destination,
          jobName,
          options,
          cwd
        });
        await executeResolvedTransfer(resolved, handlers, output, options);
      }
    );

  addTransferOptions(command, { postUploadCommand: true });
  return command;
}
