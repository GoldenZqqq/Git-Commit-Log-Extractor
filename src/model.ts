import {
  DEFAULT_CUSTOM_REPORT_FORMAT_TEMPLATE,
  DEFAULT_DAILY_REPORT_FORMAT_TEMPLATE,
  DEFAULT_MONTHLY_REPORT_FORMAT_TEMPLATE,
  DEFAULT_WEEKLY_REPORT_FORMAT_TEMPLATE,
  type ReportFormatKind,
  type ReportPurposePreset,
  type ReportTemplateProfile,
  purposeRefinementInstruction,
} from "./reportFormat";
import {
  isSupplementalItemsValue,
  SUPPLEMENTAL_FACT_PRESERVATION_INSTRUCTION,
  validateSupplementalItems,
} from "./supplementalItems";

export type RepoInfo = {
  path: string;
  name: string;
  branch: string;
};

export type CommitRecord = {
  repoPath: string;
  projectName: string;
  branchName: string;
  hash: string;
  author: string;
  authorEmail: string;
  date: string;
  message: string;
};

export type RepoScanProgress = {
  rootDir: string;
  currentPath: string;
  scannedDirs: number;
  foundRepos: number;
  done: boolean;
  cancelled: boolean;
};

export type RepoScanResult = {
  repos: RepoInfo[];
  warnings: string[];
};

export type WorkspaceRootStatus = "healthy" | "missing" | "inaccessible" | "not_directory";
export type WorkspaceRepoStatus =
  | "healthy"
  | "missing"
  | "inaccessible"
  | "not_git"
  | "branch_unknown"
  | "branch_changed";

export type WorkspaceRootHealth = {
  path: string;
  status: WorkspaceRootStatus;
  detail: string;
};

export type WorkspaceRepoHealth = {
  path: string;
  name: string;
  cachedBranch: string;
  currentBranch: string;
  status: WorkspaceRepoStatus;
  detail: string;
  disabled: boolean;
};

export type WorkspaceHealthResult = {
  roots: WorkspaceRootHealth[];
  repos: WorkspaceRepoHealth[];
};

export type CommitExtractProgress = {
  totalRepos: number;
  completedRepos: number;
  currentRepo: string;
  commitCount: number;
  warningCount: number;
  concurrency: number;
  done: boolean;
};

export type ReportHistoryProject = {
  name: string;
  commitCount: number;
  evidenceIds: string[];
};

export type ExtractResult = {
  repos: RepoInfo[];
  summaryText: string;
  detailedText: string;
  warnings: string[];
  commits: CommitRecord[];
  projects: ReportHistoryProject[];
};

export type MonthlyReportResult = {
  reportText: string;
  outputFile: string;
  warnings: string[];
  monthLabel: string;
  commitCount: number;
};

export type PeriodReportKind = "weekly" | "monthly";

export type ExtractReportKind = Extract<ReportFormatKind, "daily" | "custom">;

export type PeriodReportResult = {
  reportText: string;
  outputFile: string;
  warnings: string[];
  startDate: string;
  endDate: string;
  periodLabel: string;
  reportKind: PeriodReportKind;
  projectCount: number;
  commitCount: number;
  projects: ReportHistoryProject[];
};

export type ReportEnhanceResult = {
  reportText: string;
  warnings: string[];
};

export type BlankDayFillResult = {
  draftText: string;
  warnings: string[];
  itemCount: number;
  sourceCommitCount: number;
};

export type BlankDayItemCount = 3 | 5 | 8;

export const DEFAULT_BLANK_DAY_ITEM_COUNT: BlankDayItemCount = 5;

export const BLANK_DAY_ITEM_COUNT_OPTIONS: BlankDayItemCount[] = [3, 5, 8];

export const DEFAULT_BLANK_DAY_USER_PROMPT = [
  "请基于我提供的历史 Git 提交线索，为目标日写一份具体、可核对的日报延续草稿。",
  "要求：",
  "1. 每条必须从历史线索中指出一个具体锚点，如已有功能、接口、数据流、页面、脚本、测试、异常路径或技术对象",
  "2. 优先写最可能的代码级延续：功能延伸、缺陷或回归修复、异常/边界/兼容性处理、测试补强，或已有接口与数据流的衔接",
  "3. 不得只写「跟进 / 排查 / 推进 / 联调 / 整理」；如确需使用，必须同时写清具体对象、问题模式和拟采取的动作",
  "4. 多条内容应覆盖不同历史锚点或不同具体动作，避免同义改写和注水",
  "5. 严格输出 N 条短要点列表（每行一条，可用 - 前缀），每条一句话",
  "6. 若历史线索条目带有项目前缀（如「映射项目名 - 」或「仓库(分支) - 」），每条输出必须保留同风格前缀，与日常日报配置一致",
  "7. 潜在缺陷只能写拟采取的保护或修复动作，不得声称故障已经发生；不要写已上线、已完成验收、百分比进度等无法核实的表述",
  "8. 语气正式，可直接粘贴到日报",
].join("\n");

const BLANK_DAY_TIP_DISMISSED_KEY = "gitpulse.blankDayFillTipDismissed";

export type PreviewMode = "summary" | "weekly" | "custom" | "monthly";

export type ReportHistoryLimit = 30 | 60 | 120 | 200;

export const REPORT_HISTORY_LIMIT_OPTIONS: ReportHistoryLimit[] = [30, 60, 120, 200];

export const DEFAULT_REPORT_HISTORY_LIMIT: ReportHistoryLimit = 120;

export type ReportExportFormat = "markdown" | "docx" | "pdf";

export type SplitGranularity = "daily" | "weekly" | "monthly" | "custom";

export type BatchGroupMode = "all" | "author" | "project";

export const DEFAULT_BATCH_FILE_NAME_TEMPLATE = "{period}-{type}.{ext}";

export type BatchReportProgress = {
  total: number;
  completed: number;
  currentLabel: string;
  succeeded: number;
  failed: number;
  done: boolean;
};

export type BatchReportResult = {
  total: number;
  succeeded: number;
  failed: number;
  failures: BatchFailure[];
  outputDir: string;
};

export type BatchFailure = {
  label: string;
  error: string;
};

export type DateRange = {
  startDate: string;
  endDate: string;
};

export type ReportFormatTemplates = {
  daily: string;
  weekly: string;
  monthly: string;
  custom: string;
};

