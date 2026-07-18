# BIZ-14 Implementation Plan

## Implementation

- [x] Add `configProfile.ts` with v1 whitelist types, strict parser, exporter, summary, merge, and replace helpers.
- [x] Add bounded Rust UTF-8 read/write helpers with unit tests and register `read_text_file` / `write_text_file` commands.
- [x] Add `ConfigProfileSection` to General settings with export/import actions, pre-apply summary, strategy selection, cancel, and feedback.
- [x] Add an atomic settings patch callback from `App` through `SettingsDialog`.
- [x] Extend the Playwright Tauri mock for JSON file reads/writes and add configuration profile coverage.

## Validation

- [x] `npm run build`
- [x] `npm run test:e2e -- tests/e2e/config-profile.spec.ts`
- [x] `npm run test:e2e -- tests/e2e/workbench.spec.ts`
- [x] `cargo fmt -- --check` in `src-tauri`
- [x] `cargo check` in `src-tauri`
- [x] `cargo test config_profile_io` in `src-tauri`
- [x] `git diff --check`

## Risk And Rollback Points

- Do not construct the export object with `...settings`; this is the primary secret-leak rollback gate.
- Do not apply settings until validation and explicit confirmation succeed.
- Keep file I/O generic and bounded; schema decisions stay in the frontend pure module.
- If the settings UI becomes too large, keep all workflow state in `ConfigProfileSection` rather than expanding `SettingsDialog`.
