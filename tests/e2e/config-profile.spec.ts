import { expect, test, type Page } from "@playwright/test";
import { createSettings, expectWorkbench, launchApp } from "./support/tauri";

test("exports only the versioned shareable settings whitelist", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({
      rootDirs: ["C:/private/workspace"],
      outputDir: "C:/private/exports",
      author: "Private Author",
      projectNamesText: "api(*) -> API 平台",
      authorAliasesText: "团队 -> team@example.com",
      evidenceLinkPrefixesText: "JIRA -> https://jira.example.com/{id}",
      aiApiKey: "sk-secret-value",
      proxyUrl: "http://secret-proxy:7890",
      proxyPassword: "proxy-secret",
    }),
    dialogResponses: ["C:/exports/team-profile.json"],
  });
  await openConfigProfileSection(page);

  await page.getByRole("button", { name: "导出方案" }).click();

  const call = await lastCommand(page, "write_text_file");
  const payload = JSON.parse(String(call.args.content));
  expect(call.args.path).toBe("C:/exports/team-profile.json");
  expect(Object.keys(payload)).toEqual(["schemaVersion", "exportedAt", "settings"]);
  expect(Object.keys(payload.settings).sort()).toEqual(SHAREABLE_KEYS.toSorted());
  expect(payload.settings.projectNamesText).toBe("api(*) -> API 平台");
  expect(call.args.content).not.toContain("sk-secret-value");
  expect(call.args.content).not.toContain("secret-proxy");
  expect(call.args.content).not.toContain("C:/private");
  expect(call.args.content).not.toContain("Private Author");
  await expect(page.getByText("配置方案已导出：team-profile.json")).toBeVisible();
});

test("previews then merges or replaces shareable settings without touching secrets", async ({ page }) => {
  const mergeProfile = profile({
    projectNamesText: "shared(*) -> 导入名称\nremote(*) -> 远程项目",
    authorAliasesText: "团队 -> imported@example.com\n远程 -> remote@example.com",
    evidenceLinkPrefixesText: "JIRA -> https://new.example/{id}\nGH -> https://github.com/{id}",
    dailyReportFormatTemplate: "# 导入日报\n{commitItems}",
  });
  const replaceProfile = profile({
    projectNamesText: "only(*) -> 仅导入项目",
    authorAliasesText: "仅导入 -> only@example.com",
    evidenceLinkPrefixesText: "ONLY -> https://only.example/{id}",
  });
  await launchApp(page, {
    settings: createSettings({
      projectNamesText: "shared(*) -> 本机名称\nlocal(*) -> 本机项目",
      authorAliasesText: "团队 -> local@example.com\n本机 -> local-only@example.com",
      evidenceLinkPrefixesText: "JIRA -> https://old.example/{id}\nLOCAL -> https://local/{id}",
      aiApiKey: "env:OPENAI_API_KEY",
      aiApiKeySaved: false,
      proxyPasswordSaved: true,
      rootDirs: ["C:/workspace-stays-local"],
    }),
    dialogResponses: ["C:/profiles/merge.json", "C:/profiles/replace.json"],
    textFiles: {
      "C:/profiles/merge.json": JSON.stringify(mergeProfile),
      "C:/profiles/replace.json": JSON.stringify(replaceProfile),
    },
  });
  await openConfigProfileSection(page);

  await page.getByRole("button", { name: "导入方案" }).click();
  const preview = page.getByRole("region", { name: "配置方案导入预览" });
  await expect(preview).toContainText("merge.json");
  await expect(preview).toContainText("项目映射2");
  await preview.getByRole("button", { name: "确认合并" }).click();

  let stored = await storedSettings(page);
  expect(stored.projectNamesText).toContain("shared(*) -> 导入名称");
  expect(stored.projectNamesText).toContain("local(*) -> 本机项目");
  expect(stored.projectNamesText).toContain("remote(*) -> 远程项目");
  expect(stored.authorAliasesText).toContain("团队 -> imported@example.com");
  expect(stored.authorAliasesText).toContain("本机 -> local-only@example.com");
  expect(stored.dailyReportFormatTemplate).toContain("导入日报");
  expect(stored.aiApiKey).toBe("env:OPENAI_API_KEY");
  expect(stored.aiApiKeySaved).toBe(false);
  expect(stored.proxyPasswordSaved).toBe(true);
  expect(stored.rootDirs).toEqual(["C:/workspace-stays-local"]);

  await page.getByRole("button", { name: "导入方案" }).click();
  await page.getByRole("radio", { name: /替换/ }).click();
  await page.getByRole("button", { name: "确认替换" }).click();

  stored = await storedSettings(page);
  expect(stored.projectNamesText).toBe("only(*) -> 仅导入项目");
  expect(stored.authorAliasesText).toBe("仅导入 -> only@example.com");
  expect(stored.evidenceLinkPrefixesText).toBe("ONLY -> https://only.example/{id}");
  expect(stored.rootDirs).toEqual(["C:/workspace-stays-local"]);
  expect(stored.aiApiKey).toBe("env:OPENAI_API_KEY");
  expect(stored.proxyPasswordSaved).toBe(true);
  expect(await commandCount(page, "clear_secure_ai_api_key")).toBe(0);
  expect(await commandCount(page, "clear_secure_proxy_password")).toBe(0);
});

