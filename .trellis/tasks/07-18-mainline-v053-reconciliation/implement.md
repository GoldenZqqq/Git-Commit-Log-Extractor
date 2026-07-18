# v0.5.3 主线收口实施计划

1. [ ] 校验 target/source refs、版本和已知冲突清单。
2. [ ] 提交并 push 路线任务树规划。
3. [ ] 激活本任务，创建集成分支并执行 `--no-ff` merge。
4. [ ] 语义解决 Trellis 冲突，确认无产品代码被回退。
5. [ ] 本地执行可用的 build/E2E/diff 检查。
6. [ ] 推送集成分支并创建面向 `main` 的 PR。
7. [ ] 等待并核对全部 PR CI jobs；失败则修复、提交、push、重跑。
8. [ ] 合并 PR，拉取 `main`，验证 tag 祖先、版本、任务树和远端同步。
9. [ ] 勾选 AC，归档任务并 push 归档提交。

## Validation Commands

```bash
npm ci
npm run build
npm run test:e2e
npm run test:e2e:a11y
npm run test:e2e:responsive
cd src-tauri && cargo fmt -- --check && cargo check && cargo test
git diff --check
git merge-base --is-ancestor v0.5.3 main
```

## Risk Files

- `.trellis/tasks/archive/2026-07/07-13-batch-report-gen/`
- `.trellis/tasks/archive/2026-07/07-14-blank-day-report-fill/`
- `.trellis/tasks/archive/2026-07/07-14-report-calendar-insights/`
- `.github/workflows/ci.yml`
