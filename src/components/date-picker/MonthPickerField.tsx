import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  formatMonthDisplayLabel,
  formatMonthFromDate,
  getMonthRange,
  isValidMonthInput,
  parseMonthInputValue,
  resolveMonthInput,
} from "../../model";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MonthGridPicker } from "./MonthGridPicker";

type Props = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  showRangeHint?: boolean;
  className?: string;
  "data-dialog-initial-focus"?: boolean;
};

export function MonthPickerField({
  value,
  onChange,
  ariaLabel = "选择月份",
  placeholder = "选择月份",
  disabled = false,
  showRangeHint = false,
  className = "",
  "data-dialog-initial-focus": dialogInitialFocus,
}: Props) {
  const [open, setOpen] = useState(false);
  const valid = isValidMonthInput(value);
  const resolved = valid ? value : "";
  const selectedDate = useMemo(
    () => (valid ? parseMonthInputValue(value) : new Date()),
    [valid, value],
  );
  const [panelYear, setPanelYear] = useState(selectedDate.getFullYear());
  const rangeHint = valid ? (() => {
    const range = getMonthRange(value);
    return `${range.startDate} ~ ${range.endDate}`;
  })() : "";

  useEffect(() => {
    if (open) setPanelYear(selectedDate.getFullYear());
  }, [open, selectedDate]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={["date-picker-field month-picker-field", !valid ? "is-empty" : "", className].filter(Boolean).join(" ")}
          disabled={disabled}
          aria-label={ariaLabel}
          data-period-value={resolved}
          data-dialog-initial-focus={dialogInitialFocus ? true : undefined}
        >
          <CalendarDays size={15} className="date-picker-field-icon" />
          <span className="date-picker-field-copy">
            <span className="date-picker-field-value">
              {valid ? formatMonthDisplayLabel(value) : placeholder}
            </span>
            {showRangeHint && rangeHint && (
              <span className="date-picker-field-meta">{rangeHint}</span>
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="period-picker-popover w-auto border-0 p-0 shadow-none" align="start">
        <header className="period-picker-header">
          <strong>{ariaLabel}</strong>
          <span>选择年份与月份</span>
        </header>
        <MonthGridPicker
          year={panelYear}
          selectedMonth={valid ? value : resolveMonthInput(value)}
          onYearChange={setPanelYear}
          onSelectMonth={(monthValue) => {
            onChange(monthValue);
            setOpen(false);
          }}
        />
        <footer className="period-picker-footer">
          <div className="period-picker-footer-actions">
            <button
              type="button"
              className="period-picker-chip"
              onClick={() => {
                const now = new Date();
                onChange(formatMonthFromDate(new Date(now.getFullYear(), now.getMonth(), 1)));
                setOpen(false);
              }}
            >
              本月
            </button>
          </div>
          <button type="button" className="period-picker-ghost" onClick={() => setOpen(false)}>
            关闭
          </button>
        </footer>
      </PopoverContent>
    </Popover>
  );
}
