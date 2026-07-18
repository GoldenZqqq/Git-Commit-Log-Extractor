import fs from "node:fs";
import path from "node:path";
import {
  captureGit,
  runGit,
  tryCaptureGit,
} from "./git-cli.mjs";

const VERSION_FILES = [
  "package.json",
  "package-lock.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
];

const DEFAULT_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "GitPulse-Release-Script",
};

export function readGitHubReleaseConfig(rootDir, env) {
  const token = env.GITPULSE_GITHUB_TOKEN || env.GITHUB_TOKEN || env.GH_TOKEN;
  if (!token) {
    throw new Error("缺少 GitHub Release 发布配置：GITPULSE_GITHUB_TOKEN（或 GITHUB_TOKEN / GH_TOKEN）");
  }

  return {
    apiBaseUrl: stripTrailingSlash(env.GITPULSE_GITHUB_API_BASE_URL || "https://api.github.com"),
    repo: env.GITPULSE_GITHUB_REPO || resolveGitHubRepo(rootDir),
    token,
    webBaseUrl: stripTrailingSlash(env.GITPULSE_GITHUB_WEB_BASE_URL || "https://github.com"),
  };
}

export function buildLatestReleaseAssetDownloadUrl(config, assetName) {
  return `${config.webBaseUrl}/${encodeRepoPath(config.repo)}/releases/latest/download/${encodeURIComponent(assetName)}`;
}

export function buildReleaseAssetDownloadUrl(config, tagName, assetName) {
  return `${config.webBaseUrl}/${encodeRepoPath(config.repo)}/releases/download/${encodeURIComponent(tagName)}/${encodeURIComponent(assetName)}`;
}

export async function stageAndPublishGitHubRelease({
  filePaths,
  fetchImpl = fetch,
  githubConfig,
  releasePayload,
}) {
  const existing = await getReleaseByTag(
    githubConfig,
    releasePayload.tagName,
    fetchImpl,
  );
  if (existing) {
    throw new Error(`Release ${releasePayload.tagName} 已存在；新版本发布不会覆盖既有 Release`);
  }
  const existingTag = await getTagRef(githubConfig, releasePayload.tagName, fetchImpl);
  if (existingTag) {
    throw new Error(`标签 ${releasePayload.tagName} 已存在；新版本发布不会移动或复用既有标签`);
  }

  let draft;
  try {
    draft = await createDraftRelease(githubConfig, releasePayload, fetchImpl);
    await syncReleaseAssets(githubConfig, draft, filePaths, fetchImpl);
    return await publishDraftRelease(githubConfig, draft.id, releasePayload, fetchImpl);
  } catch (error) {
    await cleanupReleaseTransaction(githubConfig, draft, releasePayload, fetchImpl);
    throw error;
  }
}

export function commitReleaseVersion(rootDir, releaseVersion) {
  const filesToStage = VERSION_FILES
    .map((filePath) => path.join(rootDir, filePath))
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => path.relative(rootDir, filePath));

  runGit(rootDir, ["add", "--", ...filesToStage]);
  const staged = captureGit(rootDir, ["diff", "--cached", "--name-only"]);
  if (!staged) return false;

  runGit(rootDir, ["commit", "-m", `chore: 发布 v${releaseVersion}`]);
  return true;
}

export function pushReleaseBranch(rootDir, branch = "main") {
  runGit(rootDir, ["push", "origin", branch]);
}

export function findLocalTagAtHead(rootDir, tagName) {
  const headSha = captureGit(rootDir, ["rev-parse", "HEAD"]);
  const tagSha = tryCaptureGit(rootDir, ["rev-list", "-n", "1", tagName]);
  if (!tagSha) return null;
  if (tagSha !== headSha) {
    throw new Error(`标签 ${tagName} 未指向当前主线提交，current 模式拒绝继续`);
  }
  return tagSha;
}

function resolveGitHubRepo(rootDir) {
  const remoteUrl = captureGit(rootDir, ["remote", "get-url", "origin"]);
  const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/i);
  if (!match) {
    throw new Error("无法从 origin 推断 GitHub 仓库，请设置 GITPULSE_GITHUB_REPO=owner/repo");
  }

  return match[1];
}

export function buildReleaseBody(notes, installerUrl, manifestUrl) {
  return [
    notes,
    "",
    "## 发布资源",
    `- 安装包直链：${installerUrl}`,
    `- 更新清单：${manifestUrl}`,
  ].join("\n");
}

async function createDraftRelease(config, releasePayload, fetchImpl) {
  return githubJson(config, `/repos/${config.repo}/releases`, {
    body: {
      body: releasePayload.body,
      draft: true,
      make_latest: "false",
      name: releasePayload.name,
      prerelease: false,
      tag_name: releasePayload.tagName,
      target_commitish: releasePayload.targetCommitish,
    },
    method: "POST",
  }, fetchImpl);
}

async function publishDraftRelease(config, releaseId, releasePayload, fetchImpl) {
  return githubJson(config, `/repos/${config.repo}/releases/${releaseId}`, {
    body: {
      body: releasePayload.body,
      draft: false,
      make_latest: "true",
      name: releasePayload.name,
      prerelease: false,
      target_commitish: releasePayload.targetCommitish,
    },
    method: "PATCH",
  }, fetchImpl);
}

