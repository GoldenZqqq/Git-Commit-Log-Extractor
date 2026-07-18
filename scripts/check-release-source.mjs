#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  assertSuccessfulCiRun,
  validateReleaseTag,
} from "./release-governance.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

try {
  const tagName = readTagName(process.argv.slice(2));
  const { tagSha } = validateReleaseTag(rootDir, tagName);
  const run = await assertSuccessfulCiRun({
    githubConfig: readActionsConfig(),
    sha: tagSha,
  });
  console.log(`发布源校验通过：${tagName} -> ${tagSha}`);
  console.log(`主线 CI：${run.html_url || run.id}`);
} catch (error) {
  console.error(`发布源校验失败：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

function readTagName(args) {
  const tagIndex = args.indexOf("--tag");
  const tagName = tagIndex >= 0 ? args[tagIndex + 1] : "";
  if (!tagName) throw new Error("请通过 --tag vX.Y.Z 提供发布标签");
  return tagName;
}

function readActionsConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    throw new Error("缺少 GITHUB_TOKEN 或 GITHUB_REPOSITORY，无法核对主线 CI");
  }
  return {
    apiBaseUrl: (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/+$/, ""),
    repo,
    token,
  };
}
