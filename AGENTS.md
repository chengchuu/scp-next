# AGENTS.md

Guidance for automated coding agents working on `scp-next`.

## Project Overview

`scp-next` is a TypeScript npm package that exposes:

- A CLI executable named `scp-next`.
- A library API usable through ESM `import` and CommonJS `require`.

Despite the package name, file transfers use SFTP internally through `ssh2-sftp-client`.
Explicit remote command execution uses `ssh2` through a separate command-executor boundary. Do
not implement SSH, SCP, or SFTP protocol logic manually.

The published runtime supports Node.js 18.20.4 or later. CI currently builds and publishes with
Node.js 22.

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
- `src/client`: public transfer client, standalone library functions, SFTP traversal, and explicit
  remote-command support.
- `src/client/transport.ts`: SFTP-only dependency boundary. Keep this mockable and free of remote
  command execution.
- `src/client/command-executor.ts`: direct SSH command boundary for `exec()` and post-upload
  commands. Keep this separately mockable.
- `src/config`: config files, environment variables, profiles, jobs, post-upload command parsing,
  precedence, and validation.
- `src/security`: redaction and host verification.
- `src/paths`: local OS paths and remote POSIX paths.
- `src/errors`: public typed errors.
- `src/types`: public TypeScript types.
- `tests`: Vitest unit, mock-transport integration, package-export, and website build tests.
- `examples`: maintained ESM, CommonJS, and configuration examples for package consumers.
- `guides`: handwritten architecture notes and release notes.
- `project.config.js`: central package-derived website identity, routes, metadata, theme, and PWA
  configuration.
- `site`: source for the Bootstrap website, interactive examples, shared browser behavior, and
  service worker.
- `scripts/rollup.config.mjs`: npm package build configuration; runtime dependencies remain
  external.
- `scripts/webpack.config.dev.js`: website and interactive-example build configuration.
- `scripts/build-pages.js`: deterministic final Pages assembly, TypeDoc transformation, metadata,
  generated images, manifest, sitemap, and service-worker output.
- `.pages-api`, `dist-dev`, and `docs`: generated TypeDoc, Webpack, and final Pages outputs. Do not
  store handwritten source in them or edit them directly.

Keep CLI concerns out of the library layer. The library must not call `process.exit()`.

## Security Rules

- Never print passwords, passphrases, private-key contents, tokens, raw resolved configs, or raw
  command output that may contain secrets.
- Use `redactSensitiveValues()` for structured values and `redactKnownSensitiveValues()` for text
  that may contain credentials or common secret assignments.
- Prefer private-key files, SSH agents, or environment variables over CLI password arguments.
- Do not persist credentials.
- Validate private-key files before connecting.
- Do not silently disable host verification.
- The SFTP transport must never execute remote shell commands.
- Remote commands are allowed only through the explicit `ScpNextClient.exec()` API or an opt-in
  `postUploadCommands` / `--post-upload-command` setting. Send them directly to the remote SSH
  server, never through a local shell.
- Post-upload commands run sequentially only after a successful upload. They must not run after a
  failed upload, during a download, or during a dry run. Stop the sequence on command failure.
- Keep remote-command stdout and stderr bounded, typed, and redacted before CLI or error output.
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
- `--post-upload-command <command>` is repeatable and belongs only to `upload` and `run`; it is not
  a download option.
- `--dry-run` resolves and validates without connecting, transferring files, or executing remote
  commands.
- CLI/config `--timeout` and `timeout` map to SSH `readyTimeout`. They are distinct from the
  per-command `ExecOptions.timeout` and are not total-transfer or per-file timeouts.

## Public API Expectations

Primary exports are from `src/index.ts`:

- `upload(options)` returning `Promise<ExecResult[]>`
- `download(options)`
- `createClient(options)`
- `copy(options)`
- `ScpNextClientImpl`
- `ScpNextClient.exec(command, options)` through the public client interface
- public types
- typed errors

The standalone upload function and client upload method return post-upload command results. With
no configured commands, they return an empty array. Downloads and `copy()` return `Promise<void>`.

Build output must include:

- ESM: `dist/index.js`
- CommonJS: `dist/index.cjs`
- Declarations: `dist/index.d.ts` and `dist/index.d.cts`
- CLI entry: `dist/cli/index.js`
- Source maps

The CLI file must keep the Node shebang.

