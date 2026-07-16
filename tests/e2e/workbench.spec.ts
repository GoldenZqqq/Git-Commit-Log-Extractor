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
const settings = createSettings({
  rootDirs: ["C:/workspace"],
  outputEnabled: true,
  outputDir: "C:/exports",
  author: "Playwright Tester",
});
const dailyCommits = [
  createCommit("abc1231", "feat: 完成浏览器级诊断校验"),
  createCommit("abc1232", "ci: 接入 GitHub Actions 日常门禁"),
];

test("renders mocked diagnostics in settings", async ({ page }) => {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    diagnosticsResult: {
      items: [
        {
          id: "git",
          label: "Git 命令",
          severity: "ok",
          message: "Git 命令可用。",
          action: "",
        },
        {
          id: "network-github",
          label: "GitHub 网络",
          severity: "warning",
          message: "GitHub 可连接，但返回 HTTP 429。",
          action: "检查代理、公司网络策略或 GitHub 访问限制。",
        },
        {
          id: "output-dir",
          label: "输出目录",
          severity: "error",
          message: "输出目录不存在。",
          action: "请在设置中重新选择可用目录。",
        },
      ],
      okCount: 1,
      warningCount: 1,
      errorCount: 1,
    },
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "打开设置" }).click();
  await page.getByRole("button", { name: "诊断" }).click();

  await expect(page.getByText("本地数据边界")).toBeVisible();
  await expect(page.getByText("GitPulse 只读取你选择的本机目录和 Git 元数据")).toBeVisible();
  await expect(page.getByText("未配置或未点击 AI 润色时，报告草稿、提交记录和项目映射不会发送到外部 AI 服务。")).toBeVisible();
  await expect(page.getByText("1 异常")).toBeVisible();
  await expect(page.getByText("1 提醒")).toBeVisible();
  await expect(page.getByText("1 正常")).toBeVisible();
  await expect(page.getByText("Git 命令可用。")).toBeVisible();
  await expect(page.getByText("GitHub 可连接，但返回 HTTP 429。")).toBeVisible();
  await expect(page.getByText("请在设置中重新选择可用目录。")).toBeVisible();
});

test("suggests project mappings for unmapped repositories", async ({ page }) => {
  const mappingRepos = [createRepo("C:/workspace/learning-platform-api", "learning-platform-api", "main")];
  await launchApp(page, {
    settings: createSettings({ ...settings, projectNamesText: "" }),
    repoCache: createRepoCache(["C:/workspace"], mappingRepos),
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "打开设置" }).click();
  await page.getByRole("button", { name: "项目映射" }).click();

  await expect(page.getByLabel("未映射仓库建议")).toBeVisible();
  await expect(page.getByText("Learning Platform Api")).toBeVisible();
  await page.getByRole("button", { name: "填入", exact: true }).click();

  await expect(page.getByLabel("未映射仓库建议")).toBeHidden();

  const savedMapping = await page.evaluate(() => {
    const saved = window.localStorage.getItem("gitpulse-settings");
    return saved ? JSON.parse(saved).projectNamesText : "";
  });
  expect(savedMapping).toContain("learning-platform-api(*) -> Learning Platform Api");
});

test("applies report purpose presets to templates and generation options", async ({ page }) => {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    periodResults: {
      monthly: {
        reportText: "# 2026-06 绩效月报\n\n- 完成绩效材料模板",
        outputFile: "C:/exports/monthly_report_2026-06.md",
        warnings: [],
        periodLabel: "2026-06",
        reportKind: "monthly",
        projectCount: 1,
        commitCount: 2,
      },
    },
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "打开设置" }).click();
  await page.getByRole("button", { name: "报告格式" }).click();
  await page.locator(".report-purpose-presets button").filter({ hasText: "绩效材料" }).click();
  await page.getByRole("radio", { name: "月报" }).click();

  await expect(page.locator("textarea.report-template-input")).toHaveValue(/绩效月报/);
  await page.getByRole("button", { name: "关闭设置" }).click();

  await page.getByRole("button", { name: "月报" }).click();
  await page.getByRole("button", { name: "生成月报" }).click();

  const generateCalls = await page.evaluate(() =>
    window.__mockTauri.calls.filter((call) => call.cmd === "generate_period_report"),
  );
  expect(generateCalls).toHaveLength(1);
  expect(generateCalls[0].args.options.reportFormatTemplates.monthly).toContain("绩效月报");
  expect(generateCalls[0].args.options.refinementInstruction).toContain("报告用途：绩效材料");
});

