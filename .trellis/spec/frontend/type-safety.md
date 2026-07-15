# Type Safety

> Type safety patterns in GitPulse.

---

## Overview

The frontend is TypeScript-first and mirrors Rust command payloads manually. Runtime validation is implemented with small explicit functions instead of a validation library.

---

## Type Organization

- Put cross-component app types in `src/model.ts`, including `AppSettings`, `RepoInfo`, `RepoScanResult`, `ExtractResult`, `PeriodReportResult`, and `PreviewMode`.
- Keep component-only props and helper types inside the component file.
- When a Tauri command payload changes, update both `src/model.ts` and the corresponding Rust struct in `src-tauri/src/models.rs`.
- Rust structs use `#[serde(rename_all = "camelCase")]`, so frontend fields should remain camelCase.

---

## Validation

- Use explicit validators such as `validateWorkspaceSettings`, `validateDateRange`, `validateOutputSettings`, and `validateAiConnectionSettings`.
- Parse persisted JSON defensively and recover to defaults when the stored shape is invalid.
- Use type guards for persisted collections, as with report history and repository cache entries.
- Preserve user-facing validation errors in Chinese.

---

## Common Patterns

- Use literal unions for modes and option sets: `PreviewMode`, `ReportExportFormat`, `ThemeMode`, `CommitItemPrefixMode`.
- Normalize unknown persisted values back to supported union members.
- Use helper builders such as `buildExtractOptions`, `buildPeriodReportOptions`, and `buildReportEnhanceOptions` as the single frontend boundary to Rust command options.

---

## Forbidden Patterns

- Do not use `any` for Tauri payloads or persisted settings.
- Do not cast raw persisted JSON directly into app state without validation/normalization.
- Do not add a frontend type that diverges from the Rust command model without documenting the boundary.
