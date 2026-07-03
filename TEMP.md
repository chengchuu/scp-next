Create a production-ready npm package named `mazey-scp-cli`.

## Project Goal

Build a TypeScript-based SCP tool that can be used in two ways:

1. As a command-line interface with command-line arguments or a configuration file.
2. As a JavaScript/TypeScript library through ESM `import` or CommonJS `require`.

The package should support uploading and downloading files between a local machine and a remote server over SSH/SCP.

## Technical Requirements

Use:

* TypeScript
* Node.js
* npm
* A maintained SSH/SCP dependency suitable for programmatic file transfer
* ESLint
* Prettier
* Vitest or Jest for testing

Do not implement the SSH or SCP protocol manually.

The package name must be:

```text
mazey-scp-cli
```

Expose this CLI command:

```bash
mazey-scp
```

The project must produce:

* ESM output
* CommonJS output
* TypeScript declaration files
* An executable CLI entry
* Source maps

Configure `package.json` exports so that both usages work:

```ts
import { upload, download, createClient } from "mazey-scp-cli";
```

```js
const { upload, download, createClient } = require("mazey-scp-cli");
```

## Supported Operations

Implement at least these operations:

* Upload a file
* Upload a directory recursively
* Download a file
* Download a directory recursively
* Create a reusable SCP client
* Close an active client connection
* Display transfer progress when possible
* Support configurable connection and operation timeouts
* Support overwriting existing files
* Support a dry-run mode

## CLI Design

Support commands similar to:

```bash
mazey-scp upload ./dist /var/www/example
```

```bash
mazey-scp download /var/log/example.log ./logs
```

Support useful command-line parameters:

```text
--host
--port
--username
--password
--private-key
--private-key-file
--passphrase
--config
--recursive
--overwrite
--dry-run
--timeout
--verbose
--quiet
--help
--version
```

Examples:

```bash
mazey-scp upload ./dist /var/www/example \
  --host example.com \
  --username deploy \
  --private-key-file ~/.ssh/id_ed25519 \
  --recursive
```

```bash
mazey-scp download /var/log/example.log ./logs \
  --config ./mazey-scp.config.json
```

The CLI must return appropriate process exit codes:

* `0` for success
* A non-zero exit code for validation, authentication, connection, or transfer errors

Avoid printing stack traces by default. Show readable error messages and print stack traces only in verbose or debug mode.

## Configuration Files

Support configuration files such as:

```text
mazey-scp.config.json
.mazey-scprc
.mazey-scprc.json
```

Also support an explicit configuration path:

```bash
mazey-scp upload ./dist /var/www/example --config ./deploy/scp.json
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
    "timeout": 30000
  }
}
```

Optionally support named server profiles:

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
mazey-scp upload ./dist /var/www/example \
  --config ./mazey-scp.config.json \
  --profile production
```

## Environment Variables

For security, allow server connection parameters and credentials to be read from operating-system environment variables.

Use the following variables:

```text
MAZEY_SCP_HOST
MAZEY_SCP_PORT
MAZEY_SCP_USERNAME
MAZEY_SCP_PASSWORD
MAZEY_SCP_PRIVATE_KEY
MAZEY_SCP_PRIVATE_KEY_FILE
MAZEY_SCP_PASSPHRASE
MAZEY_SCP_TIMEOUT
```

Example:

```bash
export MAZEY_SCP_HOST="example.com"
export MAZEY_SCP_USERNAME="deploy"
export MAZEY_SCP_PRIVATE_KEY_FILE="$HOME/.ssh/id_ed25519"

mazey-scp upload ./dist /var/www/example --recursive
```

Also document a PowerShell example:

```powershell
$env:MAZEY_SCP_HOST = "example.com"
$env:MAZEY_SCP_USERNAME = "deploy"
$env:MAZEY_SCP_PRIVATE_KEY_FILE = "$HOME\.ssh\id_ed25519"

mazey-scp upload .\dist /var/www/example --recursive
```

Use this configuration precedence, from highest to lowest:

1. Explicit CLI arguments
2. Environment variables
3. Selected configuration-file profile
4. Root-level configuration-file values
5. Internal defaults

Keep the precedence logic in a dedicated, independently testable module.

## Security Requirements

Apply the following security rules:

* Never print passwords, private keys, or passphrases.
* Redact sensitive values from logs and error messages.
* Do not include passwords directly in documentation examples.
* Warn users that passing passwords through CLI arguments can expose them in shell history and process listings.
* Prefer environment variables, SSH agents, or private-key files.
* Do not persist credentials automatically.
* Validate private-key file paths before connecting.
* Expand `~` in local file paths.
* Do not disable SSH host verification silently.
* Support an optional known-hosts or host-fingerprint verification mechanism if the selected dependency permits it.
* Do not execute remote shell commands for ordinary file-transfer operations unless technically required.
* Prevent local path traversal when resolving configuration-related paths.
* Avoid exposing secrets when serializing resolved configuration for debugging.
* Mask sensitive values with a value such as `[REDACTED]`.

When verbose logging is enabled, connection information may include the host, port, and username, but must never include authentication secrets.

## TypeScript API

Design clear public types such as:

```ts
export interface ScpServerOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string | Buffer;
  privateKeyFile?: string;
  passphrase?: string;
  timeout?: number;
}

export interface TransferOptions {
  recursive?: boolean;
  overwrite?: boolean;
  dryRun?: boolean;
  timeout?: number;
  onProgress?: (progress: TransferProgress) => void;
}

