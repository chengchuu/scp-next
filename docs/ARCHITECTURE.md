# Architecture

`scp-next` separates the CLI from reusable transfer logic:

- `src/cli` parses operands and options, prints readable output, and sets exit codes.
- `src/config` loads JSON configuration, environment variables, profiles, jobs, and applies
  precedence in `resolve-config.ts`.
- `src/client` owns the public client API and delegates remote operations to a transport
  abstraction.
- `src/security` redacts secrets and configures host-key verification.
- `src/paths` keeps local OS path behavior separate from remote POSIX path behavior.
- `src/errors` defines stable typed errors.

## Dependency Choices

- `ssh2-sftp-client`: maintained SFTP client built on `ssh2`, avoiding manual protocol
  implementation and remote shell commands for normal transfers.
- `commander`: small CLI parser with solid help/version support.
- `zod`: validates configuration file shape without exposing schema objects in the public API.
- `tsup`: emits ESM, CommonJS, declarations, and source maps with minimal packaging overhead.
- `vitest`: fast TypeScript-friendly unit and integration tests.

## Transfer Terminology

CLI commands always use `<source> <destination>`.

```text
Operation  Source  Destination
Upload     Local   Remote
Download   Remote  Local
```

The programmatic API uses `localPath` and `remotePath` for upload and download so callers do
not need to infer locality from transfer direction. Configured jobs use `source` and
`destination` because they describe a reusable transfer plan.

## SFTP Mechanism and Limitations

Transfers are implemented with SFTP. This improves compatibility with directory traversal,
progress callbacks, and avoiding shell command injection risk. Limitations inherited from the
selected dependency and SFTP servers include:

- Progress is based on file transfer callbacks and may not include server-side metadata time.
- Server support for symlinks, permissions, and special files varies; this initial version
  transfers regular files and directories.
- Known-host parsing supports exact plain host entries, not hashed OpenSSH hostnames. Use
  `hostFingerprint` when hashed known-hosts entries are required.
- Atomic replacement behavior depends on the server; overwrite control is checked before
  transfer and is not a distributed lock.

## Integration Test Strategy

The committed integration tests use a mockable transport abstraction so no production SSH
server is required. A future CI job can add a local OpenSSH/SFTP container to verify live
authentication and host-key behavior against a disposable server.
