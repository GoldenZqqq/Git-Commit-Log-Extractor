# 发布 GitPulse v0.6.0

## Goal

在 `main` 上完成 GitPulse v0.6.0 的发布准备与正式发布：补齐面向用户的中文 Release Notes，验证版本、构建、签名、CI 和更新器约束，并通过仓库发布脚本创建完整 GitHub Release。

## Background

- 当前版本为 0.5.3，最新产品标签为 `v0.5.3`。
- `main` 含 3 个尚未推送的 Trellis/任务收口提交，发布前必须先推送并验证 exact-SHA CI。
- 用户明确授权创建发布任务，并要求准备完成后直接走发布流程。
- `.release.env.local` 存在；凭据只能由发布脚本读取，不得写入任务、Release Notes 或提交。

## Requirements

- R1：目标版本固定为 `0.6.0`，使用 minor 发布流程，不生成 `0.5.4`。
- R2：`CHANGELOG.md` 增加 v0.6.0 面向用户的中文变更摘要；`release-notes/v0.6.0.md` 作为本地发布正文，不纳入 Git，除非发布脚本要求。
- R3：发布前工作区必须为 clean `main` 且 `HEAD === origin/main`；版本提交必须等待该 SHA 的主线 CI 成功。
- R4：发布前运行发布治理、前端构建、Rust fmt/check/test、完整 Playwright 和 minor dry-run；失败即停止发布。
- R5：正式流程使用 `npm run release:win:minor`；若版本提交已推送但 CI/发布中断，只能使用 `npm run release:win:current` 恢复，不得手工创建/移动 tag 或绕过 draft Release 事务。
- R6：发布成功后验证 GitHub Release URL、`v0.6.0` tag、Windows `.exe`、`.exe.sig` 和 `gitpulse-latest.json`，并确认 latest manifest 版本为 0.6.0。
- R7：不泄露签名密钥、密码或 GitHub token；不删除/重写已有 tag 或 Release。

## Acceptance Criteria

- [x] AC1：`CHANGELOG.md` 和本地 `release-notes/v0.6.0.md` 已审阅，内容包含亮点、主要改进、修复和安装更新说明。
- [x] AC2：发布前所有质量门禁通过，且 `main` 与 `origin/main` exact-SHA 对齐；版本提交 `e951545` 的 CI 在重跑后通过。
- [x] AC3：发布脚本完成版本同步、版本提交、CI 等待、签名构建和 draft 资产上传；首次 CI smoke 瞬时失败后按治理流程使用 `current` 恢复。
- [x] AC4：GitHub Release `v0.6.0` 正式发布，包含 `.exe`、`.exe.sig`、`gitpulse-latest.json`，并追加 Linux AppImage。
- [x] AC5：发布后远程 tag、Release 资产和 latest manifest 可读取且版本一致；tag 指向 `e9515453c8a85e365a5d8ed9dd3db907c0c75cc5`。
- [x] AC6：任务、发布结果、无法验证的项目和后续风险均已记录；macOS universal 因 benchmark 辅助 binary bundle 问题未上传，已写入 release governance spec 作为后续修复项。

## Out Of Scope

- 不新增未经产品验证的功能。
- 不修改已有版本 tag 或 Release，不删除历史资产。
- 不把本地 Release Notes 草稿、签名材料或环境变量提交到仓库。