export type ReportHistoryEntry = {
  id: string;
  mode: PreviewMode;
  title: string;
  range: DateRange;
  periodLabel: string;
  generatedAt: string;
  repoCount: number;
  projectCount?: number;
  commitCount: number;
  aiEnhanced: boolean;
  outputFile: string;
  reportText: string;
  supplementalItems?: string[];
  projects?: ReportHistoryProject[];
};

export type LegacyReportHistoryState = {
  entries: ReportHistoryEntry[];
  present: boolean;
  valid: boolean;
  warning: string;
};

export type ReportPolishReview = {
  mode: PreviewMode;
  range: DateRange;
  periodLabel: string;
  originalText: string;
  polishedText: string;
  warnings: string[];
  repoCount: number;
  commitCount: number;
  projectCount: number;
  supplementalItems: string[];
  projects?: ReportHistoryProject[];
};

export type UpdateSummary = {
  currentVersion: string;
  version: string;
  notes: string;
  date?: string;
};

export type GitIdentity = {
  userName: string;
  userEmail: string;
};

export type AuthorAliasGroup = {
  displayName: string;
  aliases: string[];
};

export type EvidenceLinkRule = {
  prefix: string;
  urlTemplate: string;
};

export type ReportRedactionRule = {
  find: string;
  replacement: string;
};

export type ReportRedactionOptions = {
  enabled: boolean;
  rules: ReportRedactionRule[];
};

export type AiModelInfo = {
  id: string;
};

export type ProxyMode = "off" | "custom";

export type ProxyConfig = {
  mode: ProxyMode;
  url: string;
  username: string;
  password: string;
  passwordSaved: boolean;
};

export type ProxyCandidate = {
  url: string;
  label: string;
};

export type ProxyTestResult = {
  ok: boolean;
  message: string;
  latencyMs: number;
};

export type DiagnosticSeverity = "ok" | "warning" | "error";

export type DiagnosticItem = {
  id: string;
  label: string;
  severity: DiagnosticSeverity;
  message: string;
  action: string;
};

export type DiagnosticResult = {
  items: DiagnosticItem[];
  okCount: number;
  warningCount: number;
  errorCount: number;
};

export type SupportBundleEventLevel = "info" | "success" | "warning" | "error";

export type SupportBundleEventInput = {
  occurredAt: string;
  level: SupportBundleEventLevel;
  message: string;
};

export type SupportBundlePrivacyContext = {
  author: string;
  outputDir: string;
  aiBaseUrl: string;
  proxyUrl: string;
  proxyUsername: string;
};

export type SupportBundleOptions = {
  diagnostics: DiagnosticResult | null;
  diagnosticError: string;
  workspace: {
    rootDirs: string[];
    indexedRepos: RepoInfo[];
    disabledRepos: string[];
  };
  recentEvents: SupportBundleEventInput[];
  privacy: SupportBundlePrivacyContext;
};

export type SupportBundleEntryPreview = {
  name: string;
  description: string;
  content: string;
  bytes: number;
};

export type SupportBundlePreview = {
  schemaVersion: number;
  generatedAt: string;
  suggestedFileName: string;
  entries: SupportBundleEntryPreview[];
  excludedData: string[];
  issueTitle: string;
  issueBody: string;
};

export type SupportBundleExportResult = {
  outputFile: string;
  bytes: number;
};

export type ThemeMode = "system" | "light" | "dark";
export type CommitItemPrefixMode = "mapped-project" | "repo-branch-and-mapped" | "repo-branch" | "none";

export type AppSettings = {
  onboardingDone: boolean;
  rootDirs: string[];
  outputDir: string;
  outputEnabled: boolean;
  themeMode: ThemeMode;
  author: string;
  authorAliasesText: string;
  evidenceLinkPrefixesText: string;
  disabledRepos: string[];
  extractAllBranches: boolean;
  excludeMergeCommits: boolean;
  excludeRevertCommits: boolean;
  excludeBotCommits: boolean;
  detailedOutput: boolean;
  showProjectAndBranch: boolean;
  commitItemPrefixMode: CommitItemPrefixMode;
  showEvidenceDetails: boolean;
  redactionEnabled: boolean;
  redactionRulesText: string;
  projectNamesText: string;
  aiEnabled: boolean;
  aiProvider: "openai-compatible" | "anthropic-native" | "codex-oauth";
  aiBaseUrl: string;
  aiModel: string;
  aiApiKey: string;
  aiApiKeySaved: boolean;
  refinementInstruction: string;
  reportPurposePreset: ReportPurposePreset;
  reportTemplateProfile: ReportTemplateProfile;
  dailyReportFormatTemplate: string;
  weeklyReportFormatTemplate: string;
  monthlyReportFormatTemplate: string;
  customReportFormatTemplate: string;
  dailySystemPrompt: string;
  monthlySystemPrompt: string;
  aiTemperature: number;
  proxyMode: ProxyMode;
  proxyUrl: string;
  proxyUsername: string;
  proxyPassword: string;
  proxyPasswordSaved: boolean;
  reportHistoryLimit: ReportHistoryLimit;
};

export type LoadedSettingsState = {
  settings: AppSettings;
  recoveredLegacyApiKey: boolean;
  recoveredCorruptedSettings: boolean;
  settingsMigrationPending: boolean;
};

export const STORAGE_KEY = "gitpulse-settings";
const REPO_INDEX_CACHE_KEY = "gitpulse-repo-index-cache";
export const REPORT_HISTORY_KEY = "gitpulse-report-history";
const LEGACY_STORAGE_KEY = "git-report-studio-settings";
const SETTINGS_MIGRATION_BACKUP_KEY = "gitpulse-settings-migration-backup";
const SETTINGS_CORRUPT_BACKUP_KEY = "gitpulse-settings-corrupt-backup";
const ENV_VAR_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const EVIDENCE_PRESERVATION_INSTRUCTION =
  "已启用提交证据详情。请保留每条事项下方的「来源」引用块，不要改写仓库、分支、日期、commit hash 或原始提交信息。";
const REDACTION_PRESERVATION_INSTRUCTION =
  "已启用报告脱敏。请保留仓库、分支、作者和 commit 的脱敏别名，不要推测或还原真实名称。";
const TEMPLATE_PRESERVATION_INSTRUCTION =
  "请保留当前报告草稿的模板结构、标题层级和分段顺序，不要改成其他固定格式。";

export type RepoIndexCache = {
  rootDirs: string[];
  repos: RepoInfo[];
  scannedAt: string;
};

