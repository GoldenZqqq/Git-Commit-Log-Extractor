import {
  CheckCircle2,
  CircleOff,
  FolderPlus,
  RefreshCw,
  Search,
  Settings2,
  TerminalSquare,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { resolveRepoDisplayName, type RepoInfo, type RepoScanProgress } from "../model";
import "./RepositoryPanel.css";

type Props = {
  repos: RepoInfo[];
  disabledRepos: string[];
  projectNames: Record<string, string>;
  rootDirs: string[];
  isScanning: boolean;
  scanBlocked: boolean;
  scanProgress: RepoScanProgress | null;
  onToggleRepo: (path: string, enabled: boolean) => void;
  onSetReposEnabled: (paths: string[], enabled: boolean) => void;
  onEditRepo: (repo: RepoInfo) => void;
  onRefreshRepos: () => void;
  onCancelRepoScan: () => void;
  onAddRootDirs: () => void;
  onOpenSettings: () => void;
};

type RepoStatusFilter = "all" | "enabled" | "disabled";

type RepositoryEntry = {
  repo: RepoInfo;
  displayName: string;
  enabled: boolean;
  searchText: string;
};

export function RepositoryPanel(props: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<RepoStatusFilter>("all");
  const entries = useMemo(
    () => buildRepositoryEntries(props.repos, props.disabledRepos, props.projectNames),
    [props.disabledRepos, props.projectNames, props.repos],
  );
  const counts = countRepositoryEntries(entries);
  const visibleEntries = filterRepositoryEntries(entries, query, status);
  const paths = visibleEntries.map((entry) => entry.repo.path);
  return (
    <section className="repo-drawer" aria-label="仓库索引">
      <div className="repo-panel-head">
        <RepositoryHeader {...props} enabledCount={counts.enabled} />
        <RepoScanStatus scanning={props.isScanning} progress={props.scanProgress} />
        {entries.length > 0 && (
          <RepositoryControls
            query={query}
            status={status}
            counts={counts}
            visibleEntries={visibleEntries}
            onQueryChange={setQuery}
            onStatusChange={setStatus}
            onSetReposEnabled={(enabled) => props.onSetReposEnabled(paths, enabled)}
          />
        )}
        {entries.length > 0 && counts.enabled === 0 && <AllDisabledNotice onShowDisabled={() => setStatus("disabled")} />}
      </div>
      <RepositoryList {...props} entries={visibleEntries} query={query} status={status} onQueryChange={setQuery} onStatusChange={setStatus} />
    </section>
  );
}

function RepositoryHeader(props: Props & { enabledCount: number }) {
  const meta = props.enabledCount === props.repos.length
    ? `${props.repos.length} repos`
    : `${props.enabledCount}/${props.repos.length} repos`;
  return (
    <div className="panel-title">
      <h3><TerminalSquare size={17} />仓库索引</h3>
      <div className="panel-title-actions">
        <span>{meta}</span>
        <button
          className="repo-refresh-button"
          type="button"
          onClick={props.isScanning ? props.onCancelRepoScan : props.onRefreshRepos}
          disabled={props.scanBlocked && !props.isScanning}
          aria-label={props.isScanning ? "取消仓库扫描" : "重新扫描仓库索引"}
          title={props.isScanning ? "取消仓库扫描" : "重新扫描仓库索引"}
        >
          {props.isScanning ? <XCircle size={14} /> : <RefreshCw size={14} />}
          {props.isScanning ? "取消扫描" : "重新扫描"}
        </button>
      </div>
    </div>
  );
}

function RepoScanStatus({ scanning, progress }: { scanning: boolean; progress: RepoScanProgress | null }) {
  if (!scanning || !progress) return null;
  return (
    <div className="repo-scan-progress" role="status" aria-live="polite">
      <div><RefreshCw className="spin" size={14} /><span>已检查 {progress.scannedDirs} 个目录 · 发现 {progress.foundRepos} 个仓库</span></div>
      {progress.currentPath && <span className="repo-scan-path" title={progress.currentPath}>{progress.currentPath}</span>}
    </div>
  );
}

function RepositoryControls(props: {
  query: string;
  status: RepoStatusFilter;
  counts: ReturnType<typeof countRepositoryEntries>;
  visibleEntries: RepositoryEntry[];
  onQueryChange: (value: string) => void;
  onStatusChange: (value: RepoStatusFilter) => void;
  onSetReposEnabled: (enabled: boolean) => void;
}) {
  return (
    <div className="repo-manager-controls">
      <RepositorySearch query={props.query} onQueryChange={props.onQueryChange} />
      <RepositoryFilterBar status={props.status} counts={props.counts} onStatusChange={props.onStatusChange} />
      <RepositoryBulkBar entries={props.visibleEntries} total={props.counts.total} onSetReposEnabled={props.onSetReposEnabled} />
    </div>
  );
}

function RepositorySearch({ query, onQueryChange }: { query: string; onQueryChange: (value: string) => void }) {
  return (
    <label className="repo-search-field">
      <Search size={14} aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        aria-label="搜索仓库"
        placeholder="搜索项目、仓库、路径或分支"
      />
      {query && <button type="button" onClick={() => onQueryChange("")} aria-label="清空搜索关键词" title="清空搜索关键词"><X size={13} /></button>}
    </label>
  );
}

function RepositoryFilterBar(props: {
  status: RepoStatusFilter;
  counts: ReturnType<typeof countRepositoryEntries>;
  onStatusChange: (value: RepoStatusFilter) => void;
}) {
  const options: Array<{ value: RepoStatusFilter; label: string; count: number }> = [
    { value: "all", label: "全部", count: props.counts.total },
    { value: "enabled", label: "已启用", count: props.counts.enabled },
    { value: "disabled", label: "已禁用", count: props.counts.disabled },
  ];
  return (
    <div className="repo-status-filters" role="group" aria-label="筛选仓库状态">
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={props.status === option.value} onClick={() => props.onStatusChange(option.value)}>
          {option.label} <span>{option.count}</span>
        </button>
      ))}
    </div>
  );
}

