import { expect, test, type Page } from "@playwright/test";
import {
  createHistoryEntry,
  createRepo,
  createRepoCache,
  createSettings,
  expectWorkbench,
  launchApp,
} from "./support/tauri";

const repo = createRepo("C:/workspace/gitpulse", "gitpulse", "main");
const settings = createSettings({ rootDirs: ["C:/workspace"], outputEnabled: false });

test("migrates valid legacy history and clears the old localStorage key", async ({ page }) => {
  const legacy = historyEntry("legacy-history", "旧版历史报告");
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], [repo]),
    reportHistory: [legacy],
  });

  await expectWorkbench(page);
  await expect.poll(() => legacyStorageValue(page)).toBeNull();
  await expect.poll(async () => (await storedHistory(page))[0]?.id).toBe(legacy.id);
  const load = await lastCommand(page, "load_report_history");
  expect(load.args.legacyEntries).toEqual([legacy]);
});

test("keeps the file store authoritative when a legacy key remains", async ({ page }) => {
  const stored = historyEntry("stored-history", "文件历史报告");
  const legacy = historyEntry("legacy-history", "不应重复导入");
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], [repo]),
    reportHistory: [legacy],
    storedReportHistory: [stored],
  });

  await expectWorkbench(page);
  await openHistory(page);
  await expect(page.getByRole("button", { name: /文件历史报告/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /不应重复导入/ })).toHaveCount(0);
  await expect.poll(() => legacyStorageValue(page)).toBeNull();
});

test("preserves malformed legacy data and explains why migration was skipped", async ({ page }) => {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], [repo]),
    legacyReportHistoryRaw: "{broken-json",
  });

  await expectWorkbench(page);
  await expect(page.locator(".event-log")).toContainText("旧报告历史不是有效 JSON");
  expect(await legacyStorageValue(page)).toBe("{broken-json");
  const load = await lastCommand(page, "load_report_history");
  expect(load.args.legacyEntries).toBeNull();
});

test("keeps the generated report in memory when the file save fails", async ({ page }) => {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], [repo]),
    reportHistorySaveError: "模拟磁盘只读",
    extractResults: [{
      repos: [repo],
      summaryText: "# 今日报告\n\n- 保存失败仍可查看",
      detailedText: "",
      warnings: [],
      commits: [commitRecord()],
    }],
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "生成日报" }).click();
  await expect(page.getByText("保存失败仍可查看")).toBeVisible();
  await expect(page.locator(".app-message.warning")).toContainText("报告历史未写入磁盘");
  await openHistory(page);
  await expect(page.getByRole("button", { name: /日报 · / })).toBeVisible();
  expect(await storedHistory(page)).toEqual([]);
});

test("merges a new report with file history when startup loading is still pending", async ({ page }) => {
  const stored = historyEntry("slow-load-history", "慢速加载旧报告");
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], [repo]),
    storedReportHistory: [stored],
    deferredCommands: ["load_report_history"],
    extractResults: [{
      repos: [repo],
      summaryText: "# 今日报告\n\n- 加载期间生成的新报告",
      detailedText: "",
      warnings: [],
      commits: [commitRecord()],
    }],
  });

  await expectWorkbench(page);
  await expect.poll(() => commandCount(page, "load_report_history")).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "生成日报" }).click();
  await page.evaluate(() => {
    const loads = window.__mockTauri.calls.filter((call) => call.cmd === "load_report_history").length;
    for (let index = 0; index < loads; index += 1) window.__mockTauri.releaseCommand("load_report_history");
  });
  await expect.poll(async () => (await storedHistory(page)).map((entry) => entry.id)).toContain(stored.id);
  await expect.poll(async () => (await storedHistory(page)).length).toBe(2);
});

test("shows backup recovery and clears both runtime and file history", async ({ page }) => {
  const stored = historyEntry("recovered-history", "备份恢复报告");
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], [repo]),
    storedReportHistory: [stored],
    reportHistoryRecoveredFromBackup: true,
    reportHistoryLoadWarning: "报告历史主文件不可用，已从备份恢复",
  });

  await expectWorkbench(page);
  await expect(page.locator(".app-message.warning")).toContainText("已从备份恢复");
  await openHistory(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "清空", exact: true }).click();
  await expect(page.getByText("暂无历史报告，生成后可在此打开、复制或重新生成。")).toBeVisible();
  await expect.poll(async () => (await storedHistory(page)).length).toBe(0);
});

test("restores visible history when clearing the file fails", async ({ page }) => {
  const stored = historyEntry("clear-failure", "清空失败保留报告");
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], [repo]),
    storedReportHistory: [stored],
    reportHistoryClearError: "模拟文件占用",
  });

  await expectWorkbench(page);
  await openHistory(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "清空", exact: true }).click();
  await expect(page.locator(".app-message.warning")).toContainText("清空报告历史失败");
  await expect(page.getByRole("button", { name: /清空失败保留报告/ })).toBeVisible();
  expect((await storedHistory(page))[0].id).toBe(stored.id);
});

function historyEntry(id: string, title: string) {
  return createHistoryEntry({
    id,
    mode: "summary",
    title,
    periodLabel: "2026-07-16",
    reportText: `# ${title}`,
  });
}

async function openHistory(page: Page) {
  await page.getByRole("tab", { name: /最近/ }).click();
}

async function storedHistory(page: Page) {
  return page.evaluate(() => window.__mockTauri.reportHistoryStore);
}

async function legacyStorageValue(page: Page) {
  return page.evaluate(() => window.localStorage.getItem("gitpulse-report-history"));
}

async function lastCommand(page: Page, command: string) {
  return page.evaluate((name) => window.__mockTauri.calls.filter((call) => call.cmd === name).at(-1), command);
}

async function commandCount(page: Page, command: string) {
  return page.evaluate((name) => window.__mockTauri.calls.filter((call) => call.cmd === name).length, command);
}

function commitRecord() {
  return {
    repoPath: repo.path,
    projectName: repo.name,
    branchName: repo.branch,
    hash: "abc1234",
    author: "Playwright Tester",
    authorEmail: "playwright@example.com",
    date: "2026-07-16 10:00:00 +0800",
    message: "feat: 保存失败仍可查看",
  };
}
