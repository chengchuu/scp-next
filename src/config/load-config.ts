import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { ConfigurationError } from "../errors/index.js";
import type { ScpNextConfig } from "../types/index.js";
import { resolveLocalPath } from "../paths/local-path.js";

export const CONFIG_FILENAMES = ["scp-next.config.json", ".scp-nextrc", ".scp-nextrc.json"] as const;

const serverSchema = z.object({
  host: z.string().optional(),
  port: z.number().int().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  privateKeyFile: z.string().optional(),
  passphrase: z.string().optional(),
  agent: z.string().optional(),
  timeout: z.number().int().optional(),
  hostFingerprint: z.string().optional(),
  knownHostsFile: z.string().optional()
});

const transferSchema = z.object({
  recursive: z.boolean().optional(),
  overwrite: z.boolean().optional(),
  createDirectories: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  timeout: z.number().int().optional(),
  afterUpload: z.array(z.string().trim().min(1)).optional()
});

const jobSchema = transferSchema.extend({
  operation: z.enum(["upload", "download"]),
  profile: z.string().optional(),
  source: z.string(),
  destination: z.string()
});

const configSchema = serverSchema
  .extend({
    defaultProfile: z.string().optional(),
    server: serverSchema.optional(),
    transfer: transferSchema.optional(),
    profiles: z.record(serverSchema).optional(),
    jobs: z.record(jobSchema).optional()
  })
  .passthrough();

export interface LoadedConfig {
  config: ScpNextConfig;
  path?: string;
  directory: string;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function findConfigFile(cwd = process.cwd()): Promise<string | undefined> {
  for (const filename of CONFIG_FILENAMES) {
    const candidate = path.resolve(cwd, filename);
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export async function loadConfig(
  explicitPath?: string,
  cwd = process.cwd()
): Promise<LoadedConfig> {
  const configPath = explicitPath ? resolveLocalPath(explicitPath, cwd) : await findConfigFile(cwd);

  if (!configPath) {
    return { config: {}, directory: cwd };
  }

  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    throw new ConfigurationError(`Unable to read configuration file: ${configPath}`, {
      cause: error,
      context: { path: configPath }
    });
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = configSchema.safeParse(parsed);
    if (!result.success) {
      throw new ConfigurationError(`Invalid configuration file: ${result.error.message}`, {
        context: { path: configPath }
      });
    }

    return {
      config: result.data,
      path: configPath,
      directory: path.dirname(configPath)
    };
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new ConfigurationError(`Invalid JSON in configuration file: ${configPath}`, {
      cause: error,
      context: { path: configPath }
    });
  }
}
