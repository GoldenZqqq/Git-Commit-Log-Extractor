import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Radar,
  RefreshCw,
} from "lucide-react";
import type { AppSettings } from "../model";
import type { AiSettingsController } from "../hooks/useAiSettingsController";
import { CodexOAuthExperimentalNotice } from "./CodexOAuthExperimentalNotice";
import { Field, Toggle } from "./Primitives";
import { SectionTitle } from "./SettingsPrimitives";

type Props = {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  controller: AiSettingsController;
};

export function AiSettingsTab({ settings, updateSetting, controller }: Props) {
  const {
    showAiApiKey,
    toggleAiApiKey,
    aiModelOptions,
    modelMenuOpen,
    setModelMenuOpen,
    modelFetchStatus,
    proxyScanStatus,
    proxyTestStatus,
    proxyCandidates,
    codexAuth,
    codexFlow,
    codexBusy,
    codexMessage,
    promptEditTarget,
    setPromptEditTarget,
    modelPickerRef,
    modelInputRef,
    modelOptionsRef,
    updateAiProvider,
    updateAiConnectionSetting,
    applyOrcaRouterPreset,
    updateAiModel,
    selectAiModel,
    resetSystemPrompt,
    fetchAiModels,
    startCodexLogin,
    codexLogout,
    updateProxyMode,
    updateProxyConnectionSetting,
    scanProxyCandidates,
    selectProxyCandidate,
    testProxyConnection,
  } = controller;

  return (
    <section className="settings-section">
      <SectionTitle icon={<Bot size={16} />} title="AI 润色" />
      <Field label="应用出站代理" hint="仅用于外部 API，不修改系统代理或本地 Git">
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
                  {proxyScanStatus.message && <p className={`model-fetch-note ${proxyScanStatus.type}`}>{proxyScanStatus.message}</p>}
                  {proxyTestStatus.message && <p className={`model-fetch-note ${proxyTestStatus.type}`}>{proxyTestStatus.message}</p>}
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
          <option value="codex-oauth">ChatGPT (Codex OAuth) · 实验</option>
        </select>
      </Field>
      <p className="ai-provider-experimental-note">
        <span className="experimental-badge">实验</span>
        Codex OAuth 可能随协议变化失效，建议优先使用 OpenAI Compatible 或 Anthropic Native。
      </p>
      {settings.aiProvider === "openai-compatible" && (
        <div className="provider-preset">
          <div className="provider-preset-head">
            <span className="provider-preset-title"><Bot size={15} /> OrcaRouter（OpenAI 兼容可选服务商）</span>
            <button type="button" className="provider-preset-apply" onClick={applyOrcaRouterPreset}>
              填入 OrcaRouter 预设
            </button>
          </div>
          <p>
            一键填入官方 Base URL 与示例模型，保留你当前填写的 API Key；注册后到后台生成 OrcaRouter Key 并粘贴到上方即可。
          </p>
          <div className="provider-preset-links">
            <a className="provider-preset-link" href="https://www.orcarouter.ai/ref/ref_42af1ff924f526df920d" target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> 注册 / 获取 API Key
            </a>
            <a className="provider-preset-link" href="https://www.orcarouter.ai/zh-CN/built-with" target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> 查看开源支持计划
            </a>
          </div>
        </div>
      )}
      {settings.aiProvider === "codex-oauth" ? (
        <>
          <CodexOAuthExperimentalNotice onSwitchProvider={updateAiProvider} />
          <Field label="ChatGPT 账号（实验）" hint="无需 API Key；可随时切回稳定协议，已有凭据不会被删除">
            <div className="codex-auth">
              {codexAuth.authenticated ? (
                <div className="codex-auth-row">
                  <span className="codex-auth-ok">
                    <span className="experimental-badge">实验</span>
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
                  <p className="codex-waiting"><Loader2 className="spin" size={14} /> 等待授权...</p>
                </div>
              ) : (
                <button type="button" className="mapping-add" onClick={() => void startCodexLogin()} disabled={codexBusy}>
                  <Bot size={16} /> 使用 ChatGPT 登录（实验）
                </button>
              )}
              {codexMessage && <p className="mapping-note">{codexMessage}</p>}
            </div>
          </Field>
        </>
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
                onClick={toggleAiApiKey}
                aria-label={showAiApiKey ? "隐藏 API Key" : "显示 API Key"}
                aria-pressed={showAiApiKey}
              >
                {showAiApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
        </>
      )}
      <Field label="模型" hint="可手动输入，或从当前服务获取">
        <div className="model-picker" ref={modelPickerRef}>
          <div className={`model-combobox ${modelMenuOpen ? "open" : ""}`}>
            <input
              ref={modelInputRef}
              value={settings.aiModel}
              onChange={(event) => updateAiModel(event.target.value)}
              onClick={() => setModelMenuOpen(true)}
              onKeyDown={(event) => {
                if (!modelMenuOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                  event.preventDefault();
                  setModelMenuOpen(true);
                }
              }}
              placeholder="例如：gpt-4.1-mini"
              role="combobox"
              aria-controls="ai-model-options"
              aria-expanded={modelMenuOpen}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="model-menu-toggle"
              onClick={() => setModelMenuOpen((current) => !current)}
              aria-label={modelMenuOpen ? "收起模型列表" : "展开模型列表"}
              aria-expanded={modelMenuOpen}
              aria-controls="ai-model-options"
              aria-haspopup="listbox"
            >
              <ChevronDown size={16} />
            </button>
            {modelMenuOpen && (
              <div ref={modelOptionsRef} className="model-options" id="ai-model-options" role="listbox" aria-label="可用模型">
                {aiModelOptions.length > 0 ? aiModelOptions.map((model) => (
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
                )) : (
                  <div className="model-options-empty" role="option" aria-disabled="true">先点击右侧获取模型，或直接输入模型名</div>
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
      <Field label="生成温度" hint="低值更稳定，高值更多样；默认 0.2">
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
      <Field label="润色指令" hint="常驻润色要求；临时要求请在首页填写">
        <textarea
          className="refinement-input"
          value={settings.refinementInstruction}
          onChange={(event) => updateSetting("refinementInstruction", event.target.value)}
          placeholder="语气正式一些，突出项目交付、问题闭环和协作价值。"
        />
      </Field>
      <Field label="系统提示词模板（高级）" hint="控制报告结构；留空使用内置模板">
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
            onChange={(event) => updateSetting(
              promptEditTarget === "daily" ? "dailySystemPrompt" : "monthlySystemPrompt",
              event.target.value,
            )}
          />
          <button type="button" className="mapping-import prompt-reset" onClick={resetSystemPrompt}>
            <RefreshCw size={15} />
            恢复默认
          </button>
        </div>
      </Field>
    </section>
  );
}
