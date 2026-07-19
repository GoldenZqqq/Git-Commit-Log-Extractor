import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  createRepo,
  createRepoCache,
  createSettings,
  expectWorkbench,
  launchApp,
} from "./support/tauri";

const repo = createRepo("C:/workspace/gitpulse", "gitpulse", "main");

test("keeps the 320px workbench and dialogs inside the viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await launchResponsiveApp(page);
  await dismissBlankDayTip(page);
  await assertNoHorizontalOverflow(page, ["html", "body", ".app-root", ".workbench", ".hero-band", ".report-canvas"]);

  const actions = [
    page.getByRole("button", { name: "生成日报" }),
    page.getByRole("button", { name: "批量" }),
    page.getByRole("button", { name: "空白日补写" }),
  ];
  for (const action of actions) await expectHorizontallyInsideViewport(page, action);
  await expectNoOverlap(actions);

  const settingsTrigger = page.getByRole("button", { name: "打开设置" });
  await settingsTrigger.click();
  await assertDialogInsideViewport(page, page.getByRole("dialog", { name: "设置" }), "关闭设置");
  await page.getByRole("button", { name: "诊断" }).click();
  await page.getByRole("button", { name: "准备支持包" }).click();
  const supportDialog = page.getByRole("dialog", { name: "检查支持包内容" });
  await assertDialogInsideViewport(page, supportDialog, "关闭支持包预览");
  await assertNoHorizontalOverflow(page, [".support-bundle-dialog", ".support-bundle-entry-panel"]);
  await page.screenshot({ path: testInfo.outputPath("support-bundle-320.png"), fullPage: true });
  await page.getByRole("button", { name: "关闭支持包预览" }).click();
  await page.screenshot({ path: testInfo.outputPath("workbench-320.png"), fullPage: true });
  await page.getByRole("button", { name: "关闭设置" }).click();

  await page.getByRole("button", { name: "批量" }).click();
  await assertDialogInsideViewport(page, page.getByRole("dialog", { name: "批量生成报告" }), "关闭批量生成");
});

test("completes the main path in a 200-percent equivalent viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 640, height: 450 });
  await launchResponsiveApp(page, true);
  await dismissBlankDayTip(page);
  await page.getByRole("button", { name: "生成日报" }).click();
  await expect(page.getByText("验证高缩放主路径")).toBeVisible();
  await page.getByRole("button", { name: "复制", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("验证高缩放主路径");

  const settingsTrigger = page.getByRole("button", { name: "打开设置" });
  await settingsTrigger.scrollIntoViewIfNeeded();
  await settingsTrigger.click();
  const settings = page.getByRole("dialog", { name: "设置" });
  await assertDialogInsideViewport(page, settings, "关闭设置");
  await page.getByRole("button", { name: "关闭设置" }).click();
  await expect(settings).toBeHidden();

  await assertNoHorizontalOverflow(page, ["html", "body", ".app-root", ".report-canvas"]);
  await page.screenshot({ path: testInfo.outputPath("workbench-200-percent.png"), fullPage: true });
});

test("keeps long dialogs bounded in a short desktop window", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 480 });
  await launchResponsiveApp(page);
  await expect(page.getByRole("button", { name: "生成日报" })).toBeVisible();
  await expect(page.locator(".preview-shell")).toBeVisible();

  await page.getByRole("button", { name: "批量" }).click();
  const dialog = page.getByRole("dialog", { name: "批量生成报告" });
  await assertDialogInsideViewport(page, dialog, "关闭批量生成");
  await expect.poll(() => dialog.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.getByRole("button", { name: "关闭批量生成" }).click();
  await page.getByRole("button", { name: "打开设置" }).click();
  await page.getByRole("button", { name: "诊断" }).click();
  await page.getByRole("button", { name: "准备支持包" }).click();
  const supportDialog = page.getByRole("dialog", { name: "检查支持包内容" });
  await assertDialogInsideViewport(page, supportDialog, "关闭支持包预览");
  await expect.poll(() => supportDialog.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await assertNoHorizontalOverflow(page, [".support-bundle-dialog", ".support-bundle-entry-panel"]);
  await page.screenshot({ path: testInfo.outputPath("workbench-short-height.png") });
});

async function launchResponsiveApp(page: Page, withReport = false) {
  await launchApp(page, {
    settings: createSettings(),
    repoCache: createRepoCache(["C:/workspace"], [repo]),
    extractResults: withReport ? [{
      repos: [repo],
      summaryText: "# 今日工作报告\n\n- 验证高缩放主路径",
      commits: [{
        repoPath: repo.path,
        projectName: repo.name,
        branchName: repo.branch,
        hash: "responsive1",
        author: "Playwright Tester",
        authorEmail: "playwright@example.com",
        date: "2026-07-17 10:00:00 +0800",
        message: "test: 验证高缩放主路径",
      }],
    }] : [],
  });
  await expectWorkbench(page);
}

async function dismissBlankDayTip(page: Page) {
  const close = page.locator(".blank-day-tip-close");
  if (await close.isVisible()) await close.click();
}

async function assertNoHorizontalOverflow(page: Page, selectors: string[]) {
  const metrics = await page.evaluate((targets) => targets.map((selector) => {
    const element = document.querySelector<HTMLElement>(selector);
    return { selector, clientWidth: element?.clientWidth ?? 0, scrollWidth: element?.scrollWidth ?? 0 };
  }), selectors);
  for (const metric of metrics) {
    expect(metric.clientWidth, `${metric.selector} should exist`).toBeGreaterThan(0);
    expect(metric.scrollWidth, `${metric.selector} should not overflow`).toBeLessThanOrEqual(metric.clientWidth + 1);
  }
}

async function expectHorizontallyInsideViewport(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

async function expectNoOverlap(locators: Locator[]) {
  const boxes = await Promise.all(locators.map((locator) => locator.boundingBox()));
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      expect(rectanglesOverlap(boxes[left]!, boxes[right]!)).toBe(false);
    }
  }
}

function rectanglesOverlap(left: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>, right: NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

async function assertDialogInsideViewport(page: Page, dialog: Locator, closeName: string) {
  await expect(dialog).toBeVisible();
  const viewport = page.viewportSize();
  const dialogBox = await dialog.boundingBox();
  const closeBox = await dialog.getByRole("button", { name: closeName }).boundingBox();
  expect(viewport).not.toBeNull();
  expect(dialogBox).not.toBeNull();
  expect(closeBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(-1);
  expect(dialogBox!.y).toBeGreaterThanOrEqual(-1);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport!.height + 1);
  expect(closeBox!.y).toBeGreaterThanOrEqual(0);
  expect(closeBox!.y + closeBox!.height).toBeLessThanOrEqual(viewport!.height);
}
