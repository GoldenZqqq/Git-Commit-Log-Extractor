# 执行计划

## Trellis Upgrade

- [x] 确认 `main` 与 `origin/main` 同步且基线工作区仅包含本任务文件。
- [x] 运行 `trellis update --dry-run` 并审查冲突/迁移提示。
- [x] 运行 `trellis update --migrate`，逐类审查生成差异和 `.new` 文件。
- [x] 确认项目自定义配置、规格和 inline 模式保持不变。

## Validation

- [x] 运行 `trellis --version`、`get_context.py`、`task.py current/list`。
- [x] 对更新后的 Python 脚本运行语法编译检查。
- [x] 运行 `git diff --check`、前端 build、发布治理测试、Rust fmt/check/test 和全量 Playwright。
- [x] 核对 v0.6 版本元数据、CHANGELOG、发布脚本和最新审计证据。

## Delivery

- [x] 更新任务验收状态并完成 Trellis 质量检查。
- [ ] 暂存经过审查的升级和任务文件，创建中文 Conventional Commit。
- [ ] 再次确认 `codex/roadmap-completion` 是 `main` 祖先后删除本地及远程分支。
- [x] 确认 `codex/legacy-python-desktop` 未合并，必须保留并在交付中报告。

## Rollback Points

- dry-run 出现不可判断的用户修改冲突时，停止正式更新。
- 正式更新出现 `.new` 或非生成目录业务改动时，先审查并停止提交。
- 分支祖先检查失败时，不删除该分支。
