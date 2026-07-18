---
name: gitpulse-release-publisher
description: Project-specific GitPulse release workflow for preparing Chinese release notes from Git history, validating version/tag state, and publishing a new desktop release with GitHub assets. Use when the user asks to publish a new GitPulse version, generate or polish release notes, create/update a GitHub Release, upload release assets, or run the repository's end-to-end release process.
---

# GitPulse Release Publisher

Use this skill for GitPulse release work inside `C:\Learn\git_pulse`.

## Workflow

1. Read the current release entry points before acting:
   - `package.json`
   - `README.md`
   - `scripts/generate-release-notes.mjs`
   - `scripts/publish-release.mjs`
   - `scripts/github-release.mjs`
   - `.release.env.example`

2. Decide the release mode from the user request:
   - Default to `patch` when the user says `发布新版本` but does not specify a mode.
   - Use `minor` / `major` / `set` only when the user explicitly asks.
   - Use `current` only to resume a version commit that was pushed but never received its tag; published Windows assets are immutable.

3. Refuse to start the build from an ungoverned source:
   - Require a clean `main` exactly aligned with `origin/main`.
   - If there are source changes meant to ship, commit them first.
   - Prefer the `$git-commit-generator` skill when the user wants Codex to handle the commit.
   - Do not let version-bump commits swallow unrelated feature work.

4. Generate the release notes draft before publishing:
   - Run `node ./scripts/generate-release-notes.mjs <mode>` or the matching `npm run release:notes:*` command.
   - Review `release-notes/vX.Y.Z.md`.
   - Rewrite the draft into a concise Chinese GitHub Release body before the publish step if it still reads like a raw commit dump.

5. Publish through the repository scripts instead of hand-rolling Git commands:
   - Use `npm run release:win[:mode]` for normal releases.
   - Use `npm run release:win:set -- X.Y.Z` for explicit versions.
   - The publish script handles version sync, pushes the version commit, waits for successful main CI, builds/signs assets, stages a draft Release, and publishes only after all Windows assets upload.

6. Verify the result after publishing:
   - Confirm the script output includes the target version and GitHub Release URL when GitHub publishing is enabled.
   - Confirm the release page contains `.exe`, `.exe.sig`, and `gitpulse-latest.json`.
   - Report back with the version, tag, release URL, and any verification you could not complete.

## Release Notes Rules

Load `references/release-workflow.md` when you need the detailed release note structure, commit filtering rules, or command mapping.

## Guardrails

- Keep secrets in `.release.env.local` or environment variables, never in committed files.
- Treat `release-notes/` as local working output unless the user explicitly asks to version it.
- Stop and surface the issue if the worktree is dirty in a way that the release script would reject.
- Do not delete or rewrite existing tags/releases unless the user explicitly asks for that cleanup.
