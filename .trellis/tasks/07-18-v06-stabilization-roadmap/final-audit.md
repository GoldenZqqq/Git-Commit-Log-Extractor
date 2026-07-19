# v0.6 稳定化路线最终审计

## Conclusion

8 个子任务已按依赖顺序完成并归档，父路线为 `8/8 done`。v0.5.3 已回到 `main`，发布、升级恢复、规模基准、隐私支持、模块边界和产品验证均形成可执行契约。产品方向没有在证据不足时强行选择，当前明确进入“继续验证”。

## Child Delivery Evidence

| 子任务 | 最终交付提交 | exact-SHA CI | 结论 |
| --- | --- | ---: | --- |
| 主线收口 | `01464aa0` | `29644275503` | success |
| 发布治理 | `cef9a30e` | `29645493092` | success |
| 升级迁移 | `3b933a32` | `29646920080` | success |
| 大型工作区基准 | `f6538e25` | `29651022507` | success |
| 隐私安全支持包 | `1b15d6b6` | `29673332920` | success |
| 前端模块拆分 | `c6a74ee2` | `29679387865` | success |
| Rust 模块拆分 | `b9866ab5` | `29691242678` | success |
| 产品方向验证 | `f058b31f` | `29692623445` | success |

审计脚本逐项确认提交是 `origin/main` 祖先，CI `headSha` 精确匹配提交，run 状态为 `completed/success`。

## Acceptance Mapping

- **AC1/AC2**：8 个 `task.json` 均为 `completed`；8 个归档提交存在，功能提交和 exact-SHA CI 映射见上表。
- **AC3**：`git merge-base --is-ancestor v0.5.3 origin/main` 返回 0；发布脚本和 tag workflow 受 `.trellis/spec/tauri-rust/release-governance.md` 约束。
- **AC4**：升级恢复、32 MiB 历史边界、三个 synthetic benchmark profile、Support Bundle 脱敏矩阵和真实 Windows WebView smoke 均有测试/规格证据。
- **AC5**：拆分目标当前行数为 `App.tsx` 600、`Workbench.tsx` 191、`SettingsDialog.tsx` 303、`model.ts` 9、`report.rs` 20、`git_ops.rs` 21；新增 report/git_ops 核心文件最大 546 行。`commit_pipeline.rs` 等其他超限模块在 Rust 子任务中明确列为非目标，后续必须独立治理，不能借此扩大已完成任务范围。
- **AC6**：`docs/product-validation-plan.md` 记录三条候选方向、反证、非目标、评分和 `7/10` 门槛；当前决策为继续验证，至少收集 5 份结构化反馈后复评。
- **AC7**：本地 build、串行 E2E `77/77`、Release governance `12/12`、YAML/链接和 diff check 已通过；功能提交 `f058b31f` 的 CI `29692623445` 已通过 Linux/Windows frontend、Rust、diff check 和真实 Windows WebView smoke。父任务审计提交仍需通过自己的 exact-SHA CI 后完成本项。

## Remaining Risks

- GitHub Actions 的 `actions/checkout@v4` / `actions/setup-node@v4` 仍有 Node 20 runtime 弃用提示，这是非阻断依赖治理事项。
- `commit_pipeline.rs`、`models.rs`、`reportFormat.ts` 等非本轮拆分目标仍超过 600 行；后续重构必须单独规划、先补回归保护并保持公共 contract。
- 产品反馈样本仍少，GitHub clone、页面流量和 Release 下载只能作为代理指标，不能解释为桌面活跃或留存。
