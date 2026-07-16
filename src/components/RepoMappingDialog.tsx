import { Tag, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MappingScope, RepoInfo } from "../model";
import { readRepoMapping } from "../model";
import { useModalDialog } from "../hooks/useOverlayFocus";
import { Field } from "./Primitives";

type Props = {
  open: boolean;
  repo: RepoInfo | null;
  projectNamesText: string;
  onClose: () => void;
  onConfirm: (scope: MappingScope, displayName: string) => void;
};

export function RepoMappingDialog({ open, repo, projectNamesText, onClose, onConfirm }: Props) {
  const [scope, setScope] = useState<MappingScope>("all");
  const [displayName, setDisplayName] = useState("");
  const dialogRef = useModalDialog({ open: open && Boolean(repo), onClose });

  useEffect(() => {
    if (open && repo) {
      const current = readRepoMapping(projectNamesText, repo);
      setScope(current.scope);
      setDisplayName(current.displayName);
    }
  }, [open, repo, projectNamesText]);

  if (!open || !repo) return null;

  const branchScopeDisabled = !repo.branch;

  return (
    <div className="dialog-backdrop compact-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="range-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repo-mapping-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="range-dialog-header">
          <div>
            <p className="kicker">Project Mapping</p>
            <h2 id="repo-mapping-title">编辑项目映射</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭映射编辑">
            <X size={17} />
          </button>
        </header>

        <p className="mapping-dialog-repo">
          <span>{repo.name}</span>
          {repo.branch && <em>{repo.branch}</em>}
        </p>

        <Field label="映射名称" hint="留空则清除该仓库的映射，报告中回退使用仓库名">
          <input
            data-dialog-initial-focus
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="例如：在线学习平台"
            onKeyDown={(event) => {
              if (event.key === "Enter") onConfirm(scope, displayName);
            }}
          />
        </Field>

        <Field label="作用范围">
          <div className="mapping-scope-control" role="radiogroup" aria-label="映射作用范围">
            <button
              type="button"
              role="radio"
              aria-checked={scope === "all"}
              className={scope === "all" ? "active" : ""}
              onClick={() => setScope("all")}
            >
              本仓库所有分支
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={scope === "branch"}
              className={scope === "branch" ? "active" : ""}
              disabled={branchScopeDisabled}
              title={branchScopeDisabled ? "当前仓库无分支信息" : `仅作用于 ${repo.branch} 分支`}
              onClick={() => setScope("branch")}
            >
              仅当前分支
            </button>
          </div>
        </Field>

        <footer className="range-dialog-actions">
          <button type="button" className="mapping-import" onClick={onClose}>
            取消
          </button>
          <button type="button" className="mapping-add" onClick={() => onConfirm(scope, displayName)}>
            <Tag size={16} />
            保存映射
          </button>
        </footer>
      </section>
    </div>
  );
}
