# scp-next

`scp-next` is a TypeScript command-line tool and library for secure file transfers over SSH.
The package uses SFTP internally through `ssh2-sftp-client` instead of implementing SCP or
SFTP protocols manually.

## Features

- Upload and download files.
- Upload and download directories recursively.
- CLI usage with `<source> <destination>` operands.
- ESM `import` and CommonJS `require` library usage.
- Reusable transfer client.
- JSON configuration files, named profiles, and configured jobs.
- Environment-variable based credentials.
- Dry-run mode, progress callbacks, timeouts, overwrite control, and destination directory creation.
- Typed errors with stable error codes.
- Secret redaction for passwords, passphrases, and private-key contents.

## Installation

```bash
npm install --global scp-next
npm install scp-next
```

## CLI Syntax

```text
scp-next upload <source> <destination> [options]
scp-next download <source> <destination> [options]
scp-next run <job> [source] [destination] [options]
```

Terminology is intentionally consistent:

```text
Operation  Source  Destination
Upload     Local   Remote
Download   Remote  Local
```

CLI commands use `<source> <destination>`. Programmatic upload and download APIs use
`localPath` and `remotePath`.

## CLI Options

```text
--host
--port
--username
--password
--private-key
--private-key-file
--passphrase
--config
--profile
--recursive
--overwrite
--create-directories
--dry-run
--timeout
--verbose
--quiet
--help
--version
```

Avoid `--password` when possible because command-line arguments may be visible in shell
history and process listings. Prefer environment variables, SSH agents, or protected
private-key files.

## Upload Examples

```bash
scp-next upload ./dist /var/www/example \
  --host example.com \
  --username deploy \
  --private-key-file ~/.ssh/id_ed25519 \
  --recursive \
  --create-directories
```

## Download Examples

```bash
scp-next download /var/log/example.log ./logs/example.log \
  --host example.com \
  --username deploy \
  --private-key-file ~/.ssh/id_ed25519 \
  --create-directories
```

## Configuration Files

`scp-next` searches for these files in the current directory:

```text
scp-next.config.json
.scp-nextrc
.scp-nextrc.json
```

Use `--config` for an explicit path:

```bash
scp-next upload ./dist /var/www/example --config ./deploy/scp-next.json
```

Example:

```json
{
  "server": {
    "host": "example.com",
    "port": 22,
    "username": "deploy",
    "privateKeyFile": "~/.ssh/id_ed25519"
  },
  "transfer": {
    "recursive": true,
    "overwrite": true,
    "createDirectories": true,
    "timeout": 30000
  }
}
```

## Named Profiles

```json
{
  "defaultProfile": "production",
  "profiles": {
    "production": {
      "host": "production.example.com",
      "port": 22,
      "username": "deploy",
      "privateKeyFile": "~/.ssh/id_ed25519"
    },
    "staging": {
      "host": "staging.example.com",
      "port": 22,
      "username": "deploy",
      "privateKeyFile": "~/.ssh/id_ed25519"
    }
  }
}
```

```bash
scp-next upload ./dist /var/www/example --profile production
```

## Configured Jobs

Jobs use `source` and `destination`; the `operation` determines which path is local or remote.

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

## Environment Variables

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
export SCP_NEXT_HOST="example.com"
export SCP_NEXT_USERNAME="deploy"
export SCP_NEXT_PRIVATE_KEY_FILE="$HOME/.ssh/id_ed25519"
scp-next upload ./dist /var/www/example --recursive
```

PowerShell:

```powershell
$env:SCP_NEXT_HOST = "example.com"
$env:SCP_NEXT_USERNAME = "deploy"
$env:SCP_NEXT_PRIVATE_KEY_FILE = "$HOME\.ssh\id_ed25519"
scp-next upload .\dist /var/www/example --recursive
```

## Configuration Precedence

Highest to lowest:

1. Explicit CLI options
2. Positional CLI operands
3. Environment variables
4. Selected configuration profile
5. Root-level configuration values
6. Configured job values
7. Internal defaults

For `run`, job values are loaded first, then root configuration, selected profile,
environment variables, explicit positional overrides, and CLI options.

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

CommonJS download:

```js
const { download } = require("scp-next");

async function main() {
  await download({
    host: process.env.SCP_NEXT_HOST,
    username: process.env.SCP_NEXT_USERNAME,
    privateKeyFile: process.env.SCP_NEXT_PRIVATE_KEY_FILE,
    remotePath: "/var/log/example.log",
    localPath: "./logs/example.log"
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
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

## Authentication

Supported methods:

- Password authentication
- Private-key content
- Private-key file
- Private-key passphrase
- SSH agent authentication through `agent` or `SSH_AUTH_SOCK`

## Host Verification

`hostFingerprint` compares the server host key SHA-256 fingerprint. `knownHostsFile`
supports plain OpenSSH `known_hosts` entries for exact host names. When neither is supplied,
`scp-next` reads `~/.ssh/known_hosts`. Hashed host names and every OpenSSH marker variant are
not currently parsed.

`scp-next` fails closed if it cannot establish a host verifier. Use `hostFingerprint` for CI
or deployments where a known-hosts file is not available.

## Progress Reporting

Interactive terminals display concise progress. Progress is disabled with `--quiet` or when
stderr is not a TTY, which keeps CI logs readable. Library users can pass `onProgress`.

## Dry Run

`--dry-run` resolves configuration and validates local paths and transfer direction without
connecting to the remote server or modifying local/remote files.

```text
Dry run: upload
Source: ./dist
Destination: deploy@example.com:/var/www/example
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

Each error includes a stable `code`, readable `message`, optional `cause`, and redacted
non-sensitive context.

```ts
import { AuthenticationError, upload } from "scp-next";

try {
  await upload({ localPath: "./dist", remotePath: "/var/www/example" });
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

Upload and download APIs use explicit `localPath` and `remotePath` names. The optional
generic `copy()` API accepts typed local/remote endpoint objects.

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

The published package includes `dist`, README, license, changelog, and docs. The CLI entry is
`dist/cli/index.js` and contains a Node.js shebang.

## Transfer Mechanism

Despite the package name, normal transfers use SFTP through `ssh2-sftp-client`, which is built
on `ssh2`. This avoids remote shell execution for regular transfers and gives better support
for progress reporting and recursive directory traversal than shelling out to an SCP command.
