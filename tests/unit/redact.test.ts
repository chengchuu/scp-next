import { describe, expect, it } from "vitest";

import {
  redactKnownSensitiveValues,
  redactSensitiveValues
} from "../../src/security/redact.js";

describe("redactSensitiveValues", () => {
  it("redacts secrets recursively", () => {
    const redacted = redactSensitiveValues({
      username: "deploy",
      password: "secret",
      nested: {
        passphrase: "phrase",
        privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----"
      }
    });

    expect(redacted).toEqual({
      username: "deploy",
      password: "[REDACTED]",
      nested: {
        passphrase: "[REDACTED]",
        privateKey: "[REDACTED]"
      }
    });
  });

  it("redacts sensitive Buffer values from command output", () => {
    expect(
      redactKnownSensitiveValues("key material", {
        privateKey: Buffer.from("key material")
      })
    ).toBe("[REDACTED]");
  });
});
