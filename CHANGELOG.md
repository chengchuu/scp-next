# Changelog

## Unreleased

- Added opt-in, repeatable `--post-upload-command` commands for CLI uploads and configured
  upload jobs.
- Added library `postUploadCommands`, `client.exec()`, `ExecResult`, and typed
  `RemoteCommandError` APIs.
- Kept remote command execution separate from SFTP, sequential, disabled for downloads and dry
  runs, and fail-fast on non-zero exit codes.
- Added bounded command output capture, CLI failure propagation, secret redaction, and mock-based
  coverage for upload failure, ordering, command failure, dry-run, and connection cleanup.

## 1.0.19

- Refined README structure for clearer installation, quick start, basic usage, advanced usage,
  library options, and configuration guidance.
- Improved password-first examples while keeping security warnings and safer authentication
  recommendations visible.
- Clarified SSH agent usage, `SSH_AUTH_SOCK`, timeout behavior, and configuration-file
  recommendations.
- Expanded GitHub Pages documentation with CLI, library, and configuration options.
- Moved release notes under `guides/release-notes/` for cleaner documentation organization.

## 1.0.14

- Production-ready `scp-next` TypeScript CLI and library.
- Added upload, download, recursive directory transfer, dry-run mode, configuration files,
  profiles, jobs, environment-variable support, typed errors, and dual ESM/CommonJS builds.
- Added GitHub Pages developer documentation and expanded README usage sections.
- Improved SCP-style destination handling for files and directories.
- Enabled destination directory creation by default with `--no-create-directories` opt-out.
- Improved host verification guidance, Git Bash remote path handling, and progress output behavior.
- Removed unused legacy tooling and Docker configuration files.
