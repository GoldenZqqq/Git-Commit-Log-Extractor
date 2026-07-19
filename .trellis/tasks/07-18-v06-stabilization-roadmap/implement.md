# v0.6 主线稳定化路线执行图

## Execution Contract

- [x] 串行执行 8 个子任务，任一时刻只激活一个实现任务。
- [x] 每个子任务通过 `trellis-check` 后归档，形成独立提交并 push。
- [x] 每个任务完成后更新父任务进度和下一任务依赖判断。
- [ ] 路线完成前执行跨任务集成验证与完成审计。

## Dependency Notes

- 主线收口是所有代码任务的基线。
- 发布治理必须在下一次版本发布前完成。
- 升级与性能证据先于大规模重构。
- 前端拆分先于 Rust 拆分，减少同时跨层重构的冲突面。
- 产品方向选择最后执行，使用前序任务建立的反馈和质量证据。

## Finalization

- [x] 逐个验证 8 个功能提交均为 `origin/main` 祖先，且对应 exact-SHA CI run 为 `success`。
- [x] 复核 v0.5.3 主线祖先、发布治理、升级恢复、性能基准、支持包隐私、模块边界和产品暂缓决策。
- [x] 本地 `npm run build`、串行 Playwright `77/77`、Release governance `12/12` 和 `git diff --check` 通过。
- [ ] 父任务审计提交通过 exact-SHA CI 后勾选 AC7、归档并 push。
