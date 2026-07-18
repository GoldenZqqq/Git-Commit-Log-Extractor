import { ClipboardPlus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  MAX_SUPPLEMENTAL_ITEM_CHARS,
  MAX_SUPPLEMENTAL_ITEMS,
  parseSupplementalItems,
  supplementalItemsIssue,
} from "../supplementalItems";

type Props = {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
};

export function SupplementalItemsEditor({ value, disabled, onChange }: Props) {
  const [expanded, setExpanded] = useState(Boolean(value.trim()));
  const issue = supplementalItemsIssue(value);
  const count = safeItemCount(value);

  useEffect(() => {
    if (value.trim()) setExpanded(true);
  }, [value]);

  return (
    <section className={`supplemental-items-editor ${expanded ? "is-expanded" : ""}`} aria-label="非 Git 工作补充">
      <button
        type="button"
        className="supplemental-items-toggle"
        aria-expanded={expanded}
        aria-label={expanded ? "收起补充事项" : "展开补充事项"}
        onClick={() => setExpanded((current) => !current)}
      >
        <ClipboardPlus size={15} />
        <span>补充事项</span>
        <em>{count > 0 ? `${count} 项` : "非 Git 工作"}</em>
      </button>
      {expanded && (
        <div className="supplemental-items-body">
          <label htmlFor="supplemental-items-input">补充事项（非 Git）</label>
          <textarea
            id="supplemental-items-input"
            value={value}
            disabled={disabled}
            aria-invalid={Boolean(issue)}
            aria-describedby="supplemental-items-help"
            placeholder="每行一项，例如：参与支付联调并确认回退路径"
            onChange={(event) => onChange(event.target.value)}
          />
          <div className="supplemental-items-footer" id="supplemental-items-help">
            <span className={issue ? "has-error" : ""}>
              {issue || `作为你提供的事实加入当前报告；最多 ${MAX_SUPPLEMENTAL_ITEMS} 项，每项 ${MAX_SUPPLEMENTAL_ITEM_CHARS} 字。`}
            </span>
            {value.trim() && (
              <button type="button" disabled={disabled} onClick={() => onChange("")}>
                <Trash2 size={13} />
                清空
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function safeItemCount(value: string) {
  try {
    return parseSupplementalItems(value).length;
  } catch {
    return value.split(/\r?\n/).filter((item) => item.trim()).length;
  }
}
