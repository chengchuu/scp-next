# Reusable Utility Candidates

## Summary

- **Strong candidates:** 4
- **Possible candidates:** 4
- **Main overlap:** defined-value merging is applied repeatedly; integer parsing, positive-number
  validation, test streams, and path resolution have smaller duplicated variants.
- **Intentionally excluded:** SFTP transfer orchestration, CLI operand policy, configuration
  precedence, typed `scp-next` errors, and local-versus-remote path policy.

The ranking favors low coupling and clear behavior. Security-sensitive candidates remain
conditional on stronger specifications and tests.

## 1. `assignDefined`

**Priority:** Strong candidate  
**Current location:** `src/config/resolve-config.ts`

### Purpose

Shallowly assigns own enumerable string-keyed properties while ignoring only `undefined`.
Unlike truthiness-based merging, it preserves `null`, empty strings, `0`, and `false`.

### Why it is reusable

Layered configuration, request-option defaults, and adapter settings commonly need later
sources to override earlier ones without allowing omitted values to erase valid settings.

### Duplication or overlap

The helper is not duplicated, but it replaces repeated inline filtering at every configuration
precedence layer. It overlaps native object spread in `src/client/client.ts`, where ordinary
spread is intentionally appropriate because `undefined` filtering is not required.

### Proposed API

```ts
export function assignDefined<T extends object>(
  target: T,
  ...sources: ReadonlyArray<Partial<T> | undefined>
): T;
```

### Generalization required

- Accept multiple sources so precedence can be expressed in one call.
- Document that the target is mutated and that only own enumerable string keys are copied.
- Add direct tests for `undefined`, `null`, `""`, `0`, `false`, arrays, and input mutation.

### Risks and limitations

- A mutating API can surprise callers; a separate immutable variant may be preferable.
- Symbol and non-enumerable properties are outside the current behavior.
- It must remain a shallow operation and must not acquire implicit deep-merge semantics.

## 2. `restoreMsysConvertedPosixPath`

**Priority:** Strong candidate  
**Current location:** `src/paths/remote-path.ts` as `restoreMsysConvertedRemotePath`

### Purpose

Restores POSIX-like arguments that Git Bash/MSYS has rewritten into Windows Git installation
paths, while leaving ordinary inputs unchanged.

### Why it is reusable

Container, cloud-storage, archive, deployment, and remote-execution CLIs often accept POSIX
paths that cross an MSYS process boundary and encounter the same unwanted argument conversion.

### Duplication or overlap

There is no duplicate helper. It has strong independent reuse value and protects both upload
destinations and download sources through configuration resolution.

### Proposed API

```ts
export interface MsysPathRestoreOptions {
  installationPrefixes?: readonly string[];
}

export function restoreMsysConvertedPosixPath(
  value: string,
  options?: MsysPathRestoreOptions
): string;
```

### Generalization required

- Remove remote-transfer terminology from the name and documentation.
- Make recognized Git/MSYS installation prefixes configurable while retaining safe defaults.
- Specify slash preservation and whether drive-letter matching is case-insensitive.

### Risks and limitations

- The heuristic can misclassify a legitimate Windows path beneath a matching installation
  directory.
- Git installations in uncommon directories require caller configuration.
- This helper should restore arguments only; it must not perform general path normalization.

## 3. `isDirectlyExecuted`

**Priority:** Strong candidate  
**Current location:** `src/cli/index.ts` as `isCliEntrypoint`

### Purpose

Determines whether an ESM module is the process entrypoint by resolving both the module URL and
the executed file to real paths. It correctly recognizes symlinked npm binaries and returns
`false` when either path cannot be resolved.

### Why it is reusable

Any Node.js ESM package that exposes both importable functions and an executable entrypoint needs
a reliable direct-execution check that works through package-manager-created symlinks.

### Duplication or overlap

The same simpler URL-versus-argv comparison appears in `scripts/build-pages.js`, but that variant
does not resolve symlinks. A shared helper would replace this behavioral overlap.

### Proposed API

```ts
export function isDirectlyExecuted(moduleUrl: string, argv?: readonly string[]): boolean;
```

