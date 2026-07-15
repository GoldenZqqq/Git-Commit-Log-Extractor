# State Management

> How frontend state is managed in GitPulse.

---

## Overview

The app uses React local state, `useMemo`, `useRef`, localStorage helpers, and Tauri commands. There is no global state library.

---

## State Categories

- Persisted settings live in localStorage through `loadSettingsState` and `settingsForPersistence`; plain settings must not store raw API keys.
- Repository index and report history are localStorage-backed convenience state, not source-controlled or remote state.
- Report text, selected report mode, warnings, progress, and dialog state live in `App.tsx`.
- Derived values such as project name maps, date ranges, preview text, and AI readiness should use `useMemo` or small helper functions.
- Secrets and ChatGPT login state belong in OS-backed secure storage via Rust commands, not localStorage.

---

## When to Use Global State

Do not add a global state library unless multiple independent app roots need the same mutable state. For this single workbench app, lift state to `App.tsx` and pass typed props down.

---

## Server State

GitPulse is local-first. Treat local Git repositories, local files, system credentials, and optional AI providers as external integrations reached through Rust commands. The frontend should not cache remote AI responses as authoritative data.

---

## Common Mistakes

- Persisting raw API keys or tokens in localStorage.
- Deriving report command options in components instead of using `src/model.ts` builders.
- Treating empty author input as an invalid author; empty author scope means all authors.
- Forgetting to clear active history selection when changing report mode or period.

## App-Level Async Task Activity

App-wide asynchronous work uses `src/hooks/useTaskActivity.ts`; do not reintroduce a single global `isBusy` boolean.

### Signatures

```ts
type AppTaskKind = "scan" | "generate" | "polish" | "export" | "interaction";
type ActiveTaskState = Partial<Record<AppTaskKind, string>>;

taskCanStart(activeTasks, nextKind): boolean;
taskIsActive(activeTasks, kind): boolean;
useTaskActivity(): { activeTasks, tryStartTask, finishTask };

type RunTaskInput = {
  kind: AppTaskKind;
  label: string;
  task: () => Promise<void>;
  validate?: () => void;
  allowDuringPolishReview?: boolean;
};
```

`App.tsx` owns the activity hook and calls `runTask(input)`. Components receive `ActiveTaskState` and derive button-specific disabled/loading behavior through the shared helpers. Keep task arguments in the input object so validation and narrow policy exceptions do not grow positional parameters.

### Contracts

- React state drives rendering, while an internal ref is updated synchronously before `setState`; this prevents same-tick double clicks from passing the conflict guard twice.
- `generate` is the only task that replaces `MarkdownPreview` with blocking extraction progress.
- `scan`, `polish`, `export`, and `interaction` keep the current report visible and show progress at the owning button or panel.
- `finishTask(kind)` removes only the completed kind, so an unrelated concurrent task remains active.
- Synchronous navigation and settings entry points stay outside the task registry; clipboard operations use `interaction` because they are asynchronous and can be double-clicked.

### Conflict Matrix

| Starting task | Conflicts with |
| --- | --- |
| `scan` | `scan`, `generate` |
| `generate` | every task kind |
| `polish` | `generate`, `polish`, `export` |
| `export` | `generate`, `polish`, `export` |
| `interaction` | `generate`, `interaction` |

The matrix is the single source of truth for both UI disabled states and the `runTask` invocation guard. Do not duplicate it as ad hoc component conditions.

### Good / Bad

```ts
// Good: preview policy and invoke guard use the same task kind.
const exportBlocked = !taskCanStart(activeTasks, "export");
await runTask({
  kind: "export",
  label: "正在导出报告",
  task: saveReport,
  validate: validateOutput,
});

// Bad: one boolean disables unrelated controls and hides the report.
setIsBusy(true);
return isBusy ? <PreviewLoading /> : <MarkdownPreview />;
```

### Tests Required

- Use the Playwright Tauri mock's `deferredCommands` and `releaseCommand()` support to assert UI state while a command is genuinely pending.
- Cover at least one blocking `generate` task, two non-blocking tasks (`polish` and `export`), same-tick duplicate prevention, and scan cancellation/progress ownership.
- Assert both sides of the policy: conflicting actions are disabled, while copy/settings/preview remain available where the matrix allows them.

## Pending AI Polish Review

AI output is an untrusted draft until the user explicitly accepts it. `App.tsx` owns one in-memory review snapshot and never persists it across restarts.

