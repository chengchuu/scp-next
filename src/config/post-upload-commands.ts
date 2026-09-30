import { ValidationError } from "../errors/index.js";

function isPostUploadCommands(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (command: unknown): command is string =>
        typeof command === "string" && command.trim().length > 0
    )
  );
}

export function getPostUploadCommands(
  source: unknown
): string[] | undefined {
  const commands: unknown = readPostUploadCommands(source);
  if (commands === undefined) {
    return undefined;
  }
  if (!isPostUploadCommands(commands)) {
    throw new ValidationError(
      "postUploadCommands must be an array of non-empty command strings."
    );
  }
  return commands;
}

export function readPostUploadCommands(
  source: unknown
): unknown {
  if (typeof source !== "object" || source === null) {
    return undefined;
  }

  return (source as { postUploadCommands?: unknown })
    .postUploadCommands;
}

export function clearPostUploadCommands(source: object): void {
  (source as { postUploadCommands?: string[] | undefined }).postUploadCommands =
    undefined;
}
