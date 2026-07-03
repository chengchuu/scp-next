import type { ScpServerOptions } from "../types/index.js";

export interface EnvironmentConfig extends ScpServerOptions {
  profile?: string;
}

function parseInteger(value: string | undefined, name: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number.`);
  }
  return parsed;
}

export function readEnvironment(
  env: NodeJS.ProcessEnv = process.env
): EnvironmentConfig {
  const result: EnvironmentConfig = {};

  if (env.SCP_NEXT_HOST) result.host = env.SCP_NEXT_HOST;
  if (env.SCP_NEXT_PORT) {
    const port = parseInteger(env.SCP_NEXT_PORT, "SCP_NEXT_PORT");
    if (port !== undefined) result.port = port;
  }
  if (env.SCP_NEXT_USERNAME) result.username = env.SCP_NEXT_USERNAME;
  if (env.SCP_NEXT_PASSWORD) result.password = env.SCP_NEXT_PASSWORD;
  if (env.SCP_NEXT_PRIVATE_KEY) result.privateKey = env.SCP_NEXT_PRIVATE_KEY;
  if (env.SCP_NEXT_PRIVATE_KEY_FILE) result.privateKeyFile = env.SCP_NEXT_PRIVATE_KEY_FILE;
  if (env.SCP_NEXT_PASSPHRASE) result.passphrase = env.SCP_NEXT_PASSPHRASE;
  if (env.SCP_NEXT_TIMEOUT) {
    const timeout = parseInteger(env.SCP_NEXT_TIMEOUT, "SCP_NEXT_TIMEOUT");
    if (timeout !== undefined) result.timeout = timeout;
  }
  if (env.SCP_NEXT_PROFILE) result.profile = env.SCP_NEXT_PROFILE;

  return result;
}