### Signatures

```ts
type ReportPolishReview = {
  mode: PreviewMode;
  range: DateRange;
  periodLabel: string;
  originalText: string;
  polishedText: string;
  warnings: string[];
  repoCount: number;
  commitCount: number;
  projectCount: number;
  supplementalItems: string[];
};

buildReportDiff(originalText, polishedText): ReportDiffResult;
detectPolishFactRisks(originalText, lines): PolishFactRisk[];
```

### Contracts

- A successful `enhance_report` call creates `ReportPolishReview`; it must not update preview text, report history, or an output file.
- Capture the source mode, range, counts, and supplemental facts when the review is created. Scan/settings changes may remain available, so acceptance must not recompute source metadata from current state.
- Accepting may write the configured output file, then applies the polished text and creates the AI history entry. If saving fails, keep the review open for retry.
- Rejecting or pressing `Escape` only clears the review and returns focus to the AI polish button; it must not write history or files.
- While a review is pending, block generation, another polish, export, report type/period changes, and history opening. Keep scan, copy, settings, and review scrolling available.
- An AI warning/failure keeps the local draft and does not create a review.

### Bounded Diff and Risk Hints

- Normalize CRLF/CR to LF and preserve blank lines.
- Use line-level LCS only while `oldLineCount * newLineCount <= 200_000`.
- Above that limit, preserve the common prefix/suffix and present the middle as whole-block removal/addition with a visible fallback explanation.
- Risk detection is heuristic only: new metrics, new strong conclusions, and removed evidence/user-fact lines. Show at most eight unique hints and never mutate the polished text.

### Good / Bad

```ts
// Good: AI success creates a review with zero persistence side effects.
setPolishReview({ originalText: baseReport, polishedText: result.reportText, ...sourceSnapshot });

// Bad: applying AI output before the user can audit it.
setActivePreviewText(activePreview, result.reportText);
rememberHistory(buildHistoryEntry(result.reportText));
```

### Tests Required

- Assert preview, history, and `save_report_file` remain unchanged before acceptance.
- Cover accept, reject, `Escape`, AI failure, focus return, and pending-review operation locks.
- Cover added/removed/unchanged rendering, all heuristic categories, and the visible bounded-fallback state.
- Verify light and dark themes for the inline review surface.

## Workspace Health Projection and Repository Cache Ownership

### 1. Scope / Trigger

- Trigger: the UI needs to inspect cached repository paths without turning health status into persisted source-of-truth state.
- `App.tsx` continues to own roots, repositories, disabled paths, and scan time. `useWorkspaceHealth` owns only the transient command result and request lifecycle.

### 2. Signatures

```ts
useWorkspaceHealth(params: {
  rootDirs: string[];
  indexedRepos: RepoInfo[];
  disabledRepos: string[];
}): {
  result: WorkspaceHealthResult | null;
  loading: boolean;
  error: string;
  refresh(reposOverride?: RepoInfo[]): Promise<void>;
  refreshIfLoaded(reposOverride: RepoInfo[]): void;
  setRepoDisabled(path: string, disabled: boolean): void;
  setReposDisabled(paths: string[], disabled: boolean): void;
  removeRepo(path: string): void;
};

saveRepoIndexCache(rootDirs, repos): RepoIndexCache;
persistRepoIndexCache(cache): RepoIndexCache;
```

### 3. Contracts

- Opening the health tab with no result triggers one on-demand inspection. Health results are never written to localStorage.
- The hook reads the latest roots/repos/disabled paths through refs so long-running callers do not reuse stale render closures.
- One request version owns each result. A root change invalidates the prior version, clears the old result/error/loading state, and permits a new request even if the old promise is still pending.
- Same-context duplicate refreshes are ignored while one request is active. A superseded request must not clear or overwrite a newer request.
- Scan completion calls `refreshIfLoaded(scannedRepos)`: refresh an already initialized or in-flight health view with the exact scan result, superseding the older request when necessary, but do not inspect for users who never opened health.
- Single/bulk toggle and remove actions update the App source of truth and optimistically project the same change into the health result.
- `scannedAt` changes only through `saveRepoIndexCache` after a real scan. Removing an index entry calls `persistRepoIndexCache` with the original timestamp.
- Removing an index entry requires confirmation, removes only GitPulse cache/settings state, and never deletes the local directory.

