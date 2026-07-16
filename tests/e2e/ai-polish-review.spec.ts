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
const originalReport = [
  "# 已生成日报",
  "",
  "- 完成支付模块异常回退",
  "> 来源：`gitpulse` / `main` / 2026-07-15 / `abc1201`",
].join("\n");
const polishedReport = [
  "# 已生成日报",
  "",
  "- 支付模块已正式上线，故障率降低 30%",
].join("\n");
const history = [createHistoryEntry({
  id: "polish-source",
  mode: "summary",
  title: "日报 · 2026-07-15",
  periodLabel: "2026-07-15",
  range: { startDate: "2026-07-15", endDate: "2026-07-15" },
  reportText: originalReport,
  repoCount: 4,
  projectCount: 2,
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

test("reviews AI changes before accepting and only then updates history and export", async ({ page }) => {
  await launchPolishApp(page, { reportText: polishedReport, warnings: [] });

  await page.getByRole("button", { name: "AI润色" }).click();
  const review = page.getByRole("region", { name: "AI 润色对照" });
  await expect(review).toBeVisible();
  await expect(review).toBeFocused();
  await expect(review.getByRole("heading", { name: "AI 润色对照" })).toBeVisible();
  await expect(review.getByRole("region", { name: "原稿" })).toContainText("完成支付模块异常回退");
  await expect(review.getByRole("region", { name: "润色稿" })).toContainText("故障率降低 30%");
  await expect(review.getByText("启发式风险提示，不等于事实错误")).toBeVisible();
  await expect(review.getByText(/新增量化指标/)).toBeVisible();
  await expect(review.getByText(/新增强结论/)).toBeVisible();
  await expect(review.getByText(/删除证据行/)).toBeVisible();
  await expect(review.locator(".polish-diff-line.unchanged").filter({ hasText: "# 已生成日报" })).toBeVisible();
  await expect(review.locator(".polish-diff-line.added")).toContainText("故障率降低 30%");
  await expect(review.locator(".polish-diff-line.removed").filter({ hasText: "来源：" })).toBeVisible();
  await expect(page.getByRole("button", { name: "生成日报" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "AI润色" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "导出", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: /月报/ })).toBeDisabled();
  await expect(page.locator(".preview-copy-button")).toBeEnabled();
  await expect(page.getByRole("button", { name: "打开设置" })).toBeEnabled();
  expect(await commandCount(page, "save_report_file")).toBe(0);
  expect((await storedHistory(page))[0].reportText).toBe(originalReport);

  await review.getByRole("button", { name: "接受润色" }).click();
  await expect(review).toHaveCount(0);
  await expect(page.getByText("支付模块已正式上线，故障率降低 30%")).toBeVisible();
  await expect.poll(() => commandCount(page, "save_report_file")).toBe(1);
  await expect.poll(async () => (await storedHistory(page))[0]?.reportText).toBe(polishedReport);
  expect((await storedHistory(page))[0].repoCount).toBe(4);
  await expect(page.getByRole("button", { name: "AI润色" })).toBeFocused();
});

test("keeps the original report when the user rejects the polished draft", async ({ page }) => {
  await launchPolishApp(page, { reportText: polishedReport, warnings: [] }, originalReport, "dark");

  await page.getByRole("button", { name: "AI润色" }).click();
  const review = page.getByRole("region", { name: "AI 润色对照" });
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "保留原稿" }).click();

  await expect(review).toHaveCount(0);
  await expect(page.getByText("完成支付模块异常回退")).toBeVisible();
  expect(await commandCount(page, "save_report_file")).toBe(0);
  expect(await storedHistory(page)).toHaveLength(1);
  expect((await storedHistory(page))[0].reportText).toBe(originalReport);
});

test("closes the review with Escape and keeps the original report", async ({ page }) => {
  await launchPolishApp(page, { reportText: polishedReport, warnings: [] });

  await page.getByRole("button", { name: "AI润色" }).click();
  await expect(page.getByRole("region", { name: "AI 润色对照" })).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("region", { name: "AI 润色对照" })).toHaveCount(0);
  await expect(page.getByText("完成支付模块异常回退")).toBeVisible();
  await expect(page.getByRole("button", { name: "AI润色" })).toBeFocused();
});

test("keeps the local draft and skips review/history writes when AI fails", async ({ page }) => {
  await launchPolishApp(page, {
    reportText: originalReport,
    warnings: ["AI 润色失败：模拟网络错误，已保留本地报告"],
  });

  await page.getByRole("button", { name: "AI润色" }).click();

  await expect(page.getByRole("region", { name: "AI 润色对照" })).toHaveCount(0);
  await expect(page.getByText("完成支付模块异常回退")).toBeVisible();
  await expect(page.getByText(/AI 润色失败：模拟网络错误/)).toBeVisible();
  expect(await commandCount(page, "save_report_file")).toBe(0);
  expect(await storedHistory(page)).toHaveLength(1);
});

test("uses the bounded fallback for very large line diffs", async ({ page }) => {
  const original = Array.from({ length: 500 }, (_, index) => `- 原稿事项 ${index + 1}`).join("\n");
  const polished = Array.from({ length: 500 }, (_, index) => `- 润色事项 ${index + 1}`).join("\n");
  await launchPolishApp(page, { reportText: polished, warnings: [] }, original);

  await page.getByRole("button", { name: "AI润色" }).click();

  const review = page.getByRole("region", { name: "AI 润色对照" });
  await expect(review).toBeVisible();
  await expect(review).toHaveAttribute("data-diff-strategy", "bounded-fallback");
  await expect(review.getByText(/报告较长，已使用快速对照/)).toBeVisible();
  await expect(review.locator(".polish-diff-line.removed")).toHaveCount(500);
  await expect(review.locator(".polish-diff-line.added")).toHaveCount(500);
});

async function launchPolishApp(
  page: Page,
  enhanceResult: { reportText: string; warnings: string[] },
  sourceReport = originalReport,
  themeMode: "light" | "dark" = "light",
) {
  const reportHistory = sourceReport === originalReport
    ? history
    : [{ ...history[0], id: "large-polish-source", reportText: sourceReport }];
  await launchApp(page, {
    settings: { ...settings, themeMode },
    repoCache: createRepoCache(["C:/workspace"], repos),
    reportHistory,
    enhanceResult,
    secureApiKey: "sk-test",
  });
  await expectWorkbench(page);
  await page.getByRole("tab", { name: /最近/ }).click();
  await page.getByRole("button", { name: /日报 · 2026-07-15/ }).click();
}

async function commandCount(page: Page, command: string) {
  return page.evaluate((cmd) => window.__mockTauri.calls.filter((call) => call.cmd === cmd).length, command);
}

async function storedHistory(page: Page) {
  return page.evaluate(() => window.__mockTauri.reportHistoryStore);
}
