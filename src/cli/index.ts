import { Command, CommanderError } from "commander";

import { download } from "../client/download.js";
import { upload } from "../client/upload.js";
import { ScpNextError } from "../errors/index.js";
import { formatErrorMessage } from "../security/redact.js";
import { createDownloadCommand } from "./commands/download.js";
import { createRunCommand } from "./commands/run.js";
import { createUploadCommand } from "./commands/upload.js";
import type { Output } from "./output.js";
import type { TransferHandlers } from "./commands/shared.js";

export interface RunCliOptions {
  argv?: string[];
  cwd?: string;
  output?: Output;
  handlers?: TransferHandlers;
}

export async function runCli(options: RunCliOptions = {}): Promise<number> {
  const output = options.output ?? { stdout: process.stdout, stderr: process.stderr };
  const cwd = options.cwd ?? process.cwd();
  const handlers = options.handlers ?? { upload, download };
  const program = new Command();

  program
    .name("scp-next")
    .description("Secure file transfers over SSH using SFTP")
    .version("0.1.0")
    .showHelpAfterError()
    .exitOverride();

  program.addCommand(createUploadCommand(handlers, output, cwd));
  program.addCommand(createDownloadCommand(handlers, output, cwd));
  program.addCommand(createRunCommand(handlers, output, cwd));

  try {
    await program.parseAsync(options.argv ?? process.argv, { from: "node" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.helpDisplayed" || error.code === "commander.version") {
        return 0;
      }
      output.stderr.write(`${formatErrorMessage(error.message)}\n`);
      return error.exitCode || 1;
    }

    const verbose = (options.argv ?? process.argv).includes("--verbose");
    if (error instanceof ScpNextError) {
      output.stderr.write(`Error: ${formatErrorMessage(error.message)}\n`);
      if (verbose && error.cause instanceof Error) {
        output.stderr.write(`${formatErrorMessage(error.cause.stack ?? error.cause.message)}\n`);
      }
      return 1;
    }

    output.stderr.write(`Error: ${formatErrorMessage(error)}\n`);
    if (verbose && error instanceof Error && error.stack) {
      output.stderr.write(`${formatErrorMessage(error.stack)}\n`);
    }
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
