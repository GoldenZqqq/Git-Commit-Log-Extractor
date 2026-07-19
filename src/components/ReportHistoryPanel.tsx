import {
  Clipboard,
  History,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import type { PreviewMode, ReportHistoryEntry } from "../model";
import { PanelTitle } from "./PanelTitle";
import { getHistoryKindLabel } from "./WorkbenchControls";

type Props = {
  entries: ReportHistoryEntry[];
  activeHistoryId: string;
  generationBlocked: boolean;
  reportLocked: boolean;
  onOpen: (entry: ReportHistoryEntry) => void;
  onCopy: (entry: ReportHistoryEntry) => void;
  onRegenerate: (entry: ReportHistoryEntry) => void;
  onClear: () => void;
};

type HistoryFilters = {
  searchText: string;
  kindFilter: PreviewMode | "all";
  dateFilter: string;
  aiFilter: "all" | "ai" | "plain";
  exportFilter: "all" | "exported" | "pending";
};

export function ReportHistoryPanel({
  entries,
  activeHistoryId,
  generationBlocked,
  reportLocked,
  onOpen,
  onCopy,
  onRegenerate,
  onClear,
}: Props) {
  const [searchText, setSearchText] = useState("");
  const [kindFilter, setKindFilter] = useState<PreviewMode | "all">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [aiFilter, setAiFilter] = useState<"all" | "ai" | "plain">("all");
  const [exportFilter, setExportFilter] = useState<"all" | "exported" | "pending">("all");
  const hasFilters = searchText.trim() !== ""
    || kindFilter !== "all"
    || dateFilter !== ""
    || aiFilter !== "all"
    || exportFilter !== "all";
  const filters = { searchText, kindFilter, dateFilter, aiFilter, exportFilter };
  const filteredEntries = entries.filter((entry) => historyEntryMatchesFilters(entry, filters));

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
        meta={entries.length > 0
          ? (hasFilters ? `${filteredEntries.length}/${entries.length} 条` : `${entries.length} 条`)
          : "生成后自动记录"}
        action={(
          <button
            className="history-clear-button"
            type="button"
            onClick={onClear}
            disabled={entries.length === 0 || generationBlocked || reportLocked}
          >
            <Trash2 size={13} />
            清空
          </button>
        )}
      />
      {entries.length === 0 ? (
        <p className="history-empty">暂无历史报告，生成后可在此打开、复制或重新生成。</p>
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
            <p className="history-empty">没有匹配记录，请调整筛选。</p>
          ) : (
            <HistoryList
              entries={filteredEntries}
              activeHistoryId={activeHistoryId}
              generationBlocked={generationBlocked}
              reportLocked={reportLocked}
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
      <select
        value={filters.kindFilter}
        aria-label="筛选报告类型"
        onChange={(event) => onKindFilterChange(event.target.value as PreviewMode | "all")}
      >
        <option value="all">全部类型</option>
        <option value="summary">日报</option>
        <option value="weekly">周报</option>
        <option value="monthly">月报</option>
        <option value="custom">自定义</option>
      </select>
      <input
        type="date"
        value={filters.dateFilter}
        aria-label="筛选历史日期"
        onChange={(event) => onDateFilterChange(event.target.value)}
      />
      <select
        value={filters.aiFilter}
        aria-label="筛选 AI 状态"
        onChange={(event) => onAiFilterChange(event.target.value as HistoryFilters["aiFilter"])}
      >
        <option value="all">全部 AI</option>
        <option value="ai">AI 润色</option>
        <option value="plain">未润色</option>
      </select>
      <select
        value={filters.exportFilter}
        aria-label="筛选导出状态"
        onChange={(event) => onExportFilterChange(event.target.value as HistoryFilters["exportFilter"])}
      >
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

function HistoryList({
  entries,
  activeHistoryId,
  generationBlocked,
  reportLocked,
  onOpen,
  onCopy,
  onRegenerate,
}: Omit<Props, "onClear">) {
  return (
    <div className="history-list">
      {entries.map((entry) => (
        <HistoryRow
          key={entry.id}
          entry={entry}
          active={entry.id === activeHistoryId}
          generationBlocked={generationBlocked}
          reportLocked={reportLocked}
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
  generationBlocked,
  reportLocked,
  onOpen,
  onCopy,
  onRegenerate,
}: {
  entry: ReportHistoryEntry;
  active: boolean;
  generationBlocked: boolean;
  reportLocked: boolean;
  onOpen: Props["onOpen"];
  onCopy: Props["onCopy"];
  onRegenerate: Props["onRegenerate"];
}) {
  return (
    <article className={`history-row ${active ? "active" : ""}`}>
      <button
        className="history-open-button"
        type="button"
        onClick={() => onOpen(entry)}
        disabled={reportLocked}
        aria-pressed={active}
        title="打开这份历史报告"
      >
        <span className="history-kind">{getHistoryKindLabel(entry.mode)}</span>
        <span className="history-mainline">
          <strong>{entry.title}</strong>
          {entry.aiEnhanced && <em className="history-badge ai">AI</em>}
          {entry.outputFile && <em className="history-badge exported">已导出</em>}
        </span>
        <span className="history-subline">
          {formatHistoryTime(entry.generatedAt)} · {formatHistoryRange(entry)}
        </span>
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
        <button
          type="button"
          onClick={() => onRegenerate(entry)}
          disabled={generationBlocked}
          title="按该周期重新生成"
        >
          <RotateCcw size={13} />
          重跑
        </button>
      </div>
    </article>
  );
}

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
