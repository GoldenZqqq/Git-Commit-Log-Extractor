import { CheckCircle2, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import type { ConfigProfileSettings } from "../configProfile";
import { useAiSettingsController } from "../hooks/useAiSettingsController";
import { useDiagnosticsPanel } from "../hooks/useDiagnosticsPanel";
import { useModalDialog } from "../hooks/useOverlayFocus";
import {
  buildMappingKeys,
  buildMappingSuggestions,
  mergeMappingEntries,
  parseMappingText,
  serializeMappingText,
  type AppSettings,
  type MappingEntry,
  type MappingSuggestion,
  type RepoInfo,
  type SupportBundleEventInput,
  type UpdateSummary,
} from "../model";
import { AiSettingsTab } from "./AiSettingsTab";
import { DiagnosticsSettingsTab } from "./DiagnosticsSettingsTab";
import { GeneralSettingsTab } from "./GeneralSettingsTab";
import { MappingSettingsTab, type MappingOption } from "./MappingSettingsTab";
import { ReportFormatSettings } from "./ReportFormatSettings";
import { SettingsTabNav, type SettingsTab } from "./SettingsTabNav";
import { WorkspaceSettingsTab } from "./WorkspaceSettingsTab";

type Props = {
  open: boolean;
  settings: AppSettings;
  repos: RepoInfo[];
  recentEvents: SupportBundleEventInput[];
  currentVersion: string;
  updateSummary: UpdateSummary | null;
  updateMessage: string;
  updateProgress: string;
  updateBusy: "checking" | "installing" | null;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onApplyConfigProfile: (settings: ConfigProfileSettings) => void;
  onAddRootDirs: () => void;
  onRemoveRootDir: (dir: string) => void;
  onChooseOutputDir: () => void;
  onCheckForUpdates: () => void;
  onInstallUpdate: () => void;
  onClearHistory: () => void;
  onClose: () => void;
};

export function SettingsDialog({
  open,
  settings,
  repos,
  recentEvents,
  currentVersion,
  updateSummary,
  updateMessage,
  updateProgress,
  updateBusy,
  updateSetting,
  onApplyConfigProfile,
  onAddRootDirs,
  onRemoveRootDir,
  onChooseOutputDir,
  onCheckForUpdates,
  onInstallUpdate,
  onClearHistory,
  onClose,
}: Props) {
  const [importNote, setImportNote] = useState("");
  const [activeTab, setActiveTab] = useState<SettingsTab>("workspace");
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [savedPulse, setSavedPulse] = useState(false);
  const lastSettingsRef = useRef(settings);
  const settingsDialogRef = useModalDialog({ open, onClose });
  const confirmDialogRef = useModalDialog({
    open: open && pendingDeleteIndex !== null,
    onClose: () => setPendingDeleteIndex(null),
  });
  const aiController = useAiSettingsController({ open, settings, updateSetting });
  const diagnostics = useDiagnosticsPanel({
    open,
    active: activeTab === "diagnostics",
    settings,
    repos,
  });

  useEffect(() => {
    if (open) return;
    setImportNote("");
    setActiveTab("workspace");
    setPendingDeleteIndex(null);
    setSavedPulse(false);
  }, [open]);

  // 设置全程自动保存，这里只反馈当前面板会话内的实际变更。
  useEffect(() => {
    if (!open) {
      lastSettingsRef.current = settings;
      return;
    }
    if (lastSettingsRef.current === settings) return;
    lastSettingsRef.current = settings;
    setSavedPulse(true);
    const timer = window.setTimeout(() => setSavedPulse(false), 1500);
    return () => window.clearTimeout(timer);
  }, [open, settings]);

  if (!open) return null;

  const mappingRows = parseMappingText(settings.projectNamesText);
  const visibleMappingRows = mappingRows.length > 0 ? mappingRows : [{ key: "", displayName: "" }];
  const mappingOptions = buildMappingOptions(repos, mappingRows);
  const mappingSuggestions = buildMappingSuggestions(repos, mappingRows);

  function updateMappingRow(index: number, patch: Partial<MappingEntry>) {
    const rows = visibleMappingRows.map((row) => ({ ...row }));
    rows[index] = { ...rows[index], ...patch };
    updateSetting("projectNamesText", serializeMappingText(rows));
  }

  function addMappingRow() {
    updateSetting("projectNamesText", serializeMappingText([...visibleMappingRows, { key: "", displayName: "" }]));
  }

  function removeMappingRow(index: number) {
    updateSetting("projectNamesText", serializeMappingText(visibleMappingRows.filter((_, rowIndex) => rowIndex !== index)));
  }

  function confirmRemoveMapping() {
    if (pendingDeleteIndex === null) return;
    removeMappingRow(pendingDeleteIndex);
    setPendingDeleteIndex(null);
  }

  function applyMappingSuggestion(suggestion: MappingSuggestion) {
    updateSetting("projectNamesText", serializeMappingText([
      ...mappingRows,
      { key: suggestion.key, displayName: suggestion.displayName },
    ]));
    setImportNote(`已填入建议：${suggestion.displayName}`);
  }

  function applyAllMappingSuggestions() {
    if (mappingSuggestions.length === 0) return;
    updateSetting("projectNamesText", serializeMappingText([
      ...mappingRows,
      ...mappingSuggestions.map(({ key, displayName }) => ({ key, displayName })),
    ]));
    setImportNote(`已填入 ${mappingSuggestions.length} 条映射建议`);
  }

  async function importMappingFile() {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: "Excel 工作簿", extensions: ["xlsx"] }],
      });
      if (typeof selected !== "string") return;
      const entries = await invoke<MappingEntry[]>("read_mapping_xlsx", { path: selected });
      if (entries.length === 0) {
        setImportNote("未读取到映射，请确认已在「显示名称」列填写内容");
        return;
      }
      updateSetting("projectNamesText", mergeMappingEntries(settings.projectNamesText, entries));
      setImportNote(`已导入 ${entries.length} 条映射`);
    } catch (error) {
      setImportNote(error instanceof Error ? error.message : String(error));
    }
  }

  async function downloadTemplate() {
    try {
      const path = await saveDialog({
        defaultPath: "gitpulse-映射模板.xlsx",
        filters: [{ name: "Excel 工作簿", extensions: ["xlsx"] }],
      });
      if (typeof path !== "string") return;
      await invoke("write_mapping_template_xlsx", { path, keys: buildMappingKeys(repos) });
      setImportNote(`模板已保存：${path}`);
    } catch (error) {
      setImportNote(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
        <section
          ref={settingsDialogRef}
          className="settings-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-dialog-title"
          tabIndex={-1}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="dialog-header">
            <div><p className="kicker">Preferences</p><h2 id="settings-dialog-title">设置</h2></div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="关闭设置"><X size={18} /></button>
          </header>
          <div className="settings-body">
            <SettingsTabNav activeTab={activeTab} onChange={setActiveTab} />
            <div className="settings-content" key={activeTab}>
              {activeTab === "workspace" && (
                <WorkspaceSettingsTab
                  settings={settings}
                  updateSetting={updateSetting}
                  onAddRootDirs={onAddRootDirs}
                  onRemoveRootDir={onRemoveRootDir}
                  onChooseOutputDir={onChooseOutputDir}
                />
              )}
              {activeTab === "format" && <ReportFormatSettings settings={settings} updateSetting={updateSetting} />}
              {activeTab === "ai" && <AiSettingsTab settings={settings} updateSetting={updateSetting} controller={aiController} />}
              {activeTab === "mapping" && (
                <MappingSettingsTab
                  repos={repos}
                  mappingSuggestions={mappingSuggestions}
                  visibleMappingRows={visibleMappingRows}
                  mappingOptions={mappingOptions}
                  importNote={importNote}
                  onApplySuggestion={applyMappingSuggestion}
                  onApplyAllSuggestions={applyAllMappingSuggestions}
                  onUpdateRow={updateMappingRow}
                  onRequestRemove={setPendingDeleteIndex}
                  onAddRow={addMappingRow}
                  onDownloadTemplate={() => void downloadTemplate()}
                  onImportFile={() => void importMappingFile()}
                />
              )}
              {activeTab === "diagnostics" && (
                <DiagnosticsSettingsTab settings={settings} repos={repos} recentEvents={recentEvents} diagnostics={diagnostics} />
              )}
              {activeTab === "general" && (
                <GeneralSettingsTab
                  settings={settings}
                  updateSetting={updateSetting}
                  onApplyConfigProfile={onApplyConfigProfile}
                  onClearHistory={onClearHistory}
                  currentVersion={currentVersion}
                  updateSummary={updateSummary}
                  updateMessage={updateMessage}
                  updateProgress={updateProgress}
                  updateBusy={updateBusy}
                  onCheckForUpdates={onCheckForUpdates}
                  onInstallUpdate={onInstallUpdate}
                />
              )}
            </div>
          </div>
          <footer className="settings-footer">
            <span className={`settings-save-state ${savedPulse ? "pulse" : ""}`}>
              <CheckCircle2 size={14} />
              改动自动保存到本机
            </span>
          </footer>
        </section>
      </div>
      {pendingDeleteIndex !== null && (
        <div
          className="dialog-backdrop compact-backdrop confirm-backdrop"
          role="presentation"
          onMouseDown={() => setPendingDeleteIndex(null)}
        >
          <section
            ref={confirmDialogRef}
            className="range-dialog confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mapping-delete-title"
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="range-dialog-header">
              <div><p className="kicker">Delete Mapping</p><h2 id="mapping-delete-title">删除这条映射？</h2></div>
              <button className="icon-button" type="button" onClick={() => setPendingDeleteIndex(null)} aria-label="取消删除"><X size={17} /></button>
            </header>
            <p className="confirm-dialog-text">删除后该项目映射将立即移除，此操作不可撤销。</p>
            <footer className="range-dialog-actions">
              <button data-dialog-initial-focus type="button" className="mapping-import" onClick={() => setPendingDeleteIndex(null)}>取消</button>
              <button type="button" className="danger-button" onClick={confirmRemoveMapping}><Trash2 size={16} />确定删除</button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function buildMappingOptions(repos: RepoInfo[], rows: MappingEntry[]): MappingOption[] {
  const options = new Map<string, string>();
  for (const repo of repos) {
    const wildcardKey = `${repo.name}(*)`;
    options.set(wildcardKey, `${repo.name} · 全部分支 (*)`);
    if (repo.branch) options.set(`${repo.name}(${repo.branch})`, `${repo.name} · ${repo.branch}`);
  }
  for (const row of rows) {
    if (row.key && !options.has(row.key)) options.set(row.key, row.key);
  }
  return [...options.entries()].map(([value, label]) => ({ value, label }));
}
