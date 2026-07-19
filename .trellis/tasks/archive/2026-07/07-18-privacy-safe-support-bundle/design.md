# 隐私安全支持诊断包设计

## Architecture And Boundaries

- 新增 `src-tauri/src/support_bundle.rs`，独占快照构建、脱敏、固定条目渲染、Issue 摘要和 ZIP 写入。`lib.rs` 只提供两个 `spawn_blocking` 命令包装并注册命令。
- `src-tauri/src/models.rs` 与 `src/model.ts` 镜像 support bundle 请求/响应；camelCase IPC 不复用报告脱敏模型，因为支持包需要默认强制脱敏且没有关闭开关。
- 新增 `src/hooks/useSupportEvents.ts` 保存当前会话高层事件，最多 50 条，只接收非 loading 的 App message；不读写 localStorage 或文件。
- 新增独立 `SupportBundleSection` / `SupportBundleDialog` 组件，由设置页诊断 tab 组合，避免继续扩大 `SettingsDialog.tsx` 的业务逻辑。
- 前端只负责收集已有诊断结果、工作区健康请求参数和有界事件，Rust 负责最终隐私边界与文件系统写入。

## Data Flow And Commands

```text
App status/message
  -> useSupportEvents current-session ring (max 50)
  -> Settings > Diagnostics > Prepare support bundle
  -> preview_support_bundle(options)
       -> inspect workspace health locally
       -> sanitize diagnostics + events + environment
       -> build summary.md / diagnostics.json / recent-events.log
       -> return exact safe preview + short issue summary
  -> user reviews entries and checks explicit confirmation
  -> system save dialog chooses .zip path
  -> export_support_bundle(path, same frozen options)
       -> rebuild through the same sanitizer
       -> validate .zip path and bounded archive
       -> write local file
```

Command contracts:

```rust
async fn preview_support_bundle(
    options: SupportBundleOptions,
) -> Result<SupportBundlePreview, String>;

async fn export_support_bundle(
    path: String,
    options: SupportBundleOptions,
) -> Result<SupportBundleExportResult, String>;
```

`SupportBundleOptions` contains an optional existing `DiagnosticResult`, a bounded diagnostic failure string, `WorkspaceHealthOptions`, recent event inputs, and a small privacy context (`author`, `outputDir`, `aiBaseUrl`, `proxyUrl`, `proxyUsername`). It never contains API Key, OAuth token or proxy password.

`SupportBundlePreview` contains `schemaVersion: 1`, generated time, suggested filename, three named preview entries, excluded-data labels, `issueTitle`, and a bounded `issueBody`. Export returns the written path and archive byte count; the returned path is UI feedback only and is never placed in the bundle or Issue URL.

## Snapshot Contract

The archive contains exactly:

| Entry | Content |
| --- | --- |
| `summary.md` | Version/platform/Git, aggregate diagnostic and workspace health counts, timing summary, latest safe failures, privacy exclusions |
| `diagnostics.json` | `schemaVersion: 1` structured environment, sanitized diagnostic items, aggregate health status maps, timings, and event count |
| `recent-events.log` | Up to 50 timestamped, sanitized current-session events; explicit empty-state line when none exist |

- Workspace paths, names, branches and details are used only to compute counts and private-value replacements, then discarded.
- Diagnostic item IDs, labels, severity and sanitized messages/actions are retained. Known author/path/endpoint values and generic sensitive patterns are replaced with stable placeholders.
- Recent events are bounded to the newest 50, each timestamp/level/message is validated, each message is truncated before and after sanitization, and total rendered bytes are capped.
- Timings use integer milliseconds and include only local snapshot/health construction time. They are engineering context, not user SLA.
- Generated files and the archive have hard byte limits. Any overflow fails closed with a Chinese error instead of truncating structured JSON into an invalid document.

## Redaction And Privacy Defense

The sanitizer applies in this order:

1. Replace known private values derived from health/options: workspace paths, repository paths/names, branches, author scope, output directory, AI endpoint and proxy identity.
2. Replace emails and common credential shapes: Bearer headers, `api_key` / `token` / `password` assignments, OpenAI-style `sk-...` strings, and JWT-like tokens.
3. Replace remaining Windows drive, UNC and Unix absolute-path shapes, accepting safe over-redaction instead of leaking an edge-case path.
4. Normalize control characters, bound line lengths and run the same sanitizer again before rendering/writing each entry.

The builder never reads commits, report drafts/history, mapping text, secure storage or raw credential fields. `preview_support_bundle` and `export_support_bundle` share one pure build path so export cannot bypass preview sanitation.

## UI And Interaction

- Diagnostics remains the owning settings tab. The support action is secondary to running diagnostics and is disabled only while preview/export is active.
- Preview is a modal dialog with a compact file selector and scrollable monospace content area; it is not a nested decorative card layout.
- The primary export button remains disabled until the user checks an explicit privacy confirmation. Copy summary and open Issue are separate clear commands with Copy, ExternalLink and Download icons.
- Opening Issue uses the fixed repository URL and URL-encoded Rust-generated title/body. There is no attachment query, API call or upload side effect.
- Dialog follows the shared `useModalDialog` contract: initial focus, trapped Tab, Escape close, trigger focus restoration, responsive height and dark theme support.

## Compatibility, Failure And Rollback

- Existing `run_diagnostics`, workspace health, report flows, secure storage and settings persistence remain compatible; new model derives only add deserialization needed for the new local command.
- Preview can still be built when diagnostics failed: it records a sanitized diagnostic failure and workspace/event summary. Network warnings do not block local export.
- Canceling the save dialog returns to preview without an error. Write/open/copy errors remain local and show actionable Chinese feedback.
- Rollback removes the two commands, support module, UI component/hook/types/styles and tests. No persisted schema or user data migration is required because events are in-memory and archives are user-owned exports.
