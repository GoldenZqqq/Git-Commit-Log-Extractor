import {
  Activity,
  AlertCircle,
  Bot,
  ChevronDown,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  FolderGit2,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Radar,
  RefreshCw,
  Settings2,
  Sun,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { DiagnosticsSection } from "./DiagnosticsSection";
import {
  buildProxyConfig,
  buildMappingKeys,
  buildMappingSuggestions,
  DEFAULT_DAILY_SYSTEM_PROMPT,
  DEFAULT_MONTHLY_SYSTEM_PROMPT,
  mergeMappingEntries,
  parseMappingText,
  serializeMappingText,
  type AiModelInfo,
  REPORT_HISTORY_LIMIT_OPTIONS,
  type AppSettings,
  type ReportHistoryLimit,
  type MappingEntry,
  type MappingSuggestion,
  type ProxyCandidate,
  type ProxyTestResult,
  type RepoInfo,
  type UpdateSummary,
} from "../model";
import { useDiagnosticsPanel } from "../hooks/useDiagnosticsPanel";
import { Field, PathInput, RootDirField, Toggle } from "./Primitives";
import { ReportFormatSettings } from "./ReportFormatSettings";
import { UpdateSection } from "./UpdateSection";

type Props = {
  open: boolean;
  settings: AppSettings;
  repos: RepoInfo[];
  currentVersion: string;
  updateSummary: UpdateSummary | null;
  updateMessage: string;
  updateProgress: string;
  updateBusy: "checking" | "installing" | null;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onAddRootDirs: () => void;
  onRemoveRootDir: (dir: string) => void;
  onChooseOutputDir: () => void;
  onCheckForUpdates: () => void;
  onInstallUpdate: () => void;
  onClearHistory: () => void;
  onClose: () => void;
};

type MappingOption = {
  value: string;
  label: string;
};

type ModelFetchStatus = {
  type: "idle" | "loading" | "success" | "error";
  message: string;
};

type ProxyActionStatus = ModelFetchStatus;

type SettingsTab = "workspace" | "format" | "ai" | "mapping" | "diagnostics" | "general";

const EMPTY_MODEL_FETCH_STATUS: ModelFetchStatus = { type: "idle", message: "" };

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: ReactNode }[] = [
  { id: "workspace", label: "工作区", icon: <FolderGit2 size={15} /> },
  { id: "format", label: "报告格式", icon: <FileText size={15} /> },
  { id: "ai", label: "AI 润色", icon: <Bot size={15} /> },
  { id: "mapping", label: "项目映射", icon: <Settings2 size={15} /> },
  { id: "diagnostics", label: "诊断", icon: <Activity size={15} /> },
  { id: "general", label: "通用", icon: <Monitor size={15} /> },
];

