# 加固发布治理并同步产品文档

## Goal

限制非 main 发版，补发布前 CI/祖先校验并同步 v0.5.3 文档

## Requirements

- R1：默认发布入口只接受最新且干净的 `main`，非主线发布必须显式拒绝。
- R2：发布 tag 对应提交必须属于 `origin/main`，且完整 CI 成功后才能构建资产。
- R3：README、CHANGELOG、PROGRESS、官网与 v0.5.3 实际能力一致。
- R4：发布失败不得留下误导性的 tag、Release 或更新清单。

## Acceptance Criteria

- [x] AC1：从非 `main` 或落后远端的分支执行发布 dry-run 会得到明确拒绝。
- [x] AC2：CI/发布 workflow 对 tag 祖先和质量门禁有自动化验证。
- [x] AC3：v0.5.3 新能力与平台限制在维护文档和用户文档中一致。
- [x] AC4：相关脚本测试、构建、CI 配置解析和发布 dry-run 通过。

## Verification Evidence

- 功能提交：`cef9a30 feat(release): 加固主线发布治理`，已进入并推送 `origin/main`。
- 主线 CI：run `29645493092` 全绿；Release governance、Linux/Windows desktop checks、Rust `fmt/check/test`、全量 Playwright 与真实 Windows Tauri WebView smoke 全部成功。
- 治理单测：`npm run test:release-governance` 为 `12 passed`，覆盖 clean main、非 main、脏工作区、落后远端、tag 祖先、current 恢复、CI 成败、draft 成功与三类失败补偿。
- 本地构建：`npm run build` 成功；`npm --prefix site run build` 成功并生成 5 个路由；全量 `npm run test:e2e` 为 `66 passed`。
- 发布 dry-run：干净同步的 `main` 成功规划 `0.5.4`，确认五个版本文件仅预览、未写入、未构建、未上传。
- Workflow：PyYAML 解析 `ci.yml` / `release.yml` 成功，并断言 build job 依赖 `validate`、主 CI 包含独立 governance job。
- 规格：新增 `.trellis/spec/tauri-rust/release-governance.md`，包含主线、CI、tag、draft、恢复与失败补偿的七段可执行契约。
- 已知非阻断项：GitHub Actions 对 `actions/checkout@v4` / `actions/setup-node@v4` 给出 Node 20 action runtime 弃用提示，留待独立依赖升级任务处理。

## Dependency

- 依赖 `07-18-mainline-v053-reconciliation` 完成。