async function cleanupDraftRelease(config, releaseId, fetchImpl) {
  try {
    const release = await githubJson(
      config,
      `/repos/${config.repo}/releases/${releaseId}`,
      { method: "GET" },
      fetchImpl,
    );
    if (!release?.draft) return;
    await githubJson(
      config,
      `/repos/${config.repo}/releases/${releaseId}`,
      { method: "DELETE" },
      fetchImpl,
    );
  } catch (cleanupError) {
    const reason = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
    console.error(`清理 draft Release ${releaseId} 失败：${reason}`);
  }
}

async function cleanupReleaseTransaction(config, draft, releasePayload, fetchImpl) {
  let draftToClean = draft;
  if (!draftToClean) {
    try {
      draftToClean = await findDraftReleaseByTag(config, releasePayload.tagName, fetchImpl);
    } catch (cleanupError) {
      const reason = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      console.error(`查找事务 draft ${releasePayload.tagName} 失败：${reason}`);
    }
  }
  if (draftToClean) await cleanupDraftRelease(config, draftToClean.id, fetchImpl);
  await cleanupTransactionTag(config, releasePayload, fetchImpl);
}

async function findDraftReleaseByTag(config, tagName, fetchImpl) {
  const releases = await githubJson(
    config,
    `/repos/${config.repo}/releases?per_page=100`,
    { method: "GET" },
    fetchImpl,
  );
  return releases.find((release) => release.draft && release.tag_name === tagName);
}

async function cleanupTransactionTag(config, releasePayload, fetchImpl) {
  try {
    const published = await getReleaseByTag(config, releasePayload.tagName, fetchImpl);
    if (published && !published.draft) return;
    const tagRef = await getTagRef(config, releasePayload.tagName, fetchImpl);
    if (!tagRef || tagRef.object?.sha !== releasePayload.targetCommitish) return;
    await githubJson(
      config,
      `/repos/${config.repo}/git/refs/tags/${encodeURIComponent(releasePayload.tagName)}`,
      { method: "DELETE" },
      fetchImpl,
    );
  } catch (cleanupError) {
    const reason = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
    console.error(`清理事务标签 ${releasePayload.tagName} 失败：${reason}`);
  }
}

async function getTagRef(config, tagName, fetchImpl = fetch) {
  const response = await githubFetch(
    config,
    `/repos/${config.repo}/git/ref/tags/${encodeURIComponent(tagName)}`,
    {},
    fetchImpl,
  );
  if (response.status === 404) return null;
  return parseGitHubResponse(response);
}

async function getReleaseByTag(config, tagName, fetchImpl = fetch) {
  const response = await githubFetch(
    config,
    `/repos/${config.repo}/releases/tags/${encodeURIComponent(tagName)}`,
    {},
    fetchImpl,
  );
  if (response.status === 404) return null;
  return parseGitHubResponse(response);
}

async function syncReleaseAssets(config, release, filePaths, fetchImpl = fetch) {
  const assetsByName = new Map((release.assets || []).map((asset) => [asset.name, asset]));
  const uploadedAssets = [];

  for (const filePath of filePaths) {
    const assetName = path.basename(filePath);
    const existingAsset = assetsByName.get(assetName);
    if (existingAsset) {
      await githubJson(config, `/repos/${config.repo}/releases/assets/${existingAsset.id}`, {
        method: "DELETE",
      }, fetchImpl);
    }

    uploadedAssets.push(await uploadReleaseAsset(config, release.upload_url, filePath, fetchImpl));
  }

  return uploadedAssets;
}

async function uploadReleaseAsset(config, uploadUrl, filePath, fetchImpl = fetch) {
  const fileName = path.basename(filePath);
  const baseUploadUrl = uploadUrl.replace(/\{.*$/, "");
  const targetUrl = new URL(baseUploadUrl);
  targetUrl.searchParams.set("name", fileName);

  const response = await fetchImpl(targetUrl, {
    body: fs.readFileSync(filePath),
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${config.token}`,
      "Content-Type": detectContentType(filePath),
    },
    method: "POST",
  });

  return parseGitHubResponse(response);
}

async function githubJson(config, pathName, { body, method }, fetchImpl = fetch) {
  const response = await githubFetch(config, pathName, {
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    method,
  }, fetchImpl);
  return parseGitHubResponse(response);
}

async function githubFetch(config, pathName, options = {}, fetchImpl = fetch) {
  return fetchImpl(`${config.apiBaseUrl}${pathName}`, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${config.token}`,
      ...(options.headers || {}),
    },
  });
}

async function parseGitHubResponse(response) {
  if (response.status === 204) return null;

  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : null;
  if (response.ok) return payload;

  const message = payload?.message || rawText || `HTTP ${response.status}`;
  throw new Error(`GitHub API 请求失败：${message}`);
}

function detectContentType(filePath) {
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".sig")) return "text/plain; charset=utf-8";
  if (filePath.endsWith(".exe")) return "application/vnd.microsoft.portable-executable";
  return "application/octet-stream";
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function encodeRepoPath(repo) {
  return repo.split("/").map(encodeURIComponent).join("/");
}
