import {
  mergeMappingEntries,
  parseMappingText,
  type AppSettings,
} from "./model";

export const CONFIG_PROFILE_SCHEMA_VERSION = 1 as const;
export const CONFIG_PROFILE_MAX_BYTES = 2 * 1024 * 1024;

export const CONFIG_PROFILE_SETTING_KEYS = [
  "projectNamesText",
  "authorAliasesText",
  "evidenceLinkPrefixesText",
  "commitItemPrefixMode",
  "showEvidenceDetails",
  "reportPurposePreset",
  "reportTemplateProfile",
  "dailyReportFormatTemplate",
  "weeklyReportFormatTemplate",
  "monthlyReportFormatTemplate",
  "customReportFormatTemplate",
  "dailySystemPrompt",
  "monthlySystemPrompt",
] as const satisfies readonly (keyof AppSettings)[];

export type ConfigProfileSettings = Pick<
  AppSettings,
  (typeof CONFIG_PROFILE_SETTING_KEYS)[number]
>;

export type ConfigProfile = {
  schemaVersion: typeof CONFIG_PROFILE_SCHEMA_VERSION;
  exportedAt: string;
  settings: ConfigProfileSettings;
};

export type ConfigProfileImportStrategy = "merge" | "replace";

export type ConfigProfileSummary = {
  mappings: number;
  authorAliases: number;
  evidenceRules: number;
  reportTemplates: number;
  promptTemplates: number;
};

const ROOT_KEYS = ["schemaVersion", "exportedAt", "settings"] as const;
const COMMIT_PREFIX_MODES: readonly AppSettings["commitItemPrefixMode"][] = [
  "mapped-project",
  "repo-branch-and-mapped",
  "repo-branch",
  "none",
];
const REPORT_PURPOSE_PRESETS: readonly AppSettings["reportPurposePreset"][] = [
  "custom",
  "daily-sync",
  "weekly-briefing",
  "performance",
  "project-review",
];
const REPORT_TEMPLATE_PROFILES: readonly AppSettings["reportTemplateProfile"][] = [
  "standard",
  "concise",
  "grouped",
  "evidence",
  "custom",
];

export function createConfigProfile(
  settings: AppSettings,
  exportedAt = new Date().toISOString(),
): ConfigProfile {
  const profile: ConfigProfile = {
    schemaVersion: CONFIG_PROFILE_SCHEMA_VERSION,
    exportedAt,
    settings: {
      projectNamesText: settings.projectNamesText,
      authorAliasesText: settings.authorAliasesText,
      evidenceLinkPrefixesText: settings.evidenceLinkPrefixesText,
      commitItemPrefixMode: settings.commitItemPrefixMode,
      showEvidenceDetails: settings.showEvidenceDetails,
      reportPurposePreset: settings.reportPurposePreset,
      reportTemplateProfile: settings.reportTemplateProfile,
      dailyReportFormatTemplate: settings.dailyReportFormatTemplate,
      weeklyReportFormatTemplate: settings.weeklyReportFormatTemplate,
      monthlyReportFormatTemplate: settings.monthlyReportFormatTemplate,
      customReportFormatTemplate: settings.customReportFormatTemplate,
      dailySystemPrompt: settings.dailySystemPrompt,
      monthlySystemPrompt: settings.monthlySystemPrompt,
    },
  };
  validateConfigProfile(profile);
  return profile;
}

export function serializeConfigProfile(settings: AppSettings, exportedAt?: string) {
  return `${JSON.stringify(createConfigProfile(settings, exportedAt), null, 2)}\n`;
}

export function parseConfigProfile(content: string): ConfigProfile {
  if (new TextEncoder().encode(content).byteLength > CONFIG_PROFILE_MAX_BYTES) {
    throw new Error("配置方案不能超过 2 MiB");
  }
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error("配置方案不是有效的 JSON 文件");
  }
  return validateConfigProfile(value);
}

export function summarizeConfigProfile(profile: ConfigProfile): ConfigProfileSummary {
  return {
    mappings: parseArrowRules(profile.settings.projectNamesText, "项目映射").length,
    authorAliases: parseArrowRules(profile.settings.authorAliasesText, "作者别名").length,
    evidenceRules: parseArrowRules(profile.settings.evidenceLinkPrefixesText, "证据链接").length,
    reportTemplates: countNonEmpty([
      profile.settings.dailyReportFormatTemplate,
      profile.settings.weeklyReportFormatTemplate,
      profile.settings.monthlyReportFormatTemplate,
      profile.settings.customReportFormatTemplate,
    ]),
    promptTemplates: countNonEmpty([
      profile.settings.dailySystemPrompt,
      profile.settings.monthlySystemPrompt,
    ]),
  };
}

export function applyConfigProfile(
  current: AppSettings,
  profile: ConfigProfile,
  strategy: ConfigProfileImportStrategy,
): ConfigProfileSettings {
  const imported = profile.settings;
  if (strategy === "replace") return copyProfileSettings(imported);
  return {
    ...copyProfileSettings(imported),
    projectNamesText: mergeMappingEntries(
      current.projectNamesText,
      parseMappingText(imported.projectNamesText),
    ),
    authorAliasesText: mergeArrowRuleText(
      current.authorAliasesText,
      imported.authorAliasesText,
      "作者别名",
    ),
    evidenceLinkPrefixesText: mergeArrowRuleText(
      current.evidenceLinkPrefixesText,
      imported.evidenceLinkPrefixesText,
      "证据链接",
    ),
  };
}

