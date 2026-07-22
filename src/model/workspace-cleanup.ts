import type { WorkspaceHealthResult, WorkspaceRepoHealth, WorkspaceRootHealth } from "./types";

const REMOVABLE_ROOT_STATUSES = new Set(["missing", "not_directory"]);
const REMOVABLE_REPO_STATUSES = new Set(["missing", "not_git"]);

export type WorkspaceCleanupCandidate = {
  roots: WorkspaceRootHealth[];
  repos: WorkspaceRepoHealth[];
};

export function findWorkspaceCleanupCandidate(result: WorkspaceHealthResult): WorkspaceCleanupCandidate {
  const roots = result.roots.filter((root) => REMOVABLE_ROOT_STATUSES.has(root.status));
  const removableRoots = roots.map((root) => normalizePath(root.path));
  const repos = result.repos.filter((repo) => {
    if (REMOVABLE_REPO_STATUSES.has(repo.status)) return true;
    return removableRoots.some((root) => isPathWithinRoot(repo.path, root));
  });
  return { roots, repos };
}

export function workspaceCleanupCount(candidate: WorkspaceCleanupCandidate) {
  return candidate.roots.length + candidate.repos.length;
}

export function isPathWithinRoot(path: string, normalizedRoot: string) {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath || !normalizedRoot) return false;
  if (normalizedPath === normalizedRoot) return true;
  const separator = normalizedRoot.endsWith("\\") ? "" : "\\";
  return normalizedPath.startsWith(`${normalizedRoot}${separator}`);
}

function normalizePath(value: string) {
  const normalized = value.trim().replace(/[\\/]+/g, "\\").toLowerCase();
  if (normalized.length <= 3) return normalized;
  return normalized.replace(/\\+$/, "");
}
