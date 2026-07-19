# 产品验证闭环执行计划

## Ordered Checklist

- [x] 固化 2026-07-19 GitHub Issue、仓库流量、Release 资产下载和仓库统计快照。
- [x] 将现有 Support Bundle 能力与 R2 数据边界逐项对照。
- [x] 编写 `docs/product-validation-plan.md`，包含候选假设、结构化问题、评分表、反证和实现门槛。
- [x] 新增 `.github/ISSUE_TEMPLATE/product-feedback.yml`，禁止要求提交敏感内容。
- [x] 在业务路线图中记录“继续验证，不启动实现”的决策。
- [x] 运行 YAML 解析、文档链接、`git diff --check` 和前端构建检查。
- [x] 串行运行完整 Playwright E2E（`77/77`）和 Release governance（`12/12`）；Linux Tauri smoke 按平台契约跳过。
- [x] 推送提交后核对该提交的 GitHub Actions exact-SHA 全绿结果；提交 `f058b31fc44def7b105101adf27ae3d83a6093c4`，run `29692623445` 四个 job 全绿。
- [ ] 归档任务并记录 session journal。

## Validation Commands

```bash
python - <<'PY'
import yaml
yaml.safe_load(open('.github/ISSUE_TEMPLATE/product-feedback.yml', encoding='utf-8'))
print('issue form yaml: ok')
PY
npm run build
git diff --check
```

远端收尾还必须执行：

```bash
gh run list --commit <commit-sha> --limit 20
```

## Validation Evidence

- `python` YAML 解析：通过；11 个 Issue Form 块、字段 ID 唯一、隐私确认必填。
- `npm run build`：通过。
- `npm run test:e2e -- --workers=1`：`77 passed`。
- `npm run test:release-governance`：`12 passed`。
- `npm run test:tauri-smoke -- src-tauri/target/debug/gitpulse`：Linux 按契约跳过真实 Windows WebView smoke。
- 本机当前没有 `cargo` 可执行文件，因此未声称 Rust fmt/check/test 已通过；Rust 门禁由推送后的 exact-SHA CI 覆盖，前序 Rust 拆分任务的 CI 证据保留在其独立归档记录中。
- Code-spec 复核：本任务没有新增运行时、IPC、存储或网络契约，产品验证计划已是合适的长期记录，无需修改 `.trellis/spec/`。
- exact-SHA CI `29692623445`：Linux/Windows frontend smoke、a11y、responsive、full E2E、build、Rust fmt/check/test、diff check、Windows WebView smoke 和 Release governance 全部成功。

## Risk And Rollback Points

- 风险点：Issue Form 字段与评分模型不一致；在发布前用解析检查和人工逐字段对照解决。
- 风险点：把单条外部反馈或下载量写成产品结论；用“证据质量”和量化门槛限制结论。
- 回滚点：文档/Issue Form 均为独立新增或局部文档行，若验证失败可在提交前修正，不触碰应用代码。
