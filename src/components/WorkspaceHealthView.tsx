import {
  AlertTriangle,
  CheckCircle2,
  FolderCog,
  Loader2,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type {
  WorkspaceHealthResult,
  WorkspaceRepoHealth,
  WorkspaceRepoStatus,
  WorkspaceRootStatus,
} from "../model";
import "./WorkspaceHealthView.css";

type Props = {
  result: WorkspaceHealthResult | null;
  loading: boolean;
  error: string;
  scannedAt: string;
  rootDirs: string[];
  rescanning: boolean;
  scanBlocked: boolean;
  onRefresh: () => void;
  onRescan: () => void;
  onOpenSettings: () => void;
  onToggleRepo: (path: string, enabled: boolean) => void;
  onRemoveRepo: (path: string) => void;
};

const INVALID_REPO_STATUSES = new Set<WorkspaceRepoStatus>(["missing", "inaccessible", "not_git"]);
const BRANCH_REPO_STATUSES = new Set<WorkspaceRepoStatus>(["branch_unknown", "branch_changed"]);

export function WorkspaceHealthView(props: Props) {
  const summary = summarizeHealth(props.result);
  const emptyWorkspace = props.rootDirs.length === 0 && (props.result?.repos.length ?? 0) === 0;
  const hasIssues = summary.invalidPaths > 0 || summary.branchAlerts > 0;

  return (
    <section className="workspace-health-view" aria-label="工作区健康">
      <HealthHeader {...props} showSettings={!emptyWorkspace} />
      {props.loading && !props.result ? (
        <HealthSkeleton />
      ) : props.error && !props.result ? (
        <HealthError message={props.error} onRetry={props.onRefresh} />
      ) : emptyWorkspace ? (
        <HealthEmpty onOpenSettings={props.onOpenSettings} />
      ) : (
        <div className="workspace-health-content">
          <HealthSummary summary={summary} scannedAt={props.scannedAt} />
          <div className={`workspace-health-banner ${hasIssues ? "attention" : "healthy"}`} role="status">
            {hasIssues ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <strong>{hasIssues ? "发现需要处理的工作区问题" : "工作区状态正常"}</strong>
            <span>{hasIssues ? "可按下方建议修复；检查过程不会读取提交内容。" : "根目录、仓库路径与分支状态均可用。"}</span>
          </div>
          <RootHealthList roots={props.result?.roots ?? []} />
          <RepoHealthTable
            repos={props.result?.repos ?? []}
            onToggleRepo={props.onToggleRepo}
            onRemoveRepo={props.onRemoveRepo}
          />
        </div>
      )}
    </section>
  );
}

function HealthHeader(props: Props & { showSettings: boolean }) {
  return (
    <header className="workspace-health-header">
      <div>
        <h3><ShieldCheck size={17} /> 工作区健康</h3>
        <p>检查目录、Git 标记和当前分支；不读取提交，不调用 AI。</p>
      </div>
      <div className="workspace-health-actions">
        <button type="button" onClick={props.onRefresh} disabled={props.loading}>
          {props.loading ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
          刷新检查
        </button>
        <button type="button" onClick={props.onRescan} disabled={props.scanBlocked}>
          {props.rescanning ? <Loader2 className="spin" size={14} /> : <RotateCcw size={14} />}
          {props.rescanning ? "扫描中" : "重新扫描"}
        </button>
        {props.showSettings && (
          <button type="button" onClick={props.onOpenSettings}>
            <Settings2 size={14} /> 打开设置
          </button>
        )}
      </div>
    </header>
  );
}

function HealthSummary({ summary, scannedAt }: {
  summary: ReturnType<typeof summarizeHealth>;
  scannedAt: string;
}) {
  return (
    <dl className="workspace-health-summary" aria-label="健康汇总">
      <div className="workspace-health-freshness">
        <dt>最近扫描</dt>
        <dd>{describeFreshness(scannedAt)}</dd>
        <small>{formatScannedAt(scannedAt)}</small>
      </div>
      <div><dt>根目录</dt><dd>{summary.roots}</dd></div>
      <div><dt>索引仓库</dt><dd>{summary.repos}</dd></div>
      <div><dt>使用范围</dt><dd>启用 {summary.enabled} / 禁用 {summary.disabled}</dd></div>
      <div className={summary.invalidPaths > 0 ? "attention" : ""}><dt>失效路径</dt><dd>{summary.invalidPaths}</dd></div>
      <div className={summary.branchAlerts > 0 ? "attention" : ""}><dt>分支提醒</dt><dd>{summary.branchAlerts}</dd></div>
    </dl>
  );
}

function RootHealthList({ roots }: { roots: WorkspaceHealthResult["roots"] }) {
  if (roots.length === 0) return null;
  return (
    <section className="workspace-health-section" aria-labelledby="workspace-root-health-title">
      <div className="workspace-health-section-title">
        <h4 id="workspace-root-health-title">根目录</h4>
        <span>{roots.length} 项</span>
      </div>
      <ul className="workspace-root-list">
        {roots.map((root) => {
          const meta = rootStatusMeta(root.status);
          return (
            <li key={root.path}>
              <FolderCog size={15} />
              <code>{root.path}</code>
              <span className={`workspace-health-status ${meta.tone}`}>{meta.label}</span>
              <p>{root.detail}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RepoHealthTable({ repos, onToggleRepo, onRemoveRepo }: {
  repos: WorkspaceRepoHealth[];
  onToggleRepo: Props["onToggleRepo"];
  onRemoveRepo: Props["onRemoveRepo"];
}) {
  return (
    <section className="workspace-health-section repo-health-section" aria-labelledby="workspace-repo-health-title">
      <div className="workspace-health-section-title">
        <h4 id="workspace-repo-health-title">仓库索引</h4>
        <span>{repos.length} 项</span>
      </div>
      {repos.length === 0 ? (
        <p className="workspace-health-no-repos">暂无缓存仓库，请重新扫描。</p>
      ) : (
        <div className="workspace-health-table-wrap">
          <table className="workspace-health-table">
            <thead><tr><th>仓库</th><th>状态</th><th>分支</th><th>使用</th><th>修复</th></tr></thead>
            <tbody>
              {repos.map((repo) => (
                <RepoHealthRow
                  key={repo.path}
                  repo={repo}
                  onToggleRepo={onToggleRepo}
                  onRemoveRepo={onRemoveRepo}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RepoHealthRow({ repo, onToggleRepo, onRemoveRepo }: {
  repo: WorkspaceRepoHealth;
  onToggleRepo: Props["onToggleRepo"];
  onRemoveRepo: Props["onRemoveRepo"];
}) {
  const meta = repoStatusMeta(repo.status);
  const invalid = INVALID_REPO_STATUSES.has(repo.status);
  const branch = repo.currentBranch || repo.cachedBranch || "未知";
  return (
    <tr>
      <td><div className="workspace-health-cell"><strong>{repo.name}</strong><code>{repo.path}</code></div></td>
      <td><div className="workspace-health-cell"><span className={`workspace-health-status ${meta.tone}`}>{meta.label}</span><small>{repo.detail}</small></div></td>
      <td><div className="workspace-health-cell"><code>{branch}</code>{repo.status === "branch_changed" && <small>索引：{repo.cachedBranch || "未知"}</small>}</div></td>
      <td><span className={`workspace-repo-use ${repo.disabled ? "disabled" : "enabled"}`}>{repo.disabled ? "已禁用" : "已启用"}</span></td>
      <td>
        <div className="workspace-health-row-actions">
          <button type="button" onClick={() => onToggleRepo(repo.path, repo.disabled)}>
            {repo.disabled ? "启用" : "禁用"}
          </button>
          {invalid && (
            <button type="button" className="danger" onClick={() => onRemoveRepo(repo.path)}>
              <Trash2 size={13} /> 移除索引
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function HealthSkeleton() {
  return <div className="workspace-health-skeleton" aria-label="正在检查工作区健康"><span /><span /><span /><span /></div>;
}

function HealthError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="workspace-health-state error" role="alert">
      <AlertTriangle size={22} /><strong>健康检查失败</strong><p>{message}</p>
      <button type="button" onClick={onRetry}>重试检查</button>
    </div>
  );
}

function HealthEmpty({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="workspace-health-state" role="status">
      <FolderCog size={24} /><strong>尚未配置工作区</strong>
      <p>请先添加仓库根目录并扫描。</p>
      <button type="button" onClick={onOpenSettings}><Settings2 size={14} /> 打开设置</button>
    </div>
  );
}

function summarizeHealth(result: WorkspaceHealthResult | null) {
  const roots = result?.roots ?? [];
  const repos = result?.repos ?? [];
  return {
    roots: roots.length,
    repos: repos.length,
    enabled: repos.filter((repo) => !repo.disabled).length,
    disabled: repos.filter((repo) => repo.disabled).length,
    invalidPaths: roots.filter((root) => root.status !== "healthy").length
      + repos.filter((repo) => INVALID_REPO_STATUSES.has(repo.status)).length,
    branchAlerts: repos.filter((repo) => BRANCH_REPO_STATUSES.has(repo.status)).length,
  };
}

function rootStatusMeta(status: WorkspaceRootStatus) {
  if (status === "healthy") return { label: "正常", tone: "healthy" };
  if (status === "missing") return { label: "目录失效", tone: "danger" };
  if (status === "not_directory") return { label: "非目录", tone: "danger" };
  return { label: "不可访问", tone: "warning" };
}

function repoStatusMeta(status: WorkspaceRepoStatus) {
  if (status === "healthy") return { label: "正常", tone: "healthy" };
  if (status === "missing") return { label: "路径已失效", tone: "danger" };
  if (status === "not_git") return { label: "非 Git 仓库", tone: "danger" };
  if (status === "inaccessible") return { label: "不可访问", tone: "warning" };
  if (status === "branch_changed") return { label: "分支已变化", tone: "warning" };
  return { label: "分支未知", tone: "warning" };
}

function formatScannedAt(scannedAt: string) {
  const date = new Date(scannedAt);
  if (!scannedAt || Number.isNaN(date.getTime())) return "尚未完成扫描";
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}/${values.month}/${values.day} ${values.hour}:${values.minute}`;
}

function describeFreshness(scannedAt: string) {
  const timestamp = new Date(scannedAt).getTime();
  if (!scannedAt || Number.isNaN(timestamp)) return "尚未扫描";
  const ageDays = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (ageDays === 0) return "今天";
  if (ageDays <= 7) return `${ageDays} 天前`;
  return `已超过 ${ageDays} 天`;
}
