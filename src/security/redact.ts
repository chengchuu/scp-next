const SENSITIVE_KEYS = [
  "password",
  "passphrase",
  "privatekey",
  "privatekeyfile",
  "token",
  "authorization",
  "credential",
  "secret"
];

const PRIVATE_KEY_PATTERN =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const SECRET_OPTION_PATTERN =
  /(--(?:password|passphrase|token|secret|authorization|credential)(?:=|\s+))(?:"[^"]*"|'[^']*'|\S+)/gi;
const SECRET_ASSIGNMENT_PATTERN =
  /(\b(?:password|passphrase|token|secret|authorization|credential)[A-Z0-9_-]*\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s&]+)/gi;

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[-_\s]/g, "").toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive));
}

export function redactSensitiveValues(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(PRIVATE_KEY_PATTERN, "[REDACTED]");
  }

  if (Array.isArray(value)) {
    const redacted: unknown[] = value.map((item: unknown) => redactSensitiveValues(item));
    return redacted;
  }

  if (value && typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      redacted[key] = isSensitiveKey(key) ? "[REDACTED]" : redactSensitiveValues(nestedValue);
    }
    return redacted;
  }

  return value;
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return redactKnownSensitiveValues(error.message, {});
  }
  return redactKnownSensitiveValues(String(error), {});
}

export function redactKnownSensitiveValues(
  text: string,
  source: object
): string {
  const sensitiveValues = collectSensitiveValues(source);
  const redactedKnownValues = sensitiveValues.reduce(
    (redacted, value) => redacted.split(value).join("[REDACTED]"),
    String(redactSensitiveValues(text))
  );
  return redactedKnownValues
    .replace(SECRET_OPTION_PATTERN, "$1[REDACTED]")
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1[REDACTED]");
}

function collectSensitiveValues(value: unknown, key = ""): string[] {
  if (isSensitiveKey(key)) {
    if (typeof value === "string" && value) {
      return [value];
    }
    if (Buffer.isBuffer(value) && value.length > 0) {
      return [value.toString("utf8")];
    }
    return [];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([nestedKey, nestedValue]) =>
    collectSensitiveValues(nestedValue, nestedKey)
  );
}
