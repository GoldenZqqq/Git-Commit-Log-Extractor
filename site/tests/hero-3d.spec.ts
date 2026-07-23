import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";


const CHINESE_ROUTE = "/GitPulse/zh-CN/";

async function openHero(page: Page, route = CHINESE_ROUTE): Promise<Locator> {
  await page.goto(route, { waitUntil: "networkidle" });
  const scene = page.locator("[data-hero-scene]");
  await expect(scene).toHaveAttribute("data-scene-state", "ready", { timeout: 20_000 });
  return scene;
}

async function expectNonblankCanvas(canvas: Locator): Promise<void> {
  const screenshot = await canvas.screenshot({ animations: "disabled" });
  const stats = await sharp(screenshot).stats();
  const maxDeviation = Math.max(...stats.channels.slice(0, 3).map((channel) => channel.stdev));
  expect(stats.entropy).toBeGreaterThan(0.35);
  expect(maxDeviation).toBeGreaterThan(8);
}

test("renders a framed nonblank Pulse Core Hero", async ({ page }) => {
  const scene = await openHero(page);
  const canvas = scene.locator("[data-hero-canvas]");
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "GitPulse" })).toBeVisible();
  await expect(page.getByRole("link", { name: "下载最新版本" })).toBeVisible();

  const layout = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>("[data-hero]");
    const workflow = document.querySelector<HTMLElement>("#workflow");
    return {
      heroBottom: hero?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
      workflowTop: workflow?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.heroBottom).toBeLessThan(layout.viewportHeight);
  expect(layout.workflowTop).toBeLessThan(layout.viewportHeight);
  await expectNonblankCanvas(canvas);
  await canvas.click({ position: { x: Math.round((await canvas.boundingBox())!.width * 0.78), y: 140 }, force: true });
  await expect(scene).toHaveAttribute("data-interaction-state", "pulse");
  await expect(scene).toHaveAttribute("data-scene-state", "ready");
});

test("supports bounded drag and desktop node hover", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The desktop composition exposes pointer-driven node interactions.");

  const scene = await openHero(page);
  const canvas = scene.locator("[data-hero-canvas]");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const foundNode = await findHoveredNode(page, canvas, box);
  expect(foundNode).toBe(true);

  await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.3);
  await page.mouse.down();
  await expect(scene).toHaveAttribute("data-interaction-state", "dragging");
  await page.mouse.move(box.x + box.width * 0.86, box.y + box.height * 0.26, { steps: 4 });
  await page.mouse.up();
  await expect(scene).not.toHaveAttribute("data-interaction-state", "dragging");
});

async function findHoveredNode(page: Page, canvas: Locator, box: { x: number; y: number; width: number; height: number }): Promise<boolean> {
  const nodeProbePoints = [
    { x: 0.67, y: 0.24 },
    { x: 0.6, y: 0.52 },
    { x: 0.69, y: 0.6 },
  ];

  for (const point of nodeProbePoints) {
    await page.mouse.move(box.x + box.width * point.x, box.y + box.height * point.y);
    if (await canvas.evaluate((element) => element.classList.contains("is-node-hovered"))) return true;
  }
  return false;
}

test("keeps the English route and download action intact", async ({ page }) => {
  await openHero(page, "/GitPulse/en/");
  await expect(page.getByRole("heading", { level: 1, name: "GitPulse" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download latest" })).toBeVisible();
});

test("uses the static poster when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(CHINESE_ROUTE, { waitUntil: "networkidle" });
  const scene = page.locator("[data-hero-scene]");
  await expect(scene).toHaveAttribute("data-scene-state", "fallback");
  await expect(scene.locator(".hero-poster")).toBeVisible();
  await expect(scene.locator("[data-hero-canvas]")).toBeHidden();
  await expect(page.getByRole("link", { name: "下载最新版本" })).toBeVisible();
});

test("falls back without hiding content when the GLB fails", async ({ page }) => {
  await page.route("**/gitpulse-pulse-core.glb", (route) => route.abort("failed"));
  await page.goto(CHINESE_ROUTE, { waitUntil: "networkidle" });
  const scene = page.locator("[data-hero-scene]");
  await expect(scene).toHaveAttribute("data-scene-state", "fallback", { timeout: 20_000 });
  await expect(scene.locator(".hero-poster")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "GitPulse" })).toBeVisible();
  await expect(page.getByRole("link", { name: "下载最新版本" })).toBeVisible();
});
