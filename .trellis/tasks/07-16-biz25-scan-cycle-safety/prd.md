# BIZ-25 加固仓库扫描循环保护

## Goal

确保仓库递归扫描面对 symlink、Windows junction、重叠根目录或目录循环时能够终止，并给出可理解警告。

## Requirements

- 扫描按规范化目录身份维护 visited 集合，重复目录不再递归。
- 明确定义符号链接与 junction 的策略；默认可发现其中仓库，但不得跨循环无限遍历。
- 单个路径 canonicalize/read_dir 失败继续跳过，不中断其他根目录，并聚合警告。
- 保持取消扫描、进度回调、重叠根目录仓库去重行为。

## Acceptance Criteria

- [ ] 构造目录循环时扫描在有限时间内结束。
- [ ] 重叠根目录和不同链接指向同一仓库只返回一条。
- [ ] 无法访问或失效链接产生用户可读警告且不阻断其他结果。
- [ ] Windows 条件测试覆盖 junction/symlink 可用场景，其他平台保持通过。

## Evidence

- `src-tauri/src/git_ops.rs::visit_dir` 当前通过 `path.is_dir()` 递归，没有目录 visited 集合；只在发现仓库后按 canonical path 去重。
