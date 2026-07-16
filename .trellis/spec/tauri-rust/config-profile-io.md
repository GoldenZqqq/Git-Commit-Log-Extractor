# Versioned Shareable Configuration Profiles

## Scenario: Import And Export A Safe GitPulse Configuration Profile

### 1. Scope / Trigger

- Trigger: users need to move reusable report configuration between devices or teammates without copying local paths, history, credentials, or connection settings.
- The profile is a user-selected JSON file. It is not the same contract as `settingsForPersistence`, which remains a local application-state snapshot.

### 2. Signatures

Frontend contract:

```ts
type ConfigProfile = {
  schemaVersion: 1;
  exportedAt: string;
  settings: ConfigProfileSettings;
};

parseConfigProfile(content: string): ConfigProfile;
serializeConfigProfile(settings: AppSettings): string;
applyConfigProfile(
  current: AppSettings,
  profile: ConfigProfile,
  strategy: "merge" | "replace",
): ConfigProfileSettings;
```

Tauri commands:

```rust
async fn read_text_file(path: String) -> Result<String, String>;
async fn write_text_file(path: String, content: String) -> Result<(), String>;
```

### 3. Contracts

- V1 root keys are exactly `schemaVersion`, `exportedAt`, and `settings`.
- V1 settings contain only project mappings, author aliases, evidence links, report format/prompt templates, `commitItemPrefixMode`, `showEvidenceDetails`, `reportPurposePreset`, and `reportTemplateProfile`.
- Export code constructs this object field-by-field. It must never spread `AppSettings` into a shareable file.
- API keys, OAuth state, proxy data, author scope, roots/output paths, disabled repositories, report history, redaction rules, and other unlisted fields remain local.
- Import validates the whole envelope before exposing a preview or applying state.
- `merge` combines mapping/alias/evidence rules by the key before `->`; imported conflicts win and unrelated local rules remain. Scalar/template fields use the imported value.
- `replace` replaces every whitelisted field but leaves all non-whitelisted settings and secure storage untouched.
- File reads/writes are bounded to 2 MiB and run through `spawn_blocking`; React only chooses a path and invokes the command.

### 4. Validation & Error Matrix

- JSON parse failure -> `配置方案不是有效的 JSON 文件`.
- Unknown `schemaVersion` -> `不支持的配置方案版本：<version>`.
- Missing root/settings key -> `...缺少字段：...`.
- Unknown root/settings key -> `...包含未知字段：...`; never ignore a potential secret field.
- Invalid enum/boolean/string -> field-specific Chinese type/value error.
- Non-comment rule line without non-empty `name -> value` -> line-numbered format error.
- File or content larger than 2 MiB -> `配置方案不能超过 2 MiB`.
- Invalid UTF-8 -> `配置方案必须使用 UTF-8 编码`.
- Cancel file selection or preview -> no settings mutation and no success message.
- Any validation/read failure -> keep the existing in-memory and persisted settings unchanged.

### 5. Good / Base / Bad Cases

- Good: export contains team mappings, aliases, evidence links, and templates while a raw API key and `C:\workspace` never appear in the JSON.
- Good: merge updates `JIRA` and preserves a local-only evidence rule; replace removes local-only shareable rules while keeping roots and secure credentials.
- Base: export then replace-import of a valid V1 profile preserves all shareable fields.
- Bad: reuse `settingsForPersistence` or `{ ...settings }`; this can leak paths, provider data, or future fields silently.
- Bad: apply each field while parsing; a later invalid field leaves a partially imported configuration.
- Bad: let the WebView read files directly or accept an unbounded mocked payload that production Rust would reject.

### 6. Tests Required

- Rust unit tests assert UTF-8 round trip, oversized read/write rejection, and invalid UTF-8 rejection.
- Playwright export parses the actual `write_text_file` payload, asserts exact fields, and searches the serialized string for representative secrets and paths.
- Playwright import covers preview counts, cancel, merge conflicts, replace, unknown version, unknown field, damaged JSON, oversized input, and preservation of non-shareable settings.
- Assert import does not invoke credential-clear commands.
- Run `npm run build`, relevant settings/workbench Playwright, `cargo fmt -- --check`, `cargo check`, and `cargo test`.

### 7. Wrong vs Correct

#### Wrong

```ts
const profile = { schemaVersion: 1, settings: { ...settings } };
onApply(JSON.parse(content).settings);
```

#### Correct

```ts
const content = serializeConfigProfile(settings); // Explicit whitelist.
const profile = parseConfigProfile(content);      // Full strict validation.
const patch = applyConfigProfile(settings, profile, strategy);
onApply(patch);                                    // One atomic state update.
```
