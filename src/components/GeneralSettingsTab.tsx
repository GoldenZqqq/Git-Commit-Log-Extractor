import { FileText, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import type { ConfigProfileSettings } from "../configProfile";
import type { AppSettings, ReportHistoryLimit, UpdateSummary } from "../model";
import { REPORT_HISTORY_LIMIT_OPTIONS } from "../model";
import { ConfigProfileSection } from "./ConfigProfileSection";
import { Field } from "./Primitives";
import { SectionTitle } from "./SettingsPrimitives";
import { UpdateSection } from "./UpdateSection";

type Props = {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onApplyConfigProfile: (settings: ConfigProfileSettings) => void;
  onClearHistory: () => void;
  currentVersion: string;
  updateSummary: UpdateSummary | null;
  updateMessage: string;
  updateProgress: string;
  updateBusy: "checking" | "installing" | null;
  onCheckForUpdates: () => void;
  onInstallUpdate: () => void;
};

export function GeneralSettingsTab({
  settings,
  updateSetting,
  onApplyConfigProfile,
  onClearHistory,
  currentVersion,
  updateSummary,
  updateMessage,
  updateProgress,
  updateBusy,
  onCheckForUpdates,
  onInstallUpdate,
}: Props) {
  return (
    <>
      <ConfigProfileSection settings={settings} onApply={onApplyConfigProfile} />
      <section className="settings-section">
        <SectionTitle icon={<FileText size={16} />} title="报告历史" />
        <Field label="保留最近报告">
          <select
            value={settings.reportHistoryLimit}
            onChange={(event) => updateSetting("reportHistoryLimit", Number(event.target.value) as ReportHistoryLimit)}
          >
            {REPORT_HISTORY_LIMIT_OPTIONS.map((limit) => <option key={limit} value={limit}>{limit} 条</option>)}
          </select>
        </Field>
        <p className="mapping-hint">仅存本机，超出上限自动删除最早记录。</p>
        <button
          type="button"
          className="mapping-import"
          onClick={() => {
            if (window.confirm("确定清空本机全部报告历史？此操作不可恢复。")) onClearHistory();
          }}
        >
          <Trash2 size={15} />
          清空全部历史
        </button>
      </section>
      <section className="settings-section">
        <SectionTitle icon={<Monitor size={16} />} title="外观" />
        <div className="theme-mode-control" aria-label="颜色模式">
          <ThemeModeButton active={settings.themeMode === "system"} icon={<Monitor size={15} />} label="跟随系统" onClick={() => updateSetting("themeMode", "system")} />
          <ThemeModeButton active={settings.themeMode === "light"} icon={<Sun size={15} />} label="亮色" onClick={() => updateSetting("themeMode", "light")} />
          <ThemeModeButton active={settings.themeMode === "dark"} icon={<Moon size={15} />} label="暗色" onClick={() => updateSetting("themeMode", "dark")} />
        </div>
      </section>
      <UpdateSection
        currentVersion={currentVersion}
        updateSummary={updateSummary}
        updateMessage={updateMessage}
        updateProgress={updateProgress}
        updateBusy={updateBusy}
        onCheckForUpdates={onCheckForUpdates}
        onInstallUpdate={onInstallUpdate}
      />
    </>
  );
}

function ThemeModeButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" className={active ? "active" : ""} onClick={onClick}>{icon}{label}</button>;
}
