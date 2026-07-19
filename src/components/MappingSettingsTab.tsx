import { Download, FileUp, Plus, Settings2, Trash2, Wand2 } from "lucide-react";
import type { MappingEntry, MappingSuggestion, RepoInfo } from "../model";
import { Field } from "./Primitives";
import { SectionTitle } from "./SettingsPrimitives";

export type MappingOption = { value: string; label: string };

type Props = {
  repos: RepoInfo[];
  mappingSuggestions: MappingSuggestion[];
  visibleMappingRows: MappingEntry[];
  mappingOptions: MappingOption[];
  importNote: string;
  onApplySuggestion: (suggestion: MappingSuggestion) => void;
  onApplyAllSuggestions: () => void;
  onUpdateRow: (index: number, patch: Partial<MappingEntry>) => void;
  onRequestRemove: (index: number) => void;
  onAddRow: () => void;
  onDownloadTemplate: () => void;
  onImportFile: () => void;
};

export function MappingSettingsTab({
  repos,
  mappingSuggestions,
  visibleMappingRows,
  mappingOptions,
  importNote,
  onApplySuggestion,
  onApplyAllSuggestions,
  onUpdateRow,
  onRequestRemove,
  onAddRow,
  onDownloadTemplate,
  onImportFile,
}: Props) {
  return (
    <section className="settings-section mapping-section">
      <SectionTitle icon={<Settings2 size={16} />} title="项目映射" />
      <div className="mapping-editor">
        {mappingSuggestions.length > 0 && (
          <div className="mapping-suggestion-panel" aria-label="未映射仓库建议">
            <div className="mapping-suggestion-head">
              <div>
                <strong>未映射仓库建议</strong>
                <span>{mappingSuggestions.length} 个仓库待命名</span>
              </div>
              <button type="button" className="mapping-import" onClick={onApplyAllSuggestions}>
                <Wand2 size={15} />
                全部填入
              </button>
            </div>
            <div className="mapping-suggestion-list">
              {mappingSuggestions.map((suggestion) => (
                <article className="mapping-suggestion-row" key={suggestion.key}>
                  <span className="mapping-suggestion-main">
                    <strong>{suggestion.displayName}</strong>
                    <em>{suggestion.repoName}{suggestion.branch ? ` · ${suggestion.branch}` : ""}</em>
                  </span>
                  <small>{suggestion.reason}</small>
                  <button type="button" className="mapping-add" onClick={() => onApplySuggestion(suggestion)}>
                    <Wand2 size={14} />
                    填入
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
        {visibleMappingRows.map((row, index) => (
          <div className="mapping-row" key={`${index}-${row.key}`}>
            <Field label="项目与分支">
              <select value={row.key} onChange={(event) => onUpdateRow(index, { key: event.target.value })}>
                <option value="">{repos.length > 0 ? "选择项目与分支" : "请先扫描仓库"}</option>
                {mappingOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <Field label="映射名称">
              <input
                value={row.displayName}
                onChange={(event) => onUpdateRow(index, { displayName: event.target.value })}
                placeholder="例如：后端服务"
              />
            </Field>
            <button type="button" className="mapping-remove" onClick={() => onRequestRemove(index)} aria-label="删除映射">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="mapping-actions">
          <button type="button" className="mapping-add" onClick={onAddRow}><Plus size={16} />添加映射</button>
          <button type="button" className="mapping-import" onClick={onDownloadTemplate}><Download size={16} />下载模板</button>
          <button type="button" className="mapping-import" onClick={onImportFile}><FileUp size={16} />导入文件</button>
        </div>
        <p className="mapping-hint">下载 Excel 模板后，在「显示名称」列填写名称再导入；「项目(分支)」列已自动列出，请勿改动。</p>
        {importNote && <p className="mapping-note">{importNote}</p>}
      </div>
    </section>
  );
}
