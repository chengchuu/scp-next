import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { HostVerificationError } from "../../src/errors/index.js";
import {
  createHostVerifier,
  resolveAllowedFingerprints
} from "../../src/security/host-verification.js";
import { hostVerificationDiagnostics } from "../../src/security/host-verification-diagnostics.js";

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof fs>())
}));

const publicKey = Buffer.from("scp-next-test-host-key");
const publicKeyBase64 = publicKey.toString("base64");
const publicKeySha256Hex = createHash("sha256").update(publicKey).digest("hex");
const publicKeySha256Base64 = createHash("sha256")
  .update(publicKey)
  .digest("base64")
  .replace(/=+$/g, "");

describe("host verification", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows verified-trust guidance when no matching host keys are usable", async () => {
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
    ).rejects.toThrow("no usable matching host keys were found");
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
    expect(verifyHost("untrusted-key")).toBe(false);
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
    await writeFile(
      knownHostsFile,
      `[example.com]:2222 ssh-ed25519 ${publicKeyBase64}\n`
    );

    const allowedFingerprints = await resolveAllowedFingerprints({
      host: "example.com",
      port: 2222,
      knownHostsFile
    });
    const verifyHost = createHostVerifier(allowedFingerprints);

    expect(verifyHost(publicKeySha256Hex)).toBe(true);
  });

  it.each(["ENOENT", "EACCES", "EISDIR"])(
    "distinguishes missing files from other access failures (%s)",
    async (code) => {
      const cause = Object.assign(new Error("sensitive filesystem detail"), { code });
      vi.spyOn(fs, "access").mockRejectedValueOnce(cause);
      const options = {
        host: "example.com",
        port: 2222,
        knownHostsFile: "/custom/trust"
      };
      await expect(resolveAllowedFingerprints(options)).rejects.toMatchObject({
        code: "SCP_NEXT_HOST_VERIFICATION_ERROR",
        cause,
        message: `SSH host verification failed before connecting: the known-hosts file ${
          code === "ENOENT" ? "was not found" : "could not be read"
        }.${hostVerificationDiagnostics(options)}`
      });
    }
  );

  it("also handles a failure while reading an accessible file", async () => {
    vi.spyOn(fs, "access").mockResolvedValueOnce(undefined);
    vi.spyOn(fs, "readFile").mockRejectedValueOnce(
      Object.assign(new Error("denied"), { code: "EACCES" })
    );
    await expect(resolveAllowedFingerprints({ host: "example.com" })).rejects.toThrow(
      "could not be read"
    );
  });

  it("allows an explicit fingerprint with a missing default file, but not a custom file", async () => {
    vi.spyOn(fs, "access").mockRejectedValue(
      Object.assign(new Error("missing"), { code: "ENOENT" })
    );
    const options = {
      host: "example.com",
      hostFingerprint: `SHA256:${publicKeySha256Base64}`
    };
    const allowed = await resolveAllowedFingerprints(options);
    expect(createHostVerifier(allowed)(publicKeySha256Hex)).toBe(true);
    await expect(
      resolveAllowedFingerprints({ ...options, knownHostsFile: "/custom/trust" })
    ).rejects.toThrow("was not found");
  });

  it.each([
    "other-host ssh-ed25519 KEY",
    "|1|salt|hash ssh-ed25519 KEY",
    "@cert-authority example.com ssh-ed25519 KEY",
    "@revoked example.com ssh-ed25519 KEY",
    "example.com"
  ])("does not claim an entry is absent when it is unusable: %s", async (line) => {
    vi.spyOn(fs, "access").mockResolvedValueOnce(undefined);
    vi.spyOn(fs, "readFile").mockResolvedValueOnce(line.replace("KEY", publicKeyBase64));
    await expect(resolveAllowedFingerprints({ host: "example.com" })).rejects.toThrow(
      "no usable matching host keys were found"
    );
  });

  it("preserves the union of explicit fingerprints and matching file keys without writing", async () => {
    vi.spyOn(fs, "access").mockResolvedValueOnce(undefined);
    const read = vi
      .spyOn(fs, "readFile")
      .mockResolvedValueOnce(`example.com ssh-ed25519 ${publicKeyBase64}\n`);
    const write = vi.spyOn(fs, "writeFile");
    const allowed = await resolveAllowedFingerprints({
      host: "example.com",
      hostFingerprint: "aa"
    });
    const verify = createHostVerifier(allowed);
    expect(verify("aa")).toBe(true);
    expect(verify(publicKeySha256Hex)).toBe(true);
    expect(verify("bb")).toBe(false);
    expect(read).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
  });
});
