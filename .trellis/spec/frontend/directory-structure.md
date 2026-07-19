# Directory Structure

> How frontend code is organized in GitPulse.

---

## Overview

GitPulse uses a compact single-app structure. `src/App.tsx` orchestrates the workbench and settings state, `src/model.ts` owns frontend types/defaults/validation/option builders, and `src/components/` contains focused UI surfaces.

---

## Directory Layout

src/
├── App.tsx
├── main.tsx
├── model.ts
├── model/
├── reportFormat.ts
├── components/
├── hooks/
└── styles/
```

---

## Module Organization

- Put reusable UI surfaces in `src/components/` using PascalCase file names, as in `Workbench.tsx`, `SettingsDialog.tsx`, and `ReportQualityPanel.tsx`.
- Put browser/Tauri runtime hooks in `src/hooks/`; `useAppRuntime.ts` is the current example for app version, theme, and updater integration.
- Keep `src/model.ts` as a compatibility barrel. Put shared types in `src/model/types.ts`, then group dates, settings migration/cache, repository mappings, report/history options, and support-bundle builders in focused `src/model/*.ts` modules.
- Keep App orchestration in focused hooks such as `useReportWorkflow`, `useAppSettingsState`, and `useWorkspaceDirectoryActions`; the root component should compose them and wire dialogs, not own every async operation.
- Put report template presets and template-specific helpers in `src/reportFormat.ts`.
- Put global CSS in `src/styles/` by concern: tokens, layout, components, preview, dialogs, onboarding, and theme.
- Do not add Python runtime code to `main`; this product is a React + Rust Tauri app.

---

## Naming Conventions

- Components and hooks use PascalCase files for components and `use*` names for hooks.
- Types use explicit exported type aliases near the data they describe, for example `AppSettings`, `RepoInfo`, and `ReportHistoryEntry`.
- CSS classes use kebab-case and product-oriented names such as `report-canvas`, `assist-rail`, and `generation-scope-strip`.
- Tauri command names are snake_case on the Rust side and invoked by that exact string from React.

---

## Examples

- `src/App.tsx`: root layout, task coordination, listeners, and dialog composition; report and secure-settings side effects belong in hooks.
- `src/components/Workbench.tsx`: dense desktop workbench layout with scoped helper components.
- `src/components/SettingsDialog.tsx`: settings surface wired through typed update callbacks.
- `src/model.ts`: stable barrel for settings migration, validation, mapping parsing, date helpers, history, and command option builders.
