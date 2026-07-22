import { invoke } from "@tauri-apps/api/core";
import { useState, type Dispatch, type SetStateAction } from "react";
import type { AppMessageTone } from "../components/AppMessageHost";
import {
  clearRepoIndexCache,
  findWorkspaceCleanupCandidate,
  saveRepoIndexCache,
  type AppSettings,
  type RepoInfo,
  type RepoScanProgress,
  type RepoScanResult,
  type WorkspaceCleanupCandidate,
} from "../model";
import type { useWorkspaceHealth } from "./useWorkspaceHealth";

type StatusOptions = { notify?: boolean; tone?: AppMessageTone; duration?: number };
type ScanTaskRunner = (input: {
  kind: "scan";
  label: string;
  task: () => Promise<void>;
  validate: () => void;
}) => Promise<boolean>;

type Params = {
  settings: AppSettings;
  repos: RepoInfo[];
  isRepoScanning: boolean;
  workspaceHealth: Pick<ReturnType<typeof useWorkspaceHealth>, "refresh" | "refreshIfLoaded" | "removeRepos">;
  runTask: ScanTaskRunner;
  validateSettings: (settings: AppSettings) => void;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  setRepos: Dispatch<SetStateAction<RepoInfo[]>>;
  setRepoScannedAt: Dispatch<SetStateAction<string>>;
  setScanProgress: Dispatch<SetStateAction<RepoScanProgress | null>>;
  setWarnings: Dispatch<SetStateAction<string[]>>;
  setStatus: (message: string, options?: StatusOptions) => void;
};

export function useWorkspaceScanning(params: Params) {
  const scanWorkspace = createWorkspaceScanner(params);
  return { scanWorkspace, ...useWorkspaceCleanup(params, scanWorkspace) };
}

function createWorkspaceScanner(params: Params) {
  return async (rootDirs = params.settings.rootDirs) => {
    const scanSettings = rootDirs === params.settings.rootDirs
      ? params.settings
      : { ...params.settings, rootDirs };
    return params.runTask({
      kind: "scan",
      label: "正在扫描仓库",
      task: async () => {
        params.setScanProgress(emptyScanProgress());
        const result = await invoke<RepoScanResult>("scan_repos", { rootDirs });
        updateRepoIndex(params, result.repos, rootDirs);
        params.setWarnings(result.warnings);
        params.setScanProgress((current) => completedScanProgress(current, result.repos.length));
        params.setStatus(scanResultMessage(result), scanResultStatusOptions(result));
        params.workspaceHealth.refreshIfLoaded(result.repos);
      },
      validate: () => params.validateSettings(scanSettings),
    });
  };
}

type CleanupContext = {
  params: Params;
  candidate: WorkspaceCleanupCandidate | null;
  busy: boolean;
  setCandidate: Dispatch<SetStateAction<WorkspaceCleanupCandidate | null>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  scanWorkspace: ReturnType<typeof createWorkspaceScanner>;
};

function useWorkspaceCleanup(params: Params, scanWorkspace: ReturnType<typeof createWorkspaceScanner>) {
  const [cleanupCandidate, setCleanupCandidate] = useState<WorkspaceCleanupCandidate | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const context = { params, candidate: cleanupCandidate, busy: cleanupBusy, setCandidate: setCleanupCandidate, setBusy: setCleanupBusy, scanWorkspace };
  return {
    cleanupCandidate,
    cleanupBusy,
    inspectCleanup: () => inspectCleanup(context),
    confirmCleanup: () => confirmCleanup(context),
    dismissCleanup: () => { if (!cleanupBusy) setCleanupCandidate(null); },
  };
}