### Generalization required

- Rename the helper to remove `scp-next` CLI terminology.
- Accept a readonly argv input while defaulting to `process.argv`.
- Preserve the current fail-closed behavior for missing files and invalid URLs.

### Risks and limitations

- Node.js-only: it depends on file URLs and synchronous realpath resolution.
- Filesystem access occurs during module initialization when callers use it at top level.
- Non-file module URLs must return `false`, not throw.

## 4. `redactSensitiveValues`

**Priority:** Strong candidate  
**Current location:** `src/security/redact.ts`

### Purpose

Recursively redacts sensitive object fields and private-key blocks, then removes known secret
values and recognizable secret options or assignments from text.

### Why it is reusable

CLI tools, configuration loaders, deployment systems, and structured loggers all need to
sanitize nested diagnostic context and free-form error or command output before displaying it.

### Duplication or overlap

The module already consolidates several overlapping redaction mechanisms: key matching, recursive
value transformation, private-key block removal, known-value replacement, CLI option matching,
and environment-style assignment matching. It is reused across errors, CLI output, transport
errors, and remote-command results.

### Proposed API

```ts
export interface RedactionOptions {
  replacement?: string;
  sensitiveKeys?: readonly (string | RegExp)[];
  sensitiveTextPatterns?: readonly RegExp[];
}

export function redactSensitiveValues(
  value: unknown,
  options?: RedactionOptions
): unknown;

export function redactKnownSensitiveValues(
  text: string,
  source: unknown,
  options?: RedactionOptions
): string;
```

### Generalization required

- Parameterize sensitive keys, replacement text, and text patterns.
- Separate Node-specific `Buffer` handling from universal recursive redaction.
- Define behavior for cycles, symbol keys, non-enumerable properties, dates, maps, and sets.
- Expand tests for mutation, repeated references, quoted values, empty secrets, and overlapping
  secret values.

### Risks and limitations

- This is defense in depth, not a guarantee that arbitrary output is secret-free.
- Broad key substring matching can produce false positives; narrow patterns can miss secrets.
- The current recursive implementation does not handle cyclic objects.
- Security defaults must remain conservative and versioned carefully.

## 5. `collectDualStreamOutput`

**Priority:** Possible candidate  
**Current location:** `src/client/command-executor.ts` as `collectCommandResult`

### Purpose

Collects stdout and stderr from a two-stream channel, enforces a combined byte limit and optional
timeout, normalizes a missing exit status, closes on failure, and removes listeners when settled.

### Why it is reusable

SSH clients, subprocess adapters, terminal gateways, and remote-execution libraries frequently
need bounded output collection with deterministic cleanup and partial-output error reporting.

### Duplication or overlap

There is no exact duplicate. It combines resource-lifecycle operations that otherwise tend to be
reimplemented around event emitters: settled-state guarding, timer cleanup, listener cleanup,
stream closure, byte accounting, and exit-result shaping.

### Proposed API

```ts
export interface DualOutputChannel extends NodeJS.ReadableStream {
  stderr: NodeJS.ReadableStream;
  close(): void;
}

export interface CollectDualStreamOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

export interface CollectedOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal?: string;
}

export function collectDualStreamOutput(
  channel: DualOutputChannel,
  options?: CollectDualStreamOptions
): Promise<CollectedOutput>;
```

### Generalization required

- Remove `RemoteCommandError`, command text, and `ssh2` channel types from the core collector.
- Define a generic close-event adapter or a minimal channel protocol.
- Expose typed failure details containing partial output and a failure reason.
- Specify text encoding and combined-versus-per-stream buffer accounting.

### Risks and limitations

- Node stream event ordering and close signatures vary between dependencies.
- String conversion and `Buffer.byteLength()` must not undercount split multibyte input.
- Cleanup must remain idempotent under timeout, stream error, and close races.

## 6. `normalizeSshSha256Fingerprint`

**Priority:** Possible candidate  
**Current location:** `src/security/host-verification.ts`

### Purpose

