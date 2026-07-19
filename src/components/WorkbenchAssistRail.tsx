import { History, Sparkles, TerminalSquare } from "lucide-react";
import type { WorkbenchProps } from "./Workbench.types";
import { ReportHistoryPanel } from "./ReportHistoryPanel";
import { ReportQualityPanel } from "./ReportQualityPanel";
import { RepositoryPanel } from "./RepositoryPanel";

type Props = {
  workbench: WorkbenchProps;
  activePanel: "repos" | "history" | "quality";
  enabledRepoCount: number;
  hasQualityPanel: boolean;
  isRepoScanning: boolean;
  scanBlocked: boolean;
  generateBlocked: boolean;
  reviewPending: boolean;
  onPanelChange: (panel: "repos" | "history" | "quality") => void;
};

export function WorkbenchAssistRail({
  workbench,
  activePanel,
  enabledRepoCount,
  hasQualityPanel,
  isRepoScanning,
  scanBlocked,
  generateBlocked,
  reviewPending,
  onPanelChange,
}: Props) {
  const visiblePanel = activePanel === "quality" && !hasQualityPanel ? "repos" : activePanel;
  return (
    <aside className="assist-rail" aria-label="辅助工作区">
      <div className="assist-tabs" role="tablist" aria-label="辅助面板">
        <button type="button" role="tab" aria-selected={visiblePanel === "repos"} className={visiblePanel === "repos" ? "active" : ""} onClick={() => onPanelChange("repos")}>
          <TerminalSquare size={14} />
          仓库
          <span>{enabledRepoCount}/{workbench.repos.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={visiblePanel === "history"} className={visiblePanel === "history" ? "active" : ""} onClick={() => onPanelChange("history")}>
          <History size={14} />
          最近
          <span>{workbench.reportHistory.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={visiblePanel === "quality"} className={visiblePanel === "quality" ? "active" : ""} disabled={!hasQualityPanel} onClick={() => onPanelChange("quality")}>
          <Sparkles size={14} />
          交付
          <span>{hasQualityPanel ? "可查" : "待生成"}</span>
        </button>
      </div>
      <div className="assist-panel">
        {visiblePanel === "repos" && (
          <RepositoryPanel
            repos={workbench.repos}
            disabledRepos={workbench.disabledRepos}
            projectNames={workbench.projectNames}
            rootDirs={workbench.rootDirs}
            isScanning={isRepoScanning}
            scanBlocked={scanBlocked}
            scanProgress={workbench.scanProgress}
            onToggleRepo={workbench.onToggleRepo}
            onSetReposEnabled={workbench.onSetReposEnabled}
            onEditRepo={workbench.onEditRepo}
            onRefreshRepos={workbench.onRefreshRepos}
            onCancelRepoScan={workbench.onCancelRepoScan}
            onAddRootDirs={workbench.onAddRootDirs}
            onOpenSettings={workbench.onOpenSettings}
          />
        )}
        {visiblePanel === "history" && (
          <ReportHistoryPanel
            entries={workbench.reportHistory}
            activeHistoryId={workbench.activeHistoryId}
            generationBlocked={generateBlocked}
            reportLocked={reviewPending}
            onOpen={workbench.onOpenHistory}
            onCopy={workbench.onCopyHistory}
            onRegenerate={workbench.onRegenerateHistory}
            onClear={workbench.onClearHistory}
          />
        )}
        {visiblePanel === "quality" && hasQualityPanel && (
          <ReportQualityPanel
            commitCount={workbench.commitCount}
            projectCount={workbench.projectCount}
            enabledRepoCount={enabledRepoCount}
            totalRepoCount={workbench.repos.length}
            aiConfigured={workbench.aiConfigured}
            showEvidenceDetails={workbench.showEvidenceDetails}
            redactionEnabled={workbench.redactionEnabled}
            canExport={workbench.canExport}
          />
        )}
      </div>
    </aside>
  );
}
