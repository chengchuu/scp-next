# Architecture

`scp-next` separates the CLI from reusable transfer logic:

- `src/cli` parses operands and options, prints readable output, and sets exit codes.
- `src/config` loads JSON configuration, environment variables, profiles, jobs, and applies
  precedence in `resolve-config.ts`.
- `src/client` owns the public client API and delegates file transfers to the SFTP transport
  and explicit remote commands to a separate command-executor abstraction.
- `src/security` redacts secrets and configures host-key verification.
- `src/paths` keeps local OS path behavior separate from remote POSIX path behavior.
- `src/errors` defines stable typed errors.

## Dependency Choices

- `ssh2-sftp-client`: maintained SFTP client built on `ssh2`, avoiding manual protocol
  implementation and remote shell commands for normal transfers.
- `ssh2`: direct SSH command channels for the explicit `exec()` and `afterUpload` capabilities.
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

## Remote Command Execution

`src/client/command-executor.ts` is separate from `src/client/transport.ts`; the SFTP
transport never executes shell commands. The command connection is opened lazily only when
`exec()` is called or a successful upload has a non-empty `afterUpload` list. It is reused for
the command sequence and closed with the client. The current implementation uses a separate SSH
connection from the SFTP client because `ssh2-sftp-client` does not expose its underlying
connection as a supported public API.

Post-upload commands run sequentially. A failed upload prevents the command executor from
connecting, and a non-zero or missing command exit status stops later commands. Dry runs only
report the redacted plan. Downloads never carry post-upload commands. Captured stdout and stderr
are bounded by the command's `maxBuffer` option, which defaults to 10 MiB.

## Integration Test Strategy

The committed integration tests use mockable SFTP transport and command-executor abstractions,
so no production SSH server is required. A future CI job can add a local OpenSSH/SFTP container to verify live
authentication and host-key behavior against a disposable server.
