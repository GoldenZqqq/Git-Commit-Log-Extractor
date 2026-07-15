import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { AppMessageHost, type AppMessage, type AppMessageTone } from "./components/AppMessageHost";
import { BatchDialog } from "./components/BatchDialog";
import { BlankDayFillDialog } from "./components/BlankDayFillDialog";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { RepoMappingDialog } from "./components/RepoMappingDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { UpdateBanner } from "./components/UpdateBanner";
import { Workbench } from "./components/Workbench";
import { useAppRuntime } from "./hooks/useAppRuntime";
import {
  type AppSettings,
  type CommitExtractProgress,
  type DateRange,
  type ExtractResult,
  type GitIdentity,
  type LoadedSettingsState,
  type PeriodReportResult,
  type ReportEnhanceResult,
  type ReportExportFormat,
  type PreviewMode,
  type ReportHistoryEntry,
  type RepoInfo,
  type RepoScanProgress,
  type MappingScope,
  STORAGE_KEY,
  buildExtractOptions,
  buildPeriodReportOptions,
  buildReportEnhanceOptions,
  clearReportHistory,
  clearRepoIndexCache,
  isBlankDayHistoryEntry,
  countCommitProjects,
  formatMonthLabel,
  getMonthRange,
  getPreviousMonthInput,
  getSingleDayRange,
  getToday,
  getTodayRange,
  getWeekLabel,
  getWeekRange,
  isAiKeyReference,
  loadReportHistory,
  loadRepoIndexCache,
  normalizeReportHistoryLimit,
  loadSettingsState,
  parseProjectNames,
  rememberReportHistoryEntry,
  saveReportHistory,
  saveRepoIndexCache,
  settingsForPersistence,
  updateReportHistoryEntry,
  upsertRepoMapping,
  validateAiConnectionSettings,
  validateExtractSettings,
  validateOutputSettings,
  validatePeriodReportSettings,
  validateRequiredSettings,
  validateWorkspaceSettings,
} from "./model";
import {
  buildSupplementalDraftKey,
  formatSupplementalItemsText,
  parseSupplementalItems,
  supplementalItemsFromHistory,
  validateSupplementalItems,
} from "./supplementalItems";
import "./styles/tokens.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/preview.css";
import "./styles/dialogs.css";
import "./styles/onboarding.css";
import "./styles/theme.css";

