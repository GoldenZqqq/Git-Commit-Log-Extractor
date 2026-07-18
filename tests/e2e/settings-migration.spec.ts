import { expect, test, type Page } from "@playwright/test";
import {
  createRepo,
  createRepoCache,
  createSettings,
  expectWorkbench,
  launchApp,
} from "./support/tauri";

const STORAGE_KEY = "gitpulse-settings";
const LEGACY_KEY = "git-report-studio-settings";
const MIGRATION_BACKUP_KEY = "gitpulse-settings-migration-backup";
const CORRUPT_BACKUP_KEY = "gitpulse-settings-corrupt-backup";

test("normalizes a v0.5.1 settings snapshot and preserves its safe key reference", async ({ page }) => {
  const raw = {
    onboardingDone: true,
    rootDirs: ["C:/legacy-workspace", 42],
    author: "Legacy Author",
    outputEnabled: "false",
    themeMode: "removed-theme",
    aiKeyEnv: "OPENAI_API_KEY",
    aiTemperature: "0.7",
    reportHistoryLimit: "30",
  };
  const repo = createRepo("C:/legacy-workspace/gitpulse", "gitpulse", "main");
  await launchApp(page, {
    settingsRaw: JSON.stringify(raw),
    repoCache: createRepoCache(["C:/legacy-workspace"], [repo]),
  });

  await expectWorkbench(page);
  const stored = await storedSettings(page);
  expect(stored.rootDirs).toEqual(["C:/legacy-workspace"]);
  expect(stored.author).toBe("Legacy Author");
  expect(stored.outputEnabled).toBe(false);
  expect(stored.themeMode).toBe("system");
  expect(stored.commitItemPrefixMode).toBe("mapped-project");
  expect(stored.reportPurposePreset).toBe("custom");
  expect(stored.aiTemperature).toBe(0.2);
  expect(stored.reportHistoryLimit).toBe(120);
  expect(stored.aiApiKey).toBe("OPENAI_API_KEY");
  expect(Object.hasOwn(stored, "aiKeyEnv")).toBe(false);
});

test("keeps the only raw legacy key backup when secure storage migration fails", async ({ page }) => {
  const legacy = createSettings({
    aiApiKey: "",
    aiApiKeySaved: false,
    aiKeyEnv: "sk-v051-only-copy",
  });
  await launchApp(page, {
    settingsRaw: JSON.stringify(legacy),
    secureApiKeySaveError: "系统凭据库暂时不可写",
  });

  await expectWorkbench(page);
  await expect.poll(() => commandCount(page, "set_secure_ai_api_key")).toBeGreaterThan(0);
  await expect(page.getByRole("alert")).toContainText("系统凭据库暂时不可写");
  expect((await storedSettings(page)).aiApiKey).toBe("");
  expect(await storageValue(page, MIGRATION_BACKUP_KEY)).toContain("sk-v051-only-copy");
});

test("backs up a raw current aiApiKey until secure storage accepts it", async ({ page }) => {
  const current = createSettings({
    aiApiKey: "sk-current-only-copy",
    aiApiKeySaved: false,
  });
  await launchApp(page, {
    settingsRaw: JSON.stringify(current),
    secureApiKeySaveError: "系统凭据库暂时不可写",
  });

  await expectWorkbench(page);
  await expect.poll(() => commandCount(page, "set_secure_ai_api_key")).toBeGreaterThan(0);
  expect((await storedSettings(page)).aiApiKey).toBe("");
  expect(await storageValue(page, MIGRATION_BACKUP_KEY)).toContain("sk-current-only-copy");
});

test("retries the backed-up raw key and finalizes migration only after secure storage succeeds", async ({ page }) => {
  const current = createSettings({
    author: "Current Author",
    projectNamesText: "current(*) -> 当前项目",
    aiApiKey: "",
    aiApiKeySaved: false,
  });
  const backup = createSettings({
    author: "Old Author",
    projectNamesText: "old(*) -> 旧项目",
    aiApiKey: "",
    aiApiKeySaved: false,
    aiKeyEnv: "sk-v051-retry",
  });
  await launchApp(page, {
    settingsRaw: JSON.stringify(current),
    settingsMigrationBackupRaw: JSON.stringify(backup),
  });

  await expectWorkbench(page);
  await expect.poll(() => commandArgs(page, "set_secure_ai_api_key")).toMatchObject({
    apiKey: "sk-v051-retry",
  });
  await expect.poll(() => storageValue(page, MIGRATION_BACKUP_KEY)).toBeNull();
  expect(await storageValue(page, LEGACY_KEY)).toBeNull();
  const stored = await storedSettings(page);
  expect(stored.author).toBe("Current Author");
  expect(stored.projectNamesText).toBe("current(*) -> 当前项目");
  expect(stored.aiApiKey).toBe("");
  expect(stored.aiApiKeySaved).toBe(true);
});

test("preserves a corrupt current payload and falls back to valid legacy settings", async ({ page }) => {
  const legacy = {
    rootDir: "C:/fallback-workspace",
    author: "Fallback Author",
    aiKeyEnv: "env:OPENAI_API_KEY",
  };
  const repo = createRepo("C:/fallback-workspace/gitpulse", "gitpulse", "main");
  await launchApp(page, {
    settingsRaw: "{broken-current",
    legacySettingsRaw: JSON.stringify(legacy),
    repoCache: createRepoCache(["C:/fallback-workspace"], [repo]),
  });

  await expectWorkbench(page);
  const stored = await storedSettings(page);
  expect(stored.rootDirs).toEqual(["C:/fallback-workspace"]);
  expect(stored.author).toBe("Fallback Author");
  expect(stored.aiApiKey).toBe("env:OPENAI_API_KEY");
  expect(await storageValue(page, CORRUPT_BACKUP_KEY)).toBe("{broken-current");
  await expect.poll(() => storageValue(page, LEGACY_KEY)).toBeNull();
  await expect.poll(() => storageValue(page, MIGRATION_BACKUP_KEY)).toBeNull();
});

async function storedSettings(page: Page) {
  await expect.poll(() => storageValue(page, STORAGE_KEY)).not.toBeNull();
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), STORAGE_KEY);
}

async function storageValue(page: Page, key: string) {
  return page.evaluate((storageKey) => localStorage.getItem(storageKey), key);
}

async function commandCount(page: Page, command: string) {
  return page.evaluate((name) => window.__mockTauri.calls.filter((call) => call.cmd === name).length, command);
}

async function commandArgs(page: Page, command: string) {
  return page.evaluate((name) => window.__mockTauri.calls.find((call) => call.cmd === name)?.args, command);
}
