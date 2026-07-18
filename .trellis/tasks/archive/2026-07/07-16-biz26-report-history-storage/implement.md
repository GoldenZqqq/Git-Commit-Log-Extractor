# BIZ-26 Implementation Plan

## Scope

跨 `src-tauri`、前端状态边界和 Playwright mock 完成报告历史迁移。不修改历史 UI 结构，不引入新依赖。

## Steps

1. **Rust 红灯测试**
   - 新建 `src-tauri/src/report_history.rs` 测试骨架。
   - 覆盖版本化 round-trip、条数裁剪与去重、旧数据迁移、主文件损坏后备份恢复、空存储和清空不复活。
   - 先运行 `cargo test report_history` 确认测试能约束目标行为。

2. **Rust 存储与命令**
   - 实现 envelope、路径集合、读取恢复、安全替换和清空。
   - 在 `src-tauri/src/lib.rs` 注册 `load_report_history`、`save_report_history`、`clear_report_history`。
   - 保持新函数不超过 50 行、新文件不超过 600 行。

3. **前端迁移边界**
   - 把 `src/model.ts` 中 localStorage 历史函数拆成纯校验/裁剪/新增/更新 helper 与旧键迁移读取 helper。
   - 新建 `src/hooks/useReportHistoryStorage.ts`，集中启动加载、迁移清键、串行保存与失败提示。
   - `src/App.tsx` 改用 hook，并让清空只在 Rust 成功后更新内存。

4. **Playwright mock 与回归**
   - 扩展 `tests/e2e/support/tauri.ts` 的文件历史状态、三条命令与可控错误/恢复 warning。
   - 更新既有 localStorage 正文断言。
   - 新增迁移幂等、保存失败保留预览/内存、清空成功和加载恢复提示场景。

5. **质量门禁**
   - `cargo fmt --check`
   - `cargo test report_history`
   - `cargo test`
   - `cargo check`
   - `npm run build`
   - `npm run test:e2e`
   - `git diff --check`
   - 检查新增/修改文件行数与函数长度，人工核对 AC1-AC6。

6. **Trellis 收尾**
   - 运行 `trellis-check`。
   - 按需要用 `trellis-update-spec` 记录新的跨层持久化约定。
   - 归档 `07-16-biz26-report-history-storage`。
   - 创建一个中文 Conventional Commit；不 push。

## Risk And Rollback Points

- **Windows 文件替换语义**：先以 Rust 临时目录测试轮换与恢复，再接 Tauri 路径；不依赖覆盖式 rename。
- **异步写入乱序**：所有前端保存通过单一 Promise 链串行执行。
- **迁移重复**：主文件存在时永不合并旧数组，只返回迁移完成标记。
- **清空后备份复活**：清空必须同时刷新主文件与备份，测试模拟主文件损坏后仍为空。
- **现有 E2E 兼容**：先扩展通用 mock，再逐个迁移历史断言，最后跑全量 40+ 用例。

## Start Review

- PRD 已收敛且无阻塞问题。
- 技术设计覆盖命令契约、迁移幂等、安全替换、失败降级和回滚。
- 用户已明确授权按路线图逐项开始并在每项完成后提交，因此规划门禁通过后可直接执行 `task.py start`。
