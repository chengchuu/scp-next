import { describe, expect, it } from "vitest";

import { hostVerificationDiagnostics } from "../../src/security/host-verification-diagnostics.js";

describe("host verification diagnostics", () => {
  it("shows effective defaults and independent-verification guidance", () => {
    const message = hostVerificationDiagnostics({ host: "example.com" });
    expect(message).toContain('Host: "example.com"\nPort: 22');
    expect(message).toContain('Known-hosts file: "~/.ssh/known_hosts"');
    expect(message).toContain("Explicit hostFingerprint configured: no");
    expect(message).toContain("temporary file. Independently verify every");
    expect(message).toContain("Investigate a changed trusted key");
    expect(message).toContain(
      "https://github.com/chengchuu/scp-next/blob/main/guides/HOST_VERIFICATION_TROUBLESHOOTING.md"
    );
    expect(message).not.toContain("ssh example.com");
  });

  it("quotes custom paths and ports without constructing shell commands", () => {
    const message = hostVerificationDiagnostics({
      host: "host;$(command)`test`'\"",
      port: 2222,
      knownHostsFile: "C:\\keys with spaces\\known_hosts",
      hostFingerprint: "private-fingerprint"
    });
    expect(message).toContain("Port: 2222");
    expect(message).toContain(
      'Known-hosts file: "C:\\\\keys with spaces\\\\known_hosts"'
    );
    expect(message).toContain("Explicit hostFingerprint configured: yes");
    expect(message).not.toContain("private-fingerprint");
    expect(message).not.toContain("ssh-keyscan");
  });

  it("escapes terminal controls and redacts credentials even inside display values", () => {
    const options = {
      host: "host\n\r\t\u001b[31m\u009b\u202e\u2066secret-password",
      knownHostsFile: "path\nsecret-passphrase",
      password: "secret-password",
      passphrase: "secret-passphrase",
      privateKey: "secret-key",
      hostFingerprint: "secret-fingerprint"
    };
    const message = hostVerificationDiagnostics(options);
    expect(message).toContain("host\\n\\r\\t\\u001b[31m\\u009b\\u202e\\u2066[REDACTED]");
    expect(message).toContain("path\\n[REDACTED]");
    for (const control of ["\r", "\t", "\u001b", "\u009b", "\u202e", "\u2066"]) {
      expect(message).not.toContain(control);
    }
    for (const secret of [
      options.password,
      options.passphrase,
      options.privateKey,
      options.hostFingerprint
    ]) {
      expect(message).not.toContain(secret);
    }
  });
});
