import { AlertCircle, CheckCircle2, Download, FileJson, Upload, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import {
  applyConfigProfile,
  parseConfigProfile,
  serializeConfigProfile,
  summarizeConfigProfile,
  type ConfigProfile,
  type ConfigProfileImportStrategy,
  type ConfigProfileSettings,
  type ConfigProfileSummary,
} from "../configProfile";
import type { AppSettings } from "../model";

type Props = {
  settings: AppSettings;
  onApply: (settings: ConfigProfileSettings) => void;
};

type PendingImport = {
  fileName: string;
  profile: ConfigProfile;
  summary: ConfigProfileSummary;
};

type Feedback = {
  tone: "success" | "error";
  message: string;
};

export function ConfigProfileSection({ settings, onApply }: Props) {
  const controller = useConfigProfileController({ settings, onApply });
  return (
    <section className="settings-section config-profile-section">
      <div className="section-title"><FileJson size={16} /><h2>配置方案</h2></div>
      <p className="config-profile-copy">共享映射、别名、证据规则与报告模板；不包含凭据或本机路径。</p>
      <ProfileActions
        busy={controller.busy}
        onExport={() => void controller.exportProfile()}
        onImport={() => void controller.selectImportFile()}
      />
      {controller.pending && (
        <ImportPreview
          pending={controller.pending}
          strategy={controller.strategy}
          onStrategyChange={controller.setStrategy}
          onApply={controller.applyPendingProfile}
          onCancel={() => controller.setPending(null)}
        />
      )}
      {controller.feedback && <ProfileFeedback feedback={controller.feedback} />}
    </section>
  );
}

function useConfigProfileController({ settings, onApply }: Props) {
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [strategy, setStrategy] = useState<ConfigProfileImportStrategy>("merge");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState<"import" | "export" | null>(null);

  async function exportProfile() {
    setBusy("export");
    setFeedback(null);
    try {
      const exportedFile = await exportConfigProfileFile(settings);
      if (exportedFile) setFeedback({ tone: "success", message: `配置方案已导出：${exportedFile}` });
    } catch (error) {
      setFeedback({ tone: "error", message: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function selectImportFile() {
    setBusy("import");
    setFeedback(null);
    try {
      const selected = await readConfigProfileFile();
      if (selected) {
        setPending(selected);
        setStrategy("merge");
      }
    } catch (error) {
      setPending(null);
      setFeedback({ tone: "error", message: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  function applyPendingProfile() {
    if (!pending) return;
    onApply(applyConfigProfile(settings, pending.profile, strategy));
    setPending(null);
    setFeedback({
      tone: "success",
      message: strategy === "merge" ? "配置方案已合并" : "可共享配置已替换",
    });
  }

  return {
    pending, strategy, feedback, busy, setPending, setStrategy,
    exportProfile, selectImportFile, applyPendingProfile,
  };
}

function ProfileActions({ busy, onExport, onImport }: {
  busy: "import" | "export" | null;
  onExport: () => void;
  onImport: () => void;
}) {
  return (
    <div className="config-profile-actions">
      <button type="button" className="mapping-import" onClick={onExport} disabled={busy !== null}>
        <Download size={15} />{busy === "export" ? "导出中" : "导出方案"}
      </button>
      <button type="button" className="mapping-import" onClick={onImport} disabled={busy !== null}>
        <Upload size={15} />{busy === "import" ? "读取中" : "导入方案"}
      </button>
    </div>
  );
}

function ImportPreview({ pending, strategy, onStrategyChange, onApply, onCancel }: {
  pending: PendingImport;
  strategy: ConfigProfileImportStrategy;
  onStrategyChange: (strategy: ConfigProfileImportStrategy) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="config-profile-preview" role="region" aria-label="配置方案导入预览">
      <div className="config-profile-preview-heading">
        <div><strong>{pending.fileName}</strong><span>版本 {pending.profile.schemaVersion}</span></div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label="取消导入配置方案"><X size={15} /></button>
      </div>
      <ProfileSummary summary={pending.summary} />
      <StrategyControl strategy={strategy} onChange={onStrategyChange} />
      <p className="config-profile-safety">凭据、代理、工作区路径和报告历史不会被修改。</p>
      <button type="button" className="config-profile-apply" onClick={onApply}>
        <CheckCircle2 size={15} />{strategy === "merge" ? "确认合并" : "确认替换"}
      </button>
    </div>
  );
}

function StrategyControl({ strategy, onChange }: {
  strategy: ConfigProfileImportStrategy;
  onChange: (strategy: ConfigProfileImportStrategy) => void;
}) {
  return (
    <div className="config-profile-strategy" role="radiogroup" aria-label="配置冲突策略">
      <StrategyButton active={strategy === "merge"} label="合并" detail="保留本机未冲突规则" onClick={() => onChange("merge")} />
      <StrategyButton active={strategy === "replace"} label="替换" detail="替换全部可共享配置" onClick={() => onChange("replace")} />
    </div>
  );
}

function ProfileFeedback({ feedback }: { feedback: Feedback }) {
  return (
    <p className={`config-profile-feedback ${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>
      {feedback.tone === "error" ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
      {feedback.message}
    </p>
  );
}

function ProfileSummary({ summary }: { summary: ConfigProfileSummary }) {
  const entries = [
    ["项目映射", summary.mappings],
    ["作者别名", summary.authorAliases],
    ["证据规则", summary.evidenceRules],
    ["报告模板", summary.reportTemplates],
    ["提示词模板", summary.promptTemplates],
  ] as const;
  return (
    <dl className="config-profile-summary">
      {entries.map(([label, count]) => (
        <div key={label}><dt>{label}</dt><dd>{count}</dd></div>
      ))}
    </dl>
  );
}

function StrategyButton({ active, label, detail, onClick }: {
  active: boolean;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={active} className={active ? "active" : ""} onClick={onClick}>
      <strong>{label}</strong>
      <span>{detail}</span>
    </button>
  );
}

async function exportConfigProfileFile(settings: AppSettings) {
  const path = await save({
    defaultPath: `gitpulse-config-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "GitPulse 配置方案", extensions: ["json"] }],
  });
  if (typeof path !== "string") return null;
  await invoke("write_text_file", { path, content: serializeConfigProfile(settings) });
  return fileName(path);
}

async function readConfigProfileFile(): Promise<PendingImport | null> {
  const path = await open({
    multiple: false,
    filters: [{ name: "GitPulse 配置方案", extensions: ["json"] }],
  });
  if (typeof path !== "string") return null;
  const content = await invoke<string>("read_text_file", { path });
  const profile = parseConfigProfile(content);
  return { fileName: fileName(path), profile, summary: summarizeConfigProfile(profile) };
}

function fileName(path: string) {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
