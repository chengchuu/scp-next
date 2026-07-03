Create a production-ready npm package named `scp-next`.

## Project Goal

Build a TypeScript-based SCP file-transfer tool that can be used in two ways:

1. As a command-line interface using positional arguments, command-line options, or configuration files.
2. As a JavaScript/TypeScript library through ESM `import` or CommonJS `require`.

The package should support uploading and downloading files and directories between a local machine and a remote server over SSH.

## Package Identity

The npm package name must be:

```text
scp-next
```

Expose this CLI executable:

```bash
scp-next
```

Example installation:

```bash
npm install --global scp-next
```

Example library installation:

```bash
npm install scp-next
```

## Transfer Terminology

Use consistent terminology throughout the project.

### CLI terminology

Use the standard positional operand order:

```text
<source> <destination>
```

For uploads:

* `source` is a local path.
* `destination` is a remote path.

For downloads:

* `source` is a remote path.
* `destination` is a local path.

Examples:

```bash
scp-next upload ./dist /var/www/example
```

```bash
scp-next download /var/log/example.log ./logs/example.log
```

In command help output, show:

```text
scp-next upload <source> <destination> [options]
scp-next download <source> <destination> [options]
```

Do not use ambiguous alternatives such as:

```text
input
output
from
to
target
```

Do not provide multiple aliases for the same operand in the initial version.

### Programmatic API terminology

In the JavaScript and TypeScript APIs, use explicit path names:

```text
localPath
remotePath
```

This avoids ambiguity about whether `source` or `destination` refers to the local or remote system.

For reusable transfer-job configuration objects, use:

```text
source
destination
```

## Technical Requirements

Use:

* TypeScript
* Node.js
* npm
* A maintained SSH/SCP/SFTP dependency suitable for programmatic file transfers
* ESLint
* Prettier
* Vitest or Jest

Do not implement the SSH, SCP, or SFTP protocol manually.

Prefer an actively maintained SSH/SFTP implementation. Although the package is named `scp-next`, it may use SFTP internally when that provides better security, compatibility, progress reporting, and directory-transfer support.

Document the underlying transfer mechanism clearly.

The project must produce:

* ESM output
* CommonJS output
* TypeScript declaration files
* An executable CLI entry
* Source maps

Configure `package.json` exports so that both usages work:

```ts
import {
  upload,
  download,
  createClient
} from "scp-next";
```

```js
const {
  upload,
  download,
  createClient
} = require("scp-next");
```

## Supported Operations

Implement at least these operations:

* Upload one file
* Upload one directory recursively
* Download one file
* Download one directory recursively
* Create a reusable transfer client
* Close an active client connection
* Display transfer progress when possible
* Configure connection and operation timeouts
* Control overwriting existing files
* Support dry-run mode
* Create missing destination directories when enabled

## CLI Design

Implement these commands:

```bash
scp-next upload <source> <destination> [options]
```

```bash
scp-next download <source> <destination> [options]
```

Examples:

```bash
scp-next upload ./dist /var/www/example
```

```bash
scp-next download /var/log/example.log ./logs/example.log
```

Support useful command-line options:

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

Example using CLI connection options:

```bash
scp-next upload ./dist /var/www/example \
  --host example.com \
  --username deploy \
  --private-key-file ~/.ssh/id_ed25519 \
  --recursive
```

Example download:

```bash
scp-next download \
  /var/log/example.log \
  ./logs/example.log \
  --host example.com \
  --username deploy \
  --private-key-file ~/.ssh/id_ed25519
```

Example using a configuration file:

```bash
scp-next upload \
  ./dist \
  /var/www/example \
  --config ./scp-next.config.json
```

The CLI must return appropriate process exit codes:

* `0` for success
* Non-zero for validation, configuration, authentication, connection, host-verification, filesystem, or transfer errors

Avoid printing stack traces by default.

