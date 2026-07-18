# BIZ-22 拆分任务忙碌状态 — 技术设计

## Architecture

新增 `src/hooks/useTaskActivity.ts`，集中拥有 App 级任务类型、活动状态、冲突矩阵和同步启动守卫。React 状态用于渲染，`useRef` 保存同一事件循环内的最新状态，避免双击在 state commit 前启动两个相同任务。

```text
App action
  → runTask(kind, label, task, validate)
  → useTaskActivity.tryStart(kind, label)
  → conflict matrix guard
  → immutable ActiveTaskState update
  → Workbench derives task-local disabled/loading/preview policy
  → finally finish(kind)
```

任务类型：

```ts
type AppTaskKind = "scan" | "generate" | "polish" | "export" | "interaction";
type ActiveTaskState = Partial<Record<AppTaskKind, string>>;
```

值保存当前任务文案，既能判断类型，也能在并发任务存在时按优先级展示正确的顶部状态。

## Conflict Matrix

| 启动任务 | 冲突中的活动任务 | 原因 |
| --- | --- | --- |
| `scan` | `scan`, `generate` | 防重复扫描；生成读取仓库集合 |
| `generate` | 全部任务类型 | 生成会替换报告主体并读取仓库/当前草稿 |
| `polish` | `generate`, `polish`, `export` | AI 会替换当前报告；避免导出中途版本 |
| `export` | `generate`, `polish`, `export` | 导出读取当前报告；避免重复写文件 |
| `interaction` | `generate`, `interaction` | 复制不应读取被生成过程遮挡的旧报告；防重复复制 |

扫描可与 AI、导出、复制并行；轻量任务不会阻断设置入口、预览阅读或历史导航。

## App Boundary

`runTask` 改为：

```ts
runTask(kind, label, task, validate)
```

执行顺序：先验证输入，再同步尝试获取任务槽位；冲突时给出中文状态且不调用 Tauri；成功后设置 loading 状态，`finally` 只释放自己的任务类型。复制当前预览和复制历史也使用 `interaction`，从而纳入重复点击保护但不遮挡预览。

`isRepoScanning` 从 `activeTasks.scan` 派生，移除可与真实任务状态漂移的第二份布尔 state。扫描进度数据仍保留在 `scanProgress`。

## Workbench Policy

- 顶部 spinner：存在任一活动任务时显示，文案由活动任务优先级决定。
- 预览替换：仅 `generate` 显示 `preview-loading`；其余任务继续渲染 `MarkdownPreview`。
- 生成按钮/周期冲突：使用 `taskCanStart(activeTasks, "generate")`。
- AI、导出、复制：分别显示本地 spinner/文案，并只按冲突矩阵禁用。
- 仓库重扫/取消：只读取 `scan` 状态；取消扫描在扫描活动时保持可用。
- 补充事项编辑：生成或 AI 润色期间禁用，扫描/导出/复制期间可编辑。
- 报告日历的“生成日报”使用生成冲突状态，不再接收全局 busy。

## Test Strategy

扩展 Playwright Tauri mock，允许指定命令挂起并由测试显式释放，以观察请求进行中的 UI，而不是依赖不稳定的时间延迟。

新增独立 task-state E2E：

1. 挂起 `extract_commits`：预览显示阻塞进度，生成冲突按钮禁用，释放后恢复报告。
2. 挂起 `enhance_report`：原稿保持可见，AI 按钮显示 loading，复制/设置仍可用，生成与导出禁用。
3. 挂起 `save_report_file`：原稿保持可见，导出按钮显示 loading，复制仍成功，生成与 AI 禁用。

## Compatibility and Rollback

- 不改 IPC；所有行为变化限于前端任务编排和 disabled/loading 展示。
- 现有 Batch、空白日补写和洞察局部 loading 保持原样。
- 回滚时可恢复 `isBusy` 与旧 `runTask` 签名，不影响 Rust 或持久化数据。

## Risks

- 并发任务完成顺序覆盖顶部状态。通过活动任务文案优先级和任务面板局部进度降低歧义。
- UI disabled 与启动边界规则不一致。所有按钮和 `runTask` 必须复用同一冲突 helper。
- AI/导出期间切换报告模式。操作捕获启动时的报告文本和模式，结果仍写回原模式；预览切换不应改变请求输入。