// 与 src-tauri/src/ai.rs 的内置默认系统提示词逐字一致。作为可编辑提示词的默认值与“恢复默认”目标；
// 用户留空时后端会回退到同源的 Rust 默认，行为不变。
export const DEFAULT_DAILY_SYSTEM_PROMPT =
  "你是一个严谨的工作日报写作助手。请基于 Git 提交记录润色为当天或指定周期的工作日报，不要虚构没有依据的业务结果、上线结论或百分比。最终输出保持为简洁纯文本或短列表，方便直接复制到工作汇报中。";
export const DEFAULT_WEEKLY_SYSTEM_PROMPT =
  "你是一个严谨的工作周报写作助手。请基于 Git 提交周报草稿改写，不要虚构没有依据的业务结果、上线结论或百分比。最终输出必须是 Markdown，标题之外的正文只包含三大模块：本周重点、实际完成情况、下周关注。每个模块尽量保留项目分组和可追溯事项。";
export const DEFAULT_MONTHLY_SYSTEM_PROMPT =
  "你是一个严谨的绩效月报写作助手。请基于 Git 提交月报草稿改写，不要虚构没有依据的业务结果、上线结论或百分比。最终输出必须是 Markdown，标题之外的正文只包含三大模块：项目进度、实际完成情况、当月总结。每个模块下必须继续按照项目分组。";

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

export function normalizeReportHistoryLimit(value: unknown): ReportHistoryLimit {
  const numeric = typeof value === "number" ? value : Number(value);
  if (numeric === 30 || numeric === 60 || numeric === 120 || numeric === 200) {
    return numeric;
  }
  return DEFAULT_REPORT_HISTORY_LIMIT;
}

export function readLegacyReportHistory(
  limit: ReportHistoryLimit = DEFAULT_REPORT_HISTORY_LIMIT,
): LegacyReportHistoryState {
  const saved = localStorage.getItem(REPORT_HISTORY_KEY);
  if (saved === null) return { entries: [], present: false, valid: true, warning: "" };

  let rawHistory: unknown;
  try {
    rawHistory = JSON.parse(saved);
  } catch {
    return invalidLegacyHistory("旧报告历史不是有效 JSON，已保留原数据供手动恢复");
  }

  if (!Array.isArray(rawHistory) || !rawHistory.every(isReportHistoryEntry)) {
    return invalidLegacyHistory("旧报告历史格式异常，已保留原数据供手动恢复");
  }
  return {
    entries: normalizeReportHistoryEntries(rawHistory, limit),
    present: true,
    valid: true,
    warning: "",
  };
}

export function normalizeReportHistoryEntries(
  entries: ReportHistoryEntry[],
  limit: ReportHistoryLimit = DEFAULT_REPORT_HISTORY_LIMIT,
): ReportHistoryEntry[] {
  const ids = new Set<string>();
  return entries
    .filter(isReportHistoryEntry)
    .filter((entry) => {
      if (ids.has(entry.id)) return false;
      ids.add(entry.id);
      return true;
    })
    .slice(0, normalizeReportHistoryLimit(limit));
}

export function rememberReportHistoryEntry(
  entries: ReportHistoryEntry[],
  entry: ReportHistoryEntry,
  limit: ReportHistoryLimit = DEFAULT_REPORT_HISTORY_LIMIT,
): ReportHistoryEntry[] {
  return normalizeReportHistoryEntries([entry, ...entries.filter((item) => item.id !== entry.id)], limit);
}

export function updateReportHistoryEntry(
  entries: ReportHistoryEntry[],
  id: string,
  patch: Partial<Pick<ReportHistoryEntry, "outputFile" | "reportText" | "commitCount" | "generatedAt">>,
  limit: ReportHistoryLimit = DEFAULT_REPORT_HISTORY_LIMIT,
): ReportHistoryEntry[] {
  if (!id) return entries;
  const nextEntries = entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
  return normalizeReportHistoryEntries(nextEntries, limit);
}

export function clearLegacyReportHistory() {
  localStorage.removeItem(REPORT_HISTORY_KEY);
}

function invalidLegacyHistory(warning: string): LegacyReportHistoryState {
  return { entries: [], present: true, valid: false, warning };
}

export function isBlankDayHistoryEntry(entry: ReportHistoryEntry) {
  return entry.title.startsWith("空白日补写") || entry.periodLabel.includes("补写草稿");
}

export function getReportCalendarAnchorDate(entry: ReportHistoryEntry) {
  if (entry.mode === "summary") return entry.range.startDate;
  return entry.range.endDate || entry.range.startDate;
}

export function getReportCalendarKind(entry: ReportHistoryEntry): "daily" | "blank" | "weekly" | "monthly" | "custom" {
  if (entry.mode === "weekly") return "weekly";
  if (entry.mode === "monthly") return "monthly";
  if (entry.mode === "custom") return "custom";
  if (isBlankDayHistoryEntry(entry)) return "blank";
  return "daily";
}

export function groupReportHistoryByAnchorDate(entries: ReportHistoryEntry[]) {
  const map = new Map<string, ReportHistoryEntry[]>();
  for (const entry of entries) {
    const day = getReportCalendarAnchorDate(entry);
    if (!day) continue;
    const list = map.get(day) ?? [];
    list.push(entry);
    map.set(day, list);
  }
  for (const [day, list] of map) {
    list.sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
    map.set(day, list);
  }
  return map;
}

export type MappingEntry = {
  key: string;
  displayName: string;
};

export type MappingSuggestion = {
  key: string;
  displayName: string;
  repoName: string;
  branch: string;
  reason: string;
};

export function parseMappingText(text: string): MappingEntry[] {
  return text.split(/\r?\n/).reduce<MappingEntry[]>((rows, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return rows;
    const separatorIndex = line.indexOf("->");
    if (separatorIndex < 0) return rows;
    rows.push({
      key: line.slice(0, separatorIndex).trim(),
      displayName: line.slice(separatorIndex + 2).trim(),
    });
    return rows;
  }, []);
}

export function serializeMappingText(rows: MappingEntry[]): string {
  return rows.map((row) => `${row.key} -> ${row.displayName}`).join("\n");
}

export function mergeMappingEntries(existing: string, entries: MappingEntry[]): string {
  const merged = new Map<string, string>();
  for (const row of parseMappingText(existing)) merged.set(row.key, row.displayName);
  for (const row of entries) {
    if (row.key && row.displayName) merged.set(row.key, row.displayName);
  }
  return serializeMappingText([...merged].map(([key, displayName]) => ({ key, displayName })));
}

