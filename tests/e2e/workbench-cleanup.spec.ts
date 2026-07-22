import { expect, test } from "@playwright/test";
import { createRepo, createRepoCache, createSettings, expectWorkbench, launchApp } from "./support/tauri";

const healthyRepo = createRepo("C:/workspace/gitpulse", "gitpulse", "main");
const missingRepo = createRepo("C:/missing-root/missing", "missing", "main");
const inaccessibleRepo = createRepo("C:/offline/inaccessible", "inaccessible", "main");
const settings = createSettings({
  rootDirs: ["C:/workspace", "C:/missing-root", "C:/offline"],
  disabledRepos: [missingRepo.path, inaccessibleRepo.path],
  author: "Playwright Tester",
});
const repoCache = createRepoCache(settings.rootDirs, [healthyRepo, missingRepo, inaccessibleRepo]);
const workspaceHealthResult = {
  roots: [
    { path: "C:/workspace", status: "healthy", detail: "目录可访问" },
    { path: "C:/missing-root", status: "missing", detail: "目录已移动、删除或未挂载" },
    { path: "C:/offline", status: "inaccessible", detail: "目录当前无法访问：拒绝访问" },
  ],
  repos: [
    { path: healthyRepo.path, name: healthyRepo.name, cachedBranch: "main", currentBranch: "main", status: "healthy", detail: "路径、Git 标记与分支状态正常", disabled: false },
    { path: missingRepo.path, name: missingRepo.name, cachedBranch: "main", currentBranch: "", status: "missing", detail: "仓库目录已移动或删除", disabled: true },
    { path: inaccessibleRepo.path, name: inaccessibleRepo.name, cachedBranch: "main", currentBranch: "", status: "inaccessible", detail: "仓库目录当前无法访问：拒绝访问", disabled: true },
  ],
};

function createCommit(hash: string, message: string) {
  return {
    repoPath: healthyRepo.path,
    projectName: healthyRepo.name,
    branchName: healthyRepo.branch,
    hash,
    author: "Playwright Tester",
    authorEmail: "playwright@example.com",
    date: "2026-07-21",
    message,
    additions: 4,
    deletions: 1,
    changedFiles: 1,
  };
}

function warningReportScenario(overrides: Record<string, unknown> = {}) {
  return {
    settings,
    repoCache,
    workspaceHealthResult,
    scanRepos: [healthyRepo, inaccessibleRepo],
    extractResults: [{
      repos: [healthyRepo, missingRepo, inaccessibleRepo],
      summaryText: "# 日报\n\n- 本地测试报告",
      detailedText: "# 日报\n\n- 本地测试报告",
      warnings: ["missing：启动 Git 命令失败：目录名称无效（os error 267）", "inaccessible：目录当前无法访问"],
      commits: [createCommit("abc1234", "feat: 保留清理回归测试")],
    }],
    ...overrides,
  };
}

test("centers report type labels and scopes warnings to the report view", async ({ page }, testInfo) => {
  await launchApp(page, warningReportScenario());
  await expectWorkbench(page);

  const tabs = page.locator(".report-switch button");
  await expect(tabs).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    const metrics = await tabs.nth(index).evaluate((element) => {
      const button = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        centerDelta: Math.abs((text.top + text.height / 2) - (button.top + button.height / 2)),
        display: style.display,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent,
      };
    });
    expect(metrics.centerDelta).toBeLessThan(1.5);
    expect(metrics.display).toBe("flex");
    expect(metrics.alignItems).toBe("center");
    expect(metrics.justifyContent).toBe("center");
  }

  await page.getByRole("button", { name: "生成日报" }).click();
  await expect(page.locator(".warning-event")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("warning-summary.png"), fullPage: true });
  await expect(page.getByText(/启动 Git 命令失败/)).toBeHidden();
  await page.locator(".warning-event-details summary").click();
  await expect(page.getByText(/启动 Git 命令失败/)).toBeVisible();

  await page.getByRole("tab", { name: "洞察" }).click();
  await expect(page.locator(".warning-event")).toHaveCount(0);
  await page.getByRole("tab", { name: "报告" }).click();
  await expect(page.locator(".warning-event")).toBeVisible();
  await page.getByRole("button", { name: "关闭警告" }).click();
  await expect(page.locator(".warning-event")).toHaveCount(0);
});

