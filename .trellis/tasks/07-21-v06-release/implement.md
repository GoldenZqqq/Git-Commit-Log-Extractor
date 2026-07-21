# 执行计划

## Preparation

- [x] 确认 `main`、远程状态、当前版本和 `v0.5.3` tag。
- [x] 补齐 `CHANGELOG.md` 的 v0.6.0 条目。
- [x] 生成并润色 `release-notes/v0.6.0.md`，确认不包含内部任务噪音和敏感信息。
- [x] 运行 `npm run test:release-governance`、`npm run build`、Rust fmt/check/test、完整 Playwright。
- [x] 运行 `npm run release:win:minor -- --dry-run`，确认目标为 0.6.0 且不写文件。

## Publish

- [x] 将准备提交推送到 `main`，等待准备提交 exact-SHA CI 成功。
- [x] 再次确认 clean `main` 与 `origin/main` 对齐。
- [x] 运行 `npm run release:win:minor`；版本提交后首次 WebView smoke 瞬时失败，重跑 CI 通过后使用 `release:win:current` 完成签名构建、draft 上传和发布。

## Verify And Close

- [x] 验证 GitHub Release URL、`v0.6.0` tag、三个 Windows 资产和 latest manifest。
- [x] 记录发布 SHA、tag、Release URL、资产 URL 和未完成的 macOS universal 资产风险。
- [ ] 更新任务验收并归档，记录发布会话日志。

## Rollback Points

- Release Notes 或版本 dry-run 不符合 0.6.0：停止，不执行正式脚本。
- 签名、GitHub 权限、CI 或构建失败：保留日志，禁止手工补 tag/资产。
- draft 事务失败：确认脚本清理结果后再决定是否重试；不得删除历史 Release。
