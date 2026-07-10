import {
  Activity,
  AlertCircle,
  CalendarDays,
  ChevronDown,
  Clipboard,
  FileDown,
  FileText,
  FolderPlus,
  GitBranch,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  TerminalSquare,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  resolveRepoDisplayName,
  type CommitExtractProgress,
  type DateRange,
  type PreviewMode,
  type ReportExportFormat,
  type ReportHistoryEntry,
  type RepoInfo,
  type RepoScanProgress,
} from "../model";
import { convertMarkdownTo, REPORT_FORMAT_PRESETS, type IMFormatPresetId } from "../reportFormat";
import { type HeatmapResult } from "./ContributionHeatmap";
import { CustomRangeDialog } from "./CustomRangeDialog";
import { InsightsView } from "./InsightsView";
import { MarkdownPreview } from "./MarkdownPreview";
import { ReportQualityPanel } from "./ReportQualityPanel";
import { type TrendResult } from "./TrendPanel";
import { type WorkRhythmResult } from "./WorkRhythmPanel";

type Props = {
  repos: RepoInfo[];
  previewText: string;
  activePreview: PreviewMode;
  status: string;
  warnings: string[];
  isBusy: boolean;
  isRepoScanning: boolean;
  scanProgress: RepoScanProgress | null;
  extractProgress: CommitExtractProgress | null;
  lastOutputFile: string;
  summaryText: string;
  reportHistory: ReportHistoryEntry[];
  activeHistoryId: string;
  repoCount: number;
  commitCount: number;
  projectCount: number;
  author: string;
  dailyDate: string;
  onDailyDateChange: (date: string) => void;
  weeklyRange: DateRange;
  weeklyWeek: string;
  onWeeklyWeekChange: (week: string) => void;
  monthlyMonth: string;
  onMonthlyMonthChange: (month: string) => void;
  monthlyRange: DateRange;
  customRange: DateRange;
  aiConfigured: boolean;
  extractAllBranches: boolean;
  showEvidenceDetails: boolean;
  redactionEnabled: boolean;
  outputEnabled: boolean;
  outputDir: string;
  onExtract: () => void;
  onGenerateWeekly: () => void;
  onGenerateCustom: (range: DateRange) => void;
  onGenerateMonthly: (month: string) => void;
  onPolish: (extraInstruction?: string) => void;
  onCopy: () => void;
  onExport: (format: ReportExportFormat) => void;
  onOpenHistory: (entry: ReportHistoryEntry) => void;
  onCopyHistory: (entry: ReportHistoryEntry) => void;
  onRegenerateHistory: (entry: ReportHistoryEntry) => void;
  onClearHistory: () => void;
  canExport: boolean;
  disabledRepos: string[];
  projectNames: Record<string, string>;
  onToggleRepo: (path: string, enabled: boolean) => void;
  onEditRepo: (repo: RepoInfo) => void;
  onRefreshRepos: () => void;
  onCancelRepoScan: () => void;
  onPreviewChange: (preview: PreviewMode) => void;
  onOpenSettings: () => void;
  rootDirs: string[];
  onAddRootDirs: () => void;
};

type AssistPanel = "repos" | "history" | "quality";

type WorkbenchView = "report" | "insights";