Normalizes OpenSSH-style SHA-256 fingerprints, derives hex and unpadded base64 representations,
matches case-insensitive hexadecimal forms, and constructs an allow-list verifier.

### Why it is reusable

Other SSH clients, deployment agents, and host-key inspection tools need to compare fingerprints
received in different encodings without weakening host verification.

### Duplication or overlap

Normalization is repeated before comparison and candidate generation. Hex and base64 digest
generation also appears in the host-verification tests. Mazey's public `sha256Hex` overlaps only
the asynchronous hex digest; it does not provide base64 output, OpenSSH normalization, or
matching.

### Proposed API

```ts
export interface SshSha256Fingerprints {
  hex: string;
  base64: string;
}

export function normalizeSshSha256Fingerprint(value: string): string;

export function deriveSshSha256Fingerprints(publicKey: Uint8Array): SshSha256Fingerprints;

export function createSshFingerprintMatcher(
  allowed: Iterable<string>
): (actual: string) => boolean;
```

### Generalization required

- Separate pure normalization and matching from known-hosts filesystem access.
- Use runtime-neutral byte input and isolate the Node `crypto` implementation behind an adapter.
- Specify accepted encodings strictly instead of relying on permissive base64 decoding.
- Keep host selection and `known_hosts` parsing in an SSH-specific layer.

### Risks and limitations

- Security-sensitive parsing must reject malformed or ambiguous values predictably.
- Host fingerprints are not passwords, but comparison and allow-list behavior still define a
  trust boundary.
- The current known-hosts parser supports exact plain hosts only, not hashed hosts or all OpenSSH
  marker behavior.

## 7. `formatByteSize`

**Priority:** Possible candidate  
**Current location:** `src/cli/output.ts` as `formatBytes`

### Purpose

Formats byte counts using 1024-based units and one fractional digit while preserving zero as
`0 B`.

### Why it is reusable

Transfer CLIs, backup tools, package inspectors, storage dashboards, and progress reporters need
stable byte formatting with explicitly chosen binary scaling and precision.

### Duplication or overlap

There is no local duplicate. Mazey's public `getFileSize` overlaps but is not equivalent: it
rounds upward to whole units, returns an empty string for zero or invalid values, and uses
different large-unit labels.

### Proposed API

```ts
export interface FormatByteSizeOptions {
  base?: 1000 | 1024;
  fractionDigits?: number;
  invalidValue?: string;
}

export function formatByteSize(bytes: number, options?: FormatByteSizeOptions): string;
```

### Generalization required

- Define negative, non-finite, and fractional-byte behavior.
- Decide whether 1024-based labels remain `KB`/`MB` or use `KiB`/`MiB`.
- Parameterize precision without changing the current one-decimal CLI output.

### Risks and limitations

- Unit-label conventions are product policy, not merely arithmetic.
- Rounding near unit boundaries must be specified and regression-tested.
- This may be better added as an option-compatible extension to Mazey than as a new package.

## 8. `validateLocalMarkdownLinks`

**Priority:** Possible candidate  
**Current location:** `scripts/validate-doc-links.js`

### Purpose

Discovers Markdown files, ignores fenced and inline code, extracts local links, validates
repository boundaries and target existence, and checks Markdown heading fragments.

### Why it is reusable

Documentation-heavy repositories can use the same zero-service validation in local development
and CI without requiring a full static-site build.

### Duplication or overlap

Code stripping and link extraction use overlapping transformations inside the script. There is
no production duplicate, but the complete validation pipeline has credible reuse across project
documentation tooling.

### Proposed API

```ts
export interface MarkdownLinkIssue {
  file: string;
  target?: string;
  message: string;
}

export interface MarkdownLinkValidationOptions {
  rootDirectory: string;
  files: readonly string[];
}

export function validateLocalMarkdownLinks(
  options: MarkdownLinkValidationOptions
): MarkdownLinkIssue[];
```

### Generalization required

- Separate pure Markdown target and heading parsing from filesystem traversal.
- Make repository-boundary, generated-directory, and source-file policies caller-controlled.
- Add fixtures for reference links, encoded paths, duplicate headings, Unicode, code blocks,
  images, and malformed Markdown.