### 4. Validation & Error Matrix

- No roots and no indexed repositories -> show the actionable workspace empty state.
- First inspection pending -> show a bounded skeleton while keeping header actions available.
- First inspection fails -> show the Chinese error with retry; do not invent a healthy summary.
- Refresh fails with an existing result -> keep the last result in memory and expose the error state for retry behavior.
- Roots change while a request is pending -> issue a new-version request; ignore the old response.
- Scan completes after the health tab loaded mid-scan -> refresh with `RepoScanResult.repos`, not the pre-scan closure.
- Malformed/missing cache time -> render `尚未完成扫描`; do not derive health time in Rust.

### 5. Good/Base/Bad Cases

- Good: health opens lazily, then a rescan refreshes repository rows and scan time together.
- Base: users who stay on report/insights never pay for branch health inspection.
- Good: removing a missing repository updates the health table, repository drawer, generation scope, disabled paths, and cache while preserving `scannedAt`.
- Bad: persist `WorkspaceHealthResult`; path/branch status becomes stale as soon as the filesystem changes.
- Bad: guard all requests with one boolean that survives a root change; the new workspace request can be swallowed by the old one.
- Bad: test `workspaceHealth.result` from a scan-start render; users opening health during the scan can retain old repository rows.

### 6. Tests Required

- Playwright covers empty, healthy, partially invalid, light, and dark states plus refresh, toggle, remove, and generation-scope synchronization.
- Defer `inspect_workspace_health` and assert a root change starts a second request whose payload uses empty/new roots and repositories.
- Defer `scan_repos`, open health while it is pending, then assert scan completion refreshes health with returned repositories.
- Assert removal preserves the stored `scannedAt`, while a real scan produces a new timestamp.
- Run `npm run build` and full `npm run test:e2e` after changing this contract.

### 7. Wrong vs Correct

#### Wrong

```ts
if (workspaceHealth.result) {
  void workspaceHealth.refresh(scanResult.repos); // Captures scan-start render state.
}
```

#### Correct

```ts
workspaceHealth.refreshIfLoaded(scanResult.repos);

// The hook reads current result/params refs and request version internally.
```

## Filtered Repository Batch Scope

### Signatures

```ts
type RepoStatusFilter = "all" | "enabled" | "disabled";

setReposEnabled(repoPaths: string[], enabled: boolean): void;

type RepositoryPanelProps = {
  repos: RepoInfo[];
  disabledRepos: string[];
  projectNames: Record<string, string>;
  onSetReposEnabled(paths: string[], enabled: boolean): void;
};
```

### Contracts

- `RepositoryPanel` owns transient query/status UI state. Search is trimmed, case-insensitive substring matching over original name, `resolveRepoDisplayName`, path, and cached branch.
- Status filtering and query matching produce one `visibleEntries` collection. Batch paths must be mapped directly from that final collection; do not re-run a second filter in App.
- “启用当前结果” and “禁用当前结果” are disabled when no visible repository would actually change.
- App deduplicates the received paths and performs one functional `settings.disabledRepos` update.
- Enabling removes only received paths. Disabling appends only received paths. Unmatched repositories and stale disabled paths remain untouched.
- The same changed-path list is sent to `useWorkspaceHealth.setReposDisabled`; generation scope, health projection, repository rows, and persisted settings therefore converge in one render cycle.
- Bulk toggle is reversible and does not require confirmation. Status feedback includes the actual changed count.
- When every indexed repository is disabled, the UI states that generation scope is zero and routes users to the disabled filter before bulk recovery.

### Good / Base / Bad Cases

- Good: query `api` with two matches disables those two paths, keeps three unmatched repositories unchanged, and preserves a stale disabled path.
- Base: blank query + `all` targets the whole current index.
- Good: `disabled` filter + query restores only the disabled matches and leaves other disabled repositories unchanged.
- Bad: pass every repository path to App and ask App to repeat the component filter; mapping/search semantics can drift.
- Bad: replace `disabledRepos` with only the visible result; hidden and stale disabled paths are silently lost.

### Tests Required

- Playwright searches by original/mapped name, path, and branch and combines each with status filters.
- Assert batch disable/restore updates generation scope, repository counts, localStorage, and an already-loaded workspace health result.
- Assert unmatched repositories and stale disabled paths survive the round trip.
- Cover the all-disabled dark-theme recovery path and search-empty reset action.
