import type { CommitRecord, MappingEntry, MappingScope, MappingSuggestion, RepoInfo } from "./types";


export function parseMappingText(text: string): MappingEntry[] {
  return text.split(/\r?\n/).reduce<MappingEntry[]>((rows, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return rows;
    const separatorIndex = line.indexOf("->");
    if (separatorIndex < 0) return rows;
    rows.push({
      key: line.slice(0, separatorIndex).trim(),
      displayName: line.slice(separatorIndex + 2).trim(),
    });
    return rows;
  }, []);
}

export function serializeMappingText(rows: MappingEntry[]): string {
  return rows.map((row) => `${row.key} -> ${row.displayName}`).join("\n");
}

export function mergeMappingEntries(existing: string, entries: MappingEntry[]): string {
  const merged = new Map<string, string>();
  for (const row of parseMappingText(existing)) merged.set(row.key, row.displayName);
  for (const row of entries) {
    if (row.key && row.displayName) merged.set(row.key, row.displayName);
  }
  return serializeMappingText([...merged].map(([key, displayName]) => ({ key, displayName })));
}

export function buildMappingKeys(repos: RepoInfo[]): string[] {
  return repos.flatMap((repo) => {
    const keys = [`${repo.name}(*)`];
    if (repo.branch) keys.push(`${repo.name}(${repo.branch})`);
    return keys;
  });
}

export function buildMappingSuggestions(repos: RepoInfo[], rows: MappingEntry[]): MappingSuggestion[] {
  const mappedKeys = new Set(rows.map((row) => row.key).filter(Boolean));
  const seenSuggestionKeys = new Set<string>();
  return repos.reduce<MappingSuggestion[]>((suggestions, repo) => {
    const allKey = `${repo.name}(*)`;
    const branchKey = `${repo.name}(${repo.branch})`;
    if (mappedKeys.has(allKey) || mappedKeys.has(branchKey) || seenSuggestionKeys.has(allKey)) {
      return suggestions;
    }
    seenSuggestionKeys.add(allKey);
    const historicalName = findHistoricalMappingName(repo, rows);
    suggestions.push({
      key: allKey,
      displayName: historicalName || humanizeRepoName(repo.name, repo.branch),
      repoName: repo.name,
      branch: repo.branch,
      reason: historicalName ? "沿用同仓库历史映射" : buildMappingSuggestionReason(repo),
    });
    return suggestions;
  }, []);
}

export function parseProjectNames(text: string): Record<string, string> {
  return parseMappingText(text).reduce<Record<string, string>>((result, row) => {
    if (row.key && row.displayName) result[row.key] = row.displayName;
    return result;
  }, {});
}

function findHistoricalMappingName(repo: RepoInfo, rows: MappingEntry[]) {
  const prefix = `${repo.name}(`;
  const matched = rows.find((row) => row.key.startsWith(prefix) && row.displayName.trim());
  return matched?.displayName.trim() ?? "";
}

function humanizeRepoName(repoName: string, branchName: string) {
  const baseName = repoName.replace(/\.git$/i, "").trim();
  const displayName = humanizeWords(baseName);
  if (!isGenericRepoName(baseName) || isDefaultBranch(branchName)) return displayName;
  const branchDisplayName = humanizeWords(branchName);
  return branchDisplayName ? `${branchDisplayName} ${displayName}` : displayName;
}

function humanizeWords(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_.]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(formatDisplayWord)
    .join(" ");
}

function formatDisplayWord(word: string) {
  if (/[\u4e00-\u9fff]/.test(word) || /^[A-Z0-9]{2,}$/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function isGenericRepoName(repoName: string) {
  return /^(api|app|backend|client|frontend|server|service|web)$/i.test(repoName.trim());
}

function isDefaultBranch(branchName: string) {
  return /^(main|master|dev|develop|development|trunk)$/i.test(branchName.trim());
}

function buildMappingSuggestionReason(repo: RepoInfo) {
  if (!repo.branch || isDefaultBranch(repo.branch)) return "根据仓库名生成";
  return `根据仓库名和 ${repo.branch} 分支生成`;
}

// 与 Rust 端 report.rs 的 TRAILING_CONNECTORS 保持一致：映射名末尾可能带连接符，统一去除。
export const TRAILING_CONNECTORS = /[-_：:；;、 ]+$/;

// 复刻 Rust resolve_project_name 的查找规则：先精确键 name(branch)，再通配键 name(*)，
// 命中则去掉末尾连接符返回映射名；未配置映射时回退到仓库原名，保证索引展示与报告内容一致。
export function resolveRepoDisplayName(repo: RepoInfo, projectNames: Record<string, string>): string {
  const mapped = projectNames[`${repo.name}(${repo.branch})`] ?? projectNames[`${repo.name}(*)`];
  const trimmed = mapped?.replace(TRAILING_CONNECTORS, "").trim();
  return trimmed ? trimmed : repo.name;
}

export function countCommitProjects(commits: CommitRecord[], projectNames: Record<string, string>): number {
  const projects = new Set<string>();
  for (const commit of commits) {
    const projectName = commit.projectName?.trim();
    const branchName = commit.branchName?.trim();
    if (!projectName || !branchName) continue;
    const exactKey = `${projectName}(${branchName})`;
    const mapped = projectNames[exactKey] ?? projectNames[`${projectName}(*)`] ?? exactKey;
    const displayName = mapped.replace(TRAILING_CONNECTORS, "").trim();
    projects.add(displayName || exactKey);
  }
  return projects.size;
}

// 读取某仓库当前生效的映射：精确键 name(branch) 优先（范围=branch），否则通配键 name(*)（范围=all）。
// 都没有时返回空名称、默认范围 all，供弹窗作为初始值。
export function readRepoMapping(
  text: string,
  repo: RepoInfo,
): { scope: MappingScope; displayName: string } {
  const names = parseProjectNames(text);
  const branchKey = `${repo.name}(${repo.branch})`;
  const allKey = `${repo.name}(*)`;
  if (repo.branch && names[branchKey] !== undefined) {
    return { scope: "branch", displayName: names[branchKey] };
  }
  if (names[allKey] !== undefined) {
    return { scope: "all", displayName: names[allKey] };
  }
  return { scope: "all", displayName: "" };
}

// 写入/更新单个仓库的映射：先移除该仓库的两个候选键（name(*) 与 name(branch)）避免切换范围后残留孤儿键，
// 再按所选范围写入新值；名称为空表示清除映射。其他分支的精确键不受影响。
export function upsertRepoMapping(
  text: string,
  repo: RepoInfo,
  scope: MappingScope,
  displayName: string,
): string {
  const allKey = `${repo.name}(*)`;
  const branchKey = `${repo.name}(${repo.branch})`;
  const rows = parseMappingText(text).filter((row) => row.key !== allKey && row.key !== branchKey);
  const trimmed = displayName.trim();
  if (trimmed) {
    const key = scope === "branch" && repo.branch ? branchKey : allKey;
    rows.push({ key, displayName: trimmed });
  }
  return serializeMappingText(rows);
}
