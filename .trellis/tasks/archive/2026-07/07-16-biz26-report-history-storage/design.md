# BIZ-26 Technical Design

## Architecture

本次新增两个边界：

1. `src-tauri/src/report_history.rs` 负责文件格式、校验裁剪、安全替换、备份恢复和隔离策略。
2. `src/hooks/useReportHistoryStorage.ts` 负责启动迁移、内存状态和串行持久化；`App.tsx` 只消费该边界暴露的操作。

`reportHistory` React state 仍是所有 UI 消费者的唯一运行时数据源。Rust 文件是跨启动的权威数据源，旧 `localStorage` 仅作为一次性迁移输入。

## File Format

应用数据目录使用以下固定文件：

- `report-history.json`：主文件
- `report-history.json.bak`：最近一次可用快照
- `report-history.json.tmp`：同目录临时文件
- `report-history.json.clear-rollback`：清空事务的短暂回滚文件
- `report-history.corrupt-<unix-millis>.json`：隔离的损坏文件

版本 1 envelope：

```json
{
  "version": 1,
  "entries": []
}
```

Rust 端定义 `ReportHistoryEntry` 命令模型并使用 `camelCase` serde 映射。读取时拒绝未知版本和结构错误；条目按 ID 去重并裁剪到规范化上限。

## Command Contracts

### `load_report_history`

输入：

- `legacyEntries: ReportHistoryEntry[] | null`
- `limit: number`

输出：

```ts
type ReportHistoryLoadResult = {
  entries: ReportHistoryEntry[];
  migrationComplete: boolean;
  recoveredFromBackup: boolean;
  warning: string | null;
};
```

规则：

1. 主文件有效时直接返回，以文件内容为权威；传入合法旧历史时标记 `migrationComplete`，允许前端清理旧键。
2. 主文件损坏时隔离并读取备份；备份有效则恢复主文件并返回恢复提示。
3. 主文件不存在而备份有效时从备份恢复。
4. 两者都不存在且存在合法旧历史时写入主文件，成功后标记迁移完成。
5. 无可用数据时返回空数组；可恢复的读取问题通过 `warning` 返回，路径解析等无法建立持久化边界的问题返回命令错误。

### `save_report_history`

输入 `entries` 与 `limit`，返回实际写入的裁剪后数组。写入失败返回错误，前端不得回滚当前内存内容。

### `clear_report_history`

先准备主/备两个空 envelope，再把旧主文件暂存为 rollback，最后依次替换备份和主文件。任一步失败都恢复旧主文件；成功后删除 rollback，确保旧备份不会在后续损坏恢复时复活。

## Safe Replacement

1. 序列化完整 envelope，创建应用数据目录。
2. 写入同目录 `.tmp` 并调用 `sync_all`。
3. 主文件存在时先删除旧备份，再把主文件重命名为备份。
4. 把临时文件重命名为主文件。
5. 最后一步失败时把备份恢复为主文件，并清理临时文件。

这套轮换兼容 Windows 不允许 `rename` 覆盖已存在目标的行为。若进程在步骤 3 与 4 之间退出，下次加载会从备份恢复。

## Migration Flow

前端启动时同步检查旧键：

- 合法数组：作为 `legacyEntries` 传入，并可在 Rust 命令完成前作为短暂内存回退。
- 非法 JSON 或存在非法条目：不修改旧键，向用户提示旧历史无法迁移；仍调用 Rust 加载现有文件。
- 无旧键：传 `null`。

只有 `migrationComplete === true` 才删除旧键。若 Rust 已经写入文件但 WebView 在清键前退出，下一次加载命中主文件并再次返回迁移完成，因此不会重复合并。

## Frontend Persistence

`useReportHistoryStorage` 提供：

- `entries`
- `remember(entry)`
- `update(id, patch)`
- `resize(limit)`
- `clear(): Promise<boolean>`

新增、更新和裁剪先更新内存，再通过 Promise 链串行保存，避免较慢的旧写入覆盖新状态。队列保存的是纯变换而不是预加载快照；若启动加载仍未完成，变换会在 Rust 返回的权威文件快照上重放，最新写入成功后再校准 UI。保存失败只发出警告，内存与当前预览保持不变。清空会乐观更新内存，失败时恢复清空前状态并返回 `false`。

## Compatibility And Rollback

- `ReportHistoryEntry` 字段、排序和 UI props 不变。
- 旧键在迁移成功前始终保留，因此可回退到旧版本。
- 回退到旧版本后新产生的文件历史不会被旧版本读取，这是明确的单向兼容边界；升级版再次启动时以文件为权威。
- 本任务不修改设置持久化键，文件错误不能触发设置重置。

## Test Strategy

- Rust 在临时目录直接测试存储函数，不依赖真实 Tauri runtime。
- Playwright mock 独立维护 `reportHistoryStore`，命令调用更新该状态；`reportHistory` fixture 继续表示旧 localStorage 数据以覆盖升级路径。
- 新增专门的 `report-history-storage.spec.ts`，并把既有正文持久化断言改为读取 mock 文件状态。
