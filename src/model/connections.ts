import type { AppSettings, ProxyConfig } from "./types";

export function buildProxyConfig(settings: AppSettings): ProxyConfig {
  return {
    mode: settings.proxyMode,
    url: settings.proxyUrl.trim(),
    username: settings.proxyUsername.trim(),
    password: settings.proxyPassword.trim(),
    passwordSaved: settings.proxyPasswordSaved,
  };
}
