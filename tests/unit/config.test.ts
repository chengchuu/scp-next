import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config/load-config.js";
import { resolveTransferConfig } from "../../src/config/resolve-config.js";
import { ConfigurationError } from "../../src/errors/index.js";

describe("configuration loading and precedence", () => {
  it("loads explicit JSON configuration files", async () => {
    const directory = await makeTempDir();
    const configPath = path.join(directory, "scp-next.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        server: { host: "example.com", username: "deploy" },
        transfer: { recursive: true },
        jobs: {
          deploy: {
            operation: "upload",
            source: "./dist",
            destination: "/var/www/example",
            postUploadCommands: ["  pm2 reload example  "]
          }
        }
      })
    );

    const loaded = await loadConfig(configPath, directory);
    expect(loaded.config.server?.host).toBe("example.com");
    expect(loaded.config.transfer?.recursive).toBe(true);
    expect(loaded.config.jobs?.deploy?.postUploadCommands).toEqual([
      "  pm2 reload example  "
    ]);
  });

  it("selects profiles and applies CLI over env over config", () => {
    const resolved = resolveTransferConfig({
      operation: "upload",
      source: "./dist",
      destination: "/var/www/example",
      cwd: "/workspace",
      configDirectory: "/config",
      config: {
        defaultProfile: "production",
        server: { host: "root.example.com", username: "root-user" },
        profiles: {
          production: { host: "production.example.com", username: "deploy" }
        },
        transfer: { overwrite: false }
      },
      env: { host: "env.example.com", username: "env-user" },
      cli: { host: "cli.example.com", overwrite: true }
    });

    expect(resolved.host).toBe("cli.example.com");
    expect(resolved.username).toBe("env-user");
    expect(resolved.overwrite).toBe(true);
    expect(resolved.createDirectories).toBe(true);
    expect(resolved.source).toBe(path.resolve("/workspace", "./dist"));
    expect(resolved.destination).toBe("/var/www/example");
  });

  it("allows configuration to disable the createDirectories default", () => {
    const resolved = resolveTransferConfig({
      operation: "download",
      source: "/var/log/example.log",
      destination: "./logs/example.log",
      config: {
        transfer: {
          createDirectories: false
        }
      }
    });

    expect(resolved.createDirectories).toBe(false);
  });

  it("repairs upload remote destinations rewritten by Git Bash on Windows", () => {
    const resolved = resolveTransferConfig({
      operation: "upload",
      source: "./README.md",
      destination: "C:/Program Files/Git/web-test-26-0703/T01.md",
      cwd: "/workspace"
    });

    expect(resolved.source).toBe(path.resolve("/workspace", "./README.md"));
    expect(resolved.destination).toBe("/web-test-26-0703/T01.md");
  });

  it("repairs download remote sources rewritten by Git Bash on Windows", () => {
    const resolved = resolveTransferConfig({
      operation: "download",
      source: "C:/Program Files/Git/var/log/example.log",
      destination: "./example.log",
      cwd: "/workspace"
    });

    expect(resolved.source).toBe("/var/log/example.log");
    expect(resolved.destination).toBe(path.resolve("/workspace", "./example.log"));
  });

  it("uses configured jobs with canonical source and destination", () => {
    const resolved = resolveTransferConfig({
      jobName: "deploy",
      configDirectory: "/config",
      config: {
        profiles: {
          production: { host: "production.example.com", username: "deploy" }
        },
        jobs: {
          deploy: {
            operation: "upload",
            profile: "production",
            source: "./dist",
            destination: "/var/www/example",
            recursive: true,
            postUploadCommands: ["npm install --omit=dev", "pm2 reload example"]
          }
        }
      }
    });

    expect(resolved.operation).toBe("upload");
    expect(resolved.source).toBe(path.resolve("/config", "./dist"));
    expect(resolved.destination).toBe("/var/www/example");
    expect(resolved.host).toBe("production.example.com");
    expect(resolved.recursive).toBe(true);
    expect(resolved.postUploadCommands).toEqual([
      "npm install --omit=dev",
      "pm2 reload example"
    ]);
  });

  it("validates post-upload commands after applying configuration precedence", () => {
    const resolved = resolveTransferConfig({
      jobName: "deploy",
      config: {
        jobs: {
          deploy: {
            operation: "upload",
            source: "./dist",
            destination: "/var/www/example",
            postUploadCommands: [""]
          }
        }
      },
      cli: {
        postUploadCommands: ["pm2 reload example"]
      }
    });

    expect(resolved.postUploadCommands).toEqual(["pm2 reload example"]);
  });

  it("ignores upload-only transfer defaults for downloads", () => {
    const resolved = resolveTransferConfig({
      operation: "download",
      source: "/var/log/example.log",
      destination: "./example.log",
      config: {
        transfer: {
          postUploadCommands: ["should-not-run"]
        }
      }
    });

    expect(resolved.postUploadCommands).toBeUndefined();
  });

  it("rejects post-upload commands configured directly on download jobs", () => {
    expect(() =>
      resolveTransferConfig({
        jobName: "download-logs",
        config: {
          jobs: {
            "download-logs": {
              operation: "download",
              source: "/var/log/example.log",
              destination: "./example.log",
              postUploadCommands: ["should-not-run"]
            }
          }
        }
      })
    ).toThrow("Post-upload commands are not supported for downloads.");
  });

  it("fails safely for invalid profiles and jobs", () => {
    expect(() =>
      resolveTransferConfig({
        operation: "download",
        source: "/logs/app.log",
        destination: "./app.log",
        cli: { profile: "missing" },
        config: { profiles: {} }
      })
    ).toThrow(ConfigurationError);

    expect(() => resolveTransferConfig({ jobName: "missing", config: {} })).toThrow(
      ConfigurationError
    );
  });
});

async function makeTempDir(): Promise<string> {
  const directory = path.join(
    os.tmpdir(),
    "scp-next-tests",
    String(Date.now()),
    Math.random().toString(16).slice(2)
  );
  await mkdir(directory, { recursive: true });
  return directory;
}
