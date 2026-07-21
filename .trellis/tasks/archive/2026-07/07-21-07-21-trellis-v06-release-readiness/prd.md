# 升级 Trellis 并审查 v0.6 发布准备

## Goal

在最新 `main` 上把项目级 Trellis 从 0.6.5 更新到当前 CLI 提供的 0.6.7，验证并提交生成差异，同时给出 v0.6 发布前的功能取舍与必要内容清单。

## Background

- 全局 Trellis CLI 已是 0.6.7，项目模板状态仍是 0.6.5，CLI 提示运行 `trellis update`。
- `main` 已 fast-forward 到 `origin/main` 的 `0c27212`，工作区基线干净。
- `codex/roadmap-completion` 已合并到 `main`；`codex/legacy-python-desktop` 未合并且用于保留旧 Python/Tkinter 版本。
- 用户明确要求直接在 `main` 操作，不创建新分支，并授权删除已经合并的分支。

## Requirements

- R1：使用 Trellis 官方 `trellis update` 更新项目生成文件，不修改全局 npm 安装目录或包缓存。
- R2：升级前使用 dry-run 识别改动和本地冲突；正式更新必须保留项目已有自定义配置与规格。
- R3：审查所有生成差异，不把无关业务代码、版本号或依赖变更混入升级提交。
- R4：运行 Trellis 上下文、任务生命周期、空白字符和必要应用级检查，记录真实结果。
- R5：将升级结果和本任务文档提交到 `main`，提交信息遵循中文 Conventional Commits。
- R6：提交后只删除确认已被 `main` 包含的 `codex/roadmap-completion` 本地及远程分支；保留未合并的 legacy 分支。
- R7：基于当前代码、发布治理、最终审计和版本元数据，给出 v0.6 发布前“必须完成 / 建议完成 / 不应阻塞发布”的结论。

## Acceptance Criteria

- [x] AC1：`trellis update` 完成，项目模板版本不再提示 0.6.5 -> 0.6.7。
- [x] AC2：生成文件差异已逐类审查，没有覆盖项目自定义规格或引入 `.new` 冲突文件遗漏。
- [x] AC3：`get_context.py`、任务脚本、`git diff --check` 和按改动风险选择的项目验证均成功。
- [x] AC4：升级改动已在 `main` 形成提交 `b73dec0`，提交范围仅包含 Trellis 生成文件与本任务记录。
- [x] AC5：已合并 roadmap 分支已从本地和 `origin` 删除，未合并的 legacy 分支仍存在。
- [x] AC6：v0.6 发布前审查明确版本一致性、发布说明、构建/签名/更新清单、剩余风险和功能范围建议，详见 `release-readiness.md`。

## Out Of Scope

- 不在本任务中发布 v0.6、创建 tag、上传 GitHub Release 或推送升级提交。
- 不新增未经产品验证的新功能。
- 不删除未合并分支，不修改 Git 历史。
