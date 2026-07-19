import { AlertCircle, XCircle } from "lucide-react";

type Props = {
  warnings: string[];
  lastOutputFile: string;
  emptyReportAdvice: { title: string; scope: string; checks: string[] } | null;
  showEmptyReportAdvice: boolean;
  scanBlocked: boolean;
  onDismissAdvice: () => void;
  onOpenSettings: () => void;
  onRefreshRepos: () => void;
};

export function WorkbenchEventLog({
  warnings,
  lastOutputFile,
  emptyReportAdvice,
  showEmptyReportAdvice,
  scanBlocked,
  onDismissAdvice,
  onOpenSettings,
  onRefreshRepos,
}: Props) {
  if (warnings.length === 0 && !lastOutputFile && !showEmptyReportAdvice) return null;
  return (
    <footer className="event-log">
      {lastOutputFile && <p>输出文件：{lastOutputFile}</p>}
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
            <button type="button" onClick={onOpenSettings}>检查作者/分支</button>
            <button type="button" onClick={onRefreshRepos} disabled={scanBlocked}>重新扫描仓库</button>
          </div>
        </div>
      )}
      {warnings.map((warning) => <p key={warning}>{warning}</p>)}
    </footer>
  );
}