function validateConfigProfile(value: unknown): ConfigProfile {
  const root = requireRecord(value, "配置方案");
  assertExactKeys(root, ROOT_KEYS, "配置方案");
  if (root.schemaVersion !== CONFIG_PROFILE_SCHEMA_VERSION) {
    throw new Error(`不支持的配置方案版本：${String(root.schemaVersion)}`);
  }
  const exportedAt = requireString(root.exportedAt, "exportedAt");
  if (Number.isNaN(Date.parse(exportedAt))) throw new Error("配置方案的 exportedAt 无效");
  const settings = validateSettings(root.settings);
  return { schemaVersion: CONFIG_PROFILE_SCHEMA_VERSION, exportedAt, settings };
}

function validateSettings(value: unknown): ConfigProfileSettings {
  const settings = requireRecord(value, "settings");
  assertExactKeys(settings, CONFIG_PROFILE_SETTING_KEYS, "settings");
  const result: ConfigProfileSettings = {
    projectNamesText: requireRuleText(settings.projectNamesText, "项目映射"),
    authorAliasesText: requireRuleText(settings.authorAliasesText, "作者别名"),
    evidenceLinkPrefixesText: requireRuleText(settings.evidenceLinkPrefixesText, "证据链接"),
    commitItemPrefixMode: requireEnum(settings.commitItemPrefixMode, COMMIT_PREFIX_MODES, "commitItemPrefixMode"),
    showEvidenceDetails: requireBoolean(settings.showEvidenceDetails, "showEvidenceDetails"),
    reportPurposePreset: requireEnum(settings.reportPurposePreset, REPORT_PURPOSE_PRESETS, "reportPurposePreset"),
    reportTemplateProfile: requireEnum(settings.reportTemplateProfile, REPORT_TEMPLATE_PROFILES, "reportTemplateProfile"),
    dailyReportFormatTemplate: requireString(settings.dailyReportFormatTemplate, "dailyReportFormatTemplate"),
    weeklyReportFormatTemplate: requireString(settings.weeklyReportFormatTemplate, "weeklyReportFormatTemplate"),
    monthlyReportFormatTemplate: requireString(settings.monthlyReportFormatTemplate, "monthlyReportFormatTemplate"),
    customReportFormatTemplate: requireString(settings.customReportFormatTemplate, "customReportFormatTemplate"),
    dailySystemPrompt: requireString(settings.dailySystemPrompt, "dailySystemPrompt"),
    monthlySystemPrompt: requireString(settings.monthlySystemPrompt, "monthlySystemPrompt"),
  };
  return result;
}

function copyProfileSettings(settings: ConfigProfileSettings): ConfigProfileSettings {
  return {
    projectNamesText: settings.projectNamesText,
    authorAliasesText: settings.authorAliasesText,
    evidenceLinkPrefixesText: settings.evidenceLinkPrefixesText,
    commitItemPrefixMode: settings.commitItemPrefixMode,
    showEvidenceDetails: settings.showEvidenceDetails,
    reportPurposePreset: settings.reportPurposePreset,
    reportTemplateProfile: settings.reportTemplateProfile,
    dailyReportFormatTemplate: settings.dailyReportFormatTemplate,
    weeklyReportFormatTemplate: settings.weeklyReportFormatTemplate,
    monthlyReportFormatTemplate: settings.monthlyReportFormatTemplate,
    customReportFormatTemplate: settings.customReportFormatTemplate,
    dailySystemPrompt: settings.dailySystemPrompt,
    monthlySystemPrompt: settings.monthlySystemPrompt,
  };
}

function mergeArrowRuleText(current: string, imported: string, label: string) {
  const merged = new Map<string, { key: string; value: string }>();
  for (const rule of parseArrowRules(current, label, false)) {
    merged.set(rule.key.toLowerCase(), rule);
  }
  for (const rule of parseArrowRules(imported, label)) {
    merged.set(rule.key.toLowerCase(), rule);
  }
  return [...merged.values()].map((rule) => `${rule.key} -> ${rule.value}`).join("\n");
}

function requireRuleText(value: unknown, label: string) {
  const text = requireString(value, label);
  parseArrowRules(text, label);
  return text.replace(/\r\n?/g, "\n").trim();
}

function parseArrowRules(text: string, label: string, strict = true) {
  const rules: Array<{ key: string; value: string }> = [];
  for (const [index, line] of text.replace(/\r\n?/g, "\n").split("\n").entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
    const separator = line.indexOf("->");
    const key = separator < 0 ? "" : line.slice(0, separator).trim();
    const ruleValue = separator < 0 ? "" : line.slice(separator + 2).trim();
    if (!key || !ruleValue) {
      if (!strict) continue;
      throw new Error(`${label}第 ${index + 1} 行应为“名称 -> 值”`);
    }
    rules.push({ key, value: ruleValue });
  }
  return rules;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}必须是对象`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
) {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknownKeys.length > 0) throw new Error(`${label}包含未知字段：${unknownKeys.join("、")}`);
  const missingKeys = allowedKeys.filter((key) => !(key in value));
  if (missingKeys.length > 0) throw new Error(`${label}缺少字段：${missingKeys.join("、")}`);
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string") throw new Error(`${field}必须是字符串`);
  return value;
}

function requireBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") throw new Error(`${field}必须是布尔值`);
  return value;
}

function requireEnum<T extends string>(value: unknown, options: readonly T[], field: string): T {
  if (typeof value !== "string" || !options.includes(value as T)) {
    throw new Error(`${field}的值不受支持`);
  }
  return value as T;
}

function countNonEmpty(values: string[]) {
  return values.filter((value) => value.trim()).length;
}