export function buildMappingKeys(repos: RepoInfo[]): string[] {
  return repos.flatMap((repo) => {
    const keys = [`${repo.name}(*)`];
    if (repo.branch) keys.push(`${repo.name}(${repo.branch})`);
    return keys;
  });
}

export function buildMappingSuggestions(repos: RepoInfo[], rows: MappingEntry[]): MappingSuggestion[] {
  const mappedKeys = new Set(rows.map((row) => row.key).filter(Boolean));
  const seenSuggestionKeys = new Set<string>();
  return repos.reduce<MappingSuggestion[]>((suggestions, repo) => {
    const allKey = `${repo.name}(*)`;
    const branchKey = `${repo.name}(${repo.branch})`;
    if (mappedKeys.has(allKey) || mappedKeys.has(branchKey) || seenSuggestionKeys.has(allKey)) {
      return suggestions;
    }
    seenSuggestionKeys.add(allKey);
    const historicalName = findHistoricalMappingName(repo, rows);
    suggestions.push({
      key: allKey,
      displayName: historicalName || humanizeRepoName(repo.name, repo.branch),
      repoName: repo.name,
      branch: repo.branch,
      reason: historicalName ? "沿用同仓库历史映射" : buildMappingSuggestionReason(repo),
    });
    return suggestions;
  }, []);
}

export function parseProjectNames(text: string): Record<string, string> {
  return parseMappingText(text).reduce<Record<string, string>>((result, row) => {
    if (row.key && row.displayName) result[row.key] = row.displayName;
    return result;
  }, {});
}

function findHistoricalMappingName(repo: RepoInfo, rows: MappingEntry[]) {
  const prefix = `${repo.name}(`;
  const matched = rows.find((row) => row.key.startsWith(prefix) && row.displayName.trim());
  return matched?.displayName.trim() ?? "";
}

function humanizeRepoName(repoName: string, branchName: string) {
  const baseName = repoName.replace(/\.git$/i, "").trim();
  const displayName = humanizeWords(baseName);
  if (!isGenericRepoName(baseName) || isDefaultBranch(branchName)) return displayName;
  const branchDisplayName = humanizeWords(branchName);
  return branchDisplayName ? `${branchDisplayName} ${displayName}` : displayName;
}

function humanizeWords(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_.]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(formatDisplayWord)
    .join(" ");
}

function formatDisplayWord(word: string) {
  if (/[\u4e00-\u9fff]/.test(word) || /^[A-Z0-9]{2,}$/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function isGenericRepoName(repoName: string) {
  return /^(api|app|backend|client|frontend|server|service|web)$/i.test(repoName.trim());
}

function isDefaultBranch(branchName: string) {
  return /^(main|master|dev|develop|development|trunk)$/i.test(branchName.trim());
}

function buildMappingSuggestionReason(repo: RepoInfo) {
  if (!repo.branch || isDefaultBranch(repo.branch)) return "根据仓库名生成";
  return `根据仓库名和 ${repo.branch} 分支生成`;
}

// 与 Rust 端 report.rs 的 TRAILING_CONNECTORS 保持一致：映射名末尾可能带连接符，统一去除。
const TRAILING_CONNECTORS = /[-_：:；;、 ]+$/;

// 复刻 Rust resolve_project_name 的查找规则：先精确键 name(branch)，再通配键 name(*)，
// 命中则去掉末尾连接符返回映射名；未配置映射时回退到仓库原名，保证索引展示与报告内容一致。
export function resolveRepoDisplayName(repo: RepoInfo, projectNames: Record<string, string>): string {
  const mapped = projectNames[`${repo.name}(${repo.branch})`] ?? projectNames[`${repo.name}(*)`];
  const trimmed = mapped?.replace(TRAILING_CONNECTORS, "").trim();
  return trimmed ? trimmed : repo.name;
}

export function countCommitProjects(commits: CommitRecord[], projectNames: Record<string, string>): number {
  const projects = new Set<string>();
  for (const commit of commits) {
    const projectName = commit.projectName?.trim();
    const branchName = commit.branchName?.trim();
    if (!projectName || !branchName) continue;
    const exactKey = `${projectName}(${branchName})`;
    const mapped = projectNames[exactKey] ?? projectNames[`${projectName}(*)`] ?? exactKey;
    const displayName = mapped.replace(TRAILING_CONNECTORS, "").trim();
    projects.add(displayName || exactKey);
  }
  return projects.size;
}

export type MappingScope = "all" | "branch";

// 读取某仓库当前生效的映射：精确键 name(branch) 优先（范围=branch），否则通配键 name(*)（范围=all）。
// 都没有时返回空名称、默认范围 all，供弹窗作为初始值。
export function readRepoMapping(
  text: string,
  repo: RepoInfo,
): { scope: MappingScope; displayName: string } {
  const names = parseProjectNames(text);
  const branchKey = `${repo.name}(${repo.branch})`;
  const allKey = `${repo.name}(*)`;
  if (repo.branch && names[branchKey] !== undefined) {
    return { scope: "branch", displayName: names[branchKey] };
  }
  if (names[allKey] !== undefined) {
    return { scope: "all", displayName: names[allKey] };
  }
  return { scope: "all", displayName: "" };
}

// 写入/更新单个仓库的映射：先移除该仓库的两个候选键（name(*) 与 name(branch)）避免切换范围后残留孤儿键，
// 再按所选范围写入新值；名称为空表示清除映射。其他分支的精确键不受影响。
export function upsertRepoMapping(
  text: string,
  repo: RepoInfo,
  scope: MappingScope,
  displayName: string,
): string {
  const allKey = `${repo.name}(*)`;
  const branchKey = `${repo.name}(${repo.branch})`;
  const rows = parseMappingText(text).filter((row) => row.key !== allKey && row.key !== branchKey);
  const trimmed = displayName.trim();
  if (trimmed) {
    const key = scope === "branch" && repo.branch ? branchKey : allKey;
    rows.push({ key, displayName: trimmed });
  }
  return serializeMappingText(rows);
}

export function parseAuthorAliases(text: string): AuthorAliasGroup[] {
  return text.split(/\r?\n/).reduce<AuthorAliasGroup[]>((groups, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return groups;
    const separatorIndex = line.indexOf("->");
    if (separatorIndex < 0) return groups;
    const displayName = line.slice(0, separatorIndex).trim();
    const aliases = splitAuthorInput(line.slice(separatorIndex + 2));
    if (!displayName || aliases.length === 0) return groups;
    groups.push({ displayName, aliases });
    return groups;
  }, []);
}

export function parseEvidenceLinkRules(text: string): EvidenceLinkRule[] {
  const seen = new Set<string>();
  return text.split(/\r?\n/).reduce<EvidenceLinkRule[]>((rules, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) return rules;
    const separatorIndex = line.indexOf("->");
    if (separatorIndex < 0) return rules;
    const prefix = line.slice(0, separatorIndex).trim();
    const urlTemplate = line.slice(separatorIndex + 2).trim();
    const key = prefix.toLowerCase();
    if (!prefix || !urlTemplate || seen.has(key)) return rules;
    seen.add(key);
    rules.push({ prefix, urlTemplate });
    return rules;
  }, []);
}

export function parseRedactionRules(text: string): ReportRedactionRule[] {
  const seen = new Set<string>();
  return text.split(/\r?\n/).reduce<ReportRedactionRule[]>((rules, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return rules;
    const separatorIndex = line.indexOf("->");
    const find = separatorIndex < 0 ? trimmed : line.slice(0, separatorIndex).trim();
    const replacement = separatorIndex < 0 ? "***" : line.slice(separatorIndex + 2).trim() || "***";
    const key = find.toLowerCase();
    if (!find || seen.has(key)) return rules;
    seen.add(key);
    rules.push({ find, replacement });
    return rules;
  }, []);
}

export function buildAuthorFilter(author: string, groups: AuthorAliasGroup[]): string {
  const authors = splitAuthorInput(author);
  if (authors.length === 0) return "";
  const expanded = new Map<string, string>();
  for (const authorName of authors) {
    addAuthorToken(expanded, authorName);
    const group = findAuthorAliasGroup(authorName, groups);
    if (!group) continue;
    addAuthorToken(expanded, group.displayName);
    for (const alias of group.aliases) addAuthorToken(expanded, alias);
  }
  return [...expanded.values()].join(", ");
}

export function buildAuthorDisplayName(author: string, groups: AuthorAliasGroup[]): string {
  const authors = splitAuthorInput(author);
  if (authors.length === 0) return "";
  return authors
    .map((authorName) => findAuthorAliasGroup(authorName, groups)?.displayName ?? authorName)
    .filter((authorName, index, all) => all.findIndex((item) => item.toLowerCase() === authorName.toLowerCase()) === index)
    .join(", ");
}

function splitAuthorInput(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of value.split(/[\s,，]+/)) {
    const token = part.trim();
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(token);
  }
  return result;
}

