# Introducing scp-next v1.0.14

`scp-next` is an SCP-style CLI and TypeScript library for secure file transfers over SSH.
It keeps familiar `upload <source> <destination>` and `download <source> <destination>`
commands while using SFTP internally through `ssh2-sftp-client`.

Version 1.0.14 focuses on production polish: clearer documentation, safer daily defaults,
better path behavior, and a cleaner project footprint.

## Highlights

- Upload and download files or directories recursively.
- Use the CLI with clear `<source> <destination>` operands.
- Use the library from ESM `import` or CommonJS `require`.
- Configure transfers with JSON files, named profiles, jobs, and environment variables.
- Reuse a transfer client across multiple operations.
- Create missing destination directories by default.
- Disable destination directory creation with `--no-create-directories`.
- Preview operations with `--dry-run`.
- Keep secrets redacted from logs and errors.

## Install

CLI:

```bash
npm install --global scp-next
```

Library:

```bash
npm install scp-next
```

## Quick Start

Upload with password authentication:

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --password your-password \
  --recursive
```

Password arguments are convenient, but they may be exposed through shell history and process
listings. Prefer environment variables, SSH agents, or protected private-key files for shared
or production environments.

Download with private-key authentication:

```bash
scp-next download /var/log/example.log ./logs/example.log \
  --host your-host \
  --username your-username \
  --private-key-file ~/.ssh/id_ed25519
```

## Library Usage

ESM upload:

```ts
import { upload } from "scp-next";

await upload({
  host: process.env.SCP_NEXT_HOST,
  username: process.env.SCP_NEXT_USERNAME,
  privateKeyFile: process.env.SCP_NEXT_PRIVATE_KEY_FILE,
  localPath: "./dist",
  remotePath: "/var/www/example",
  recursive: true,
  overwrite: true
});
```

Reusable client:

```ts
import { createClient } from "scp-next";

const client = createClient({
  host: process.env.SCP_NEXT_HOST,
  username: process.env.SCP_NEXT_USERNAME,
  privateKeyFile: process.env.SCP_NEXT_PRIVATE_KEY_FILE
});

try {
  await client.connect();
  await client.upload("./dist", "/var/www/example", { recursive: true });
  await client.download("/var/log/example.log", "./logs/example.log");
} finally {
  await client.close();
}
```

## Configuration Files

The CLI searches for:

```text
scp-next.config.json
.scp-nextrc
.scp-nextrc.json
```

You can also pass an explicit path:

```bash
scp-next upload ./dist /var/www/example \
  --config ./scp-next.config.json \
  --profile production
```

Example:

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
    }
  }
}
```

Run the configured job:

```bash
scp-next run deploy
```

## What's New in v1.0.14

- Added GitHub Pages developer documentation.
- Expanded README sections for quick start, basic usage, library usage, and advanced usage.
- Added complete CLI, library, and configuration option references to the docs site.
- Improved SCP-style destination behavior for file and directory transfers.
- Made missing destination directory creation the default behavior.
- Added `--no-create-directories` as the explicit opt-out.
- Improved host verification guidance and typical-fix messaging.
- Improved Git Bash remote path restoration for Windows users.
- Reduced noisy duplicate progress output.
- Removed unused legacy tooling and Docker configuration files.

## Security Notes

`scp-next` is designed for security-conscious transfer workflows:

- Normal transfers use SFTP and do not execute remote shell commands.
- Passwords, passphrases, private-key contents, and tokens are redacted from logs and errors.
- Host verification uses `hostFingerprint`, `knownHostsFile`, or `~/.ssh/known_hosts`.
- Local paths use OS-aware path behavior, while remote paths preserve POSIX `/` separators.
- Credentials are never persisted automatically.

## Transfer Terminology

The CLI uses standard `<source> <destination>` order:

```text
Operation  Source  Destination
Upload     Local   Remote
Download   Remote  Local
```

The TypeScript API uses `localPath` and `remotePath` so application code stays explicit.

`scp-next` v1.0.14 is ready for command-line transfers, deployment scripts, and Node.js
applications that need SSH file transfer without custom protocol implementation.
