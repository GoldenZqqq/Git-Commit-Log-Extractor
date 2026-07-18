import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  type LegacyReportHistoryState,
  type ReportHistoryEntry,
  type ReportHistoryLimit,
  clearLegacyReportHistory,
  normalizeReportHistoryEntries,
  readLegacyReportHistory,
  rememberReportHistoryEntry,
  updateReportHistoryEntry,
} from "../model";

type HistoryPatch = Partial<Pick<ReportHistoryEntry, "outputFile" | "reportText" | "commitCount" | "generatedAt">>;

type ReportHistoryLoadResult = {
  entries: ReportHistoryEntry[];
  migrationComplete: boolean;
  recoveredFromBackup: boolean;
  warning: string | null;
};

type StorageContext = {
  entriesRef: MutableRefObject<ReportHistoryEntry[]>;
  storageEntriesRef: MutableRefObject<ReportHistoryEntry[]>;
  limitRef: MutableRefObject<ReportHistoryLimit>;
  queueRef: MutableRefObject<Promise<void>>;
  initializationRef: MutableRefObject<Promise<void>>;
  revisionRef: MutableRefObject<number>;
  warningRef: MutableRefObject<(message: string) => void>;
  setEntries: Dispatch<SetStateAction<ReportHistoryEntry[]>>;
};

type SaveRequest = {
  transform: (entries: ReportHistoryEntry[]) => ReportHistoryEntry[];
  limit: ReportHistoryLimit;
  revision: number;
};

export function useReportHistoryStorage(initialLimit: ReportHistoryLimit, onWarning: (message: string) => void) {
  const [legacy] = useState<LegacyReportHistoryState>(() => readLegacyReportHistory(initialLimit));
  const [entries, setEntries] = useState(() => (legacy.valid ? legacy.entries : []));
  const context: StorageContext = {
    entriesRef: useRef(entries),
    storageEntriesRef: useRef(entries),
    limitRef: useRef(initialLimit),
    queueRef: useRef(Promise.resolve()),
    initializationRef: useRef(Promise.resolve()),
    revisionRef: useRef(0),
    warningRef: useRef(onWarning),
    setEntries,
  };
  context.warningRef.current = onWarning;
  useReportHistoryLoader(context, legacy);
  return { entries, ...useReportHistoryActions(context) };
}

function useReportHistoryLoader(context: StorageContext, legacy: LegacyReportHistoryState) {
  const requestRef = useRef(0);
  useEffect(() => {
    const requestId = ++requestRef.current;
    const revision = context.revisionRef.current;
    if (!legacy.valid) context.warningRef.current(legacy.warning);
    const load = invoke<ReportHistoryLoadResult>("load_report_history", {
      legacyEntries: legacy.present && legacy.valid ? legacy.entries : null,
      limit: context.limitRef.current,
    }).then((result) => {
      if (requestId === requestRef.current) {
        const loaded = normalizeReportHistoryEntries(result.entries, context.limitRef.current);
        context.storageEntriesRef.current = loaded;
        if (revision === context.revisionRef.current) replaceEntries(context, loaded);
      }
      if (result.migrationComplete && legacy.present && legacy.valid) clearLegacyReportHistory();
      if (result.warning) context.warningRef.current(result.warning);
    }).catch((error: unknown) => {
      context.warningRef.current(`报告历史文件加载失败，已保留当前可用记录：${errorText(error)}`);
    });
    context.initializationRef.current = load;
  }, []);
}

function useReportHistoryActions(context: StorageContext) {
  const remember = useCallback((entry: ReportHistoryEntry) => {
    const transform = (entries: ReportHistoryEntry[]) => rememberReportHistoryEntry(entries, entry, context.limitRef.current);
    const revision = commitEntries(context, transform(context.entriesRef.current));
    queueSave(context, { transform, limit: context.limitRef.current, revision });
  }, []);
  const update = useCallback((id: string, patch: HistoryPatch) => {
    const transform = (entries: ReportHistoryEntry[]) => updateReportHistoryEntry(entries, id, patch, context.limitRef.current);
    const revision = commitEntries(context, transform(context.entriesRef.current));
    queueSave(context, { transform, limit: context.limitRef.current, revision });
  }, []);
  const resize = useCallback((limit: ReportHistoryLimit) => {
    context.limitRef.current = limit;
    const transform = (entries: ReportHistoryEntry[]) => normalizeReportHistoryEntries(entries, limit);
    const revision = commitEntries(context, transform(context.entriesRef.current));
    queueSave(context, { transform, limit, revision });
  }, []);
  const clear = useCallback(() => clearStoredHistory(context), []);
  return { remember, update, resize, clear };
}

async function clearStoredHistory(context: StorageContext) {
  const previous = context.entriesRef.current;
  commitEntries(context, []);
  const clearRevision = context.revisionRef.current;
  const operation = queueOperation(context, async () => {
    const previousStored = context.storageEntriesRef.current;
    try {
      await invoke<void>("clear_report_history");
      context.storageEntriesRef.current = [];
    } catch (error) {
      context.storageEntriesRef.current = previousStored;
      throw error;
    }
  });
  try {
    await operation;
    return true;
  } catch (error) {
    if (context.revisionRef.current === clearRevision) commitEntries(context, previous);
    context.warningRef.current(`清空报告历史失败，已保留原记录：${errorText(error)}`);
    return false;
  }
}

function queueSave(context: StorageContext, request: SaveRequest) {
  const operation = queueOperation(context, async () => {
    const entries = request.transform(context.storageEntriesRef.current);
    context.storageEntriesRef.current = entries;
    const saved = await invoke<ReportHistoryEntry[]>("save_report_history", { entries, limit: request.limit });
    const normalized = normalizeReportHistoryEntries(saved, request.limit);
    context.storageEntriesRef.current = normalized;
    return normalized;
  });
  void operation.then((saved) => {
    if (context.revisionRef.current === request.revision) replaceEntries(context, saved);
  }).catch((error: unknown) => {
    context.warningRef.current(`报告历史未写入磁盘，当前报告仍可使用：${errorText(error)}`);
  });
}

function queueOperation<T>(context: StorageContext, operation: () => Promise<T>): Promise<T> {
  const result = context.queueRef.current
    .then(() => context.initializationRef.current)
    .then(operation);
  context.queueRef.current = result.then(() => undefined, () => undefined);
  return result;
}

function commitEntries(context: StorageContext, entries: ReportHistoryEntry[]) {
  context.revisionRef.current += 1;
  replaceEntries(context, entries);
  return context.revisionRef.current;
}

function replaceEntries(context: StorageContext, entries: ReportHistoryEntry[]) {
  context.entriesRef.current = entries;
  context.setEntries(entries);
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