async function inspectCleanup(context: CleanupContext) {
  if (context.params.isRepoScanning || context.busy) return;
  context.setBusy(true);
  const result = await context.params.workspaceHealth.refresh();
  context.setBusy(false);
  if (!result) {
    context.params.setStatus("工作区检查失败，请重试或打开健康页查看详情", { tone: "error", notify: true, duration: 4200 });
    return;
  }
  const candidate = findWorkspaceCleanupCandidate(result);
  if (candidate.roots.length === 0 && candidate.repos.length === 0) {
    context.params.setStatus("当前没有可安全清理的失效路径；请检查挂载状态或目录权限", { tone: "warning", notify: true, duration: 4200 });
    return;
  }
  context.setCandidate(candidate);
}

async function confirmCleanup(context: CleanupContext) {
  if (!context.candidate || context.busy) return;
  const rootPaths = new Set(context.candidate.roots.map((root) => root.path));
  const repoPaths = new Set(context.candidate.repos.map((repo) => repo.path));
  const nextRootDirs = context.params.settings.rootDirs.filter((path) => !rootPaths.has(path));
  const nextRepos = context.params.repos.filter((repo) => !repoPaths.has(repo.path));
  const counts = { roots: context.params.settings.rootDirs.length - nextRootDirs.length, repos: context.params.repos.length - nextRepos.length };

  applyCleanup(context.params, rootPaths, repoPaths, nextRepos);
  context.setBusy(true);
  context.setCandidate(null);
  try {
    const outcome = nextRootDirs.length === 0 ? "empty" : await cleanupRescan(context, nextRootDirs);
    context.params.setStatus(cleanupMessage(counts, outcome), {
      tone: outcome === "failure" ? "error" : "success",
      notify: true,
    });
  } finally {
    context.setBusy(false);
  }
}

async function cleanupRescan(context: CleanupContext, rootDirs: string[]) {
  return await context.scanWorkspace(rootDirs) ? "success" as const : "failure" as const;
}

function scanResultMessage(result: RepoScanResult) {
  return result.warnings.length > 0
    ? `已发现 ${result.repos.length} 个仓库，部分路径已跳过`
    : `已发现 ${result.repos.length} 个仓库`;
}

function scanResultStatusOptions(result: RepoScanResult): StatusOptions | undefined {
  return result.warnings.length > 0 ? { tone: "warning", notify: true, duration: 4200 } : undefined;
}

function emptyScanProgress(): RepoScanProgress {
  return { rootDir: "", currentPath: "", scannedDirs: 0, foundRepos: 0, done: false, cancelled: false };
}

function completedScanProgress(current: RepoScanProgress | null, repoCount: number): RepoScanProgress {
  return {
    rootDir: current?.rootDir ?? "",
    currentPath: current?.currentPath ?? "",
    scannedDirs: current?.scannedDirs ?? 0,
    foundRepos: repoCount,
    done: true,
    cancelled: false,
  };
}

function updateRepoIndex(params: Params, repos: RepoInfo[], rootDirs: string[]) {
  params.setRepos(repos);
  params.setRepoScannedAt(saveRepoIndexCache(rootDirs, repos).scannedAt);
}

function applyCleanup(params: Params, rootPaths: Set<string>, repoPaths: Set<string>, nextRepos: RepoInfo[]) {
  params.setRepos(nextRepos);
  params.setSettings((current) => ({
    ...current,
    rootDirs: current.rootDirs.filter((path) => !rootPaths.has(path)),
    disabledRepos: current.disabledRepos.filter((path) => !repoPaths.has(path)),
  }));
  params.workspaceHealth.removeRepos([...repoPaths]);
  params.setRepoScannedAt("");
  clearRepoIndexCache();
}

function cleanupMessage(counts: { roots: number; repos: number }, outcome: "success" | "failure" | "empty") {
  const prefix = `已清理 ${counts.roots} 个根目录、${counts.repos} 个仓库索引`;
  if (outcome === "success") return `${prefix}，并完成重新扫描`;
  if (outcome === "failure") return `${prefix}，但重新扫描失败，请稍后重试`;
  return `${prefix}，请添加新的工作目录`;
}
