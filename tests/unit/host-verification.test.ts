import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { HostVerificationError } from "../../src/errors/index.js";
import {
  createHostVerifier,
  resolveAllowedFingerprints
} from "../../src/security/host-verification.js";

const publicKey = Buffer.from("scp-next-test-host-key");
const publicKeyBase64 = publicKey.toString("base64");
const publicKeySha256Hex = createHash("sha256").update(publicKey).digest("hex");
const publicKeySha256Base64 = createHash("sha256")
  .update(publicKey)
  .digest("base64")
  .replace(/=+$/g, "");

describe("host verification", () => {
  it("shows a typical fix when no matching host fingerprint is configured", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests");
    const knownHostsFile = path.join(directory, "empty-known-hosts");
    await mkdir(directory, { recursive: true });
    await writeFile(knownHostsFile, "");

    await expect(
      resolveAllowedFingerprints({
        host: "example.com",
        knownHostsFile
      })
    ).rejects.toThrow(HostVerificationError);

    await expect(
      resolveAllowedFingerprints({
        host: "example.com",
        knownHostsFile
      })
    ).rejects.toThrow("Typical fix:\n  ssh example.com");
  });

  it("matches known-hosts entries against ssh2 sha256 hex fingerprints", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests");
    const knownHostsFile = path.join(directory, "known-hosts");
    await mkdir(directory, { recursive: true });
    await writeFile(knownHostsFile, `example.com ssh-ed25519 ${publicKeyBase64}\n`);

    const allowedFingerprints = await resolveAllowedFingerprints({
      host: "example.com",
      knownHostsFile
    });
    const verifyHost = createHostVerifier(allowedFingerprints);

    expect(verifyHost(publicKeySha256Hex)).toBe(true);
  });

  it("matches explicit OpenSSH SHA256 fingerprints against ssh2 sha256 hex fingerprints", async () => {
    const allowedFingerprints = await resolveAllowedFingerprints({
      host: "example.com",
      hostFingerprint: `SHA256:${publicKeySha256Base64}`
    });
    const verifyHost = createHostVerifier(allowedFingerprints);

    expect(verifyHost(publicKeySha256Hex)).toBe(true);
  });

  it("matches non-default port known-hosts entries", async () => {
    const directory = path.join(os.tmpdir(), "scp-next-tests");
    const knownHostsFile = path.join(directory, "known-hosts-port");
    await mkdir(directory, { recursive: true });
    await writeFile(knownHostsFile, `[example.com]:2222 ssh-ed25519 ${publicKeyBase64}\n`);

    const allowedFingerprints = await resolveAllowedFingerprints({
      host: "example.com",
      port: 2222,
      knownHostsFile
    });
    const verifyHost = createHostVerifier(allowedFingerprints);

    expect(verifyHost(publicKeySha256Hex)).toBe(true);
  });
});
