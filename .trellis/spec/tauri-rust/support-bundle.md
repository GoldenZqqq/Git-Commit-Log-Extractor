# Privacy-Safe Support Bundle

## Scenario: Preview And Export A Local Support Snapshot

### 1. Scope / Trigger

- Trigger: a user needs reproducible support context without exposing repository content, credentials, identities, or private filesystem paths.
- The bundle is a user-reviewed local ZIP. It is not telemetry, a crash report, a persistent application log, or an automatic GitHub attachment.

### 2. Signatures

Frontend contract:

```ts
type SupportBundleOptions = {
  diagnostics: DiagnosticResult | null;
  diagnosticError: string;
  workspace: WorkspaceHealthOptions;
  recentEvents: SupportBundleEventInput[];
  privacy: SupportBundlePrivacyContext;
};

buildSupportBundleOptions(input): SupportBundleOptions;
useSupportEvents(): { events: SupportBundleEventInput[]; record(message, level): void };
```

Tauri commands:

```rust
async fn preview_support_bundle(
    options: SupportBundleOptions,
) -> Result<SupportBundlePreview, String>;

async fn export_support_bundle(
    path: String,
    options: SupportBundleOptions,
) -> Result<SupportBundleExportResult, String>;
```

### 3. Contracts

- The archive schema version is `1` and contains exactly `summary.md`, `diagnostics.json`, and `recent-events.log` in that order.
- `preview_support_bundle` and `export_support_bundle` rebuild entries through the same Rust sanitizer and bounded builder. Export must never trust or package WebView preview text.
- The builder may inspect local workspace health and Git version. It must not read commits, report drafts/history, project mappings, operating-system logs, secure storage, or credential values.
- The frontend event ring is memory-only, ignores `loading` messages, deduplicates adjacent identical messages, keeps the newest 50 events, and limits each message to 500 characters. It is never written to localStorage or an application-data file.
- Rust independently keeps the newest 50 events, normalizes levels and line breaks, limits each event to 500 characters, limits each entry to 128 KiB, and limits the ZIP to 512 KiB.
- Rust replaces known roots, repository paths/names/branches, author scope, output path, AI endpoint, proxy URL, and proxy username before rendering. Generic redaction also covers emails, Bearer credentials, common key/token/password assignments, provider tokens, JWTs, and Windows/UNC/Unix absolute paths.
- Preview exposes the exact sanitized entry content, explicit exclusion labels, and a short safe Issue title/body. Export is disabled until the user reviews the preview and checks the confirmation control.
- Copy and GitHub Issue actions use only the Rust-returned title/body. The Issue URL must not include events, local paths, archive data, or attachment parameters, and opening it must not upload any file.
- All snapshot and ZIP work remains local and usable without network access. The save dialog path is user-selected and the returned output path is UI feedback only.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Diagnostics missing or failed | Build a snapshot with a sanitized failure summary; do not block local preview/export. |
| Unknown event level | Normalize it to `info`. |
| Event contains line breaks/control characters | Render one bounded log line without log-entry injection. |
| Entry or archive exceeds its byte limit | Fail closed with a Chinese error and do not write a partial file. |
| Output does not end in `.zip` | Return `支持包文件名必须使用 .zip 扩展名`. |
| Output is a directory or parent is unavailable | Return a Chinese path error before writing. |
| User cancels the save dialog | Keep the preview open and show no error. |
| Local write, clipboard, or browser open fails | Keep the available preview/content and show an actionable Chinese error. |
| Network is unavailable | Preview, copy, and ZIP export still work; only opening the browser is optional. |

### 5. Good / Base / Bad Cases

- Good: malicious diagnostics contain a Windows path, Unix path, repository, branch, author email, API key, Bearer token, OAuth token, proxy credentials, and log newlines; none appears in any entry or the Issue summary.
- Good: the user reviews all three entries, confirms, chooses a local `.zip` path, and receives a fixed-entry archive without any network request.
- Base: no diagnostics and no recent events still produce valid structured JSON and an explicit empty event log.
- Bad: sanitize only in React, then export the original options or preview strings directly from the WebView.
- Bad: spread all settings into `SupportBundleOptions`; this can introduce API keys, passwords, or future private fields.
- Bad: put the recent event ring in localStorage or automatically attach the ZIP to a GitHub URL/API request.

### 6. Tests Required

- Rust tests inject every private-value and generic-secret class and search all three entries plus the Issue title/body for the original values.
- Rust tests cover schema version, exact ZIP entries, diagnostic/workspace counts, event count/length/line boundaries, missing diagnostics, offline generation, output extension, unavailable parents, and bounded archive writing.
- Playwright covers preview, per-entry navigation, confirmation gating, export success/cancel/failure, safe clipboard content, attachment-free Issue URL, and preview failure.
- Overlay checks cover initial focus, focus trap, Escape, trigger restoration, serious/critical axe findings, `320x900`, `640x450`, and `1280x480` viewport bounds.
- Run `npm run build`, `npm run test:e2e:a11y`, `npm run test:e2e:responsive`, `npm run test:e2e`, `cargo fmt --all -- --check`, `cargo check`, `cargo test`, and `git diff --check`.

### 7. Wrong vs Correct

#### Wrong

```ts
await invoke("export_support_bundle", {
  path,
  entries: preview.entries,
  settings,
});
```

#### Correct

```ts
const options = buildSupportBundleOptions(safeInputs);
const preview = await invoke("preview_support_bundle", { options });
// After explicit user review and confirmation, Rust rebuilds the same snapshot.
await invoke("export_support_bundle", { path, options });
```
