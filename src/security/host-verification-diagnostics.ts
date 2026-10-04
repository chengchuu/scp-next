import type { HostVerifierConfig } from "./host-verification.js";
import { redactKnownSensitiveValues } from "./redact.js";

function displayValue(value: string, options: HostVerifierConfig): string {
  return JSON.stringify(redactKnownSensitiveValues(value, options)).replace(
    /[\u007f-\u009f\u2028-\u202e\u2066-\u2069]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
  );
}

/** Diagnostic text only: never scans hosts or changes trust files. */
export function hostVerificationDiagnostics(options: HostVerifierConfig): string {
  return [
    "",
    `Host: ${displayValue(options.host ?? "<host>", options)}`,
    `Port: ${options.port ?? 22}`,
    `Known-hosts file: ${displayValue(options.knownHostsFile ?? "~/.ssh/known_hosts", options)}`,
    `Explicit hostFingerprint configured: ${options.hostFingerprint ? "yes" : "no"}`,
    "Scan the configured host and port into a temporary file. Independently verify every",
    "key you intend to trust before deliberately saving it to the selected trust file.",
    "Investigate a changed trusted key before updating trust; do not disable verification.",
    "Guide: https://github.com/chengchuu/scp-next/blob/main/guides/HOST_VERIFICATION_TROUBLESHOOTING.md"
  ].join("\n");
}
