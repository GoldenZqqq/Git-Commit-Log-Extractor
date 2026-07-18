#!/usr/bin/env node

import process from "node:process";
import { spawnSync } from "node:child_process";

const npmExecPath = process.env.npm_execpath;
if (!npmExecPath) {
  console.error("build:tauri:smoke must be run through npm");
  process.exit(1);
}

const result = spawnSync(process.execPath, [
  npmExecPath,
  "run",
  "tauri",
  "--",
  "build",
  "--debug",
  "--no-bundle",
  "--ci",
], {
  env: { ...process.env, VITE_TAURI_SMOKE: "1" },
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
