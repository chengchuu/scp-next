# Troubleshoot SSH host verification

Use this procedure when `scp-next` reports `HostVerificationError`. It applies to SFTP
transfers and explicit remote-command connections. Troubleshooting never requires disabling
verification.

## 1. Check the endpoint and trust settings

Read the host, port, selected known-hosts file, and explicit-fingerprint status in the error.
The default port is `22`; the default trust file is `~/.ssh/known_hosts`. `~` expands to the
current user's home directory. A custom `knownHostsFile` must be accessible even when an
explicit `hostFingerprint` is configured. An inaccessible default file can be skipped when
an explicit fingerprint is configured.

- **File not found:** check the selected path and the account running the process.
- **File could not be read:** check permissions and whether the path is a readable file.
- **No usable matching keys:** the file was read, but supplied no supported matching entries.
- **Connection-time failure:** the host key could not be verified. This message alone does
  not establish that a previously trusted key changed.

Use the same hostname or IP address as the transfer, not an SSH configuration alias that
resolves to another endpoint. `scp-next` supports exact plain host entries and bracketed
`[host]:port` entries. It does not interpret hashed hostnames, wildcard patterns, or OpenSSH
marker entries such as `@cert-authority` and `@revoked`. Ordinary `ssh` can therefore succeed
with a trust file that `scp-next` cannot use. Use a verified explicit fingerprint or a
separate plain-entry trust file if those limitations apply. Plain entries expose hostnames
to anyone who can read the file; keep access appropriately restricted.

Do not convert a revoked key into a plain trusted entry or use a fingerprint to bypass
revocation. If you rely on OpenSSH certificate or revocation policy, resolve the unsupported
policy with your administrator before using `scp-next`; its parser does not enforce that policy.

## 2. Scan into a temporary file and inspect fingerprints

Install OpenSSH's `ssh-keyscan` and `ssh-keygen` commands first. Replace `your-host` and
`2222` below with the configured hostname or single IP address and port. Do not use a CIDR
range, an option, or a comma-separated host list. These commands contact the server but do
not add anything to your trusted file. Do not use `-H`, which hashes hostnames.

> Warning: scanning does not authenticate the server. An intercepted scan can return an
> attacker's keys. Do not trust any result until you complete the independent verification
> in the next section. See the [OpenSSH ssh-keyscan manual](https://man.openbsd.org/ssh-keyscan).

### POSIX shell (macOS or Linux)

Run in a dedicated shell session or script; failure branches exit that session.

```sh
server_host='your-host'
server_port='2222'
scan_file=$(mktemp) || exit 1

if ! ssh-keyscan -p "$server_port" "$server_host" > "$scan_file"; then
  echo 'Scan failed; do not update trust.' >&2
  rm -- "$scan_file"
  exit 1
fi
if ! awk 'NF >= 3 && $1 !~ /^#/ { found=1 } END { exit !found }' "$scan_file"; then
  echo 'No host keys returned; do not update trust.' >&2
  rm -- "$scan_file"
  exit 1
fi
if ! ssh-keygen -l -E sha256 -f "$scan_file"; then
  echo 'Fingerprint inspection failed; do not update trust.' >&2
  rm -- "$scan_file"
  exit 1
fi
printf 'Temporary scan file: %s\n' "$scan_file"
```

### PowerShell (Windows)

Explicit UTF-8 encoding avoids Windows PowerShell's default UTF-16 file output.

```powershell
$serverHost = 'your-host'
$serverPort = '2222'
$scanFile = [System.IO.Path]::GetTempFileName()
try {
    $scanLines = @(& ssh-keyscan -p "$serverPort" "$serverHost")
    if (-not $? -or $LASTEXITCODE -ne 0) { throw 'Scan failed; do not update trust.' }
    $keyLines = @($scanLines | Where-Object {
        $_ -notmatch '^#' -and $_ -match '^\S+\s+\S+\s+\S+'
    })
    if ($keyLines.Count -eq 0) { throw 'No host keys returned; do not update trust.' }
    [System.IO.File]::WriteAllLines(
        $scanFile, [string[]]$scanLines, [System.Text.UTF8Encoding]::new($false)
    )
    & ssh-keygen -l -E sha256 -f "$scanFile"
    if (-not $? -or $LASTEXITCODE -ne 0) { throw 'Fingerprint inspection failed; do not update trust.' }
    Write-Output "Temporary scan file: $scanFile"
} catch {
    Remove-Item -LiteralPath $scanFile
    throw
}
```

`ssh-keygen -l -E sha256` displays SHA-256 fingerprints for inspection. See the
[OpenSSH ssh-keygen manual](https://man.openbsd.org/ssh-keygen). A scan may return multiple
key types or only some of the server's keys; do not assume every key was collected.

## 3. Verify each key independently

Compare the fingerprint and key type of every key you intend to trust with values from a
trusted server console, administrator, or authenticated provider interface. Repeating the
scan over the same connection is not independent verification. If no trusted source is
available, stop and contact the administrator.

If a previously trusted key differs, investigate before changing trust. Confirm an authorized
key rotation, server rebuild, or endpoint change through the independent source. Do not
assume that a changed key is harmless.

## 4. Save only verified keys

Review the temporary file in a text editor. Copy only independently verified key lines to
the exact `knownHostsFile` selected by your configuration. Do not append the entire scan
automatically. Create the parent directory if necessary and restrict write access to trusted
accounts. Preserve plain host fields, key types, and base64 keys; save the file as UTF-8.

For an authorized replacement, back up the existing file first. Remove only the affected
obsolete keys, preserving unrelated hosts and aliases. A line can contain several
comma-separated aliases; split it if necessary rather than deleting trust for other hosts.
Do not leave obsolete keys trusted merely because adding a new key makes the connection work.

Alternatively, configure `hostFingerprint` with a verified `SHA256:...` value. Explicit
fingerprints and matching known-hosts keys form a combined allowed set; the fingerprint does
not override the file. Adding a verified file entry does not remove a stale explicit
fingerprint. Review and update both sources after an authorized rotation.

## 5. Retry and clean up

Retry the original transfer. If it still fails, recheck the endpoint, account, selected file,
explicit fingerprint, and negotiated key type. Do not repeatedly append scan results.
Remove the temporary file after troubleshooting:

```sh
# POSIX shell
rm -- "$scan_file"
```

```powershell
# PowerShell
Remove-Item -LiteralPath $scanFile
```

`scp-next` does not run these commands, scan hosts, or write trust files for you.
