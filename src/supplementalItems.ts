import type { DateRange, PreviewMode } from "./model";

export const MAX_SUPPLEMENTAL_ITEMS = 20;
export const MAX_SUPPLEMENTAL_ITEM_CHARS = 200;
export const SUPPLEMENTAL_FACT_PRESERVATION_INSTRUCTION =
  "报告中的「用户补充事项（非 Git）」是用户明确提供的事实。请保留其事实语义，不要据此推导未提供的上线结论、验收结果、精确百分比或业务指标。";

export function parseSupplementalItems(text: string): string[] {
  return validateSupplementalItems(text.split(/\r?\n/));
}

export function validateSupplementalItems(items: readonly string[]): string[] {
  const normalized = items.map((item) => item.trim()).filter(Boolean);
  if (normalized.length > MAX_SUPPLEMENTAL_ITEMS) {
    throw new Error(`补充事项最多填写 ${MAX_SUPPLEMENTAL_ITEMS} 项`);
  }
  const oversizedIndex = normalized.findIndex((item) => [...item].length > MAX_SUPPLEMENTAL_ITEM_CHARS);
  if (oversizedIndex >= 0) {
    throw new Error(`第 ${oversizedIndex + 1} 条补充事项不能超过 ${MAX_SUPPLEMENTAL_ITEM_CHARS} 个字符`);
  }
  return normalized;
}

export function supplementalItemsIssue(text: string): string {
  try {
    parseSupplementalItems(text);
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function supplementalItemsFromHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const strings = value.filter((item): item is string => typeof item === "string");
  return strings
    .map((item) => [...item.trim()].slice(0, MAX_SUPPLEMENTAL_ITEM_CHARS).join(""))
    .filter(Boolean)
    .slice(0, MAX_SUPPLEMENTAL_ITEMS);
}

export function isSupplementalItemsValue(value: unknown) {
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

export function formatSupplementalItemsText(items: readonly string[]) {
  return items.join("\n");
}

export function buildSupplementalDraftKey(mode: PreviewMode, range: DateRange) {
  return `${mode}:${range.startDate}:${range.endDate}`;
}