function App() {
  const [loadedSettings] = useState<LoadedSettingsState>(loadSettingsState);
  const [settings, setSettings] = useState<AppSettings>(loadedSettings.settings);
  const [repos, setRepos] = useState<RepoInfo[]>(() => loadRepoIndexCache(loadedSettings.settings.rootDirs)?.repos ?? []);
  const [summaryText, setSummaryText] = useState("");
  const [dailyDate, setDailyDate] = useState(getToday);
  const [customReport, setCustomReport] = useState("");
  const [customRange, setCustomRange] = useState<DateRange>(getTodayRange);
  const [weeklyReport, setWeeklyReport] = useState("");
  const [weeklyWeek, setWeeklyWeek] = useState(getWeekLabel);
  const [monthlyReport, setMonthlyReport] = useState("");
  const [monthlyMonth, setMonthlyMonth] = useState(getPreviousMonthInput);
  const [monthlyLabel, setMonthlyLabel] = useState("");
  const [reportHistory, setReportHistory] = useState<ReportHistoryEntry[]>(() => loadReportHistory(loadedSettings.settings.reportHistoryLimit));
  const [supplementalDrafts, setSupplementalDrafts] = useState<Record<string, string>>({});
  const [activeHistoryId, setActiveHistoryId] = useState("");
  const [activePreview, setActivePreview] = useState<PreviewMode>("summary");
  const [status, setStatusText] = useState(
    loadedSettings.recoveredCorruptedSettings
      ? "本地设置损坏，已恢复默认配置"
      : loadedSettings.recoveredLegacyApiKey
        ? "已迁移旧配置中的 AI 密钥引用"
        : "就绪",
  );
  const [appMessage, setAppMessage] = useState<AppMessage | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isRepoScanning, setIsRepoScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<RepoScanProgress | null>(null);
  const [extractProgress, setExtractProgress] = useState<CommitExtractProgress | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [blankDayOpen, setBlankDayOpen] = useState(false);
  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false);
  const [editingRepo, setEditingRepo] = useState<RepoInfo | null>(null);
  const [lastOutputFile, setLastOutputFile] = useState("");
  const [commitCount, setCommitCount] = useState(0);
  const [blankDayDraftActive, setBlankDayDraftActive] = useState(false);
  const [projectCount, setProjectCount] = useState(0);
  const aiApiKeySaveTimer = useRef<number | null>(null);
  const proxyPasswordSaveTimer = useRef<number | null>(null);
  const {
    appVersion,
    updateSummary,
    updateMessage,
    updateProgress,
    updateBusy,
    startupUpdateNotice,
    checkForUpdates,
    installUpdate,
  } = useAppRuntime({ themeMode: settings.themeMode });

  const projectNames = useMemo(() => parseProjectNames(settings.projectNamesText), [settings.projectNamesText]);
  const dailyRange = useMemo(() => getSingleDayRange(dailyDate), [dailyDate]);
  const weeklyRange = useMemo(() => getWeekRange(weeklyWeek), [weeklyWeek]);
  const monthlyRange = useMemo(() => getMonthRange(monthlyMonth), [monthlyMonth]);
  const previewText = activePreview === "monthly" ? monthlyReport : activePreview === "weekly" ? weeklyReport : activePreview === "custom" ? customReport : summaryText;
  const currentReportRange = activePreviewRange(activePreview, dailyRange, weeklyRange, monthlyRange, customRange);
  const currentSupplementalDraftKey = buildSupplementalDraftKey(activePreview, currentReportRange);
  const supplementalItemsText = supplementalDrafts[currentSupplementalDraftKey] ?? "";
  const aiConfigured =
    settings.aiProvider === "codex-oauth"
      ? Boolean(settings.aiModel.trim())
      : Boolean(settings.aiBaseUrl.trim() && settings.aiModel.trim() && settings.aiApiKey.trim());
  const dismissAppMessage = useCallback(() => setAppMessage(null), []);

  function showMessage(message: string, tone: AppMessageTone = inferMessageTone(message), duration?: number) {
    setAppMessage({
      id: Date.now(),
      message,
      tone,
      duration: duration ?? (tone === "loading" ? 1800 : 2800),
    });
  }

  function setStatus(message: string, options: { notify?: boolean; tone?: AppMessageTone; duration?: number } = {}) {
    setStatusText(message);
    const shouldNotify = options.notify ?? shouldNotifyStatus(message);
    if (shouldNotify) showMessage(message, options.tone ?? inferMessageTone(message), options.duration);
  }

  useEffect(() => {
    if (!startupUpdateNotice) return;
    setUpdateBannerDismissed(false);
  }, [startupUpdateNotice]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsForPersistence(settings)));
  }, [settings]);

  useEffect(() => {
    function handleDateInputClick(e: MouseEvent) {
      const target = e.target;
      if (target instanceof HTMLInputElement && /^(date|month|week)$/.test(target.type)) {
        try { target.showPicker(); } catch { /* showPicker may throw if already open */ }
      }
    }
    document.addEventListener("click", handleDateInputClick);
    return () => document.removeEventListener("click", handleDateInputClick);
  }, []);

  useEffect(() => {
    const currentApiKey = settings.aiApiKey.trim();
    if (currentApiKey) {
      if (!isAiKeyReference(currentApiKey)) void persistSecureAiApiKey(currentApiKey);
      return;
    }

    invoke<string | null>("get_secure_ai_api_key")
      .then((apiKey) => {
        if (!apiKey) return;
        setSettings((current) => {
          if (current.aiApiKey.trim()) return current;
          return { ...current, aiApiKey: apiKey, aiApiKeySaved: true };
        });
        setStatus("已从系统凭据库读取 AI API Key");
      })
      .catch(() => undefined);
    // Only run on startup; later key edits are handled by updateSetting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const currentPassword = settings.proxyPassword.trim();
    if (currentPassword) {
      void persistSecureProxyPassword(currentPassword);
      return;
    }

    invoke<string | null>("get_secure_proxy_password")
      .then((password) => {
        if (!password) return;
        setSettings((current) => {
          if (current.proxyPassword.trim()) return current;
          return { ...current, proxyPassword: password, proxyPasswordSaved: true };
        });
      })
      .catch(() => undefined);
    // Only run on startup; later proxy password edits are handled by updateSetting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<RepoScanProgress>("repo-scan-progress", ({ payload }) => {
      setScanProgress(payload);
      if (payload.cancelled) {
        setStatus("仓库扫描已取消");
        return;
      }
      if (payload.done) return;
      setStatus(`正在扫描仓库：已检查 ${payload.scannedDirs} 个目录，发现 ${payload.foundRepos} 个仓库`);
    })
      .then((cleanup) => {
        unlisten = cleanup;
      })
      .catch(() => undefined);

    return () => unlisten?.();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<CommitExtractProgress>("commit-extract-progress", ({ payload }) => {
      setExtractProgress(payload);
      if (payload.done) return;
      setStatus(formatExtractProgress(payload));
    })
      .then((cleanup) => {
        unlisten = cleanup;
      })
      .catch(() => undefined);

    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (settings.author || settings.onboardingDone) return;

    invoke<GitIdentity>("get_git_identity")
      .then((identity) => {
        if (!identity.userName) return;
        setSettings((current) => {
          if (current.author) return current;
          return { ...current, author: identity.userName };
        });
        setStatus(`已读取本机 Git 作者：${identity.userName}`);
      })
      .catch(() => {
        setStatus("未读取到本机 Git 作者，可手动填写");
      });
  }, []);

  useEffect(() => {
    if (settings.rootDirs.length === 0) {
      setRepos([]);
      clearRepoIndexCache();
      return;
    }

    const repoCache = loadRepoIndexCache(settings.rootDirs);
    if (repoCache) {
      setRepos(repoCache.repos);
      setStatus(`已载入 ${repoCache.repos.length} 个缓存仓库索引`);
      return;
    }

    setRepos([]);
    if (settings.onboardingDone) {
      setStatus("工作目录已更新，请点击重新扫描仓库索引");
      return;
    }
    scanWorkspace();
  }, [settings.rootDirs, settings.onboardingDone]);

  useEffect(() => {
    return () => {
      if (aiApiKeySaveTimer.current !== null) {
        window.clearTimeout(aiApiKeySaveTimer.current);
      }
    };
  }, []);

  async function chooseOutputDir() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") updateSetting("outputDir", selected);
  }

  async function addRootDirs() {
    const selected = await open({ directory: true, multiple: true });
    const picked = Array.isArray(selected) ? selected : typeof selected === "string" ? [selected] : [];
    if (picked.length === 0) return;
    setSettings((current) => {
      const merged = [...current.rootDirs];
      for (const dir of picked) {
        if (!merged.includes(dir)) merged.push(dir);
      }
      return { ...current, rootDirs: merged };
    });
  }

  function removeRootDir(dir: string) {
    setSettings((current) => ({
      ...current,
      rootDirs: current.rootDirs.filter((item) => item !== dir),
    }));
  }

  async function scanWorkspace() {
    setIsRepoScanning(true);
    setScanProgress({
      rootDir: "",
      currentPath: "",
      scannedDirs: 0,
      foundRepos: 0,
      done: false,
      cancelled: false,
    });
    try {
      await runTask("正在扫描仓库", async () => {
        const result = await invoke<RepoInfo[]>("scan_repos", { rootDirs: settings.rootDirs });
        updateRepoIndex(result);
        setScanProgress((current) => ({
          rootDir: current?.rootDir ?? "",
          currentPath: current?.currentPath ?? "",
          scannedDirs: current?.scannedDirs ?? 0,
          foundRepos: result.length,
          done: true,
          cancelled: false,
        }));
        setStatus(`已发现 ${result.length} 个仓库`);
      }, () => validateWorkspaceSettings(settings));
    } finally {
      setIsRepoScanning(false);
    }
  }

  async function cancelRepoScan() {
    setStatus("正在取消仓库扫描");
    try {
      await invoke("cancel_repo_scan");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function changePreview(preview: PreviewMode) {
    setActivePreview(preview);
    setActiveHistoryId("");
  }

  function changeDailyDate(date: string) {
    setDailyDate(date);
    setActiveHistoryId("");
    setBlankDayDraftActive(false);
  }

  function changeWeeklyWeek(week: string) {
    setWeeklyWeek(week);
    setActiveHistoryId("");
  }

  function changeMonthlyMonth(month: string) {
    setMonthlyMonth(month);
    setActiveHistoryId("");
  }

  function changeSupplementalItems(value: string) {
    setSupplementalDrafts((current) => ({ ...current, [currentSupplementalDraftKey]: value }));
  }

  function supplementalItemsFor(mode: PreviewMode, range: DateRange, override?: string[]) {
    if (override) return validateSupplementalItems(override);
    const key = buildSupplementalDraftKey(mode, range);
    return parseSupplementalItems(supplementalDrafts[key] ?? "");
  }

  function rememberHistory(entry: ReportHistoryEntry) {
    setReportHistory((current) => rememberReportHistoryEntry(current, entry, settings.reportHistoryLimit));
    setActiveHistoryId(entry.id);
  }

  function updateActiveHistory(patch: Partial<Pick<ReportHistoryEntry, "outputFile" | "reportText" | "commitCount" | "generatedAt">>) {
    if (!activeHistoryId) return;
    setReportHistory((current) => updateReportHistoryEntry(current, activeHistoryId, patch, settings.reportHistoryLimit));
  }

  function buildHistoryEntry(
    mode: PreviewMode,
    range: DateRange,
    periodLabel: string,
    reportText: string,
    commitTotal: number,
    projectTotal: number,
    aiEnhanced: boolean,
    outputFile = "",
    supplementalItems: string[] = [],
  ): ReportHistoryEntry {
    return {
      id: createHistoryId(),
      mode,
      title: formatHistoryTitle(mode, periodLabel, range),
      range,
      periodLabel,
      generatedAt: new Date().toISOString(),
      repoCount: getEnabledRepoCount(),
      projectCount: projectTotal,
      commitCount: commitTotal,
      aiEnhanced,
      outputFile,
      reportText,
      supplementalItems,
    };
  }

  function getEnabledRepoCount() {
    return repos.filter((repo) => !settings.disabledRepos.includes(repo.path)).length;
  }

  async function extractCommits(dateValue = dailyDate, supplementalOverride?: string[]) {
    const range = getSingleDayRange(dateValue);
    setExtractProgress(null);
    await runTask("正在提取提交记录", async () => {
      const supplementalItems = supplementalItemsFor("summary", range, supplementalOverride);
      const result = await invoke<ExtractResult>("extract_commits", {
        options: buildExtractOptions(settings, projectNames, range, false, "", repos, "daily", supplementalItems),
      });
      const reportText = result.detailedText || result.summaryText;
      const projectTotal = countCommitProjects(result.commits, projectNames);
      setDailyDate(dateValue);
      setSummaryText(reportText);
      setWarnings(result.warnings);
      setLastOutputFile("");
      setCommitCount(result.commits.length);
      setProjectCount(projectTotal);
      setBlankDayDraftActive(false);
      setActivePreview("summary");
      rememberHistory(buildHistoryEntry("summary", range, dateValue, reportText, result.commits.length, projectTotal, false, "", supplementalItems));
      setStatus(`${dateValue} 日报已生成`);
    }, () => {
      validateExtractSettings(settings, range);
      supplementalItemsFor("summary", range, supplementalOverride);
    });
  }

  async function generateCustomReport(range: DateRange, supplementalOverride?: string[]) {
    setExtractProgress(null);
    await runTask("正在生成自定义报告", async () => {
      const supplementalItems = supplementalItemsFor("custom", range, supplementalOverride);
      const result = await invoke<ExtractResult>("extract_commits", {
        options: buildExtractOptions(settings, projectNames, range, false, "", repos, "custom", supplementalItems),
      });
      const reportText = result.detailedText || result.summaryText;
      const periodLabel = `${range.startDate} ~ ${range.endDate}`;
      const projectTotal = countCommitProjects(result.commits, projectNames);
      setCustomRange(range);
      setCustomReport(reportText);
      setWarnings(result.warnings);
      setLastOutputFile("");
      setCommitCount(result.commits.length);
      setProjectCount(projectTotal);
      setBlankDayDraftActive(false);
      setActivePreview("custom");
      rememberHistory(buildHistoryEntry("custom", range, periodLabel, reportText, result.commits.length, projectTotal, false, "", supplementalItems));
      setStatus("自定义报告已生成");
    }, () => {
      validateExtractSettings(settings, range);
      supplementalItemsFor("custom", range, supplementalOverride);
    });
  }

  async function generateWeeklyReport(weekValue = weeklyWeek, supplementalOverride?: string[]) {
    const range = getWeekRange(weekValue);
    const label = weekValue;
    setExtractProgress(null);
    await runTask("正在生成周报", async () => {
      const supplementalItems = supplementalItemsFor("weekly", range, supplementalOverride);
      const result = await invoke<PeriodReportResult>("generate_period_report", {
        options: buildPeriodReportOptions(settings, projectNames, "weekly", range, label, false, "", repos, supplementalItems),
      });
      setWeeklyWeek(result.periodLabel);
      setWeeklyReport(result.reportText);
      setWarnings(result.warnings);
      setLastOutputFile(result.outputFile);
      setCommitCount(result.commitCount);
      setProjectCount(result.projectCount);
      setBlankDayDraftActive(false);
      setActivePreview("weekly");
      rememberHistory(buildHistoryEntry("weekly", range, result.periodLabel, result.reportText, result.commitCount, result.projectCount, false, result.outputFile, supplementalItems));
      setStatus(result.outputFile ? `${result.periodLabel} 周报已生成` : `${result.periodLabel} 周报已生成，未写入文件`);
    }, () => {
      validatePeriodReportSettings(settings, range);
      supplementalItemsFor("weekly", range, supplementalOverride);
    });
  }

  async function generateMonthlyReport(monthValue = monthlyMonth, supplementalOverride?: string[]) {
    setExtractProgress(null);
    await runTask("正在生成月报", async () => {
      const range = getMonthRange(monthValue);
      const label = formatMonthLabel(monthValue);
      const supplementalItems = supplementalItemsFor("monthly", range, supplementalOverride);
      const result = await invoke<PeriodReportResult>("generate_period_report", {
        options: buildPeriodReportOptions(settings, projectNames, "monthly", range, label, false, "", repos, supplementalItems),
      });
      setMonthlyMonth(result.periodLabel);
      setMonthlyReport(result.reportText);
      setMonthlyLabel(result.periodLabel);
      setWarnings(result.warnings);
      setLastOutputFile(result.outputFile);
      setCommitCount(result.commitCount);
      setProjectCount(result.projectCount);
      setBlankDayDraftActive(false);
      setActivePreview("monthly");
      rememberHistory(buildHistoryEntry("monthly", range, result.periodLabel, result.reportText, result.commitCount, result.projectCount, false, result.outputFile, supplementalItems));
      setStatus(result.outputFile ? `${result.periodLabel} 月报已生成` : `${result.periodLabel} 月报已生成，未写入文件`);
    }, () => {
      validatePeriodReportSettings(settings, getMonthRange(monthValue));
      supplementalItemsFor("monthly", getMonthRange(monthValue), supplementalOverride);
    });
  }

  function setActivePreviewText(mode: PreviewMode, text: string) {
    if (mode === "monthly") {
      setMonthlyReport(text);
    } else if (mode === "weekly") {
      setWeeklyReport(text);
    } else if (mode === "custom") {
      setCustomReport(text);
    } else {
      setSummaryText(text);
    }
  }

  async function saveActivePreviewText(mode: PreviewMode, range: DateRange, periodLabel: string, content: string) {
    if (!settings.outputEnabled) return "";
    const baseName = activePreviewBaseName(mode, range, periodLabel);
    return invoke<string>("save_report_file", {
      outputDir: settings.outputDir,
      baseName,
      format: "markdown",
      content,
    });
  }

  async function polishReport(extraInstruction = "") {
    const range = activePreviewRange(activePreview, dailyRange, weeklyRange, monthlyRange, customRange);
    const periodLabel = activePreviewPeriodLabel(activePreview, dailyDate, weeklyWeek, monthlyLabel || monthlyMonth, customRange);
    const baseReport = previewText;
    setExtractProgress(null);
    await runTask("AI 正在润色当前报告", async () => {
      const supplementalItems = supplementalItemsFor(activePreview, range);
      const result = await invoke<ReportEnhanceResult>("enhance_report", {
        options: buildReportEnhanceOptions(settings, activePreview, range, baseReport, extraInstruction, supplementalItems),
      });
      const aiEnhanced = !hasAiWarning(result.warnings);
      const outputFile = await saveActivePreviewText(activePreview, range, periodLabel, result.reportText);
      setActivePreviewText(activePreview, result.reportText);
      setWarnings(result.warnings);
      setLastOutputFile(outputFile);
      rememberHistory(buildHistoryEntry(
        activePreview,
        range,
        periodLabel,
        result.reportText,
        commitCount,
        projectCount,
        aiEnhanced,
        outputFile,
        supplementalItems,
      ));
      setStatus(hasAiWarning(result.warnings) ? "AI 润色失败，已保留当前报告" : "AI 润色已完成");
    }, () => {
      if (!baseReport.trim()) throw new Error("当前报告为空，请先生成报告再润色");
      validateAiConnectionSettings(settings);
      validateOutputSettings(settings);
      supplementalItemsFor(activePreview, range);
    });
  }

  async function copyPreview() {
    if (!previewText) return;
    try {
      await navigator.clipboard.writeText(previewText);
      setStatus("内容已复制到剪贴板", { tone: "success", notify: true });
    } catch {
      setStatus("复制失败，请重试", { tone: "error", notify: true });
    }
  }

  async function saveReport(format: ReportExportFormat = "markdown") {
    if (!previewText) return;
    if (!settings.outputEnabled || !settings.outputDir.trim()) {
      setSettingsOpen(true);
      setStatus(
        settings.outputEnabled
          ? "请选择输出目录后再导出报告"
          : "请先开启输出到文件并选择输出目录",
        { tone: "warning", notify: true, duration: 4200 },
      );
      return;
    }
    let baseName: string;
    if (activePreview === "monthly") {
      baseName = `monthly_report_${monthlyLabel || formatMonthLabel(monthlyMonth)}`;
    } else if (activePreview === "weekly") {
      baseName = `weekly_report_${weeklyWeek}`;
    } else {
      const range = activePreview === "custom" ? customRange : dailyRange;
      baseName = `git_commits_${range.startDate}_to_${range.endDate}`;
    }
    await runTask("正在导出报告", async () => {
      const outputFile = await invoke<string>("save_report_file", {
        outputDir: settings.outputDir,
        baseName,
        format,
        content: previewText,
      });
      setLastOutputFile(outputFile);
      updateActiveHistory({ outputFile });
      setStatus(`报告已导出为 ${formatReportExportLabel(format)}`);
    }, () => validateOutputSettings(settings));
  }

  function openReportHistory(entry: ReportHistoryEntry) {
    setActiveHistoryId(entry.id);
    setWarnings([]);
    setLastOutputFile(entry.outputFile);
    setCommitCount(entry.commitCount);
    setProjectCount(entry.projectCount ?? entry.repoCount);
    setBlankDayDraftActive(isBlankDayHistoryEntry(entry));
    const supplementalItems = supplementalItemsFromHistory(entry.supplementalItems);
    const supplementalKey = buildSupplementalDraftKey(entry.mode, entry.range);
    setSupplementalDrafts((current) => ({
      ...current,
      [supplementalKey]: formatSupplementalItemsText(supplementalItems),
    }));

    if (entry.mode === "monthly") {
      setMonthlyMonth(entry.periodLabel);
      setMonthlyLabel(entry.periodLabel);
      setMonthlyReport(entry.reportText);
    } else if (entry.mode === "weekly") {
      setWeeklyWeek(entry.periodLabel);
      setWeeklyReport(entry.reportText);
    } else if (entry.mode === "custom") {
      setCustomRange(entry.range);
      setCustomReport(entry.reportText);
    } else {
      setDailyDate(entry.range.startDate);
      setSummaryText(entry.reportText);
    }

    setActivePreview(entry.mode);
    setStatus(`已打开历史报告：${entry.title}`);
  }

  async function copyReportHistory(entry: ReportHistoryEntry) {
    try {
      await navigator.clipboard.writeText(entry.reportText);
      setStatus(`已复制历史报告：${entry.title}`, { tone: "success", notify: true });
    } catch {
      setStatus("复制历史报告失败，请重试", { tone: "error", notify: true });
    }
  }

  async function regenerateReportHistory(entry: ReportHistoryEntry) {
    const supplementalItems = supplementalItemsFromHistory(entry.supplementalItems);
    if (entry.mode === "monthly") {
      await generateMonthlyReport(entry.periodLabel, supplementalItems);
    } else if (entry.mode === "weekly") {
      await generateWeeklyReport(entry.periodLabel, supplementalItems);
    } else if (entry.mode === "custom") {
      await generateCustomReport(entry.range, supplementalItems);
    } else {
      await extractCommits(entry.range.startDate, supplementalItems);
    }
  }

  function clearHistoryRecords() {
    if (!window.confirm("清空最近报告记录？已导出的 Markdown 文件不会被删除。")) return;
    clearReportHistory();
    setReportHistory([]);
    setActiveHistoryId("");
    setStatus("最近报告记录已清空");
  }

  async function runTask(label: string, task: () => Promise<void>, validate = () => validateRequiredSettings(settings)) {
    setIsBusy(true);
    setStatus(label, { tone: "loading", notify: true, duration: 1600 });
    setWarnings([]);
    try {
      validate();
      await task();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), { tone: "error", notify: true, duration: 4200 });
    } finally {
      setIsBusy(false);
    }
  }

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    if (key === "reportHistoryLimit") {
      const limit = normalizeReportHistoryLimit(value);
      setSettings((current) => ({ ...current, reportHistoryLimit: limit }));
      setReportHistory((current) => saveReportHistory(current, limit));
      return;
    }
    if (key === "aiApiKey") {
      const aiApiKey = String(value);
      setSettings((current) => ({
        ...current,
        aiApiKey,
        aiApiKeySaved:
          current.aiApiKeySaved
          && current.aiApiKey === aiApiKey
          && Boolean(aiApiKey.trim())
          && !isAiKeyReference(aiApiKey.trim()),
      }));
      scheduleSecureAiApiKeySync(aiApiKey);
      return;
    }
    if (key === "proxyPassword") {
      const proxyPassword = String(value);
      setSettings((current) => ({
        ...current,
        proxyPassword,
        proxyPasswordSaved:
          current.proxyPasswordSaved
          && current.proxyPassword === proxyPassword
          && Boolean(proxyPassword.trim()),
      }));
      scheduleSecureProxyPasswordSync(proxyPassword);
      return;
    }
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function toggleRepo(repoPath: string, enabled: boolean) {
    setSettings((current) => {
      const disabled = current.disabledRepos.filter((path) => path !== repoPath);
      if (!enabled) disabled.push(repoPath);
      return { ...current, disabledRepos: disabled };
    });
  }

  function updateRepoIndex(nextRepos: RepoInfo[]) {
    setRepos(nextRepos);
    saveRepoIndexCache(settings.rootDirs, nextRepos);
  }

  function saveRepoMapping(scope: MappingScope, displayName: string) {
    if (!editingRepo) return;
    setSettings((current) => ({
      ...current,
      projectNamesText: upsertRepoMapping(current.projectNamesText, editingRepo, scope, displayName),
    }));
    setStatus(displayName.trim() ? `已更新「${editingRepo.name}」的映射名称` : `已清除「${editingRepo.name}」的映射名称`);
    setEditingRepo(null);
  }

  function scheduleSecureAiApiKeySync(value: string) {
    if (aiApiKeySaveTimer.current !== null) {
      window.clearTimeout(aiApiKeySaveTimer.current);
    }
    aiApiKeySaveTimer.current = window.setTimeout(() => {
      aiApiKeySaveTimer.current = null;
      void persistSecureAiApiKey(value);
    }, 500);
  }

  async function persistSecureAiApiKey(value: string) {
    const apiKey = value.trim();
    try {
      if (!apiKey || isAiKeyReference(apiKey)) {
        await invoke("clear_secure_ai_api_key");
        setSettings((current) => ({ ...current, aiApiKeySaved: false }));
        return;
      }

      await invoke("set_secure_ai_api_key", { apiKey });
      setSettings((current) => {
        if (current.aiApiKey.trim() !== apiKey) return current;
        return { ...current, aiApiKeySaved: true };
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), { tone: "error", notify: true, duration: 4200 });
    }
  }

  function scheduleSecureProxyPasswordSync(value: string) {
    if (proxyPasswordSaveTimer.current !== null) {
      window.clearTimeout(proxyPasswordSaveTimer.current);
    }
    proxyPasswordSaveTimer.current = window.setTimeout(() => {
      proxyPasswordSaveTimer.current = null;
      void persistSecureProxyPassword(value);
    }, 500);
  }

  async function persistSecureProxyPassword(value: string) {
    const password = value.trim();
    try {
      if (!password) {
        await invoke("clear_secure_proxy_password");
        setSettings((current) => ({ ...current, proxyPasswordSaved: false }));
        return;
      }

      await invoke("set_secure_proxy_password", { password });
      setSettings((current) => {
        if (current.proxyPassword.trim() !== password) return current;
        return { ...current, proxyPasswordSaved: true };
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), { tone: "error", notify: true, duration: 4200 });
    }
  }

  if (!settings.onboardingDone) {
    return (
      <OnboardingWizard
        settings={settings}
        repos={repos}
        isBusy={isBusy}
        updateSetting={updateSetting}
        onAddRootDirs={addRootDirs}
        onRemoveRootDir={removeRootDir}
        onComplete={() => updateSetting("onboardingDone", true)}
      />
    );
  }

  const showUpdateBanner = Boolean(updateSummary) && !updateBannerDismissed;



  function handleGenerateDailyFromCalendar(date: string) {
    setBlankDayDraftActive(false);
    setActivePreview("summary");
    void extractCommits(date);
  }

  function handleOpenBlankDayFillFromCalendar(date: string) {
    setDailyDate(date);
    setActivePreview("summary");
    setBlankDayOpen(true);
  }
