# v0.6 发布准备审查

## Conclusion

v0.6 应定位为稳定性、可维护性和支持能力版本，不应在发布前临时加入“定时自动生成”“企业交付集成”或“团队配置协作”等尚未达到产品验证门槛的新功能。当前应用测试基线健康，但发布材料和真实升级验证仍有阻断项。

## Release Blockers

1. **补齐 CHANGELOG / Release Notes**：`CHANGELOG.md` 的 `Unreleased` 仍写“尚无未发布变更”，而 `v0.5.3..main` 已有 40 个提交。至少应覆盖发布治理、升级恢复、大工作区性能、隐私安全支持包、前后端模块拆分及产品反馈入口。
2. **明确目标版本为 0.6.0**：当前 `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` 均为 0.5.3。发布时必须使用 minor 流程，不能使用默认 patch 流程生成 0.5.4。
3. **推送主线并等待 exact-SHA CI**：发布脚本只接受 clean、最新且 `HEAD === origin/main` 的 `main`。本次 Trellis 提交在推送并通过该 SHA 的 CI 前不能作为发布源。
4. **执行真实升级冒烟**：用已安装的 v0.5.3 创建设置、凭据引用和报告历史，再安装签名的 v0.6.0 包，确认设置迁移、Secure Store、历史恢复、报告生成/导出和更新器行为正常。现有单元/E2E 覆盖迁移逻辑，但不能完全替代安装包升级路径。
5. **核对发布凭据和完整资产**：确认 Tauri signing key/password、GitHub token 权限和仓库目标正确；Windows `.exe`、`.exe.sig`、`gitpulse-latest.json` 必须在 draft 中全部上传后再发布，macOS/Linux workflow 必须通过 tag 祖先与 exact-SHA CI 校验。

## Required Command Choice

- `npm run verify:release` 当前最后一步固定调用默认 patch dry-run，只会规划 0.5.4，不能单独证明 v0.6.0 目标正确。
- 发布前应额外运行 `npm run release:win:minor -- --dry-run`，正式发布使用 `npm run release:win:minor`。
- 如需锁定显式版本，可使用 `npm run release:win:set -- 0.6.0`，但不要与 minor 流程混用。

## Recommended Before Release

- 清理 `src-tauri/src/bin/workspace_benchmark/metrics.rs` 的既存未使用 `std::fs` warning，让 release build 输出保持干净；它不是功能阻断项。
- 处理 GitHub Actions `actions/checkout@v4` / `actions/setup-node@v4` 的 Node 20 弃用提示，但应作为独立 CI 维护提交验证，不应与版本提交混在一起。
- Release Notes 用用户价值表达：升级更稳、大仓库更快、支持包可脱敏导出、模块边界更清晰；模块拆分本身不应包装成用户功能。
- 在 README / Issue chooser 中保留结构化产品反馈入口，并说明 local-first、无默认遥测和支持包不会自动上传。

## Non-Blocking Follow-Ups

- `commit_pipeline.rs`、`models.rs`、`reportFormat.ts` 等剩余超 600 行文件应独立重构，不能在发布前仓促扩大改动面。
- 三条候选产品主线继续遵守至少 5 份结构化反馈、同向高频痛点和 `7/10` 评分门槛。

## Local Verification Evidence

- Trellis 0.6.7 二次 dry-run：无待更新模板，无 `.new` 冲突。
- Frontend production build：通过。
- Release governance：12/12 通过。
- Rust：`cargo fmt -- --check`、`cargo check` 通过；测试 149 项通过。
- Playwright：77/77 通过。
- `git diff --check`：通过。