The published package contains `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, and `guides`.
Website source, examples, tests, and generated Pages output are development-only and must not leak
into the runtime package.

## Development Commands

Use npm scripts:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run docs:links
npm run docs
npm pack --dry-run
```

Useful focused workflows are:

```bash
npm run dev
npm run build:dev
npm run pages:preview
npm run format:check
```

`npm run typecheck` checks both the Node package configuration and `tsconfig.site.json`.
`pnpm-lock.yaml` is the committed dependency lockfile; `package-lock.json` is ignored. When
dependencies change, update `pnpm-lock.yaml` and do not add a package-lock file. CI intentionally
uses `npm install`.

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
- Explicit command execution, bounded output, failure behavior, and post-upload sequencing
- ESM and CJS exports
- Website example generation, local/remote operand mapping, and copy-control behavior
- TypeDoc metadata transformation and GitHub Pages routes
- SEO, PWA manifest, icon, and service-worker validation

## Documentation Expectations

Documentation is split by audience:

- `README.md`: primary npm and GitHub usage guide.
- `guides/ARCHITECTURE.md`: implementation and dependency architecture.
- `guides/RELEASE_NOTES/`: long-form release announcements.
- `CHANGELOG.md`: concise version history.
- `site/`: source for browser-based project documentation.
- `docs/`: generated GitHub Pages output only.

README and site structure should stay aligned:

- Put `Features` near the top, before `Contents` in the README and before install content on
  the site.
- Use `CLI Usage`, not `Basic Usage`, for command-line syntax, examples, operands, and options.
- Keep `User Guides` linked to the English and Simplified Chinese files under
  `guides/RELEASE_NOTES/`.
- Keep password examples visible early for common user workflows, while also warning that CLI
  password arguments may appear in shell history or process listings.
- Document `--timeout` and `timeout` as the SSH connection ready timeout / `readyTimeout`; do
  not describe it as a total transfer or per-file operation timeout.
- Recommend `scp-next.config.json` in the current directory, and mention that `.scp-nextrc` and
  `.scp-nextrc.json` are auto-detected.
- Include `SSH_AUTH_SOCK` wherever environment variables or SSH agent authentication are
  documented.

Update `README.md`, `guides/ARCHITECTURE.md`, and `site/` when changing:

- CLI syntax or options
- configuration format or precedence
- public API names or types
- authentication or host verification behavior
- transfer mechanism or dependency limitations

Add or update files under `guides/RELEASE_NOTES/` for long-form release notes. Do not create a
root-level `RELEASE_NOTES/` directory.

README examples must not contain real credentials.

## Website and Pages Expectations

- Keep Rollup responsible for `dist/`, Webpack responsible for the homepage and `/examples/`,
  TypeDoc responsible for `.pages-api/`, and `scripts/build-pages.js` responsible for final
  `docs/` assembly.
- Keep Bootstrap in `devDependencies`; never add website code or browser-only dependencies to
  package runtime source.
- Preserve stable routes below `/scp-next/`: `/`, `/examples/`, and `/api/`.
- Keep canonical URLs, Open Graph metadata, JSON-LD, sitemap routes, manifest paths, worker scope,
  favicon paths, and navigation synchronized through `project.config.js`.
- The examples page may generate accurate CLI and public-root TypeScript calls, but must not make
  SSH connections, inspect local files, or collect credentials in the browser. Generated examples
  stay in dry-run mode and may be copied only after explicit user action.
- Apply `system`, `light`, and `dark` preferences through Bootstrap `data-bs-theme`, persist them
  under the project-specific key, and synchronize TypeDoc plus browser theme-color state.
- Enable the service worker by default only for production Pages builds. Local PWA testing requires
  `PWA_ENABLED=true`; registration must still pass the safe-environment and project-scope checks.
  Keep interception within the project base path and require explicit user action before
  activating a waiting update.
- Run `npm run docs` for site changes so SEO and PWA validators inspect the final artifact.

## Style Notes

- This project uses strict TypeScript and ESM source files.
- Package code targets ES2022/NodeNext. Website TypeScript is a separate browser build targeting
  ES2018 through `tsconfig.site.json`.
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

- `.github/workflows/publish-npm.yml` runs on Node.js 22, uses `npm install`, builds and tests before
  publishing to npm and GitHub Packages, then creates the version tag after successful publication.
- `.github/workflows/pages.yml` runs typecheck, lint, tests, package build, and `npm run docs` before
  uploading `docs/` to GitHub Pages. It deploys from `main` and `release/v*` branches.
