import { isSupplementalItemsValue } from "../supplementalItems";
import type {
  DateRange,
  LegacyReportHistoryState,
  PreviewMode,
  ReportHistoryEntry,
  ReportHistoryLimit,
  ReportHistoryProject,
} from "./types";

export const REPORT_HISTORY_KEY = "gitpulse-report-history";
export const REPORT_HISTORY_LIMIT_OPTIONS: ReportHistoryLimit[] = [30, 60, 120, 200];
export const DEFAULT_REPORT_HISTORY_LIMIT: ReportHistoryLimit = 120;

export function normalizeReportHistoryLimit(value: unknown): ReportHistoryLimit {
  const numeric = typeof value === "number" ? value : Number(value);
  return numeric === 30 || numeric === 60 || numeric === 120 || numeric === 200
    ? numeric
    : DEFAULT_REPORT_HISTORY_LIMIT;
}

export function readLegacyReportHistory(limit: ReportHistoryLimit = DEFAULT_REPORT_HISTORY_LIMIT): LegacyReportHistoryState {
  const saved = localStorage.getItem(REPORT_HISTORY_KEY);
  if (saved === null) return { entries: [], present: false, valid: true, warning: "" };
  let rawHistory: unknown;
  try {
    rawHistory = JSON.parse(saved);
  } catch {
    return invalidLegacyHistory("旧报告历史不是有效 JSON，已保留原数据供手动恢复");
  }
  if (!Array.isArray(rawHistory) || !rawHistory.every(isReportHistoryEntry)) {
    return invalidLegacyHistory("旧报告历史格式异常，已保留原数据供手动恢复");
  }
  return { entries: normalizeReportHistoryEntries(rawHistory, limit), present: true, valid: true, warning: "" };
}

export function normalizeReportHistoryEntries(
  entries: ReportHistoryEntry[],
  limit: ReportHistoryLimit = DEFAULT_REPORT_HISTORY_LIMIT,
): ReportHistoryEntry[] {
  const ids = new Set<string>();
  return entries
    .filter(isReportHistoryEntry)
    .filter((entry) => {
      if (ids.has(entry.id)) return false;
      ids.add(entry.id);
      return true;
    })
    .slice(0, normalizeReportHistoryLimit(limit));
}

export function rememberReportHistoryEntry(
  entries: ReportHistoryEntry[],
  entry: ReportHistoryEntry,
  limit: ReportHistoryLimit = DEFAULT_REPORT_HISTORY_LIMIT,
): ReportHistoryEntry[] {
  return normalizeReportHistoryEntries([entry, ...entries.filter((item) => item.id !== entry.id)], limit);
}

export function updateReportHistoryEntry(
  entries: ReportHistoryEntry[],
  id: string,
  patch: Partial<Pick<ReportHistoryEntry, "outputFile" | "reportText" | "commitCount" | "generatedAt">>,
  limit: ReportHistoryLimit = DEFAULT_REPORT_HISTORY_LIMIT,
): ReportHistoryEntry[] {
  if (!id) return entries;
  return normalizeReportHistoryEntries(entries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry), limit);
}

export function clearLegacyReportHistory() {
  localStorage.removeItem(REPORT_HISTORY_KEY);
}

export function isBlankDayHistoryEntry(entry: ReportHistoryEntry) {
  return entry.title.startsWith("空白日补写") || entry.periodLabel.includes("补写草稿");
}

export function getReportCalendarAnchorDate(entry: ReportHistoryEntry) {
  return entry.mode === "summary" ? entry.range.startDate : entry.range.endDate || entry.range.startDate;
}

export function getReportCalendarKind(entry: ReportHistoryEntry): "daily" | "blank" | "weekly" | "monthly" | "custom" {
  if (entry.mode === "weekly" || entry.mode === "monthly" || entry.mode === "custom") return entry.mode;
  return isBlankDayHistoryEntry(entry) ? "blank" : "daily";
}

export function groupReportHistoryByAnchorDate(entries: ReportHistoryEntry[]) {
  const map = new Map<string, ReportHistoryEntry[]>();
  for (const entry of entries) {
    const day = getReportCalendarAnchorDate(entry);
    if (!day) continue;
    map.set(day, [...(map.get(day) ?? []), entry]);
  }
  for (const [day, list] of map) {
    map.set(day, list.sort((left, right) => right.generatedAt.localeCompare(left.generatedAt)));
  }
  return map;
}

function invalidLegacyHistory(warning: string): LegacyReportHistoryState {
  return { entries: [], present: true, valid: false, warning };
}

function isReportHistoryEntry(value: unknown): value is ReportHistoryEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Partial<ReportHistoryEntry>;
  return isNonEmptyString(entry.id)
    && isPreviewMode(entry.mode)
    && isNonEmptyString(entry.title)
    && isDateRange(entry.range)
    && typeof entry.periodLabel === "string"
    && isNonEmptyString(entry.generatedAt)
    && Number.isFinite(entry.repoCount)
    && Number.isFinite(entry.commitCount)
    && typeof entry.aiEnhanced === "boolean"
    && typeof entry.outputFile === "string"
    && typeof entry.reportText === "string"
    && isSupplementalItemsValue(entry.supplementalItems)
    && isReportHistoryProjectsValue(entry.projects);
}

function isReportHistoryProjectsValue(value: unknown): value is ReportHistoryProject[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every(isReportHistoryProject));
}

function isReportHistoryProject(value: unknown): value is ReportHistoryProject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const project = value as Partial<ReportHistoryProject>;
  return isNonEmptyString(project.name)
    && Number.isInteger(project.commitCount)
    && (project.commitCount ?? -1) >= 0
    && Array.isArray(project.evidenceIds)
    && project.evidenceIds.length <= 20
    && project.evidenceIds.every(isNonEmptyString);
}

function isPreviewMode(value: unknown): value is PreviewMode {
  return value === "summary" || value === "weekly" || value === "custom" || value === "monthly";
}

function isDateRange(value: unknown): value is DateRange {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const range = value as Partial<DateRange>;
  return typeof range.startDate === "string" && typeof range.endDate === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
