#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const includePackageBuild = args.includes("--package");
const showHelp = args.includes("--help") || args.includes("-h");

if (showHelp) {
  console.log(`GitPulse release verification

Usage:
  npm run verify:release
  npm run verify:release -- --package

Default checks:
  - release governance unit tests
  - frontend smoke guard
  - browser-level Playwright e2e
  - TypeScript and Vite production build
  - Rust cargo check
  - Rust cargo test
  - Rust workspace benchmark tests
  - Git whitespace diff check
  - release plan dry-run

Options:
  --package  Also run npm run tauri:build:release. This requires release signing env.
`);
  process.exit(0);
}

const steps = [
  ["发布治理单元测试", "npm", ["run", "test:release-governance"], rootDir],
  ["前端 smoke", "node", ["scripts/frontend-smoke.mjs"], rootDir],
  ["浏览器 e2e", "npm", ["run", "test:e2e"], rootDir],
  ["前端生产构建", "npm", ["run", "build"], rootDir],
  ["Rust cargo check", "cargo", ["check"], join(rootDir, "src-tauri")],
  ["Rust cargo test", "cargo", ["test"], join(rootDir, "src-tauri")],
  [
    "Rust workspace benchmark tests",
    "cargo",
    [
      "test",
      "--features",
      "workspace-benchmark",
      "--bin",
      "gitpulse-workspace-benchmark",
    ],
    join(rootDir, "src-tauri"),
  ],
  ["Git diff 空白检查", "git", ["diff", "--check"], rootDir],
  ["发布计划 dry-run", "npm", ["run", "release:win", "--", "--dry-run"], rootDir],
];

if (includePackageBuild) {
  steps.push(["Windows release 打包", "npm", ["run", "tauri:build:release"], rootDir]);
}

try {
  console.log("GitPulse release verification");
  console.log(`工作目录：${rootDir}`);
  console.log(`安装包构建：${includePackageBuild ? "启用" : "跳过（使用 --package 启用）"}`);

  for (const [label, command, commandArgs, cwd] of steps) {
    runStep(label, command, commandArgs, cwd);
  }

  console.log("\nRelease verification passed.");
} catch (error) {
  console.error(`\nRelease verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

function runStep(label, command, commandArgs, cwd) {
  console.log(`\n==> ${label}`);
  console.log(`$ ${command} ${commandArgs.join(" ")}`);
  const startedAt = Date.now();
  const executable = resolveCommand(command);
  const args = resolveCommandArgs(command, commandArgs);
  const result = spawnSync(executable, args, {
    cwd,
    stdio: "inherit",
    shell: false,
  });
  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  if (result.error) {
    throw new Error(`${label} 启动失败：${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${label} 失败，退出码 ${result.status}`);
  }
  console.log(`✓ ${label} passed in ${durationSeconds}s`);
}

function resolveCommand(command) {
  if (process.platform === "win32" && command === "npm") return process.execPath;
  return command;
}

function resolveCommandArgs(command, commandArgs) {
  if (process.platform === "win32" && command === "npm") {
    const npmExecPath = process.env.npm_execpath;
    if (!npmExecPath) {
      throw new Error("无法定位当前 npm CLI，请通过 npm run verify:release 执行校验");
    }
    return [npmExecPath, ...commandArgs];
  }
  return commandArgs;
}