test("generates and exports a daily report", async ({ page }) => {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    extractResults: [
      {
        repos,
        summaryText: "# 今日工作报告\n\n- 完成浏览器级诊断校验\n- 接入 GitHub Actions 日常门禁",
        detailedText: "",
        warnings: [],
        commits: dailyCommits,
      },
    ],
    outputDir: "C:/exports",
  });

  await expectWorkbench(page);
  const scope = page.getByLabel("当前生成范围");
  await expect(scope).toBeVisible();
  await expect(scope.getByText("Playwright Tester")).toBeVisible();
  await expect(scope.getByText("1 个仓库")).toBeVisible();
  await expect(scope.getByText("当前分支")).toBeVisible();
  await expect(scope.getByText("未显示")).toBeVisible();
  await expect(scope.getByText("已配置")).toBeVisible();

  await page.getByRole("button", { name: "生成日报" }).click();

  await expect(page.getByText("完成浏览器级诊断校验")).toBeVisible();
  await openAssistTab(page, /交付/);
  const qualityPanel = page.getByLabel("报告交付质量提示");
  await expect(qualityPanel).toBeVisible();
  await expect(page.getByText("2 条提交")).toBeVisible();
  await expect(page.getByText("1 个项目")).toBeVisible();
  await expect(page.getByText("AI 待配置")).toBeVisible();
  await expect(qualityPanel.getByText("证据未显示")).toBeVisible();
  await expect(page.getByText("可导出")).toBeVisible();
  await openAssistTab(page, /最近/);
  await expect(page.getByRole("button", { name: /日报 · \d{4}-\d{2}-\d{2}/ })).toBeVisible();

  await page.locator("button.preview-save-button").click();

  await expect(page.getByText(/输出文件：.*\.md/)).toBeVisible();
  await expect(page.locator(".history-badge.exported")).toBeVisible();

  const saveCalls = await page.evaluate(() =>
    window.__mockTauri.calls.filter((call) => call.cmd === "save_report_file"),
  );
  expect(saveCalls).toHaveLength(1);
  expect(saveCalls[0].args.format).toBe("markdown");
});

