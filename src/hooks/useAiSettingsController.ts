import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  buildProxyConfig,
  DEFAULT_DAILY_SYSTEM_PROMPT,
  DEFAULT_MONTHLY_SYSTEM_PROMPT,
  type AiModelInfo,
  type AppSettings,
  type ProxyCandidate,
  type ProxyTestResult,
} from "../model";
import { usePopover } from "./useOverlayFocus";

export type AiActionStatus = {
  type: "idle" | "loading" | "success" | "error";
  message: string;
};

const EMPTY_STATUS: AiActionStatus = { type: "idle", message: "" };

type Params = {
  open: boolean;
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
};

export function useAiSettingsController({ open, settings, updateSetting }: Params) {
  const [showAiApiKey, setShowAiApiKey] = useState(false);
  const [aiModelOptions, setAiModelOptions] = useState<string[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelFetchStatus, setModelFetchStatus] = useState<AiActionStatus>(EMPTY_STATUS);
  const [proxyScanStatus, setProxyScanStatus] = useState<AiActionStatus>(EMPTY_STATUS);
  const [proxyTestStatus, setProxyTestStatus] = useState<AiActionStatus>(EMPTY_STATUS);
  const [proxyCandidates, setProxyCandidates] = useState<ProxyCandidate[]>([]);
  const [codexAuth, setCodexAuth] = useState<{ authenticated: boolean; email?: string }>({ authenticated: false });
  const [codexFlow, setCodexFlow] = useState<{ userCode: string; verificationUri: string } | null>(null);
  const [codexBusy, setCodexBusy] = useState(false);
  const [codexMessage, setCodexMessage] = useState("");
  const [promptEditTarget, setPromptEditTarget] = useState<"daily" | "monthly">("daily");
  const codexPollTimer = useRef<number | null>(null);
  const modelPickerRef = useRef<HTMLDivElement | null>(null);
  const modelInputRef = useRef<HTMLInputElement | null>(null);
  const modelOptionsRef = usePopover({
    open: open && modelMenuOpen,
    onClose: () => setModelMenuOpen(false),
    anchorRef: modelPickerRef,
    restoreFocusRef: modelInputRef,
    itemSelector: "[role='option']:not([aria-disabled='true'])",
  });

  useEffect(() => {
    if (open) return;
    setShowAiApiKey(false);
    setAiModelOptions([]);
    setModelMenuOpen(false);
    setModelFetchStatus(EMPTY_STATUS);
    setProxyScanStatus(EMPTY_STATUS);
    setProxyTestStatus(EMPTY_STATUS);
    setProxyCandidates([]);
    setCodexFlow(null);
    setCodexMessage("");
    stopCodexPolling();
  }, [open]);

  useEffect(() => () => stopCodexPolling(), []);

  useEffect(() => {
    if (open && settings.aiProvider === "codex-oauth") void refreshCodexStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, settings.aiProvider]);

  function resetAiModelFetch() {
    setAiModelOptions([]);
    setModelMenuOpen(false);
    setModelFetchStatus(EMPTY_STATUS);
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
    updateSetting("aiBaseUrl", provider === "anthropic-native" ? "https://api.anthropic.com/v1" : "https://api.openai.com/v1");
  }

  function updateAiConnectionSetting<K extends "aiBaseUrl" | "aiApiKey">(key: K, value: AppSettings[K]) {
    resetAiModelFetch();
    updateSetting(key, value);
  }

  function applyOrcaRouterPreset() {
    resetAiModelFetch();
    updateSetting("aiProvider", "openai-compatible");
    updateSetting("aiBaseUrl", "https://api.orcarouter.ai/v1");
    updateSetting("aiModel", "orcarouter/auto");
  }

  function updateAiModel(model: string) {
    updateSetting("aiModel", model);
  }

  function selectAiModel(model: string) {
    updateAiModel(model);
    setModelMenuOpen(false);
  }

  function resetSystemPrompt() {
    const key = promptEditTarget === "daily" ? "dailySystemPrompt" : "monthlySystemPrompt";
    updateSetting(key, promptEditTarget === "daily" ? DEFAULT_DAILY_SYSTEM_PROMPT : DEFAULT_MONTHLY_SYSTEM_PROMPT);
  }

  async function fetchAiModels() {
    if (settings.aiProvider === "codex-oauth") {
      if (!codexAuth.authenticated) {
        setModelFetchStatus({ type: "error", message: "请先登录 ChatGPT 账号" });
        return;
      }
    } else if (!settings.aiBaseUrl.trim() || !settings.aiApiKey.trim()) {
      setModelFetchStatus({
        type: "error",
        message: settings.aiBaseUrl.trim() ? "请先填写 API Key" : "请先填写 Base URL",
      });
      return;
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
    if (codexPollTimer.current === null) return;
    clearTimeout(codexPollTimer.current);
    codexPollTimer.current = null;
  }

  async function refreshCodexStatus() {
    try {
      setCodexAuth(await invoke<{ authenticated: boolean; email?: string }>("codex_oauth_status"));
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
        // 浏览器启动失败时保留下方授权链接，供用户手动打开。
      }
      pollCodexLogin(flow, Date.now() + flow.expiresIn * 1000);
    } catch (error) {
      setCodexFlow(null);
      setCodexBusy(false);
      setCodexMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function pollCodexLogin(
    flow: { deviceCode: string; userCode: string; interval: number },
    deadline: number,
  ) {
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
    setProxyTestStatus(EMPTY_STATUS);
  }

  function updateProxyConnectionSetting<K extends "proxyUrl" | "proxyUsername" | "proxyPassword">(key: K, value: AppSettings[K]) {
    updateSetting(key, value);
    setProxyTestStatus(EMPTY_STATUS);
  }

  async function scanProxyCandidates() {
    setProxyCandidates([]);
    setProxyScanStatus({ type: "loading", message: "正在扫描本机常见代理端口..." });
    try {
      const candidates = await invoke<ProxyCandidate[]>("scan_proxy_candidates");
      setProxyCandidates(candidates);
      setProxyScanStatus(candidates.length > 0
        ? { type: "success", message: `发现 ${candidates.length} 个候选，点击即可填入` }
        : { type: "error", message: "未发现可连接的本地代理端口" });
    } catch (error) {
      setProxyScanStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  function selectProxyCandidate(candidate: ProxyCandidate) {
    updateSetting("proxyMode", "custom");
    updateSetting("proxyUrl", candidate.url);
    setProxyTestStatus(EMPTY_STATUS);
  }

  async function testProxyConnection() {
    setProxyTestStatus({ type: "loading", message: "正在测试外部连接..." });
    try {
      const result = await invoke<ProxyTestResult>("test_proxy_connection", { config: buildProxyConfig(settings) });
      setProxyTestStatus({ type: result.ok ? "success" : "error", message: result.message });
    } catch (error) {
      setProxyTestStatus({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    showAiApiKey,
    toggleAiApiKey: () => setShowAiApiKey((current) => !current),
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
  };
}

export type AiSettingsController = ReturnType<typeof useAiSettingsController>;
