# AGENTS.md

Guidance for automated coding agents working on `scp-next`.

## Project Overview

`scp-next` is a TypeScript npm package that exposes:

- A CLI executable named `scp-next`.
- A library API usable through ESM `import` and CommonJS `require`.

Despite the package name, transfers use SFTP internally through `ssh2-sftp-client`. Do not
implement SSH, SCP, or SFTP protocol logic manually.

## Required Terminology

Use this terminology consistently in code, tests, docs, and CLI help:

```text
Operation  Source  Destination
Upload     Local   Remote
Download   Remote  Local
```

- CLI commands use positional operands named `<source> <destination>`.
- CLI usage/help should show operands before options:
  - `scp-next upload <source> <destination> [options]`
  - `scp-next download <source> <destination> [options]`
  - `scp-next run <job> [source] [destination] [options]`
- Programmatic upload/download APIs use `localPath` and `remotePath`.
- Configured transfer jobs use `source` and `destination`.
- Do not introduce aliases such as `from`, `to`, `input`, `output`, or `target`.

## Architecture Boundaries

- `src/cli`: CLI parsing, user output, process exit codes, command wiring.
- `src/client`: public transfer client and library functions.
- `src/client/transport.ts`: SFTP dependency boundary. Keep this mockable.
- `src/config`: config files, environment variables, profiles, jobs, precedence, validation.
- `src/security`: redaction and host verification.
- `src/paths`: local OS paths and remote POSIX paths.
- `src/errors`: public typed errors.
- `src/types`: public TypeScript types.
- `tests`: Vitest unit and mock-transport integration tests.
- `docs`: architecture notes and release notes.
- `site`: GitHub Pages documentation site.

Keep CLI concerns out of the library layer. The library must not call `process.exit()`.

## Security Rules

- Never print passwords, passphrases, private-key contents, tokens, or raw resolved configs
  containing secrets.
- Use `redactSensitiveValues()` when logging or attaching error context that might include
  credentials.
- Prefer private-key files, SSH agents, or environment variables over CLI password arguments.
- Do not persist credentials.
- Validate private-key files before connecting.
- Do not silently disable host verification.
- Normal transfers must not execute remote shell commands.
- Preserve the local/remote path distinction:
  - Local paths use Node OS-aware path utilities and support `~`.
  - Remote paths use POSIX behavior and must preserve `/` separators.

## Configuration Precedence

Precedence lives in `src/config/resolve-config.ts`. Keep it independently testable.

Highest to lowest:

1. Explicit CLI options
2. Positional CLI operands
3. Environment variables
4. Selected configuration profile
5. Root-level configuration values
6. Configured job values
7. Internal defaults

When changing precedence, update tests and README documentation together.

## CLI Defaults

- `--recursive` is opt-in and defaults to `false`.
- Destination directory creation defaults to enabled for daily `cp`/`scp`-style usage.
- Keep `--create-directories` as the affirmative flag for explicitness.
- Keep `--no-create-directories` as the opt-out flag; do not accept string boolean forms such as
  `--create-directories false`.
- Keep root help and command help aligned with the usage strings above.

## Public API Expectations

Primary exports are from `src/index.ts`:

- `upload(options)`
- `download(options)`
- `createClient(options)`
- `copy(options)`
- public types
- typed errors

Build output must include:

- ESM: `dist/index.js`
- CommonJS: `dist/index.cjs`
- Declarations: `dist/index.d.ts` and `dist/index.d.cts`
- CLI entry: `dist/cli/index.js`
- Source maps

The CLI file must keep the Node shebang.

## Development Commands

Use npm scripts:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm pack --dry-run
```

Before publishing or final validation, run:

```bash
npm run clean
npm run typecheck
npm run lint
npm test
npm run build
npm pack --dry-run
```

If the default npm cache has local permission issues, use a temporary cache:

```bash
npm --cache /private/tmp/scp-next-npm-cache pack --dry-run
```

## Testing Guidance

- Add or update Vitest tests for behavior changes.
- Do not require a production SSH server for tests.
- Prefer the mockable transport abstraction for integration coverage.
- Security-sensitive changes need tests for redaction and failure behavior.
- Terminology changes need tests proving upload/download operand mapping.

Important existing test areas:

- CLI argument parsing and missing operand errors
- Environment parsing
- Config loading and precedence
- Profile and job selection
- Local and remote path handling
- Secret redaction
- Error conversion
- Mock transport transfer behavior
- ESM and CJS exports

## Documentation Expectations

Documentation is split by audience:

- `README.md`: primary npm and GitHub usage guide.
- `docs/ARCHITECTURE.md`: implementation and dependency architecture.
- `docs/release-notes/`: long-form release announcements.
- `CHANGELOG.md`: concise version history.
- `site/`: GitHub Pages documentation for browser-based project docs.

Update `README.md`, `docs/ARCHITECTURE.md`, and `site/` when changing:

- CLI syntax or options
- configuration format or precedence
- public API names or types
- authentication or host verification behavior
- transfer mechanism or dependency limitations

Add or update files under `docs/release-notes/` for long-form release notes. Do not create a
root-level `release-notes/` directory.

README examples must not contain real credentials.

## Style Notes

- This project uses strict TypeScript and ESM source files.
- Avoid `any`; if unavoidable, keep it localized and explain why.
- Keep comments sparse and useful.
- Use existing typed errors instead of throwing generic errors from public paths.
- Keep public APIs small and stable.
- Do not add dependencies unless they clearly reduce risk or complexity.

## GitHub Actions Notes

The package has `"type": "module"`, so Node-run `.js` scripts must be ESM or use a `.cjs`
extension. `scripts/change-package-name.js` is intentionally ESM because the publish workflow
calls that exact filename.

The publish workflow temporarily changes the package name for GitHub Packages:

```bash
node scripts/change-package-name.js "@${{ github.repository_owner }}/${{ env.PROJECT_NAME }}"
```

Keep npm package identity as `scp-next` for the public npm package.