export function SettingsDialog({
  open,
  settings,
  repos,
  currentVersion,
  updateSummary,
  updateMessage,
  updateProgress,
  updateBusy,
  updateSetting,
  onAddRootDirs,
  onRemoveRootDir,
  onChooseOutputDir,
  onCheckForUpdates,
  onInstallUpdate,
  onClearHistory,
  onClose,
}: Props) {
  const [importNote, setImportNote] = useState("");
  const [showAiApiKey, setShowAiApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("workspace");
  const [aiModelOptions, setAiModelOptions] = useState<string[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelFetchStatus, setModelFetchStatus] = useState<ModelFetchStatus>(EMPTY_MODEL_FETCH_STATUS);
  const [proxyScanStatus, setProxyScanStatus] = useState<ProxyActionStatus>(EMPTY_MODEL_FETCH_STATUS);
  const [proxyTestStatus, setProxyTestStatus] = useState<ProxyActionStatus>(EMPTY_MODEL_FETCH_STATUS);
  const [proxyCandidates, setProxyCandidates] = useState<ProxyCandidate[]>([]);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [codexAuth, setCodexAuth] = useState<{ authenticated: boolean; email?: string }>({ authenticated: false });
  const [codexFlow, setCodexFlow] = useState<{ userCode: string; verificationUri: string } | null>(null);
  const [codexBusy, setCodexBusy] = useState(false);
  const [codexMessage, setCodexMessage] = useState("");
  const codexPollTimer = useRef<number | null>(null);
  const [savedPulse, setSavedPulse] = useState(false);
  const lastSettingsRef = useRef(settings);
  const modelPickerRef = useRef<HTMLDivElement | null>(null);
  const [promptEditTarget, setPromptEditTarget] = useState<"daily" | "monthly">("daily");
  const diagnostics = useDiagnosticsPanel({
    open,
    active: activeTab === "diagnostics",
    settings,
    repos,
  });
  useEffect(() => {
    if (!open) {
      setImportNote("");
      setShowAiApiKey(false);
      setActiveTab("workspace");
      setAiModelOptions([]);
      setModelMenuOpen(false);
      setModelFetchStatus(EMPTY_MODEL_FETCH_STATUS);
      setProxyScanStatus(EMPTY_MODEL_FETCH_STATUS);
      setProxyTestStatus(EMPTY_MODEL_FETCH_STATUS);
      setProxyCandidates([]);
      setPendingDeleteIndex(null);
      setCodexFlow(null);
      setCodexMessage("");
      setSavedPulse(false);
      stopCodexPolling();
    }
  }, [open]);
  useEffect(() => () => stopCodexPolling(), []);
  // 设置面板全程自动保存：settings 一变就已写入本地存储，这里只负责把“已保存”反馈显示出来，
  // 跳过打开面板时的首次同步，避免没改动也闪一下。
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
  useEffect(() => {
    if (open && settings.aiProvider === "codex-oauth") void refreshCodexStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, settings.aiProvider]);
  useEffect(() => {
    if (!modelMenuOpen) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (modelPickerRef.current?.contains(event.target as Node)) return;
      setModelMenuOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [modelMenuOpen]);
  if (!open) return null;

  const mappingRows = parseMappingText(settings.projectNamesText);
  const visibleMappingRows = mappingRows.length > 0 ? mappingRows : [{ key: "", displayName: "" }];
  const mappingOptions = buildMappingOptions(repos, mappingRows);
  const mappingSuggestions = buildMappingSuggestions(repos, mappingRows);

  function resetAiModelFetch() {
    setAiModelOptions([]);
    setModelMenuOpen(false);
    setModelFetchStatus(EMPTY_MODEL_FETCH_STATUS);
  }

  function updateAiProvider(provider: AppSettings["aiProvider"]) {
    resetAiModelFetch();
    updateSetting("aiProvider", provider);
    updateSetting("aiModel", "");
    if (provider === "codex-oauth") {
      setCodexMessage("");
      void refreshCodexStatus();
      return;
    }
    if (provider === "anthropic-native") {
      updateSetting("aiBaseUrl", "https://api.anthropic.com/v1");
      return;
    }
    updateSetting("aiBaseUrl", "https://api.openai.com/v1");
  }

  function updateAiConnectionSetting<K extends "aiBaseUrl" | "aiApiKey">(key: K, value: AppSettings[K]) {
    resetAiModelFetch();
    updateSetting(key, value);
  }

  function updateAiModel(model: string) {
    updateSetting("aiModel", model);
  }

  function selectAiModel(model: string) {
    updateAiModel(model);
    setModelMenuOpen(false);
  }

  function resetSystemPrompt() {
    if (promptEditTarget === "daily") updateSetting("dailySystemPrompt", DEFAULT_DAILY_SYSTEM_PROMPT);
    else updateSetting("monthlySystemPrompt", DEFAULT_MONTHLY_SYSTEM_PROMPT);
  }

  async function fetchAiModels() {
    if (settings.aiProvider === "codex-oauth") {
      if (!codexAuth.authenticated) {
        setModelFetchStatus({ type: "error", message: "请先登录 ChatGPT 账号" });
        return;
      }
    } else {
      if (!settings.aiBaseUrl.trim()) {
        setModelFetchStatus({ type: "error", message: "请先填写 Base URL" });
        return;
      }
      if (!settings.aiApiKey.trim()) {
        setModelFetchStatus({ type: "error", message: "请先填写 API Key" });
        return;
      }
    }

    setModelFetchStatus({ type: "loading", message: "正在向当前 AI 服务获取模型列表..." });
    try {
      const models = await invoke<AiModelInfo[]>("list_ai_models", {
        config: {
          enabled: true,
          provider: settings.aiProvider,
          baseUrl: settings.aiBaseUrl.trim(),
          model: settings.aiModel,
          apiKey: settings.aiApiKey.trim(),
          temperature: 0.2,
          timeoutSeconds: 30,
          proxy: buildProxyConfig(settings),
        },
      });
      const modelIds = [...new Set(models.map((model) => model.id.trim()).filter(Boolean))];
      if (modelIds.length === 0) {
        setAiModelOptions([]);
        setModelMenuOpen(false);
        setModelFetchStatus({ type: "error", message: "没有读取到可用模型，请检查服务返回内容" });
        return;
      }
      setAiModelOptions(modelIds);
      if (!settings.aiModel.trim()) updateAiModel(modelIds[0]);
      setModelMenuOpen(true);
      setModelFetchStatus({ type: "success", message: `已获取 ${modelIds.length} 个模型，点击模型框即可下拉选择` });
    } catch (error) {
      setAiModelOptions([]);
      setModelMenuOpen(false);
      setModelFetchStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  function stopCodexPolling() {
    if (codexPollTimer.current !== null) {
      clearTimeout(codexPollTimer.current);
      codexPollTimer.current = null;
    }
  }

  async function refreshCodexStatus() {
    try {
      const result = await invoke<{ authenticated: boolean; email?: string }>("codex_oauth_status");
      setCodexAuth(result);
    } catch {
      setCodexAuth({ authenticated: false });
    }
  }

  async function startCodexLogin() {
    stopCodexPolling();
    setCodexBusy(true);
    setCodexMessage("");
    try {
      const flow = await invoke<{
        deviceCode: string;
        userCode: string;
        verificationUri: string;
        interval: number;
        expiresIn: number;
      }>("codex_oauth_start_device_flow", { proxy: buildProxyConfig(settings) });
      setCodexFlow({ userCode: flow.userCode, verificationUri: flow.verificationUri });
      try {
        await openUrl(flow.verificationUri);
      } catch {
        // 打开浏览器失败不阻断，用户可点下方链接手动访问
      }
      const deadline = Date.now() + flow.expiresIn * 1000;
      const tick = async () => {
        if (Date.now() > deadline) {
          setCodexFlow(null);
          setCodexBusy(false);
          setCodexMessage("登录超时，请重试");
          return;
        }
        try {
          const result = await invoke<{ status: string; email?: string }>("codex_oauth_poll", {
            deviceCode: flow.deviceCode,
            userCode: flow.userCode,
            proxy: buildProxyConfig(settings),
          });
          if (result.status === "done") {
            setCodexFlow(null);
            setCodexBusy(false);
            setCodexMessage("ChatGPT 账号已登录");
            await refreshCodexStatus();
            return;
          }
        } catch (error) {
          setCodexFlow(null);
          setCodexBusy(false);
          setCodexMessage(error instanceof Error ? error.message : String(error));
          return;
        }
        codexPollTimer.current = window.setTimeout(() => void tick(), flow.interval * 1000);
      };
      codexPollTimer.current = window.setTimeout(() => void tick(), flow.interval * 1000);
    } catch (error) {
      setCodexFlow(null);
      setCodexBusy(false);
      setCodexMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function codexLogout() {
    stopCodexPolling();
    setCodexFlow(null);
    try {
      await invoke("codex_oauth_logout");
      setCodexMessage("已登出 ChatGPT 账号");
    } catch (error) {
      setCodexMessage(error instanceof Error ? error.message : String(error));
    }
    await refreshCodexStatus();
  }

  function updateProxyMode(enabled: boolean) {
    updateSetting("proxyMode", enabled ? "custom" : "off");
    setProxyTestStatus(EMPTY_MODEL_FETCH_STATUS);
  }

  function updateProxyConnectionSetting<K extends "proxyUrl" | "proxyUsername" | "proxyPassword">(key: K, value: AppSettings[K]) {
    updateSetting(key, value);
    setProxyTestStatus(EMPTY_MODEL_FETCH_STATUS);
  }

  async function scanProxyCandidates() {
    setProxyCandidates([]);
    setProxyScanStatus({ type: "loading", message: "正在扫描本机常见代理端口..." });
    try {
      const candidates = await invoke<ProxyCandidate[]>("scan_proxy_candidates");
      setProxyCandidates(candidates);
      setProxyScanStatus(
        candidates.length > 0
          ? { type: "success", message: `发现 ${candidates.length} 个候选，点击即可填入` }
          : { type: "error", message: "未发现可连接的本地代理端口" },
      );
    } catch (error) {
      setProxyScanStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  function selectProxyCandidate(candidate: ProxyCandidate) {
    updateSetting("proxyMode", "custom");
    updateSetting("proxyUrl", candidate.url);
    setProxyTestStatus(EMPTY_MODEL_FETCH_STATUS);
  }

  async function testProxyConnection() {
    setProxyTestStatus({ type: "loading", message: "正在测试外部连接..." });
    try {
      const result = await invoke<ProxyTestResult>("test_proxy_connection", {
        config: buildProxyConfig(settings),
      });
      setProxyTestStatus({
        type: result.ok ? "success" : "error",
        message: result.message,
      });
    } catch (error) {
      setProxyTestStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  function updateMappingRow(index: number, patch: Partial<MappingEntry>) {
    const rows = visibleMappingRows.map((row) => ({ ...row }));
    rows[index] = { ...rows[index], ...patch };
    updateSetting("projectNamesText", serializeMappingText(rows));
  }

  function addMappingRow() {
    updateSetting("projectNamesText", serializeMappingText([...visibleMappingRows, { key: "", displayName: "" }]));
  }

  function removeMappingRow(index: number) {
    const rows = visibleMappingRows.filter((_, rowIndex) => rowIndex !== index);
    updateSetting("projectNamesText", serializeMappingText(rows));
  }

  function confirmRemoveMapping() {
    if (pendingDeleteIndex === null) return;
    removeMappingRow(pendingDeleteIndex);
    setPendingDeleteIndex(null);
  }

  function applyMappingSuggestion(suggestion: MappingSuggestion) {
    updateSetting("projectNamesText", serializeMappingText([...mappingRows, {
      key: suggestion.key,
      displayName: suggestion.displayName,
    }]));
    setImportNote(`已填入建议：${suggestion.displayName}`);
  }

  function applyAllMappingSuggestions() {
    if (mappingSuggestions.length === 0) return;
    updateSetting("projectNamesText", serializeMappingText([
      ...mappingRows,
      ...mappingSuggestions.map((suggestion) => ({
        key: suggestion.key,
        displayName: suggestion.displayName,
      })),
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
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-label="应用设置" onMouseDown={(event) => event.stopPropagation()}>
        <header className="dialog-header">
          <div>
            <p className="kicker">Preferences</p>
            <h2>设置</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭设置">
            <X size={18} />
          </button>
        </header>

        <div className="settings-body">
          <nav className="settings-nav" aria-label="设置分类">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="settings-content" key={activeTab}>
            {activeTab === "workspace" && (
              <>
                <section className="settings-section">
                  <SectionTitle icon={<FolderGit2 size={16} />} title="基础配置" />
                  <RootDirField
                    label="仓库根目录"
                    dirs={settings.rootDirs}
                    onAdd={onAddRootDirs}
                    onRemove={onRemoveRootDir}
                    hint="可添加多个分散在不同位置的目录，全部一起扫描"
                  />
                  <Field
                    label="Git 作者"
                    hint="留空 = 不过滤作者（适合团队周报）；多人用逗号分隔，任一命中即纳入"
                  >
                    <input
                      value={settings.author}
                      placeholder="留空取全部作者；如 张三, 李四"
                      onChange={(event) => updateSetting("author", event.target.value)}
                    />
                  </Field>
                  <Toggle label="输出到文件" checked={settings.outputEnabled} onChange={(value) => updateSetting("outputEnabled", value)} />
                  {settings.outputEnabled && <PathInput label="输出目录" value={settings.outputDir} onBrowse={onChooseOutputDir} />}
                  <p className="mapping-hint">日报默认使用今天；周报取本周；月报可在首页选择月份。其他日期范围请切换到「自定义」。</p>
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
                    <Field
                      label="作者身份别名"
                      hint="每行一组：展示姓名 -> Git name 或 email；多个别名用逗号分隔。提取时会自动合并匹配，报告中显示展示姓名。"
                    >
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
                    <Field
                      label="日报条目前缀"
                      hint="控制 {commitItems} 的每条输出。推荐使用映射项目名，例如：柏科注安工程师 - 接入题目纠错反馈模块。"
                    >
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
                    <Field
                      label="证据链接前缀"
                      hint="可选。每行一条：前缀 -> 链接模板；支持 {id}、{key}、{prefix}，用于 #123、PR #123、JIRA-123 等编号。"
                    >
                      <textarea
                        className="refinement-input evidence-link-input"
                        value={settings.evidenceLinkPrefixesText}
                        onChange={(event) => updateSetting("evidenceLinkPrefixesText", event.target.value)}
                        placeholder={"# -> https://github.com/org/repo/issues/{id}\nPR -> https://github.com/org/repo/pull/{id}\nJIRA -> https://jira.example.com/browse/{key}"}
                      />
                    </Field>
                    <Field
                      label="脱敏替换规则"
                      hint="可选。每行一条：敏感词 -> 替换文本；只写敏感词时默认替换为 ***。启用报告脱敏后生效。"
                    >
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
            )}

            {activeTab === "format" && <ReportFormatSettings settings={settings} updateSetting={updateSetting} />}

            {activeTab === "ai" && (
              <section className="settings-section">
                <SectionTitle icon={<Bot size={16} />} title="AI 润色" />
                <Field
                  label="应用出站代理"
                  hint="仅代理 GitPulse 访问外部 API 的请求，不修改系统代理，也不影响本地 Git 扫描。"
                >
                  <div className="proxy-panel">
                    <Toggle label="启用代理" checked={settings.proxyMode === "custom"} onChange={updateProxyMode} />
                    {settings.proxyMode === "custom" && (
                      <>
                        <div className="proxy-url-row">
                          <input
                            value={settings.proxyUrl}
                            onChange={(event) => updateProxyConnectionSetting("proxyUrl", event.target.value)}
                            placeholder="http://127.0.0.1:7890 或 socks5://127.0.0.1:7890"
                            spellCheck={false}
                          />
                          <button
                            type="button"
                            className="proxy-tool-button"
                            onClick={() => void scanProxyCandidates()}
                            disabled={proxyScanStatus.type === "loading"}
                            aria-label="扫描本地代理候选"
                            title="扫描本地代理候选"
                          >
                            {proxyScanStatus.type === "loading" ? <Loader2 className="spin" size={15} /> : <Radar size={15} />}
                          </button>
                          <button
                            type="button"
                            className="model-fetch-button proxy-test-button"
                            onClick={() => void testProxyConnection()}
                            disabled={proxyTestStatus.type === "loading"}
                          >
                            {proxyTestStatus.type === "loading" ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
                            测试连接
                          </button>
                        </div>
                        <div className="proxy-auth-grid">
                          <input
                            value={settings.proxyUsername}
                            onChange={(event) => updateProxyConnectionSetting("proxyUsername", event.target.value)}
                            placeholder="用户名（可选）"
                            autoComplete="off"
                            spellCheck={false}
                          />
                          <input
                            type="password"
                            value={settings.proxyPassword}
                            onChange={(event) => updateProxyConnectionSetting("proxyPassword", event.target.value)}
                            placeholder={settings.proxyPasswordSaved ? "密码已保存，可重新输入覆盖" : "密码（可选）"}
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </div>
                        {proxyCandidates.length > 0 && (
                          <div className="proxy-candidates" aria-label="本地代理候选">
                            {proxyCandidates.map((candidate) => (
                              <button
                                key={candidate.url}
                                type="button"
                                className={settings.proxyUrl === candidate.url ? "selected" : ""}
                                onClick={() => selectProxyCandidate(candidate)}
                              >
                                <span>{candidate.label}</span>
                                {settings.proxyUrl === candidate.url && <CheckCircle2 size={14} />}
                              </button>
                            ))}
                          </div>
                        )}
                        {(proxyScanStatus.message || proxyTestStatus.message) && (
                          <div className="proxy-status-stack">
                            {proxyScanStatus.message && (
                              <p className={`model-fetch-note ${proxyScanStatus.type}`}>{proxyScanStatus.message}</p>
                            )}
                            {proxyTestStatus.message && (
                              <p className={`model-fetch-note ${proxyTestStatus.type}`}>{proxyTestStatus.message}</p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Field>
                <Field label="协议">
                  <select value={settings.aiProvider} onChange={(event) => updateAiProvider(event.target.value as AppSettings["aiProvider"])}>
                    <option value="openai-compatible">OpenAI Compatible</option>
                    <option value="anthropic-native">Anthropic Native</option>
                    <option value="codex-oauth">ChatGPT (Codex OAuth)</option>
                  </select>
                </Field>
                {settings.aiProvider === "codex-oauth" ? (
                  <Field label="ChatGPT 账号" hint="使用 ChatGPT Plus/Pro 订阅额度润色，无需 API Key。属非官方接入，可能随时失效。">
                    <div className="codex-auth">
                      {codexAuth.authenticated ? (
                        <div className="codex-auth-row">
                          <span className="codex-auth-ok">
                            <CheckCircle2 size={15} /> 已登录{codexAuth.email ? ` · ${codexAuth.email}` : ""}
                          </span>
                          <button type="button" className="mapping-import" onClick={() => void codexLogout()}>
                            <LogOut size={15} /> 登出
                          </button>
                        </div>
                      ) : codexFlow ? (
                        <div className="codex-flow">
                          <p>请在打开的页面输入验证码完成授权：</p>
                          <code className="codex-user-code">{codexFlow.userCode}</code>
                          <a className="codex-link" href={codexFlow.verificationUri} target="_blank" rel="noreferrer">
                            <ExternalLink size={13} /> {codexFlow.verificationUri}
                          </a>
                          <p className="codex-waiting">
                            <Loader2 className="spin" size={14} /> 等待授权...
                          </p>
                        </div>
                      ) : (
                        <button type="button" className="mapping-add" onClick={() => void startCodexLogin()} disabled={codexBusy}>
                          <Bot size={16} /> 使用 ChatGPT 登录
                        </button>
                      )}
                      {codexMessage && <p className="mapping-note">{codexMessage}</p>}
                    </div>
                  </Field>
                ) : (
                  <>
                    <Field label="Base URL">
                      <input value={settings.aiBaseUrl} onChange={(event) => updateAiConnectionSetting("aiBaseUrl", event.target.value)} />
                    </Field>
                    <Field
                      label="API Key"
                      hint={settings.aiApiKeySaved
                        ? "已保存到系统凭据库，下次打开会自动填入；清空输入框会删除已保存密钥。"
                        : "输入后会自动保存到系统凭据库；也可填写 OPENAI_API_KEY 或 env:OPENAI_API_KEY 这类环境变量引用。"}
                    >
                      <div className="secret-input">
                        <input
                          type={showAiApiKey ? "text" : "password"}
                          value={settings.aiApiKey}
                          onChange={(event) => updateAiConnectionSetting("aiApiKey", event.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          className="secret-toggle"
                          onClick={() => setShowAiApiKey((current) => !current)}
                          aria-label={showAiApiKey ? "隐藏 API Key" : "显示 API Key"}
                          aria-pressed={showAiApiKey}
                        >
                          {showAiApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </Field>
                  </>
                )}
                <Field label="模型" hint="可手动输入；也可以根据当前 Base URL 与 API Key 获取模型列表后选择。">
                  <div className="model-picker" ref={modelPickerRef}>
                    <div className={`model-combobox ${modelMenuOpen ? "open" : ""}`}>
                      <input
                        value={settings.aiModel}
                        onChange={(event) => updateAiModel(event.target.value)}
                        onFocus={() => setModelMenuOpen(true)}
                        placeholder="例如：gpt-4.1-mini"
                        role="combobox"
                        aria-controls="ai-model-options"
                        aria-expanded={modelMenuOpen}
                        aria-haspopup="listbox"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        className="model-menu-toggle"
                        onClick={() => setModelMenuOpen((current) => !current)}
                        aria-label={modelMenuOpen ? "收起模型列表" : "展开模型列表"}
                        aria-expanded={modelMenuOpen}
                      >
                        <ChevronDown size={16} />
                      </button>
                      {modelMenuOpen && (
                        <div className="model-options" id="ai-model-options" role="listbox">
                          {aiModelOptions.length > 0 ? (
                            aiModelOptions.map((model) => (
                              <button
                                key={model}
                                type="button"
                                className={settings.aiModel === model ? "selected" : ""}
                                role="option"
                                aria-selected={settings.aiModel === model}
                                onClick={() => selectAiModel(model)}
                              >
                                <span>{model}</span>
                                {settings.aiModel === model && <CheckCircle2 size={14} />}
                              </button>
                            ))
                          ) : (
                            <div className="model-options-empty" role="status">
                              先点击右侧获取模型，或直接输入模型名
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="model-fetch-button"
                      onClick={fetchAiModels}
                      disabled={modelFetchStatus.type === "loading"}
                      aria-busy={modelFetchStatus.type === "loading"}
                    >
                      {modelFetchStatus.type === "loading" ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
                      {modelFetchStatus.type === "loading" ? "获取中" : "获取模型"}
                    </button>
                  </div>
                  {modelFetchStatus.message && (
                    <p className={`model-fetch-note ${modelFetchStatus.type}`}>
                      {modelFetchStatus.type === "loading" && <Loader2 className="spin" size={14} />}
                      {modelFetchStatus.type === "success" && <CheckCircle2 size={14} />}
                      {modelFetchStatus.type === "error" && <AlertCircle size={14} />}
                      {modelFetchStatus.message}
                    </p>
                  )}
                </Field>
                <Field label="生成温度" hint="越低越稳健保守，越高越灵活多样；默认 0.2">
                  <div className="temperature-control">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={settings.aiTemperature}
                      onChange={(event) => updateSetting("aiTemperature", Number(event.target.value))}
                    />
                    <span className="temperature-value">{settings.aiTemperature.toFixed(1)}</span>
                  </div>
                </Field>
                <Field label="润色指令" hint="常驻的快速微调，追加在系统提示词之上；留空则不追加。临时性的本次要求可在首页润色按钮处填写。">
                  <textarea
                    className="refinement-input"
                    value={settings.refinementInstruction}
                    onChange={(event) => updateSetting("refinementInstruction", event.target.value)}
                    placeholder="语气正式一些，突出项目交付、问题闭环和协作价值。"
                  />
                </Field>
                <Field
                  label="系统提示词模板（高级）"
                  hint="决定报告的整体结构与角色（如月报的分段方式）。留空则回退内置默认。"
                >
                  <div className="prompt-template-editor">
                    <div className="mapping-scope-control" role="radiogroup" aria-label="选择编辑的报告类型">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={promptEditTarget === "daily"}
                        className={promptEditTarget === "daily" ? "active" : ""}
                        onClick={() => setPromptEditTarget("daily")}
                      >
                        日报 / 区间
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={promptEditTarget === "monthly"}
                        className={promptEditTarget === "monthly" ? "active" : ""}
                        onClick={() => setPromptEditTarget("monthly")}
                      >
                        月报
                      </button>
                    </div>
                    <textarea
                      className="refinement-input"
                      value={promptEditTarget === "daily" ? settings.dailySystemPrompt : settings.monthlySystemPrompt}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (promptEditTarget === "daily") updateSetting("dailySystemPrompt", value);
                        else updateSetting("monthlySystemPrompt", value);
                      }}
                    />
                    <button type="button" className="mapping-import prompt-reset" onClick={resetSystemPrompt}>
                      <RefreshCw size={15} />
                      恢复默认
                    </button>
                  </div>
                </Field>
              </section>
            )}

            {activeTab === "mapping" && (
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
                        <button type="button" className="mapping-import" onClick={applyAllMappingSuggestions}>
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
                            <button type="button" className="mapping-add" onClick={() => applyMappingSuggestion(suggestion)}>
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
                        <select value={row.key} onChange={(event) => updateMappingRow(index, { key: event.target.value })}>
                          <option value="">{repos.length > 0 ? "选择项目与分支" : "请先扫描仓库"}</option>
                          {mappingOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="映射名称">
                        <input
                          value={row.displayName}
                          onChange={(event) => updateMappingRow(index, { displayName: event.target.value })}
                          placeholder="例如：后端服务"
                        />
                      </Field>
                      <button type="button" className="mapping-remove" onClick={() => setPendingDeleteIndex(index)} aria-label="删除映射">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <div className="mapping-actions">
                    <button type="button" className="mapping-add" onClick={addMappingRow}>
                      <Plus size={16} />
                      添加映射
                    </button>
                    <button type="button" className="mapping-import" onClick={downloadTemplate}>
                      <Download size={16} />
                      下载模板
                    </button>
                    <button type="button" className="mapping-import" onClick={importMappingFile}>
                      <FileUp size={16} />
                      导入文件
                    </button>
                  </div>
                  <p className="mapping-hint">
                    下载 Excel 模板后，在「显示名称」列填写名称再导入；「项目(分支)」列已自动列出，请勿改动。
                  </p>
                  {importNote && <p className="mapping-note">{importNote}</p>}
                </div>
              </section>
            )}

            {activeTab === "diagnostics" && (
              <>
                <LocalDataBoundarySection settings={settings} repos={repos} />
                <DiagnosticsSection
                  result={diagnostics.result}
                  busy={diagnostics.busy}
                  message={diagnostics.message}
                  ranAt={diagnostics.ranAt}
                  onRefresh={diagnostics.refresh}
                />
              </>
            )}

            {activeTab === "general" && (
              <>
                <section className="settings-section">
                  <SectionTitle icon={<FileText size={16} />} title="报告历史" />
                  <Field label="保留最近报告">
                    <select
                      value={settings.reportHistoryLimit}
                      onChange={(event) => updateSetting("reportHistoryLimit", Number(event.target.value) as ReportHistoryLimit)}
                    >
                      {REPORT_HISTORY_LIMIT_OPTIONS.map((limit) => (
                        <option key={limit} value={limit}>
                          {limit} 条
                        </option>
                      ))}
                    </select>
                  </Field>
                  <p className="mapping-hint">仅存本机。超出后自动去掉更早的记录，不影响 Git 仓库。</p>
                  <button
                    type="button"
                    className="mapping-import"
                    onClick={() => {
                      if (window.confirm("确定清空本机全部报告历史？此操作不可恢复。")) {
                        onClearHistory();
                      }
                    }}
                  >
                    <Trash2 size={15} />
                    清空全部历史
                  </button>
                </section>

                <section className="settings-section">
                  <SectionTitle icon={<Monitor size={16} />} title="外观" />
                  <div className="theme-mode-control" aria-label="颜色模式">
                    <ThemeModeButton
                      active={settings.themeMode === "system"}
                      icon={<Monitor size={15} />}
                      label="跟随系统"
                      onClick={() => updateSetting("themeMode", "system")}
                    />
                    <ThemeModeButton
                      active={settings.themeMode === "light"}
                      icon={<Sun size={15} />}
                      label="亮色"
                      onClick={() => updateSetting("themeMode", "light")}
                    />
                    <ThemeModeButton
                      active={settings.themeMode === "dark"}
                      icon={<Moon size={15} />}
                      label="暗色"
                      onClick={() => updateSetting("themeMode", "dark")}
                    />
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
          className="range-dialog confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="mapping-delete-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="range-dialog-header">
            <div>
              <p className="kicker">Delete Mapping</p>
              <h2 id="mapping-delete-title">删除这条映射？</h2>
            </div>
            <button className="icon-button" type="button" onClick={() => setPendingDeleteIndex(null)} aria-label="取消删除">
              <X size={17} />
            </button>
          </header>
          <p className="confirm-dialog-text">删除后该项目映射将立即移除，此操作不可撤销。</p>
          <footer className="range-dialog-actions">
            <button type="button" className="mapping-import" onClick={() => setPendingDeleteIndex(null)}>
              取消
            </button>
            <button type="button" className="danger-button" onClick={confirmRemoveMapping}>
              <Trash2 size={16} />
              确定删除
            </button>
          </footer>
        </section>
      </div>
    )}
    </>
  );
}

function LocalDataBoundarySection({ settings, repos }: { settings: AppSettings; repos: RepoInfo[] }) {
  const rootDirSummary = settings.rootDirs.length > 0
    ? `${settings.rootDirs.length} 个仓库根目录，当前索引 ${repos.length} 个仓库`
    : "尚未配置仓库根目录";
  const aiReady = isAiConnectionConfigured(settings);
  const aiBoundary = aiReady
    ? `使用 AI 润色时，仅当前报告草稿、系统提示词和附加润色指令会发送到 ${formatAiDestination(settings)}。`
    : "未配置或未点击 AI 润色时，报告草稿、提交记录和项目映射不会发送到外部 AI 服务。";

  return (
    <section className="settings-section local-boundary-section">
      <SectionTitle icon={<CheckCircle2 size={16} />} title="本地数据边界" />
      <div className="local-boundary-grid">
        <BoundaryItem
          title="仓库扫描"
          body="GitPulse 只读取你选择的本机目录和 Git 元数据，用于提取提交、分支、作者与提交信息。"
          detail={rootDirSummary}
        />
        <BoundaryItem
          title="报告与历史"
          body="生成的报告、最近历史、项目映射、模板和设置偏好保存在本机应用数据中。"
          detail="可在通用设置中调整保留条数或清空历史；只影响本机记录，不会改动仓库。"
        />
        <BoundaryItem
          title="凭据存储"
          body={formatCredentialBoundary(settings)}
          detail="诊断页和报告预览不会展示完整密钥。"
        />
        <BoundaryItem
          title="AI 发送范围"
          body={aiBoundary}
          detail="生成报告始终可完全在本机完成；只有手动润色当前报告时才会调用 AI。"
        />
      </div>
    </section>
  );
}

function isAiConnectionConfigured(settings: AppSettings) {
  if (settings.aiProvider === "codex-oauth") return Boolean(settings.aiModel.trim());
  return Boolean(settings.aiBaseUrl.trim() && settings.aiModel.trim() && settings.aiApiKey.trim());
}

function BoundaryItem({ title, body, detail }: { title: string; body: string; detail: string }) {
  return (
    <article className="local-boundary-item">
      <strong>{title}</strong>
      <p>{body}</p>
      <small>{detail}</small>
    </article>
  );
}

function formatAiDestination(settings: AppSettings) {
  if (settings.aiProvider === "codex-oauth") return "ChatGPT Codex OAuth";
  const baseUrl = settings.aiBaseUrl.trim();
  const model = settings.aiModel.trim();
  if (baseUrl && model) return `${baseUrl} / ${model}`;
  return baseUrl || "当前配置的 AI 服务";
}

function formatCredentialBoundary(settings: AppSettings) {
  if (settings.aiProvider === "codex-oauth") {
    return "ChatGPT 账号状态由本机 OAuth 会话读取，不需要在 GitPulse 中保存 API Key。";
  }
  const apiKey = settings.aiApiKey.trim();
  if (apiKey.toLowerCase().startsWith("env:") || apiKey.toUpperCase().endsWith("_API_KEY")) {
    return "API Key 可通过环境变量引用，GitPulse 只保存变量名，不保存变量值。";
  }
  if (settings.aiApiKeySaved) {
    return "API Key 已保存到系统凭据库，设置文件只记录已保存状态。";
  }
  if (apiKey) {
    return "当前输入的 API Key 会保存到系统凭据库，避免明文写入普通设置。";
  }
  return "尚未配置 API Key；不使用 AI 润色时不需要任何外部服务凭据。";
}

function ThemeModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={active ? "active" : ""} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function buildMappingOptions(repos: RepoInfo[], rows: MappingEntry[]): MappingOption[] {
  const options = new Map<string, string>();
  for (const repo of repos) {
    const wildcardKey = `${repo.name}(*)`;
    options.set(wildcardKey, `${repo.name} · 全部分支 (*)`);
    if (repo.branch) {
      const branchKey = `${repo.name}(${repo.branch})`;
      options.set(branchKey, `${repo.name} · ${repo.branch}`);
    }
  }
  for (const row of rows) {
    if (row.key && !options.has(row.key)) options.set(row.key, row.key);
  }
  return [...options.entries()].map(([value, label]) => ({ value, label }));
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="section-title">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}
