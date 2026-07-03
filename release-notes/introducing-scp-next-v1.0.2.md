# Introducing scp-next v1.0.2

`scp-next` is an SCP-style command-line tool and TypeScript library for secure file transfers
over SSH. It keeps the familiar upload/download workflow while using SFTP internally through
`ssh2-sftp-client`, avoiding custom protocol code and normal remote shell execution.

## Why scp-next

File transfer tools often start simple and become harder to manage once deployments need
profiles, dry runs, recursive directories, secret handling, and reusable application code.
`scp-next` is built for that middle ground: easy to run from a terminal, but structured enough
to use safely in scripts, CI, and Node.js applications.

## Highlights

- Upload and download files or directories recursively.
- Use clear CLI operands: `<source> <destination>`.
- Import the library from ESM or CommonJS projects.
- Configure servers with JSON files, named profiles, jobs, or environment variables.
- Preview operations with dry-run mode before connecting.
- Track transfer progress when supported by the SFTP client.
- Control overwrites, timeouts, and destination directory creation.
- Redact passwords, passphrases, and private-key contents from logs and errors.
- Reuse a transfer client across multiple upload and download operations.

## Install

Global CLI installation:

```bash
npm install --global scp-next
```

Library installation:

```bash
npm install scp-next
```

## CLI Usage

Uploads treat `source` as local and `destination` as remote:

```bash
scp-next upload ./dist /var/www/example \
  --host example.com \
  --username deploy \
  --private-key-file ~/.ssh/id_ed25519 \
  --recursive \
  --create-directories
```

Downloads treat `source` as remote and `destination` as local:

```bash
scp-next download /var/log/example.log ./logs/example.log \
  --host example.com \
  --username deploy \
  --private-key-file ~/.ssh/id_ed25519 \
  --create-directories
```

Run a configured job:

```bash
scp-next run deploy
```

## Library Usage

ESM:

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

CommonJS:

```js
const { download } = require("scp-next");

await download({
  host: process.env.SCP_NEXT_HOST,
  username: process.env.SCP_NEXT_USERNAME,
  privateKeyFile: process.env.SCP_NEXT_PRIVATE_KEY_FILE,
  remotePath: "/var/log/example.log",
  localPath: "./logs/example.log"
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

## Configuration

`scp-next` supports `scp-next.config.json`, `.scp-nextrc`, `.scp-nextrc.json`, or an explicit
`--config` path.

```json
{
  "profiles": {
    "production": {
      "host": "production.example.com",
      "username": "deploy",
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
      "overwrite": true,
      "createDirectories": true
    }
  }
}
```

## Security Notes

`scp-next` is designed to make safer defaults and patterns easy:

- Prefer environment variables, SSH agents, or protected private-key files over CLI password
  arguments.
- Passwords, passphrases, and private-key contents are redacted from logs and error context.
- Host verification uses `hostFingerprint`, `knownHostsFile`, or `~/.ssh/known_hosts`.
- Remote paths are handled with POSIX rules, while local paths use the current operating
  system's path behavior.
- Normal transfers use SFTP and do not execute remote shell commands.

## Transfer Terminology

The CLI uses the standard `<source> <destination>` order:

```text
Operation  Source  Destination
Upload     Local   Remote
Download   Remote  Local
```

The TypeScript API uses explicit `localPath` and `remotePath` names for upload and download
calls, so application code does not need to infer path locality from transfer direction.

## What's Included in v1.0.2

- CLI commands for upload, download, and configured jobs.
- ESM, CommonJS, and TypeScript declaration outputs.
- Recursive directory transfers.
- Dry-run support.
- Configuration files, profiles, jobs, and environment variables.
- Typed errors and validation for common configuration, filesystem, connection, and transfer
  failures.
- Mockable transport architecture for tests and future integration coverage.

`scp-next` v1.0.2 is ready for CLI workflows, deployment scripts, and Node.js applications that
need secure SSH file transfers without hand-rolled protocol logic.
