import { ValidationError } from "../errors/index.js";
import type { TransferOperation } from "../types/index.js";

export function usageFor(operation: TransferOperation): string {
  return `scp-next ${operation} <source> <destination> [options]`;
}

export function assertSourceDestination(
  operation: TransferOperation,
  source?: string,
  destination?: string
): asserts source is string {
  if (!source) {
    throw new ValidationError(`Missing source path.\n\nUsage:\n  ${usageFor(operation)}`);
  }
  if (!destination) {
    throw new ValidationError(`Missing destination path.\n\nUsage:\n  ${usageFor(operation)}`);
  }
}
