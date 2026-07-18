import { CalendarDays, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getMonthRange, isValidMonthInput } from "../model";
import { useModalDialog } from "../hooks/useOverlayFocus";
import { Field } from "./Primitives";

type Props = {
  open: boolean;
  initialMonth: string;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: (month: string) => void;
};

export function MonthReportDialog({ open, initialMonth, isBusy, onClose, onConfirm }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const dialogRef = useModalDialog({ open, onClose });

  useEffect(() => {
    if (open) setMonth(initialMonth);
  }, [initialMonth, open]);

  if (!open) return null;

  const monthInvalid = !isValidMonthInput(month);
  const range = monthInvalid ? null : getMonthRange(month);

  return (
    <div className="dialog-backdrop compact-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="range-dialog month-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="month-report-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="range-dialog-header">
          <div>
            <p className="kicker">Monthly Report</p>
            <h2 id="month-report-title">选择月报月份</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭月份选择">
            <X size={17} />
          </button>
        </header>

        <div className="range-fields month-fields">
          <Field label="月份">
            <input
              data-dialog-initial-focus
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </Field>
          <Field label="覆盖日期">
            <input
              type="text"
              value={range ? `${range.startDate} ~ ${range.endDate}` : ""}
              readOnly
            />
          </Field>
        </div>

        {monthInvalid && <p className="range-error">请选择有效的报告月份。</p>}

        <footer className="range-dialog-actions">
          <button type="button" className="mapping-import" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="mapping-add"
            disabled={monthInvalid || isBusy}
            onClick={() => onConfirm(month)}
          >
            <CalendarDays size={16} />
            生成月报
          </button>
        </footer>
      </section>
    </div>
  );
}