test("opens the batch report output directory after generation", async ({ page }) => {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    batchResult: {
      total: 10,
      succeeded: 10,
      failed: 0,
      failures: [],
      outputDir: "C:/exports/batch",
    },
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "批量", exact: true }).click();

  const dateInputs = page.locator('.range-dialog input[type="date"]');
  await dateInputs.nth(0).fill("2026-07-01");
  await dateInputs.nth(1).fill("2026-07-05");
  await page.getByLabel("拆分粒度").selectOption("custom");
  const startBatchButton = page.getByRole("button", { name: "开始生成" });
  const allGroups = page.getByRole("radio", { name: "全部汇总" });
  const authorGroups = page.getByRole("radio", { name: "按作者" });
  const projectGroups = page.getByRole("radio", { name: "按项目" });
  const fileNameTemplate = page.getByLabel("文件命名模板");
  const templateTokens = page.getByRole("group", { name: "可用文件名变量" });
  await expect(templateTokens.getByRole("button")).toHaveCount(10);
  await templateTokens.getByRole("button", { name: "复制变量 {period}" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("{period}");
  await expect(page.getByRole("status").getByText("已复制 {period}")).toBeVisible();
  await expect(allGroups).toBeChecked();
  await authorGroups.check();
  await expect(fileNameTemplate).toHaveValue("{period}-{author}-{type}.{ext}");
  await projectGroups.check();
  await expect(fileNameTemplate).toHaveValue("{period}-{project}-{type}.{ext}");
  await authorGroups.check();
  const markdownFormat = page.getByRole("checkbox", { name: "Markdown" });
  await expect(markdownFormat).toBeChecked();
  const markdownLabel = markdownFormat.locator("xpath=following-sibling::span");
  await expect.poll(() => markdownLabel.evaluate((label) => label.scrollWidth <= label.clientWidth)).toBe(true);
  await markdownFormat.uncheck();
  await expect(page.getByText("请至少选择一种导出格式。")).toBeVisible();
  await expect(startBatchButton).toBeDisabled();
  await markdownFormat.check();
  await page.getByRole("checkbox", { name: "Word" }).check();
  await fileNameTemplate.fill("{period}.md");
  await expect(page.getByText("文件名模板必须以 .{ext} 结尾。")).toBeVisible();
  await expect(startBatchButton).toBeDisabled();
  await fileNameTemplate.fill("{period}-{author}-{type}.{ext}");
  await startBatchButton.click();

  await expect(page.getByText("生成完成：共 10 个文件")).toBeVisible();
  const batchCalls = await page.evaluate(() =>
    window.__mockTauri.calls.filter((call) => call.cmd === "batch_generate_reports"),
  );
  expect(batchCalls).toHaveLength(1);
  expect(batchCalls[0].args.options.splitGranularity).toBe("custom");
  expect(batchCalls[0].args.options.groupMode).toBe("author");
  expect(batchCalls[0].args.options.exportFormats).toEqual(["markdown", "docx"]);
  expect(batchCalls[0].args.options.fileNameTemplate).toBe("{period}-{author}-{type}.{ext}");

  await page.getByRole("button", { name: "打开输出目录" }).click();

  const openCalls = await page.evaluate(() =>
    window.__mockTauri.calls.filter((call) => call.cmd === "open_output_directory"),
  );
  expect(openCalls).toHaveLength(1);
  expect(openCalls[0].args.path).toBe("C:/exports/batch");
});

test("keeps export setup visible when output is not configured", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({ ...settings, outputEnabled: false, outputDir: "" }),
    repoCache: createRepoCache(["C:/workspace"], repos),
    extractResults: [
      {
        repos,
        summaryText: "# 今日工作报告\n\n- 补齐未配置导出时的操作入口",
        detailedText: "",
        warnings: [],
        commits: [createCommit("abc1236", "fix: 补齐未配置导出时的操作入口")],
      },
    ],
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "生成日报" }).click();

  await expect(page.getByText("补齐未配置导出时的操作入口")).toBeVisible();
  const scope = page.getByLabel("当前生成范围");
  await expect(scope.getByText("未开启")).toBeVisible();
  await expect(page.getByRole("button", { name: "设置导出" })).toBeVisible();

  await page.getByRole("button", { name: "设置导出" }).click();

  await expect(page.getByRole("dialog", { name: "应用设置" })).toBeVisible();
  await expect(page.getByRole("status").getByText("请先开启输出到文件并选择输出目录")).toBeVisible();
  await expect(page.getByText("基础配置")).toBeVisible();
  await expect(page.getByText("输出到文件", { exact: true })).toBeVisible();
  await expect(page.getByText("高级提取设置")).toBeVisible();
  await expect(page.getByLabel("作者身份别名")).toBeHidden();

  const saveCalls = await page.evaluate(() =>
    window.__mockTauri.calls.filter((call) => call.cmd === "save_report_file"),
  );
  expect(saveCalls).toHaveLength(0);
});

test("renders generation scope with dark theme surfaces", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({ ...settings, themeMode: "dark", outputEnabled: false, outputDir: "" }),
    repoCache: createRepoCache(["C:/workspace"], repos),
    extractResults: [
      {
        repos,
        summaryText: "# 暗色模式日报\n\n- 验证范围条暗色背景",
        detailedText: "",
        warnings: [],
        commits: [createCommit("abc1237", "fix: 验证范围条暗色背景")],
      },
    ],
  });

  await expectWorkbench(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("当前生成范围").getByText("未开启")).toBeVisible();
  await page.getByRole("button", { name: "生成日报" }).click();
  await expect(page.getByRole("button", { name: "设置导出" })).toBeVisible();

  const colors = await page.evaluate(() => {
    const strip = document.querySelector(".generation-scope-strip");
    const item = document.querySelector(".generation-scope-item");
    const attention = document.querySelector(".generation-scope-item.attention");
    const setupButton = document.querySelector(".export-split.needs-setup .preview-save-button");
    return {
      attentionBackground: attention ? getComputedStyle(attention).backgroundColor : "",
      itemBackground: item ? getComputedStyle(item).backgroundColor : "",
      setupButtonBackground: setupButton ? getComputedStyle(setupButton).backgroundColor : "",
      stripBackground: strip ? getComputedStyle(strip).backgroundColor : "",
    };
  });

  expect(cssRgbBrightness(colors.stripBackground)).toBeLessThan(80);
  expect(cssRgbBrightness(colors.itemBackground)).toBeLessThan(90);
  expect(cssRgbBrightness(colors.attentionBackground)).toBeLessThan(110);
  expect(cssRgbBrightness(colors.setupButtonBackground)).toBeLessThan(110);
});

