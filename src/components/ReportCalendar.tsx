import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Sparkles, Wand2 } from "lucide-react";
import {
  getReportCalendarKind,
  groupReportHistoryByAnchorDate,
  type ReportHistoryEntry,
} from "../model";
import "./ReportCalendar.css";

type Props = {
  entries: ReportHistoryEntry[];
  aiConfigured: boolean;
  isBusy: boolean;
  onOpenHistory: (entry: ReportHistoryEntry) => void;
  onGenerateDaily: (date: string) => void;
  onOpenBlankDayFill: (date: string) => void;
};

type DayCell = {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  entries: ReportHistoryEntry[];
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const KIND_LABEL: Record<string, string> = {
  daily: "日报",
  blank: "补写",
  weekly: "周报",
  monthly: "月报",
  custom: "自定义",
};

export function ReportCalendar({
  entries,
  aiConfigured,
  isBusy,
  onOpenHistory,
  onGenerateDaily,
  onOpenBlankDayFill,
}: Props) {
  const today = useMemo(() => formatDate(new Date()), []);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const byDay = useMemo(() => groupReportHistoryByAnchorDate(entries), [entries]);
  const cells = useMemo(() => buildMonthCells(cursor.year, cursor.month, byDay, today), [cursor, byDay, today]);
  const activeEntries = activeDate ? byDay.get(activeDate) ?? [] : [];

  useEffect(() => {
    if (!activeDate) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveDate(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeDate]);

  function shiftMonth(delta: number) {
    setCursor((current) => {
      const date = new Date(current.year, current.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
    setActiveDate(null);
  }

  function goThisMonth() {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setActiveDate(null);
  }

  function handleDayClick(cell: DayCell) {
    if (!cell.inMonth) return;
    setActiveDate(cell.date);
    if (cell.entries.length === 1) {
      onOpenHistory(cell.entries[0]);
      setActiveDate(null);
    }
  }

  const monthLabel = `${cursor.year}年${cursor.month + 1}月`;
  const hasAny = entries.length > 0;

  return (
    <section className="report-calendar" aria-label="报告日历">
      <header className="report-calendar-header">
        <div>
          <h4>
            <CalendarDays size={16} />
            报告日历
          </h4>
          <p>查看本地已生成的日报、周报、月报与补写草稿</p>
        </div>
        <div className="report-calendar-nav">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="上个月">
            <ChevronLeft size={16} />
          </button>
          <strong>{monthLabel}</strong>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="下个月">
            <ChevronRight size={16} />
          </button>
          <button type="button" className="report-calendar-today" onClick={goThisMonth}>
            本月
          </button>
        </div>
      </header>

      <div className="report-calendar-legend" aria-label="图例">
        <span className="legend-item kind-daily">日报</span>
        <span className="legend-item kind-blank">补写</span>
        <span className="legend-item kind-weekly">周报</span>
        <span className="legend-item kind-monthly">月报</span>
        <span className="legend-item kind-custom">自定义</span>
      </div>

      {!hasAny ? (
        <p className="report-calendar-empty">暂无报告记录。生成日报或周报后，会显示在这里。</p>
      ) : (
        <>
          <div className="report-calendar-weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="report-calendar-grid" role="grid" aria-label={monthLabel}>
            {cells.map((cell) => {
              const kinds = uniqueKinds(cell.entries);
              const selected = activeDate === cell.date;
              return (
                <button
                  key={`${cell.date}-${cell.inMonth ? "in" : "out"}`}
                  type="button"
                  role="gridcell"
                  className={[
                    "report-calendar-day",
                    cell.inMonth ? "in-month" : "out-month",
                    cell.isToday ? "is-today" : "",
                    cell.entries.length > 0 ? "has-entries" : "",
                    selected ? "is-selected" : "",
                  ].filter(Boolean).join(" ")}
                  disabled={!cell.inMonth}
                  onClick={() => handleDayClick(cell)}
                  aria-label={`${cell.date}${cell.entries.length ? `，${cell.entries.length} 份报告` : "，暂无报告"}`}
                >
                  <span className="day-number">{Number(cell.date.slice(8))}</span>
                  {kinds.length > 0 && (
                    <span className="day-dots" aria-hidden="true">
                      {kinds.slice(0, 4).map((kind) => (
                        <i key={kind} className={`dot kind-${kind}`} />
                      ))}
                      {cell.entries.length > 1 && <em className="day-count">{cell.entries.length}</em>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {activeDate && (
        <div className="report-calendar-panel" role="region" aria-label={`${activeDate} 的报告`}>
          <div className="report-calendar-panel-head">
            <strong>{activeDate}</strong>
            <button type="button" onClick={() => setActiveDate(null)}>关闭</button>
          </div>
          {activeEntries.length > 0 ? (
            <ul className="report-calendar-entry-list">
              {activeEntries.map((entry) => {
                const kind = getReportCalendarKind(entry);
                return (
                  <li key={entry.id}>
                    <button type="button" onClick={() => { onOpenHistory(entry); setActiveDate(null); }}>
                      <span className={`entry-kind kind-${kind}`}>{KIND_LABEL[kind]}</span>
                      <span className="entry-title">{entry.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="report-calendar-empty-day">
              <p>该日暂无报告</p>
              <div className="report-calendar-empty-actions">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => { onGenerateDaily(activeDate); setActiveDate(null); }}
                >
                  <FileText size={14} />
                  生成日报
                </button>
                <button
                  type="button"
                  disabled={isBusy || !aiConfigured}
                  title={aiConfigured ? "基于近期 Git 线索补写" : "请先配置 AI"}
                  onClick={() => { onOpenBlankDayFill(activeDate); setActiveDate(null); }}
                >
                  {aiConfigured ? <Wand2 size={14} /> : <Sparkles size={14} />}
                  空白日补写
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function uniqueKinds(entries: ReportHistoryEntry[]) {
  const seen = new Set<string>();
  const kinds: string[] = [];
  for (const entry of entries) {
    const kind = getReportCalendarKind(entry);
    if (seen.has(kind)) continue;
    seen.add(kind);
    kinds.push(kind);
  }
  return kinds;
}

function buildMonthCells(
  year: number,
  month: number,
  byDay: Map<string, ReportHistoryEntry[]>,
  today: string,
): DayCell[] {
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // Monday=0
  const start = new Date(year, month, 1 - firstWeekday);
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = formatDate(date);
    cells.push({
      date: key,
      inMonth: date.getMonth() === month,
      isToday: key === today,
      entries: byDay.get(key) ?? [],
    });
  }
  return cells;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
