# Host verification troubleshooting plan

Status: Proposed. Implementation requires user confirmation. Creating this plan does not
authorize changes to runtime code, SSH trust files, or server connections.

## Goal

Replace generic SSH troubleshooting tips with concise guidance to scan, verify, and save
host keys. Show the configured endpoint and trust file, and distinguish missing trust
information from a possible key mismatch when the failure path provides that evidence.

## Current limitations

- `hostVerificationTroubleshooting()` in `src/client/transport.ts` suggests `ssh <host>`
  without the configured port or known-hosts path.
- `hostVerificationHint()` in `src/security/host-verification.ts` separately handles an
  empty set of matching fingerprints. Changing only the transport tip leaves this hint
  unchanged.
- Missing or unreadable known-hosts files follow another error path before connection.
- The current parser matches plain host entries, but not hashed hostnames or OpenSSH
  marker entries. Ordinary SSH can succeed with entries that this parser cannot use.
- Some transport errors are classified by message text. They do not prove a key mismatch.
- Explicit `hostFingerprint` values and matching known-hosts keys are combined into the
  allowed set. Adding a key can permit a connection while a stale configured fingerprint
  remains present.

## Options and recommendation

1. Keep interactive SSH guidance and include the actual port. This is concise, but SSH
   configuration and hashed entries can still produce different results from `scp-next`.
2. Suggest scanning directly into the trusted file. This is short, but trusts the scan
   before independent verification and can leave obsolete keys trusted.
3. Guide users through scanning, independent verification, and deliberate saving.
   Recommend this option, with a compact error tip linked to a detailed troubleshooting guide.

`ssh-keyscan` collects public keys without authenticating them. An attacker who intercepts
the scan can substitute keys. Verify fingerprints through an independent trusted source
before adding keys to a trust file. See the [OpenSSH manual](https://man.openbsd.org/ssh-keyscan).

## Proposed user procedure

1. **Identify the endpoint and trust settings.** Use the exact configured host, port
   (default `22`), and `knownHostsFile` (default `~/.ssh/known_hosts`). Keep hostname and
   IP-address usage consistent with the transfer. Check any explicit `hostFingerprint`.
2. **Scan into a temporary file.** Use `ssh-keyscan` with the configured port and plain
   host entries, without `-H`. Do not append directly to the trusted file. Stop if the
   scan fails or returns no keys.
3. **Inspect fingerprints.** Display SHA-256 fingerprints using `ssh-keygen`. A server
   can return multiple key types; identify every key that will be trusted.
4. **Verify independently.** Compare fingerprints with values from a trusted server
   console, administrator, or authenticated provider interface. Repeating the scan over
   the same connection does not provide independent verification.
5. **Save verified keys.** For a missing entry, add only verified keys to the configured
   file. Create the parent directory with appropriate permissions if needed. For a changed
   key, confirm an authorized rotation, rebuild, or address change first. Back up the file
   and replace only the affected obsolete entries, preserving unrelated hosts and aliases.
   Review and update a stale explicit fingerprint only after verification.
6. **Retry the original transfer.** If verification still fails, check the endpoint,
   trust file, fingerprint, and key type. Do not repeatedly append scanned keys. Remove
   temporary scan files when troubleshooting is complete.

## Proposed implementation scope

- Apply consistent wording to the transport tip and the preconnection verification errors.
- Include the resolved host, effective port, and selected known-hosts path in the guidance.
- Use neutral wording such as "The host key could not be verified" when the cause is
  uncertain. Identify missing entries or inaccessible files only when known.
- Explain that a changed trusted key requires investigation before updating trust.
- Keep the error concise; put detailed steps in a maintained troubleshooting guide.
- If displaying commands, label the shell and escape arguments correctly. Double quotes
  alone are insufficient for arbitrary configured values. Use placeholders when a value
  cannot be safely rendered, including values containing control characters.
- Document POSIX shell and PowerShell differences where commands are provided.
- Keep scanning and trust-file updates as explicit user actions. The library must not
  execute local shell commands, modify trust files, or disable host verification.
- Preserve existing public APIs, typed errors, fingerprint matching, and transfer behavior.
  Parser enhancements or changes to fingerprint precedence require a separate decision.
- Update README and website troubleshooting references, and architecture notes if a shared
  internal hint helper is introduced.

## Risks and mitigations

- **Unverified keys:** require independent verification before saving each accepted key.
- **Wrong endpoint or file:** derive guidance from the actual connection configuration.
- **Obsolete trust:** distinguish verified replacement from adding a first entry.
- **Unsupported entries:** explain the current hashed-hostname and marker limitations.
- **Unsafe copied commands:** validate command rendering with special characters and
  explicit shell assumptions; never execute generated commands automatically.
- **Overstated diagnosis:** avoid asserting a mismatch based only on an error-message heuristic.

## Validation and acceptance criteria

After implementation approval, add focused tests for default and custom ports, custom trust
files, missing or unreadable files, empty matching-key sets, and connection-time verification
failures. Cover explicit fingerprints, unsafe display values, and consistent guidance across
both error locations. Use mocks and temporary fixtures; no production SSH server is required.

Verify that diagnostics require independent verification, do not advise unconditional trust,
and perform no scanning or trust-file writes. Confirm that existing verification decisions
and typed errors remain intact.

Run the repository's typecheck, lint, tests, package build, and documentation checks after
implementation. If website source changes, run `npm run docs` to validate the final Pages
artifact. Inspect the final diff and package contents before handoff.

The package currently includes all of `guides` in its published files. This plan will therefore
be included in a future package unless its location or packaging policy is deliberately changed.