test("cancels preview and rejects unsupported or damaged packages without changing settings", async ({ page }) => {
  const base = profile({ projectNamesText: "remote(*) -> 远程项目" });
  const unknownVersion = { ...base, schemaVersion: 99 };
  const unknownRoot = { ...base, unexpected: true };
  const missingSettings = { schemaVersion: 1, exportedAt: base.exportedAt };
  const unknownField = { ...base, settings: { ...base.settings, aiApiKey: "must-reject" } };
  const oversized = "x".repeat(2 * 1024 * 1024 + 1);
  await launchApp(page, {
    settings: createSettings({ projectNamesText: "local(*) -> 本机项目" }),
    dialogResponses: [
      "C:/profiles/cancel.json",
      "C:/profiles/version.json",
      "C:/profiles/root.json",
      "C:/profiles/missing.json",
      "C:/profiles/field.json",
      "C:/profiles/broken.json",
      "C:/profiles/oversized.json",
    ],
    textFiles: {
      "C:/profiles/cancel.json": JSON.stringify(base),
      "C:/profiles/version.json": JSON.stringify(unknownVersion),
      "C:/profiles/root.json": JSON.stringify(unknownRoot),
      "C:/profiles/missing.json": JSON.stringify(missingSettings),
      "C:/profiles/field.json": JSON.stringify(unknownField),
      "C:/profiles/broken.json": "{broken",
      "C:/profiles/oversized.json": oversized,
    },
  });
  await openConfigProfileSection(page);

  await page.getByRole("button", { name: "导入方案" }).click();
  await page.getByRole("button", { name: "取消导入配置方案" }).click();
  expect((await storedSettings(page)).projectNamesText).toBe("local(*) -> 本机项目");

  await expectImportError(page, "不支持的配置方案版本：99");
  await expectImportError(page, "配置方案包含未知字段：unexpected");
  await expectImportError(page, "配置方案缺少字段：settings");
  await expectImportError(page, "settings包含未知字段：aiApiKey");
  await expectImportError(page, "配置方案不是有效的 JSON 文件");
  await expectImportError(page, "配置方案不能超过 2 MiB");
  expect((await storedSettings(page)).projectNamesText).toBe("local(*) -> 本机项目");
});

const SHAREABLE_KEYS = [
  "projectNamesText",
  "authorAliasesText",
  "evidenceLinkPrefixesText",
  "commitItemPrefixMode",
  "showEvidenceDetails",
  "reportPurposePreset",
  "reportTemplateProfile",
  "dailyReportFormatTemplate",
  "weeklyReportFormatTemplate",
  "monthlyReportFormatTemplate",
  "customReportFormatTemplate",
  "dailySystemPrompt",
  "monthlySystemPrompt",
];

function profile(overrides: Record<string, unknown> = {}) {
  const settings = createSettings(overrides);
  return {
    schemaVersion: 1,
    exportedAt: "2026-07-16T12:00:00.000Z",
    settings: Object.fromEntries(SHAREABLE_KEYS.map((key) => [key, settings[key]])),
  };
}

async function openConfigProfileSection(page: Page) {
  await expectWorkbench(page);
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("button", { name: "通用" }).click();
  await expect(page.getByRole("heading", { name: "配置方案" })).toBeVisible();
}

async function expectImportError(page: Page, message: string) {
  await page.getByRole("button", { name: "导入方案" }).click();
  await expect(page.getByRole("alert")).toHaveText(message);
}

async function storedSettings(page: Page) {
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gitpulse-settings"))).not.toBeNull();
  return page.evaluate(() => JSON.parse(localStorage.getItem("gitpulse-settings") ?? "{}"));
}

async function lastCommand(page: Page, command: string) {
  return page.evaluate((cmd) => window.__mockTauri.calls.filter((call) => call.cmd === cmd).at(-1), command);
}

async function commandCount(page: Page, command: string) {
  return page.evaluate((cmd) => window.__mockTauri.calls.filter((call) => call.cmd === cmd).length, command);
}
