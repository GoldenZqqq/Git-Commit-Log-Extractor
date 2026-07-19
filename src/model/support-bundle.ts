import type { AppSettings, DiagnosticResult, RepoInfo, SupportBundleEventInput, SupportBundleOptions } from "./types";

export function buildSupportBundleOptions(input: {
  settings: AppSettings;
  repos: RepoInfo[];
  diagnostics: DiagnosticResult | null;
  diagnosticError: string;
  recentEvents: SupportBundleEventInput[];
}): SupportBundleOptions {
  const { settings, repos, diagnostics, diagnosticError, recentEvents } = input;
  return {
    diagnostics,
    diagnosticError,
    workspace: {
      rootDirs: [...settings.rootDirs],
      indexedRepos: repos.map((repo) => ({ ...repo })),
      disabledRepos: [...settings.disabledRepos],
    },
    recentEvents: recentEvents.slice(-50).map((event) => ({ ...event })),
    privacy: {
      author: settings.author,
      outputDir: settings.outputDir,
      aiBaseUrl: settings.aiBaseUrl,
      proxyUrl: settings.proxyUrl,
      proxyUsername: settings.proxyUsername,
    },
  };
}
