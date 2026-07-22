import { AlertTriangle, FolderGit2, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspaceCleanupCandidate } from "../model";
import { workspaceCleanupCount } from "../model";
import { useModalDialog } from "../hooks/useOverlayFocus";

type Props = {
  candidate: WorkspaceCleanupCandidate | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function WorkspaceCleanupDialog({ candidate, busy, onCancel, onConfirm }: Props) {
  const dialogRef = useModalDialog({ open: Boolean(candidate), onClose: onCancel, closeEnabled: !busy });
  if (!candidate) return null;
  const total = workspaceCleanupCount(candidate);
  return (
    <div className="dialog-backdrop compact-backdrop confirm-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="range-dialog confirm-dialog workspace-cleanup-dialog"
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="workspace-cleanup-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="range-dialog-header">
          <div>
            <p className="kicker">Workspace Cleanup</p>
            <h2 id="workspace-cleanup-title">清理失效路径？</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} disabled={busy} aria-label="取消清理" title="取消清理">
            <X size={17} />
          </button>
        </header>
        <div className="workspace-cleanup-warning">
          <AlertTriangle size={16} />
          <p>将从 GitPulse 的配置和索引中移除 {total} 项，不会删除磁盘上的任何文件。</p>
        </div>
        <div className="workspace-cleanup-list" aria-label="待清理路径">
          {candidate.roots.length > 0 && (
            <CleanupGroup title={`失效根目录 · ${candidate.roots.length}`} paths={candidate.roots.map((root) => root.path)} icon={<FolderGit2 size={14} />} />
          )}
          {candidate.repos.length > 0 && (
            <CleanupGroup title={`仓库索引 · ${candidate.repos.length}`} paths={candidate.repos.map((repo) => `${repo.name} · ${repo.path}`)} icon={<Trash2 size={14} />} />
          )}
        </div>
        <p className="confirm-dialog-text">暂时不可访问的目录不会被自动清理，可以在工作区健康页继续检查。</p>
        <footer className="range-dialog-actions">
          <button data-dialog-initial-focus type="button" className="mapping-import" onClick={onCancel} disabled={busy}>保留配置</button>
          <button type="button" className="danger-button" onClick={onConfirm} disabled={busy}>
            <Trash2 size={16} />{busy ? "清理中" : `清理 ${total} 项`}
          </button>
        </footer>
      </section>
    </div>
  );
}

function CleanupGroup({ title, paths, icon }: { title: string; paths: string[]; icon: ReactNode }) {
  return (
    <section className="workspace-cleanup-group">
      <h3>{icon}{title}</h3>
      <ul>{paths.map((path) => <li key={path} title={path}>{path}</li>)}</ul>
    </section>
  );
}
