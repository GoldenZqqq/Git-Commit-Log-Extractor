# GitPulse Release Workflow

## Trigger Phrases

Use this skill when the user says things like:

- “发布新版本”
- “发版并发 GitHub Release”
- “整理这次更新内容然后发布”
- “生成 release notes 并上传安装包”

## Command Mapping

- `patch`: `npm run release:notes:patch` then `npm run release:win:patch`
- `minor`: `npm run release:notes:minor` then `npm run release:win:minor`
- `major`: `npm run release:notes:major` then `npm run release:win:major`
- `set`: `npm run release:notes:set -- X.Y.Z` then `npm run release:win:set -- X.Y.Z`
- `current`: `npm run release:notes:current` then `npm run release:win:current` only to resume a pushed version whose tag is still absent

If the repository's latest tag belongs to an older product line, run `node ./scripts/generate-release-notes.mjs <mode> --from-tag <ref>` to narrow the compare range before publishing.

## Release Notes Structure

Prefer a short Chinese GitHub Release body with these sections:

1. `本次亮点`
2. `主要改进`
3. `修复内容`
4. `安装与更新`

If a section has no meaningful content, omit it instead of padding.

## Writing Rules

- Lead with user-facing value instead of raw engineering detail.
- Compress repetitive commits into a single bullet when they describe one theme.
- Mention UI, workflow, release automation, updater, or model/config improvements when they are user-visible.
- Keep the tone concise and product-like; avoid dumping every commit verbatim.
- Call out breaking changes only when there is actual migration or behavior change.

## Commit Filtering

Usually exclude these from the polished release body unless they matter to users:

- `chore: 发布 vX.Y.Z`
- pure version bump commits
- merge commits with no user-facing value
- lockfile-only churn

## Verification Checklist

- the checkout is a clean `main` exactly aligned with `origin/main`
- `npm run test:release-governance` passes
- `release-notes/vX.Y.Z.md` exists and matches the target version
- the version commit has a successful `CI` main push run before packaging starts
- publish output shows the final version and, when enabled, the GitHub Release URL
- GitHub Release assets include `.exe`, `.exe.sig`, and `gitpulse-latest.json`
