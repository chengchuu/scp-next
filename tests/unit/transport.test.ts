import { beforeEach, describe, expect, it, vi } from "vitest";

import { Ssh2SftpTransport } from "../../src/client/transport.js";
import { ConnectionError, HostVerificationError } from "../../src/errors/index.js";
import { hostVerificationDiagnostics } from "../../src/security/host-verification-diagnostics.js";

const { connect, createOptions } = vi.hoisted(() => ({
  connect: vi.fn(),
  createOptions: vi.fn()
}));
vi.mock("ssh2-sftp-client", () => ({
  default: class {
    connect = connect;
  }
}));
vi.mock("../../src/client/ssh-options.js", () => ({
  createSshConnectOptions: createOptions
}));

describe("SFTP connection diagnostics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createOptions.mockResolvedValue({});
  });

  it.each(["Host verification failed", "Host verif failed", "Host key mismatch"])(
    "preserves host-error classification without claiming a mismatch (%s)",
    async (failure) => {
      const options = {
        host: "example.com",
        port: 2222,
        knownHostsFile: "/custom/trust",
        password: "secret-password",
        passphrase: "secret-passphrase",
        privateKey: "secret-key"
      };
      const cause = new Error(`${failure}: secret-password`);
      connect.mockRejectedValueOnce(cause);
      await expect(new Ssh2SftpTransport().connect(options)).rejects.toMatchObject({
        code: "SCP_NEXT_HOST_VERIFICATION_ERROR",
        cause,
        message: `The host key could not be verified.${hostVerificationDiagnostics(options)}`
      });
      expect(connect).toHaveBeenCalledOnce();
    }
  );

  it("propagates preconnection verification errors without attempting to connect", async () => {
    const cause = new HostVerificationError("no usable matching host keys");
    createOptions.mockRejectedValueOnce(cause);
    await expect(new Ssh2SftpTransport().connect({ host: "example.com" })).rejects.toBe(
      cause
    );
    expect(connect).not.toHaveBeenCalled();
  });

  it("keeps non-host failures as connection errors", async () => {
    connect.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(
      new Ssh2SftpTransport().connect({ host: "example.com" })
    ).rejects.toBeInstanceOf(ConnectionError);
  });
});
