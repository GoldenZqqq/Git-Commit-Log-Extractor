# Report History Storage

> Executable contract for report-history persistence, migration, recovery, and frontend state ordering.

## 1. Scope / Trigger

- Trigger: code loads, creates, updates, trims, clears, migrates, or recovers `ReportHistoryEntry` values.
- Report bodies are local-first filesystem data. Settings and the repository index keep their existing localStorage ownership; this contract owns only report history.
- Multi-window concurrent editing, cloud sync, encryption, and history search are outside this contract.

## 2. Signatures

Rust commands use camelCase IPC fields and run filesystem work through `spawn_blocking`:

```rust
async fn load_report_history(
    app: AppHandle,
    legacy_entries: Option<Vec<ReportHistoryEntry>>,
    limit: usize,
) -> Result<ReportHistoryLoadResult, String>;

async fn save_report_history(
    app: AppHandle,
    entries: Vec<ReportHistoryEntry>,
    limit: usize,
) -> Result<Vec<ReportHistoryEntry>, String>;

async fn clear_report_history(app: AppHandle) -> Result<(), String>;
```

Load response and frontend boundary:

```ts
type ReportHistoryLoadResult = {
  entries: ReportHistoryEntry[];
  migrationComplete: boolean;
  recoveredFromBackup: boolean;
  warning: string | null;
};

useReportHistoryStorage(limit, onWarning): {
  entries: ReportHistoryEntry[];
  remember(entry: ReportHistoryEntry): void;
  update(id: string, patch: HistoryPatch): void;
  resize(limit: ReportHistoryLimit): void;
  clear(): Promise<boolean>;
};
```

## 3. Contracts

- Files live under Tauri `app_data_dir`:
  - `report-history.json`: versioned primary envelope.
  - `report-history.json.bak`: previous valid snapshot.
  - `report-history.json.tmp` and `.bak.tmp`: same-directory prepared writes.
  - `report-history.json.clear-rollback`: old primary during a clear transaction.
  - `report-history.corrupt-<timestamp>.json`: isolated invalid data.
- Version 1 is `{ "version": 1, "entries": [...] }`. Unsupported versions are invalid, not silently reinterpreted.
- Supported limits are 30, 60, 120, and 200; any other value normalizes to 120. First-seen ID wins and ordering stays newest-first.
- Normal save writes and syncs the temp file, rotates primary to backup, then renames temp to primary. A failed final rename restores the backup when possible.
- Clear prepares two empty envelopes, moves the old primary to rollback, replaces backup and primary, then deletes rollback. Any returned error must leave the old primary recoverable.
- On load, a missing primary plus rollback means an interrupted clear: restore rollback before reading backup. A valid primary is authoritative.
- A corrupt/unsupported primary is isolated. A valid backup is returned and used to restore primary; no valid backup yields empty history plus a warning, not an app-start failure.
- `gitpulse-report-history` is one-time legacy input. A valid array is sent as `legacyEntries`; only `migrationComplete` permits key deletion. Invalid JSON/entries stay untouched and produce a Chinese warning.
- If the file already exists, never merge legacy entries into it. Return the file and mark migration complete so a crash between file write and key deletion remains idempotent.
- React memory is the UI source of truth. Save failure keeps memory and preview; clear failure restores previous memory.
- The frontend queue stores transformations, not pre-load snapshots. A mutation made before startup loading finishes must replay against the loaded file snapshot before saving.

## 4. Validation & Error Matrix

- Primary valid -> return normalized primary; ignore legacy content and allow legal legacy-key cleanup.
- Primary missing, backup valid -> restore primary from backup and return `recoveredFromBackup = true` with warning.
- Primary corrupt/unsupported, backup valid -> isolate primary, recover backup, warn.
- Primary corrupt/unsupported, no valid backup -> isolate what can be isolated, return empty entries and warning.
- Both files missing, valid legacy array -> normalize, write primary, return `migrationComplete = true`.
- Legacy JSON or any entry invalid -> pass `legacyEntries = null`, preserve the old key, show the migration warning.
- Directory/temp/write/rename failure -> return a Chinese `Err`; frontend keeps current memory and appends a persistent warning.
- Clear fails before completion -> restore rollback as primary and return `Err`; frontend restores pre-clear memory.
- Startup load is pending when a mutation occurs -> replay the mutation against the returned file entries, then persist the combined result.

## 5. Good / Base / Bad Cases

- Good: file contains 20 old records while load is slow; a new report is generated, then persisted as 21 records with the new item first.
- Base: no legacy key and no file returns empty history; the first generated report creates the versioned file.
- Good recovery: main is invalid and backup contains 30 records; main is isolated, backup becomes visible, and a Chinese recovery warning remains available.
- Good clear: after clearing, corrupting main still recovers an empty backup, never old report bodies.
- Bad: write complete report bodies to localStorage after migration; WebView quota can silently remove history.
- Bad: queue a captured empty array while startup loading is pending; it can overwrite valid file history.
- Bad: delete the legacy key before Rust confirms migration; a failed write then loses the only copy.

## 6. Tests Required

- Rust unit tests assert envelope round-trip, supported-limit trimming, first-ID dedupe, migration idempotence, unsupported-version isolation, backup recovery, interrupted-clear recovery, failed-clear rollback, and empty-backup recovery after clear.
- Playwright asserts valid legacy migration and key deletion, existing-file authority, invalid legacy preservation, load/save/clear warnings, save-failure memory fallback, and clear-failure UI rollback.
- Defer `load_report_history`, generate a report before release, then assert the file store contains both old and new entries.
- Existing AI polish, supplemental facts, report opening/filtering, and history clear flows must read the mock file store and remain green.
- Run `npm run build`, full `npm run test:e2e`, `cargo fmt -- --check`, `cargo check`, and full `cargo test`.

## 7. Wrong vs Correct

### Wrong

```ts
const next = rememberReportHistoryEntry([], entry, limit);
await invoke("save_report_history", { entries: next, limit });
// A still-pending load may contain records that this snapshot overwrites.
```

### Correct

```ts
const transform = (entries: ReportHistoryEntry[]) =>
  rememberReportHistoryEntry(entries, entry, limit);

queueAfterInitialization(async () => {
  const next = transform(storageEntriesRef.current);
  storageEntriesRef.current = await invoke("save_report_history", { entries: next, limit });
});
```
