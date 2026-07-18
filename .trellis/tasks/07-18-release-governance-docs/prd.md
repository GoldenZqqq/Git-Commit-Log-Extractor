# 加固发布治理并同步产品文档

## Goal

限制非 main 发版，补发布前 CI/祖先校验并同步 v0.5.3 文档

## Requirements

- R1：默认发布入口只接受最新且干净的 `main`，非主线发布必须显式拒绝。
- R2：发布 tag 对应提交必须属于 `origin/main`，且完整 CI 成功后才能构建资产。
- R3：README、CHANGELOG、PROGRESS、官网与 v0.5.3 实际能力一致。
- R4：发布失败不得留下误导性的 tag、Release 或更新清单。

## Acceptance Criteria

- [ ] AC1：从非 `main` 或落后远端的分支执行发布 dry-run 会得到明确拒绝。
- [ ] AC2：CI/发布 workflow 对 tag 祖先和质量门禁有自动化验证。
- [ ] AC3：v0.5.3 新能力与平台限制在维护文档和用户文档中一致。
- [ ] AC4：相关脚本测试、构建、CI 配置解析和发布 dry-run 通过。

## Dependency

- 依赖 `07-18-mainline-v053-reconciliation` 完成。
