import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(siteRoot, "..");
const assetsDir = resolve(siteRoot, "public", "assets");

const assets = [
  ["public/brand-light.png", "brand-light.png"],
  ["public/brand-dark.png", "brand-dark.png"],
  ["public/favicon.png", "favicon.png"],
  ["docs/gitpulse-demo.gif", "gitpulse-demo.gif"],
  ["docs/gitpulse-demo.mp4", "gitpulse-demo.mp4"],
  ["site/assets-src/3d/gitpulse-pulse-core.glb", "gitpulse-pulse-core.glb"],
  ["site/assets-src/3d/gitpulse-pulse-core.webp", "gitpulse-pulse-core.webp"],
];

mkdirSync(assetsDir, { recursive: true });

for (const [from, to] of assets) {
  const source = resolve(repoRoot, from);
  const target = resolve(assetsDir, to);

  if (!existsSync(source) || !statSync(source).isFile()) {
    throw new Error(`Missing site asset: ${from}`);
  }

  copyFileSync(source, target);
}

console.log(`Synced ${assets.length} GitPulse site assets.`);