test("guides users when workspace has no indexed repositories", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({ ...settings, rootDirs: [] }),
    scanRepos: [],
    dialogResponses: [["C:/empty-workspace"]],
  });

  await expectWorkbench(page);
  const emptyState = page.getByLabel("仓库索引为空");
  await expect(emptyState).toBeVisible();
  await expect(emptyState.getByText("先添加仓库根目录")).toBeVisible();
  await expect(emptyState.getByText("选择存放代码项目的文件夹后，GitPulse 会扫描其中的本地 Git 仓库。")).toBeVisible();
  await expect(emptyState.getByText("多个工作区可分次添加。")).toBeVisible();

  await emptyState.getByRole("button", { name: "添加目录" }).click();
  await expect(emptyState.getByText("还没有扫描到 Git 仓库")).toBeVisible();
  await expect(emptyState.getByText("确认项目目录内存在 `.git`。")).toBeVisible();
  await emptyState.getByRole("button", { name: "重新扫描" }).click();

  const scanCalls = await page.evaluate(() =>
    window.__mockTauri.calls.filter((call) => call.cmd === "scan_repos"),
  );
  expect(scanCalls).toHaveLength(1);
  expect(scanCalls[0].args.rootDirs).toEqual(["C:/empty-workspace"]);
});

test("keeps valid repositories and shows skipped path warnings after scanning", async ({ page }) => {
  const scanWarning = "扫描已跳过“C:/workspace/broken-link”：读取链接目标失败（找不到指定文件）";
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], []),
    scanRepos: repos,
    scanWarnings: [scanWarning],
  });

  await expectWorkbench(page);
  await page.getByLabel("仓库索引为空").getByRole("button", { name: "重新扫描" }).click();

  await expect(page.locator(".run-status")).toContainText("已发现 1 个仓库，部分路径已跳过");
  await expect(page.getByText(scanWarning)).toBeVisible();
  await expect(page.getByText("gitpulse", { exact: true })).toBeVisible();
});

test("shows actionable guidance for empty daily reports", async ({ page }) => {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    extractResults: [
      {
        repos,
        summaryText: "- 未检索到提交记录。",
        detailedText: "",
        warnings: [],
        commits: [],
      },
    ],
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "生成日报" }).click();

  await expect(page.getByText("本次报告没有匹配到提交")).toBeVisible();
  await expect(page.getByText(/日报 · \d{4}-\d{2}-\d{2} · 作者：Playwright Tester · 1 个启用仓库/)).toBeVisible();
  await expect(page.getByText("若已填写作者，请核对 Git name/email；留空会按全部作者提取。")).toBeVisible();
  await expect(page.getByRole("button", { name: "检查作者/分支" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新扫描仓库", exact: true })).toBeVisible();
});

test("generates daily reports for all authors when author is blank", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({ ...settings, author: "" }),
    repoCache: createRepoCache(["C:/workspace"], repos),
    extractResults: [
      {
        repos,
        summaryText: "# 全部作者日报\n\n- 汇总团队当天提交",
        detailedText: "",
        warnings: [],
        commits: [createCommit("abc1233", "feat: 汇总团队当天提交", "Alice")],
      },
    ],
  });

  await expectWorkbench(page);
  await expect(page.getByRole("button", { name: "全部作者" })).toBeVisible();
  await page.getByRole("button", { name: "生成日报" }).click();

  await expect(page.getByText("汇总团队当天提交")).toBeVisible();

  const extractCalls = await page.evaluate(() =>
    window.__mockTauri.calls.filter((call) => call.cmd === "extract_commits"),
  );
  expect(extractCalls).toHaveLength(1);
  expect(extractCalls[0].args.options.author).toBe("");
});

