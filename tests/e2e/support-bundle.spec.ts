import { expect, test, type Page } from "@playwright/test";
import {
  createRepo,
  createRepoCache,
  createSettings,
  createSupportBundlePreview,
  expectWorkbench,
  launchApp,
} from "./support/tauri";

const privateRoot = "C:/Users/Alice/Secret Workspace";
const privateRepo = createRepo(`${privateRoot}/private-payroll-api`, "private-payroll-api", "feature/customer-acme");
const privateSettings = createSettings({
  rootDirs: [privateRoot],
  outputDir: "C:/Users/Alice/Private Exports",
  author: "Alice Zhang",
  aiBaseUrl: "https://private-ai.example.test/v1",
  aiApiKey: "sk-browser-secret-123456",
  projectNamesText: "private-payroll-api(*) -> Payroll Core",
  proxyMode: "custom",
  proxyUrl: "http://proxy.internal.test:7890",
  proxyUsername: "proxy-user",
  proxyPassword: "proxy-password-secret",
});

test("previews, confirms, and exports a privacy-safe support bundle", async ({ page }) => {
  await launchSupportApp(page, {
    dialogResponses: ["C:/exports/gitpulse-support.zip"],
  });
  const trigger = await openSupportPreview(page);
  const dialog = page.getByRole("dialog", { name: "检查支持包内容" });

  await expect(dialog.getByRole("tab", { name: /summary\.md/ })).toBeFocused();
  await expect(dialog.getByLabel("summary.md 脱敏内容")).toContainText("GitPulse 支持摘要");
  await dialog.getByRole("tab", { name: /diagnostics\.json/ }).click();
  await expect(dialog.getByLabel("diagnostics.json 脱敏内容")).toContainText('"schemaVersion": 1');
  await dialog.getByRole("tab", { name: /recent-events\.log/ }).click();
  await expect(dialog.getByLabel("recent-events.log 脱敏内容")).toContainText("<redacted>");

  const exportButton = dialog.getByRole("button", { name: "导出 ZIP" });
  await expect(exportButton).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "我已查看上述三个文件及排除项" }).check();
  await expect(exportButton).toBeEnabled();
  await exportButton.click();

  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.getByText(/支持包已保存：C:\/exports\/gitpulse-support\.zip/)).toBeVisible();

  const calls = await supportCalls(page);
  expect(calls.preview).toHaveLength(1);
  expect(calls.export).toHaveLength(1);
  for (const call of [...calls.preview, ...calls.export]) {
    const serialized = JSON.stringify(call.args.options);
    expect(serialized).not.toContain("sk-browser-secret-123456");
    expect(serialized).not.toContain("proxy-password-secret");
    expect(serialized).not.toContain("Payroll Core");
    expect(serialized).not.toContain("projectNamesText");
    expect(serialized).not.toContain("aiApiKey");
    expect(serialized).not.toContain("proxyPassword");
  }
});

test("copies only the safe summary and opens an attachment-free issue URL", async ({ page }) => {
  await launchSupportApp(page);
  await openSupportPreview(page);
  const dialog = page.getByRole("dialog", { name: "检查支持包内容" });

  await dialog.getByRole("button", { name: "复制摘要" }).click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain("GitPulse 支持请求");
  expect(clipboard).toContain("Safe summary");
  expect(clipboard).not.toContain(privateRoot);
  expect(clipboard).not.toContain("recent-events");

  await dialog.getByRole("button", { name: "打开 GitHub Issue" }).click();
  const opener = await page.evaluate(() =>
    window.__mockTauri.calls.find((call) => call.cmd === "plugin:opener|open_url"),
  );
  expect(opener).toBeTruthy();
  const issueUrl = new URL(String(opener!.args.url));
  expect(`${issueUrl.origin}${issueUrl.pathname}`).toBe("https://github.com/GoldenZqqq/GitPulse/issues/new");
  expect(issueUrl.searchParams.get("title")).toContain("GitPulse 支持请求");
  expect(issueUrl.searchParams.get("body")).toContain("Safe summary");
  expect(issueUrl.searchParams.get("body")).not.toContain(privateRoot);
  expect([...issueUrl.searchParams.keys()].sort()).toEqual(["body", "title"]);
});

test("keeps preview open after save cancellation or an offline write failure", async ({ page }) => {
  await launchSupportApp(page, {
    dialogResponses: [null, "C:/exports/gitpulse-support.zip"],
    supportBundleExportError: "磁盘只读",
  });
  await openSupportPreview(page);
  const dialog = page.getByRole("dialog", { name: "检查支持包内容" });
  await dialog.getByRole("checkbox", { name: "我已查看上述三个文件及排除项" }).check();

  await dialog.getByRole("button", { name: "导出 ZIP" }).click();
  await expect(dialog).toBeVisible();
  expect((await supportCalls(page)).export).toHaveLength(0);

  await dialog.getByRole("button", { name: "导出 ZIP" }).click();
  await expect(dialog.getByText("导出支持包失败：磁盘只读")).toBeVisible();
  await expect(dialog).toBeVisible();
});

test("shows a readable preview failure without exposing settings secrets", async ({ page }) => {
  await launchSupportApp(page, { supportBundlePreviewError: "本地快照构建失败" });
  await expectWorkbench(page);
  await page.getByRole("button", { name: "打开设置" }).click();
  await page.getByRole("button", { name: "诊断" }).click();
  await page.getByRole("button", { name: "准备支持包" }).click();

  await expect(page.getByText("准备支持包预览失败：本地快照构建失败")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "检查支持包内容" })).toBeHidden();
  await expect(page.getByText("sk-browser-secret-123456")).toBeHidden();
});

async function launchSupportApp(
  page: Page,
  overrides: Partial<Parameters<typeof launchApp>[1]> = {},
) {
  await launchApp(page, {
    settings: privateSettings,
    repoCache: createRepoCache([privateRoot], [privateRepo]),
    diagnosticsResult: {
      items: [{ id: "git", label: "Git 命令", severity: "ok", message: "Git 可用", action: "" }],
      okCount: 1,
      warningCount: 0,
      errorCount: 0,
    },
    supportBundlePreview: createSupportBundlePreview(),
    ...overrides,
  });
}

async function openSupportPreview(page: Page) {
  await expectWorkbench(page);
  await page.getByRole("button", { name: "打开设置" }).click();
  await page.getByRole("button", { name: "诊断" }).click();
  const trigger = page.getByRole("button", { name: "准备支持包" });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "检查支持包内容" })).toBeVisible();
  return trigger;
}

async function supportCalls(page: Page) {
  return page.evaluate(() => ({
    preview: window.__mockTauri.calls.filter((call) => call.cmd === "preview_support_bundle"),
    export: window.__mockTauri.calls.filter((call) => call.cmd === "export_support_bundle"),
  }));
}
