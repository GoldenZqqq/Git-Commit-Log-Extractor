import { useMemo, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import {
  formatDateFromDate,
  getToday,
  isValidDateInput,
  parseDateInputValue,
} from "../../model";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  showToday?: boolean;
  className?: string;
  /** Compact control for filter bars */
  size?: "default" | "sm";
  /** Forwarded for dialog initial focus helpers */
  "data-dialog-initial-focus"?: boolean;
};

export function DatePickerField({
  value,
  onChange,
  ariaLabel,
  placeholder = "选择日期",
  disabled = false,
  allowClear = false,
  showToday = true,
  className = "",
  size = "default",
  "data-dialog-initial-focus": dialogInitialFocus,
}: Props) {
  const [open, setOpen] = useState(false);
  const valid = isValidDateInput(value);
  const selected = useMemo(
    () => (valid ? parseDateInputValue(value) : undefined),
    [valid, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={[
            "date-picker-field",
            size === "sm" ? "is-sm" : "",
            !valid ? "is-empty" : "",
            className,
          ].filter(Boolean).join(" ")}
          disabled={disabled}
          aria-label={ariaLabel}
          data-period-value={valid ? value : ""}
          data-dialog-initial-focus={dialogInitialFocus ? true : undefined}
        >
          <CalendarDays size={size === "sm" ? 13 : 15} className="date-picker-field-icon" />
          <span className="date-picker-field-value">{valid ? value : placeholder}</span>
          {allowClear && valid && !disabled && (
            <span
              className="date-picker-field-clear"
              role="button"
              tabIndex={-1}
              aria-label={`清除${ariaLabel}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChange("");
              }}
            >
              <X size={13} />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="period-picker-popover w-auto border-0 p-0 shadow-none" align="start">
        <header className="period-picker-header">
          <strong>{ariaLabel}</strong>
          <span>点选日期，可用月份箭头快速跳转</span>
        </header>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? new Date()}
          onSelect={(date) => {
            if (!date) return;
            onChange(formatDateFromDate(date));
            setOpen(false);
          }}
        />
        <footer className="period-picker-footer">
          <div className="period-picker-footer-actions">
            {showToday && (
              <button
                type="button"
                className="period-picker-chip"
                onClick={() => {
                  onChange(getToday());
                  setOpen(false);
                }}
              >
                今天
              </button>
            )}
            {allowClear && (
              <button
                type="button"
                className="period-picker-chip"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                清除
              </button>
            )}
          </div>
          <button type="button" className="period-picker-ghost" onClick={() => setOpen(false)}>
            关闭
          </button>
        </footer>
      </PopoverContent>
    </Popover>
  );
}
