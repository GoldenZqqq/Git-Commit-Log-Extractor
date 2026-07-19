import {
  CalendarDays,
  ChevronDown,
  Clipboard,
  FileDown,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { activeTaskLabel, taskCanStart, taskIsActive } from "../hooks/useTaskActivity";
import { usePopover } from "../hooks/useOverlayFocus";
import { convertMarkdownTo, REPORT_FORMAT_PRESETS, type IMFormatPresetId } from "../reportFormat";
import {
  loadBlankDayTipDismissed,
  saveBlankDayTipDismissed,
  type DateRange,
  type PreviewMode,
  type ReportExportFormat,
} from "../model";
import { CustomRangeDialog } from "./CustomRangeDialog";
import { GenerationScopeStrip, formatActiveRange, ReportPeriodControl } from "./WorkbenchControls";
import { PanelTitle } from "./PanelTitle";
import { ReportPolishReviewPanel } from "./ReportPolishReviewPanel";
import { SupplementalItemsEditor } from "./SupplementalItemsEditor";
import type { WorkbenchProps } from "./Workbench.types";
import { WorkbenchAssistRail } from "./WorkbenchAssistRail";
import { MarkdownPreview } from "./MarkdownPreview";

type Props = { workbench: WorkbenchProps };
type AssistPanel = "repos" | "history" | "quality";

export function ReportCanvas({ workbench: props }: Props) {
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [blankDayTipOpen, setBlankDayTipOpen] = useState(() => !loadBlankDayTipDismissed());
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [polishMenuOpen, setPolishMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [copyAsMenuOpen, setCopyAsMenuOpen] = useState(false);
  const [polishExtra, setPolishExtra] = useState("");
  const [activeAssistPanel, setActiveAssistPanel] = useState<AssistPanel>("repos");
  const polishButtonRef = useRef<HTMLButtonElement>(null);
  const polishMenuButtonRef = useRef<HTMLButtonElement>(null);
  const exportMenuButtonRef = useRef<HTMLButtonElement>(null);
  const copyMenuButtonRef = useRef<HTMLButtonElement>(null);
  const hadPolishReviewRef = useRef(false);
  const polishPopoverRef = usePopover({ open: polishMenuOpen, onClose: () => setPolishMenuOpen(false), anchorRef: polishMenuButtonRef, initialFocusSelector: "textarea" });
  const exportPopoverRef = usePopover({ open: exportMenuOpen, onClose: () => setExportMenuOpen(false), anchorRef: exportMenuButtonRef, itemSelector: "[role='menuitem']", initialFocusSelector: "[role='menuitem']" });
  const copyPopoverRef = usePopover({ open: copyAsMenuOpen, onClose: () => setCopyAsMenuOpen(false), anchorRef: copyMenuButtonRef, itemSelector: "[role='menuitem']", initialFocusSelector: "[role='menuitem']" });
  const isGenerating = taskIsActive(props.activeTasks, "generate");
  const isPolishing = taskIsActive(props.activeTasks, "polish");
  const isExporting = taskIsActive(props.activeTasks, "export");
  const isInteracting = taskIsActive(props.activeTasks, "interaction");
  const reviewPending = Boolean(props.polishReview);
  const generateBlocked = reviewPending || !taskCanStart(props.activeTasks, "generate");
  const polishBlocked = reviewPending || !taskCanStart(props.activeTasks, "polish");
  const exportBlocked = reviewPending || !taskCanStart(props.activeTasks, "export");
  const interactionBlocked = !taskCanStart(props.activeTasks, "interaction");
  const enabledRepoCount = props.repos.filter((repo) => !props.disabledRepos.includes(repo.path)).length;
  const activeRangeLabel = formatActiveRange(props.activePreview, props.dailyDate, props.weeklyRange, props.monthlyRange, props.customRange);
  const exportConfigured = props.canExport;
  const activeTaskStatus = activeTaskLabel(props.activeTasks);
  const previewEmptyText = props.activePreview === "monthly"
    ? "暂无月报内容。"
    : props.activePreview === "weekly"
      ? "暂无周报内容。"
      : props.activePreview === "custom"
        ? "请选择时间段生成自定义报告。"
        : "暂无日报内容。";
  const generateButtonLabel = isGenerating
    ? "生成中"
    : props.activePreview === "monthly"
      ? "生成月报"
      : props.activePreview === "weekly"
        ? "生成周报"
        : props.activePreview === "custom"
          ? "生成自定义报告"
          : "生成日报";
  const generateButtonIcon = isGenerating
    ? <Loader2 className="spin" size={15} />
    : props.activePreview === "monthly"
      ? <FileDown size={15} />
      : props.activePreview === "weekly" || props.activePreview === "custom"
        ? <CalendarDays size={15} />
        : <GitBranch size={15} />;
  const exportButtonLabel = isExporting ? "导出中" : exportConfigured ? "导出" : "设置导出";
  const exportButtonTitle = exportConfigured
    ? "导出为 Markdown"
    : props.outputEnabled
      ? "请选择输出目录后再导出报告"
      : "请先开启输出到文件并选择输出目录";
  const extractProgressText = props.extractProgress && !props.extractProgress.done
    ? `提取中 · ${props.extractProgress.completedRepos}/${props.extractProgress.totalRepos} 仓库 · ${props.extractProgress.commitCount} 提交`
    : activeTaskStatus || props.status;

  useEffect(() => {
    if (props.polishReview) hadPolishReviewRef.current = true;
    else if (hadPolishReviewRef.current && !isExporting) {
      hadPolishReviewRef.current = false;
      polishButtonRef.current?.focus();
    }
  }, [isExporting, props.polishReview]);

  useEffect(() => {
    if (!isPreviewExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsPreviewExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPreviewExpanded]);

  function handlePreviewChange(preview: PreviewMode) {
    setPolishMenuOpen(false);
    setExportMenuOpen(false);
    setCopyAsMenuOpen(false);
    props.onPreviewChange(preview);
  }

  function handleGenerate() {
    if (props.activePreview === "monthly") props.onGenerateMonthly(props.monthlyMonth);
    else if (props.activePreview === "weekly") props.onGenerateWeekly();
    else if (props.activePreview === "custom") props.onGenerateCustom(props.customRange);
    else props.onExtract();
  }

  function handleExport(format: ReportExportFormat) {
    setExportMenuOpen(false);
    props.onExport(format);
  }

  function generateCustom(range: DateRange) {
    setCustomDialogOpen(false);
    props.onPreviewChange("custom");
    props.onGenerateCustom(range);
  }

  return (
    <>
      {isPreviewExpanded && <div className="canvas-fullscreen-backdrop" aria-hidden="true" onClick={() => setIsPreviewExpanded(false)} />}
      <div className="studio-grid">
        <section className={`report-canvas ${isPreviewExpanded ? "preview-expanded" : ""}`}>
          <div className="canvas-head">
            <div className="canvas-topline">
              <PanelTitle icon={<Sparkles size={17} />} title="报告预览" meta={props.aiConfigured ? "AI 可润色" : "Markdown 渲染"} />
              <div className="report-switch" aria-label="报告类型切换">
                {(["summary", "weekly", "monthly", "custom"] as PreviewMode[]).map((mode) => (
                  <button key={mode} type="button" aria-pressed={props.activePreview === mode} className={props.activePreview === mode ? "active" : ""} disabled={reviewPending} onClick={() => handlePreviewChange(mode)}>
                    <span>{mode === "summary" ? "Daily" : mode[0].toUpperCase() + mode.slice(1)}</span>
                    {mode === "summary" ? "日报" : mode === "weekly" ? "周报" : mode === "monthly" ? "月报" : "自定义"}
                  </button>
                ))}
              </div>
            </div>
            <div className="canvas-actionbar">
              <div className="canvas-primary-actions">
                <ReportPeriodControl
                  activePreview={props.activePreview}
                  dailyDate={props.dailyDate}
                  weeklyWeek={props.weeklyWeek}
                  weeklyRange={props.weeklyRange}
                  monthlyMonth={props.monthlyMonth}
                  monthlyRange={props.monthlyRange}
                  customRange={props.customRange}
                  periodLocked={isGenerating || reviewPending}
                  onDailyDateChange={props.onDailyDateChange}
                  onWeeklyWeekChange={props.onWeeklyWeekChange}
                  onMonthlyMonthChange={props.onMonthlyMonthChange}
                  onOpenCustomRange={() => setCustomDialogOpen(true)}
                />
                <button className="preview-generate-button" type="button" onClick={handleGenerate} disabled={generateBlocked}>{generateButtonIcon}{generateButtonLabel}</button>
                <button className="preview-generate-button" type="button" onClick={props.onOpenBatch} disabled={generateBlocked} title="批量生成多份报告"><Layers size={15} />批量</button>
                {props.activePreview === "summary" && (
                  <div className="blank-day-entry">
                    {blankDayTipOpen && <div className="blank-day-tip" role="status"><span>今天无提交？参考近期工作生成草稿</span><button type="button" className="blank-day-tip-close" aria-label="关闭提示" onClick={() => { setBlankDayTipOpen(false); saveBlankDayTipDismissed(true); }}><XCircle size={13} /></button></div>}
                    <button className={`preview-generate-button blank-day-button ${!props.aiConfigured ? "warning" : ""}`} type="button" onClick={props.onOpenBlankDayFill} disabled={generateBlocked || !props.aiConfigured} title={props.aiConfigured ? "基于近期 Git 线索，生成可编辑的日报延续草稿" : "请先配置 AI"}><Wand2 size={15} />空白日补写</button>
                  </div>
                )}
              </div>
              <div className="canvas-actions-group">
                {props.previewText && <PolishActions
                  props={props}
                  isPolishing={isPolishing}
                  polishBlocked={polishBlocked}
                  polishMenuOpen={polishMenuOpen}
                  setPolishMenuOpen={setPolishMenuOpen}
                  setExportMenuOpen={setExportMenuOpen}
                  setCopyAsMenuOpen={setCopyAsMenuOpen}
                  polishExtra={polishExtra}
                  setPolishExtra={setPolishExtra}
                  polishButtonRef={polishButtonRef}
                  polishMenuButtonRef={polishMenuButtonRef}
                  polishPopoverRef={polishPopoverRef}
                />}
                {props.previewText && <ExportActions
                  props={props}
                  isExporting={isExporting}
                  exportBlocked={exportBlocked}
                  exportConfigured={exportConfigured}
                  exportButtonLabel={exportButtonLabel}
                  exportButtonTitle={exportButtonTitle}
                  exportMenuOpen={exportMenuOpen}
                  exportMenuButtonRef={exportMenuButtonRef}
                  exportPopoverRef={exportPopoverRef}
                  setExportMenuOpen={setExportMenuOpen}
                  setPolishMenuOpen={setPolishMenuOpen}
                  setCopyAsMenuOpen={setCopyAsMenuOpen}
                  onExport={handleExport}
                />}
                <CopyActions
                  props={props}
                  isInteracting={isInteracting}
                  interactionBlocked={interactionBlocked}
                  copyAsMenuOpen={copyAsMenuOpen}
                  copyMenuButtonRef={copyMenuButtonRef}
                  copyPopoverRef={copyPopoverRef}
                  setCopyAsMenuOpen={setCopyAsMenuOpen}
                  setPolishMenuOpen={setPolishMenuOpen}
                  setExportMenuOpen={setExportMenuOpen}
                />
              </div>
            </div>
            <SupplementalItemsEditor value={props.supplementalItemsText} disabled={isGenerating || isPolishing || reviewPending} onChange={props.onSupplementalItemsChange} />
            <GenerationScopeStrip activePreview={props.activePreview} rangeLabel={activeRangeLabel} author={props.author} enabledRepoCount={enabledRepoCount} totalRepoCount={props.repos.length} extractAllBranches={props.extractAllBranches} showEvidenceDetails={props.showEvidenceDetails} redactionEnabled={props.redactionEnabled} outputEnabled={props.outputEnabled} outputDir={props.outputDir} />
          </div>
          <div className="preview-shell">
            {props.polishReview ? <ReportPolishReviewPanel review={props.polishReview} accepting={isExporting} onAccept={props.onAcceptPolishReview} onReject={props.onRejectPolishReview} /> : isGenerating ? <div className="preview-loading"><Loader2 className="spin" size={32} /><p>{extractProgressText}</p></div> : <MarkdownPreview markdown={props.previewText} emptyText={previewEmptyText} />}
            <button className="preview-expand-button" type="button" onClick={() => setIsPreviewExpanded((current) => !current)} aria-label={isPreviewExpanded ? "退出预览全屏" : "全屏查看预览"} title={isPreviewExpanded ? "退出全屏" : "全屏查看"}>{isPreviewExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          </div>
        </section>
        <WorkbenchAssistRail workbench={props} activePanel={activeAssistPanel} enabledRepoCount={enabledRepoCount} hasQualityPanel={Boolean(props.previewText && props.commitCount > 0)} isRepoScanning={taskIsActive(props.activeTasks, "scan")} scanBlocked={!taskCanStart(props.activeTasks, "scan")} generateBlocked={generateBlocked} reviewPending={reviewPending} onPanelChange={setActiveAssistPanel} />
      </div>
      <CustomRangeDialog open={customDialogOpen} initialRange={props.customRange} generationBlocked={generateBlocked} onClose={() => setCustomDialogOpen(false)} onConfirm={generateCustom} />
    </>
  );
}

type PolishActionsProps = {
  props: WorkbenchProps;
  isPolishing: boolean;
  polishBlocked: boolean;
  polishMenuOpen: boolean;
  setPolishMenuOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  setExportMenuOpen: (value: boolean) => void;
  setCopyAsMenuOpen: (value: boolean) => void;
  polishExtra: string;
  setPolishExtra: (value: string) => void;
  polishButtonRef: RefObject<HTMLButtonElement | null>;
  polishMenuButtonRef: RefObject<HTMLButtonElement | null>;
  polishPopoverRef: RefObject<HTMLDivElement | null>;
};

function PolishActions({ props, isPolishing, polishBlocked, polishMenuOpen, setPolishMenuOpen, setExportMenuOpen, setCopyAsMenuOpen, polishExtra, setPolishExtra, polishButtonRef, polishMenuButtonRef, polishPopoverRef }: PolishActionsProps) {
  return <div className="polish-split">
    <button ref={polishButtonRef} className={`preview-polish-button ${!props.aiConfigured ? "warning" : ""}`} type="button" onClick={() => props.onPolish()} disabled={polishBlocked || !props.aiConfigured} title={props.aiConfigured ? "使用 AI 润色当前报告" : "请在设置中配置 AI"}>{isPolishing ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}{isPolishing ? "润色中" : "AI润色"}</button>
    <button ref={polishMenuButtonRef} className={`polish-split-toggle ${!props.aiConfigured ? "warning" : ""}`} type="button" onClick={() => { setExportMenuOpen(false); setCopyAsMenuOpen(false); setPolishMenuOpen((current) => !current); }} disabled={polishBlocked || !props.aiConfigured} aria-expanded={polishMenuOpen} aria-haspopup="dialog" aria-controls="polish-extra-popover" aria-label="带本次额外要求润色" title="带本次额外要求润色"><ChevronDown size={14} /></button>
    {polishMenuOpen && <div ref={polishPopoverRef} id="polish-extra-popover" className="polish-popover" role="dialog" aria-label="本次额外要求"><span className="polish-popover-label">本次额外要求（可选）</span><textarea className="polish-popover-input" value={polishExtra} autoFocus onChange={(event) => setPolishExtra(event.target.value)} placeholder="例如：这次用英文 / 更精简 / 重点突出修复" /><div className="polish-popover-actions"><button type="button" className="polish-popover-cancel" onClick={() => setPolishMenuOpen(false)}>取消</button><button type="button" className="polish-popover-submit" onClick={() => { props.onPolish(polishExtra.trim()); setPolishExtra(""); setPolishMenuOpen(false); }} disabled={polishBlocked || !props.aiConfigured}><Sparkles size={14} />带要求润色</button></div></div>}
  </div>;
}

type ExportActionsProps = {
  props: WorkbenchProps;
  isExporting: boolean;
  exportBlocked: boolean;
  exportConfigured: boolean;
  exportButtonLabel: string;
  exportButtonTitle: string;
  exportMenuOpen: boolean;
  exportMenuButtonRef: RefObject<HTMLButtonElement | null>;
  exportPopoverRef: RefObject<HTMLDivElement | null>;
  setExportMenuOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  setPolishMenuOpen: (value: boolean) => void;
  setCopyAsMenuOpen: (value: boolean) => void;
  onExport: (format: ReportExportFormat) => void;
};

function ExportActions({ isExporting, exportBlocked, exportConfigured, exportButtonLabel, exportButtonTitle, exportMenuOpen, exportMenuButtonRef, exportPopoverRef, setExportMenuOpen, setPolishMenuOpen, setCopyAsMenuOpen, onExport }: ExportActionsProps) {
  return <div className={`export-split ${exportConfigured ? "has-menu" : "needs-setup"}`}>
    <button className="preview-save-button" type="button" onClick={() => onExport("markdown")} disabled={exportBlocked} title={exportButtonTitle}>{isExporting ? <Loader2 className="spin" size={15} /> : <FileDown size={15} />}{exportButtonLabel}</button>
    {exportConfigured && <><button ref={exportMenuButtonRef} className="export-split-toggle" type="button" onClick={() => { setPolishMenuOpen(false); setCopyAsMenuOpen(false); setExportMenuOpen((current) => !current); }} disabled={exportBlocked} aria-expanded={exportMenuOpen} aria-haspopup="menu" aria-controls="report-export-menu" aria-label="选择导出格式" title="选择导出格式"><ChevronDown size={14} /></button>{exportMenuOpen && <div ref={exportPopoverRef} id="report-export-menu" className="export-popover" role="menu" aria-label="导出格式">{(["markdown", "docx", "pdf"] as ReportExportFormat[]).map((format) => <button key={format} type="button" className="export-option" role="menuitem" onClick={() => onExport(format)}><FileText size={15} /><span><strong>{format === "markdown" ? "Markdown" : format === "docx" ? "Word 文档" : "PDF"}</strong><em>{format === "markdown" ? ".md · 适合复制和继续编辑" : format === "docx" ? ".docx · 适合提交和归档" : ".pdf · 适合发送和留档"}</em></span></button>)}</div>}</>}
  </div>;
}

type CopyActionsProps = {
  props: WorkbenchProps;
  isInteracting: boolean;
  interactionBlocked: boolean;
  copyAsMenuOpen: boolean;
  copyMenuButtonRef: RefObject<HTMLButtonElement | null>;
  copyPopoverRef: RefObject<HTMLDivElement | null>;
  setCopyAsMenuOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  setPolishMenuOpen: (value: boolean) => void;
  setExportMenuOpen: (value: boolean) => void;
};

function CopyActions({ props, isInteracting, interactionBlocked, copyAsMenuOpen, copyMenuButtonRef, copyPopoverRef, setCopyAsMenuOpen, setPolishMenuOpen, setExportMenuOpen }: CopyActionsProps) {
  return <div className="copy-split">
    <button className="preview-copy-button" type="button" onClick={props.onCopy} disabled={!props.previewText || interactionBlocked}>{isInteracting ? <Loader2 className="spin" size={15} /> : <Clipboard size={15} />}{isInteracting ? "复制中" : "复制"}</button>
    {props.previewText && <><button ref={copyMenuButtonRef} className="copy-split-toggle" type="button" onClick={() => { setPolishMenuOpen(false); setExportMenuOpen(false); setCopyAsMenuOpen((current) => !current); }} disabled={interactionBlocked} aria-expanded={copyAsMenuOpen} aria-haspopup="menu" aria-controls="report-copy-menu" aria-label="复制为其他格式" title="复制为其他格式"><ChevronDown size={14} /></button>{copyAsMenuOpen && <div ref={copyPopoverRef} id="report-copy-menu" className="copy-as-popover" role="menu" aria-label="复制格式">{REPORT_FORMAT_PRESETS.filter((p) => p.id !== "default").map((preset) => <button key={preset.id} type="button" className="export-option" role="menuitem" onClick={() => { const converted = convertMarkdownTo(props.previewText, preset.id as IMFormatPresetId); navigator.clipboard.writeText(converted); setCopyAsMenuOpen(false); }}><Clipboard size={15} /><span><strong>{preset.name}</strong><em>{preset.description}</em></span></button>)}</div>}</>}
  </div>;
}
