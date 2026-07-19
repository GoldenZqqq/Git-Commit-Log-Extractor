import { formatMonthLabel, type DateRange, type PreviewMode, type ReportExportFormat, type ReportHistoryProject } from "./model";

export type HistoryEntryInput = {
  mode: PreviewMode;
  range: DateRange;
  periodLabel: string;
  reportText: string;
  commitCount: number;
  projectCount: number;
  aiEnhanced: boolean;
  outputFile?: string;
  supplementalItems?: string[];
  projects?: ReportHistoryProject[];
};

export function activePreviewRange(
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

export function activePreviewPeriodLabel(
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

export function activePreviewBaseName(mode: PreviewMode, range: DateRange, periodLabel: string) {
  if (mode === "monthly") return `monthly_report_${periodLabel}`;
  if (mode === "weekly") return `weekly_report_${periodLabel}`;
  return `git_commits_${range.startDate}_to_${range.endDate}`;
}

export async function copyText(text: string, errorMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    throw new Error(errorMessage);
  }
}

export function hasAiWarning(warnings: string[]) {
  return warnings.some((warning) => warning.includes("AI 润色失败"));
}

export function createHistoryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function formatHistoryTitle(mode: PreviewMode, periodLabel: string, range: DateRange) {
  if (mode === "monthly") return `月报 · ${periodLabel}`;
  if (mode === "weekly") return `周报 · ${periodLabel}`;
  if (mode === "custom") return `自定义 · ${range.startDate} ~ ${range.endDate}`;
  return `日报 · ${range.startDate}`;
}

export function formatReportExportLabel(format: ReportExportFormat) {
  if (format === "docx") return "Word 文档";
  if (format === "pdf") return "PDF";
  return "Markdown";
}