Show concise and readable error messages. Print stack traces only in verbose or debug mode.

## Positional Operand Validation

Validate the positional operands before connecting.

For `upload`:

```text
source      Local file or directory
destination Remote file or directory path
```

For `download`:

```text
source      Remote file or directory path
destination Local file or directory
```

Produce clear errors when either operand is missing:

```text
Error: Missing source path.

Usage:
  scp-next upload <source> <destination> [options]
```

```text
Error: Missing destination path.

Usage:
  scp-next download <source> <destination> [options]
```

Do not silently infer a missing source or destination.

## Configuration Files

Support configuration files such as:

```text
scp-next.config.json
.scp-nextrc
.scp-nextrc.json
```

Also support an explicit configuration path:

```bash
scp-next upload \
  ./dist \
  /var/www/example \
  --config ./deploy/scp-next.json
```

Example configuration:

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

## Named Server Profiles

Support named server profiles:

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

Example profile usage:

```bash
scp-next upload \
  ./dist \
  /var/www/example \
  --config ./scp-next.config.json \
  --profile production
```

## Configured Transfer Jobs

Optionally support reusable transfer jobs in a configuration file.

Use `source` and `destination` as the canonical property names:

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

Run a configured job with:

```bash
scp-next run deploy
```

```bash
scp-next run download-logs
```

For configured jobs:

* `source` always means the origin of the transfer.
* `destination` always means the destination of the transfer.
* The `operation` determines whether each path is local or remote.

CLI positional operands should override job paths when the command explicitly permits overrides.

Do not support duplicate aliases such as `from`, `input`, `target`, or `to`.

## Environment Variables

For security, allow server connection parameters and credentials to be read from operating-system environment variables.

Use:

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

Example for Bash:

```bash
export SCP_NEXT_HOST="example.com"
export SCP_NEXT_USERNAME="deploy"
export SCP_NEXT_PRIVATE_KEY_FILE="$HOME/.ssh/id_ed25519"

scp-next upload ./dist /var/www/example --recursive
```

Example for PowerShell:

```powershell
$env:SCP_NEXT_HOST = "example.com"
$env:SCP_NEXT_USERNAME = "deploy"
$env:SCP_NEXT_PRIVATE_KEY_FILE = "$HOME\.ssh\id_ed25519"

scp-next upload .\dist /var/www/example --recursive
```

Use this configuration precedence, from highest to lowest:

1. Explicit CLI options
2. Positional CLI operands
3. Environment variables
4. Selected configuration profile
5. Root-level configuration values
6. Configured job values where applicable
7. Internal defaults

For transfer-job execution, define and document the exact merge order so that explicit CLI input always has the highest priority.

Keep precedence resolution in a dedicated, independently testable module.

## Authentication

Support:

* Password authentication
* Private-key content
* Private-key file
* Private-key passphrase
* SSH agent authentication when supported by the selected dependency

Prefer private-key files or SSH agents over password arguments.

## Security Requirements

Apply the following security rules:

* Never print passwords, private keys, or passphrases.
* Redact sensitive values from logs and errors.
* Do not include real credentials in documentation examples.
* Warn that CLI password arguments may be exposed through shell history and process listings.
* Prefer environment variables, SSH agents, or protected private-key files.
* Do not automatically persist credentials.
* Validate private-key file paths before connecting.
* Expand `~` in local paths.
* Do not silently disable SSH host verification.
* Support known-host or host-fingerprint verification when possible.
* Do not execute remote shell commands for normal transfers unless technically necessary.
* Prevent unsafe local path traversal when resolving configuration-related paths.
* Avoid exposing secrets when serializing resolved configuration.
* Mask sensitive values with `[REDACTED]`.

Verbose logging may include:

* Host
* Port
* Username
* Transfer operation
* Source path
* Destination path

Verbose logging must never include:

* Password
* Passphrase
* Private-key contents
* Authentication tokens
* Raw resolved configuration containing secrets