function RepositoryBulkBar({ entries, total, onSetReposEnabled }: {
  entries: RepositoryEntry[];
  total: number;
  onSetReposEnabled: (enabled: boolean) => void;
}) {
  const canEnable = entries.some((entry) => !entry.enabled);
  const canDisable = entries.some((entry) => entry.enabled);
  return (
    <div className="repo-bulk-bar">
      <span className="repo-result-count" aria-live="polite">命中 {entries.length} / 总计 {total}</span>
      <div className="repo-bulk-actions">
        <button type="button" onClick={() => onSetReposEnabled(true)} disabled={!canEnable}><CheckCircle2 size={13} />启用当前结果</button>
        <button type="button" onClick={() => onSetReposEnabled(false)} disabled={!canDisable}><CircleOff size={13} />禁用当前结果</button>
      </div>
    </div>
  );
}

function AllDisabledNotice({ onShowDisabled }: { onShowDisabled: () => void }) {
  return (
    <div className="repo-all-disabled" role="status">
      <CircleOff size={15} />
      <span><strong>当前所有仓库均已禁用</strong>，报告生成范围为 0。</span>
      <button type="button" onClick={onShowDisabled}>查看已禁用</button>
    </div>
  );
}

function RepositoryList(props: Props & {
  entries: RepositoryEntry[];
  query: string;
  status: RepoStatusFilter;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: RepoStatusFilter) => void;
}) {
  if (props.repos.length === 0) return <RepoIndexEmptyState {...props} />;
  if (props.entries.length === 0) {
    return <RepositoryFilterEmpty query={props.query} status={props.status} onQueryChange={props.onQueryChange} onStatusChange={props.onStatusChange} />;
  }
  return (
    <div className="repo-list">
      {props.entries.map((entry) => <RepositoryRow key={entry.repo.path} entry={entry} onToggleRepo={props.onToggleRepo} onEditRepo={props.onEditRepo} />)}
    </div>
  );
}

function RepositoryRow({ entry, onToggleRepo, onEditRepo }: {
  entry: RepositoryEntry;
  onToggleRepo: Props["onToggleRepo"];
  onEditRepo: Props["onEditRepo"];
}) {
  const isMapped = entry.displayName !== entry.repo.name;
  return (
    <article className={`repo-row ${entry.enabled ? "" : "disabled"}`} aria-label={`仓库 ${entry.displayName}`}>
      <label className="repo-toggle" title={entry.enabled ? "已纳入报告，点击排除该仓库" : "已排除，点击重新纳入报告"}>
        <input type="checkbox" checked={entry.enabled} onChange={(event) => onToggleRepo(entry.repo.path, event.target.checked)} />
        <span aria-hidden="true" />
      </label>
      <button type="button" className="repo-info" onClick={() => onEditRepo(entry.repo)} title="点击编辑项目映射名称">
        <strong className="repo-display-name">{entry.displayName}</strong>
        <span className="repo-meta">
          {isMapped && <em className="repo-origin">{entry.repo.name}</em>}
          <em className="repo-branch" title={entry.repo.branch}>{entry.repo.branch}</em>
        </span>
        <span className="repo-path">{entry.repo.path}</span>
      </button>
    </article>
  );
}

