# Introducing scp-next v1.0.19: An SSH File Transfer Tool for Node.js Developers

![scp-next](http://blog.mazey.net/wp-content/uploads/2026/07/scp-next-SF-s7x3.jpg)

Learn how to install `scp-next` from npm, use the CLI for uploads and downloads, configure reusable jobs, handle credentials safely, call the library API, and onboard a new engineer quickly.

- [Introduction](#introduction)
- [Who Should Use It](#who-should-use-it)
- [Installation](#installation)
- [Understand Transfer Direction First](#understand-transfer-direction-first)
- [CLI Quick Start](#cli-quick-start)
- [Recommended Credential Patterns](#recommended-credential-patterns)
- [Common CLI Options](#common-cli-options)
- [Configuration Files](#configuration-files)
- [Library API Usage](#library-api-usage)
- [Host Verification](#host-verification)
- [New Engineer Checklist](#new-engineer-checklist)

## Introduction

`scp-next` is an SCP-style npm package. It provides both a command-line tool and a library for secure file transfers over SSH. Although the package name includes SCP, normal transfers use SFTP internally through `ssh2-sftp-client`, so regular transfers do not execute remote shell commands.

## Who Should Use It

Use `scp-next` when you need file transfers in deployment scripts, CI workflows, or Node.js applications. Common use cases include:

- Uploading local build output to a server.
- Downloading logs or generated artifacts from a server.
- Managing different server environments with configuration files.
- Reusing one transfer client across multiple operations in application code.

`scp-next` requires Node.js 18.18.0 or later.

## Installation

Install it globally when you want to call the `scp-next` command directly.

```bash
npm install --global scp-next
```

Install it as a project dependency when you want to import the API from Node.js code.

```bash
npm install scp-next
```

If a project only needs the CLI in scripts, you can also install it locally and call it with `npx scp-next` or through npm scripts.

## Understand Transfer Direction First

The CLI always uses two positional operands: `<source> <destination>`.

```text
scp-next upload <source> <destination> [options]
scp-next download <source> <destination> [options]
scp-next run <job> [source] [destination] [options]
```

The direction rules are:

| Operation | Source | Destination |
| --------- | ------ | ----------- |
| Upload    | Local  | Remote      |
| Download  | Remote | Local       |

The programmatic API does not use `<source>` and `<destination>`. Upload and download options use `localPath` and `remotePath`, which keeps local and remote paths explicit in application code.

## CLI Quick Start

Upload a local directory to a remote server.

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --password your-password \
  --recursive
```

Download a remote file to a local path.

```bash
scp-next download /var/log/example.log ./logs/example.log \
  --host your-host \
  --username your-username \
  --password your-password
```

If the destination directory does not exist, `scp-next` creates it by default. This matches familiar `cp` and `scp` behavior for day-to-day use. Use `--no-create-directories` to disable automatic destination directory creation.

Preview an upload plan without connecting to the server.

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --password your-password \
  --recursive \
  --dry-run
```

`--dry-run` resolves configuration and validates local paths. It does not connect to the remote server, and it does not modify local or remote files.

## Recommended Credential Patterns

Password arguments are convenient for local trials.

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --password your-password \
  --recursive
```

For shared or production environments, prefer environment variables. This lowers the risk of exposing passwords through shell history or process listings.

```bash
export SCP_NEXT_HOST="your-host"
export SCP_NEXT_USERNAME="your-username"
export SCP_NEXT_PASSWORD="your-password"

scp-next upload ./dist /var/www/example --recursive
```

You can also use a protected private-key file.

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --private-key-file ~/.ssh/id_ed25519 \
  --recursive
```

If your environment already uses SSH agent authentication, add the key first and let `scp-next` use `SSH_AUTH_SOCK`.

```bash
ssh-add ~/.ssh/id_ed25519

export SCP_NEXT_HOST="your-host"
export SCP_NEXT_USERNAME="your-username"

scp-next upload ./dist /var/www/example --recursive
```

## Common CLI Options

| Option                                | Description                                                            |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `--host <host>`                       | SSH server host.                                                       |
| `--port <port>`                       | SSH server port. Defaults to `22`.                                     |
| `--username <username>`               | SSH username.                                                          |
| `--password <password>`               | SSH password.                                                          |
| `--private-key-file <privateKeyFile>` | Private-key file path. Supports `~` expansion.                         |
| `--passphrase <passphrase>`           | Passphrase for an encrypted private key.                               |
| `--config <path>`                     | Explicit configuration file path.                                      |
| `--profile <name>`                    | Named server profile from the configuration file.                      |
| `--recursive`                         | Transfer directories recursively. Defaults to `false`.                 |
| `--overwrite`                         | Allow replacing existing destination files.                            |
| `--create-directories`                | Create missing destination directories. Enabled by default.            |
| `--no-create-directories`             | Disable automatic destination directory creation.                      |
| `--dry-run`                           | Resolve and validate the operation without connecting or transferring. |
| `--timeout <milliseconds>`            | SSH connection ready timeout in milliseconds.                          |
| `--quiet`                             | Disable progress and non-error output.                                 |
| `--verbose`                           | Print non-sensitive diagnostic details.                                |

`--timeout` maps to the SSH `readyTimeout`. It controls how long to wait for the connection handshake, not the duration of each file transfer or the whole transfer run.

## Configuration Files

The CLI automatically searches for these configuration files.

```text
scp-next.config.json
.scp-nextrc
.scp-nextrc.json
```

You can also pass an explicit path.

```bash
scp-next upload ./dist /var/www/example \
  --config ./scp-next.config.json \
  --profile production
```

The example below defines a server profile and two reusable jobs.

```json
{
  "profiles": {
    "production": {
      "host": "your-host",
      "username": "your-username",
      "privateKeyFile": "~/.ssh/id_ed25519"
    }
  },
  "jobs": {
    "deploy": {
      "operation": "upload",
      "profile": "production",
      "source": "./dist",
      "destination": "/var/www/example",
      "recursive": true,
      "overwrite": true
    },
    "download-logs": {
      "operation": "download",
      "profile": "production",
      "source": "/var/log/example",
      "destination": "./logs",
      "recursive": true
    }
  }
}
```

Run the configured upload job.

```bash
scp-next run deploy
```

Run the configured download job.

```bash
scp-next run download-logs
```

The `run` command also supports temporary path overrides.

```bash
scp-next run deploy ./dist-canary /var/www/canary
```

Configuration precedence, from highest to lowest, is:

1. Explicit CLI options
2. Positional CLI operands
3. Environment variables
4. Selected configuration profile
5. Root-level configuration values
6. Configured job values
7. Internal defaults

Do not commit configuration files that contain real passwords to public repositories. For shared repositories and deployment environments, prefer `SCP_NEXT_PASSWORD`, SSH agent authentication, or protected key files.

## Library API Usage

ESM projects can import `upload` directly.

```ts
import { upload } from "scp-next";

await upload({
  host: process.env.SCP_NEXT_HOST,
  username: process.env.SCP_NEXT_USERNAME,
  password: process.env.SCP_NEXT_PASSWORD,
  localPath: "./dist",
  remotePath: "/var/www/example",
  recursive: true,
  overwrite: true
});
```

CommonJS projects can use `require`.

```js
const { download } = require("scp-next");

async function main() {
  await download({
    host: process.env.SCP_NEXT_HOST,
    username: process.env.SCP_NEXT_USERNAME,
    password: process.env.SCP_NEXT_PASSWORD,
    remotePath: "/var/log/example.log",
    localPath: "./logs/example.log"
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
```

Create a reusable client when you need multiple operations in one connection lifecycle.

```ts
import { createClient } from "scp-next";

const client = createClient({
  host: process.env.SCP_NEXT_HOST,
  username: process.env.SCP_NEXT_USERNAME,
  password: process.env.SCP_NEXT_PASSWORD
});

try {
  await client.connect();
  await client.upload("./dist", "/var/www/example", { recursive: true });
  await client.download("/var/log/example.log", "./logs/example.log");
} finally {
  await client.close();
}
```

Primary exports include:

```ts
upload(options: UploadOptions): Promise<void>;
download(options: DownloadOptions): Promise<void>;
createClient(options: ScpServerOptions): ScpNextClient;
copy(options: CopyOptions): Promise<void>;
```

Public errors include stable `code` values, readable `message` values, and redacted non-sensitive context. Common error types include `ConfigurationError`, `AuthenticationError`, `ConnectionError`, `TransferError`, and `HostVerificationError`.

## Host Verification

`scp-next` supports host verification with `hostFingerprint` or `knownHostsFile`. When neither is supplied, it reads `~/.ssh/known_hosts`.

For CI or deployment environments without an available known-hosts file, configure `hostFingerprint`. If `scp-next` cannot establish host verification, it fails closed.

## New Engineer Checklist

Use this order when onboarding a project that already uses `scp-next`.

1. Confirm that Node.js is 18.18.0 or later.
2. Install the CLI with `npm install --global scp-next`.
3. Run `scp-next upload ... --dry-run` to validate options and paths.
4. Move server details into environment variables or a configuration file.
5. Use `scp-next run <job>` for recurring upload or download workflows.
6. Use `upload`, `download`, or `createClient` from Node.js code when the project needs library integration.

After these pieces are clear, `scp-next` is ready for deployment scripts, log downloads, and Node.js file transfer workflows.

**Copyright Notice**

This is an original article. The author reserves all rights. Please keep the full content when reposting, and include a hyperlink to the author.

Author: [Cheng](https://github.com/chengchuu)

<!-- ID: introducing-scp-next-v1.0.19-en -->

(End)