## TypeScript API

Design clear public types:

```ts
export interface ScpServerOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string | Buffer;
  privateKeyFile?: string;
  passphrase?: string;
  agent?: string;
  timeout?: number;
  hostFingerprint?: string;
  knownHostsFile?: string;
}

export interface TransferOptions {
  recursive?: boolean;
  overwrite?: boolean;
  createDirectories?: boolean;
  dryRun?: boolean;
  timeout?: number;
  onProgress?: (progress: TransferProgress) => void;
}

export interface TransferProgress {
  operation: "upload" | "download";
  source: string;
  destination: string;
  transferredBytes: number;
  totalBytes?: number;
  percentage?: number;
  currentFile?: string;
}

export interface UploadOptions
  extends ScpServerOptions,
    TransferOptions {
  localPath: string;
  remotePath: string;
}

export interface DownloadOptions
  extends ScpServerOptions,
    TransferOptions {
  remotePath: string;
  localPath: string;
}
```

Expose functions similar to:

```ts
export async function upload(
  options: UploadOptions
): Promise<void>;

export async function download(
  options: DownloadOptions
): Promise<void>;

export function createClient(
  options: ScpServerOptions
): ScpNextClient;
```

The reusable client should support:

```ts
export interface ScpNextClient {
  connect(): Promise<void>;

  upload(
    localPath: string,
    remotePath: string,
    options?: TransferOptions
  ): Promise<void>;

  download(
    remotePath: string,
    localPath: string,
    options?: TransferOptions
  ): Promise<void>;

  close(): Promise<void>;
}
```

Do not use generic `sourcePath` and `destinationPath` in the upload and download API when `localPath` and `remotePath` provide clearer meaning.

The library API must not call `process.exit()`.

Only the CLI layer may set `process.exitCode`.

## Optional Generic Transfer API

An optional generic transfer API may use `source` and `destination` endpoint objects:

```ts
export interface LocalEndpoint {
  type: "local";
  path: string;
}

export interface RemoteEndpoint {
  type: "remote";
  path: string;
}

export type TransferEndpoint =
  | LocalEndpoint
  | RemoteEndpoint;

export interface CopyOptions extends TransferOptions {
  source: TransferEndpoint;
  destination: TransferEndpoint;
}

export async function copy(
  options: CopyOptions
): Promise<void>;
```

Example:

```ts
import { copy } from "scp-next";

await copy({
  source: {
    type: "local",
    path: "./dist"
  },
  destination: {
    type: "remote",
    path: "/var/www/example"
  },
  recursive: true
});
```

Only implement this API if it remains simple and does not duplicate unnecessary internal logic.

The primary public APIs should remain `upload()` and `download()`.

## Library Usage Examples

Include an ESM upload example:

```ts
import { upload } from "scp-next";

await upload({
  host: process.env.SCP_NEXT_HOST,
  username: process.env.SCP_NEXT_USERNAME,
  privateKeyFile:
    process.env.SCP_NEXT_PRIVATE_KEY_FILE,
  localPath: "./dist",
  remotePath: "/var/www/example",
  recursive: true,
  overwrite: true
});
```

Include a CommonJS download example:

```js
const { download } = require("scp-next");

async function main() {
  await download({
    host: process.env.SCP_NEXT_HOST,
    username: process.env.SCP_NEXT_USERNAME,
    privateKeyFile:
      process.env.SCP_NEXT_PRIVATE_KEY_FILE,
    remotePath: "/var/log/example.log",
    localPath: "./logs/example.log"
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
```

Include a reusable client example:

```ts
import { createClient } from "scp-next";

const client = createClient({
  host: process.env.SCP_NEXT_HOST,
  username: process.env.SCP_NEXT_USERNAME,
  privateKeyFile:
    process.env.SCP_NEXT_PRIVATE_KEY_FILE
});

try {
  await client.connect();

  await client.upload(
    "./dist",
    "/var/www/example",
    {
      recursive: true
    }
  );

  await client.download(
    "/var/log/example.log",
    "./logs/example.log"
  );
} finally {
  await client.close();
}
```