test("expands author aliases when generating daily reports", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({ ...settings, author: "GoldenZqqq", authorAliasesText: "" }),
    repoCache: createRepoCache(["C:/workspace"], repos),
    extractResults: [
      {
        repos,
        summaryText: "# 别名日报\n\n- 汇总多个 Git 身份提交",
        detailedText: "",
        warnings: [],
        commits: [createCommit("abc1234", "feat: 汇总多个 Git 身份提交", "zqqq")],
      },
    ],
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "打开设置" }).click();
  await page.getByText("高级提取设置").click();
  await page.getByLabel("作者身份别名").fill("GoldenZqqq -> zqqq, golden@example.com");
  await page.getByRole("button", { name: "关闭设置" }).click();
  await page.getByRole("button", { name: "生成日报" }).click();

  const extractCalls = await page.evaluate(() =>
    window.__mockTauri.calls.filter((call) => call.cmd === "extract_commits"),
  );
  expect(extractCalls).toHaveLength(1);
  expect(extractCalls[0].args.options.author).toContain("GoldenZqqq");
  expect(extractCalls[0].args.options.author).toContain("zqqq");
  expect(extractCalls[0].args.options.author).toContain("golden@example.com");
  expect(extractCalls[0].args.options.authorDisplayName).toBe("GoldenZqqq");
  expect(extractCalls[0].args.options.authorAliases).toEqual([
    { displayName: "GoldenZqqq", aliases: ["zqqq", "golden@example.com"] },
  ]);
});

test("passes evidence link rules when generating daily reports", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({ ...settings, showEvidenceDetails: true, evidenceLinkPrefixesText: "" }),
    repoCache: createRepoCache(["C:/workspace"], repos),
    extractResults: [
      {
        repos,
        summaryText: "# 证据日报\n\n- 关联需求 #123",
        detailedText: "",
        warnings: [],
        commits: [createCommit("abc1235", "feat: 关联需求 #123", "Playwright Tester")],
      },
    ],
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "打开设置" }).click();
  await page.getByText("高级提取设置").click();
  await page
    .getByLabel("证据链接前缀")
    .fill("# -> https://github.com/org/repo/issues/{id}\nPR -> https://github.com/org/repo/pull/{id}");
  await page.getByRole("button", { name: "关闭设置" }).click();
  await page.getByRole("button", { name: "生成日报" }).click();

  const extractCalls = await page.evaluate(() =>
    window.__mockTauri.calls.filter((call) => call.cmd === "extract_commits"),
  );
  expect(extractCalls).toHaveLength(1);
  expect(extractCalls[0].args.options.showEvidenceDetails).toBe(true);
  expect(extractCalls[0].args.options.evidenceLinkRules).toEqual([
    { prefix: "#", urlTemplate: "https://github.com/org/repo/issues/{id}" },
    { prefix: "PR", urlTemplate: "https://github.com/org/repo/pull/{id}" },
  ]);
});

test("generates and exports a weekly report", async ({ page }) => {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    periodResults: {
      weekly: {
        reportText: "# 2026-W27 工作周报\n\n- 接入 Playwright 汶览器级端到端护栏\n- 补齐周报生成路径回归",
        outputFile: "C:/exports/weekly_report_2026-W27.md",
        warnings: [],
        periodLabel: "2026-W27",
        reportKind: "weekly",
        projectCount: 1,
        commitCount: 2,
      },
    },
    outputDir: "C:/exports",
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "周报" }).click();
  await page.getByRole("button", { name: "生成周报" }).click();

  await expect(page.getByText("接入 Playwright 汶览器级端到端护栏")).toBeVisible();
  await openAssistTab(page, /最近/);
  await expect(page.getByText(/周报 · 2026-W27/)).toBeVisible();
  await expect(page.getByText(/输出文件：.*weekly_report_2026-W27\.md/)).toBeVisible();

  await page.locator("button.preview-save-button").click();

  await expect(page.locator(".history-badge.exported")).toBeVisible();

  const generateCalls = await page.evaluate(() =>
    window.__mockTauri.calls.filter((call) => call.cmd === "generate_period_report"),
  );
  expect(generateCalls).toHaveLength(1);
  expect(generateCalls[0].args.options.reportKind).toBe("weekly");

  const saveCalls = await page.evaluate(() =>
    window.__mockTauri.calls.filter((call) => call.cmd === "save_report_file"),
  );
  expect(saveCalls).toHaveLength(1);
  expect(saveCalls[0].args.format).toBe("markdown");
  expect(saveCalls[0].args.baseName).toContain("weekly_report_2026-W27");
});

