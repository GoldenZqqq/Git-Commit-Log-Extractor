import { expect, test, type Page } from "@playwright/test";
import { createSettings, expectWorkbench, launchApp } from "./support/tauri";

test("fills OrcaRouter preset under OpenAI Compatible and preserves the saved API key", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({
      aiProvider: "openai-compatible",
      aiBaseUrl: "https://api.openai.com/v1",
      aiModel: "",
      aiApiKeySaved: true,
    }),
    secureApiKey: "sk-kept-in-secure-store",
  });
  await openAiSettings(page);

  const preset = page.locator(".provider-preset");
  await expect(preset).toBeVisible();
  await expect(preset).toContainText("OrcaRouter");
  await expect(preset.getByRole("link", { name: /注册 \/ 获取 API Key/ })).toHaveAttribute(
    "href",
    "https://www.orcarouter.ai/ref/ref_42af1ff924f526df920d",
  );
  await expect(preset.getByRole("link", { name: /查看开源支持计划/ })).toHaveAttribute(
    "href",
    "https://www.orcarouter.ai/zh-CN/built-with",
  );

  await preset.getByRole("button", { name: "填入 OrcaRouter 预设" }).click();

  await expect(page.getByRole("textbox", { name: /Base URL/ })).toHaveValue("https://api.orcarouter.ai/v1");
  await expect(page.locator(".model-combobox input")).toHaveValue("orcarouter/auto");
  await expect(page.getByRole("textbox", { name: /API Key/ })).toHaveValue("sk-kept-in-secure-store");
});

test("offers the preset after switching from Anthropic Native to OpenAI Compatible", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({
      aiProvider: "anthropic-native",
      aiBaseUrl: "https://api.anthropic.com/v1",
      aiModel: "claude-sonnet-4-5",
      aiApiKeySaved: true,
    }),
    secureApiKey: "sk-kept-in-secure-store",
  });
  await openAiSettings(page);

  await expect(page.locator(".provider-preset")).toHaveCount(0);

  await page.getByLabel("协议").selectOption("openai-compatible");
  const preset = page.locator(".provider-preset");
  await expect(preset).toBeVisible();

  await preset.getByRole("button", { name: "填入 OrcaRouter 预设" }).click();
  await expect(page.getByRole("textbox", { name: /Base URL/ })).toHaveValue("https://api.orcarouter.ai/v1");
  await expect(page.locator(".model-combobox input")).toHaveValue("orcarouter/auto");
  await expect(page.getByRole("textbox", { name: /API Key/ })).toHaveValue("sk-kept-in-secure-store");
  await expect(page.getByLabel("协议")).toHaveValue("openai-compatible");
});

async function openAiSettings(page: Page) {
  await expectWorkbench(page);
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("button", { name: "AI 润色" }).click();
}
