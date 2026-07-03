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
    return String(redactSensitiveValues(error.message));
  }
  return String(redactSensitiveValues(error));
}