test("passes redaction options when generating a traceable weekly report", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({
      ...settings,
      showEvidenceDetails: true,
      redactionEnabled: true,
      redactionRulesText: "内部项目 -> 项目A\nSECRET_TOKEN",
    }),
    repoCache: createRepoCache(["C:/workspace"], repos),
    periodResults: {
      weekly: {
        reportText: "# 2026-W27 工作周报\n\n- 项目A完成验收\n  > 来源：`仓库1` / `分支1` / `2026-07-01` / `commit-1`",
        outputFile: "C:/exports/weekly_report_2026-W27.md",
        warnings: [],
        periodLabel: "2026-W27",
        reportKind: "weekly",
        projectCount: 1,
        commitCount: 1,
        projects: [
          { name: "仓库1(分支1)", commitCount: 1, evidenceIds: ["commit-1"] },
        ],
      },
    },
    outputDir: "C:/exports",
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "周报" }).click();
  await page.getByRole("button", { name: "生成周报" }).click();

  await expect(page.getByText("项目A完成验收")).toBeVisible();
  await expect(page.locator(".generation-scope-strip")).toContainText("脱敏");
  await expect(page.locator(".generation-scope-strip")).toContainText("已启用");

  const generateCalls = await page.evaluate(() =>
    window.__mockTauri.calls.filter((call) => call.cmd === "generate_period_report"),
  );
  expect(generateCalls).toHaveLength(1);
  expect(generateCalls[0].args.options.showEvidenceDetails).toBe(true);
  expect(generateCalls[0].args.options.redaction).toEqual({
    enabled: true,
    rules: [
      { find: "内部项目", replacement: "项目A" },
      { find: "SECRET_TOKEN", replacement: "***" },
    ],
  });
  const stored = await page.evaluate(() => window.__mockTauri.reportHistoryStore[0]);
  expect(stored.projects).toEqual([
    { name: "仓库1(分支1)", commitCount: 1, evidenceIds: ["commit-1"] },
  ]);
  expect(JSON.stringify(stored.projects)).not.toContain("gitpulse");
});

test("generates and exports a monthly report", async ({ page }) => {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    periodResults: {
      monthly: {
        reportText: "# 2026-06 工作月报\n\n- 完成报告逻辑拆分与导出能力加固\n- 修复 Conventional Commits scope 剥离",
        outputFile: "C:/exports/monthly_report_2026-06.md",
        warnings: [],
        periodLabel: "2026-06",
        reportKind: "monthly",
        projectCount: 2,
        commitCount: 5,
      },
    },
    outputDir: "C:/exports",
  });

  await expectWorkbench(page);
  await page.getByRole("button", { name: "月报" }).click();
  await page.getByRole("button", { name: "生成月报" }).click();

  await expect(page.getByText("完成报告逻辑拆分与导出能力加固")).toBeVisible();
  await openAssistTab(page, /最近/);
  await expect(page.getByRole("button", { name: /月报 · 2026-06/ })).toBeVisible();
  await expect(page.getByText(/输出文件：.*monthly_report_2026-06\.md/)).toBeVisible();

  await page.locator("button.preview-save-button").click();

  await expect(page.locator(".history-badge.exported")).toBeVisible();

  const generateCalls = await page.evaluate(() =>
    window.__mockTauri.calls.filter((call) => call.cmd === "generate_period_report"),
  );
  expect(generateCalls).toHaveLength(1);
  expect(generateCalls[0].args.options.reportKind).toBe("monthly");

  const saveCalls = await page.evaluate(() =>
    window.__mockTauri.calls.filter((call) => call.cmd === "save_report_file"),
  );
  expect(saveCalls).toHaveLength(1);
  expect(saveCalls[0].args.baseName).toContain("monthly_report_2026-06");
});

