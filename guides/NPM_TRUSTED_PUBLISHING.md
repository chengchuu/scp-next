# Publish automatically to npm with GitHub Actions OIDC

Migrate `scp-next` from `NPM_TOKEN` to npm trusted publishing while preserving automatic
publication on pushes to `release/v*` branches. This guide assumes the package already
exists and you have configured its trusted publisher. It describes changes to make; it
does not mean the repository's workflow has already been migrated.

OpenID Connect (OIDC) lets GitHub issue a short-lived, signed workflow identity that npm
checks before authorizing publication. You do not store a permanent npm publishing token
in the repository. See [GitHub's OIDC explanation](https://docs.github.com/en/actions/concepts/security/openid-connect).

## 1. Verify the trusted publisher

Sign in to npm as `mazeyqian` and open the existing `scp-next` package's settings. Confirm
that the GitHub Actions trusted publisher has these values:

| Field                | Value             |
| :------------------- | :---------------- |
| Organization or user | `chengchuu`       |
| Repository           | `scp-next`        |
| Workflow filename    | `publish-npm.yml` |
| Allowed action       | Direct publishing |

Enable **Allow npm publish**; staging-only permission requires human approval. Enter the
workflow filename, not `.github/workflows/publish-npm.yml`. If you configured an environment,
record its exact name for step 3. See [npm's trusted-publisher configuration](https://docs.npmjs.com/trusted-publishers/).

The GitHub owner and npm account do not need matching usernames. `mazeyqian` manages the
npm package; `chengchuu` identifies the GitHub repository owner. Keep the npm package name
as `scp-next`.

## 2. Preserve the existing triggers and toolchain

Open [the publishing workflow](../.github/workflows/publish-npm.yml). Keep:

- Push publication from `release/v*` branches.
- PR validation for `main` and `release/v*` without publication.
- `needs: test` and the publish job's `github.event_name == 'push'` condition.
- The current test-only behavior of `workflow_dispatch`.
- GitHub-hosted `ubuntu-latest` runners, Node 22, npm 11.18.0, and `npm install`.
- The npm registry URL `https://registry.npmjs.org/` in the publish job's Node setup.

OIDC requires Node 22.14.0 or later and npm 11.5.1 or later, so this CI toolchain qualifies.
See [npm's requirements](https://docs.npmjs.com/trusted-publishers/).

Do not upgrade to npm 12 as part of the authentication migration. Its install-time defaults
change dependency-script, native-build, Git-dependency, and remote-URL behavior; assess those
separately. See [the npm security announcement](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/).

Keep `pnpm-lock.yaml` as the committed lockfile. CI intentionally uses `npm install`, which
does not consume that lockfile; OIDC does not make dependency resolution reproducible.

## 3. Scope permissions to the publishing job

Replace the workflow-level write permissions with:

```yaml
permissions:
  contents: read
```

Add this block directly under `jobs.publish`, alongside `needs`, `runs-on`, and `if`:

```yaml
permissions:
  contents: write
  packages: write
  id-token: write
```

These permissions have separate purposes:

- `id-token: write` enables npm OIDC authentication.
- `packages: write` preserves GitHub Packages publication.
- `contents: write` preserves the existing Git-tag creation and push.

The test job inherits read-only permissions. Do not grant it publishing permissions.
See [npm's workflow configuration](https://docs.npmjs.com/trusted-publishers/).

If step 1 identified an environment, add that exact `environment` name to the publish job.
Leave it unset otherwise. Required reviewers would prevent unattended publication.

## 4. Replace only the npm authentication step

Replace the current **Publish to npm** step with:

```yaml
- name: Publish to npm
  run: npm publish --access public
```

Remove its `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` entry. Check that no job-level or
workflow-level npm write token remains. npm detects OIDC automatically; do not add an npm
login step or manually request the identity token. See [npm's authentication behavior](https://docs.npmjs.com/trusted-publishers/).

Keep the GitHub Packages registry setup, scoped package-name change, and
`NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` on its publication step. That registry still
uses GitHub authentication. Keep the restore step and post-publication Git tag.
See [GitHub Packages authentication](https://docs.github.com/en/actions/tutorials/publish-packages/publish-nodejs-packages#authenticating-to-the-destination-repository).

[The Pages workflow](../.github/workflows/pages.yml) needs no npm-authentication changes.
Its OIDC permission serves Pages deployment. Do not remove that permission.

## 5. Review release safety before the first push

Protect `release/v*` branches and publishing-workflow changes. Anyone who can run altered
code in the trusted publishing job may be able to publish; OIDC does not establish that
the code is safe.

Consider these separate reliability improvements before enabling unattended releases:

- Serialize publishing jobs with a package-wide concurrency group, not one group per branch.
  Do not cancel a publication already running. GitHub's default concurrency behavior replaces
  an older pending run; use `queue: max` if you need multiple pending releases, and account
  for queue limits and ordering. See [GitHub concurrency controls](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
- Define whether an already-published version should stop the run or be skipped after verifying
  the expected artifact. Do not treat every registry error as an absent version.
- Make recovery from partial npm/GitHub Packages publication explicit. Separating registry jobs
  is an option, but not a prerequisite for OIDC.
- Check existing Git tags against the intended commit; never overwrite a conflicting release tag.

The existing workflow does not provide these safeguards. A minimal OIDC migration preserves
that limitation; decide on hardening separately rather than assuming authentication fixes it.

## 6. Validate the proposed workflow and release

Review the YAML diff before merging. Confirm that only the intended npm authentication and
permission settings changed, and that the snippets were inserted at the correct indentation.
Use a GitHub Actions-aware validator if one is available.

From the repository root, run the established package checks:

```bash
npm run clean
npm run typecheck
npm run lint
npm test
npm run build
npm run docs:links
npm pack --dry-run
git diff --check
```

Inspect the package contents for the ESM/CJS builds, declarations, CLI entry, README, license,
and guides. Preserve the existing `prepublishOnly` checks; do not disable lifecycle scripts
to bypass release validation. These checks are instructions for migration, not results
reported by this document.

Prepare an intentional release with an unpublished `package.json.version` and update
[the changelog](CHANGELOG.md). Check the published versions without publishing:

```bash
npm view scp-next versions --json --registry=https://registry.npmjs.org/
```

If the registry lookup fails, resolve the failure before deciding that the version is unused.
Also check the corresponding GitHub Packages version and Git tag. Branch pushes do not bump
versions automatically.

## 7. Push the release and verify publication

**Warning:** pushing the migrated workflow and release to a matching `release/v*` branch
can publish a real package version. PR checks and manual workflow runs do not prove that
OIDC publication works.

1. Commit the approved workflow and release changes.
2. Push the intended release commit to the matching release branch.
3. Open the **Publish npm Packages** run in GitHub Actions.
4. Confirm that validation and the npm publication step succeed without `NPM_TOKEN`.
5. Verify the exact version on npm, then verify GitHub Packages and the Git tag independently.
6. Check the npm provenance information when publishing a public package from the public repository.

Trusted publishing generates provenance automatically when its conditions are met; an explicit
`--provenance` flag is not required. See [npm provenance documentation](https://docs.npmjs.com/generating-provenance-statements/).

Local checks and dry runs cannot verify registry authorization. Do not use `npm whoami`
as an OIDC publishing test. See [npm's OIDC limitations](https://docs.npmjs.com/trusted-publishers/).

## 8. Remove obsolete credentials after verification

After a successful token-free npm publication:

1. Remove the unused `NPM_TOKEN` secret from this repository's Actions secrets.
2. Check whether other repositories or tools still use the same token.
3. Revoke the npm token only after those consumers have migrated or stopped using it.

Keep `GITHUB_TOKEN` authentication for GitHub Packages. Repeat the package-specific trust
setup and workflow review for other npm repositories; this migration does not authorize them.

## Troubleshoot or pause the rollout

- **Authentication fails:** verify the exact owner, repository, workflow filename, environment,
  direct-publish permission, job-level OIDC permission, and toolchain. Confirm that the
  package repository URL still identifies `chengchuu/scp-next`.
- **npm succeeds but GitHub Packages fails:** record the published version and run commit.
  Do not blindly rerun the combined publish job. Arrange a reviewed recovery that publishes
  only the missing artifact and creates the tag after verifying the release commit.
- **A version or tag already exists:** inspect its contents or commit before deciding how to
  recover. Do not overwrite it or hide the failure.
- **You need to stop publishing:** pause the publishing workflow or block release-branch pushes
  while investigating. Reverting YAML does not undo a published package.

Treat a published version as immutable. For an incorrect release, plan a corrected version
and, if appropriate, deprecate the affected version; do not make unpublishing part of routine
rollback. See [npm's unpublish policy](https://docs.npmjs.com/policies/unpublish/).
