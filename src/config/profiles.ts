import { ConfigurationError } from "../errors/index.js";
import type { ScpNextConfig, ScpServerOptions } from "../types/index.js";

export function selectProfile(
  config: ScpNextConfig,
  profileName?: string
): ScpServerOptions | undefined {
  if (!profileName) {
    return undefined;
  }

  const profile = config.profiles?.[profileName];
  if (!profile) {
    throw new ConfigurationError(`Unknown profile: ${profileName}`, {
      context: { profile: profileName }
    });
  }

  return profile;
}