function RepositoryFilterEmpty(props: {
  query: string;
  status: RepoStatusFilter;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: RepoStatusFilter) => void;
}) {
  const title = props.query ? "没有匹配仓库" : props.status === "enabled" ? "当前没有已启用仓库" : "当前没有已禁用仓库";
  return (
    <div className="repo-filter-empty" role="status">
      <Search size={20} />
      <strong>{title}</strong>
      <p>{props.query ? "换个关键词，或清除搜索查看当前状态筛选中的全部仓库。" : "切换状态筛选后即可继续管理仓库范围。"}</p>
      <div>
        {props.query && <button type="button" onClick={() => props.onQueryChange("")}>清除搜索</button>}
        {props.status !== "all" && <button type="button" onClick={() => props.onStatusChange("all")}>查看全部</button>}
      </div>
    </div>
  );
}

function RepoIndexEmptyState(props: Props) {
  const hasRootDirs = props.rootDirs.length > 0;
  return (
    <section className="repo-empty-state" aria-label="仓库索引为空">
      <div className="repo-empty-icon" aria-hidden="true"><TerminalSquare size={18} /></div>
      <RepoEmptyCopy hasRootDirs={hasRootDirs} />
      <RepoEmptyChecks hasRootDirs={hasRootDirs} />
      <RepoEmptyActions {...props} hasRootDirs={hasRootDirs} />
    </section>
  );
}

function RepoEmptyCopy({ hasRootDirs }: { hasRootDirs: boolean }) {
  return (
    <div className="repo-empty-copy">
      <strong>{hasRootDirs ? "还没有扫描到 Git 仓库" : "先添加仓库根目录"}</strong>
      <p>{hasRootDirs ? "已配置目录，但当前索引为空。通常是目录层级不对、目录下没有 .git，或扫描还没有重新执行。" : "选择存放代码项目的文件夹后，GitPulse 会扫描其中的本地 Git 仓库。"}</p>
    </div>
  );
}

function RepoEmptyChecks({ hasRootDirs }: { hasRootDirs: boolean }) {
  const items = hasRootDirs
    ? ["确认选择的是包含项目的上层目录。", "确认项目目录内存在 `.git`。", "移动或新增仓库后请重新扫描。"]
    : ["可以选择 `D:\\workspace` 这类项目集合目录。", "多个工作区可分次添加。"];
  return <ul className="repo-empty-checks">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

function RepoEmptyActions(props: Props & { hasRootDirs: boolean }) {
  return (
    <div className="repo-empty-actions">
      <button type="button" onClick={props.onAddRootDirs} disabled={props.scanBlocked}><FolderPlus size={14} />{props.hasRootDirs ? "添加其他目录" : "添加目录"}</button>
      {props.hasRootDirs ? (
        <button type="button" onClick={props.onRefreshRepos} disabled={props.scanBlocked || props.isScanning}><RefreshCw size={14} />重新扫描</button>
      ) : (
        <button type="button" onClick={props.onOpenSettings}><Settings2 size={14} />打开设置</button>
      )}
    </div>
  );
}

function buildRepositoryEntries(repos: RepoInfo[], disabledRepos: string[], projectNames: Record<string, string>): RepositoryEntry[] {
  const disabledPaths = new Set(disabledRepos);
  return repos.map((repo) => {
    const displayName = resolveRepoDisplayName(repo, projectNames);
    return {
      repo,
      displayName,
      enabled: !disabledPaths.has(repo.path),
      searchText: normalizeRepositorySearch([repo.name, displayName, repo.path, repo.branch].join(" ")),
    };
  });
}

function filterRepositoryEntries(entries: RepositoryEntry[], query: string, status: RepoStatusFilter) {
  const normalizedQuery = normalizeRepositorySearch(query);
  return entries.filter((entry) => {
    if (status === "enabled" && !entry.enabled) return false;
    if (status === "disabled" && entry.enabled) return false;
    return !normalizedQuery || entry.searchText.includes(normalizedQuery);
  });
}

function countRepositoryEntries(entries: RepositoryEntry[]) {
  const enabled = entries.filter((entry) => entry.enabled).length;
  return { total: entries.length, enabled, disabled: entries.length - enabled };
}

function normalizeRepositorySearch(value: string) {
  return value.trim().toLocaleLowerCase();
}
