# Settings Migration And Recovery

## 1. Scope / Trigger

Apply this contract when loading/persisting `AppSettings`, adding defaults, changing localStorage keys, or moving a legacy API key into OS secure storage. The v0.5.1 → v0.5.3 path must remain restart-safe even if localStorage is malformed or the credential backend is temporarily unavailable.

## 2. Signatures

```ts
loadSettingsState(): {
  settings: AppSettings;
  recoveredLegacyApiKey: boolean;
  recoveredCorruptedSettings: boolean;
  settingsMigrationPending: boolean;
};

settingsForPersistence(settings: AppSettings): AppSettings;
finalizeSettingsMigration(): void;
```

Storage keys:

```text
gitpulse-settings                    current normalized settings
git-report-studio-settings           older settings candidate
gitpulse-settings-migration-backup   one restart-safe migration source
gitpulse-settings-corrupt-backup     last unparseable current payload
```

## 3. Contracts

- Candidate priority is valid current settings, valid older settings, then a valid migration backup. A valid current object owns business fields.
- A migration backup may supplement only a missing legacy `aiKeyEnv`; it never rolls back newer business settings.
- Persisted strings, booleans, arrays, enums, temperature, templates, and history limit are strictly normalized. Wrong types use current defaults; string values such as `"false"` are never coerced to booleans.
- Legacy-only keys (`aiKeyEnv`, `rootDir`, old date fields) are removed from the normalized object. `rootDir` may populate an empty `rootDirs` array.
- Plain settings never store a raw API key or proxy password. Environment references remain in `aiApiKey`; raw keys move through `set_secure_ai_api_key`.
- The original payload is kept in `gitpulse-settings-migration-backup` until normalized settings have been written and any raw key has been accepted by secure storage.
- `finalizeSettingsMigration` removes only the older settings key and migration backup. It never removes `gitpulse-settings-corrupt-backup`.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Current JSON/object is valid | Normalize and use it. |
| Current payload is malformed | Copy exact text to corrupt backup, remove the unusable current key, then try older/migration candidates. |
| Current malformed, older valid | Start with older settings, report recovery, and migrate through the normal pending flow. |
| Missing new v0.5.3 fields | Fill current defaults without changing valid v0.5.1 fields. |
| Legacy environment reference | Persist the safe reference, then finalize local migration. |
| Legacy raw API key, secure write succeeds | Mark saved and finalize migration backup/older key. |
| Legacy raw API key, secure write fails | Show a Chinese error, keep migration backup, and retry on the next launch. |
| Migration backup plus newer current settings | Recover only the missing key; preserve newer current business fields. |

## 5. Good / Base / Bad Cases

- Good: a v0.5.1 snapshot keeps its workspace, author, and `OPENAI_API_KEY`, gains v0.5.3 defaults, and drops legacy-only fields.
- Good recovery: corrupt current settings plus a valid older payload starts the workbench and retains the exact corrupt text for manual recovery.
- Base: no settings candidate returns a fresh copy of `defaultSettings`.
- Bad: delete the old key in `loadSettingsState` before React persistence or secure storage completes.
- Bad: spread unvalidated JSON directly into runtime state; `outputEnabled: "false"` becomes a truthy non-boolean.

## 6. Tests Required

- `tests/e2e/settings-migration.spec.ts` covers v0.5.1 defaults/types, safe env references, raw-key secure failure, restart retry/success, and corrupt-current fallback.
- Config-profile E2E must prove merge/replace and invalid imports preserve env references, secure flags, local paths, and credential commands.
- Run `npm run build`, targeted migration/config/history Playwright, full E2E, and real Windows Tauri smoke.

## 7. Wrong vs Correct

### Wrong

```ts
const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
localStorage.removeItem(LEGACY_KEY);
const settings = { ...defaultSettings, ...JSON.parse(saved ?? "{}") };
```

### Correct

```ts
const loaded = loadSettingsState(); // Parses candidates, backs up, then normalizes.
localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsForPersistence(loaded.settings)));

if (await persistLegacyKeyToSecureStore()) {
  finalizeSettingsMigration();
}
```
