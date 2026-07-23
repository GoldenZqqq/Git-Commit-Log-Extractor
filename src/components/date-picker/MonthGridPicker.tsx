import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthFromDate } from "../../model";

const MONTH_LABELS = [
  "1 月", "2 月", "3 月", "4 月", "5 月", "6 月",
  "7 月", "8 月", "9 月", "10 月", "11 月", "12 月",
] as const;

type Props = {
  year: number;
  selectedMonth: string;
  onYearChange: (year: number) => void;
  onSelectMonth: (monthValue: string) => void;
};

export function MonthGridPicker({
  year,
  selectedMonth,
  onYearChange,
  onSelectMonth,
}: Props) {
  const now = new Date();
  const currentMonthValue = formatMonthFromDate(new Date(now.getFullYear(), now.getMonth(), 1));

  return (
    <div className="gp-month-grid" role="group" aria-label="月份网格">
      <div className="gp-month-grid-nav">
        <button
          type="button"
          className="gp-month-nav-button"
          aria-label="上一年"
          onClick={() => onYearChange(year - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <strong className="gp-month-grid-year">{year} 年</strong>
        <button
          type="button"
          className="gp-month-nav-button"
          aria-label="下一年"
          onClick={() => onYearChange(year + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="gp-month-grid-cells">
        {MONTH_LABELS.map((label, index) => {
          const monthValue = `${year}-${String(index + 1).padStart(2, "0")}`;
          const selected = monthValue === selectedMonth;
          const isCurrent = monthValue === currentMonthValue;
          return (
            <button
              key={monthValue}
              type="button"
              className={[
                "gp-month-cell",
                selected ? "is-selected" : "",
                isCurrent && !selected ? "is-current" : "",
              ].filter(Boolean).join(" ")}
              aria-pressed={selected}
              onClick={() => onSelectMonth(monthValue)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
