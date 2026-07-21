import { expect, test, type Page } from "@playwright/test";
import {
  createRepo,
  createRepoCache,
  createSettings,
  expectWorkbench,
  launchApp,
} from "./support/tauri";

const root = "C:/workspace";
const healthyRepo = createRepo(`${root}/gitpulse`, "gitpulse", "main");
const scannedAt = "2026-07-16T08:30:00.000Z";

test("shows an actionable empty workspace health state", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({ rootDirs: [] }),
    workspaceHealthResult: { roots: [], repos: [] },
  });

  await expectWorkbench(page);
  await page.getByRole("tab", { name: "健康" }).click();

  const health = page.getByRole("region", { name: "工作区健康" });
  await expect(health).toBeVisible();
  await expect(health.getByText("尚未配置工作区")).toBeVisible();
  await expect(health.getByRole("button", { name: "打开设置" })).toBeVisible();
  await expectHealthCommand(page, { rootDirs: [], indexedRepos: [], disabledRepos: [] });
});

test("summarizes a healthy workspace and refreshes it after rescanning", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({ rootDirs: [root] }),
    repoCache: {
      ...createRepoCache([root], [healthyRepo]),
      scannedAt,
    },
    scanRepos: [healthyRepo],
    workspaceHealthResult: {
      roots: [{ path: root, status: "healthy", detail: "目录可访问" }],
      repos: [{
        path: healthyRepo.path,
        name: healthyRepo.name,
        cachedBranch: "main",
        currentBranch: "main",
        status: "healthy",
        detail: "路径、Git 标记与分支状态正常",
        disabled: false,
      }],
    },
  });

  await expectWorkbench(page);
  await page.getByRole("tab", { name: "健康" }).click();
  const health = page.getByRole("region", { name: "工作区健康" });
  await expect(health.getByText("工作区状态正常")).toBeVisible();
  await expect(health).toContainText(formatExpectedScannedAt(scannedAt));
  await expect(health.getByText(root, { exact: true })).toBeVisible();
  await expect(health.getByText("gitpulse", { exact: true })).toBeVisible();

  await health.getByRole("button", { name: "重新扫描" }).click();
  await expect.poll(() => commandCount(page, "scan_repos")).toBe(1);
  await expect.poll(() => commandCount(page, "inspect_workspace_health")).toBe(2);

  await health.getByRole("button", { name: "打开设置" }).click();
  await page.getByRole("button", { name: `移除目录 ${root}` }).click();
  await expect.poll(() => commandCount(page, "inspect_workspace_health")).toBe(3);
  await expectHealthCommand(page, { rootDirs: [], indexedRepos: [], disabledRepos: [] });
});

