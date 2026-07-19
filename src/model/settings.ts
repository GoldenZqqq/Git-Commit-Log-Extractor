import {
  DEFAULT_CUSTOM_REPORT_FORMAT_TEMPLATE,
  DEFAULT_DAILY_REPORT_FORMAT_TEMPLATE,
  DEFAULT_MONTHLY_REPORT_FORMAT_TEMPLATE,
  DEFAULT_WEEKLY_REPORT_FORMAT_TEMPLATE,
  type ReportPurposePreset,
  type ReportTemplateProfile,
} from "../reportFormat";
import { DEFAULT_REPORT_HISTORY_LIMIT, normalizeReportHistoryLimit } from "./history";
import { DEFAULT_DAILY_SYSTEM_PROMPT, DEFAULT_MONTHLY_SYSTEM_PROMPT } from "./report-options";

import type {
  AppSettings,
  CommitItemPrefixMode,
  LoadedSettingsState,
  ProxyMode,
  RepoIndexCache,
  RepoInfo,
  ThemeMode,
} from "./types";

export const STORAGE_KEY = "gitpulse-settings";
const REPO_INDEX_CACHE_KEY = "gitpulse-repo-index-cache";
export { REPORT_HISTORY_KEY } from "./history";
const LEGACY_STORAGE_KEY = "git-report-studio-settings";
const SETTINGS_MIGRATION_BACKUP_KEY = "gitpulse-settings-migration-backup";
const SETTINGS_CORRUPT_BACKUP_KEY = "gitpulse-settings-corrupt-backup";
const ENV_VAR_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const defaultSettings: AppSettings = {
  onboardingDone: false,
  rootDirs: [],
  outputDir: "",
  outputEnabled: false,
  themeMode: "system",
  author: "",
  authorAliasesText: "",
  evidenceLinkPrefixesText: "",
  disabledRepos: [],
  extractAllBranches: false,
  excludeMergeCommits: true,
  excludeRevertCommits: true,
  excludeBotCommits: true,
  detailedOutput: false,
  showProjectAndBranch: true,
  commitItemPrefixMode: "mapped-project",
  showEvidenceDetails: false,
  redactionEnabled: false,
  redactionRulesText: "",
  projectNamesText: "",
  aiEnabled: false,
  aiProvider: "openai-compatible",
  aiBaseUrl: "https://api.openai.com/v1",
  aiModel: "",
  aiApiKey: "",
  aiApiKeySaved: false,
  refinementInstruction: "",
  reportPurposePreset: "custom",
  reportTemplateProfile: "standard",
  dailyReportFormatTemplate: DEFAULT_DAILY_REPORT_FORMAT_TEMPLATE,
  weeklyReportFormatTemplate: DEFAULT_WEEKLY_REPORT_FORMAT_TEMPLATE,
  monthlyReportFormatTemplate: DEFAULT_MONTHLY_REPORT_FORMAT_TEMPLATE,
  customReportFormatTemplate: DEFAULT_CUSTOM_REPORT_FORMAT_TEMPLATE,
  dailySystemPrompt: DEFAULT_DAILY_SYSTEM_PROMPT,
  monthlySystemPrompt: DEFAULT_MONTHLY_SYSTEM_PROMPT,
  aiTemperature: 0.2,
  proxyMode: "off",
  proxyUrl: "",
  proxyUsername: "",
  proxyPassword: "",
  proxyPasswordSaved: false,
  reportHistoryLimit: DEFAULT_REPORT_HISTORY_LIMIT,
};

type RawSettings = Partial<AppSettings> & {
  aiKeyEnv?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  rootDir?: unknown;
};

type SettingsSource = {
  key: string;
  raw: RawSettings;
  text: string;
};

