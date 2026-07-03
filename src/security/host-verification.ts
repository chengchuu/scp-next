import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";

import { HostVerificationError } from "../errors/index.js";
import { expandHome } from "../paths/local-path.js";

function normalizeFingerprint(fingerprint: string): string {
  return fingerprint
    .trim()
    .replace(/^SHA256:/i, "")
    .replace(/^sha256:/i, "")
    .replace(/=+$/g, "");
}

export function isFingerprintMatch(actual: string, expected: string): boolean {
  return normalizeFingerprint(actual) === normalizeFingerprint(expected);
}

export interface HostVerifierConfig {
  host?: string | undefined;
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
    fingerprints.add(normalizeFingerprint(options.hostFingerprint));
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
      if (!hosts || !algorithm || !key || !hosts.split(",").includes(options.host)) {
        continue;
      }

      const fingerprint = createHash("sha256")
        .update(Buffer.from(key, "base64"))
        .digest("base64")
        .replace(/=+$/g, "");
      fingerprints.add(fingerprint);
    }
  } catch (error) {
    if (options.knownHostsFile || !options.hostFingerprint) {
      throw new HostVerificationError(
        "SSH host verification requires hostFingerprint or an accessible knownHostsFile.",
        { cause: error, context: { knownHostsFile } }
      );
    }
  }

  if (fingerprints.size === 0) {
    throw new HostVerificationError(
      "SSH host verification failed before connecting: no matching host fingerprint was configured."
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
