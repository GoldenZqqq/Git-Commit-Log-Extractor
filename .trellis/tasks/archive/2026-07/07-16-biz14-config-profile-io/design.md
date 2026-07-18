# BIZ-14 Technical Design

## Boundaries

- `src/configProfile.ts` owns the versioned shareable schema, strict parsing, export serialization, summaries, and merge/replace application.
- `src/components/ConfigProfileSection.tsx` owns file selection, preview state, conflict strategy, and user feedback.
- `SettingsDialog` only hosts the section and applies an atomic `Partial<AppSettings>` patch.
- `src-tauri/src/config_profile_io.rs` owns bounded UTF-8 text reads and writes. It does not understand settings or decide which fields are shareable.

## Schema

The v1 JSON envelope contains only:

```text
schemaVersion
exportedAt
settings:
  projectNamesText
  authorAliasesText
  evidenceLinkPrefixesText
  commitItemPrefixMode
  showEvidenceDetails
  reportPurposePreset
  reportTemplateProfile
  dailyReportFormatTemplate
  weeklyReportFormatTemplate
  monthlyReportFormatTemplate
  customReportFormatTemplate
  dailySystemPrompt
  monthlySystemPrompt
```

All root and settings keys are exact. Unknown keys are rejected instead of silently copied. The parser validates enum values, booleans, strings, required fields, and a bounded input length.

## Data Flow

### Export

1. Build a v1 envelope from the explicit frontend whitelist.
2. Open a JSON save dialog.
3. Send the selected path and serialized JSON to `write_text_file`.
4. Show a local success/error result.

### Import

1. Open a JSON file dialog and call bounded `read_text_file`.
2. Parse and strictly validate the envelope without changing settings.
3. Show counts for mappings, aliases, evidence rules, report templates, and prompt templates.
4. Apply either merge or replace to produce a whitelist-only patch.
5. Atomically merge the patch into `AppSettings`; all non-shareable fields retain their current values.

## Conflict Semantics

- Rule text uses the text before `->` as its stable key. Imported values replace matching keys and append new keys while preserving unrelated local entries.
- Project mapping merge reuses the existing parser/serializer semantics.
- Template, preset, enum, and boolean values are scalar; both strategies apply the imported value.
- Replace uses the imported rule text verbatim after normalization.

## Security And Compatibility

- The export builder cannot observe non-whitelisted fields, so secrets and paths cannot leak through object spreading.
- Rust rejects files larger than 2 MiB before reading and rejects invalid UTF-8.
- Only schema version 1 is accepted. Unsupported versions return an actionable error and do not partially apply data.
- Existing local persistence, secure credential storage, Excel mapping import, and OAuth implementation are unchanged.

## Rollback

The feature is additive. Rolling back removes the new section, pure schema module, and two generic bounded text commands without changing stored settings.
