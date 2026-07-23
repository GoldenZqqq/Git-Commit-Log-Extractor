import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppMessageTone } from "../components/AppMessageHost";
import { useReportHistoryStorage } from "./useReportHistoryStorage";
import {
  buildExtractOptions,
  buildPeriodReportOptions,
  buildReportEnhanceOptions,
  formatMonthLabel,
  getMonthRange,
  getMonthRangeOrFallback,
  getPreviousMonthInput,
  getSingleDayRange,
  getSingleDayRangeOrFallback,
  getTodayRange,
  getWeekLabel,
  getWeekRange,
  getWeekRangeOrFallback,
  isValidDateInput,
  isValidMonthInput,
  isValidWeekInput,
  isBlankDayHistoryEntry,
  type AppSettings,
  type CommitExtractProgress,
  type DateRange,
  type ExtractResult,
  type PeriodReportResult,
  type PreviewMode,
  type ReportEnhanceResult,
  type ReportExportFormat,
  type ReportHistoryEntry,
  type ReportPolishReview,
  type RepoInfo,
  validateAiConnectionSettings,
  validateExtractSettings,
  validateOutputSettings,
  validatePeriodReportSettings,
} from "../model";
import {
  buildSupplementalDraftKey,
  formatSupplementalItemsText,
  parseSupplementalItems,
  supplementalItemsFromHistory,
  validateSupplementalItems,
} from "../supplementalItems";
import {
  activePreviewBaseName,
  activePreviewPeriodLabel,
  activePreviewRange,
  copyText,
  createHistoryId,
  formatHistoryTitle,
  formatReportExportLabel,
  hasAiWarning,
  type HistoryEntryInput,
} from "../reportWorkflowUtils";

type HistoryStorage = ReturnType<typeof useReportHistoryStorage>;
type RunTaskInput = {
  kind: "generate" | "polish" | "export" | "interaction";
  label: string;
  task: () => Promise<void>;
  validate?: () => void;
  allowDuringPolishReview?: boolean;
};
type StatusOptions = { notify?: boolean; tone?: AppMessageTone; duration?: number };

type Params = {
  settings: AppSettings;
  repos: RepoInfo[];
  projectNames: Record<string, string>;
  reportHistoryStorage: HistoryStorage;
  runTask: (input: RunTaskInput) => Promise<unknown>;
  setStatus: (message: string, options?: StatusOptions) => void;
  setWarnings: Dispatch<SetStateAction<string[]>>;
  setExtractProgress: Dispatch<SetStateAction<CommitExtractProgress | null>>;
  onOpenSettings: () => void;
  onOpenBlankDay: () => void;
  onCloseBlankDay: () => void;
};

