import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { check, type Update as PendingAppUpdate } from "@tauri-apps/plugin-updater";
import type { ThemeMode, UpdateSummary } from "../model";

type SystemTheme = Exclude<ThemeMode, "system">;
type UpdateBusy = "checking" | "installing" | null;
type UpdateCheckSource = "manual" | "startup";
type StartupUpdateNotice = {
  id: number;
  version: string;
};

type Params = {
  themeMode: ThemeMode;
};

const UPDATE_CHECK_TIMEOUT_MS = 20000;
const STARTUP_UPDATE_CHECK_DISABLED = import.meta.env.VITE_TAURI_SMOKE === "1";

let startupUpdateCheckPromise: Promise<PendingAppUpdate | null> | null = null;
let startupUpdateNoticeId = 0;

export function useAppRuntime({ themeMode }: Params) {
  const [systemTheme, setSystemTheme] = useState<SystemTheme>(readSystemTheme);
  const [appVersion, setAppVersion] = useState("读取中");
  const [updateSummary, setUpdateSummary] = useState<UpdateSummary | null>(null);
  const [updateMessage, setUpdateMessage] = useState("当前版本信息读取中");
  const [updateProgress, setUpdateProgress] = useState("");
  const [updateBusy, setUpdateBusy] = useState<UpdateBusy>(null);
  const [pendingUpdate, setPendingUpdate] = useState<PendingAppUpdate | null>(null);
  const [startupUpdateNotice, setStartupUpdateNotice] = useState<StartupUpdateNotice | null>(null);
  const resolvedTheme = themeMode === "system" ? systemTheme : themeMode;

  useEffect(() => {
    let cancelled = false;

    getVersion()
      .then((version) => {
        if (cancelled) return;
        setAppVersion(version);
        setUpdateMessage(`当前版本 v${version}，可手动检查更新`);
        if (!STARTUP_UPDATE_CHECK_DISABLED) {
          void checkForStartupUpdates(version, () => cancelled);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAppVersion("开发环境");
        setUpdateMessage("当前是浏览器预览，在线更新仅在桌面应用中可用");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light");
    media.addEventListener("change", onMediaChange);

    let unlistenTheme: (() => void) | undefined;
    try {
      const appWindow = getCurrentWindow();
      appWindow
        .theme()
        .then((theme) => {
          const nextTheme = normalizeSystemTheme(theme);
          if (nextTheme) setSystemTheme(nextTheme);
        })
        .catch(() => undefined);
      appWindow
        .onThemeChanged(({ payload }) => {
          const nextTheme = normalizeSystemTheme(payload);
          if (nextTheme) setSystemTheme(nextTheme);
        })
        .then((unlisten) => {
          unlistenTheme = unlisten;
        })
        .catch(() => undefined);
    } catch {
      // Running in a browser-only preview has no Tauri window API.
    }

    return () => {
      media.removeEventListener("change", onMediaChange);
      unlistenTheme?.();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    try {
      getCurrentWindow().setTheme(themeMode === "system" ? null : themeMode).catch(() => undefined);
    } catch {
      // Browser-only preview fallback.
    }
  }, [resolvedTheme, themeMode]);

  useEffect(() => {
    return () => {
      pendingUpdate?.close().catch(() => undefined);
    };
  }, [pendingUpdate]);

  async function checkForUpdates() {
    await runUpdateCheck("manual", appVersion);
  }

  async function checkForStartupUpdates(currentVersion: string, isCancelled: () => boolean) {
    await runUpdateCheck("startup", currentVersion, isCancelled);
  }

  async function runUpdateCheck(source: UpdateCheckSource, currentVersion: string, isCancelled = () => false) {
    setUpdateBusy("checking");
    setUpdateProgress("");
    if (source === "manual") {
      setUpdateMessage("正在检查更新");
    }

    try {
      const nextUpdate = source === "startup"
        ? await checkStartupUpdateOnce()
        : await check({ timeout: UPDATE_CHECK_TIMEOUT_MS });

      if (isCancelled()) return;

      await replacePendingUpdate(nextUpdate);

      if (!nextUpdate) {
        setUpdateSummary(null);
        setUpdateMessage(`当前已是最新版本 v${currentVersion}`);
        return;
      }

      setUpdateSummary(summarizeUpdate(nextUpdate));
      setUpdateMessage(`发现新版本 v${nextUpdate.version}`);
      if (source === "startup") {
        setStartupUpdateNotice({ id: ++startupUpdateNoticeId, version: nextUpdate.version });
      }
    } catch (error) {
      if (isCancelled()) return;
      setUpdateSummary(null);
      if (source === "manual") {
        setUpdateMessage(formatUpdaterError(error));
      }
    } finally {
      if (!isCancelled()) {
        setUpdateBusy(null);
      }
    }
  }

  async function installUpdate() {
    if (!pendingUpdate) {
      setUpdateMessage("请先检查更新");
      return;
    }

    setUpdateBusy("installing");
    setUpdateProgress("正在下载安装包");
    setUpdateMessage(`正在安装 v${pendingUpdate.version}`);

    try {
      let total = 0;
      let downloaded = 0;

      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          setUpdateProgress(total > 0 ? `已下载 0 / ${formatBytes(total)}` : "开始下载更新包");
        }
        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setUpdateProgress(total > 0 ? `已下载 ${formatBytes(downloaded)} / ${formatBytes(total)}` : `已下载 ${formatBytes(downloaded)}`);
        }
        if (event.event === "Finished") {
          setUpdateProgress("下载完成，正在准备安装");
        }
      });

      setUpdateMessage("更新包已准备就绪，应用将退出并完成安装");
    } catch (error) {
      setUpdateMessage(formatUpdaterError(error));
      setUpdateProgress("");
    } finally {
      setUpdateBusy(null);
    }
  }

  async function replacePendingUpdate(nextUpdate: PendingAppUpdate | null) {
    if (pendingUpdate && pendingUpdate !== nextUpdate) {
      await pendingUpdate.close().catch(() => undefined);
    }
    setPendingUpdate(nextUpdate);
  }

  return {
    appVersion,
    updateSummary,
    updateMessage,
    updateProgress,
    updateBusy,
    startupUpdateNotice,
    checkForUpdates,
    installUpdate,
  };
}

function checkStartupUpdateOnce() {
  if (!startupUpdateCheckPromise) {
    startupUpdateCheckPromise = check({ timeout: UPDATE_CHECK_TIMEOUT_MS });
  }
  return startupUpdateCheckPromise;
}

function summarizeUpdate(update: PendingAppUpdate): UpdateSummary {
  return {
    currentVersion: update.currentVersion,
    version: update.version,
    notes: update.body || "本次版本未提供更新说明。",
    date: update.date,
  };
}

function formatUpdaterError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("plugin") || message.includes("updater")) {
    return "当前环境暂不可用在线更新，请在桌面打包版中重试";
  }
  return message;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function normalizeSystemTheme(theme: unknown): SystemTheme | null {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return null;
}

function readSystemTheme(): SystemTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
