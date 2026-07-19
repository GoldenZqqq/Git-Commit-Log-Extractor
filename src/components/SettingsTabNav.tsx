import { Activity, Bot, FileText, FolderGit2, Monitor, Settings2 } from "lucide-react";
import type { ReactNode } from "react";

export type SettingsTab = "workspace" | "format" | "ai" | "mapping" | "diagnostics" | "general";

type Props = {
  activeTab: SettingsTab;
  onChange: (tab: SettingsTab) => void;
};

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: ReactNode }[] = [
  { id: "workspace", label: "工作区", icon: <FolderGit2 size={15} /> },
  { id: "format", label: "报告格式", icon: <FileText size={15} /> },
  { id: "ai", label: "AI 润色", icon: <Bot size={15} /> },
  { id: "mapping", label: "项目映射", icon: <Settings2 size={15} /> },
  { id: "diagnostics", label: "诊断", icon: <Activity size={15} /> },
  { id: "general", label: "通用", icon: <Monitor size={15} /> },
];

export function SettingsTabNav({ activeTab, onChange }: Props) {
  return (
    <nav className="settings-nav" aria-label="设置分类">
      {SETTINGS_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={activeTab === tab.id ? "active" : ""}
          onClick={() => onChange(tab.id)}
          aria-current={activeTab === tab.id ? "page" : undefined}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