export function useReportWorkflow({
  settings,
  repos,
  projectNames,
  reportHistoryStorage,
  runTask,
  setStatus,
  setWarnings,
  setExtractProgress,
  onOpenSettings,
  onOpenBlankDay,
  onCloseBlankDay,
}: Params) {
  const [summaryText, setSummaryText] = useState("");
  const [dailyDate, setDailyDate] = useState(getTodayRange().startDate);
  const [customReport, setCustomReport] = useState("");
  const [customRange, setCustomRange] = useState<DateRange>(getTodayRange);
  const [weeklyReport, setWeeklyReport] = useState("");
  const [weeklyWeek, setWeeklyWeek] = useState(getWeekLabel);
  const [monthlyReport, setMonthlyReport] = useState("");
  const [monthlyMonth, setMonthlyMonth] = useState(getPreviousMonthInput);
  const [monthlyLabel, setMonthlyLabel] = useState("");
  const [supplementalDrafts, setSupplementalDrafts] = useState<Record<string, string>>({});
  const [activeHistoryId, setActiveHistoryId] = useState("");
  const [activePreview, setActivePreview] = useState<PreviewMode>("summary");
  const [polishReview, setPolishReview] = useState<ReportPolishReview | null>(null);
  const [lastOutputFile, setLastOutputFile] = useState("");
  const [commitCount, setCommitCount] = useState(0);
  const [projectCount, setProjectCount] = useState(0);
  const [blankDayDraftActive, setBlankDayDraftActive] = useState(false);
  const reportHistory = reportHistoryStorage.entries;
  // Derived ranges never throw on incomplete history labels; picker only commits complete values.
  const dailyRange = useMemo(() => getSingleDayRangeOrFallback(dailyDate), [dailyDate]);
  const weeklyRange = useMemo(() => getWeekRangeOrFallback(weeklyWeek), [weeklyWeek]);
  const monthlyRange = useMemo(() => getMonthRangeOrFallback(monthlyMonth), [monthlyMonth]);
  const previewText = activePreview === "monthly" ? monthlyReport : activePreview === "weekly" ? weeklyReport : activePreview === "custom" ? customReport : summaryText;
  const currentReportRange = activePreviewRange(activePreview, dailyRange, weeklyRange, monthlyRange, customRange);
  const currentSupplementalDraftKey = buildSupplementalDraftKey(activePreview, currentReportRange);
  const supplementalItemsText = supplementalDrafts[currentSupplementalDraftKey] ?? "";

  function changePreview(preview: PreviewMode) { setActivePreview(preview); setActiveHistoryId(""); }
  function changeDailyDate(date: string) {
    if (!isValidDateInput(date)) return;
    setDailyDate(date);
    setActiveHistoryId("");
    setBlankDayDraftActive(false);
  }
  function changeWeeklyWeek(week: string) {
    if (!isValidWeekInput(week)) return;
    setWeeklyWeek(week);
    setActiveHistoryId("");
  }
  function changeMonthlyMonth(month: string) {
    if (!isValidMonthInput(month)) return;
    setMonthlyMonth(month);
    setActiveHistoryId("");
  }
  function changeSupplementalItems(value: string) { setSupplementalDrafts((current) => ({ ...current, [currentSupplementalDraftKey]: value })); }

  function supplementalItemsFor(mode: PreviewMode, range: DateRange, override?: string[]) {
    if (override) return validateSupplementalItems(override);
    return parseSupplementalItems(supplementalDrafts[buildSupplementalDraftKey(mode, range)] ?? "");
  }

  function getEnabledRepoCount() { return repos.filter((repo) => !settings.disabledRepos.includes(repo.path)).length; }
  function rememberHistory(entry: ReportHistoryEntry) { reportHistoryStorage.remember(entry); setActiveHistoryId(entry.id); }
  function updateActiveHistory(patch: Partial<Pick<ReportHistoryEntry, "outputFile" | "reportText" | "commitCount" | "generatedAt">>) {
    if (activeHistoryId) reportHistoryStorage.update(activeHistoryId, patch);
  }
  function buildHistoryEntry(input: HistoryEntryInput): ReportHistoryEntry {
    return { id: createHistoryId(), mode: input.mode, title: formatHistoryTitle(input.mode, input.periodLabel, input.range), range: input.range, periodLabel: input.periodLabel, generatedAt: new Date().toISOString(), repoCount: getEnabledRepoCount(), projectCount: input.projectCount, commitCount: input.commitCount, aiEnhanced: input.aiEnhanced, outputFile: input.outputFile ?? "", reportText: input.reportText, supplementalItems: input.supplementalItems ?? [], projects: input.projects };
  }

  async function extractCommits(dateValue = dailyDate, supplementalOverride?: string[]) {
    const range = getSingleDayRange(dateValue);
    setExtractProgress(null);
    await runTask({ kind: "generate", label: "提取提交", task: async () => {
      const supplementalItems = supplementalItemsFor("summary", range, supplementalOverride);
      const result = await invoke<ExtractResult>("extract_commits", { options: buildExtractOptions(settings, projectNames, range, false, "", repos, "daily", supplementalItems) });
      const reportText = result.detailedText || result.summaryText;
      setDailyDate(dateValue); setSummaryText(reportText); setWarnings(result.warnings); setLastOutputFile(""); setCommitCount(result.commits.length); setProjectCount(result.projects.length); setBlankDayDraftActive(false); setActivePreview("summary");
      rememberHistory(buildHistoryEntry({ mode: "summary", range, periodLabel: dateValue, reportText, commitCount: result.commits.length, projectCount: result.projects.length, aiEnhanced: false, supplementalItems, projects: result.projects }));
      setStatus(`${dateValue} 日报已生成`);
    }, validate: () => { validateExtractSettings(settings, range); supplementalItemsFor("summary", range, supplementalOverride); }});
  }

  async function generateCustomReport(range: DateRange, supplementalOverride?: string[]) {
    setExtractProgress(null);
    await runTask({ kind: "generate", label: "正在生成自定义报告", task: async () => {
      const supplementalItems = supplementalItemsFor("custom", range, supplementalOverride);
      const result = await invoke<ExtractResult>("extract_commits", { options: buildExtractOptions(settings, projectNames, range, false, "", repos, "custom", supplementalItems) });
      const reportText = result.detailedText || result.summaryText; const periodLabel = `${range.startDate} ~ ${range.endDate}`;
      setCustomRange(range); setCustomReport(reportText); setWarnings(result.warnings); setLastOutputFile(""); setCommitCount(result.commits.length); setProjectCount(result.projects.length); setBlankDayDraftActive(false); setActivePreview("custom");
      rememberHistory(buildHistoryEntry({ mode: "custom", range, periodLabel, reportText, commitCount: result.commits.length, projectCount: result.projects.length, aiEnhanced: false, supplementalItems, projects: result.projects })); setStatus("自定义报告已生成");
    }, validate: () => { validateExtractSettings(settings, range); supplementalItemsFor("custom", range, supplementalOverride); }});
  }

  async function generateWeeklyReport(weekValue = weeklyWeek, supplementalOverride?: string[]) {
    setExtractProgress(null);
    await runTask({ kind: "generate", label: "正在生成周报", task: async () => {
      const range = getWeekRange(weekValue);
      const supplementalItems = supplementalItemsFor("weekly", range, supplementalOverride);
      const result = await invoke<PeriodReportResult>("generate_period_report", { options: buildPeriodReportOptions(settings, projectNames, "weekly", range, weekValue, false, "", repos, supplementalItems) });
      setWeeklyWeek(result.periodLabel); setWeeklyReport(result.reportText); setWarnings(result.warnings); setLastOutputFile(result.outputFile); setCommitCount(result.commitCount); setProjectCount(result.projectCount); setBlankDayDraftActive(false); setActivePreview("weekly");
      rememberHistory(buildHistoryEntry({ mode: "weekly", range, periodLabel: result.periodLabel, reportText: result.reportText, commitCount: result.commitCount, projectCount: result.projectCount, aiEnhanced: false, outputFile: result.outputFile, supplementalItems, projects: result.projects })); setStatus(result.outputFile ? `${result.periodLabel} 周报已生成` : `${result.periodLabel} 周报已生成，未写入文件`);
    }, validate: () => {
      if (!isValidWeekInput(weekValue)) throw new Error("请选择有效的报告周");
      const range = getWeekRange(weekValue);
      validatePeriodReportSettings(settings, range);
      supplementalItemsFor("weekly", range, supplementalOverride);
    }});
  }

  async function generateMonthlyReport(monthValue = monthlyMonth, supplementalOverride?: string[]) {
    setExtractProgress(null);
    await runTask({ kind: "generate", label: "正在生成月报", task: async () => {
      const range = getMonthRange(monthValue); const label = formatMonthLabel(monthValue); const supplementalItems = supplementalItemsFor("monthly", range, supplementalOverride);
      const result = await invoke<PeriodReportResult>("generate_period_report", { options: buildPeriodReportOptions(settings, projectNames, "monthly", range, label, false, "", repos, supplementalItems) });
      setMonthlyMonth(result.periodLabel); setMonthlyReport(result.reportText); setMonthlyLabel(result.periodLabel); setWarnings(result.warnings); setLastOutputFile(result.outputFile); setCommitCount(result.commitCount); setProjectCount(result.projectCount); setBlankDayDraftActive(false); setActivePreview("monthly");
      rememberHistory(buildHistoryEntry({ mode: "monthly", range, periodLabel: result.periodLabel, reportText: result.reportText, commitCount: result.commitCount, projectCount: result.projectCount, aiEnhanced: false, outputFile: result.outputFile, supplementalItems, projects: result.projects })); setStatus(result.outputFile ? `${result.periodLabel} 月报已生成` : `${result.periodLabel} 月报已生成，未写入文件`);
    }, validate: () => {
      if (!isValidMonthInput(monthValue)) throw new Error("请选择有效的报告月份");
      const range = getMonthRange(monthValue);
      validatePeriodReportSettings(settings, range);
      supplementalItemsFor("monthly", range, supplementalOverride);
    }});
  }

  function setActivePreviewText(mode: PreviewMode, text: string) {
    if (mode === "monthly") setMonthlyReport(text); else if (mode === "weekly") setWeeklyReport(text); else if (mode === "custom") setCustomReport(text); else setSummaryText(text);
  }
  async function saveActivePreviewText(mode: PreviewMode, range: DateRange, periodLabel: string, content: string) {
    if (!settings.outputEnabled) return "";
    return invoke<string>("save_report_file", { outputDir: settings.outputDir, baseName: activePreviewBaseName(mode, range, periodLabel), format: "markdown", content });
  }

  async function polishReport(extraInstruction = "") {
    if (polishReview) { setStatus("请先接受或放弃当前 AI 润色结果", { tone: "warning", notify: true }); return; }
    const range = activePreviewRange(activePreview, dailyRange, weeklyRange, monthlyRange, customRange); const periodLabel = activePreviewPeriodLabel(activePreview, dailyDate, weeklyWeek, monthlyLabel || monthlyMonth, customRange); const baseReport = previewText; const sourceHistory = reportHistory.find((entry) => entry.id === activeHistoryId); const sourceRepoCount = sourceHistory?.repoCount ?? getEnabledRepoCount();
    setExtractProgress(null);
    await runTask({ kind: "polish", label: "AI 正在润色当前报告", task: async () => {
      const supplementalItems = supplementalItemsFor(activePreview, range); const result = await invoke<ReportEnhanceResult>("enhance_report", { options: buildReportEnhanceOptions(settings, activePreview, range, baseReport, extraInstruction, supplementalItems) }); setWarnings(result.warnings);
      if (hasAiWarning(result.warnings)) { setStatus("AI 润色失败，已保留当前报告"); return; }
      setPolishReview({ mode: activePreview, range, periodLabel, originalText: baseReport, polishedText: result.reportText, warnings: result.warnings, repoCount: sourceRepoCount, commitCount, projectCount, supplementalItems, projects: sourceHistory?.projects }); setStatus("AI 润色完成，请对照确认");
    }, validate: () => { if (!baseReport.trim()) throw new Error("当前报告为空，请先生成报告再润色"); validateAiConnectionSettings(settings); validateOutputSettings(settings); supplementalItemsFor(activePreview, range); }});
  }

  async function acceptPolishReview() {
    if (!polishReview) return; const review = polishReview;
    await runTask({ kind: "export", label: "正在接受 AI 润色结果", task: async () => {
      const outputFile = await saveActivePreviewText(review.mode, review.range, review.periodLabel, review.polishedText); setActivePreviewText(review.mode, review.polishedText); setActivePreview(review.mode); setWarnings(review.warnings); setLastOutputFile(outputFile);
      rememberHistory({ ...buildHistoryEntry({ mode: review.mode, range: review.range, periodLabel: review.periodLabel, reportText: review.polishedText, commitCount: review.commitCount, projectCount: review.projectCount, aiEnhanced: true, outputFile, supplementalItems: review.supplementalItems, projects: review.projects }), repoCount: review.repoCount }); setPolishReview(null); setStatus("已接受 AI 润色结果");
    }, validate: () => { if (settings.outputEnabled) validateOutputSettings(settings); }, allowDuringPolishReview: true });
  }
  function rejectPolishReview() { if (polishReview) { setPolishReview(null); setStatus("已保留原稿"); } }

  async function copyPreview() {
    if (!previewText) return;
    await runTask({ kind: "interaction", label: "正在复制当前报告", task: async () => { await copyText(previewText, "复制失败，请重试"); setStatus("内容已复制到剪贴板", { tone: "success", notify: true }); }, validate: () => undefined });
  }

  async function saveReport(format: ReportExportFormat = "markdown") {
    if (!previewText) return;
    if (!settings.outputEnabled || !settings.outputDir.trim()) { onOpenSettings(); setStatus(settings.outputEnabled ? "请选择输出目录后再导出报告" : "请先开启输出到文件并选择输出目录", { tone: "warning", notify: true, duration: 4200 }); return; }
    const range = activePreview === "custom" ? customRange : dailyRange;
    const monthBase = monthlyLabel || (isValidMonthInput(monthlyMonth) ? formatMonthLabel(monthlyMonth) : monthlyMonth);
    const baseName = activePreview === "monthly"
      ? `monthly_report_${monthBase}`
      : activePreview === "weekly"
        ? `weekly_report_${weeklyWeek}`
        : `git_commits_${range.startDate}_to_${range.endDate}`;
    await runTask({ kind: "export", label: "正在导出报告", task: async () => { const outputFile = await invoke<string>("save_report_file", { outputDir: settings.outputDir, baseName, format, content: previewText }); setLastOutputFile(outputFile); updateActiveHistory({ outputFile }); setStatus(`报告已导出为 ${formatReportExportLabel(format)}`); }, validate: () => validateOutputSettings(settings) });
  }

  function openReportHistory(entry: ReportHistoryEntry) {
    if (polishReview) { setStatus("请先接受或放弃当前 AI 润色结果", { tone: "warning", notify: true }); return; }
    setActiveHistoryId(entry.id); setWarnings([]); setLastOutputFile(entry.outputFile); setCommitCount(entry.commitCount); setProjectCount(entry.projectCount ?? entry.repoCount); setBlankDayDraftActive(isBlankDayHistoryEntry(entry));
    const supplementalItems = supplementalItemsFromHistory(entry.supplementalItems); const supplementalKey = buildSupplementalDraftKey(entry.mode, entry.range); setSupplementalDrafts((current) => ({ ...current, [supplementalKey]: formatSupplementalItemsText(supplementalItems) }));
    if (entry.mode === "monthly") { setMonthlyMonth(entry.periodLabel); setMonthlyLabel(entry.periodLabel); setMonthlyReport(entry.reportText); } else if (entry.mode === "weekly") { setWeeklyWeek(entry.periodLabel); setWeeklyReport(entry.reportText); } else if (entry.mode === "custom") { setCustomRange(entry.range); setCustomReport(entry.reportText); } else { setDailyDate(entry.range.startDate); setSummaryText(entry.reportText); }
    setActivePreview(entry.mode); setStatus(`已打开历史报告：${entry.title}`);
  }
  async function copyReportHistory(entry: ReportHistoryEntry) { await runTask({ kind: "interaction", label: "正在复制历史报告", task: async () => { await copyText(entry.reportText, "复制历史报告失败，请重试"); setStatus(`已复制历史报告：${entry.title}`, { tone: "success", notify: true }); }, validate: () => undefined }); }
  async function regenerateReportHistory(entry: ReportHistoryEntry) { const items = supplementalItemsFromHistory(entry.supplementalItems); if (entry.mode === "monthly") await generateMonthlyReport(entry.periodLabel, items); else if (entry.mode === "weekly") await generateWeeklyReport(entry.periodLabel, items); else if (entry.mode === "custom") await generateCustomReport(entry.range, items); else await extractCommits(entry.range.startDate, items); }
  async function clearHistoryRecords() { if (!window.confirm("清空最近报告记录？已导出的 Markdown 文件不会被删除。")) return; if (await reportHistoryStorage.clear()) { setActiveHistoryId(""); setStatus("最近报告记录已清空"); } }

  function handleGenerateDailyFromCalendar(date: string) { setBlankDayDraftActive(false); setActivePreview("summary"); void extractCommits(date); }
  function handleOpenBlankDayFillFromCalendar(date: string) { setDailyDate(date); setActivePreview("summary"); onOpenBlankDay(); }
  function handleBlankDayGenerated(payload: { draftText: string; targetDate: string; sourceRange: DateRange; commitCount: number; repoCount: number }) {
    rememberHistory({ id: createHistoryId(), mode: "summary", title: `空白日补写 · ${payload.targetDate}`, range: getSingleDayRange(payload.targetDate), periodLabel: `补写草稿 · ${payload.targetDate}`, generatedAt: new Date().toISOString(), repoCount: payload.repoCount, projectCount: payload.repoCount, commitCount: payload.commitCount, aiEnhanced: true, outputFile: "", reportText: payload.draftText }); setStatus(`空白日补写草稿已生成：${payload.targetDate}`);
  }
  function handleBlankDayApply(draftText: string, targetDate: string) {
    if (summaryText.trim() && !window.confirm("将用补写草稿替换当前预览内容？")) return;
    setDailyDate(targetDate); setSummaryText(draftText); setWarnings([]); setLastOutputFile(""); setCommitCount(0); setProjectCount(0); setBlankDayDraftActive(true); setActivePreview("summary"); onCloseBlankDay(); setStatus(`已应用空白日补写草稿：${targetDate}`);
  }

  return {
    reportHistory, summaryText, dailyDate, customReport, customRange, weeklyReport, weeklyWeek, monthlyReport, monthlyMonth, monthlyLabel,
    supplementalDrafts, activeHistoryId, activePreview, polishReview, lastOutputFile, commitCount, projectCount, blankDayDraftActive,
    dailyRange, weeklyRange, monthlyRange, previewText, supplementalItemsText,
    changePreview, changeDailyDate, changeWeeklyWeek, changeMonthlyMonth, changeSupplementalItems,
    extractCommits, generateCustomReport, generateWeeklyReport, generateMonthlyReport, polishReport, acceptPolishReview, rejectPolishReview,
    copyPreview, saveReport, openReportHistory, copyReportHistory, regenerateReportHistory, clearHistoryRecords,
    handleGenerateDailyFromCalendar, handleOpenBlankDayFillFromCalendar, handleBlankDayGenerated, handleBlankDayApply,
  };
}