export function loadSettingsState(): LoadedSettingsState {
  const currentText = localStorage.getItem(STORAGE_KEY);
  const legacyText = localStorage.getItem(LEGACY_STORAGE_KEY);
  const backupText = localStorage.getItem(SETTINGS_MIGRATION_BACKUP_KEY);
  const current = parseSettingsSource(STORAGE_KEY, currentText);
  const legacy = parseSettingsSource(LEGACY_STORAGE_KEY, legacyText);
  const backup = parseSettingsSource(SETTINGS_MIGRATION_BACKUP_KEY, backupText);
  const currentCorrupt = currentText !== null && !current;
  if (currentCorrupt) preserveCorruptSettings(currentText);

  const source = current ?? legacy ?? backup;
  if (!source) return defaultLoadedSettings(currentCorrupt);

  const directApiKey = settingsFromRawApiKey(source.raw);
  const directKeyNeedsSecureMigration = Boolean(directApiKey && !isAiKeyReference(directApiKey));
  const legacyApiKey = findLegacyApiKey(source, [backup, legacy, current]);
  const settings = normalizeLoadedSettings(source.raw, legacyApiKey);
  const recoveredLegacyApiKey = directKeyNeedsSecureMigration || Boolean(legacyApiKey);
  const settingsMigrationPending = Boolean(
    source.key !== STORAGE_KEY
    || legacy
    || backup
    || legacyApiKey
    || directKeyNeedsSecureMigration,
  );
  preserveMigrationSource({
    source,
    legacyApiKey,
    directKeyNeedsSecureMigration,
    backupText,
    legacy,
    backup,
  });
  return {
    settings,
    recoveredLegacyApiKey,
    recoveredCorruptedSettings: currentCorrupt,
    settingsMigrationPending,
  };
}

export function finalizeSettingsMigration() {
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.removeItem(SETTINGS_MIGRATION_BACKUP_KEY);
}

function parseSettingsSource(key: string, text: string | null): SettingsSource | null {
  if (text === null) return null;
  try {
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    return { key, raw: raw as RawSettings, text };
  } catch {
    return null;
  }
}

function preserveCorruptSettings(text: string) {
  localStorage.setItem(SETTINGS_CORRUPT_BACKUP_KEY, text);
  localStorage.removeItem(STORAGE_KEY);
}

function preserveMigrationSource(options: {
  source: SettingsSource;
  legacyApiKey: string;
  directKeyNeedsSecureMigration: boolean;
  backupText: string | null;
  legacy: SettingsSource | null;
  backup: SettingsSource | null;
}) {
  const { source, legacyApiKey, directKeyNeedsSecureMigration, backupText, legacy, backup } = options;
  if (backupText !== null) return;
  const keySource = [source, legacy, backup].find((candidate) => (
    legacyApiKeyFrom(candidate?.raw) === legacyApiKey
  ));
  if (source.key !== STORAGE_KEY || legacyApiKey || directKeyNeedsSecureMigration) {
    localStorage.setItem(SETTINGS_MIGRATION_BACKUP_KEY, (keySource ?? source).text);
  }
}

function findLegacyApiKey(
  source: SettingsSource,
  candidates: Array<SettingsSource | null>,
) {
  if (settingsFromRawApiKey(source.raw)) return "";
  for (const candidate of [source, ...candidates]) {
    const value = legacyApiKeyFrom(candidate?.raw);
    if (value) return value;
  }
  return "";
}

function settingsFromRawApiKey(raw: RawSettings) {
  return typeof raw.aiApiKey === "string" ? raw.aiApiKey.trim() : "";
}

function legacyApiKeyFrom(raw: RawSettings | undefined) {
  return typeof raw?.aiKeyEnv === "string" ? raw.aiKeyEnv.trim() : "";
}

function defaultLoadedSettings(recoveredCorruptedSettings: boolean): LoadedSettingsState {
  return {
    settings: { ...defaultSettings },
    recoveredLegacyApiKey: false,
    recoveredCorruptedSettings,
    settingsMigrationPending: false,
  };
}

function normalizeLoadedSettings(raw: RawSettings, legacyApiKey: string): AppSettings {
  const persisted = { ...raw };
  delete persisted.aiKeyEnv;
  delete persisted.startDate;
  delete persisted.endDate;
  delete persisted.rootDir;
  const settings = { ...defaultSettings, ...persisted } as AppSettings;
  normalizePrimitiveSettings(settings);
  settings.rootDirs = normalizePathList(settings.rootDirs);
  settings.disabledRepos = normalizePathList(settings.disabledRepos);
  const legacyRoot = typeof raw.rootDir === "string" ? raw.rootDir.trim() : "";
  if (settings.rootDirs.length === 0 && legacyRoot) settings.rootDirs = [legacyRoot];
  if (raw.onboardingDone === undefined && settings.rootDirs.length > 0) settings.onboardingDone = true;
  if (!settings.aiApiKey.trim() && legacyApiKey) settings.aiApiKey = legacyApiKey;
  return settings;
}