function addAuthorToken(tokens: Map<string, string>, value: string) {
  const token = value.trim();
  if (!token) return;
  const key = token.toLowerCase();
  if (!tokens.has(key)) tokens.set(key, token);
}

function findAuthorAliasGroup(authorName: string, groups: AuthorAliasGroup[]) {
  const key = authorName.trim().toLowerCase();
  return groups.find((group) => (
    group.displayName.trim().toLowerCase() === key
    || group.aliases.some((alias) => alias.trim().toLowerCase() === key)
  ));
}

export function buildExtractOptions(
  settings: AppSettings,
  projectNames: Record<string, string>,
  dateRange: DateRange | undefined,
  aiEnabled: boolean,
  extraInstruction = "",
  indexedRepos: RepoInfo[] = [],
  reportKind: ExtractReportKind = "daily",
  supplementalItems: string[] = [],
) {
  const range = dateRange ?? getTodayRange();
  const authorAliasGroups = parseAuthorAliases(settings.authorAliasesText);
  const evidenceLinkRules = parseEvidenceLinkRules(settings.evidenceLinkPrefixesText);
  return {
    rootDirs: settings.rootDirs,
    indexedRepos,
    author: buildAuthorFilter(settings.author, authorAliasGroups),
    authorDisplayName: buildAuthorDisplayName(settings.author, authorAliasGroups),
    authorAliases: authorAliasGroups,
    startDate: range.startDate,
    endDate: range.endDate,
    periodLabel: reportKind === "custom" ? `${range.startDate} ~ ${range.endDate}` : range.startDate,
    reportKind,
    supplementalItems: validateSupplementalItems(supplementalItems),
    disabledRepos: settings.disabledRepos,
    extractAllBranches: settings.extractAllBranches,
    excludeMergeCommits: settings.excludeMergeCommits,
    excludeRevertCommits: settings.excludeRevertCommits,
    excludeBotCommits: settings.excludeBotCommits,
    detailedOutput: settings.detailedOutput,
    showProjectAndBranch: settings.showProjectAndBranch,
    commitItemPrefixMode: settings.commitItemPrefixMode,
    showEvidenceDetails: settings.showEvidenceDetails,
    evidenceLinkRules,
    redaction: buildReportRedactionOptions(settings),
    projectNames,
    reportFormatTemplates: buildReportFormatTemplates(settings),
    refinementInstruction: buildReportRefinementInstruction(settings, extraInstruction),
    systemPrompt: buildReportSystemPrompt(settings, "daily"),
    ai: buildAiOptions(settings, aiEnabled),
  };
}

export function buildMonthlyOptions(
  settings: AppSettings,
  projectNames: Record<string, string>,
  aiEnabled: boolean,
  extraInstruction = "",
  indexedRepos: RepoInfo[] = [],
  supplementalItems: string[] = [],
) {
  const authorAliasGroups = parseAuthorAliases(settings.authorAliasesText);
  const evidenceLinkRules = parseEvidenceLinkRules(settings.evidenceLinkPrefixesText);
  return {
    rootDirs: settings.rootDirs,
    indexedRepos,
    outputDir: settings.outputDir,
    outputEnabled: settings.outputEnabled,
    author: buildAuthorFilter(settings.author, authorAliasGroups),
    authorDisplayName: buildAuthorDisplayName(settings.author, authorAliasGroups),
    authorAliases: authorAliasGroups,
    supplementalItems: validateSupplementalItems(supplementalItems),
    extractAllBranches: settings.extractAllBranches,
    excludeMergeCommits: settings.excludeMergeCommits,
    excludeRevertCommits: settings.excludeRevertCommits,
    excludeBotCommits: settings.excludeBotCommits,
    disabledRepos: settings.disabledRepos,
    showEvidenceDetails: settings.showEvidenceDetails,
    commitItemPrefixMode: settings.commitItemPrefixMode,
    evidenceLinkRules,
    redaction: buildReportRedactionOptions(settings),
    projectNames,
    reportFormatTemplates: buildReportFormatTemplates(settings),
    refinementInstruction: buildReportRefinementInstruction(settings, extraInstruction),
    systemPrompt: buildReportSystemPrompt(settings, "monthly"),
    ai: buildAiOptions(settings, aiEnabled),
  };
}

