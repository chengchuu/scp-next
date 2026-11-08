import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";

import { HostVerificationError } from "../errors/index.js";
import { expandHome } from "../paths/local-path.js";
import { hostVerificationDiagnostics } from "./host-verification-diagnostics.js";

function normalizeFingerprint(fingerprint: string): string {
  return fingerprint
    .trim()
    .replace(/^SHA256:/i, "")
    .replace(/^sha256:/i, "")
    .replace(/=+$/g, "");
}

function isHexFingerprint(fingerprint: string): boolean {
  return /^[0-9a-f]+$/i.test(fingerprint);
}

function fingerprintCandidates(fingerprint: string): string[] {
  const normalized = normalizeFingerprint(fingerprint);
  const candidates = new Set([normalized]);

  if (isHexFingerprint(normalized)) {
    candidates.add(normalized.toLowerCase());
  } else {
    try {
      candidates.add(Buffer.from(normalized, "base64").toString("hex"));
    } catch {
      // Keep the original normalized value when it is not valid base64.
    }
  }

  return [...candidates];
}

export function isFingerprintMatch(actual: string, expected: string): boolean {
  const normalizedActual = normalizeFingerprint(actual);
  const normalizedExpected = normalizeFingerprint(expected);
  if (normalizedActual === normalizedExpected) {
    return true;
  }
  return (
    isHexFingerprint(normalizedActual) &&
    isHexFingerprint(normalizedExpected) &&
    normalizedActual.toLowerCase() === normalizedExpected.toLowerCase()
  );
}

export interface HostVerifierConfig {
  host?: string | undefined;
  port?: number | undefined;
  hostFingerprint?: string | undefined;
  knownHostsFile?: string | undefined;
}

export async function resolveAllowedFingerprints(
  options: HostVerifierConfig
): Promise<Set<string>> {
  const fingerprints = new Set<string>();
  const knownHostsFile = options.knownHostsFile ?? "~/.ssh/known_hosts";

  if (!options.host) {
    throw new HostVerificationError("A host is required for SSH host verification.");
  }

  if (options.hostFingerprint) {
    for (const fingerprint of fingerprintCandidates(options.hostFingerprint)) {
      fingerprints.add(fingerprint);
    }
  }

  try {
    await access(expandHome(knownHostsFile));
    const content = await readFile(expandHome(knownHostsFile), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("@")) {
        continue;
      }

      const [hosts, algorithm, key] = trimmed.split(/\s+/);
      const hostPatterns = hosts?.split(",") ?? [];
      const portHost = options.port ? `[${options.host}]:${options.port}` : undefined;
      const matchesHost =
        hostPatterns.includes(options.host) || Boolean(portHost && hostPatterns.includes(portHost));
      if (!hosts || !algorithm || !key || !matchesHost) {
        continue;
      }

      const keyBuffer = Buffer.from(key, "base64");
      fingerprints.add(createHash("sha256").update(keyBuffer).digest("base64").replace(/=+$/g, ""));
      fingerprints.add(createHash("sha256").update(keyBuffer).digest("hex"));
    }
  } catch (error) {
    if (options.knownHostsFile || !options.hostFingerprint) {
      const missing =
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT";
      throw new HostVerificationError(
        `SSH host verification failed before connecting: the known-hosts file ${
          missing ? "was not found" : "could not be read"
        }.${hostVerificationDiagnostics(options)}`,
        { cause: error, context: { knownHostsFile } }
      );
    }
  }

  if (fingerprints.size === 0) {
    throw new HostVerificationError(
      `SSH host verification failed before connecting: no usable matching host keys were found.${hostVerificationDiagnostics(options)}`
    );
  }

  return fingerprints;
}

export function createHostVerifier(allowedFingerprints: Set<string>) {
  return (hashedKey: string): boolean => {
    for (const expected of allowedFingerprints) {
      if (isFingerprintMatch(hashedKey, expected)) {
        return true;
      }
    }
    return false;
  };
}