function handleBlankDayGenerated(payload: {
    draftText: string;
    targetDate: string;
    sourceRange: DateRange;
    commitCount: number;
    repoCount: number;
  }) {
    const entry: ReportHistoryEntry = {
      id: createHistoryId(),
      mode: "summary",
      title: `空白日补写 · ${payload.targetDate}`,
      range: getSingleDayRange(payload.targetDate),
      periodLabel: `补写草稿 · ${payload.targetDate}`,
      generatedAt: new Date().toISOString(),
      repoCount: payload.repoCount,
      projectCount: payload.repoCount,
      commitCount: payload.commitCount,
      aiEnhanced: true,
      outputFile: "",
      reportText: payload.draftText,
    };
    rememberHistory(entry);
    setStatus(`空白日补写草稿已生成：${payload.targetDate}`);
  }

  function handleBlankDayApply(draftText: string, targetDate: string) {
    if (summaryText.trim() && !window.confirm("将用补写草稿替换当前预览内容？")) {
      return;
    }
    setDailyDate(targetDate);
    setSummaryText(draftText);
    setWarnings([]);
    setLastOutputFile("");
    setCommitCount(0);
    setProjectCount(0);
    setBlankDayDraftActive(true);
    setActivePreview("summary");
    setBlankDayOpen(false);
    setStatus(`已应用空白日补写草稿：${targetDate}`);
  }
  return (
    <main className="app-root">
      <AppMessageHost message={appMessage} onDismiss={dismissAppMessage} />
      {showUpdateBanner && updateSummary && (
        <UpdateBanner
          version={updateSummary.version}
          updateBusy={updateBusy}
          updateProgress={updateProgress}
          updateMessage={updateMessage}
          onInstall={installUpdate}
          onViewDetails={() => {
            setUpdateBannerDismissed(true);
            setSettingsOpen(true);
          }}
          onDismiss={() => setUpdateBannerDismissed(true)}
        />
      )}

      <Workbench
        repos={repos}
        projectNames={projectNames}
        previewText={previewText}
        activePreview={activePreview}
        status={status}
        warnings={warnings}
        isBusy={isBusy}
        isRepoScanning={isRepoScanning}
        scanProgress={scanProgress}
        extractProgress={extractProgress}
        lastOutputFile={lastOutputFile}
        summaryText={activePreview === "weekly" ? weeklyReport : activePreview === "custom" ? customReport : summaryText}
        reportHistory={reportHistory}
        activeHistoryId={activeHistoryId}
        rootDirs={settings.rootDirs}
        repoCount={repos.length}
        commitCount={commitCount}
        blankDayDraftActive={blankDayDraftActive}
        projectCount={projectCount}
        author={settings.author}
        dailyDate={dailyDate}
        onDailyDateChange={changeDailyDate}
        weeklyRange={weeklyRange}
        weeklyWeek={weeklyWeek}
        onWeeklyWeekChange={changeWeeklyWeek}
        monthlyMonth={monthlyMonth}
        onMonthlyMonthChange={changeMonthlyMonth}
        monthlyRange={monthlyRange}
        customRange={customRange}
        supplementalItemsText={supplementalItemsText}
        onSupplementalItemsChange={changeSupplementalItems}
        aiConfigured={aiConfigured}
        extractAllBranches={settings.extractAllBranches}
        showEvidenceDetails={settings.showEvidenceDetails}
        redactionEnabled={settings.redactionEnabled}
        outputEnabled={settings.outputEnabled}
        outputDir={settings.outputDir}
        onExtract={extractCommits}
        onGenerateWeekly={generateWeeklyReport}
        onGenerateCustom={generateCustomReport}
        onGenerateMonthly={generateMonthlyReport}
        onPolish={polishReport}
        onCopy={copyPreview}
        onExport={saveReport}
        onOpenHistory={openReportHistory}
        onCopyHistory={copyReportHistory}
        onRegenerateHistory={regenerateReportHistory}
        onClearHistory={clearHistoryRecords}
        canExport={settings.outputEnabled && Boolean(settings.outputDir.trim())}
        disabledRepos={settings.disabledRepos}
        onToggleRepo={toggleRepo}
        onEditRepo={setEditingRepo}
        onRefreshRepos={scanWorkspace}
        onCancelRepoScan={cancelRepoScan}
        onAddRootDirs={addRootDirs}
        onPreviewChange={changePreview}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenBatch={() => setBatchOpen(true)}
        onOpenBlankDayFill={() => setBlankDayOpen(true)}
        onGenerateDailyFromCalendar={handleGenerateDailyFromCalendar}
        onOpenBlankDayFillFromCalendar={handleOpenBlankDayFillFromCalendar}
      />
      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        repos={repos}
        currentVersion={appVersion}
        updateSummary={updateSummary}
        updateMessage={updateMessage}
        updateProgress={updateProgress}
        updateBusy={updateBusy}
        updateSetting={updateSetting}
        onAddRootDirs={addRootDirs}
        onRemoveRootDir={removeRootDir}
        onChooseOutputDir={chooseOutputDir}
        onCheckForUpdates={checkForUpdates}
        onInstallUpdate={installUpdate}
        onClearHistory={clearHistoryRecords}
        onClose={() => setSettingsOpen(false)}
      />
      <BatchDialog
        open={batchOpen}
        settings={settings}
        indexedRepos={repos}
        onNotify={(message, tone) => showMessage(message, tone, 1800)}
        onClose={() => setBatchOpen(false)}
      />
      <BlankDayFillDialog
        open={blankDayOpen}
        settings={settings}
        indexedRepos={repos}
        targetDate={dailyDate}
        aiConfigured={aiConfigured}
        onClose={() => setBlankDayOpen(false)}
        onOpenSettings={() => {
          setBlankDayOpen(false);
          setSettingsOpen(true);
        }}
        onGenerated={handleBlankDayGenerated}
        onApply={handleBlankDayApply}
        onNotify={(message, tone) => showMessage(message, tone, 1800)}
      />
      <RepoMappingDialog
        open={editingRepo !== null}
        repo={editingRepo}
        projectNamesText={settings.projectNamesText}
        onClose={() => setEditingRepo(null)}
        onConfirm={saveRepoMapping}
      />
    </main>
  );
}