export interface TransferProgress {
  source: string;
  destination: string;
  transferredBytes: number;
  totalBytes?: number;
  percentage?: number;
}

export interface UploadOptions extends ScpServerOptions, TransferOptions {
  localPath: string;
  remotePath: string;
}

export interface DownloadOptions extends ScpServerOptions, TransferOptions {
  remotePath: string;
  localPath: string;
}
```

Expose functions similar to:

```ts
export async function upload(options: UploadOptions): Promise<void>;
export async function download(options: DownloadOptions): Promise<void>;
export function createClient(options: ScpServerOptions): MazeyScpClient;
```

The reusable client should support:

```ts
export interface MazeyScpClient {
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

The library API must not call `process.exit()`. Only the CLI layer may set process exit codes.

## Library Usage Examples

Include an ESM example:

```ts
import { upload } from "mazey-scp-cli";

await upload({
  host: process.env.MAZEY_SCP_HOST,
  username: process.env.MAZEY_SCP_USERNAME,
  privateKeyFile: process.env.MAZEY_SCP_PRIVATE_KEY_FILE,
  localPath: "./dist",
  remotePath: "/var/www/example",
  recursive: true,
  overwrite: true
});
```

Include a CommonJS example:

```js
const { download } = require("mazey-scp-cli");

async function main() {
  await download({
    host: process.env.MAZEY_SCP_HOST,
    username: process.env.MAZEY_SCP_USERNAME,
    privateKeyFile: process.env.MAZEY_SCP_PRIVATE_KEY_FILE,
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
import { createClient } from "mazey-scp-cli";

const client = createClient({
  host: process.env.MAZEY_SCP_HOST,
  username: process.env.MAZEY_SCP_USERNAME,
  privateKeyFile: process.env.MAZEY_SCP_PRIVATE_KEY_FILE
});

try {
  await client.connect();
  await client.upload("./dist", "/var/www/example", {
    recursive: true
  });
  await client.download(
    "/var/log/example.log",
    "./logs/example.log"
  );
} finally {
  await client.close();
}
```

## Error Handling

Create typed errors such as:

```ts
MazeyScpError
ConfigurationError
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
    console.error("SCP authentication failed.");
  }

  throw error;
}
```

## Suggested Project Structure

Use a structure similar to:

```text
mazey-scp-cli/
├── src/
│   ├── cli/
│   │   ├── index.ts
│   │   ├── commands/
│   │   │   ├── upload.ts
│   │   │   └── download.ts
│   │   └── output.ts
│   ├── client/
│   │   ├── client.ts
│   │   ├── upload.ts
│   │   └── download.ts
│   ├── config/
│   │   ├── load-config.ts
│   │   ├── environment.ts
│   │   ├── resolve-config.ts
│   │   └── validation.ts
│   ├── security/
│   │   ├── redact.ts
│   │   └── host-verification.ts
│   ├── errors/
│   │   └── index.ts
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

## Validation

Validate all resolved input before attempting a connection.

Validation should cover:

* Required host
* Required username
* Valid port range
* Positive timeout values
* Existing local source path for uploads
* Valid local destination parent path for downloads
* Non-empty remote paths
* Mutually exclusive authentication options where appropriate
* Valid configuration-file syntax
* Existing private-key file
* Valid profile name

Use a schema-validation library when appropriate, but do not expose dependency-specific validation objects as part of the public API.

## Testing

Add unit tests for:

* CLI argument parsing
* Environment-variable parsing
* Configuration-file loading
* Profile selection
* Configuration precedence
* Path expansion
* Validation
* Secret redaction
* Error conversion
* ESM exports
* CommonJS exports

Add integration tests using a mockable transport abstraction or a local SSH/SCP test container.

Do not require access to a real production server.

Test these security cases:

* Passwords are absent from logs.
* Passphrases are absent from errors.
* Private-key contents are redacted.
* CLI arguments override environment variables.
* Environment variables override configuration files.
* Invalid server profiles fail safely.
* Missing key files produce readable errors.

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

Ensure the published package contains only required runtime files, declarations, documentation, and licenses.

## Documentation

Create a complete `README.md` containing:

* Project overview
* Features
* Installation
* CLI usage
* Upload examples
* Download examples
* Configuration-file examples
* Named profile examples
* Environment-variable examples
* Configuration precedence
* ESM usage
* CommonJS usage
* Reusable client usage
* Authentication options
* Security recommendations
* Error handling
* API reference
* Development commands
* Testing instructions
* Publishing instructions

Document explicitly that credentials should preferably be supplied through environment variables, SSH agents, or protected private-key files rather than command-line arguments.

## Quality Requirements

The implementation should:

* Use strict TypeScript settings.
* Avoid `any` unless unavoidable and documented.
* Keep public APIs small and stable.
* Separate CLI concerns from transfer logic.
* Avoid global mutable state.
* Close connections and file handles reliably.
* Work on Windows, macOS, and Linux.
* Handle Windows and POSIX local paths correctly.
* Preserve remote POSIX path behavior.
* Include useful comments only where the implementation is not self-explanatory.
* Avoid unnecessary dependencies.
* Use semantic versioning.
* Be ready for publication to npm.

## Deliverables

Generate the complete project, including:

1. Source code
2. Build configuration
3. CLI configuration
4. Package exports
5. Type declarations
6. Unit tests
7. Integration-test strategy
8. Examples
9. README
10. License
11. Initial changelog
12. A brief explanation of the architecture and major dependency choices

Before finishing, run or simulate the following validation sequence:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm pack --dry-run
```

Report any remaining limitations, especially limitations caused by the selected SSH/SCP dependency.
