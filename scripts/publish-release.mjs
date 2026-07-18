#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import {
  loadReleaseEnv,
  readReleaseConfig,
} from "./release-config.mjs";
import {
  createReleasePlan,
  resolveReleaseVersion,
} from "./release-plan.mjs";
import {
  getRootDir,
  readCurrentVersion,
  syncVersion,
} from "./version-utils.mjs";
import {
  buildLatestReleaseAssetDownloadUrl,
  buildReleaseBody,
  buildReleaseAssetDownloadUrl,
  commitReleaseVersion,
  findLocalTagAtHead,
  pushReleaseBranch,
  readGitHubReleaseConfig,
  stageAndPublishGitHubRelease,
} from "./github-release.mjs";
import {
  assertReleaseTagAbsent,
  validateReleaseSource,
  validateReleaseTag,
  waitForSuccessfulCiRun,
} from "./release-governance.mjs";

const rootDir = getRootDir(import.meta.url);
try {
  await main();
} catch (error) {
  console.error(`发布失败：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

async function main() {
  const releasePlan = createReleasePlan(process.argv.slice(2));
  const currentVersion = readCurrentVersion(rootDir);
  const releaseVersion = resolveReleaseVersion(currentVersion, releasePlan);
  validateReleaseSource(rootDir);

  printReleasePlan({ currentVersion, releasePlan, releaseVersion });

  if (releasePlan.dryRun) {
    previewReleaseVersion(releasePlan, releaseVersion);
    return;
  }

  const context = loadReleaseContext(releaseVersion);
  const releaseSource = await prepareVerifiedReleaseCommit({
    githubConfig: context.githubConfig,
    releasePlan,
    releaseVersion,
  });
  const artifacts = buildReleaseArtifacts(context, releaseVersion);
  const githubReleaseUrl = await publishReleaseArtifacts({
    ...artifacts,
    ...context,
    releaseVersion,
    ...releaseSource,
  });
  validateReleaseTag(rootDir, `v${releaseVersion}`);
  await verifyManifest(artifacts.manifestUrl, releaseVersion);
  printReleaseResult({ ...artifacts, githubReleaseUrl, releaseVersion });
}

function loadReleaseContext(releaseVersion) {
  const releaseEnv = loadReleaseEnv(path.join(rootDir, ".release.env.local"));
  const githubConfig = readGitHubReleaseConfig(rootDir, releaseEnv);
  const config = readReleaseConfig(rootDir, releaseEnv);
  const { notes, sourceLabel } = resolveReleaseNotes(releaseEnv, releaseVersion);
  const manifestPath = path.join(rootDir, "src-tauri", "target", "release", "bundle", "gitpulse-latest.json");
  const privateKey = fs.readFileSync(config.privateKeyPath, "utf8");
  console.log(`Release Notes 来源：${sourceLabel}`);
  return { config, githubConfig, manifestPath, notes, privateKey };
}

async function prepareVerifiedReleaseCommit({ githubConfig, releasePlan, releaseVersion }) {
  const tagName = `v${releaseVersion}`;
  if (releasePlan.kind === "current") {
    if (findLocalTagAtHead(rootDir, tagName)) {
      throw new Error(`版本 ${releaseVersion} 已发布；为保护既有资产，current 模式不会覆盖 Release`);
    }
    console.log(`标签 ${tagName} 尚不存在，将恢复并完成当前版本发布`);
  } else {
    assertReleaseTagAbsent(rootDir, tagName);
    for (const update of syncVersion(rootDir, releaseVersion)) console.log(update);
    if (!commitReleaseVersion(rootDir, releaseVersion)) {
      throw new Error("版本文件没有变化；如需重传同版本，请显式使用 release:win:current");
    }
    pushReleaseBranch(rootDir);
  }

  const { headSha } = validateReleaseSource(rootDir);
  const run = await waitForSuccessfulCiRun({ githubConfig, sha: headSha });
  console.log(`主线 CI 已通过：${run.html_url || run.id}`);
  return { targetCommitish: validateReleaseSource(rootDir).headSha };
}

function buildReleaseArtifacts(context, releaseVersion) {
  runReleaseBuild({
    ...process.env,
    TAURI_SIGNING_PRIVATE_KEY: context.privateKey,
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: context.config.privateKeyPassword,
  });

  const bundleDir = path.join(rootDir, "src-tauri", "target", "release", "bundle", "nsis");
  const installerArtifact = pickArtifact(
    bundleDir,
    (fileName) => fileName.endsWith(".exe") && !fileName.endsWith(".exe.sig"),
  );
  const updaterSignaturePath = `${installerArtifact}.sig`;
  const tagName = `v${releaseVersion}`;
  const installerUrl = buildReleaseAssetDownloadUrl(
    context.githubConfig,
    tagName,
    path.basename(installerArtifact),
  );
  const manifestUrl = buildLatestReleaseAssetDownloadUrl(
    context.githubConfig,
    path.basename(context.manifestPath),
  );
  const signature = fs.readFileSync(updaterSignaturePath, "utf8").trim();
  writeManifest({
    installerUrl,
    manifestPath: context.manifestPath,
    notes: context.notes,
    releaseVersion,
    signature,
  });
  return {
    filePaths: [installerArtifact, updaterSignaturePath, context.manifestPath],
    installerUrl,
    manifestUrl,
  };
}

function writeManifest({ installerUrl, manifestPath, notes, releaseVersion, signature }) {
  const manifest = {
    version: releaseVersion,
    notes,
    pub_date: new Date().toISOString(),
    platforms: {
      "windows-x86_64": {
        signature,
        url: installerUrl,
      },
    },
    extras: {
      installer: installerUrl,
    },
  };

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function publishReleaseArtifacts({
  filePaths,
  githubConfig,
  installerUrl,
  manifestUrl,
  notes,
  releaseVersion,
  targetCommitish,
}) {
  const tagName = `v${releaseVersion}`;
  const releasePayload = {
    body: buildReleaseBody(notes, installerUrl, manifestUrl),
    name: `GitPulse ${tagName}`,
    tagName,
    targetCommitish,
  };
  const release = await stageAndPublishGitHubRelease({
    filePaths,
    githubConfig,
    releasePayload,
  });
  return release.html_url;
}

function printReleasePlan({ currentVersion, releasePlan, releaseVersion }) {
  console.log("GitPulse 自动发布流程");
  console.log(`当前版本：${currentVersion}`);
  console.log(`发布模式：${releasePlan.label}`);
  console.log(`${releasePlan.dryRun ? "计划发布" : "发布版本"}：${releaseVersion}`);
}

function previewReleaseVersion(releasePlan, releaseVersion) {
  if (releasePlan.kind !== "current") {
    for (const update of syncVersion(rootDir, releaseVersion, { dryRun: true })) console.log(update);
  }
  console.log("dry-run 完成：main 已与 origin/main 同步；未写文件、未构建、未上传。");
}

function printReleaseResult({ githubReleaseUrl, installerUrl, manifestUrl, releaseVersion }) {
  console.log(`GitPulse ${releaseVersion} 发布完成`);
  console.log(`Updater: ${installerUrl}`);
  console.log(`Installer: ${installerUrl}`);
  console.log(`Manifest: ${manifestUrl}`);
  console.log(`GitHub Release: ${githubReleaseUrl}`);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`命令执行失败：${command} ${args.join(" ")}`);
  }
}

function runReleaseBuild(env) {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) {
    throw new Error("无法定位当前 npm CLI，请通过 npm run release:win 执行发布");
  }

  runCommand(process.execPath, [npmExecPath, "run", "tauri:build:release"], { env });
}

function pickArtifact(directory, matcher) {
  const fileNames = fs
    .readdirSync(directory)
    .filter(matcher)
    .map((fileName) => path.join(directory, fileName))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);

  if (fileNames.length === 0) {
    throw new Error(`未在 ${directory} 找到预期产物`);
  }

  return fileNames[0];
}

async function verifyManifest(manifestUrl, version) {
  // 资产刚上传后，latest/download 重定向与 CDN 传播存在数秒延迟，叠加代理瞬断
  // 会让一次性 fetch 误判失败（发布主体其实已完成）。这里做有限次退避重试。
  const maxAttempts = 5;
  const retryDelayMs = 4000;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(manifestUrl, { headers: { "Cache-Control": "no-cache" } });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (payload.version !== version) {
        throw new Error(`版本不匹配：期望 ${version}，实际 ${payload.version}`);
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const reason = error instanceof Error ? error.message : String(error);
        console.log(`校验 latest.json 第 ${attempt}/${maxAttempts} 次未通过（${reason}），${retryDelayMs / 1000}s 后重试...`);
        await delay(retryDelayMs);
      }
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`验证 latest.json 失败（已重试 ${maxAttempts} 次）：${reason}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveReleaseNotes(env, releaseVersion) {
  const notesFile = env.GITPULSE_RELEASE_NOTES_FILE
    ? resolveReleaseNotesPath(env.GITPULSE_RELEASE_NOTES_FILE)
    : path.join(rootDir, "release-notes", `v${releaseVersion}.md`);
  if (fs.existsSync(notesFile)) {
    const content = fs.readFileSync(notesFile, "utf8").trim();
    if (content) {
      return { notes: content, sourceLabel: path.relative(rootDir, notesFile) };
    }
  }

  if (env.GITPULSE_RELEASE_NOTES?.trim()) {
    return { notes: env.GITPULSE_RELEASE_NOTES.trim(), sourceLabel: "GITPULSE_RELEASE_NOTES" };
  }

  return { notes: `GitPulse ${releaseVersion} 发布`, sourceLabel: "默认模板" };
}

function resolveReleaseNotesPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
}
