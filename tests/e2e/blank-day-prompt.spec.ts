import { expect, test } from "@playwright/test";
import {
  createRepo,
  createRepoCache,
  createSettings,
  expectWorkbench,
  launchApp,
} from "./support/tauri";

const repos = [createRepo("C:/workspace/gitpulse", "gitpulse", "main")];

test("shows and restores the concrete blank-day default prompt", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({
      rootDirs: ["C:/workspace"],
      aiEnabled: true,
      aiModel: "gpt-test",
      aiApiKey: "sk-test",
    }),
    secureApiKey: "sk-test",
    repoCache: createRepoCache(["C:/workspace"], repos),
    extractResults: [
      {
        repos,
        summaryText: "",
        commits: [commit("abc123def", "fix: 修复报告历史加载时的空值兼容")],
      },
      { repos, summaryText: "", commits: [] },
    ],
  });
  await expectWorkbench(page);

  await page.getByRole("button", { name: "空白日补写" }).click();
  const dialog = page.getByRole("dialog", { name: "空白日补写" });
  await expect(dialog).toBeVisible();
  const prompt = dialog.getByLabel("提示词");
  await expect(prompt).toHaveValue(/具体锚点/);
  await expect(prompt).toHaveValue(/功能延伸/);
  await expect(prompt).toHaveValue(/缺陷或回归修复/);
  await expect(prompt).toHaveValue(/测试补强/);
  await expect(prompt).toHaveValue(/不得只写/);
  await expect(prompt).not.toHaveValue(/偏「跟进 \/ 排查 \/ 推进 \/ 整理」/);

  await prompt.fill("临时自定义要求");
  await dialog.getByRole("button", { name: "恢复默认" }).click();
  await expect(prompt).toHaveValue(/具体锚点/);
  await expect(prompt).toHaveValue(/潜在缺陷只能写拟采取的保护或修复动作/);
});

function commit(hash: string, message: string) {
  return {
    repoPath: "C:/workspace/gitpulse",
    projectName: "gitpulse",
    branchName: "main",
    hash,
    author: "Playwright Tester",
    authorEmail: "playwright@example.com",
    date: "2026-07-15 10:00:00 +0800",
    message,
    additions: 3,
    deletions: 1,
    changedFiles: 1,
  };
}
