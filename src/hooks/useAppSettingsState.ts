import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConfigProfileSettings } from "../configProfile";
import {
  finalizeSettingsMigration,
  isAiKeyReference,
  normalizeReportHistoryLimit,
  settingsForPersistence,
  STORAGE_KEY,
  type AppSettings,
  type LoadedSettingsState,
} from "../model";

type StatusOptions = { notify?: boolean; tone?: "info" | "success" | "warning" | "error" | "loading"; duration?: number };

type Params = {
  loadedSettings: LoadedSettingsState;
  onResizeHistory: (limit: AppSettings["reportHistoryLimit"]) => void;
  setStatus: (message: string, options?: StatusOptions) => void;
};

export function useAppSettingsState({ loadedSettings, onResizeHistory, setStatus }: Params) {
  const [settings, setSettings] = useState<AppSettings>(loadedSettings.settings);
  const aiApiKeySaveTimer = useRef<number | null>(null);
  const proxyPasswordSaveTimer = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsForPersistence(settings)));
  }, [settings]);

  useEffect(() => {
    const currentApiKey = settings.aiApiKey.trim();
    if (currentApiKey) {
      if (!isAiKeyReference(currentApiKey)) {
        void persistSecureAiApiKey(currentApiKey).then((saved) => {
          if (saved && loadedSettings.settingsMigrationPending) finalizeSettingsMigration();
        });
      } else if (loadedSettings.settingsMigrationPending) finalizeSettingsMigration();
      return;
    }
    if (loadedSettings.settingsMigrationPending) finalizeSettingsMigration();
    invoke<string | null>("get_secure_ai_api_key")
      .then((apiKey) => {
        if (!apiKey) return;
        setSettings((current) => current.aiApiKey.trim() ? current : { ...current, aiApiKey: apiKey, aiApiKeySaved: true });
        setStatus("已从系统凭据库读取 AI API Key");
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const currentPassword = settings.proxyPassword.trim();
    if (currentPassword) {
      void persistSecureProxyPassword(currentPassword);
      return;
    }
    invoke<string | null>("get_secure_proxy_password")
      .then((password) => {
        if (!password) return;
        setSettings((current) => current.proxyPassword.trim() ? current : { ...current, proxyPassword: password, proxyPasswordSaved: true });
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (aiApiKeySaveTimer.current !== null) window.clearTimeout(aiApiKeySaveTimer.current);
    if (proxyPasswordSaveTimer.current !== null) window.clearTimeout(proxyPasswordSaveTimer.current);
  }, []);

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    if (key === "reportHistoryLimit") {
      const limit = normalizeReportHistoryLimit(value);
      setSettings((current) => ({ ...current, reportHistoryLimit: limit }));
      onResizeHistory(limit);
      return;
    }
    if (key === "aiApiKey") {
      const aiApiKey = String(value);
      setSettings((current) => ({
        ...current,
        aiApiKey,
        aiApiKeySaved: current.aiApiKeySaved && current.aiApiKey === aiApiKey && Boolean(aiApiKey.trim()) && !isAiKeyReference(aiApiKey.trim()),
      }));
      scheduleSecureAiApiKeySync(aiApiKey);
      return;
    }
    if (key === "proxyPassword") {
      const proxyPassword = String(value);
      setSettings((current) => ({
        ...current,
        proxyPassword,
        proxyPasswordSaved: current.proxyPasswordSaved && current.proxyPassword === proxyPassword && Boolean(proxyPassword.trim()),
      }));
      scheduleSecureProxyPasswordSync(proxyPassword);
      return;
    }
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function applyConfigProfileSettings(profileSettings: ConfigProfileSettings) {
    setSettings((current) => ({ ...current, ...profileSettings }));
  }

  function scheduleSecureAiApiKeySync(value: string) {
    if (aiApiKeySaveTimer.current !== null) window.clearTimeout(aiApiKeySaveTimer.current);
    aiApiKeySaveTimer.current = window.setTimeout(() => {
      aiApiKeySaveTimer.current = null;
      void persistSecureAiApiKey(value);
    }, 500);
  }

  async function persistSecureAiApiKey(value: string): Promise<boolean> {
    const apiKey = value.trim();
    try {
      if (!apiKey || isAiKeyReference(apiKey)) {
        await invoke("clear_secure_ai_api_key");
        setSettings((current) => ({ ...current, aiApiKeySaved: false }));
        return true;
      }
      await invoke("set_secure_ai_api_key", { apiKey });
      setSettings((current) => current.aiApiKey.trim() === apiKey ? { ...current, aiApiKeySaved: true } : current);
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), { tone: "error", notify: true, duration: 4200 });
      return false;
    }
  }

  function scheduleSecureProxyPasswordSync(value: string) {
    if (proxyPasswordSaveTimer.current !== null) window.clearTimeout(proxyPasswordSaveTimer.current);
    proxyPasswordSaveTimer.current = window.setTimeout(() => {
      proxyPasswordSaveTimer.current = null;
      void persistSecureProxyPassword(value);
    }, 500);
  }

  async function persistSecureProxyPassword(value: string) {
    const password = value.trim();
    try {
      if (!password) {
        await invoke("clear_secure_proxy_password");
        setSettings((current) => ({ ...current, proxyPasswordSaved: false }));
        return;
      }
      await invoke("set_secure_proxy_password", { password });
      setSettings((current) => current.proxyPassword.trim() === password ? { ...current, proxyPasswordSaved: true } : current);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), { tone: "error", notify: true, duration: 4200 });
    }
  }

  return { loadedSettings, settings, setSettings, updateSetting, applyConfigProfileSettings };
}