const STRING_SETTING_KEYS = [
  "outputDir", "author", "authorAliasesText", "evidenceLinkPrefixesText",
  "redactionRulesText", "projectNamesText", "aiBaseUrl", "aiModel", "aiApiKey",
  "refinementInstruction", "dailySystemPrompt", "monthlySystemPrompt", "proxyUrl",
  "proxyUsername",
] as const satisfies readonly (keyof AppSettings)[];

const BOOLEAN_SETTING_KEYS = [
  "onboardingDone", "outputEnabled", "extractAllBranches", "excludeMergeCommits",
  "excludeRevertCommits", "excludeBotCommits", "detailedOutput", "showProjectAndBranch",
  "showEvidenceDetails", "redactionEnabled", "aiEnabled", "aiApiKeySaved",
  "proxyPasswordSaved",
] as const satisfies readonly (keyof AppSettings)[];

function normalizePrimitiveSettings(settings: AppSettings) {
  for (const key of STRING_SETTING_KEYS) normalizeSetting(settings, key, (value) => typeof value === "string");
  for (const key of BOOLEAN_SETTING_KEYS) normalizeSetting(settings, key, (value) => typeof value === "boolean");
  settings.proxyPassword = "";
  settings.aiProvider = normalizeAiProvider(settings.aiProvider);
  settings.proxyMode = normalizeProxyMode(settings.proxyMode);
  settings.themeMode = normalizeThemeMode(settings.themeMode);
  settings.commitItemPrefixMode = normalizeCommitItemPrefixMode(settings.commitItemPrefixMode);
  settings.reportPurposePreset = normalizeReportPurposePreset(settings.reportPurposePreset);
  settings.reportTemplateProfile = normalizeReportTemplateProfile(settings.reportTemplateProfile);
  settings.dailyReportFormatTemplate = normalizeReportFormatTemplate(settings.dailyReportFormatTemplate, DEFAULT_DAILY_REPORT_FORMAT_TEMPLATE);
  settings.weeklyReportFormatTemplate = normalizeReportFormatTemplate(settings.weeklyReportFormatTemplate, DEFAULT_WEEKLY_REPORT_FORMAT_TEMPLATE);
  settings.monthlyReportFormatTemplate = normalizeReportFormatTemplate(settings.monthlyReportFormatTemplate, DEFAULT_MONTHLY_REPORT_FORMAT_TEMPLATE);
  settings.customReportFormatTemplate = normalizeReportFormatTemplate(settings.customReportFormatTemplate, DEFAULT_CUSTOM_REPORT_FORMAT_TEMPLATE);
  settings.aiTemperature = normalizeAiTemperature(settings.aiTemperature);
  settings.reportHistoryLimit = typeof settings.reportHistoryLimit === "number"
    ? normalizeReportHistoryLimit(settings.reportHistoryLimit)
    : defaultSettings.reportHistoryLimit;
}

function normalizeSetting<K extends keyof AppSettings>(
  settings: AppSettings,
  key: K,
  isValid: (value: AppSettings[K]) => boolean,
) {
  if (!isValid(settings[key])) settings[key] = defaultSettings[key];
}

function normalizePathList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(isNonEmptyString).map((path) => stripWindowsVerbatimPrefix(path.trim()));
}

function normalizeAiTemperature(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 2
    ? value
    : defaultSettings.aiTemperature;
}

export function settingsForPersistence(settings: AppSettings): AppSettings {
  const aiApiKey = settings.aiApiKey.trim();
  return {
    ...settings,
    aiApiKey: isAiKeyReference(aiApiKey) ? aiApiKey : "",
    proxyPassword: "",
  };
}

