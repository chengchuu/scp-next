import { readFile } from "node:fs/promises";

import type { ConnectConfig } from "ssh2";

import {
  createHostVerifier,
  resolveAllowedFingerprints
} from "../security/host-verification.js";
import { expandHome } from "../paths/local-path.js";
import type { ScpServerOptions } from "../types/index.js";

export async function createSshConnectOptions(
  options: ScpServerOptions
): Promise<ConnectConfig> {
  const connectOptions: ConnectConfig = {};
  if (options.host !== undefined) connectOptions.host = options.host;
  if (options.port !== undefined) connectOptions.port = options.port;
  if (options.username !== undefined) connectOptions.username = options.username;
  if (options.password !== undefined) connectOptions.password = options.password;
  if (options.privateKey !== undefined) {
    connectOptions.privateKey = options.privateKey;
  } else if (options.privateKeyFile) {
    connectOptions.privateKey = await readFile(
      expandHome(options.privateKeyFile),
      "utf8"
    );
  }
  if (options.passphrase !== undefined) connectOptions.passphrase = options.passphrase;
  const agent = options.agent ?? process.env.SSH_AUTH_SOCK;
  if (agent !== undefined) connectOptions.agent = agent;
  if (options.timeout !== undefined) connectOptions.readyTimeout = options.timeout;

  const allowedFingerprints = await resolveAllowedFingerprints(options);
  const hostVerifier = createHostVerifier(allowedFingerprints);
  if (hostVerifier) {
    connectOptions.hostHash = "sha256";
    connectOptions.hostVerifier = hostVerifier;
  }

  return connectOptions;
}
