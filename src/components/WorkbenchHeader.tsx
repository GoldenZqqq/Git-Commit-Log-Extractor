import { Activity, FileText, Loader2, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { hasActiveTasks, type ActiveTaskState } from "../hooks/useTaskActivity";
import { formatAuthorScope } from "./WorkbenchControls";

export type WorkbenchView = "report" | "insights" | "health";

type Props = {
  activeTasks: ActiveTaskState;
  visibleStatus: string;
  author: string;
  repoCount: number;
  commitCount: number;
  lastOutputFile: string;
  activeView: WorkbenchView;
  reviewPending: boolean;
  onOpenSettings: () => void;
  onViewChange: (view: WorkbenchView) => void;
};

export function WorkbenchHeader(props: Props) {
  return (
    <>
      <header className="hero-band">
        <div className="hero-copy">
          <div className="brand-logo hero-brand" role="img" aria-label="GitPulse" />
          <h2>工作报告工作台</h2>
          <p className="hero-subcopy">扫描本地 Git，一键生成工作报告</p>
        </div>
        <div className="hero-aside">
          <div className="hero-actions">
            <div className="run-status">
              {hasActiveTasks(props.activeTasks) && <Loader2 className="spin" size={16} />}
              <span>{props.visibleStatus}</span>
            </div>
            <button className="settings-trigger" type="button" onClick={props.onOpenSettings} aria-label="打开设置">
              <Settings2 size={16} />
              设置
            </button>
          </div>
          <div className="context-chips" aria-label="当前工作区上下文">
            <button type="button" className="context-chip" onClick={props.onOpenSettings} title="在设置中修改统计作者">
              <UserRound size={13} />
              {formatAuthorScope(props.author)}
            </button>
          </div>
          <div className="quick-stats" aria-label="当前结果概览">
            <span><strong>{props.repoCount}</strong> 仓库</span>
            <span><strong>{props.commitCount}</strong> 提交</span>
            <span><strong>{props.lastOutputFile ? "已生成" : "待生成"}</strong> 输出</span>
          </div>
        </div>
      </header>
      <div className="workbench-view-tabs" role="tablist" aria-label="工作台视图">
        <ViewTab icon={<FileText size={14} />} label="报告" view="report" {...props} />
        <ViewTab icon={<Activity size={14} />} label="洞察" view="insights" {...props} />
        <ViewTab icon={<ShieldCheck size={14} />} label="健康" view="health" {...props} />
      </div>
    </>
  );
}

function ViewTab({
  icon,
  label,
  view,
  activeView,
  reviewPending,
  onViewChange,
}: Pick<Props, "activeView" | "reviewPending" | "onViewChange"> & {
  icon: React.ReactNode;
  label: string;
  view: WorkbenchView;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activeView === view}
      className={activeView === view ? "active" : ""}
      disabled={view !== "report" && reviewPending}
      onClick={() => onViewChange(view)}
    >
      {icon}
      {label}
    </button>
  );
}
