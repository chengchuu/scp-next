import { redactSensitiveValues } from "../security/redact.js";

export type ScpNextErrorCode =
  | "SCP_NEXT_ERROR"
  | "SCP_NEXT_CONFIGURATION_ERROR"
  | "SCP_NEXT_VALIDATION_ERROR"
  | "SCP_NEXT_AUTHENTICATION_ERROR"
  | "SCP_NEXT_CONNECTION_ERROR"
  | "SCP_NEXT_TRANSFER_ERROR"
  | "SCP_NEXT_REMOTE_COMMAND_ERROR"
  | "SCP_NEXT_FILESYSTEM_ERROR"
  | "SCP_NEXT_HOST_VERIFICATION_ERROR";

export interface ScpNextErrorOptions {
  code?: ScpNextErrorCode;
  cause?: unknown;
  context?: Record<string, unknown>;
}

export class ScpNextError extends Error {
  readonly code: ScpNextErrorCode;
  readonly context: Record<string, unknown>;

  constructor(message: string, options: ScpNextErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code ?? "SCP_NEXT_ERROR";
    this.context = redactSensitiveValues(options.context ?? {}) as Record<string, unknown>;
  }
}

export class ConfigurationError extends ScpNextError {
  constructor(message: string, options: Omit<ScpNextErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "SCP_NEXT_CONFIGURATION_ERROR" });
  }
}

export class ValidationError extends ScpNextError {
  constructor(message: string, options: Omit<ScpNextErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "SCP_NEXT_VALIDATION_ERROR" });
  }
}

export class AuthenticationError extends ScpNextError {
  constructor(message: string, options: Omit<ScpNextErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "SCP_NEXT_AUTHENTICATION_ERROR" });
  }
}

export class ConnectionError extends ScpNextError {
  constructor(message: string, options: Omit<ScpNextErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "SCP_NEXT_CONNECTION_ERROR" });
  }
}

export class TransferError extends ScpNextError {
  constructor(message: string, options: Omit<ScpNextErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "SCP_NEXT_TRANSFER_ERROR" });
  }
}

export interface RemoteCommandErrorOptions extends Omit<ScpNextErrorOptions, "code"> {
  exitCode: number | null;
  signal?: string | undefined;
  stdout?: string | undefined;
  stderr?: string | undefined;
}

export class RemoteCommandError extends ScpNextError {
  readonly exitCode: number | null;
  readonly signal?: string | undefined;
  readonly stdout: string;
  readonly stderr: string;

  constructor(message: string, options: RemoteCommandErrorOptions) {
    super(message, {
      code: "SCP_NEXT_REMOTE_COMMAND_ERROR",
      ...(options.cause !== undefined ? { cause: options.cause } : {}),
      ...(options.context !== undefined ? { context: options.context } : {})
    });
    this.exitCode = options.exitCode;
    this.signal = options.signal;
    this.stdout = options.stdout ?? "";
    this.stderr = options.stderr ?? "";
  }
}

export class FileSystemError extends ScpNextError {
  constructor(message: string, options: Omit<ScpNextErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "SCP_NEXT_FILESYSTEM_ERROR" });
  }
}

export class HostVerificationError extends ScpNextError {
  constructor(message: string, options: Omit<ScpNextErrorOptions, "code"> = {}) {
    super(message, { ...options, code: "SCP_NEXT_HOST_VERIFICATION_ERROR" });
  }
}

export function toScpNextError(error: unknown): ScpNextError {
  if (error instanceof ScpNextError) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Unexpected scp-next error.";
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("authentication") || lowerMessage.includes("permission denied")) {
    return new AuthenticationError("SSH authentication failed.", { cause: error });
  }

  if (
    lowerMessage.includes("host verification") ||
    lowerMessage.includes("host key") ||
    lowerMessage.includes("fingerprint") ||
    (lowerMessage.includes("host") && lowerMessage.includes("denied"))
  ) {
    return new HostVerificationError("SSH host verification failed.", { cause: error });
  }

  if (
    lowerMessage.includes("timed out") ||
    lowerMessage.includes("connection") ||
    lowerMessage.includes("econn")
  ) {
    return new ConnectionError("SSH connection failed.", { cause: error });
  }

    return new TransferError(String(redactSensitiveValues(message)), { cause: error });
}
