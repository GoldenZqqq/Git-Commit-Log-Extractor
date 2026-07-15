# BIZ-25 加固仓库扫描循环保护 — 实施计划

## Risk Level

Level 2。修改递归文件系统遍历与跨层扫描结果契约，采用 TDD；优先证明循环可终止、错误不扩散且取消仍是硬错误。

## Checklist

1. **红灯与边界测试**
   - [x] 添加目录链接循环、链接别名去重、无效根目录继续与警告上限 Rust 测试，并确认旧实现失败。
   - [x] 添加 Windows 条件 symlink 测试；无法创建时仅跳过该平台能力场景。

2. **Rust 扫描器重构**
   - [x] 新增 `RepoScanResult` 与有界 warning collector。
   - [x] 用 `RepoScanner` 收拢递归状态，canonicalize 后全局判重，再发送进度和遍历。
   - [x] 将 canonicalize/read_dir/entry/metadata 错误转为中文警告，取消继续向上传播。
   - [x] 保持仓库排序、忽略目录、worktree 标记和兼容包装。

3. **跨层接入**
   - [x] Tauri `scan_repos` 返回结构化结果，取消事件行为保持不变。
   - [x] React 类型、`scanWorkspace` 与 Playwright mock 消费 `repos/warnings`。
   - [x] 添加工作台警告可见性回归测试。

4. **验证与收口**
   - [x] 定向 Rust 与 Playwright 测试转绿。
   - [x] `npm run build`、`npm run test:e2e`。
   - [x] `cargo check`、`cargo test`、`cargo fmt -- --check`。
   - [x] `git diff --check`、跨层字段审计、规范更新。
   - [x] 更新路线图与验收，归档并形成独立本地提交；不推送。

## Verification Record

- Frontend build: passed.
- Playwright: 32/32 passed.
- Rust: check passed, 106/106 tests passed, fmt check passed.
- Cross-layer audit: Rust/TypeScript/mock all use camelCase `RepoScanResult { repos, warnings }`.
- Static audit: diff check passed; no temporary debug or type-bypass code.

## Expected Files

- `src-tauri/src/git_ops.rs`
- `src-tauri/src/models.rs`
- `src-tauri/src/lib.rs`
- `src/model.ts`
- `src/App.tsx`
- `tests/e2e/support/tauri.ts`
- `tests/e2e/workbench.spec.ts`
- `.trellis/spec/tauri-rust/command-boundaries.md`

## Rollback Point

Rust scanner、结果模型与前端消费必须同批落地。若链接遍历或结果契约出现回归，整体恢复旧数组返回与递归实现，不保留半套 IPC 形状。
