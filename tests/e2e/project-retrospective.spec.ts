import { expect, test } from "@playwright/test";
import {
  createHistoryEntry,
  createRepo,
  createRepoCache,
  createSettings,
  expectWorkbench,
  launchApp,
} from "./support/tauri";

const repos = [createRepo("C:/workspace/gitpulse", "gitpulse", "main")];
const settings = createSettings({ rootDirs: ["C:/workspace"] });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-07-16T08:00:00.000Z"));
});

test("summarizes structured project history and opens the original report", async ({ page }) => {
  const weekly = createHistoryEntry({
    id: "weekly-platform",
    mode: "weekly",
    title: "周报 · 2026-W28",
    periodLabel: "2026-W28",
    range: { startDate: "2026-07-06", endDate: "2026-07-12" },
    generatedAt: "2026-07-12T10:00:00.000Z",
    commitCount: 4,
    aiEnhanced: true,
    outputFile: "C:/exports/weekly-2026-W28.md",
    reportText: "# 周报\n\n研发平台完成权限审计",
    projects: [
      { name: "研发平台", commitCount: 3, evidenceIds: ["abc123d", "def456a"] },
      { name: "客户端", commitCount: 1, evidenceIds: ["cab789f"] },
    ],
  });
  const monthly = createHistoryEntry({
    id: "monthly-platform",
    mode: "monthly",
    title: "月报 · 2026-07",
    periodLabel: "2026-07",
    range: { startDate: "2026-07-01", endDate: "2026-07-15" },
    generatedAt: "2026-07-15T10:00:00.000Z",
    commitCount: 2,
    reportText: "# 月报\n\n研发平台完成发布复盘",
    projects: [
      { name: "研发平台", commitCount: 2, evidenceIds: ["def456a", "fed987b"] },
    ],
  });

  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    reportHistory: [monthly, weekly],
  });
  await expectWorkbench(page);
  await page.getByRole("tab", { name: "洞察" }).click();

  await expect(page.getByRole("heading", { name: "项目回顾" })).toBeVisible();
  await page.getByLabel("选择回顾项目").selectOption("研发平台");
  await page.getByLabel("选择回顾时间范围").selectOption("all");

  await expect(page.getByText("2 份报告", { exact: true })).toBeVisible();
  await expect(page.getByText("5 次项目提交", { exact: true })).toBeVisible();
  await expect(page.getByText("1 份已导出", { exact: true })).toBeVisible();
  await expect(page.getByText("3 个证据", { exact: true })).toBeVisible();
  await expect(page.getByText("AI 润色", { exact: true })).toBeVisible();
  await expect(page.getByText("已导出", { exact: true })).toBeVisible();
  await expect(page.getByText("abc123d", { exact: true })).toBeVisible();
  await expect(page.getByText("fed987b", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "打开周报 · 2026-W28" }).click();
  await expect(page.getByRole("tab", { name: "报告" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("研发平台完成权限审计")).toBeVisible();
});

test("keeps legacy history predictable and explains empty time ranges", async ({ page }) => {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    reportHistory: [
      createHistoryEntry({
        id: "legacy-daily",
        mode: "summary",
        title: "日报 · 2026-07-15",
        periodLabel: "2026-07-15",
        range: { startDate: "2026-07-15", endDate: "2026-07-15" },
        generatedAt: "2026-07-15T10:00:00.000Z",
        reportText: "# 任意旧正文\n\n包含无法可靠解析的项目标题",
      }),
      createHistoryEntry({
        id: "old-platform",
        mode: "weekly",
        title: "周报 · 2025-W50",
        periodLabel: "2025-W50",
        range: { startDate: "2025-12-08", endDate: "2025-12-14" },
        generatedAt: "2025-12-14T10:00:00.000Z",
        reportText: "# 旧周报",
        projects: [{ name: "研发平台", commitCount: 4, evidenceIds: ["old1234"] }],
      }),
      createHistoryEntry({
        id: "empty-new-report",
        mode: "summary",
        title: "日报 · 2026-07-14",
        periodLabel: "2026-07-14",
        range: { startDate: "2026-07-14", endDate: "2026-07-14" },
        reportText: "- 未检索到提交记录。",
        projects: [],
      }),
    ],
  });
  await expectWorkbench(page);
  await page.getByRole("tab", { name: "洞察" }).click();

  await page.getByLabel("选择回顾项目").selectOption("未归类历史");
  await expect(page.getByText("这些历史记录生成于结构化项目归属上线前，未根据正文猜测项目。")).toBeVisible();
  await expect(page.getByRole("button", { name: "打开日报 · 2026-07-15" })).toBeVisible();
  await expect(page.getByText("任意旧正文")).toHaveCount(0);

  await page.getByLabel("选择回顾项目").selectOption("研发平台");
  await page.getByLabel("选择回顾时间范围").selectOption("30");
  await expect(page.getByText("当前时间范围内没有该项目的历史报告。")).toBeVisible();
  await page.getByLabel("选择回顾时间范围").selectOption("all");
  await expect(page.getByRole("button", { name: "打开周报 · 2025-W50" })).toBeVisible();
});

