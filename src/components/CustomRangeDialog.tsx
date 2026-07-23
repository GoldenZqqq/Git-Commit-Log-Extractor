import { CalendarDays, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { DateRange } from "../model";
import { useModalDialog } from "../hooks/useOverlayFocus";
import { DatePickerField } from "./date-picker";
import { Field } from "./Primitives";

type Props = {
  open: boolean;
  initialRange: DateRange;
  generationBlocked: boolean;
  onClose: () => void;
  onConfirm: (range: DateRange) => void;
};

export function CustomRangeDialog({ open, initialRange, generationBlocked, onClose, onConfirm }: Props) {
  const [range, setRange] = useState<DateRange>(initialRange);
  const dialogRef = useModalDialog({ open, onClose });

  useEffect(() => {
    if (open) setRange(initialRange);
  }, [initialRange, open]);

  if (!open) return null;

  const rangeInvalid = !range.startDate || !range.endDate || range.startDate > range.endDate;

  return (
    <div className="dialog-backdrop compact-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="range-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-range-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="range-dialog-header">
          <div>
            <p className="kicker">Custom Range</p>
            <h2 id="custom-range-title">自定义报告周期</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭自定义日期选择">
            <X size={17} />
          </button>
        </header>

        <div className="range-fields">
          <Field label="开始日期">
            <DatePickerField
              data-dialog-initial-focus
              ariaLabel="开始日期"
              value={range.startDate}
              onChange={(startDate) => setRange((current) => ({ ...current, startDate }))}
            />
          </Field>
          <Field label="结束日期">
            <DatePickerField
              ariaLabel="结束日期"
              value={range.endDate}
              onChange={(endDate) => setRange((current) => ({ ...current, endDate }))}
            />
          </Field>
        </div>

        {rangeInvalid && <p className="range-error">请选择完整且有效的日期范围。</p>}

        <footer className="range-dialog-actions">
          <button type="button" className="mapping-import" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="mapping-add"
            disabled={rangeInvalid || generationBlocked}
            onClick={() => onConfirm(range)}
          >
            <CalendarDays size={16} />
            生成报告
          </button>
        </footer>
      </section>
    </div>
  );
}