export function buildPeriodReportOptions(
  settings: AppSettings,
  projectNames: Record<string, string>,
  kind: PeriodReportKind,
  range: DateRange,
  periodLabel: string,
  aiEnabled: boolean,
  extraInstruction = "",
  indexedRepos: RepoInfo[] = [],
  supplementalItems: string[] = [],
) {
  const authorAliasGroups = parseAuthorAliases(settings.authorAliasesText);
  const evidenceLinkRules = parseEvidenceLinkRules(settings.evidenceLinkPrefixesText);
  return {
    rootDirs: settings.rootDirs,
    indexedRepos,
    outputDir: settings.outputDir,
    outputEnabled: settings.outputEnabled,
    author: buildAuthorFilter(settings.author, authorAliasGroups),
    authorDisplayName: buildAuthorDisplayName(settings.author, authorAliasGroups),
    authorAliases: authorAliasGroups,
    startDate: range.startDate,
    endDate: range.endDate,
    periodLabel,
    reportKind: kind,
    supplementalItems: validateSupplementalItems(supplementalItems),
    extractAllBranches: settings.extractAllBranches,
    excludeMergeCommits: settings.excludeMergeCommits,
    excludeRevertCommits: settings.excludeRevertCommits,
    excludeBotCommits: settings.excludeBotCommits,
    disabledRepos: settings.disabledRepos,
    showEvidenceDetails: settings.showEvidenceDetails,
    commitItemPrefixMode: settings.commitItemPrefixMode,
    evidenceLinkRules,
    redaction: buildReportRedactionOptions(settings),
    projectNames,
    reportFormatTemplates: buildReportFormatTemplates(settings),
    refinementInstruction: buildReportRefinementInstruction(settings, extraInstruction),
    systemPrompt: buildReportSystemPrompt(settings, kind),
    ai: buildAiOptions(settings, aiEnabled),
  };
}

export function buildBatchReportOptions(
  settings: AppSettings,
  projectNames: Record<string, string>,
  rangeStart: string,
  rangeEnd: string,
  splitGranularity: SplitGranularity,
  groupMode: BatchGroupMode,
  exportFormats: ReportExportFormat[],
  fileNameTemplate: string,
  outputDir: string,
  indexedRepos: RepoInfo[] = [],
) {
  const authorAliasGroups = parseAuthorAliases(settings.authorAliasesText);
  const evidenceLinkRules = parseEvidenceLinkRules(settings.evidenceLinkPrefixesText);
  return {
    rootDirs: settings.rootDirs,
    indexedRepos,
    author: buildAuthorFilter(settings.author, authorAliasGroups),
    authorDisplayName: buildAuthorDisplayName(settings.author, authorAliasGroups),
    authorAliases: authorAliasGroups,
    disabledRepos: settings.disabledRepos,
    extractAllBranches: settings.extractAllBranches,
    excludeMergeCommits: settings.excludeMergeCommits,
    excludeRevertCommits: settings.excludeRevertCommits,
    excludeBotCommits: settings.excludeBotCommits,
    commitItemPrefixMode: settings.commitItemPrefixMode,
    showEvidenceDetails: settings.showEvidenceDetails,
    evidenceLinkRules,
    redaction: buildReportRedactionOptions(settings),
    projectNames,
    reportFormatTemplates: buildReportFormatTemplates(settings),
    rangeStart,
    rangeEnd,
    splitGranularity,
    groupMode,
    exportFormats: [...new Set(exportFormats)],
    fileNameTemplate: fileNameTemplate.trim(),
    outputDir,
  };
}