export function Workbench(props: Props) {
  const previewMeta = props.aiConfigured ? "AI 可润色" : "Markdown 渲染";
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [polishMenuOpen, setPolishMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [copyAsMenuOpen, setCopyAsMenuOpen] = useState(false);
  const [polishExtra, setPolishExtra] = useState("");
  const [activeAssistPanel, setActiveAssistPanel] = useState<AssistPanel>("repos");
  const [workbenchView, setWorkbenchView] = useState<WorkbenchView>("report");
  const [heatmapData, setHeatmapData] = useState<HeatmapResult | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [rhythmData, setRhythmData] = useState<WorkRhythmResult | null>(null);
  const [rhythmLoading, setRhythmLoading] = useState(false);
  const [trendData, setTrendData] = useState<TrendResult | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendGranularity, setTrendGranularity] = useState<"weekly" | "monthly">("weekly");

  const loadHeatmapData = useCallback(() => {
    if (heatmapLoading) return;
    setHeatmapLoading(true);
    invoke<HeatmapResult>("get_heatmap_data", {
      options: {
        workspaceRoots: props.rootDirs,
        author: props.author,
        weeks: 52,
      },
    })
      .then((result) => setHeatmapData(result))
      .catch(() => setHeatmapData(null))
      .finally(() => setHeatmapLoading(false));

    if (!rhythmLoading) {
      setRhythmLoading(true);
      invoke<WorkRhythmResult>("get_work_rhythm", {
        options: {
          workspaceRoots: props.rootDirs,
          author: props.author,
        },
      })
        .then((result) => setRhythmData(result))
        .catch(() => setRhythmData(null))
        .finally(() => setRhythmLoading(false));
    }
  }, [props.rootDirs, props.author, heatmapLoading, rhythmLoading]);

  const loadTrendData = useCallback((granularity: "weekly" | "monthly") => {
    if (trendLoading) return;
    setTrendLoading(true);
    invoke<TrendResult>("get_trend_data", {
      options: {
        workspaceRoots: props.rootDirs,
        author: props.author,
        granularity,
        periods: granularity === "weekly" ? 12 : 6,
      },
    })
      .then((result) => setTrendData(result))
      .catch(() => setTrendData(null))
      .finally(() => setTrendLoading(false));
  }, [props.rootDirs, props.author, trendLoading]);

  const loadAllInsightsData = useCallback(() => {
    loadHeatmapData();
    loadTrendData(trendGranularity);
  }, [loadHeatmapData, loadTrendData, trendGranularity]);

  const refreshInsightsData = useCallback(() => {
    setHeatmapData(null);
    setRhythmData(null);
    setTrendData(null);
    setHeatmapLoading(false);
    setRhythmLoading(false);
    setTrendLoading(false);
    setTimeout(() => loadAllInsightsData(), 0);
  }, [loadAllInsightsData]);

  function handleViewChange(view: WorkbenchView) {
    setWorkbenchView(view);
    if (view === "insights" && !heatmapData && !heatmapLoading) {
      loadAllInsightsData();
    }
  }

  useEffect(() => {
    if (!isPreviewExpanded) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsPreviewExpanded(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPreviewExpanded]);

  useEffect(() => {
    if (!polishMenuOpen && !exportMenuOpen && !copyAsMenuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPolishMenuOpen(false);
        setExportMenuOpen(false);
        setCopyAsMenuOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [polishMenuOpen, exportMenuOpen, copyAsMenuOpen]);

  function handlePreviewChange(preview: PreviewMode) {
    props.onPreviewChange(preview);
  }

  function generateCustom(range: DateRange) {
    setCustomDialogOpen(false);
    props.onPreviewChange("custom");
    props.onGenerateCustom(range);
  }

  function handleGenerate() {
    if (props.activePreview === "monthly") {
      props.onGenerateMonthly(props.monthlyMonth);
    } else if (props.activePreview === "weekly") {
      props.onGenerateWeekly();
    } else if (props.activePreview === "custom") {
      props.onGenerateCustom(props.customRange);
    } else {
      props.onExtract();
    }
  }

  function handleExport(format: ReportExportFormat) {
    setExportMenuOpen(false);
    props.onExport(format);
  }

  const previewEmptyText = props.activePreview === "monthly"
    ? "暂无月报内容。"
    : props.activePreview === "weekly"
      ? "暂无周报内容。"
      : props.activePreview === "custom"
        ? "请选择时间段生成自定义报告。"
        : "暂无日报内容。";
  const generateButtonLabel = props.activePreview === "monthly"
    ? "生成月报"
    : props.activePreview === "weekly"
      ? "生成周报"
      : props.activePreview === "custom"
        ? "生成自定义报告"
        : "生成日报";
  const generateButtonIcon = props.activePreview === "monthly" ? <FileDown size={15} /> : props.activePreview === "weekly" || props.activePreview === "custom" ? <CalendarDays size={15} /> : <GitBranch size={15} />;
  const enabledRepoCount = props.repos.filter((repo) => !props.disabledRepos.includes(repo.path)).length;
  const activeRangeLabel = formatActiveRange(props.activePreview, props.dailyDate, props.weeklyRange, props.monthlyRange, props.customRange);
  const exportConfigured = props.canExport;
  const exportButtonLabel = exportConfigured ? "导出" : "设置导出";
  const exportButtonTitle = exportConfigured
    ? "导出为 Markdown"
    : props.outputEnabled
      ? "请选择输出目录后再导出报告"
      : "请先开启输出到文件并选择输出目录";
  const repoMeta = enabledRepoCount === props.repos.length
    ? `${props.repos.length} repos`
    : `${enabledRepoCount}/${props.repos.length} repos`;
  const scanProgressText = props.scanProgress
    ? `已检查 ${props.scanProgress.scannedDirs} 个目录 · 发现 ${props.scanProgress.foundRepos} 个仓库`
    : "";
  const extractProgressText = props.extractProgress && !props.extractProgress.done
    ? `${props.extractProgress.completedRepos}/${props.extractProgress.totalRepos} 仓库 · ${props.extractProgress.concurrency} 并发 · ${props.extractProgress.commitCount} 条提交`
    : props.status;
  const emptyReportAdvice = props.previewText && props.commitCount === 0
    ? buildEmptyReportAdvice({
      activePreview: props.activePreview,
      dailyDate: props.dailyDate,
      weeklyRange: props.weeklyRange,
      monthlyRange: props.monthlyRange,
      customRange: props.customRange,
      author: props.author,
      enabledRepoCount,
    })
    : null;
  const hasQualityPanel = Boolean(props.previewText && props.commitCount > 0);
  const visibleAssistPanel = activeAssistPanel === "quality" && !hasQualityPanel ? "repos" : activeAssistPanel;

  return (
    <section className="workbench">
      {isPreviewExpanded && (
        <div
          className="canvas-fullscreen-backdrop"
          aria-hidden="true"
          onClick={() => setIsPreviewExpanded(false)}
        />
      )}
      <header className="hero-band">
        <div className="hero-copy">
          <div className="brand-logo hero-brand" role="img" aria-label="GitPulse" />
          <h2>工作报告工作台</h2>
          <p className="hero-subcopy">本地 Git 数据源 · 日报可选单日 · 周报可选周次 · 月报可选月份 · 自定义可选周期</p>
        </div>
        <div className="hero-aside">
          <div className="hero-actions">
            <div className="run-status">
              {props.isBusy && <Loader2 className="spin" size={16} />}
              <span>{props.status}</span>
            </div>
            <button className="settings-trigger" type="button" onClick={props.onOpenSettings} aria-label="打开设置">
              <Settings2 size={16} />
              设置
            </button>
          </div>
          <div className="context-chips" aria-label="当前工作区上下文">
            <button type="button" className="context-chip" onClick={props.onOpenSettings} title="在设置中修改统计作者">
              <UserRound size={13} />
              {formatAuthorScope(props.author)}
            </button>
          </div>
          <div className="quick-stats" aria-label="当前结果概览">
            <span><strong>{props.repoCount}</strong> 仓库</span>
            <span><strong>{props.commitCount}</strong> 提交</span>
            <span><strong>{props.lastOutputFile ? "已生成" : "待生成"}</strong> 输出</span>
          </div>
        </div>
      </header>

      <div className="workbench-view-tabs" role="tablist" aria-label="工作台视图">
        <button
          type="button"
          role="tab"
          aria-selected={workbenchView === "report"}
          className={workbenchView === "report" ? "active" : ""}
          onClick={() => handleViewChange("report")}
        >
          <FileText size={14} />
          报告
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={workbenchView === "insights"}
          className={workbenchView === "insights" ? "active" : ""}
          onClick={() => handleViewChange("insights")}
        >
          <Activity size={14} />
          洞察
        </button>
      </div>

      {workbenchView === "report" ? (
      <div className="studio-grid">
        <section className={`report-canvas ${isPreviewExpanded ? "preview-expanded" : ""}`}>
          <div className="canvas-head">
            <div className="canvas-topline">
              <PanelTitle icon={<Sparkles size={17} />} title="报告预览" meta={previewMeta} />
              <div className="report-switch" aria-label="报告类型切换">
                <button type="button" aria-pressed={props.activePreview === "summary"} className={props.activePreview === "summary" ? "active" : ""} onClick={() => handlePreviewChange("summary")}>
                  <span>Daily</span>
                  日报
                </button>
                <button type="button" aria-pressed={props.activePreview === "weekly"} className={props.activePreview === "weekly" ? "active" : ""} onClick={() => handlePreviewChange("weekly")}>
                  <span>Weekly</span>
                  周报
                </button>
                <button type="button" aria-pressed={props.activePreview === "monthly"} className={props.activePreview === "monthly" ? "active" : ""} onClick={() => handlePreviewChange("monthly")}>
                  <span>Monthly</span>
                  月报
                </button>
                <button type="button" aria-pressed={props.activePreview === "custom"} className={props.activePreview === "custom" ? "active" : ""} onClick={() => handlePreviewChange("custom")}>
                  <span>Custom</span>
                  自定义
                </button>
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
                  isBusy={props.isBusy}
                  onDailyDateChange={props.onDailyDateChange}
                  onWeeklyWeekChange={props.onWeeklyWeekChange}
                  onMonthlyMonthChange={props.onMonthlyMonthChange}
                  onOpenCustomRange={() => setCustomDialogOpen(true)}
                />
                <button className="preview-generate-button" type="button" onClick={handleGenerate} disabled={props.isBusy}>
                  {generateButtonIcon}
                  {generateButtonLabel}
                </button>
              </div>
              <div className="canvas-actions-group">
                {props.previewText && (
                  <div className="polish-split">
                    <button
                      className={`preview-polish-button ${!props.aiConfigured ? "warning" : ""}`}
                      type="button"
                      onClick={() => props.onPolish()}
                      disabled={props.isBusy}
                      title={props.aiConfigured ? "使用 AI 润色当前报告" : "请在设置中配置 AI"}
                    >
                      <Sparkles size={15} />
                      AI润色
                    </button>
                    <button
                      className={`polish-split-toggle ${!props.aiConfigured ? "warning" : ""}`}
                      type="button"
                      onClick={() => setPolishMenuOpen((current) => !current)}
                      disabled={props.isBusy}
                      aria-expanded={polishMenuOpen}
                      aria-label="带本次额外要求润色"
                      title="带本次额外要求润色"
                    >
                      <ChevronDown size={14} />
                    </button>
                    {polishMenuOpen && (
                      <div className="polish-popover" role="dialog" aria-label="本次额外要求">
                        <span className="polish-popover-label">本次额外要求（可选）</span>
                        <textarea
                          className="polish-popover-input"
                          value={polishExtra}
                          autoFocus
                          onChange={(event) => setPolishExtra(event.target.value)}
                          placeholder="例如：这次用英文 / 更精简 / 重点突出修复"
                        />
                        <div className="polish-popover-actions">
                          <button type="button" className="polish-popover-cancel" onClick={() => setPolishMenuOpen(false)}>
                            取消
                          </button>
                          <button
                            type="button"
                            className="polish-popover-submit"
                            onClick={() => {
                              props.onPolish(polishExtra.trim());
                              setPolishExtra("");
                              setPolishMenuOpen(false);
                            }}
                            disabled={props.isBusy}
                          >
                            <Sparkles size={14} />
                            带要求润色
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {props.previewText && (
                  <div className={`export-split ${exportConfigured ? "has-menu" : "needs-setup"}`}>
                    <button className="preview-save-button" type="button" onClick={() => handleExport("markdown")} disabled={props.isBusy} title={exportButtonTitle}>
                      <FileDown size={15} />
                      {exportButtonLabel}
                    </button>
                    {exportConfigured && (
                      <>
                        <button
                          className="export-split-toggle"
                          type="button"
                          onClick={() => setExportMenuOpen((current) => !current)}
                          disabled={props.isBusy}
                          aria-expanded={exportMenuOpen}
                          aria-label="选择导出格式"
                          title="选择导出格式"
                        >
                          <ChevronDown size={14} />
                        </button>
                        {exportMenuOpen && (
                          <div className="export-popover" role="menu" aria-label="导出格式">
                            <button type="button" className="export-option" role="menuitem" onClick={() => handleExport("markdown")}>
                              <FileText size={15} />
                              <span>
                                <strong>Markdown</strong>
                                <em>.md · 适合复制和继续编辑</em>
                              </span>
                            </button>
                            <button type="button" className="export-option" role="menuitem" onClick={() => handleExport("docx")}>
                              <FileText size={15} />
                              <span>
                                <strong>Word 文档</strong>
                                <em>.docx · 适合提交和归档</em>
                              </span>
                            </button>
                            <button type="button" className="export-option" role="menuitem" onClick={() => handleExport("pdf")}>
                              <FileText size={15} />
                              <span>
                                <strong>PDF</strong>
                                <em>.pdf · 适合发送和留档</em>
                              </span>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                <div className="copy-split">
                  <button className="preview-copy-button" type="button" onClick={props.onCopy} disabled={!props.previewText}>
                    <Clipboard size={15} />
                    复制
                  </button>
                  {props.previewText && (
                    <>
                      <button
                        className="copy-split-toggle"
                        type="button"
                        onClick={() => setCopyAsMenuOpen((current) => !current)}
                        disabled={!props.previewText}
                        aria-expanded={copyAsMenuOpen}
                        aria-label="复制为其他格式"
                        title="复制为其他格式"
                      >
                        <ChevronDown size={14} />
                      </button>
                      {copyAsMenuOpen && (
                        <div className="copy-as-popover" role="menu" aria-label="复制格式">
                          {REPORT_FORMAT_PRESETS.filter((p) => p.id !== "default").map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              className="export-option"
                              role="menuitem"
                              onClick={() => {
                                const converted = convertMarkdownTo(props.previewText, preset.id as IMFormatPresetId);
                                navigator.clipboard.writeText(converted);
                                setCopyAsMenuOpen(false);
                              }}
                            >
                              <Clipboard size={15} />
                              <span>
                                <strong>{preset.name}</strong>
                                <em>{preset.description}</em>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            <GenerationScopeStrip
              activePreview={props.activePreview}
              rangeLabel={activeRangeLabel}
              author={props.author}
              enabledRepoCount={enabledRepoCount}
              totalRepoCount={props.repos.length}
              extractAllBranches={props.extractAllBranches}
              showEvidenceDetails={props.showEvidenceDetails}
              redactionEnabled={props.redactionEnabled}
              outputEnabled={props.outputEnabled}
              outputDir={props.outputDir}
            />
          </div>
          <div className="preview-shell">
            {props.isBusy ? (
              <div className="preview-loading">
                <Loader2 className="spin" size={32} />
                <p>{extractProgressText}</p>
              </div>
            ) : (
              <MarkdownPreview markdown={props.previewText} emptyText={previewEmptyText} />
            )}
            <button
              className="preview-expand-button"
              type="button"
              onClick={() => setIsPreviewExpanded((current) => !current)}
              aria-label={isPreviewExpanded ? "退出预览全屏" : "全屏查看预览"}
              title={isPreviewExpanded ? "退出全屏" : "全屏查看"}
            >
              {isPreviewExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </section>

        <aside className="assist-rail" aria-label="辅助工作区">
          <div className="assist-tabs" role="tablist" aria-label="辅助面板">
            <button
              type="button"
              role="tab"
              aria-selected={visibleAssistPanel === "repos"}
              className={visibleAssistPanel === "repos" ? "active" : ""}
              onClick={() => setActiveAssistPanel("repos")}
            >
              <TerminalSquare size={14} />
              仓库
              <span>{enabledRepoCount}/{props.repos.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={visibleAssistPanel === "history"}
              className={visibleAssistPanel === "history" ? "active" : ""}
              onClick={() => setActiveAssistPanel("history")}
            >
              <History size={14} />
              最近
              <span>{props.reportHistory.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={visibleAssistPanel === "quality"}
              className={visibleAssistPanel === "quality" ? "active" : ""}
              disabled={!hasQualityPanel}
              onClick={() => setActiveAssistPanel("quality")}
            >
              <Sparkles size={14} />
              交付
              <span>{hasQualityPanel ? "可查" : "待生成"}</span>
            </button>
          </div>

          <div className="assist-panel">
            {visibleAssistPanel === "repos" && (
              <section className="repo-drawer" aria-label="仓库索引">
                <PanelTitle
                  icon={<TerminalSquare size={17} />}
                  title="仓库索引"
                  meta={repoMeta}
                  action={(
                    <button
                      className="repo-refresh-button"
                      type="button"
                      onClick={props.isRepoScanning ? props.onCancelRepoScan : props.onRefreshRepos}
                      disabled={props.isBusy && !props.isRepoScanning}
                      aria-label={props.isRepoScanning ? "取消仓库扫描" : "重新扫描仓库索引"}
                      title={props.isRepoScanning ? "取消仓库扫描" : "重新扫描仓库索引"}
                    >
                      {props.isRepoScanning ? <XCircle size={14} /> : <RefreshCw size={14} />}
                      {props.isRepoScanning ? "取消扫描" : "重新扫描"}
                    </button>
                  )}
                />
                {props.isRepoScanning && props.scanProgress && (
                  <div className="repo-scan-progress" role="status" aria-live="polite">
                    <div>
                      <Loader2 className="spin" size={14} />
                      <span>{scanProgressText}</span>
                    </div>
                    {props.scanProgress.currentPath && (
                      <span className="repo-scan-path" title={props.scanProgress.currentPath}>
                        {props.scanProgress.currentPath}
                      </span>
                    )}
                  </div>
                )}
                <div className="repo-list">
                  {props.repos.length === 0 && (
                    <RepoEmptyState
                      hasRootDirs={props.rootDirs.length > 0}
                      isBusy={props.isBusy}
                      isRepoScanning={props.isRepoScanning}
                      onAddRootDirs={props.onAddRootDirs}
                      onRefreshRepos={props.onRefreshRepos}
                      onOpenSettings={props.onOpenSettings}
                    />
                  )}
                  {props.repos.map((repo) => {
                    const enabled = !props.disabledRepos.includes(repo.path);
                    const displayName = resolveRepoDisplayName(repo, props.projectNames);
                    const isMapped = displayName !== repo.name;
                    return (
                      <article className={`repo-row ${enabled ? "" : "disabled"}`} key={repo.path}>
                        <label
                          className="repo-toggle"
                          title={enabled ? "已纳入报告，点击排除该仓库" : "已排除，点击重新纳入报告"}
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(event) => props.onToggleRepo(repo.path, event.target.checked)}
                          />
                          <span aria-hidden="true" />
                        </label>
                        <button
                          type="button"
                          className="repo-info"
                          onClick={() => props.onEditRepo(repo)}
                          title="点击编辑项目映射名称"
                        >
                          <strong className="repo-display-name">{displayName}</strong>
                          <span className="repo-meta">
                            {isMapped && <em className="repo-origin">{repo.name}</em>}
                            <em className="repo-branch" title={repo.branch}>{repo.branch}</em>
                          </span>
                          <span className="repo-path">{repo.path}</span>
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {visibleAssistPanel === "history" && (
              <ReportHistoryPanel
                entries={props.reportHistory}
                activeHistoryId={props.activeHistoryId}
                isBusy={props.isBusy}
                onOpen={props.onOpenHistory}
                onCopy={props.onCopyHistory}
                onRegenerate={props.onRegenerateHistory}
                onClear={props.onClearHistory}
              />
            )}

            {visibleAssistPanel === "quality" && hasQualityPanel && (
              <ReportQualityPanel
                commitCount={props.commitCount}
                projectCount={props.projectCount}
                enabledRepoCount={enabledRepoCount}
                totalRepoCount={props.repos.length}
                aiConfigured={props.aiConfigured}
                showEvidenceDetails={props.showEvidenceDetails}
                redactionEnabled={props.redactionEnabled}
                canExport={props.canExport}
              />
            )}
          </div>
        </aside>
      </div>
      ) : (
      <InsightsView
        heatmapData={heatmapData}
        heatmapLoading={heatmapLoading}
        rhythmData={rhythmData}
        rhythmLoading={rhythmLoading}
        trendData={trendData}
        trendLoading={trendLoading}
        trendGranularity={trendGranularity}
        onTrendGranularityChange={(g) => {
          setTrendGranularity(g);
          setTrendData(null);
          loadTrendData(g);
        }}
        onRefresh={refreshInsightsData}
      />
      )}

      {(props.warnings.length > 0 || props.lastOutputFile || emptyReportAdvice) && (
        <footer className="event-log">
          {props.lastOutputFile && <p>输出文件：{props.lastOutputFile}</p>}
          {emptyReportAdvice && (
            <div className="empty-report-advice" role="status" aria-live="polite">
              <div>
                <AlertCircle size={15} />
                <strong>{emptyReportAdvice.title}</strong>
              </div>
              <p>{emptyReportAdvice.scope}</p>
              <ul>
                {emptyReportAdvice.checks.map((check) => <li key={check}>{check}</li>)}
              </ul>
              <div className="empty-report-actions">
                <button type="button" onClick={props.onOpenSettings} disabled={props.isBusy}>
                  检查作者/分支
                </button>
                <button type="button" onClick={props.onRefreshRepos} disabled={props.isBusy || props.isRepoScanning}>
                  重新扫描仓库
                </button>
              </div>
            </div>
          )}
          {props.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </footer>
      )}
      <CustomRangeDialog
        open={customDialogOpen}
        initialRange={props.customRange}
        isBusy={props.isBusy}
        onClose={() => setCustomDialogOpen(false)}
        onConfirm={generateCustom}
      />
    </section>
  );
}

function ReportHistoryPanel({
  entries,
  activeHistoryId,
  isBusy,
  onOpen,
  onCopy,
  onRegenerate,
  onClear,
}: {
  entries: ReportHistoryEntry[];
  activeHistoryId: string;
  isBusy: boolean;
  onOpen: (entry: ReportHistoryEntry) => void;
  onCopy: (entry: ReportHistoryEntry) => void;
  onRegenerate: (entry: ReportHistoryEntry) => void;
  onClear: () => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [kindFilter, setKindFilter] = useState<PreviewMode | "all">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [aiFilter, setAiFilter] = useState<"all" | "ai" | "plain">("all");
  const [exportFilter, setExportFilter] = useState<"all" | "exported" | "pending">("all");
  const hasFilters =
    searchText.trim() !== ""
    || kindFilter !== "all"
    || dateFilter !== ""
    || aiFilter !== "all"
    || exportFilter !== "all";
  const filteredEntries = entries.filter((entry) =>
    historyEntryMatchesFilters(entry, {
      searchText,
      kindFilter,
      dateFilter,
      aiFilter,
      exportFilter,
    }),
  );
  const filters = { searchText, kindFilter, dateFilter, aiFilter, exportFilter };

  function resetFilters() {
    setSearchText("");
    setKindFilter("all");
    setDateFilter("");
    setAiFilter("all");
    setExportFilter("all");
  }

  return (
    <section className="report-history-panel" aria-label="最近生成的报告">
      <PanelTitle
        icon={<History size={17} />}
        title="最近报告"
        meta={entries.length > 0 ? (hasFilters ? `${filteredEntries.length}/${entries.length} 条` : `${entries.length} 条`) : "生成后自动记录"}
        action={(
          <button className="history-clear-button" type="button" onClick={onClear} disabled={entries.length === 0 || isBusy}>
            <Trash2 size={13} />
            清空
          </button>
        )}
      />
      {entries.length === 0 ? (
        <p className="history-empty">生成报告后会在这里保留最近记录，可重新打开、复制或按同一周期重新生成。</p>
      ) : (
        <>
          <HistoryFilterBar
            filters={filters}
            hasFilters={hasFilters}
            onSearchTextChange={setSearchText}
            onKindFilterChange={setKindFilter}
            onDateFilterChange={setDateFilter}
            onAiFilterChange={setAiFilter}
            onExportFilterChange={setExportFilter}
            onReset={resetFilters}
          />
          {filteredEntries.length === 0 ? (
            <p className="history-empty">没有匹配的历史报告，请调整筛选条件。</p>
          ) : (
            <HistoryList
              entries={filteredEntries}
              activeHistoryId={activeHistoryId}
              isBusy={isBusy}
              onOpen={onOpen}
              onCopy={onCopy}
              onRegenerate={onRegenerate}
            />
          )}
        </>
      )}
    </section>
  );
}

function HistoryFilterBar({
  filters,
  hasFilters,
  onSearchTextChange,
  onKindFilterChange,
  onDateFilterChange,
  onAiFilterChange,
  onExportFilterChange,
  onReset,
}: {
  filters: HistoryFilters;
  hasFilters: boolean;
  onSearchTextChange: (value: string) => void;
  onKindFilterChange: (value: PreviewMode | "all") => void;
  onDateFilterChange: (value: string) => void;
  onAiFilterChange: (value: "all" | "ai" | "plain") => void;
  onExportFilterChange: (value: "all" | "exported" | "pending") => void;
  onReset: () => void;
}) {
  return (
    <div className="history-filter-bar" aria-label="筛选历史报告">
      <label className="history-search-field">
        <Search size={13} />
        <input
          type="search"
          value={filters.searchText}
          aria-label="搜索历史报告"
          placeholder="搜索标题、项目或正文"
          onChange={(event) => onSearchTextChange(event.target.value)}
        />
      </label>
      <select value={filters.kindFilter} aria-label="筛选报告类型" onChange={(event) => onKindFilterChange(event.target.value as PreviewMode | "all")}>
        <option value="all">全部类型</option>
        <option value="summary">日报</option>
        <option value="weekly">周报</option>
        <option value="monthly">月报</option>
        <option value="custom">自定义</option>
      </select>
      <input type="date" value={filters.dateFilter} aria-label="筛选历史日期" onChange={(event) => onDateFilterChange(event.target.value)} />
      <select value={filters.aiFilter} aria-label="筛选 AI 状态" onChange={(event) => onAiFilterChange(event.target.value as "all" | "ai" | "plain")}>
        <option value="all">全部 AI</option>
        <option value="ai">AI 润色</option>
        <option value="plain">未润色</option>
      </select>
      <select value={filters.exportFilter} aria-label="筛选导出状态" onChange={(event) => onExportFilterChange(event.target.value as "all" | "exported" | "pending")}>
        <option value="all">全部导出</option>
        <option value="exported">已导出</option>
        <option value="pending">未导出</option>
      </select>
      {hasFilters && (
        <button className="history-filter-reset" type="button" onClick={onReset}>
          <XCircle size={13} />
          重置
        </button>
      )}
    </div>
  );
}

function RepoEmptyState({
  hasRootDirs,
  isBusy,
  isRepoScanning,
  onAddRootDirs,
  onRefreshRepos,
  onOpenSettings,
}: {
  hasRootDirs: boolean;
  isBusy: boolean;
  isRepoScanning: boolean;
  onAddRootDirs: () => void;
  onRefreshRepos: () => void;
  onOpenSettings: () => void;
}) {
  const scanningDisabled = isBusy || isRepoScanning;
  return (
    <section className="repo-empty-state" aria-label="仓库索引为空">
      <div className="repo-empty-icon" aria-hidden="true">
        <TerminalSquare size={18} />
      </div>
      <div className="repo-empty-copy">
        <strong>{hasRootDirs ? "还没有扫描到 Git 仓库" : "先添加仓库根目录"}</strong>
        <p>
          {hasRootDirs
            ? "已配置目录，但当前索引为空。通常是目录层级不对、目录下没有 .git，或扫描还没有重新执行。"
            : "选择存放代码项目的文件夹后，GitPulse 会扫描其中的本地 Git 仓库。"}
        </p>
      </div>
      {hasRootDirs ? (
        <ul className="repo-empty-checks">
          <li>确认选择的是包含项目的上层目录。</li>
          <li>确认项目目录内存在 `.git`。</li>
          <li>移动或新增仓库后请重新扫描。</li>
        </ul>
      ) : (
        <ul className="repo-empty-checks">
          <li>可以选择 `D:\workspace` 这类项目集合目录。</li>
          <li>多个工作区可分次添加。</li>
        </ul>
      )}
      <div className="repo-empty-actions">
        <button type="button" onClick={onAddRootDirs} disabled={isBusy}>
          <FolderPlus size={14} />
          {hasRootDirs ? "添加其他目录" : "添加目录"}
        </button>
        {hasRootDirs ? (
          <button type="button" onClick={onRefreshRepos} disabled={scanningDisabled}>
            <RefreshCw size={14} />
            重新扫描
          </button>
        ) : (
          <button type="button" onClick={onOpenSettings}>
            <Settings2 size={14} />
            打开设置
          </button>
        )}
      </div>
    </section>
  );
}

function HistoryList({
  entries,
  activeHistoryId,
  isBusy,
  onOpen,
  onCopy,
  onRegenerate,
}: {
  entries: ReportHistoryEntry[];
  activeHistoryId: string;
  isBusy: boolean;
  onOpen: (entry: ReportHistoryEntry) => void;
  onCopy: (entry: ReportHistoryEntry) => void;
  onRegenerate: (entry: ReportHistoryEntry) => void;
}) {
  return (
    <div className="history-list">
      {entries.map((entry) => (
        <HistoryRow
          key={entry.id}
          entry={entry}
          active={entry.id === activeHistoryId}
          isBusy={isBusy}
          onOpen={onOpen}
          onCopy={onCopy}
          onRegenerate={onRegenerate}
        />
      ))}
    </div>
  );
}

function HistoryRow({
  entry,
  active,
  isBusy,
  onOpen,
  onCopy,
  onRegenerate,
}: {
  entry: ReportHistoryEntry;
  active: boolean;
  isBusy: boolean;
  onOpen: (entry: ReportHistoryEntry) => void;
  onCopy: (entry: ReportHistoryEntry) => void;
  onRegenerate: (entry: ReportHistoryEntry) => void;
}) {
  return (
    <article className={`history-row ${active ? "active" : ""}`}>
      <button className="history-open-button" type="button" onClick={() => onOpen(entry)} aria-pressed={active} title="打开这份历史报告">
        <span className="history-kind">{getHistoryKindLabel(entry.mode)}</span>
        <span className="history-mainline">
          <strong>{entry.title}</strong>
          {entry.aiEnhanced && <em className="history-badge ai">AI</em>}
          {entry.outputFile && <em className="history-badge exported">已导出</em>}
        </span>
        <span className="history-subline">{formatHistoryTime(entry.generatedAt)} · {formatHistoryRange(entry)}</span>
      </button>
      <div className="history-stats" aria-label="历史报告统计">
        <span>{entry.repoCount} 仓库</span>
        <span>{entry.commitCount} 提交</span>
      </div>
      <div className="history-actions">
        <button type="button" onClick={() => onCopy(entry)} title="复制历史报告">
          <Clipboard size={13} />
          复制
        </button>
        <button type="button" onClick={() => onRegenerate(entry)} disabled={isBusy} title="按该周期重新生成">
          <RotateCcw size={13} />
          重跑
        </button>
      </div>
    </article>
  );
}

type HistoryFilters = {
  searchText: string;
  kindFilter: PreviewMode | "all";
  dateFilter: string;
  aiFilter: "all" | "ai" | "plain";
  exportFilter: "all" | "exported" | "pending";
};

function historyEntryMatchesFilters(entry: ReportHistoryEntry, filters: HistoryFilters) {
  if (filters.kindFilter !== "all" && entry.mode !== filters.kindFilter) return false;
  if (filters.dateFilter && !historyEntryIncludesDate(entry, filters.dateFilter)) return false;
  if (filters.aiFilter === "ai" && !entry.aiEnhanced) return false;
  if (filters.aiFilter === "plain" && entry.aiEnhanced) return false;
  if (filters.exportFilter === "exported" && !entry.outputFile) return false;
  if (filters.exportFilter === "pending" && entry.outputFile) return false;

  const query = normalizeHistorySearch(filters.searchText);
  if (!query) return true;
  return [
    entry.title,
    entry.periodLabel,
    entry.outputFile,
    entry.reportText,
    entry.range.startDate,
    entry.range.endDate,
    getHistoryKindLabel(entry.mode),
  ]
    .map(normalizeHistorySearch)
    .some((value) => value.includes(query));
}

function historyEntryIncludesDate(entry: ReportHistoryEntry, date: string) {
  if (entry.generatedAt.startsWith(date)) return true;
  return entry.range.startDate <= date && date <= entry.range.endDate;
}

function normalizeHistorySearch(value: string) {
  return value.trim().toLowerCase();
}

function ReportPeriodControl({
  activePreview,
  dailyDate,
  weeklyWeek,
  weeklyRange,
  monthlyMonth,
  monthlyRange,
  customRange,
  isBusy,
  onDailyDateChange,
  onWeeklyWeekChange,
  onMonthlyMonthChange,
  onOpenCustomRange,
}: {
  activePreview: PreviewMode;
  dailyDate: string;
  weeklyWeek: string;
  weeklyRange: DateRange;
  monthlyMonth: string;
  monthlyRange: DateRange;
  customRange: DateRange;
  isBusy: boolean;
  onDailyDateChange: (date: string) => void;
  onWeeklyWeekChange: (week: string) => void;
  onMonthlyMonthChange: (month: string) => void;
  onOpenCustomRange: () => void;
}) {
  const rangeLabel = activePreview === "weekly"
    ? `${weeklyRange.startDate} ~ ${weeklyRange.endDate}`
    : activePreview === "monthly"
      ? `${monthlyRange.startDate} ~ ${monthlyRange.endDate}`
      : activePreview === "custom"
        ? `${customRange.startDate} ~ ${customRange.endDate}`
        : dailyDate;

  return (
    <div className="report-period-control" aria-label="报告周期选择">
      <span className="period-label">
        <CalendarDays size={14} />
        周期
      </span>
      {activePreview === "summary" && (
        <input
          type="date"
          value={dailyDate}
          disabled={isBusy}
          aria-label="选择日报日期"
          onChange={(event) => event.target.value && onDailyDateChange(event.target.value)}
        />
      )}
      {activePreview === "weekly" && (
        <input
          type="week"
          value={weeklyWeek}
          disabled={isBusy}
          aria-label="选择周报周次"
          onChange={(event) => event.target.value && onWeeklyWeekChange(event.target.value)}
        />
      )}
      {activePreview === "monthly" && (
        <input
          type="month"
          value={monthlyMonth}
          disabled={isBusy}
          aria-label="选择月报月份"
          onChange={(event) => event.target.value && onMonthlyMonthChange(event.target.value)}
        />
      )}
      {activePreview === "custom" && (
        <button
          className="period-range-button"
          type="button"
          disabled={isBusy}
          onClick={onOpenCustomRange}
        >
          {rangeLabel}
        </button>
      )}
      {activePreview !== "summary" && activePreview !== "custom" && (
        <span className="period-range-label">{rangeLabel}</span>
      )}
    </div>
  );
}

function GenerationScopeStrip({
  activePreview,
  rangeLabel,
  author,
  enabledRepoCount,
  totalRepoCount,
  extractAllBranches,
  showEvidenceDetails,
  redactionEnabled,
  outputEnabled,
  outputDir,
}: {
  activePreview: PreviewMode;
  rangeLabel: string;
  author: string;
  enabledRepoCount: number;
  totalRepoCount: number;
  extractAllBranches: boolean;
  showEvidenceDetails: boolean;
  redactionEnabled: boolean;
  outputEnabled: boolean;
  outputDir: string;
}) {
  const exportConfigured = outputEnabled && Boolean(outputDir.trim());
  return (
    <div className="generation-scope-strip" aria-label="当前生成范围">
      <ScopeItem label="周期" value={`${getHistoryKindLabel(activePreview)} · ${rangeLabel}`} />
      <ScopeItem label="作者" value={formatAuthorValue(author)} />
      <ScopeItem label="仓库" value={formatRepoScope(enabledRepoCount, totalRepoCount)} tone={enabledRepoCount === 0 ? "attention" : "default"} />
      <ScopeItem label="分支" value={extractAllBranches ? "全部分支" : "当前分支"} />
      <ScopeItem label="证据" value={showEvidenceDetails ? "显示" : "未显示"} />
      <ScopeItem label="脱敏" value={redactionEnabled ? "已启用" : "未启用"} tone={redactionEnabled ? "default" : "attention"} />
      <ScopeItem
        label="导出"
        value={formatOutputScope(outputEnabled, outputDir)}
        tone={exportConfigured ? "default" : "attention"}
        title={exportConfigured ? outputDir : "需要在设置中开启输出并选择目录"}
      />
    </div>
  );
}

function ScopeItem({
  label,
  value,
  tone = "default",
  title,
}: {
  label: string;
  value: string;
  tone?: "default" | "attention";
  title?: string;
}) {
  return (
    <span className={`generation-scope-item ${tone}`} title={title}>
      <span className="generation-scope-label">{label}</span>
      <span className="generation-scope-value">{value}</span>
    </span>
  );
}

function getHistoryKindLabel(mode: PreviewMode) {
  if (mode === "monthly") return "月报";
  if (mode === "weekly") return "周报";
  if (mode === "custom") return "自定义";
  return "日报";
}

function buildEmptyReportAdvice({
  activePreview,
  dailyDate,
  weeklyRange,
  monthlyRange,
  customRange,
  author,
  enabledRepoCount,
}: {
  activePreview: PreviewMode;
  dailyDate: string;
  weeklyRange: DateRange;
  monthlyRange: DateRange;
  customRange: DateRange;
  author: string;
  enabledRepoCount: number;
}) {
  return {
    title: "本次报告没有匹配到提交",
    scope: `${getHistoryKindLabel(activePreview)} · ${formatActiveRange(activePreview, dailyDate, weeklyRange, monthlyRange, customRange)} · ${formatAuthorScope(author)} · ${enabledRepoCount} 个启用仓库`,
    checks: [
      "确认周期覆盖了真实提交时间，尤其是周报/月报跨月边界。",
      "若已填写作者，请核对 Git name/email；留空会按全部作者提取。",
      "如果提交在其他分支，请在设置中开启全部分支提取。",
      "刚添加或移动仓库后，请重新扫描仓库索引。",
    ],
  };
}

function formatActiveRange(
  activePreview: PreviewMode,
  dailyDate: string,
  weeklyRange: DateRange,
  monthlyRange: DateRange,
  customRange: DateRange,
) {
  if (activePreview === "weekly") return `${weeklyRange.startDate} ~ ${weeklyRange.endDate}`;
  if (activePreview === "monthly") return `${monthlyRange.startDate} ~ ${monthlyRange.endDate}`;
  if (activePreview === "custom") return `${customRange.startDate} ~ ${customRange.endDate}`;
  return dailyDate;
}

function formatAuthorScope(author: string) {
  const trimmed = author.trim();
  if (!trimmed) return "全部作者";
  if (trimmed.includes(",")) return `多作者：${trimmed}`;
  return `作者：${trimmed}`;
}

function formatAuthorValue(author: string) {
  const trimmed = author.trim();
  if (!trimmed) return "全部作者";
  if (!trimmed.includes(",")) return trimmed;
  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join("、");
}

function formatRepoScope(enabledRepoCount: number, totalRepoCount: number) {
  if (totalRepoCount === 0) return "未扫描";
  if (enabledRepoCount === totalRepoCount) return `${totalRepoCount} 个仓库`;
  return `${enabledRepoCount}/${totalRepoCount} 个仓库`;
}

function formatOutputScope(outputEnabled: boolean, outputDir: string) {
  if (!outputEnabled) return "未开启";
  if (!outputDir.trim()) return "待选目录";
  return "已配置";
}

function formatHistoryRange(entry: ReportHistoryEntry) {
  if (entry.mode === "summary") return entry.range.startDate;
  return `${entry.range.startDate} ~ ${entry.range.endDate}`;
}

function formatHistoryTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

function PanelTitle({ icon, title, meta, action }: { icon: ReactNode; title: string; meta: string; action?: ReactNode }) {
  return (
    <div className="panel-title">
      <h3>{icon}{title}</h3>
      <div className="panel-title-actions">
        <span>{meta}</span>
        {action}
      </div>
    </div>
  );
}
