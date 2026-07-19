import { Copy, Download, ExternalLink, Loader2, X } from "lucide-react";
import type { SupportBundleEntryPreview } from "../model";
import type { SupportBundleSectionProps } from "./SupportBundleDialog.types";

export function SupportBundleDialog(props: SupportBundleSectionProps) {
  const { preview, activeEntry, busy } = props;
  return (
    <div className="dialog-backdrop compact-backdrop support-bundle-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section ref={props.dialogRef} className="range-dialog support-bundle-dialog" role="dialog" aria-modal="true" aria-labelledby="support-bundle-title" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
        <DialogHeader onClose={props.onClose} disabled={busy === "export"} />
        <EntryTabs entries={preview.entries} selected={props.selectedEntry} onSelect={props.onSelectEntry} />
        <EntryPanel entry={activeEntry} index={preview.entries.indexOf(activeEntry)} />
        <Disclosure items={preview.excludedData} />
        <IssuePreview body={preview.issueBody} />
        <Confirmation checked={props.confirmed} onChange={props.onConfirm} />
        {props.feedback && <SupportFeedback feedback={props.feedback} />}
        <DialogFooter {...props} />
      </section>
    </div>
  );
}

function DialogHeader({ onClose, disabled }: { onClose: () => void; disabled: boolean }) {
  return (
    <header className="range-dialog-header">
      <div><p className="kicker">Local Support Snapshot</p><h2 id="support-bundle-title">检查支持包内容</h2></div>
      <button type="button" className="icon-button" onClick={onClose} disabled={disabled} aria-label="关闭支持包预览" title="关闭"><X size={17} /></button>
    </header>
  );
}

function EntryTabs({ entries, selected, onSelect }: { entries: SupportBundleEntryPreview[]; selected: string; onSelect: (name: string) => void }) {
  return (
    <div className="support-bundle-entry-tabs" role="tablist" aria-label="支持包文件">
      {entries.map((entry, index) => <button key={entry.name} id={`support-entry-tab-${index}`} type="button" role="tab" aria-selected={entry.name === selected} aria-controls="support-entry-panel" data-dialog-initial-focus={entry.name === selected ? "true" : undefined} className={entry.name === selected ? "active" : ""} onClick={() => onSelect(entry.name)}>{entry.name}<span>{formatBytes(entry.bytes)}</span></button>)}
    </div>
  );
}

function EntryPanel({ entry, index }: { entry: SupportBundleEntryPreview; index: number }) {
  return (
    <div id="support-entry-panel" className="support-bundle-entry-panel" role="tabpanel" aria-labelledby={`support-entry-tab-${index}`}>
      <div className="support-bundle-entry-meta"><strong>{entry.name}</strong><span>{entry.description}</span></div>
      <pre tabIndex={0} aria-label={`${entry.name} 脱敏内容`}>{entry.content}</pre>
    </div>
  );
}

function Disclosure({ items }: { items: string[] }) {
  return <div className="support-bundle-disclosure"><strong>不会包含</strong><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function IssuePreview({ body }: { body: string }) {
  return <details className="support-issue-preview"><summary>GitHub Issue 安全摘要</summary><pre>{body}</pre></details>;
}

function Confirmation({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="support-bundle-confirmation"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>我已查看上述三个文件及排除项</span></label>;
}

function DialogFooter(props: SupportBundleSectionProps) {
  return (
    <footer className="range-dialog-actions support-bundle-footer">
      <div>
        <button type="button" className="mapping-import" onClick={props.onCopy}><Copy size={15} />复制摘要</button>
        <button type="button" className="mapping-import" onClick={props.onOpenIssue}><ExternalLink size={15} />打开 GitHub Issue</button>
      </div>
      <button type="button" className="support-bundle-export" onClick={props.onExport} disabled={!props.confirmed || props.busy !== null} aria-busy={props.busy === "export"}>
        {props.busy === "export" ? <Loader2 className="spin" size={15} /> : <Download size={15} />}
        {props.busy === "export" ? "保存中" : "导出 ZIP"}
      </button>
    </footer>
  );
}

function SupportFeedback({ feedback }: { feedback: { tone: "success" | "error"; message: string } }) {
  return <p className={`support-bundle-feedback ${feedback.tone}`} role="status">{feedback.message}</p>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
