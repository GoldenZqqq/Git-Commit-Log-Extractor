import { AlertCircle, AlertTriangle, ChevronDown, X, XCircle } from "lucide-react";

type Props = {
  warnings: string[];
  lastOutputFile: string;
  emptyReportAdvice: { title: string; scope: string; checks: string[] } | null;
  showEmptyReportAdvice: boolean;
  scanBlocked: boolean;
  cleanupBlocked: boolean;
  canFillBlankDay: boolean;
  onDismissAdvice: () => void;
  onOpenSettings: () => void;
  onRefreshRepos: () => void;
  onInspectCleanup: () => void;
  onDismissWarnings: () => void;
  onOpenBlankDayFill: () => void;
};

export function WorkbenchEventLog({
  warnings,
  lastOutputFile,
  emptyReportAdvice,
  showEmptyReportAdvice,
  scanBlocked,
  cleanupBlocked,
  canFillBlankDay,
  onDismissAdvice,
  onOpenSettings,
  onRefreshRepos,
  onInspectCleanup,
  onDismissWarnings,
  onOpenBlankDayFill,
}: Props) {
  const primaryWarning = warnings.find((warning) => warning.includes("AI 润色失败"));
  const detailWarnings = primaryWarning ? warnings.filter((warning) => warning !== primaryWarning) : warnings;
  if (warnings.length === 0 && !lastOutputFile && !showEmptyReportAdvice) return null;
  return (
    <footer className="event-log">
      {lastOutputFile && <p>输出文件：{lastOutputFile}</p>}
      {warnings.length > 0 && (
        <section className="warning-event" role="status" aria-live="polite">
          <div className="warning-event-summary">
            <AlertTriangle size={15} />
            <strong>有 {warnings.length} 条本地处理警告</strong>
            <span className={primaryWarning ? "warning-event-primary" : undefined}>
              {primaryWarning ?? "部分仓库或路径未能完成读取"}
            </span>
            <div className="warning-event-actions">
              {detailWarnings.length > 0 && (
                <details className="warning-event-details">
                  <summary><ChevronDown size={13} />查看详情</summary>
                  <ul>{detailWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                </details>
              )}
              <button type="button" onClick={onInspectCleanup} disabled={cleanupBlocked || scanBlocked}>检查并清理</button>
              <button type="button" className="warning-event-close" onClick={onDismissWarnings} aria-label="关闭警告" title="关闭警告"><X size={14} /></button>
            </div>
          </div>
        </section>
      )}
      {showEmptyReportAdvice && emptyReportAdvice && (
        <div className="empty-report-advice" role="status" aria-live="polite">
          <button type="button" className="empty-report-advice-close" aria-label="关闭空提交提示" title="关闭提示" onClick={onDismissAdvice}>
            <XCircle size={15} />
          </button>
          <div>
            <AlertCircle size={15} />
            <strong>{emptyReportAdvice.title}</strong>
          </div>
          <p>{emptyReportAdvice.scope}</p>
          <ul>{emptyReportAdvice.checks.map((check) => <li key={check}>{check}</li>)}</ul>
          <div className="empty-report-actions">
            {canFillBlankDay && <button type="button" onClick={onOpenBlankDayFill}>空白日补写</button>}
            <button type="button" onClick={onOpenSettings}>检查作者/分支</button>
            <button type="button" onClick={onRefreshRepos} disabled={scanBlocked}>重新扫描仓库</button>
          </div>
        </div>
      )}
    </footer>
  );
}