test("teaches the project retrospective when history is empty", async ({ page }) => {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    reportHistory: [],
  });
  await expectWorkbench(page);
  await page.getByRole("tab", { name: "洞察" }).click();

  await expect(page.getByRole("heading", { name: "项目回顾" })).toBeVisible();
  await expect(page.getByText("生成报告后，可在这里按项目回顾提交和证据。")).toBeVisible();
  await expect(page.getByLabel("选择回顾项目")).toBeDisabled();
});

test("persists project snapshots for all four report modes", async ({ page }) => {
  const dailyProjects = [{ name: "日报项目", commitCount: 1, evidenceIds: ["daily01"] }];
  const customProjects = [{ name: "自定义项目", commitCount: 2, evidenceIds: ["custom1", "custom2"] }];
  const weeklyProjects = [{ name: "周报项目", commitCount: 3, evidenceIds: ["weekly1"] }];
  const monthlyProjects = [{ name: "月报项目", commitCount: 4, evidenceIds: ["month01"] }];
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    extractResults: [
      { repos, summaryText: "# 日报", commits: [{}], projects: dailyProjects },
      { repos, summaryText: "# 自定义报告", commits: [{}, {}], projects: customProjects },
    ],
    periodResults: {
      weekly: {
        reportText: "# 周报",
        periodLabel: "2026-W29",
        reportKind: "weekly",
        projectCount: 1,
        commitCount: 3,
        projects: weeklyProjects,
      },
      monthly: {
        reportText: "# 月报",
        periodLabel: "2026-06",
        reportKind: "monthly",
        projectCount: 1,
        commitCount: 4,
        projects: monthlyProjects,
      },
    },
  });
  await expectWorkbench(page);

  await page.getByRole("button", { name: "生成日报" }).click();
  await page.getByRole("button", { name: "自定义" }).click();
  await page.getByRole("button", { name: "生成自定义报告" }).click();
  await page.getByRole("button", { name: "周报" }).click();
  await page.getByRole("button", { name: "生成周报" }).click();
  await page.getByRole("button", { name: "月报" }).click();
  await page.getByRole("button", { name: "生成月报" }).click();

  await expect.poll(async () => (await storedHistory(page)).length).toBe(4);
  const stored = await storedHistory(page);
  expect(stored.find((entry) => entry.mode === "summary")?.projects).toEqual(dailyProjects);
  expect(stored.find((entry) => entry.mode === "custom")?.projects).toEqual(customProjects);
  expect(stored.find((entry) => entry.mode === "weekly")?.projects).toEqual(weeklyProjects);
  expect(stored.find((entry) => entry.mode === "monthly")?.projects).toEqual(monthlyProjects);
});

async function storedHistory(page: Parameters<typeof expectWorkbench>[0]) {
  return page.evaluate(() => window.__mockTauri.reportHistoryStore);
}

for (const visualCase of [
  { name: "light-desktop", themeMode: "light" as const, width: 1440 },
  { name: "dark-desktop", themeMode: "dark" as const, width: 1440 },
  { name: "dark-narrow", themeMode: "dark" as const, width: 760 },
]) {
  test(`renders project retrospective without internal overflow in ${visualCase.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: visualCase.width, height: 900 });
    await launchApp(page, {
      settings: { ...settings, themeMode: visualCase.themeMode },
      repoCache: createRepoCache(["C:/workspace"], repos),
      reportHistory: [
        createHistoryEntry({
          id: `visual-${visualCase.name}`,
          mode: "weekly",
          title: "周报 · 2026-W28",
          periodLabel: "2026-W28",
          range: { startDate: "2026-07-06", endDate: "2026-07-12" },
          reportText: "# 周报",
          projects: [{
            name: "研发协作与本地报告平台",
            commitCount: 12,
            evidenceIds: ["abc123d", "def456a", "commit-3", "very-long-evidence-identifier-for-wrapping"],
          }],
        }),
      ],
    });
    await expectWorkbench(page);
    await page.getByRole("tab", { name: "洞察" }).click();
    const component = page.locator(".project-retrospective");
    await component.scrollIntoViewIfNeeded();
    await expect(component).toBeVisible();
    const dimensions = await component.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    const componentBox = await component.boundingBox();
    const buttonBox = await component.getByRole("button", { name: "打开周报 · 2026-W28" }).boundingBox();
    expect(componentBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(componentBox!.x + componentBox!.width + 1);
    await component.screenshot({ path: testInfo.outputPath(`${visualCase.name}.png`) });
  });
}
