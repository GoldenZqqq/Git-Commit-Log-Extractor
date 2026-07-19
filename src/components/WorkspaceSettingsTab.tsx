import { ChevronDown, FolderGit2, Settings2 } from "lucide-react";
import type { AppSettings } from "../model";
import { Field, PathInput, RootDirField, Toggle } from "./Primitives";
import { SectionTitle } from "./SettingsPrimitives";

type Props = {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onAddRootDirs: () => void;
  onRemoveRootDir: (dir: string) => void;
  onChooseOutputDir: () => void;
};

export function WorkspaceSettingsTab({
  settings,
  updateSetting,
  onAddRootDirs,
  onRemoveRootDir,
  onChooseOutputDir,
}: Props) {
  return (
    <>
      <section className="settings-section">
        <SectionTitle icon={<FolderGit2 size={16} />} title="基础配置" />
        <RootDirField
          label="仓库根目录"
          dirs={settings.rootDirs}
          onAdd={onAddRootDirs}
          onRemove={onRemoveRootDir}
          hint="可添加多个目录并统一扫描"
        />
        <Field label="Git 作者" hint="留空统计全部作者；多人用逗号分隔">
          <input
            value={settings.author}
            placeholder="留空取全部作者；如 张三, 李四"
            onChange={(event) => updateSetting("author", event.target.value)}
          />
        </Field>
        <Toggle label="输出到文件" checked={settings.outputEnabled} onChange={(value) => updateSetting("outputEnabled", value)} />
        {settings.outputEnabled && <PathInput label="输出目录" value={settings.outputDir} onBrowse={onChooseOutputDir} />}
        <p className="mapping-hint">日报用当天，周报用本周；其他周期在首页选择。</p>
      </section>

      <details className="settings-section advanced-settings-section">
        <summary>
          <span className="advanced-settings-title">
            <Settings2 size={16} />
            <span>
              <strong>高级提取设置</strong>
              <small>分支、过滤、作者别名、证据和日报条目前缀</small>
            </span>
          </span>
          <ChevronDown size={16} />
        </summary>
        <div className="advanced-settings-content">
          <Field label="作者身份别名" hint="每行：展示姓名 -> Git name/email；多个别名用逗号分隔">
            <textarea
              className="refinement-input author-alias-input"
              value={settings.authorAliasesText}
              onChange={(event) => updateSetting("authorAliasesText", event.target.value)}
              placeholder="张三 -> zhangsan, zhangsan@company.com"
            />
          </Field>
          <div className="settings-toggle-grid">
            <Toggle label="提取所有分支" checked={settings.extractAllBranches} onChange={(value) => updateSetting("extractAllBranches", value)} />
            <Toggle label="排除合并提交" checked={settings.excludeMergeCommits} onChange={(value) => updateSetting("excludeMergeCommits", value)} />
            <Toggle label="排除回滚提交" checked={settings.excludeRevertCommits} onChange={(value) => updateSetting("excludeRevertCommits", value)} />
            <Toggle label="排除 Bot 提交" checked={settings.excludeBotCommits} onChange={(value) => updateSetting("excludeBotCommits", value)} />
            <Toggle label="输出详细日志" checked={settings.detailedOutput} onChange={(value) => updateSetting("detailedOutput", value)} />
            <Toggle label="显示提交证据" checked={settings.showEvidenceDetails} onChange={(value) => updateSetting("showEvidenceDetails", value)} />
            <Toggle label="报告脱敏" checked={settings.redactionEnabled} onChange={(value) => updateSetting("redactionEnabled", value)} />
          </div>
          <Field label="日报条目前缀" hint="控制每条 {commitItems} 的前缀，例如：项目名 - 事项">
            <select
              value={settings.commitItemPrefixMode}
              onChange={(event) => updateSetting("commitItemPrefixMode", event.target.value as AppSettings["commitItemPrefixMode"])}
            >
              <option value="mapped-project">映射项目名</option>
              <option value="repo-branch-and-mapped">仓库与分支 + 映射项目名</option>
              <option value="repo-branch">仓库与分支</option>
              <option value="none">不显示前缀</option>
            </select>
          </Field>
          <Field label="证据链接前缀" hint="每行：前缀 -> 链接模板；支持 {id}、{key}、{prefix}">
            <textarea
              className="refinement-input evidence-link-input"
              value={settings.evidenceLinkPrefixesText}
              onChange={(event) => updateSetting("evidenceLinkPrefixesText", event.target.value)}
              placeholder={"# -> https://github.com/org/repo/issues/{id}\nPR -> https://github.com/org/repo/pull/{id}\nJIRA -> https://jira.example.com/browse/{key}"}
            />
          </Field>
          <Field label="脱敏替换规则" hint="每行：敏感词 -> 替换文本；省略替换文本时使用 ***">
            <textarea
              className="refinement-input redaction-rules-input"
              value={settings.redactionRulesText}
              onChange={(event) => updateSetting("redactionRulesText", event.target.value)}
              placeholder={"内部项目 -> 项目A\n客户名称 -> 客户X\nSECRET_TOKEN"}
            />
          </Field>
        </div>
      </details>
    </>
  );
}