export function loadBlankDayTipDismissed(): boolean {
  try {
    return localStorage.getItem(BLANK_DAY_TIP_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveBlankDayTipDismissed(dismissed: boolean) {
  try {
    if (dismissed) localStorage.setItem(BLANK_DAY_TIP_DISMISSED_KEY, "1");
    else localStorage.removeItem(BLANK_DAY_TIP_DISMISSED_KEY);
  } catch {
    // ignore storage failures
  }
}

export function getBlankDaySourceRange(targetDate: string): DateRange {
  const end = shiftDateInput(targetDate, -1);
  const start = shiftDateInput(targetDate, -3);
  return { startDate: start, endDate: end };
}

export function shiftDateInput(dateValue: string, days: number) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!parts) return dateValue;
  const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
}

// 与 Rust report.rs 的 display_prefix / commit_item_prefix 保持一致：
// 映射名去掉末尾连接符后统一补 " - "；未配置映射时前缀为空。
export function resolveCommitMappedProjectName(
  commit: Pick<CommitRecord, "projectName" | "branchName">,
  projectNames: Record<string, string>,
): string {
  const projectName = commit.projectName?.trim() ?? "";
  const branchName = commit.branchName?.trim() ?? "";
  if (!projectName) return "";
  const exactKey = branchName ? `${projectName}(${branchName})` : "";
  const mapped =
    (exactKey ? projectNames[exactKey] : undefined)
    ?? projectNames[`${projectName}(*)`]
    ?? "";
  return mapped.replace(TRAILING_CONNECTORS, "").trim();
}

function displayCommitItemPrefix(displayName: string): string {
  const trimmed = displayName.replace(TRAILING_CONNECTORS, "").trim();
  return trimmed ? `${trimmed} - ` : "";
}

/** 复刻日报 {commitItems} 的项目前缀规则，供空白日补写等前端侧线索拼装使用。 */
export function buildCommitItemPrefix(
  mode: CommitItemPrefixMode,
  commit: Pick<CommitRecord, "projectName" | "branchName">,
  projectNames: Record<string, string>,
): string {
  const mapped = resolveCommitMappedProjectName(commit, projectNames);
  const repoBranch =
    commit.projectName && commit.branchName
      ? `${commit.projectName}(${commit.branchName})`
      : commit.projectName || "";
  switch (mode) {
    case "mapped-project":
      return displayCommitItemPrefix(mapped);
    case "repo-branch-and-mapped":
      return `${displayCommitItemPrefix(repoBranch)}${displayCommitItemPrefix(mapped)}`;
    case "repo-branch":
      return displayCommitItemPrefix(repoBranch);
    case "none":
      return "";
    default:
      return displayCommitItemPrefix(mapped);
  }
}

export function buildBlankDayEvidenceText(
  commits: CommitRecord[],
  selectedRepoPaths: string[],
  projectNames: Record<string, string> = {},
  prefixMode: CommitItemPrefixMode = "mapped-project",
) {
  const selected = new Set(selectedRepoPaths);
  const lines = commits
    .filter((commit) => selected.has(commit.repoPath))
    .slice(0, 80)
    .map((commit) => {
      const prefix = buildCommitItemPrefix(prefixMode, commit, projectNames);
      const message = commit.message.replace(/\s+/g, " ").trim();
      // 与日报一致：有映射时为「项目名 - 事项」；无映射时退回仓库(分支)线索，避免 AI 丢掉来源。
      const fallback =
        !prefix && commit.projectName
          ? `${commit.projectName}${commit.branchName ? `(${commit.branchName})` : ""}: `
          : "";
      return `- [${commit.date.slice(0, 10)}] ${prefix || fallback}${message}`;
    });
  return lines.join("\n");
}

export function collectBlankDayRepoTags(
  commits: CommitRecord[],
  projectNames: Record<string, string> = {},
) {
  const map = new Map<string, { path: string; label: string; count: number }>();
  for (const commit of commits) {
    const existing = map.get(commit.repoPath);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const pathParts = commit.repoPath.split(/[/\\]/).filter(Boolean);
    const mapped = resolveCommitMappedProjectName(commit, projectNames);
    const name = mapped || commit.projectName || pathParts[pathParts.length - 1] || commit.repoPath;
    const branch = !mapped && commit.branchName ? ` (${commit.branchName})` : "";
    map.set(commit.repoPath, {
      path: commit.repoPath,
      label: `${name}${branch}`,
      count: 1,
    });
  }
  return [...map.values()].sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
}

export function buildBlankDayFillOptions(
  settings: AppSettings,
  baseEvidence: string,
  targetDate: string,
  sourceRange: DateRange,
  itemCount: BlankDayItemCount,
  userPrompt: string,
) {
  const authorAliasGroups = parseAuthorAliases(settings.authorAliasesText);
  return {
    baseEvidence,
    targetDate,
    sourceStartDate: sourceRange.startDate,
    sourceEndDate: sourceRange.endDate,
    itemCount,
    author: buildAuthorFilter(settings.author, authorAliasGroups),
    authorDisplayName: buildAuthorDisplayName(settings.author, authorAliasGroups),
    userPrompt,
    ai: buildAiOptions(settings, true),
  };
}

export function buildReportEnhanceOptions(
  settings: AppSettings,
  mode: PreviewMode,
  range: DateRange,
  baseReport: string,
  extraInstruction = "",
  supplementalItems: string[] = [],
) {
  const authorAliasGroups = parseAuthorAliases(settings.authorAliasesText);
  const kind = mode === "summary" ? "daily" : mode;
  return {
    baseReport,
    startDate: range.startDate,
    endDate: range.endDate,
    reportKind: kind,
    author: buildAuthorFilter(settings.author, authorAliasGroups),
    authorDisplayName: buildAuthorDisplayName(settings.author, authorAliasGroups),
    refinementInstruction: buildReportRefinementInstruction(
      settings,
      mergeInstructions(
        extraInstruction,
        validateSupplementalItems(supplementalItems).length > 0
          ? SUPPLEMENTAL_FACT_PRESERVATION_INSTRUCTION
          : "",
      ),
    ),
    systemPrompt: buildReportSystemPrompt(settings, kind === "custom" ? "daily" : kind),
    ai: buildAiOptions(settings, true),
  };
}

export function validateRequiredSettings(settings: AppSettings) {
  validateExtractSettings(settings);
  validateOutputSettings(settings);
}

export function validateMonthlySettings(settings: AppSettings) {
  validateWorkspaceSettings(settings);
  validateOutputSettings(settings);
}

export function validatePeriodReportSettings(settings: AppSettings, range: DateRange) {
  validateWorkspaceSettings(settings);
  validateDateRange(range.startDate, range.endDate);
  validateOutputSettings(settings);
}

export function validateExtractSettings(settings: AppSettings, dateRange?: DateRange) {
  validateWorkspaceSettings(settings);
  const range = dateRange ?? getTodayRange();
  validateDateRange(range.startDate, range.endDate);
}

export function validateWorkspaceSettings(settings: AppSettings) {
  if (settings.rootDirs.filter((dir) => dir.trim()).length === 0) throw new Error("请选择至少一个仓库根目录");
}

export function validateOutputSettings(settings: AppSettings) {
  if (settings.outputEnabled && !settings.outputDir.trim()) throw new Error("已启用自动保存，请在设置中选择输出目录");
}

export function validateAiSettings(settings: AppSettings) {
  if (!settings.aiEnabled) return;
  validateAiConnectionSettings(settings);
}

export function validateAiConnectionSettings(settings: AppSettings) {
  if (!settings.aiModel.trim()) throw new Error("使用 AI 润色前请先在设置中填写模型名");
  if (settings.aiProvider === "codex-oauth") return;
  if (!settings.aiBaseUrl.trim()) throw new Error("使用 AI 润色前请先在设置中填写 Base URL");
  const aiApiKey = settings.aiApiKey.trim();
  if (!aiApiKey) throw new Error("使用 AI 润色前请先在设置中填写 API Key");
  validateAiKeyReference(aiApiKey);
}

export function validateDateRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) throw new Error("请选择完整的日期范围");
  if (startDate > endDate) throw new Error("开始日期不能晚于结束日期");
}

function buildAiOptions(settings: AppSettings, enabled = settings.aiEnabled) {
  return {
    enabled,
    provider: settings.aiProvider,
    baseUrl: settings.aiBaseUrl,
    model: settings.aiModel,
    apiKey: settings.aiApiKey.trim(),
    temperature: clampTemperature(settings.aiTemperature),
    timeoutSeconds: 60,
    proxy: buildProxyConfig(settings),
  };
}

export function buildProxyConfig(settings: AppSettings): ProxyConfig {
  return {
    mode: settings.proxyMode,
    url: settings.proxyUrl.trim(),
    username: settings.proxyUsername.trim(),
    password: settings.proxyPassword.trim(),
    passwordSaved: settings.proxyPasswordSaved,
  };
}

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

function buildReportRedactionOptions(settings: AppSettings): ReportRedactionOptions {
  return {
    enabled: settings.redactionEnabled,
    rules: parseRedactionRules(settings.redactionRulesText),
  };
}

