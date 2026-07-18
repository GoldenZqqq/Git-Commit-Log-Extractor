# 将 v0.5.3 发布分支收口到 main

## Goal

将已经发布 v0.5.2/v0.5.3 的 `codex/roadmap-completion` 分支完整合并回默认分支 `main`，保留发布提交的可追溯祖先关系，并用 PR CI 建立可信主线基线。

## Requirements

- R1：以真实 merge 合并 `origin/codex/roadmap-completion`，不得用 squash/cherry-pick 丢失 v0.5.2/v0.5.3 tag 祖先关系。
- R2：保留发布分支全部产品代码、测试、规格与已归档路线任务。
- R3：解决双方对批量报告、空白日补写、报告日历归档文件的冲突，保留最新验收勾选、验证证据和 `completed` 状态。
- R4：保留当前父/子路线任务树，不得被旧分支任务状态覆盖。
- R5：通过 PR 在合并前运行合并结果的完整 CI；CI 失败必须修复后再进入 `main`。
- R6：合并后 `package.json`、Tauri 与 Cargo 版本保持 v0.5.3 一致，`v0.5.3` 必须是 `main` 祖先。
- R7：本任务只做主线收口和冲突修复，不夹带新的产品功能。

## Acceptance Criteria

- [x] AC1：`git merge-base --is-ancestor v0.5.3 main` 返回 0。
- [x] AC2：`main...origin/codex/roadmap-completion` 不再存在发布分支独有的产品提交。
- [x] AC3：3 个旧任务归档状态完整，当前 v0.6 路线任务树仍存在且父子关系正确。
- [x] AC4：PR CI 的前端 smoke、全量 E2E、a11y、responsive、build、Rust check/test 和 Windows Tauri smoke 全部通过。
- [x] AC5：合并提交进入 `origin/main`，工作区干净且本地 `main` 与远端一致。

## Verification Evidence

- PR：[#2](https://github.com/GoldenZqqq/GitPulse/pull/2)，merge commit `01464aa0a49f6080fa07cecdd6307d9fd94274aa`。
- PR CI：run `29644045302`，Linux、Windows 与真实 WebView2 smoke 全部成功。
- 主线 CI：run `29644275503`，Linux、Windows 与真实 WebView2 smoke 全部成功。
- 本地：`npm run build` 成功，`npm run test:e2e` 为 `66 passed`，`git diff --check` 成功。
- Git：`v0.5.3` 是 `main` 祖先；`main...origin/codex/roadmap-completion` 为 `8 0`；本地 `main` 与 `origin/main` 一致。
- 规格：WebView2 Runtime 与桌面 Edge 版本可能不同的 CI 约束已记录到 `desktop-quality-gates.md`。

## Out of Scope

- 修改 v0.5.3 已发布功能的产品需求。
- 在本任务中重写发布脚本或更新官网文案。
