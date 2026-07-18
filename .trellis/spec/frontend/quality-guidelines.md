# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Frontend changes should preserve a reliable local desktop workflow: scan repositories, choose scope, generate a report, optionally polish it, then copy/export it.

---

## Forbidden Patterns

- No Python runtime dependency on `main`.
- No direct filesystem or Git shell work from React; use Tauri commands.
- No raw API keys in localStorage or plain settings.
- No marketing-page layout patterns inside the desktop workbench.
- No hidden primary report controls or hover-only critical controls.

---

## Required Patterns

- Keep local-first privacy and traceability visible in copy and behavior.
- Long-running scan/extract operations should show progress and allow graceful status updates.
- AI failures must fall back to the current local report draft or local template.
- Report history and repository cache writes should be bounded and recover from malformed localStorage.
- Commit evidence detail must preserve repository, branch, date, hash, and original message context.

---

## Testing Requirements

- Run `npm run build` for TypeScript/build verification after frontend changes.
- Run targeted Playwright tests when changing onboarding, workbench generation controls, report history, settings, or export UX.
- For release-impacting changes, follow `CONTRIBUTING.md`: `npm run build`, `npm run test:e2e`, `cd src-tauri && cargo check && cargo test`.
- Dialog and menu changes require Playwright focus assertions for entry, Tab/Escape, keyboard navigation, and trigger restoration. Scan the changed overlay with `@axe-core/playwright` and fail on `serious` or `critical` violations.
- Axe scans must target the changed overlay when unrelated legacy surfaces are outside task scope. Do not disable the `color-contrast` rule to force a pass; fix contrast tokens or component colors found inside the target.

---

## Tauri WebView2 Dark Mode — Native Controls

On Windows, Tauri uses WebView2 (Chromium). Native form controls (`<input type="date">`, `<select>`, etc.) render their own icons and chrome, which default to light-on-white and become invisible on dark backgrounds. Every native control in a dark theme must be explicitly handled:

1. **`<input type="date/month/week">`**: Set `color-scheme: dark` in the dark theme override (theme.css). Do NOT use `background-image` on date inputs — WebView2 duplicates it infinitely (same bug as select arrows). Do NOT combine `color-scheme: dark` with `filter: invert()` — they cancel each other out. Do NOT use `position: absolute` on `::-webkit-calendar-picker-indicator` to expand the click area — it distorts the icon size. For "click anywhere opens picker" behavior, use a global `showPicker()` event delegation in App.tsx instead.

2. **`<select>`**: Must use `appearance: none` and a custom SVG arrow via `background-image`. WebView2's built-in select arrow renders as an infinite-duplication bug in dark mode without this workaround. Unlike date inputs, `background-image` works on select elements because `appearance: none` disables the native rendering entirely.

3. **General rule**: Never use `background-image` on a native form control that retains its default `appearance`. WebView2 duplicates the background behind the native chrome. Either use `appearance: none` (select) or `color-scheme: dark` (date/month/week). Verify in both light and dark themes on Windows before marking complete.

---

## Code Review Checklist

- Does this keep Git/filesystem work behind Rust?
- Does every new command payload match `src-tauri/src/models.rs`?
- Are empty and failure states useful without AI?
- Are status messages, validation errors, and labels clear in Chinese?
- Does the UI remain usable in both light and dark themes?
- Are secrets stored only through secure storage or safe environment-variable references?

## Responsive Layout Contract

- `body` supports down to 320 CSS pixels; never restore a desktop-wide `min-width` that makes the document horizontally scroll at the target viewport.
- Keep the fixed-height two-column workbench at normal desktop widths. At or below the existing 1040px content breakpoint, switch the root to natural height and document vertical scrolling so the report, assist rail, and health/insights surfaces remain reachable.
- At or below 720px, stack report controls and allow action groups/popovers to wrap within `calc(100vw - local padding)`. Do not use horizontal scrolling to reveal generation, settings, copy, or export actions.
- Shared dialogs use `max-height: calc(100dvh - local padding)` and `overflow-y: auto`; narrow/small-height variants keep the header and close control sticky or outside the scrolling content.
- Responsive Playwright coverage must include `320×900`, `640×450` (200% equivalent CSS viewport), and `1280×480`, checking document/card `scrollWidth`, key bounding boxes, dialog bounds, and screenshot artifacts.
