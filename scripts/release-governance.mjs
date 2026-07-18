import process from "node:process";
import {
  captureGit,
  ensureGitRepo,
  tryCaptureGit,
} from "./git-cli.mjs";

const DEFAULT_BRANCH = "main";
const DEFAULT_REMOTE = "origin";
const DEFAULT_CI_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_CI_POLL_MS = 10 * 1000;
const RELEASE_TAG_PATTERN = /^v\d+\.\d+\.\d+$/;

export function validateReleaseSource(
  rootDir,
  { branch = DEFAULT_BRANCH, remote = DEFAULT_REMOTE } = {},
) {
  ensureGitRepo(rootDir);
  const currentBranch = captureGit(rootDir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (currentBranch !== branch) {
    throw new Error(`发布必须在 ${branch} 分支执行，当前分支为 ${currentBranch || "detached HEAD"}`);
  }

  assertCleanWorktree(rootDir);
  fetchReleaseRefs(rootDir, { branch, remote });
  const headSha = captureGit(rootDir, ["rev-parse", "HEAD"]);
  const remoteSha = captureGit(rootDir, ["rev-parse", `${remote}/${branch}`]);
  if (headSha !== remoteSha) {
    throw new Error(`当前 ${branch} 不是最新 ${remote}/${branch}，请先同步远端后再发布`);
  }

  return { branch, headSha, remoteSha };
}

export function validateReleaseTag(
  rootDir,
  tagName,
  { branch = DEFAULT_BRANCH, remote = DEFAULT_REMOTE } = {},
) {
  ensureGitRepo(rootDir);
  assertReleaseTag(tagName);
  fetchReleaseRefs(rootDir, { branch, remote });

  const tagSha = captureGit(rootDir, ["rev-list", "-n", "1", tagName]);
  const remoteSha = captureGit(rootDir, ["rev-parse", `${remote}/${branch}`]);
  const mergeBase = captureGit(rootDir, ["merge-base", tagSha, remoteSha]);
  if (mergeBase !== tagSha) {
    throw new Error(`发布标签 ${tagName} 不属于 ${remote}/${branch}，拒绝构建资产`);
  }

  return { branch, remoteSha, tagName, tagSha };
}

export function assertReleaseTagAbsent(rootDir, tagName) {
  assertReleaseTag(tagName);
  const localTag = tryCaptureGit(rootDir, ["rev-list", "-n", "1", tagName]);
  const remoteTag = captureGit(rootDir, [
    "ls-remote",
    "--tags",
    DEFAULT_REMOTE,
    `refs/tags/${tagName}`,
  ]);
  if (localTag || remoteTag) {
    throw new Error(`标签 ${tagName} 已存在；普通发布不会移动或复用已有标签`);
  }
}

export async function assertSuccessfulCiRun({
  fetchImpl = fetch,
  githubConfig,
  sha,
}) {
  const state = await readCiRunState({ fetchImpl, githubConfig, sha });
  if (state.success) return state.success;
  throw new Error(formatCiFailure(state, sha));
}

export async function waitForSuccessfulCiRun({
  fetchImpl = fetch,
  githubConfig,
  pollMs = readPositiveInteger("GITPULSE_RELEASE_CI_POLL_MS", DEFAULT_CI_POLL_MS),
  sha,
  timeoutMs = readPositiveInteger("GITPULSE_RELEASE_CI_TIMEOUT_MS", DEFAULT_CI_TIMEOUT_MS),
}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const state = await readCiRunState({ fetchImpl, githubConfig, sha });
    if (state.success) return state.success;
    if (!state.pending && state.failed) {
      throw new Error(formatCiFailure(state, sha));
    }

    console.log(`等待 main CI：${state.pending?.html_url || sha}`);
    await delay(pollMs);
  }

  throw new Error(`等待提交 ${sha} 的 main CI 超时（${Math.round(timeoutMs / 1000)} 秒）`);
}

export function assertReleaseTag(tagName) {
  if (!RELEASE_TAG_PATTERN.test(tagName)) {
    throw new Error(`发布标签必须使用 vX.Y.Z 格式，实际为 ${tagName || "空值"}`);
  }
}

function assertCleanWorktree(rootDir) {
  const dirtyFiles = captureGit(rootDir, ["status", "--short"]);
  if (dirtyFiles) {
    throw new Error("发布前工作区必须保持干净，请先提交或处理现有改动");
  }
}

function fetchReleaseRefs(rootDir, { branch, remote }) {
  captureGit(rootDir, ["remote", "get-url", remote]);
  captureGit(rootDir, [
    "fetch",
    "--prune",
    remote,
    `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`,
  ]);
  captureGit(rootDir, ["fetch", "--tags", remote]);
}

async function readCiRunState({ fetchImpl, githubConfig, sha }) {
  const url = buildCiRunsUrl(githubConfig, sha);
  const response = await fetchImpl(url, {
    headers: buildGitHubHeaders(githubConfig.token),
  });
  const payload = await parseGitHubResponse(response);
  const runs = (payload.workflow_runs || []).filter((run) => (
    run.event === "push"
    && run.head_branch === DEFAULT_BRANCH
    && run.head_sha === sha
  ));

  return {
    failed: runs.find((run) => run.status === "completed" && run.conclusion !== "success"),
    pending: runs.find((run) => run.status !== "completed"),
    success: runs.find((run) => run.status === "completed" && run.conclusion === "success"),
  };
}

function buildCiRunsUrl(config, sha) {
  const url = new URL(
    `${config.apiBaseUrl}/repos/${encodeRepoPath(config.repo)}/actions/workflows/ci.yml/runs`,
  );
  url.searchParams.set("branch", DEFAULT_BRANCH);
  url.searchParams.set("event", "push");
  url.searchParams.set("head_sha", sha);
  url.searchParams.set("per_page", "20");
  return url;
}

function buildGitHubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "GitPulse-Release-Governance",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function parseGitHubResponse(response) {
  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : {};
  if (response.ok) return payload;
  throw new Error(`查询 GitHub Actions 失败：${payload.message || rawText || `HTTP ${response.status}`}`);
}

function formatCiFailure(state, sha) {
  if (state.failed) {
    return `提交 ${sha} 的主线 CI 未成功：${state.failed.conclusion || state.failed.status}`;
  }
  if (state.pending) {
    return `提交 ${sha} 的主线 CI 尚未完成：${state.pending.html_url || state.pending.status}`;
  }
  return `提交 ${sha} 没有成功的主线 CI push run`;
}

function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function encodeRepoPath(repo) {
  return repo.split("/").map(encodeURIComponent).join("/");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
