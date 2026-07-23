import type {
  ExecResult,
  ResolvedTransferConfig,
  TransferProgress
} from "../types/index.js";
import {
  redactKnownSensitiveValues,
  redactSensitiveValues
} from "../security/redact.js";

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
  if (config.operation === "upload" && config.afterUpload?.length) {
    output.stdout.write("\nPost-upload commands:\n");
    config.afterUpload.forEach((command, index) => {
      output.stdout.write(
        `${index + 1}. ${redactKnownSensitiveValues(command, config)}\n`
      );
    });
  }
}

export function writeCommandResults(
  output: Output,
  results: ExecResult[],
  config: ResolvedTransferConfig
): void {
  results.forEach((result, index) => {
    output.stdout.write(`Remote command ${index + 1} completed successfully.\n`);
    if (result.stdout) {
      output.stdout.write(
        redactKnownSensitiveValues(result.stdout, config)
      );
      if (!result.stdout.endsWith("\n")) output.stdout.write("\n");
    }
    if (result.stderr) {
      output.stderr.write(
        redactKnownSensitiveValues(result.stderr, config)
      );
      if (!result.stderr.endsWith("\n")) output.stderr.write("\n");
    }
  });
}

export function createProgressReporter(
  output: Output,
  quiet?: boolean
): ((progress: TransferProgress) => void) | undefined {
  if (quiet || !output.stderr.isTTY) {
    return undefined;
  }

  const minimumUpdateIntervalMs = 500;
  let lastLineLength = 0;
  let lastPercentage: number | undefined;
  let lastWriteAt = 0;
  let completed = false;

  return (progress) => {
    if (completed) {
      return;
    }

    const now = Date.now();
    const totalBytes = progress.totalBytes;
    const isComplete =
      progress.percentage === 100 ||
      (totalBytes !== undefined && totalBytes > 0 && progress.transferredBytes >= totalBytes);
    const percentageChanged =
      progress.percentage !== undefined && progress.percentage !== lastPercentage;

    if (
      !isComplete &&
      !percentageChanged &&
      lastWriteAt !== 0 &&
      now - lastWriteAt < minimumUpdateIntervalMs
    ) {
      return;
    }

    const total = progress.totalBytes ? formatBytes(progress.totalBytes) : "?";
    const transferred = formatBytes(progress.transferredBytes);
    const percentage = progress.percentage === undefined ? "" : ` (${progress.percentage}%)`;
    const currentFile = progress.currentFile ? `: ${progress.currentFile}` : "";
    const line = `${progress.operation === "upload" ? "Uploading" : "Downloading"}${currentFile} ${transferred} / ${total}${percentage}`;
    const padding = " ".repeat(Math.max(0, lastLineLength - line.length));
    output.stderr.write(`\r${line}${padding}`);

    lastLineLength = line.length;
    lastPercentage = progress.percentage;
    lastWriteAt = now;

    if (isComplete) {
      output.stderr.write("\n");
      completed = true;
    }
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
        dryRun: config.dryRun,
        afterUpload: config.afterUpload?.map((_command, index) => `command-${index + 1}`)
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
