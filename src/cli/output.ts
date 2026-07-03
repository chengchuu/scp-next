import type { ResolvedTransferConfig, TransferProgress } from "../types/index.js";
import { redactSensitiveValues } from "../security/redact.js";

export interface Output {
  stdout: NodeJS.WritableStream & { isTTY?: boolean };
  stderr: NodeJS.WritableStream & { isTTY?: boolean };
}

export function writeDryRun(output: Output, config: ResolvedTransferConfig): void {
  const destination =
    config.operation === "upload"
      ? `${config.username ?? "user"}@${config.host ?? "host"}:${config.destination}`
      : config.destination;

  output.stdout.write(`Dry run: ${config.operation}\n`);
  output.stdout.write(`Source: ${config.source}\n`);
  output.stdout.write(`Destination: ${destination}\n`);
  output.stdout.write(`Recursive: ${config.recursive ? "yes" : "no"}\n`);
  output.stdout.write(`Overwrite: ${config.overwrite ? "yes" : "no"}\n`);
}

export function createProgressReporter(
  output: Output,
  quiet?: boolean
): ((progress: TransferProgress) => void) | undefined {
  if (quiet || !output.stderr.isTTY) {
    return undefined;
  }

  return (progress) => {
    const total = progress.totalBytes ? formatBytes(progress.totalBytes) : "?";
    const transferred = formatBytes(progress.transferredBytes);
    const percentage = progress.percentage === undefined ? "" : ` (${progress.percentage}%)`;
    const currentFile = progress.currentFile ? `: ${progress.currentFile}` : "";
    output.stderr.write(`\r${progress.operation === "upload" ? "Uploading" : "Downloading"}${currentFile}\n`);
    output.stderr.write(`${transferred} / ${total}${percentage}\n`);
  };
}

export function verbosePlan(output: Output, config: ResolvedTransferConfig): void {
  output.stderr.write(
    `${JSON.stringify(
      redactSensitiveValues({
        operation: config.operation,
        host: config.host,
        port: config.port,
        username: config.username,
        source: config.source,
        destination: config.destination,
        recursive: config.recursive,
        overwrite: config.overwrite,
        createDirectories: config.createDirectories,
        dryRun: config.dryRun
      }),
      null,
      2
    )}\n`
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
