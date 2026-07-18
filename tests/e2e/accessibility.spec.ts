import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  createRepo,
  createRepoCache,
  createSettings,
  expectWorkbench,
  launchApp,
} from "./support/tauri";

const repo = createRepo("C:/workspace/gitpulse", "gitpulse", "main");

test("traps dialog focus, closes the top layer, and restores the trigger", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({
      projectNamesText: "gitpulse(*) -> GitPulse",
      aiEnabled: true,
      aiApiKeySaved: true,
      aiModel: "gpt-4.1-mini",
    }),
    secureApiKey: "sk-playwright",
    aiModels: [{ id: "gpt-4.1-mini" }, { id: "gpt-5-mini" }],
    repoCache: createRepoCache(["C:/workspace"], [repo]),
  });
  await expectWorkbench(page);
  await verifySettingsDialogKeyboard(page);
  await verifyCustomRangeDialogKeyboard(page);
});

test("supports keyboard navigation and focus return for split popovers", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({
      aiEnabled: true,
      aiApiKeySaved: true,
      aiModel: "gpt-4.1-mini",
    }),
    secureApiKey: "sk-playwright",
    repoCache: createRepoCache(["C:/workspace"], [repo]),
    extractResults: [{
      repos: [repo],
      summaryText: "# 今日工作报告\n\n- 加固弹层键盘操作",
      commits: [{
        repoPath: repo.path,
        projectName: repo.name,
        branchName: repo.branch,
        hash: "abc1234",
        author: "Playwright Tester",
        authorEmail: "playwright@example.com",
        date: "2026-07-16 10:00:00 +0800",
        message: "feat: 加固弹层键盘操作",
      }],
    }],
  });
  await expectWorkbench(page);
  await page.getByRole("button", { name: "生成日报" }).click();
  await expect(page.getByText("加固弹层键盘操作")).toBeVisible();
  await verifyPolishPopoverKeyboard(page);
  await verifyExportMenuKeyboard(page);
  await verifyCopyMenuKeyboard(page);
});

test("applies the shared focus contract to batch, blank-day, and mapping dialogs", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({
      aiEnabled: true,
      aiApiKeySaved: true,
      aiModel: "gpt-4.1-mini",
    }),
    secureApiKey: "sk-playwright",
    repoCache: createRepoCache(["C:/workspace"], [repo]),
    extractResults: [
      { repos: [repo], summaryText: "", commits: [] },
      { repos: [repo], summaryText: "", commits: [] },
    ],
  });
  await expectWorkbench(page);

  const batchTrigger = page.getByRole("button", { name: "批量" });
  await batchTrigger.click();
  const batchDialog = page.getByRole("dialog", { name: "批量生成报告" });
  await expect(batchDialog.getByLabel("开始日期")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(batchDialog).toBeHidden();
  await expect(batchTrigger).toBeFocused();

  const blankDayTrigger = page.getByRole("button", { name: "空白日补写" });
  await blankDayTrigger.click();
  const blankDayDialog = page.getByRole("dialog", { name: "空白日补写" });
  await expect(blankDayDialog.getByLabel("目标日")).toBeFocused();
  await assertNoSeriousAxeViolations(page, ".blank-day-dialog");
  await page.keyboard.press("Escape");
  await expect(blankDayDialog).toBeHidden();
  await expect(blankDayTrigger).toBeFocused();

  const mappingTrigger = page.getByTitle("点击编辑项目映射名称");
  await mappingTrigger.click();
  const mappingDialog = page.getByRole("dialog", { name: "编辑项目映射" });
  await expect(mappingDialog.getByLabel("映射名称")).toBeFocused();
  await assertNoSeriousAxeViolations(page, ".range-dialog");
  await page.keyboard.press("Escape");
  await expect(mappingDialog).toBeHidden();
  await expect(mappingTrigger).toBeFocused();
});

async function verifySettingsDialogKeyboard(page: Page) {
  const trigger = page.getByRole("button", { name: "打开设置" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "设置" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭设置" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expectFocusInside(page, ".settings-dialog");
  await assertNoSeriousAxeViolations(page, ".settings-dialog");
  await verifyModelListKeyboard(page);
  await verifyNestedConfirmKeyboard(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
}

async function verifyModelListKeyboard(page: Page) {
  const dialog = page.getByRole("dialog", { name: "设置" });
  await dialog.getByRole("button", { name: "AI 润色" }).click();
  await dialog.getByRole("button", { name: "获取模型" }).click();
  const list = dialog.getByRole("listbox", { name: "可用模型" });
  await page.keyboard.press("ArrowDown");
  await expect(list.getByRole("option", { name: "gpt-4.1-mini" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(list.getByRole("option", { name: "gpt-5-mini" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(dialog.locator("input[role='combobox']")).toBeFocused();
}

async function verifyNestedConfirmKeyboard(page: Page) {
  const settings = page.getByRole("dialog", { name: "设置" });
  await settings.getByRole("button", { name: "项目映射" }).click();
  const trigger = settings.getByRole("button", { name: "删除映射" });
  await trigger.click();
  const confirm = page.getByRole("alertdialog", { name: "删除这条映射？" });
  await expect(confirm.getByRole("button", { name: "取消", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(settings).toBeVisible();
  await expect(trigger).toBeFocused();
}

async function verifyCustomRangeDialogKeyboard(page: Page) {
  await page.getByRole("button", { name: "自定义" }).click();
  const trigger = page.locator(".period-range-button");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "自定义报告周期" });
  await expect(dialog.getByLabel("开始日期")).toBeFocused();
  await assertNoSeriousAxeViolations(page, ".range-dialog");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
}

async function verifyPolishPopoverKeyboard(page: Page) {
  const trigger = page.getByRole("button", { name: "带本次额外要求润色" });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "本次额外要求" }).getByRole("textbox")).toBeFocused();
  await assertNoSeriousAxeViolations(page, "#polish-extra-popover");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
}

async function verifyExportMenuKeyboard(page: Page) {
  const trigger = page.getByRole("button", { name: "选择导出格式" });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "导出格式" });
  await expect(menu.getByRole("menuitem", { name: /Markdown/ })).toBeFocused();
  await assertNoSeriousAxeViolations(page, "#report-export-menu");
  await page.keyboard.press("End");
  await expect(menu.getByRole("menuitem", { name: /PDF/ })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: /Markdown/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
}

async function verifyCopyMenuKeyboard(page: Page) {
  const trigger = page.getByRole("button", { name: "复制为其他格式" });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "复制格式" });
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await assertNoSeriousAxeViolations(page, "#report-copy-menu");
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem").nth(1)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
}

async function expectFocusInside(page: Page, selector: string) {
  await expect.poll(() => page.evaluate((target) => {
    const container = document.querySelector(target);
    return container?.contains(document.activeElement) ?? false;
  }, selector)).toBe(true);
}

async function assertNoSeriousAxeViolations(page: Page, include?: string) {
  const builder = new AxeBuilder({ page });
  if (include) builder.include(include);
  const results = await builder.analyze();
  const violations = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.flatMap((node) => node.target),
      summaries: violation.nodes.map((node) => node.failureSummary),
    }));
  expect(violations).toEqual([]);
}
