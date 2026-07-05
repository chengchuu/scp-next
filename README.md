# scp-next

[![npm version][npm-image]][npm-url]
[![license][license-image]][license-url]
[![node version][node-image]][npm-url]
[![module type][module-image]][npm-url]
[![docs][docs-image]][docs-url]

[npm-image]: https://img.shields.io/npm/v/scp-next
[npm-url]: https://npmjs.org/package/scp-next
[license-image]: https://img.shields.io/npm/l/scp-next
[license-url]: https://github.com/chengchuu/scp-next
[node-image]: https://img.shields.io/node/v/scp-next
[module-image]: https://img.shields.io/badge/module-ESM%20%2B%20CJS-blue
[docs-image]: https://img.shields.io/badge/docs-GitHub%20Pages-2b6cb0
[docs-url]: https://chengchuu.github.io/scp-next/

`scp-next` is an SCP-style command-line tool and library for secure file transfers over SSH.
It uses SFTP internally through `ssh2-sftp-client` instead of implementing SCP or SFTP protocols manually.
Developer documentation is available at [GitHub Pages](https://chengchuu.github.io/scp-next/).

## Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Basic Usage](#basic-usage)
  - [CLI Options](#cli-options)
- [Library Usage](#library-usage)
  - [Library Options](#library-options)
- [Advanced Usage](#advanced-usage)
  - [Configuration File Options](#configuration-file-options)
  - [Environment Variables](#environment-variables)

## Features

- Upload and download files or directories recursively.
- CLI usage with clear `<source> <destination>` operands.
- ESM `import` and CommonJS `require` support.
- JSON configuration files, named profiles, and configured jobs.
- Reusable transfer client.

## Installation

CLI:

```bash
npm install --global scp-next
```

Library:

```bash
npm install scp-next
```

## Quick Start

Upload a directory:

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --password your-password \
  --recursive
```

Download a file:

```bash
scp-next download /var/log/example.log ./logs/example.log \
  --host your-host \
  --username your-username \
  --password your-password
```

Output:

```text
Downloading: /var/log/example.log 1.0 MB / 1.0 MB (100%)
```

Password arguments are convenient, but they may be exposed through shell history and process listings.
Prefer `SCP_NEXT_PASSWORD` environment variable in shared or production environments. For key authentication, use a protected private-key file.

Use the library:

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

## Basic Usage

### CLI Syntax

```text
scp-next upload <source> <destination> [options]
scp-next download <source> <destination> [options]
scp-next run <job> [source] [destination] [options]
```

CLI commands use `<source> <destination>`. Programmatic upload and download APIs use
`localPath` and `remotePath`.

| Operation | Source | Destination |
| --------- | ------ | ----------- |
| Upload    | Local  | Remote      |
| Download  | Remote | Local       |

Destination paths follow familiar `cp`/`scp` behavior. If the destination exists as a directory or ends with a path separator, `scp-next` places the source inside that directory using the source basename. Missing destination directories are created by default.

### Upload Examples

Preview a recursive deploy before connecting:

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --password your-password \
  --recursive \
  --dry-run
```

Deploy with overwrite and verbose diagnostics:

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --password your-password \
  --recursive \
  --overwrite \
  --verbose
```

Use an encrypted private key:

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --private-key-file ~/.ssh/id_ed25519 \
  --passphrase your-passphrase \
  --recursive
```

### Download Examples

Download a remote directory recursively:

```bash
scp-next download /var/log/example ./logs/example \
  --host your-host \
  --username your-username \
  --password your-password \
  --recursive
```

Download and overwrite an existing local file:

```bash
scp-next download /var/log/example.log ./logs/example.log \
  --host your-host \
  --username your-username \
  --password your-password \
  --overwrite
```

Run a configured download job:

```bash
scp-next run download-logs --config ./scp-next.config.json
```

### CLI Options

| Option                                | Description                                                            |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `--host <host>`                       | SSH server host.                                                       |
| `--port <port>`                       | SSH server port. Defaults to `22`.                                     |
| `--username <username>`               | SSH username.                                                          |
| `--password <password>`               | SSH password.                                                          |
| `--private-key <privateKey>`          | Private-key content. Redacted from logs and errors.                    |
| `--private-key-file <privateKeyFile>` | Private-key file path. Supports `~` expansion.                         |
| `--passphrase <passphrase>`           | Passphrase for an encrypted private key.                               |
| `--config <path>`                     | Explicit configuration file path.                                      |
| `--profile <name>`                    | Named server profile from the configuration file.                      |
| `--recursive`                         | Transfer directories recursively.                                      |
| `--overwrite`                         | Allow replacing existing destination files.                            |
| `--create-directories`                | Create missing destination directories. Enabled by default.            |
| `--no-create-directories`             | Disable automatic destination directory creation.                      |
| `--dry-run`                           | Resolve and validate the operation without connecting or transferring. |
| `--timeout <milliseconds>`            | Connection and operation timeout in milliseconds.                      |
| `--verbose`                           | Print non-sensitive diagnostic details.                                |
| `--quiet`                             | Disable progress and non-error output.                                 |
| `--help`                              | Show command help.                                                     |
| `--version`                           | Show the package version.                                              |

## Library Usage

### ESM Upload

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

### CommonJS Download

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

### Reusable Client

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

### Use a Configuration File

The CLI loads configuration files automatically. The library API receives options directly,
so load JSON in your application and pass the relevant `server` and `transfer` values.

```ts
import { readFile } from "node:fs/promises";

import { upload, type ScpNextConfig } from "scp-next";

const config = JSON.parse(
  await readFile(new URL("./scp-next.config.json", import.meta.url), "utf8")
) as ScpNextConfig;

await upload({
  ...config.server,
  ...config.transfer,
  localPath: "./dist",
  remotePath: "/var/www/example"
});
```

### Library Options

| Field               | Used by           | Description                                                      |
| ------------------- | ----------------- | ---------------------------------------------------------------- |
| `host`              | server            | SSH server host.                                                 |
| `port`              | server            | SSH server port. Defaults to `22`.                               |
| `username`          | server            | SSH username.                                                    |
| `password`          | server            | SSH password.                                                    |
| `privateKey`        | server            | Private-key content as a string or Buffer.                       |
| `privateKeyFile`    | server            | Private-key file path.                                           |
| `passphrase`        | server            | Passphrase for an encrypted private key.                         |
| `agent`             | server            | SSH agent socket path.                                           |
| `hostFingerprint`   | server            | Expected server host-key SHA-256 fingerprint.                    |
| `knownHostsFile`    | server            | Known-hosts file for host verification.                          |
| `localPath`         | upload/download   | Local source for upload or local destination for download.       |
| `remotePath`        | upload/download   | Remote destination for upload or remote source for download.     |
| `recursive`         | transfer          | Transfer directories recursively. Defaults to `false`.           |
| `overwrite`         | transfer          | Allow replacing existing files.                                  |
| `createDirectories` | transfer          | Create missing destination directories. Defaults to `true`.      |
| `dryRun`            | transfer          | Validate and plan without modifying local or remote files.       |
| `timeout`           | server / transfer | Connection and operation timeout in milliseconds.                |
| `onProgress`        | transfer          | Progress callback for file and directory transfers.              |

## Advanced Usage

### Configuration Files

Use `scp-next.config.json` in the current directory. `scp-next` also auto-detects these rc-style filenames: `.scp-nextrc`, `.scp-nextrc.json`.

```text
scp-next.config.json
```

Use `--config` for an explicit path:

```bash
scp-next upload ./dist /var/www/example --config ./deploy/scp-next.json
```

Use `--profile` with a configuration file:

```bash
scp-next upload ./dist /var/www/example \
  --config ./scp-next.config.json \
  --profile production
```

Example:

```json
{
  "server": {
    "host": "your-host",
    "port": 22,
    "username": "your-username",
    "password": "your-password"
  },
  "transfer": {
    "recursive": true,
    "overwrite": true,
    "createDirectories": true,
    "timeout": 30000
  }
}
```

Do not commit configuration files containing real passwords. Prefer `SCP_NEXT_PASSWORD` or another protected secret source for shared repositories and deployment environments.

### Configuration File Options

| Key              | Description                                                         |
| ---------------- | ------------------------------------------------------------------- |
| `server`         | SSH connection options such as `host`, `port`, and `username`.      |
| `transfer`       | Transfer defaults such as `recursive`, `overwrite`, and `timeout`.  |
| `defaultProfile` | Profile name used when `--profile` or `SCP_NEXT_PROFILE` is absent. |
| `profiles`       | Named server connection profiles.                                   |
| `jobs`           | Reusable upload or download jobs for `scp-next run <job>`.          |

Root-level server options such as `host`, `username`, `privateKeyFile`, `knownHostsFile`,
and `hostFingerprint` are also supported for simple configuration files, but `server` keeps connection values grouped and easier to read.

### Named Profiles

```json
{
  "defaultProfile": "production",
  "profiles": {
    "production": {
      "host": "your-host-a",
      "port": 22,
      "username": "your-username-a",
      "password": "your-password-a"
    },
    "staging": {
      "host": "your-host-b",
      "port": 22,
      "username": "your-username-b",
      "privateKeyFile": "~/.ssh/id_ed25519"
    }
  }
}
```

```bash
scp-next upload ./dist /var/www/example --profile production
```

### Configured Jobs

Jobs use `source` and `destination`; the `operation` determines which path is local or remote.

```json
{
  "profiles": {
    "production": {
      "host": "your-host",
      "username": "your-username",
      "password": "your-password"
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

```bash
scp-next run deploy
scp-next run download-logs
```

`scp-next run <job> [source] [destination]` permits explicit path overrides.

### Environment Variables

```text
SCP_NEXT_HOST
SCP_NEXT_PORT
SCP_NEXT_USERNAME
SCP_NEXT_PASSWORD
SCP_NEXT_PRIVATE_KEY
SCP_NEXT_PRIVATE_KEY_FILE
SCP_NEXT_PASSPHRASE
SCP_NEXT_TIMEOUT
SCP_NEXT_PROFILE
```

Bash:

```bash
export SCP_NEXT_HOST="your-host"
export SCP_NEXT_USERNAME="your-username"
export SCP_NEXT_PASSWORD="your-password"
scp-next upload ./dist /var/www/example --recursive
```

PowerShell:

```powershell
$env:SCP_NEXT_HOST = "your-host"
$env:SCP_NEXT_USERNAME = "your-username"
$env:SCP_NEXT_PASSWORD = "your-password"
scp-next upload .\dist /var/www/example --recursive
```

### Configuration Precedence

Highest to lowest:

1. Explicit CLI options
2. Positional CLI operands
3. Environment variables
4. Selected configuration profile
5. Root-level configuration values
6. Configured job values
7. Internal defaults

For `run`, job values are loaded first, then root configuration, selected profile, environment variables, explicit positional overrides, and CLI options.

### Authentication

Supported methods:

- Password authentication
- Private-key content
- Private-key file
- Private-key passphrase
- SSH agent authentication through `agent` or `SSH_AUTH_SOCK`

### Host Verification

`hostFingerprint` compares the server host key SHA-256 fingerprint. `knownHostsFile` supports plain OpenSSH `known_hosts` entries for exact host names. When neither is supplied, `scp-next` reads `~/.ssh/known_hosts`. Hashed host names and every OpenSSH marker variant are not currently parsed.

`scp-next` fails closed if it cannot establish a host verifier. Use `hostFingerprint` for CI or deployments where a known-hosts file is not available.

### Progress Reporting

Interactive terminals display concise progress. Progress is disabled with `--quiet` or when stderr is not a TTY, which keeps CI logs readable. Library users can pass `onProgress`.

### Dry Run

`--dry-run` resolves configuration and validates local paths and transfer direction without connecting to the remote server or modifying local/remote files.

```text
Dry run: upload
Source: ./dist
Destination: your-username@your-host:/var/www/example
Recursive: yes
Overwrite: yes
```

## Error Handling

Public typed errors:

- `ScpNextError`
- `ConfigurationError`
- `ValidationError`
- `AuthenticationError`
- `ConnectionError`
- `TransferError`
- `FileSystemError`
- `HostVerificationError`

Each error includes a stable `code`, readable `message`, optional `cause`, and redacted non-sensitive context.

```ts
import { AuthenticationError, upload } from "scp-next";

try {
  await upload({
    host: process.env.SCP_NEXT_HOST,
    username: process.env.SCP_NEXT_USERNAME,
    password: process.env.SCP_NEXT_PASSWORD,
    localPath: "./dist",
    remotePath: "/var/www/example"
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error("SSH authentication failed.");
  }
  throw error;
}
```

## API Reference

Primary functions:

```ts
upload(options: UploadOptions): Promise<void>
download(options: DownloadOptions): Promise<void>
createClient(options: ScpServerOptions): ScpNextClient
copy(options: CopyOptions): Promise<void>
```

Upload and download APIs use explicit `localPath` and `remotePath` names.
The optional generic `copy()` API accepts typed local/remote endpoint objects.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm pack --dry-run
```

`prepublishOnly` runs clean, typecheck, lint, tests, and build.

## Publishing

The published package includes `dist`, README, license, changelog, and docs. The CLI entry is `dist/cli/index.js` and contains a Node.js shebang.

## Transfer Mechanism

Despite the package name, normal transfers use SFTP through `ssh2-sftp-client`, which is built on `ssh2`.
This avoids remote shell execution for regular transfers and gives better support for progress reporting and recursive directory traversal than shelling out to an SCP command.
