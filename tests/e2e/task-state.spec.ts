import { expect, test, type Page } from "@playwright/test";
import {
  createHistoryEntry,
  createRepo,
  createRepoCache,
  createSettings,
  expectWorkbench,
  launchApp,
} from "./support/tauri";

const repos = [createRepo("C:/workspace/gitpulse", "gitpulse", "main")];
const baseReport = "# 已生成日报\n\n- 保留当前报告上下文";
const history = [createHistoryEntry({
  id: "task-state-daily",
  mode: "summary",
  title: "日报 · 2026-07-15",
  periodLabel: "2026-07-15",
  range: { startDate: "2026-07-15", endDate: "2026-07-15" },
  reportText: baseReport,
})];
const settings = createSettings({
  rootDirs: ["C:/workspace"],
  outputEnabled: true,
  outputDir: "C:/exports",
  author: "Playwright Tester",
  aiEnabled: true,
  aiModel: "gpt-test",
  aiApiKey: "sk-test",
});

test("blocks the preview only while generating a report", async ({ page }) => {
  await launchTaskStateApp(page, {
    deferredCommands: ["extract_commits"],
    extractResults: [{
      repos,
      summaryText: "# 新日报\n\n- 已完成重新生成",
      detailedText: "",
      warnings: [],
      commits: [createCommit("abc2201", "feat: 完成重新生成")],
    }],
  });

  await page.getByRole("button", { name: "生成日报" }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expectCommandPending(page, "extract_commits");

  await expect(page.locator(".preview-loading")).toBeVisible();
  await expect(page.getByText("保留当前报告上下文")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "生成中" })).toBeDisabled();

  await releaseCommand(page, "extract_commits");
  await expect(page.getByText("已完成重新生成")).toBeVisible();
});

test("keeps the original preview and unrelated controls available while polishing", async ({ page }) => {
  await launchTaskStateApp(page, {
    deferredCommands: ["enhance_report"],
    enhanceResult: { reportText: "# 润色后日报\n\n- 保留事实并优化表达", warnings: [] },
  });

  await page.getByRole("button", { name: "AI润色" }).click();
  await expectCommandPending(page, "enhance_report");

  await expect(page.getByText("保留当前报告上下文")).toBeVisible();
  await expect(page.getByRole("button", { name: "润色中" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "生成日报" })).toBeDisabled();
  await expect(page.locator(".preview-save-button")).toBeDisabled();
  await expect(page.locator(".preview-copy-button")).toBeEnabled();
  await expect(page.getByRole("button", { name: "打开设置" })).toBeEnabled();

  await releaseCommand(page, "enhance_report");
  const review = page.getByRole("region", { name: "AI 润色对照" });
  await expect(review).toBeVisible();
  await expect(review.getByRole("region", { name: "原稿" })).toContainText("保留当前报告上下文");
  await expect(review.getByRole("region", { name: "润色稿" })).toContainText("保留事实并优化表达");
  await review.getByRole("button", { name: "保留原稿" }).click();
});

test("keeps the preview readable and copyable while exporting", async ({ page }) => {
  await launchTaskStateApp(page, {
    deferredCommands: ["save_report_file"],
    settings: { ...settings, themeMode: "dark" },
  });

  await page.getByRole("button", { name: "导出", exact: true }).click();
  await expectCommandPending(page, "save_report_file");

  await expect(page.getByText("保留当前报告上下文")).toBeVisible();
  await expect(page.getByRole("button", { name: "导出中" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "生成日报" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "AI润色" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "打开设置" })).toBeEnabled();

  await page.locator(".preview-copy-button").click();
  await expect.poll(() => clipboardText(page)).toBe(baseReport);

  await releaseCommand(page, "save_report_file");
  await expect(page.locator(".run-status")).toContainText("报告已导出为 Markdown");
});

test("keeps scan progress and cancellation local to the repository panel", async ({ page }) => {
  await launchTaskStateApp(page, { deferredCommands: ["scan_repos"] });

  await page.getByRole("tab", { name: /仓库/ }).click();
  await page.getByRole("button", { name: "重新扫描仓库索引" }).click();
  await expectCommandPending(page, "scan_repos");

  await expect(page.getByText("保留当前报告上下文")).toBeVisible();
  await expect(page.getByRole("button", { name: "取消仓库扫描" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "生成日报" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "AI润色" })).toBeEnabled();
  await expect(page.locator(".preview-save-button")).toBeEnabled();
  await expect(page.locator(".preview-copy-button")).toBeEnabled();

  await page.getByRole("button", { name: "取消仓库扫描" }).click();
  await expect.poll(async () => commandCalls(page, "cancel_repo_scan")).toBe(1);
  await releaseCommand(page, "scan_repos");
  await expect(page.getByRole("button", { name: "重新扫描仓库索引" })).toBeEnabled();
});

async function launchTaskStateApp(page: Page, overrides: Partial<Parameters<typeof launchApp>[1]>) {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    reportHistory: history,
    secureApiKey: "sk-test",
    ...overrides,
  });
  await expectWorkbench(page);
  await page.getByRole("tab", { name: /最近/ }).click();
  await page.getByRole("button", { name: /日报 · 2026-07-15/ }).click();
  await expect(page.getByText("保留当前报告上下文")).toBeVisible();
}

async function expectCommandPending(page: Page, command: string) {
  await expect.poll(async () => commandCalls(page, command)).toBe(1);
}

async function releaseCommand(page: Page, command: string) {
  await page.evaluate((cmd) => window.__mockTauri.releaseCommand(cmd), command);
}

async function commandCalls(page: Page, command: string) {
  return page.evaluate((cmd) => window.__mockTauri.calls.filter((call) => call.cmd === cmd).length, command);
}

async function clipboardText(page: Page) {
  return page.evaluate(() => window.__mockTauri.clipboard);
}

function createCommit(hash: string, message: string) {
  return {
    repoPath: "C:/workspace/gitpulse",
    projectName: "gitpulse",
    branchName: "main",
    hash,
    author: "Playwright Tester",
    authorEmail: "playwright.tester@example.com",
    date: "2026-07-15 10:00:00 +0800",
    message,
  };
}
