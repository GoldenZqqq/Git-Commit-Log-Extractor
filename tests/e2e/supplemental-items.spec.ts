import { expect, test } from "@playwright/test";
import {
  createRepo,
  createRepoCache,
  createSettings,
  expectWorkbench,
  launchApp,
} from "./support/tauri";

const repos = [createRepo("C:/workspace/gitpulse", "gitpulse", "main")];
const settings = createSettings({
  rootDirs: ["C:/workspace"],
  outputEnabled: true,
  outputDir: "C:/exports",
  author: "Playwright Tester",
  aiEnabled: true,
  aiModel: "gpt-test",
  aiApiKey: "sk-test",
});

test("adds non-Git supplemental facts to every report mode and history", async ({ page }) => {
  const reportText = [
    "# 今日工作报告",
    "",
    "- 完成补充事项数据流",
    "",
    "## 用户补充事项（非 Git）",
    "",
    "- 参与支付联调并确认回退路径",
    "- 完成上线后验证",
  ].join("\n");
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    extractResults: [
      reportResult(reportText, "abc1235", "feat: 完成补充事项数据流"),
      reportResult(
        "# 自定义报告\n\n## 用户补充事项（非 Git）\n\n- 整理跨周期复盘材料",
        "abc1236",
        "feat: 完成自定义补充事项",
      ),
    ],
    periodResults: {
      weekly: periodResult("weekly", "2026-W29", "参加周会并同步风险"),
      monthly: periodResult("monthly", "2026-06", "完成月度复盘会议"),
    },
    enhanceResult: { reportText, warnings: [] },
    secureApiKey: "sk-test",
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "展开补充事项" }).click();
  await page.getByLabel("补充事项（非 Git）").fill("参与支付联调并确认回退路径\n完成上线后验证");
  await page.getByRole("button", { name: "生成日报" }).click();

  const extractCalls = await commandCalls(page, "extract_commits");
  expect(extractCalls[0].args.options.supplementalItems).toEqual([
    "参与支付联调并确认回退路径",
    "完成上线后验证",
  ]);
  await expect(page.getByText("用户补充事项（非 Git）")).toBeVisible();

  await expect.poll(async () => (await storedHistory(page))[0]?.supplementalItems).toEqual(
    extractCalls[0].args.options.supplementalItems,
  );

  await page.getByLabel("选择日报日期").fill("2026-07-01");
  await expect(page.getByLabel("补充事项（非 Git）")).toHaveValue("");
  await page.getByRole("tab", { name: /最近/ }).click();
  await page.getByRole("button", { name: /日报 · / }).click();
  await expect(page.getByLabel("补充事项（非 Git）")).toHaveValue("参与支付联调并确认回退路径\n完成上线后验证");

  await page.getByRole("button", { name: "AI润色" }).click();
  await expect.poll(async () => (await commandCalls(page, "enhance_report")).length).toBe(1);
  const [enhanceCall] = await commandCalls(page, "enhance_report");
  expect(enhanceCall.args.options.baseReport).toContain("用户补充事项（非 Git）");
  expect(enhanceCall.args.options.refinementInstruction).toContain("用户明确提供的事实");
  await page.getByRole("button", { name: "接受润色" }).click();
  await expect(page.getByRole("region", { name: "AI 润色对照" })).toHaveCount(0);

  await generateWithSupplement(page, "周报", "参加周会并同步风险");
  await generateWithSupplement(page, "月报", "完成月度复盘会议");
  await generateWithSupplement(page, "自定义", "整理跨周期复盘材料");

  const periodCalls = await commandCalls(page, "generate_period_report");
  expect(periodCalls.map((call) => call.args.options.supplementalItems)).toEqual([
    ["参加周会并同步风险"],
    ["完成月度复盘会议"],
  ]);
  const allExtractCalls = await commandCalls(page, "extract_commits");
  expect(allExtractCalls[1].args.options.reportKind).toBe("custom");
  expect(allExtractCalls[1].args.options.supplementalItems).toEqual(["整理跨周期复盘材料"]);
});

test("validates supplemental item limits and clears the current draft", async ({ page }) => {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "展开补充事项" }).click();
  const input = page.getByLabel("补充事项（非 Git）");

  await input.fill(Array.from({ length: 21 }, (_, index) => `补充事项 ${index + 1}`).join("\n"));
  await expect(page.getByText("补充事项最多填写 20 项")).toBeVisible();
  await page.getByRole("button", { name: "生成日报" }).click();
  await expect(page.locator(".run-status")).toHaveText("补充事项最多填写 20 项");
  expect(await commandCalls(page, "extract_commits")).toHaveLength(0);

  await input.fill("字".repeat(201));
  await expect(page.getByText("第 1 条补充事项不能超过 200 个字符")).toBeVisible();

  await input.fill("等待清空的补充事项");
  await page.getByRole("button", { name: "清空", exact: true }).click();
  await expect(input).toHaveValue("");
});

function reportResult(summaryText: string, hash: string, message: string) {
  return { repos, summaryText, detailedText: "", warnings: [], commits: [createCommit(hash, message)] };
}

function periodResult(reportKind: "weekly" | "monthly", periodLabel: string, supplementalItem: string) {
  return {
    reportText: `# 报告\n\n## 用户补充事项（非 Git）\n\n- ${supplementalItem}`,
    outputFile: "",
    warnings: [],
    startDate: reportKind === "weekly" ? "2026-07-13" : "2026-06-01",
    endDate: reportKind === "weekly" ? "2026-07-19" : "2026-06-30",
    periodLabel,
    reportKind,
    projectCount: 1,
    commitCount: 1,
  };
}

async function generateWithSupplement(page: Parameters<typeof expectWorkbench>[0], mode: "周报" | "月报" | "自定义", item: string) {
  await page.getByRole("button", { name: mode }).click();
  await page.getByLabel("补充事项（非 Git）").fill(item);
  await page.getByRole("button", { name: `生成${mode === "自定义" ? "自定义报告" : mode}` }).click();
}

async function commandCalls(page: Parameters<typeof expectWorkbench>[0], command: string) {
  return page.evaluate((cmd) => window.__mockTauri.calls.filter((call) => call.cmd === cmd), command);
}

async function storedHistory(page: Parameters<typeof expectWorkbench>[0]) {
  return page.evaluate(() => window.__mockTauri.reportHistoryStore);
}

function createCommit(hash: string, message: string) {
  return {
    repoPath: "C:/workspace/gitpulse",
    projectName: "gitpulse",
    branchName: "main",
    hash,
    author: "Playwright Tester",
    authorEmail: "playwright.tester@example.com",
    date: "2026-07-02 10:00:00 +0800",
    message,
  };
}