test("opens and clears report history", async ({ page }) => {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    reportHistory: [
      createHistoryEntry({
        id: "history-weekly",
        mode: "weekly",
        title: "周报 · 2026-W27",
        periodLabel: "2026-W27",
        range: { startDate: "2026-06-29", endDate: "2026-07-05" },
        commitCount: 3,
        reportText: "# 2026年第27周工作周报\n\n- 处理诊断网络检查\n- 清理历史记录展示",
      }),
    ],
  });

  await expectWorkbench(page);
  await openAssistTab(page, /最近/);
  await page.getByRole("button", { name: /周报 · 2026-W27/ }).click();
  await expect(page.getByText("处理诊断网络检查")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "清空" }).click();

  await expect(page.getByText("生成报告后会在这里保留最近记录，可重新打开、复制或按同一周期重新生成。")).toBeVisible();
});

test("filters report history by type date status and search", async ({ page }) => {
  await launchApp(page, {
    settings,
    repoCache: createRepoCache(["C:/workspace"], repos),
    reportHistory: [
      createHistoryEntry({
        id: "history-weekly-ai",
        mode: "weekly",
        title: "周报 · 2026-W24",
        periodLabel: "2026-W24",
        range: { startDate: "2026-06-08", endDate: "2026-06-14" },
        generatedAt: "2026-06-14T10:00:00.000Z",
        aiEnhanced: true,
        outputFile: "C:/exports/weekly_report_2026-W24.md",
        reportText: "# 2026-W24\n\n## 支付平台\n- 处理交易证据链",
      }),
      createHistoryEntry({
        id: "history-monthly",
        mode: "monthly",
        title: "月报 · 2026-07",
        periodLabel: "2026-07",
        range: { startDate: "2026-07-01", endDate: "2026-07-31" },
        generatedAt: "2026-07-31T10:00:00.000Z",
        aiEnhanced: false,
        outputFile: "",
        reportText: "# 2026-07\n\n## CRM 平台\n- 整理客户跟进月报",
      }),
    ],
  });

  await expectWorkbench(page);
  await openAssistTab(page, /最近/);
  await page.getByLabel("筛选报告类型").selectOption("weekly");
  await expect(page.getByRole("button", { name: /周报 · 2026-W24/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /月报 · 2026-07/ })).toHaveCount(0);

  await page.getByRole("button", { name: "重置" }).click();
  await page.getByLabel("搜索历史报告").fill("CRM");
  await expect(page.getByRole("button", { name: /月报 · 2026-07/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /周报 · 2026-W24/ })).toHaveCount(0);

  await page.getByRole("button", { name: "重置" }).click();
  await page.getByLabel("筛选历史日期").fill("2026-06-12");
  await expect(page.getByRole("button", { name: /周报 · 2026-W24/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /月报 · 2026-07/ })).toHaveCount(0);

  await page.getByRole("button", { name: "重置" }).click();
  await page.getByLabel("筛选 AI 状态").selectOption("ai");
  await page.getByLabel("筛选导出状态").selectOption("exported");
  await expect(page.getByRole("button", { name: /周报 · 2026-W24/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /月报 · 2026-07/ })).toHaveCount(0);
});

function createCommit(hash: string, message: string, author = "Playwright Tester") {
  return {
    repoPath: "C:/workspace/gitpulse",
    projectName: "gitpulse",
    branchName: "main",
    hash,
    author,
    authorEmail: `${author.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    date: "2026-07-02 10:00:00 +0800",
    message,
  };
}

async function openAssistTab(page: Parameters<typeof expectWorkbench>[0], name: RegExp) {
  await page.getByRole("tab", { name }).click();
}

function cssRgbBrightness(value: string) {
  const channels = value.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) ?? [];
  expect(channels).toHaveLength(3);
  return (channels[0] + channels[1] + channels[2]) / 3;
}
