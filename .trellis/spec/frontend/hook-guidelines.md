# Hook Guidelines

> How hooks are used in GitPulse.

---

## Overview

Hooks are used sparingly. Most app state lives in `App.tsx`; custom hooks are reserved for runtime integration that would otherwise clutter the app shell.

---

## Custom Hook Patterns

- Use `use*` names and return named values/functions in an object when a hook exposes multiple capabilities.
- Keep side effects inside `useEffect` with cleanup functions for event listeners.
- Keep Tauri runtime details inside hooks only when the hook owns a coherent runtime concern, as `useAppRuntime` owns theme, version, and updater state.
- Keep report generation/polish/export/history transitions together in `useReportWorkflow`; keep localStorage and secure-store synchronization together in `useAppSettingsState`.
- Initialize source state before constructing hooks that depend on it. For example, load settings and create report-history storage before passing either into the settings synchronization hook; do not close over a later `const` during hook initialization.
- Hook actions should receive a typed status/task callback from the root so task activity and support events remain single-source-of-truth.
- Workspace scan and cleanup orchestration belongs in one focused hook (`useWorkspaceScanning`) so scan progress, cache writes, structured health inspection, and cleanup-after-rescan share the same root-directory snapshot. Keep disk operations behind Tauri commands and expose typed intent callbacks to components.

## Overlay Focus Contract

Custom dialogs and popovers use `src/hooks/useOverlayFocus.ts`; do not add component-local document listeners for the same behavior.

```ts
useModalDialog({ open, onClose, closeEnabled? }): RefObject<HTMLElement>;

usePopover({
  open,
  onClose,
  anchorRef,
  restoreFocusRef?,
  itemSelector?,
  initialFocusSelector?,
}): RefObject<HTMLDivElement>;
```

- Modal containers set `aria-modal="true"`, `tabIndex={-1}`, and the returned ref. The hook focuses `[data-dialog-initial-focus]` or the first usable control, traps Tab, closes the topmost modal on Escape, and restores the original trigger.
- Pass `closeEnabled: false` while a running operation cannot be cancelled. This disables Escape without weakening the focus trap or the component's backdrop guard.
- Nested alert dialogs are DOM-later than their parent. Only the last visible modal handles Tab/Escape, so one Escape never closes both layers.
- Popover triggers expose `aria-haspopup`, `aria-expanded`, and `aria-controls`. Menus pass an `itemSelector` for ArrowUp/ArrowDown/Home/End; form-like popovers pass an `initialFocusSelector`.
- Outside pointer clicks and Tab departures close without stealing focus from the new target. Escape and direct close actions return focus to `restoreFocusRef` or the anchor.

> **Warning**: Do not open a listbox unconditionally from its input's `onFocus`. Escape closes the listbox and restores focus to that input; an `onFocus` opener immediately reopens it. Open from click or a direction-key handler instead.

---

## Data Fetching

- There is no React Query/SWR layer. Frontend data comes from localStorage, browser APIs, and explicit Tauri `invoke` calls.
- Long-running local operations should report progress through Tauri events and React state, as repository scanning and commit extraction do.
- Catch command/listener setup failures locally when the app can degrade gracefully.

---

## Naming Conventions

- Hook files use camelCase `use*` names, for example `useAppRuntime.ts`.
- Returned actions use imperative names such as `checkForUpdates` and `installUpdate`.
- State returned by hooks should match the product language used by the UI, for example `updateSummary`, `updateMessage`, and `updateBusy`.

---

## Common Mistakes

- Extracting a hook just to move ordinary component state out of sight.
- Forgetting to remove Tauri/browser listeners on cleanup.
- Letting hook state duplicate source-of-truth settings already owned by `App.tsx`.
- Adding a new `role="dialog"`, `role="alertdialog"`, `role="menu"`, or `role="listbox"` without the shared overlay hook and keyboard regression coverage.