export function loadRepoIndexCache(rootDirs: string[]): RepoIndexCache | null {
  const saved = localStorage.getItem(REPO_INDEX_CACHE_KEY);
  if (!saved) return null;

  let rawCache: Partial<RepoIndexCache>;
  try {
    rawCache = JSON.parse(saved);
  } catch {
    localStorage.removeItem(REPO_INDEX_CACHE_KEY);
    return null;
  }

  if (!rawCache || typeof rawCache !== "object" || Array.isArray(rawCache)) return null;
  if (!Array.isArray(rawCache.rootDirs) || !samePathSet(rawCache.rootDirs, rootDirs)) return null;
  if (!Array.isArray(rawCache.repos)) return null;

  const repos = rawCache.repos.filter(isRepoInfo);
  return {
    rootDirs: rawCache.rootDirs.filter(isNonEmptyString).map(stripWindowsVerbatimPrefix),
    repos,
    scannedAt: typeof rawCache.scannedAt === "string" ? rawCache.scannedAt : "",
  };
}

export function saveRepoIndexCache(rootDirs: string[], repos: RepoInfo[]) {
  const cache: RepoIndexCache = {
    rootDirs: rootDirs.filter(isNonEmptyString).map(stripWindowsVerbatimPrefix),
    repos,
    scannedAt: new Date().toISOString(),
  };
  return persistRepoIndexCache(cache);
}

export function persistRepoIndexCache(cache: RepoIndexCache) {
  const normalized: RepoIndexCache = {
    rootDirs: cache.rootDirs.filter(isNonEmptyString).map(stripWindowsVerbatimPrefix),
    repos: cache.repos.filter(isRepoInfo),
    scannedAt: typeof cache.scannedAt === "string" ? cache.scannedAt : "",
  };
  localStorage.setItem(REPO_INDEX_CACHE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearRepoIndexCache() {
  localStorage.removeItem(REPO_INDEX_CACHE_KEY);
}


function looksLikeEnvVarName(value: string) {
  return ENV_VAR_NAME_PATTERN.test(value);
}

export function isAiKeyReference(value: string) {
  return looksLikeEnvVarName(value) || value.startsWith("env:");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRepoInfo(value: unknown): value is RepoInfo {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const repo = value as Partial<RepoInfo>;
  return isNonEmptyString(repo.path) && isNonEmptyString(repo.name) && typeof repo.branch === "string";
}

function samePathSet(left: unknown[], right: string[]) {
  const normalize = (values: unknown[]) => values
    .filter(isNonEmptyString)
    .map((value) => stripWindowsVerbatimPrefix(value.trim()).toLowerCase())
    .sort();
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function normalizeAiProvider(value: unknown): AppSettings["aiProvider"] {
  if (value === "openai-compatible" || value === "anthropic-native" || value === "codex-oauth") {
    return value;
  }
  return defaultSettings.aiProvider;
}

function normalizeProxyMode(value: unknown): ProxyMode {
  if (value === "custom") return value;
  return defaultSettings.proxyMode;
}

function normalizeThemeMode(value: unknown): ThemeMode {
  if (value === "system" || value === "light" || value === "dark") {
    return value;
  }
  return defaultSettings.themeMode;
}

function normalizeCommitItemPrefixMode(value: unknown): CommitItemPrefixMode {
  if (
    value === "mapped-project"
    || value === "repo-branch-and-mapped"
    || value === "repo-branch"
    || value === "none"
  ) {
    return value;
  }
  return defaultSettings.commitItemPrefixMode;
}

function normalizeReportTemplateProfile(value: unknown): ReportTemplateProfile {
  if (value === "auto") return "standard";
  if (value === "daily" || value === "weekly") return "grouped";
  if (value === "performance") return "evidence";
  if (value === "standard" || value === "grouped" || value === "evidence" || value === "concise" || value === "custom") {
    return value;
  }
  return defaultSettings.reportTemplateProfile;
}

function normalizeReportPurposePreset(value: unknown): ReportPurposePreset {
  if (
    value === "custom"
    || value === "daily-sync"
    || value === "weekly-briefing"
    || value === "performance"
    || value === "project-review"
  ) {
    return value;
  }
  return defaultSettings.reportPurposePreset;
}

function normalizeReportFormatTemplate(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function stripWindowsVerbatimPrefix(path: string) {
  if (path.startsWith("\\\\?\\UNC\\")) {
    return `\\\\${path.slice("\\\\?\\UNC\\".length)}`;
  }
  if (path.startsWith("\\\\?\\")) {
    return path.slice("\\\\?\\".length);
  }
  return path;
}

