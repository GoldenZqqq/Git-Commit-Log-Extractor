import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import {
  formatDateFromDate,
  formatMonthDisplayLabel,
  formatMonthFromDate,
  formatWeekDisplayLabel,
  getToday,
  getWeekLabel,
  getWeekRange,
  parseDateInputValue,
  parseMonthInputValue,
  resolveDateInput,
  resolveMonthInput,
  resolveWeekInput,
  type DateRange,
  type PreviewMode,
} from "../model";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MonthGridPicker } from "./date-picker";

type Props = {
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

/**
 * shadcn pilot period picker:
 * - 日报：日历
 * - 周报：日历选中 ISO 周
 * - 月报：年切换 + 12 个月网格（不是选某一天）
 */
export function ReportPeriodPicker({
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
}: Props) {
  const [open, setOpen] = useState(false);
  const resolvedDay = resolveDateInput(dailyDate);
  const resolvedWeek = resolveWeekInput(weeklyWeek);
  const resolvedMonth = resolveMonthInput(monthlyMonth);
  const selectedDay = useMemo(() => parseDateInputValue(resolvedDay), [resolvedDay]);
  const selectedWeekDate = useMemo(
    () => parseDateInputValue(getWeekRange(resolvedWeek).startDate),
    [resolvedWeek],
  );
  const selectedMonthDate = useMemo(
    () => parseMonthInputValue(resolvedMonth),
    [resolvedMonth],
  );
  const [monthPanelYear, setMonthPanelYear] = useState(selectedMonthDate.getFullYear());
  const weekStart = useMemo(
    () => parseDateInputValue(weeklyRange.startDate),
    [weeklyRange.startDate],
  );
  const weekEnd = useMemo(
    () => parseDateInputValue(weeklyRange.endDate),
    [weeklyRange.endDate],
  );

  useEffect(() => {
    if (open && activePreview === "monthly") {
      setMonthPanelYear(selectedMonthDate.getFullYear());
    }
  }, [open, activePreview, selectedMonthDate]);

  const rangeLabel = activePreview === "weekly"
    ? `${weeklyRange.startDate} ~ ${weeklyRange.endDate}`
    : activePreview === "monthly"
      ? `${monthlyRange.startDate} ~ ${monthlyRange.endDate}`
      : activePreview === "custom"
        ? `${customRange.startDate} ~ ${customRange.endDate}`
        : resolvedDay;

  const triggerLabel = activePreview === "weekly"
    ? formatWeekDisplayLabel(resolvedWeek)
    : activePreview === "monthly"
      ? formatMonthDisplayLabel(resolvedMonth)
      : resolvedDay;

  const triggerMeta = activePreview === "summary"
    ? (resolvedDay === getToday() ? "今天" : undefined)
    : rangeLabel;

  const headerTitle = activePreview === "weekly"
    ? "选择报告周"
    : activePreview === "monthly"
      ? "选择报告月"
      : "选择报告日";

  const headerHint = activePreview === "weekly"
    ? "点击任意一天即可选中其所在 ISO 周"
    : activePreview === "monthly"
      ? "选择年份与月份，无需点具体日期"
      : "点选日期，或用月份箭头快速跳转";

  if (activePreview === "custom") {
    return (
      <div className="report-period-control" aria-label="报告周期选择">
        <span className="period-label">
          <CalendarDays size={14} />
          周期
        </span>
        <button
          className="period-range-button"
          type="button"
          disabled={periodLocked}
          onClick={onOpenCustomRange}
        >
          {rangeLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="report-period-control" aria-label="报告周期选择">
      <span className="period-label">
        <CalendarDays size={14} />
        周期
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="period-picker-trigger"
            disabled={periodLocked}
            aria-label={
              activePreview === "weekly"
                ? "选择周报周次"
                : activePreview === "monthly"
                  ? "选择月报月份"
                  : "选择日报日期"
            }
            data-period-value={
              activePreview === "weekly"
                ? resolvedWeek
                : activePreview === "monthly"
                  ? resolvedMonth
                  : resolvedDay
            }
          >
            <span className="period-picker-trigger-copy">
              <strong>{triggerLabel}</strong>
              {triggerMeta && <span>{triggerMeta}</span>}
            </span>
            <ChevronDown size={14} className="period-picker-trigger-chevron" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="period-picker-popover w-auto border-0 p-0 shadow-none" align="start">
          <header className="period-picker-header">
            <strong>{headerTitle}</strong>
            <span>{headerHint}</span>
          </header>

          {activePreview === "summary" && (
            <Calendar
              mode="single"
              selected={selectedDay}
              defaultMonth={selectedDay}
              onSelect={(date) => {
                if (!date) return;
                onDailyDateChange(formatDateFromDate(date));
                setOpen(false);
              }}
            />
          )}

          {activePreview === "weekly" && (
            <Calendar
              mode="single"
              selected={selectedWeekDate}
              defaultMonth={selectedWeekDate}
              modifiers={{
                week: { from: weekStart, to: weekEnd },
                weekStart: weekStart,
                weekEnd: weekEnd,
              }}
              modifiersClassNames={{
                week: "gp-week-day",
                weekStart: "gp-week-start",
                weekEnd: "gp-week-end",
              }}
              onSelect={(date) => {
                if (!date) return;
                onWeeklyWeekChange(getWeekLabel(date));
                setOpen(false);
              }}
            />
          )}

          {activePreview === "monthly" && (
            <MonthGridPicker
              year={monthPanelYear}
              selectedMonth={resolvedMonth}
              onYearChange={setMonthPanelYear}
              onSelectMonth={(monthValue) => {
                onMonthlyMonthChange(monthValue);
                setOpen(false);
              }}
            />
          )}

          <footer className="period-picker-footer">
            <div className="period-picker-footer-actions">
              {activePreview === "summary" && (
                <button
                  type="button"
                  className="period-picker-chip"
                  onClick={() => {
                    onDailyDateChange(getToday());
                    setOpen(false);
                  }}
                >
                  今天
                </button>
              )}
              {activePreview === "weekly" && (
                <button
                  type="button"
                  className="period-picker-chip"
                  onClick={() => {
                    onWeeklyWeekChange(getWeekLabel());
                    setOpen(false);
                  }}
                >
                  本周
                </button>
              )}
              {activePreview === "monthly" && (
                <button
                  type="button"
                  className="period-picker-chip"
                  onClick={() => {
                    const now = new Date();
                    onMonthlyMonthChange(formatMonthFromDate(new Date(now.getFullYear(), now.getMonth(), 1)));
                    setOpen(false);
                  }}
                >
                  本月
                </button>
              )}
            </div>
            <button type="button" className="period-picker-ghost" onClick={() => setOpen(false)}>
              关闭
            </button>
          </footer>
        </PopoverContent>
      </Popover>
    </div>
  );
}
