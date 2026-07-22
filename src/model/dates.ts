import type { DateRange } from "./types";

export function getTodayRange(): DateRange {
  const today = getToday();
  return { startDate: today, endDate: today };
}

export function getSingleDayRange(date: string): DateRange {
  return { startDate: date, endDate: date };
}

export function getCurrentWeekRange(): DateRange {
  return getWeekRange(getWeekLabel(new Date()));
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
  return { startDate: formatDateInput(start), endDate: formatDateInput(addDays(start, 6)) };
}

/** Safe range for render paths: never throws on partial/invalid week input. */
export function getWeekRangeOrFallback(weekValue: string, fallback = getWeekLabel()): DateRange {
  return isValidWeekInput(weekValue) ? getWeekRange(weekValue) : getWeekRange(fallback);
}

export function getPreviousMonthInput(date = new Date()) {
  return formatMonthInput(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

export function getMonthRange(monthValue: string): DateRange {
  const parts = parseMonthInput(monthValue);
  const start = new Date(parts.year, parts.month - 1, 1);
  const end = new Date(parts.year, parts.month, 0);
  return { startDate: formatDateInput(start), endDate: formatDateInput(end) };
}

/** Safe range for render paths: never throws on partial/invalid month input. */
export function getMonthRangeOrFallback(monthValue: string, fallback = getPreviousMonthInput()): DateRange {
  return isValidMonthInput(monthValue) ? getMonthRange(monthValue) : getMonthRange(fallback);
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

export function isValidWeekInput(weekValue: string) {
  try {
    parseWeekInput(weekValue);
    return true;
  } catch {
    return false;
  }
}

export function getToday() {
  return formatDateInput(new Date());
}

export function getBlankDaySourceRange(targetDate: string): DateRange {
  return { startDate: shiftDateInput(targetDate, -3), endDate: shiftDateInput(targetDate, -1) };
}

export function shiftDateInput(dateValue: string, days: number) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!parts) return dateValue;
  const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
