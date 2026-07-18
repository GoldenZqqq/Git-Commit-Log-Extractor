import { expect, test, type Page } from "@playwright/test";
import {
  createRepo,
  createRepoCache,
  createSettings,
  expectWorkbench,
  launchApp,
} from "./support/tauri";

const root = "C:/workspace";
const repos = [
  createRepo(`${root}/core-api`, "core-api", "main"),
  createRepo(`${root}/billing-api`, "billing-api", "feature/billing"),
  createRepo(`${root}/frontend-web`, "frontend-web", "main"),
  createRepo("D:/shared/docs-service", "docs-service", "release"),
  createRepo(`${root}/legacy-worker`, "legacy-worker", "develop"),
];
const staleDisabledPath = "Z:/removed/stale-repo";
const projectNamesText = [
  "core-api(*) -> 核心平台",
  "billing-api(feature/billing) -> 账单平台",
].join("\n");

test("searches repository identity fields and combines status filters", async ({ page }) => {
  await launchRepositoryPanel(page);
  const panel = repositoryPanel(page);
  const search = panel.getByRole("searchbox", { name: "搜索仓库" });

  await expect(panel.getByRole("button", { name: "全部 5" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "已启用 4" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "已禁用 1" })).toBeVisible();

  await search.fill("核心平台");
  await expectVisibleRepos(panel, ["核心平台"]);
  await search.fill("billing-api");
  await expectVisibleRepos(panel, ["账单平台"]);
  await search.fill("D:/SHARED");
  await expectVisibleRepos(panel, ["docs-service"]);
  await search.fill("DEVELOP");
  await expectVisibleRepos(panel, ["legacy-worker"]);

  await search.fill("");
  await panel.getByRole("button", { name: "已禁用 1" }).click();
  await expectVisibleRepos(panel, ["legacy-worker"]);
  await expect(panel.getByText("命中 1 / 总计 5")).toBeVisible();

  await search.fill("not-found");
  await expect(panel.getByText("没有匹配仓库")).toBeVisible();
  await panel.getByRole("button", { name: "清除搜索" }).click();
  await expectVisibleRepos(panel, ["legacy-worker"]);
});

test("disables and restores only the current repository results", async ({ page }) => {
  await launchRepositoryPanel(page);
  await page.getByRole("tab", { name: "健康" }).click();
  await expect(page.getByRole("region", { name: "工作区健康" }).getByText("启用 4 / 禁用 1")).toBeVisible();
  await page.getByRole("tab", { name: "报告" }).click();
  const panel = repositoryPanel(page);
  await panel.getByRole("searchbox", { name: "搜索仓库" }).fill("api");
  await expect(panel.getByText("命中 2 / 总计 5")).toBeVisible();

  await panel.getByRole("button", { name: "禁用当前结果" }).click();
  await expect(page.getByLabel("当前生成范围").getByText("2/5 个仓库")).toBeVisible();
  await expect(page.locator(".run-status")).toContainText("已禁用当前结果中的 2 个仓库");
  await expect.poll(() => storedDisabledRepos(page)).toEqual([
    repos[4].path,
    staleDisabledPath,
    repos[0].path,
    repos[1].path,
  ]);

  await page.getByRole("tab", { name: "健康" }).click();
  await expect(page.getByRole("region", { name: "工作区健康" }).getByText("启用 2 / 禁用 3")).toBeVisible();
  await page.getByRole("tab", { name: "报告" }).click();

  await panel.getByRole("searchbox", { name: "搜索仓库" }).fill("api");
  await panel.getByRole("button", { name: "已禁用 3" }).click();
  await expectVisibleRepos(panel, ["核心平台", "账单平台"]);
  await panel.getByRole("button", { name: "启用当前结果" }).click();
  await expect(page.getByLabel("当前生成范围").getByText("4/5 个仓库")).toBeVisible();
  await expect.poll(() => storedDisabledRepos(page)).toEqual([repos[4].path, staleDisabledPath]);
  await page.getByRole("tab", { name: "健康" }).click();
  await expect(page.getByRole("region", { name: "工作区健康" }).getByText("启用 4 / 禁用 1")).toBeVisible();
});

test("guides recovery when every indexed repository is disabled", async ({ page }) => {
  await launchRepositoryPanel(page, repos.map((repo) => repo.path), "dark");
  const panel = repositoryPanel(page);

  await expect(page.getByLabel("当前生成范围").getByText("0/5 个仓库")).toBeVisible();
  await expect(panel.getByText("当前所有仓库均已禁用")).toBeVisible();
  await panel.getByRole("button", { name: "查看已禁用" }).click();
  await expect(panel.getByRole("button", { name: "已禁用 5" })).toHaveAttribute("aria-pressed", "true");
  await expect(panel.locator(".repo-row")).toHaveCount(5);

  await panel.getByRole("button", { name: "启用当前结果" }).click();
  await expect(page.getByLabel("当前生成范围").getByText("5 个仓库")).toBeVisible();
  await expect.poll(() => storedDisabledRepos(page)).toEqual([staleDisabledPath]);
});

async function launchRepositoryPanel(page: Page, disabledRepos = [repos[4].path], themeMode = "light") {
  const disabledPaths = new Set(disabledRepos);
  await launchApp(page, {
    settings: createSettings({ rootDirs: [root], disabledRepos: [...disabledRepos, staleDisabledPath], projectNamesText, themeMode }),
    repoCache: createRepoCache([root], repos),
    workspaceHealthResult: {
      roots: [{ path: root, status: "healthy", detail: "目录可访问" }],
      repos: repos.map((repo) => ({
        path: repo.path,
        name: repo.name,
        cachedBranch: repo.branch,
        currentBranch: repo.branch,
        status: "healthy",
        detail: "路径、Git 标记与分支状态正常",
        disabled: disabledPaths.has(repo.path),
      })),
    },
  });
  await expectWorkbench(page);
}

function repositoryPanel(page: Page) {
  return page.getByRole("region", { name: "仓库索引" });
}

async function expectVisibleRepos(panel: ReturnType<typeof repositoryPanel>, names: string[]) {
  await expect(panel.locator(".repo-row")).toHaveCount(names.length);
  for (const name of names) await expect(panel.getByRole("button", { name: new RegExp(name, "i") })).toBeVisible();
}

async function storedDisabledRepos(page: Page) {
  return page.evaluate(() => {
    const stored = window.localStorage.getItem("gitpulse-settings");
    return stored ? JSON.parse(stored).disabledRepos : [];
  });
}