### Risks and limitations

- Regex extraction is not a complete CommonMark parser.
- Heading-slug behavior varies between GitHub, documentation generators, and static-site tools.
- Symlinks can complicate repository-boundary checks based only on resolved path strings.

## Existing Dependency Matches

The installed version is `mazey@5.4.2`. None of the eight ranked candidates has an equivalent
public Mazey API. One weaker one-off transformation should use Mazey rather than become another
extracted utility:

| Current logic                  | Location                    | Existing API             | Recommendation                                                                                                                |
| ------------------------------ | --------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| IIFE global-name normalization | `scripts/rollup.config.mjs` | `toJavaScriptGlobalName` | Use the public Mazey API if this legacy build configuration remains; verify the intentional behavior change for scoped names. |

`getFileSize`, `sha256Hex`, `parseJsonSafe`, `throttle`, `waitTime`, `isNumber`, and
`isUdfOrNul` were reviewed but do not fully match the ranked helpers' behavior.

## Reviewed but Excluded

| Helper or area                                                         | Location                                                                                        | Reason                                                                                                                       |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Integer parsing                                                        | `src/config/environment.ts`, `src/cli/commands/shared.ts`                                       | Exact duplication exists around `Number.parseInt`, but the logic is too small and its error policy belongs to each caller.   |
| Positive-number validation                                             | `src/config/validation.ts`, `src/client/client.ts`                                              | Behavior overlaps for timeouts and buffer limits, but each rule has distinct ranges, integer requirements, and typed errors. |
| Configuration resolution                                               | `src/config/resolve-config.ts`                                                                  | The precedence order, profile/job selection, and path interpretation are `scp-next` policy.                                  |
| Post-upload command guards                                             | `src/config/post-upload-commands.ts`, `src/config/load-config.ts`, `src/cli/commands/shared.ts` | Behavioral overlap exists, but the rule is application-specific and the primitive checks are trivial.                        |
| Remote path wrappers                                                   | `src/paths/remote-path.ts`                                                                      | `path.posix` already provides the general operations; validation and MSYS restoration carry project policy.                  |
| Home expansion and local path resolution                               | `src/paths/local-path.ts`                                                                       | Useful but small, Node-specific, and intentionally limited to `~` rather than user-home lookup.                              |
| Progress percentage and reporter                                       | `src/client/client.ts`, `src/cli/output.ts`                                                     | Percentage math is trivial; the reporter is coupled to transfer fields, terminal wording, and CLI throttling policy.         |
| Error conversion and host-failure classification                       | `src/errors/index.ts`, `src/client/transport.ts`                                                | Keyword rules map directly to the public `scp-next` error hierarchy and fail-closed SSH behavior.                            |
| Local and remote file walking                                          | `src/client/walk.ts`                                                                            | Traversal is coupled to transfer entry types, SFTP transport behavior, and local/remote path distinctions.                   |
| Destination and overwrite resolution                                   | `src/client/client.ts`                                                                          | Some inline blocks overlap, but they encode `cp`/`scp`-style transfer semantics and typed failures.                          |
| `fileExists`, `collectValues`, package-version reading, and `_resolve` | `src/config/load-config.ts`, `src/cli/commands/shared.ts`, `src/cli/index.ts`, `scripts/*`      | One-off or one-line native wrappers lack enough independent value.                                                           |
| `MemoryStream`, temp-directory builders, and mocks                     | `tests/**`                                                                                      | Minor test duplication exists, but these fixtures are short and tied to Vitest or project interfaces.                        |
| Release helper deep import                                             | `scripts/release.js`                                                                            | It consumes an undocumented Mazey path and should not define a new general-purpose extraction.                               |

## Recommended Extraction Order

1. `assignDefined`
2. `restoreMsysConvertedPosixPath`
3. `isDirectlyExecuted`
4. `redactSensitiveValues`
5. `collectDualStreamOutput`
6. `normalizeSshSha256Fingerprint`
7. `formatByteSize`
8. `validateLocalMarkdownLinks`
