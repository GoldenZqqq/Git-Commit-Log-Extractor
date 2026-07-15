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
```

`App.tsx` owns the activity hook and calls `runTask(kind, label, task, validate)`. Components receive `ActiveTaskState` and derive button-specific disabled/loading behavior through the shared helpers.

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
await runTask("export", "正在导出报告", saveReport, validateOutput);

// Bad: one boolean disables unrelated controls and hides the report.
setIsBusy(true);
return isBusy ? <PreviewLoading /> : <MarkdownPreview />;
```

### Tests Required

- Use the Playwright Tauri mock's `deferredCommands` and `releaseCommand()` support to assert UI state while a command is genuinely pending.
- Cover at least one blocking `generate` task, two non-blocking tasks (`polish` and `export`), same-tick duplicate prevention, and scan cancellation/progress ownership.
- Assert both sides of the policy: conflicting actions are disabled, while copy/settings/preview remain available where the matrix allows them.