function activePreviewRange(
  mode: PreviewMode,
  dailyRange: DateRange,
  weeklyRange: DateRange,
  monthlyRange: DateRange,
  customRange: DateRange,
) {
  if (mode === "weekly") return weeklyRange;
  if (mode === "monthly") return monthlyRange;
  if (mode === "custom") return customRange;
  return dailyRange;
}

function activePreviewPeriodLabel(
  mode: PreviewMode,
  dailyDate: string,
  weeklyWeek: string,
  monthlyMonth: string,
  customRange: DateRange,
) {
  if (mode === "weekly") return weeklyWeek;
  if (mode === "monthly") return formatMonthLabel(monthlyMonth);
  if (mode === "custom") return `${customRange.startDate} ~ ${customRange.endDate}`;
  return dailyDate;
}

function activePreviewBaseName(mode: PreviewMode, range: DateRange, periodLabel: string) {
  if (mode === "monthly") return `monthly_report_${periodLabel}`;
  if (mode === "weekly") return `weekly_report_${periodLabel}`;
  return `git_commits_${range.startDate}_to_${range.endDate}`;
}

function shouldNotifyStatus(message: string) {
  const trimmed = message.trim();
  if (!trimmed || trimmed === "就绪") return false;
  if (trimmed.startsWith("正在扫描仓库：") || trimmed.startsWith("正在提取提交：")) return false;
  return true;
}

