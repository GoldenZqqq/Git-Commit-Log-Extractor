import { CalendarDays } from "lucide-react";
import type { DateRange, PreviewMode } from "../model";

type ReportPeriodProps = {
  activePreview: PreviewMode;
  dailyDate: string;
  weeklyWeek: string;
  weeklyRange: DateRange;
  monthlyMonth: string;
  monthlyRange: DateRange;
  customRange: DateRange;
  periodLocked: boolean;
  onDailyDateChange: (date: string) => void;
  onWeeklyWeekChange: (week: string) => void;
  onMonthlyMonthChange: (month: string) => void;
  onOpenCustomRange: () => void;
};

export function ReportPeriodControl({
  activePreview,
  dailyDate,
  weeklyWeek,
  weeklyRange,
  monthlyMonth,
  monthlyRange,
  customRange,
  periodLocked,
  onDailyDateChange,
  onWeeklyWeekChange,
  onMonthlyMonthChange,
  onOpenCustomRange,
}: ReportPeriodProps) {
  const rangeLabel = activePreview === "weekly"
    ? `${weeklyRange.startDate} ~ ${weeklyRange.endDate}`
    : activePreview === "monthly"
      ? `${monthlyRange.startDate} ~ ${monthlyRange.endDate}`
      : activePreview === "custom"
        ? `${customRange.startDate} ~ ${customRange.endDate}`
        : dailyDate;

  return (
    <div className="report-period-control" aria-label="报告周期选择">
      <span className="period-label">
        <CalendarDays size={14} />
        周期
      </span>
      {activePreview === "summary" && (
        <input
          type="date"
          value={dailyDate}
          disabled={periodLocked}
          aria-label="选择日报日期"
          onChange={(event) => {
            const next = event.target.value;
            if (next) onDailyDateChange(next);
          }}
        />
      )}
      {activePreview === "weekly" && (
        <input
          type="week"
          value={weeklyWeek}
          disabled={periodLocked}
          aria-label="选择周报周次"
          onChange={(event) => {
            // Native week inputs can emit empty/partial values while typing; keep prior complete value.
            const next = event.target.value;
            if (next) onWeeklyWeekChange(next);
          }}
        />
      )}
      {activePreview === "monthly" && (
        <input
          type="month"
          value={monthlyMonth}
          disabled={periodLocked}
          aria-label="选择月报月份"
          onChange={(event) => {
            // Native month inputs can emit empty/partial values while typing; keep prior complete value.
            const next = event.target.value;
            if (next) onMonthlyMonthChange(next);
          }}
        />
      )}
      {activePreview === "custom" && (
        <button
          className="period-range-button"
          type="button"
          disabled={periodLocked}
          onClick={onOpenCustomRange}
        >
          {rangeLabel}
        </button>
      )}
      {activePreview !== "summary" && activePreview !== "custom" && (
        <span className="period-range-label">{rangeLabel}</span>
      )}
    </div>
  );
}

type GenerationScopeProps = {
  activePreview: PreviewMode;
  rangeLabel: string;
  author: string;
  enabledRepoCount: number;
  totalRepoCount: number;
  extractAllBranches: boolean;
  redactionEnabled: boolean;
  onOpenSettings: () => void;
};

export function GenerationScopeStrip({
  activePreview,
  rangeLabel,
  author,
  enabledRepoCount,
  totalRepoCount,
  extractAllBranches,
  redactionEnabled,
  onOpenSettings,
}: GenerationScopeProps) {
  return (
    <div className="generation-scope-strip" aria-label="当前生成范围">
      <ScopeItem label="周期" value={`${getHistoryKindLabel(activePreview)} · ${rangeLabel}`} />
      <ScopeItem label="作者" value={formatAuthorValue(author)} onClick={onOpenSettings} title="在设置中修改统计作者" />
      <ScopeItem label="仓库" value={formatRepoScope(enabledRepoCount, totalRepoCount)} tone={enabledRepoCount === 0 ? "attention" : "default"} />
      <ScopeItem label="分支" value={extractAllBranches ? "全部分支" : "当前分支"} />
      {redactionEnabled && <span className="generation-scope-note">导出脱敏已启用</span>}
    </div>
  );
}

function ScopeItem({
  label,
  value,
  tone = "default",
  title,
  onClick,
}: {
  label: string;
  value: string;
  tone?: "default" | "attention";
  title?: string;
  onClick?: () => void;
}) {
  const content = <>
      <span className="generation-scope-label">{label}</span>
      <span className="generation-scope-value">{value}</span>
    </>;
  return onClick
    ? <button type="button" className={`generation-scope-item ${tone}`} title={title} onClick={onClick}>{content}</button>
    : <span className={`generation-scope-item ${tone}`} title={title}>{content}</span>;
}

export function getHistoryKindLabel(mode: PreviewMode) {
  if (mode === "monthly") return "月报";
  if (mode === "weekly") return "周报";
  if (mode === "custom") return "自定义";
  return "日报";
}

export function formatActiveRange(
  activePreview: PreviewMode,
  dailyDate: string,
  weeklyRange: DateRange,
  monthlyRange: DateRange,
  customRange: DateRange,
) {
  if (activePreview === "weekly") return `${weeklyRange.startDate} ~ ${weeklyRange.endDate}`;
  if (activePreview === "monthly") return `${monthlyRange.startDate} ~ ${monthlyRange.endDate}`;
  if (activePreview === "custom") return `${customRange.startDate} ~ ${customRange.endDate}`;
  return dailyDate;
}

export function formatAuthorScope(author: string) {
  const trimmed = author.trim();
  if (!trimmed) return "全部作者";
  if (trimmed.includes(",")) return `多作者：${trimmed}`;
  return `作者：${trimmed}`;
}

function formatAuthorValue(author: string) {
  const trimmed = author.trim();
  if (!trimmed) return "全部作者";
  if (!trimmed.includes(",")) return trimmed;
  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join("、");
}

function formatRepoScope(enabledRepoCount: number, totalRepoCount: number) {
  if (totalRepoCount === 0) return "未扫描";
  if (enabledRepoCount === totalRepoCount) return `${totalRepoCount} 个仓库`;
  return `${enabledRepoCount}/${totalRepoCount} 个仓库`;
}
