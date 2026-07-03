import { describe, expect, it } from "vitest";

import {
  AuthenticationError,
  HostVerificationError,
  TransferError,
  toScpNextError
} from "../../src/errors/index.js";

describe("error conversion", () => {
  it("converts authentication failures", () => {
    expect(toScpNextError(new Error("Permission denied"))).toBeInstanceOf(AuthenticationError);
  });

  it("converts host-key failures", () => {
    expect(toScpNextError(new Error("Host denied by hostVerifier"))).toBeInstanceOf(
      HostVerificationError
    );
  });

  it("redacts private keys in transfer errors", () => {
    const error = toScpNextError(
      new Error("bad -----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----")
    );
    expect(error).toBeInstanceOf(TransferError);
    expect(error.message).toContain("[REDACTED]");
  });
});
