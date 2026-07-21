import { Activity, FileText, Loader2, Settings2, ShieldCheck } from "lucide-react";
import type { KeyboardEvent } from "react";
import { hasActiveTasks, type ActiveTaskState } from "../hooks/useTaskActivity";

export type WorkbenchView = "report" | "insights" | "health";

type Props = {
  activeTasks: ActiveTaskState;
  visibleStatus: string;
  activeView: WorkbenchView;
  reviewPending: boolean;
  onOpenSettings: () => void;
  onViewChange: (view: WorkbenchView) => void;
};

export function WorkbenchHeader(props: Props) {
  return (
    <header className="workbench-toolbar">
      <div className="workbench-identity">
        <div className="brand-logo workbench-brand" role="img" aria-label="GitPulse" />
        <div>
          <h1>工作报告工作台</h1>
          <span>本地 Git 报告</span>
        </div>
      </div>
      <div className="workbench-view-tabs" role="tablist" aria-label="工作台视图">
        <ViewTab icon={<FileText size={15} />} label="报告" view="report" {...props} />
        <ViewTab icon={<Activity size={15} />} label="洞察" view="insights" {...props} />
        <ViewTab icon={<ShieldCheck size={15} />} label="健康" view="health" {...props} />
      </div>
      <div className="workbench-toolbar-actions">
        <div className="run-status" role="status" aria-live="polite">
          {hasActiveTasks(props.activeTasks) && <Loader2 className="spin" size={15} />}
          <span>{props.visibleStatus || "就绪 · 本地处理"}</span>
        </div>
        <button className="settings-trigger" type="button" onClick={props.onOpenSettings} aria-label="打开设置">
          <Settings2 size={16} />
          <span>设置</span>
        </button>
      </div>
    </header>
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
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']:not(:disabled)") ?? [],
    );
    if (tabs.length === 0) return;
    const currentIndex = tabs.indexOf(event.currentTarget);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[nextIndex].click();
    tabs[nextIndex].focus();
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={activeView === view}
      className={activeView === view ? "active" : ""}
      tabIndex={activeView === view ? 0 : -1}
      disabled={view !== "report" && reviewPending}
      onClick={() => onViewChange(view)}
      onKeyDown={handleKeyDown}
    >
      {icon}
      {label}
    </button>
  );
}