function formatExpectedScannedAt(value: string) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}/${values.month}/${values.day} ${values.hour}:${values.minute}`;
}

test("supersedes a pending health check when workspace roots change", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({ rootDirs: [root] }),
    repoCache: createRepoCache([root], [healthyRepo]),
    workspaceHealthResult: { roots: [], repos: [] },
    deferredCommands: ["inspect_workspace_health"],
  });

  await expectWorkbench(page);
  await page.getByRole("tab", { name: "健康" }).click();
  await expect.poll(() => commandCount(page, "inspect_workspace_health")).toBe(1);

  const health = page.getByRole("region", { name: "工作区健康" });
  await health.getByRole("button", { name: "打开设置" }).click();
  await page.getByRole("button", { name: `移除目录 ${root}` }).click();
  await expect.poll(() => commandCount(page, "inspect_workspace_health")).toBe(2);
  await expectHealthCommand(page, { rootDirs: [], indexedRepos: [], disabledRepos: [] });

  await page.evaluate(() => window.__mockTauri.releaseCommand("inspect_workspace_health"));
  await page.evaluate(() => window.__mockTauri.releaseCommand("inspect_workspace_health"));
});

test("refreshes a health result loaded while repository scanning is pending", async ({ page }) => {
  const refreshedRepo = createRepo(`${root}/refreshed`, "refreshed", "main");
  await launchApp(page, {
    settings: createSettings({ rootDirs: [root] }),
    repoCache: createRepoCache([root], [healthyRepo]),
    scanRepos: [refreshedRepo],
    workspaceHealthResult: { roots: [], repos: [] },
    deferredCommands: ["scan_repos", "inspect_workspace_health"],
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "仓库管理" }).click();
  await page.getByRole("button", { name: "重新扫描仓库索引" }).click();
  await expect.poll(() => commandCount(page, "scan_repos")).toBe(1);
  await page.getByRole("tab", { name: "健康" }).click();
  await expectHealthCommand(page, { rootDirs: [root], indexedRepos: [healthyRepo], disabledRepos: [] });

  await page.evaluate(() => window.__mockTauri.releaseCommand("scan_repos"));
  await expect.poll(() => commandCount(page, "inspect_workspace_health")).toBe(2);
  await expectHealthCommand(page, { rootDirs: [root], indexedRepos: [refreshedRepo], disabledRepos: [] });
  await page.evaluate(() => window.__mockTauri.releaseCommand("inspect_workspace_health"));
  await page.evaluate(() => window.__mockTauri.releaseCommand("inspect_workspace_health"));
});

test("repairs a partially invalid workspace and keeps report scope in sync", async ({ page }) => {
  const missingRepo = createRepo(`${root}/moved-api`, "moved-api", "main");
  const unknownRepo = createRepo(`${root}/unknown-branch`, "unknown-branch", "main");
  const disabledRepo = createRepo(`${root}/disabled-web`, "disabled-web", "main");
  const scannedAt = "2026-07-15T03:20:00.000Z";
  await launchApp(page, {
    settings: createSettings({
      rootDirs: [root, "D:/offline"],
      disabledRepos: [disabledRepo.path],
      themeMode: "dark",
    }),
    repoCache: {
      ...createRepoCache([root, "D:/offline"], [missingRepo, unknownRepo, disabledRepo]),
      scannedAt,
    },
    workspaceHealthResult: {
      roots: [
        { path: root, status: "healthy", detail: "目录可访问" },
        { path: "D:/offline", status: "missing", detail: "目录已移动、删除或未挂载" },
      ],
      repos: [
        {
          path: missingRepo.path,
          name: missingRepo.name,
          cachedBranch: "main",
          currentBranch: "",
          status: "missing",
          detail: "仓库目录已移动或删除",
          disabled: false,
        },
        {
          path: unknownRepo.path,
          name: unknownRepo.name,
          cachedBranch: "main",
          currentBranch: "",
          status: "branch_unknown",
          detail: "无法读取当前分支",
          disabled: false,
        },
        {
          path: disabledRepo.path,
          name: disabledRepo.name,
          cachedBranch: "main",
          currentBranch: "main",
          status: "healthy",
          detail: "路径、Git 标记与分支状态正常",
          disabled: true,
        },
      ],
    },
  });
  page.on("dialog", (dialog) => dialog.accept());

  await expectWorkbench(page);
  await page.getByRole("tab", { name: "健康" }).click();
  const health = page.getByRole("region", { name: "工作区健康" });
  await expect(health.getByText("发现需要处理的工作区问题")).toBeVisible();
  await expect(health.getByText("路径已失效")).toBeVisible();
  await expect(health.getByText("分支未知")).toBeVisible();

  const missingRow = health.getByRole("row", { name: /moved-api/ });
  await missingRow.getByRole("button", { name: "移除索引" }).click();
  await expect(missingRow).toHaveCount(0);

  const disabledRow = health.getByRole("row", { name: /disabled-web/ });
  await disabledRow.getByRole("button", { name: "启用" }).click();
  await expect(health.getByText("启用 2 / 禁用 0")).toBeVisible();

  await page.getByRole("tab", { name: "报告" }).click();
  await expect(page.getByLabel("当前生成范围").getByText("2 个仓库")).toBeVisible();
  const stored = await page.evaluate(() => ({
    cache: JSON.parse(window.localStorage.getItem("gitpulse-repo-index-cache") ?? "{}"),
    settings: JSON.parse(window.localStorage.getItem("gitpulse-settings") ?? "{}"),
  }));
  expect(stored.cache.repos).toHaveLength(2);
  expect(stored.cache.scannedAt).toBe(scannedAt);
  expect(stored.settings.disabledRepos).not.toContain(disabledRepo.path);
});

async function expectHealthCommand(page: Page, expectedOptions: Record<string, unknown>) {
  await expect.poll(async () => {
    const call = await page.evaluate(() =>
      window.__mockTauri.calls.filter((entry) => entry.cmd === "inspect_workspace_health").at(-1),
    );
    return call?.args.options;
  }).toEqual(expectedOptions);
}

async function commandCount(page: Page, command: string) {
  return page.evaluate((cmd) => window.__mockTauri.calls.filter((call) => call.cmd === cmd).length, command);
}