function buildReportFormatTemplates(settings: AppSettings): ReportFormatTemplates {
  return {
    daily: settings.dailyReportFormatTemplate,
    weekly: settings.weeklyReportFormatTemplate,
    monthly: settings.monthlyReportFormatTemplate,
    custom: settings.customReportFormatTemplate,
  };
}

// AI 采样温度：超出 [0,1] 钳到边界，非数字回退默认 0.2（Anthropic 上限为 1，取并集安全区间）。
function clampTemperature(value: number): number {
  if (!Number.isFinite(value)) return 0.2;
  return Math.min(1, Math.max(0, value));
}

// 合并常驻润色指令与本次一次性额外要求，二者皆可为空。
function mergeInstructions(base: string, extra: string): string {
  return [base.trim(), extra.trim()].filter(Boolean).join("\n");
}

function buildReportSystemPrompt(settings: AppSettings, kind: "daily" | PeriodReportKind) {
  return (
    kind === "monthly"
      ? settings.monthlySystemPrompt
      : kind === "weekly"
        ? DEFAULT_WEEKLY_SYSTEM_PROMPT
        : settings.dailySystemPrompt
  );
}

function buildReportRefinementInstruction(settings: AppSettings, extraInstruction: string) {
  const evidenceInstruction = settings.showEvidenceDetails ? EVIDENCE_PRESERVATION_INSTRUCTION : "";
  const redactionInstruction = settings.redactionEnabled ? REDACTION_PRESERVATION_INSTRUCTION : "";
  const purposeInstruction = purposeRefinementInstruction(settings.reportPurposePreset);
  return mergeInstructions(
    mergeInstructions(
      mergeInstructions(
        mergeInstructions(
          mergeInstructions(purposeInstruction, settings.refinementInstruction),
          TEMPLATE_PRESERVATION_INSTRUCTION,
        ),
        redactionInstruction,
      ),
      evidenceInstruction,
    ),
    extraInstruction,
  );
}

export function getTodayRange(): DateRange {
  const today = getToday();
  return { startDate: today, endDate: today };
}

export function getSingleDayRange(date: string): DateRange {
  return { startDate: date, endDate: date };
}

export function getCurrentWeekRange(): DateRange {
  const today = new Date();
  return getWeekRange(getWeekLabel(today));
}

export function getWeekLabel(date = new Date()) {
  const { year, week } = getIsoWeekParts(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function getWeekRange(weekValue: string): DateRange {
  const { year, week } = parseWeekInput(weekValue);
  const januaryFourth = new Date(year, 0, 4);
  const januaryFourthDay = januaryFourth.getDay() || 7;
  const weekOneMonday = addDays(januaryFourth, 1 - januaryFourthDay);
  const start = addDays(weekOneMonday, (week - 1) * 7);
  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(addDays(start, 6)),
  };
}

export function getPreviousMonthInput(date = new Date()) {
  return formatMonthInput(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

export function getMonthRange(monthValue: string): DateRange {
  const parts = parseMonthInput(monthValue);
  const start = new Date(parts.year, parts.month - 1, 1);
  const end = new Date(parts.year, parts.month, 0);
  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(end),
  };
}

export function formatMonthLabel(monthValue: string) {
  const parts = parseMonthInput(monthValue);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

export function isValidMonthInput(monthValue: string) {
  try {
    parseMonthInput(monthValue);
    return true;
  } catch {
    return false;
  }
}

export function getToday() {
  return formatDateInput(new Date());
}

function looksLikeEnvVarName(value: string) {
  return ENV_VAR_NAME_PATTERN.test(value);
}

export function isAiKeyReference(value: string) {
  return looksLikeEnvVarName(value) || value.startsWith("env:");
}

function validateAiKeyReference(value: string) {
  if (!value.startsWith("env:")) return;
  const name = value.slice(4).trim();
  if (!name) {
    throw new Error("API Key 环境变量引用缺少变量名，请填写 env:OPENAI_API_KEY 这类格式");
  }
  if (!looksLikeEnvVarName(name)) {
    throw new Error("API Key 环境变量名格式不正确，请使用 env:OPENAI_API_KEY 这类格式");
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRepoInfo(value: unknown): value is RepoInfo {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const repo = value as Partial<RepoInfo>;
  return isNonEmptyString(repo.path) && isNonEmptyString(repo.name) && typeof repo.branch === "string";
}

function isReportHistoryEntry(value: unknown): value is ReportHistoryEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Partial<ReportHistoryEntry>;
  return (
    isNonEmptyString(entry.id)
    && isPreviewMode(entry.mode)
    && isNonEmptyString(entry.title)
    && isDateRange(entry.range)
    && typeof entry.periodLabel === "string"
    && isNonEmptyString(entry.generatedAt)
    && Number.isFinite(entry.repoCount)
    && Number.isFinite(entry.commitCount)
    && typeof entry.aiEnhanced === "boolean"
    && typeof entry.outputFile === "string"
    && typeof entry.reportText === "string"
    && isSupplementalItemsValue(entry.supplementalItems)
    && isReportHistoryProjectsValue(entry.projects)
  );
}

function isReportHistoryProjectsValue(value: unknown): value is ReportHistoryProject[] | undefined {
  if (value === undefined) return true;
  return Array.isArray(value) && value.every(isReportHistoryProject);
}

function isReportHistoryProject(value: unknown): value is ReportHistoryProject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const project = value as Partial<ReportHistoryProject>;
  return (
    isNonEmptyString(project.name)
    && Number.isInteger(project.commitCount)
    && (project.commitCount ?? -1) >= 0
    && Array.isArray(project.evidenceIds)
    && project.evidenceIds.length <= 20
    && project.evidenceIds.every(isNonEmptyString)
  );
}

function isPreviewMode(value: unknown): value is PreviewMode {
  return value === "summary" || value === "weekly" || value === "custom" || value === "monthly";
}

function isDateRange(value: unknown): value is DateRange {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const range = value as Partial<DateRange>;
  return typeof range.startDate === "string" && typeof range.endDate === "string";
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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthInput(monthValue: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthValue);
  if (!match) throw new Error("请选择有效的报告月份");
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error("请选择有效的报告月份");
  return { year, month };
}

function parseWeekInput(weekValue: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekValue);
  if (!match) throw new Error("请选择有效的报告周");
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) throw new Error("请选择有效的报告周");
  return { year, week };
}

function getIsoWeekParts(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: target.getUTCFullYear(), week };
}