test("previews and removes only safe invalid roots and repository indexes", async ({ page }) => {
  await launchApp(page, warningReportScenario());
  await expectWorkbench(page);
  await page.getByRole("button", { name: "生成日报" }).click();
  await page.getByRole("button", { name: "检查并清理" }).click();

  const dialog = page.getByRole("alertdialog", { name: "清理失效路径？" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("失效根目录 · 1")).toBeVisible();
  await expect(dialog.getByText("仓库索引 · 1")).toBeVisible();
  await expect(dialog.getByText("不会删除磁盘上的任何文件")).toBeVisible();
  await expect(dialog.getByText("暂时不可访问的目录不会被自动清理")).toBeVisible();
  await dialog.getByRole("button", { name: "保留配置" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole("button", { name: "检查并清理" }).click();
  await page.getByRole("alertdialog", { name: "清理失效路径？" }).getByRole("button", { name: "清理 2 项" }).click();
  await expect(page.getByRole("alertdialog", { name: "清理失效路径？" })).toHaveCount(0);

  await expect.poll(() => page.evaluate(() => window.__mockTauri.calls.filter((call) => call.cmd === "scan_repos").length)).toBe(1);
  const scanCall = await page.evaluate(() => window.__mockTauri.calls.find((call) => call.cmd === "scan_repos"));
  expect(scanCall?.args.rootDirs).toEqual(["C:/workspace", "C:/offline"]);

  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("gitpulse-settings");
    return raw ? JSON.parse(raw) : null;
  })).toMatchObject({
    rootDirs: ["C:/workspace", "C:/offline"],
    disabledRepos: [inaccessibleRepo.path],
  });
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("gitpulse-repo-index-cache");
    return raw ? JSON.parse(raw) : null;
  })).toMatchObject({
    rootDirs: ["C:/workspace", "C:/offline"],
    repos: [healthyRepo, inaccessibleRepo],
  });
});

test("clears the cache without rescanning when every root is invalid", async ({ page }) => {
  const invalidRoot = "C:/missing-root";
  const invalidRepo = createRepo(`${invalidRoot}/missing`, "missing", "main");
  const invalidSettings = createSettings({ rootDirs: [invalidRoot], disabledRepos: [] });
  await launchApp(page, warningReportScenario({
    settings: invalidSettings,
    repoCache: createRepoCache(invalidSettings.rootDirs, [invalidRepo]),
    scanRepos: [],
    workspaceHealthResult: {
      roots: [{ path: invalidRoot, status: "missing", detail: "目录已移动、删除或未挂载" }],
      repos: [{ path: invalidRepo.path, name: invalidRepo.name, cachedBranch: "main", currentBranch: "", status: "missing", detail: "仓库目录已移动或删除", disabled: false }],
    },
  }));
  await expectWorkbench(page);
  await page.getByRole("button", { name: "生成日报" }).click();
  await page.getByRole("button", { name: "检查并清理" }).click();
  await page.getByRole("alertdialog", { name: "清理失效路径？" }).getByRole("button", { name: "清理 2 项" }).click();

  await expect.poll(() => page.evaluate(() => window.__mockTauri.calls.filter((call) => call.cmd === "scan_repos").length)).toBe(0);
  await expect.poll(() => page.evaluate(() => {
    const raw = window.localStorage.getItem("gitpulse-settings");
    return raw ? JSON.parse(raw) : null;
  })).toMatchObject({ rootDirs: [], disabledRepos: [] });
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("gitpulse-repo-index-cache"))).toBeNull();
  await expect(page.locator(".app-message-layer").getByText("请添加新的工作目录")).toBeVisible();
});

test("keeps warning state when health inspection fails and reports no safe cleanup", async ({ page }) => {
  await launchApp(page, warningReportScenario({ workspaceHealthError: "检查工作区健康状态失败：拒绝访问" }));
  await expectWorkbench(page);
  await page.getByRole("button", { name: "生成日报" }).click();
  await page.getByRole("button", { name: "检查并清理" }).click();
  await expect(page.locator(".app-message-layer").getByText("工作区检查失败，请重试或打开健康页查看详情")).toBeVisible();
  await expect(page.locator(".warning-event")).toBeVisible();
  await expect(page.getByRole("alertdialog", { name: "清理失效路径？" })).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem("gitpulse-settings"))).toContain("C:/missing-root");
});

test("keeps warnings and explains when no path is safe to remove", async ({ page }) => {
  const healthyHealth = {
    roots: workspaceHealthResult.roots.map((root) => ({ ...root, status: "healthy", detail: "目录可访问" })),
    repos: workspaceHealthResult.repos.map((repo) => ({ ...repo, status: "healthy", detail: "路径、Git 标记与分支状态正常" })),
  };
  await launchApp(page, warningReportScenario({ workspaceHealthResult: healthyHealth }));
  await expectWorkbench(page);
  await page.getByRole("button", { name: "生成日报" }).click();
  await page.getByRole("button", { name: "检查并清理" }).click();
  await expect(page.locator(".app-message-layer").getByText("当前没有可安全清理的失效路径")).toBeVisible();
  await expect(page.getByRole("alertdialog", { name: "清理失效路径？" })).toHaveCount(0);
  await expect(page.locator(".warning-event")).toBeVisible();
});
