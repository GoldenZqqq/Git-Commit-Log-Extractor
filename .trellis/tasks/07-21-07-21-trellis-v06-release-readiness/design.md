# Trellis 升级与 v0.6 发布准备设计

## Boundaries

- Trellis 升级边界是项目内 `.trellis/`、`.agents/` 和平台集成目录中的官方生成文件。
- 项目业务源码、版本元数据和发布资产仅做只读审查；发现问题时先形成结论，不顺带扩展实现。
- Git 分支清理只针对 `git merge-base --is-ancestor <branch> main` 成功的已合并分支。

## Upgrade Flow

1. 运行 `trellis update --dry-run` 获取升级计划和冲突提示。
2. 若无用户自定义文件覆盖风险，运行 `trellis update --migrate` 应用 0.6.7 模板和迁移。
3. 通过 Git diff 按生成脚本、工作流、skills、平台集成和模板哈希分组审查。
4. 检查 `.new` 文件、未跟踪文件和项目自定义配置是否被保留。

## Compatibility

- 保持 `.trellis/config.yaml` 的 `session_auto_commit: false` 和 `codex.dispatch_mode: inline`。
- 保持 `.trellis/spec/` 项目规则，不用强制覆盖处理本地修改。
- 任务在更新前创建；升级后使用新脚本继续验证其生命周期兼容性。

## Validation And Rollback

- 验证 Trellis 版本提示、上下文加载、任务当前状态、Python 脚本语法和 `git diff --check`。
- 如果升级器生成 `.new` 冲突文件，逐项比较后再决定合并，不自动覆盖。
- 提交前所有变更可通过 Git diff 审查；若升级失败，停止并报告，不清理分支或提交半成品。

## Release Readiness Review

- 核对 `package.json`、Tauri 配置、Cargo 包版本是否一致。
- 核对 v0.5.3 之后的变更、发布治理脚本、CI 证据、CHANGELOG 和更新器配置。
- 将建议分为发布阻断项、发布前建议项和后续版本事项，避免把缺少用户证据的新功能塞入 v0.6。
