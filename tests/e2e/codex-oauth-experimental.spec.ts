import { expect, test, type Page } from "@playwright/test";
import { createSettings, expectWorkbench, launchApp } from "./support/tauri";

test("marks Codex OAuth as experimental before selection and explains the boundary before login", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({ aiProvider: "openai-compatible", aiApiKeySaved: true }),
    secureApiKey: "sk-kept-in-secure-store",
    codexAuthStatus: { authenticated: true, email: "user@example.com" },
  });
  await openAiSettings(page);

  const provider = page.getByLabel("协议");
  await expect(provider).toHaveValue("openai-compatible");
  await expect(provider.getByRole("option", { name: "ChatGPT (Codex OAuth) · 实验" })).toHaveCount(1);
  await expect(page.getByText(/Codex OAuth 可能随协议变化失效/)).toBeVisible();

  await provider.selectOption("codex-oauth");
  const notice = page.getByRole("note", { name: "Codex OAuth 实验说明" });
  await expect(notice).toContainText("ChatGPT Plus/Pro");
  await expect(notice).toContainText("OpenAI ChatGPT/Codex 服务");
  await expect(notice).toContainText("协议变化可能导致此通道失效");
  await expect(page.getByText("ChatGPT 账号（实验）")).toBeVisible();
  await expect(page.getByText(/已登录 · user@example.com/)).toBeVisible();
  await expect(page.locator(".codex-auth-ok .experimental-badge")).toHaveText("实验");
});

test("switches from experimental OAuth to stable providers without clearing credentials", async ({ page }) => {
  await launchApp(page, {
    settings: createSettings({ aiProvider: "codex-oauth", aiApiKeySaved: true }),
    secureApiKey: "sk-kept-in-secure-store",
  });
  await openAiSettings(page);

  const notice = page.getByRole("note", { name: "Codex OAuth 实验说明" });
  await notice.getByRole("button", { name: "OpenAI Compatible" }).click();
  await expect(page.getByLabel("协议")).toHaveValue("openai-compatible");
  await expect(page.getByRole("textbox", { name: /API Key/ })).toHaveValue("sk-kept-in-secure-store");

  await page.getByLabel("协议").selectOption("codex-oauth");
  await page.getByRole("note", { name: "Codex OAuth 实验说明" })
    .getByRole("button", { name: "Anthropic Native" }).click();
  await expect(page.getByLabel("协议")).toHaveValue("anthropic-native");
  await expect(page.getByRole("textbox", { name: /API Key/ })).toHaveValue("sk-kept-in-secure-store");
  expect(await commandCount(page, "clear_secure_ai_api_key")).toBe(0);
  expect(await commandCount(page, "codex_oauth_logout")).toBe(0);
});

async function openAiSettings(page: Page) {
  await expectWorkbench(page);
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("button", { name: "AI 润色" }).click();
}

async function commandCount(page: Page, command: string) {
  return page.evaluate((cmd) => window.__mockTauri.calls.filter((call) => call.cmd === cmd).length, command);
}