## Error Handling

Create typed errors:

```text
ScpNextError
ConfigurationError
ValidationError
AuthenticationError
ConnectionError
TransferError
FileSystemError
HostVerificationError
```

Each error should include:

* A stable error code
* A readable message
* The original error as `cause`, when available
* Relevant non-sensitive context

Example:

```ts
try {
  await upload(options);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error(
      "SSH authentication failed."
    );
  }

  throw error;
}
```

## Suggested Project Structure

Use a structure similar to:

```text
scp-next/
├── src/
│   ├── cli/
│   │   ├── index.ts
│   │   ├── commands/
│   │   │   ├── upload.ts
│   │   │   ├── download.ts
│   │   │   └── run.ts
│   │   ├── operands.ts
│   │   └── output.ts
│   ├── client/
│   │   ├── client.ts
│   │   ├── upload.ts
│   │   ├── download.ts
│   │   └── transport.ts
│   ├── config/
│   │   ├── load-config.ts
│   │   ├── environment.ts
│   │   ├── profiles.ts
│   │   ├── jobs.ts
│   │   ├── resolve-config.ts
│   │   └── validation.ts
│   ├── security/
│   │   ├── redact.ts
│   │   └── host-verification.ts
│   ├── errors/
│   │   └── index.ts
│   ├── paths/
│   │   ├── local-path.ts
│   │   └── remote-path.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── tests/
├── examples/
│   ├── esm/
│   ├── commonjs/
│   └── config/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── README.md
├── LICENSE
└── CHANGELOG.md
```

Keep the CLI layer separate from the reusable library implementation.

## Path Handling

Treat local and remote paths differently.

### Local paths

Local paths must:

* Work on Windows, macOS, and Linux
* Support relative and absolute paths
* Expand `~`
* Use the Node.js path utilities appropriate to the current operating system
* Validate filesystem existence where required

### Remote paths

Remote paths must:

* Use POSIX path behavior
* Preserve `/` separators on all local operating systems
* Never use Windows path normalization
* Reject empty remote paths
* Avoid unintentionally modifying valid remote paths

Do not pass remote paths through `node:path` default platform-specific normalization.

Use POSIX path utilities where remote path normalization is needed.

## Validation

Validate all resolved input before connecting.

Validation must cover:

* Required host
* Required username
* Valid port range
* Positive timeout values
* Existing local source path for uploads
* Valid local destination or destination parent for downloads
* Non-empty remote paths
* Supported authentication combinations
* Valid configuration-file syntax
* Existing private-key file
* Valid profile name
* Valid job name
* Required source operand
* Required destination operand
* Valid operation type
* Prevention of local-to-local or remote-to-remote generic transfers unless explicitly supported

Use a schema-validation library when appropriate, but do not expose dependency-specific schema objects through the public API.

## Progress Output

When the terminal is interactive, show progress such as:

```text
Uploading: dist/app.js
1.8 MB / 3.2 MB (56%)
```

For directory transfers, optionally show:

* Current file
* Completed file count
* Total file count
* Transferred bytes
* Percentage when total size is known

Disable progress animation when:

* `--quiet` is enabled
* Output is not an interactive terminal
* Structured output is requested in a future version

Ensure logs remain readable in CI environments.

## Dry-Run Behavior

When `--dry-run` is enabled:

* Resolve configuration normally.
* Validate paths and transfer direction.
* Do not connect to the remote server unless remote validation is explicitly requested.
* Do not modify local or remote files.
* Display the planned operation.
* Redact authentication information.

Example:

```text
Dry run: upload
Source: ./dist
Destination: deploy@example.com:/var/www/example
Recursive: yes
Overwrite: yes
```