function inferMessageTone(message: string): AppMessageTone {
  if (message.includes("失败") || message.includes("错误") || message.includes("无效") || message.includes("无法")) return "error";
  if (message.includes("请选择") || message.includes("请输入") || message.includes("请先") || message.includes("不能为空")) return "warning";
  if (message.includes("取消") || message.includes("未写入") || message.includes("未读取") || message.includes("待配置")) return "warning";
  if (message.startsWith("正在")) return "loading";
  if (message.includes("已") || message.includes("完成") || message.includes("生成")) return "success";
  return "info";
}

function hasAiWarning(warnings: string[]) {
  return warnings.some((warning) => warning.includes("AI 润色失败"));
}


function createHistoryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatHistoryTitle(mode: PreviewMode, periodLabel: string, range: DateRange) {
  if (mode === "monthly") return `月报 · ${periodLabel}`;
  if (mode === "weekly") return `周报 · ${periodLabel}`;
  if (mode === "custom") return `自定义 · ${range.startDate} ~ ${range.endDate}`;
  return `日报 · ${range.startDate}`;
}

function formatReportExportLabel(format: ReportExportFormat) {
  if (format === "docx") return "Word 文档";
  if (format === "pdf") return "PDF";
  return "Markdown";
}

function formatExtractProgress(progress: CommitExtractProgress) {
  const total = progress.totalRepos;
  if (total === 0) return "没有启用的仓库可提取";
  const current = progress.currentRepo ? ` · 刚完成 ${progress.currentRepo}` : "";
  return `正在提取提交：${progress.completedRepos}/${total} 仓库 · ${progress.concurrency} 并发 · ${progress.commitCount} 条提交${current}`;
}

export default App;