## Testing

Add unit tests for:

* CLI argument parsing
* Positional source and destination parsing
* Missing operand errors
* Environment-variable parsing
* Configuration-file loading
* Profile selection
* Job selection
* Configuration precedence
* Local path expansion
* Remote POSIX path handling
* Validation
* Secret redaction
* Error conversion
* ESM exports
* CommonJS exports

Add integration tests using:

* A mockable transport abstraction, or
* A local SSH/SFTP test container

Do not require access to a production server.

Test these security cases:

* Passwords are absent from logs.
* Passphrases are absent from errors.
* Private-key contents are redacted.
* CLI options override environment variables.
* Environment variables override configuration files.
* Invalid profiles fail safely.
* Invalid jobs fail safely.
* Missing key files produce readable errors.
* Dry-run output contains no secrets.

Test transfer terminology:

* Upload source is interpreted as local.
* Upload destination is interpreted as remote.
* Download source is interpreted as remote.
* Download destination is interpreted as local.
* `localPath` and `remotePath` map correctly in the library API.

## Package Scripts

Add scripts similar to:

```json
{
  "scripts": {
    "build": "...",
    "clean": "...",
    "dev": "...",
    "lint": "...",
    "format": "...",
    "format:check": "...",
    "test": "...",
    "test:coverage": "...",
    "typecheck": "...",
    "prepublishOnly": "npm run clean && npm run typecheck && npm run lint && npm test && npm run build"
  }
}
```

Ensure the CLI output file has a Node.js shebang:

```js
#!/usr/bin/env node
```

Configure the `bin` field:

```json
{
  "bin": {
    "scp-next": "./dist/cli/index.js"
  }
}
```

Ensure the published package contains only:

* Runtime files
* Type declarations
* Source maps when intended
* README
* License
* Changelog
* Required package metadata

## Documentation

Create a complete `README.md` containing:

* Project overview
* Feature list
* Installation
* CLI syntax
* Explanation of source and destination
* Upload examples
* Download examples
* Configuration-file examples
* Named profile examples
* Configured job examples
* Environment-variable examples
* Configuration precedence
* ESM usage
* CommonJS usage
* Reusable client usage
* Authentication options
* Security recommendations
* Progress reporting
* Dry-run behavior
* Error handling
* API reference
* Development commands
* Testing instructions
* Publishing instructions

Document this terminology table:

```text
Operation  Source  Destination
Upload     Local   Remote
Download   Remote  Local
```

Document explicitly that:

* CLI commands use `<source> <destination>`.
* Programmatic upload and download APIs use `localPath` and `remotePath`.
* Credentials should preferably be supplied through environment variables, SSH agents, or protected private-key files instead of command-line password arguments.

## Quality Requirements

The implementation should:

* Use strict TypeScript settings.
* Avoid `any` unless unavoidable and documented.
* Keep public APIs small and stable.
* Separate CLI concerns from transfer logic.
* Avoid global mutable state.
* Reliably close connections and file handles.
* Work on Windows, macOS, and Linux.
* Correctly distinguish local platform paths from remote POSIX paths.
* Include comments only where behavior is not self-explanatory.
* Avoid unnecessary dependencies.
* Use semantic versioning.
* Be ready for npm publication.

## Deliverables

Generate the complete project, including:

1. Source code
2. Build configuration
3. CLI implementation
4. Package exports
5. Type declarations
6. Unit tests
7. Integration-test strategy
8. Usage examples
9. README
10. License
11. Initial changelog
12. Architecture explanation
13. Explanation of major dependency choices
14. Explanation of transfer terminology
15. Explanation of the selected SSH/SCP/SFTP mechanism

Before finishing, run or simulate:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm pack --dry-run
```

Report:

* Validation results
* Build results
* Test results
* Package contents
* Remaining limitations
* Limitations introduced by the selected SSH/SFTP dependency
* Any platform-specific behavior
