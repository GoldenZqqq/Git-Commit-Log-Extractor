import {
  getReportCalendarAnchorDate,
  type ReportHistoryEntry,
  type ReportHistoryProject,
} from "./model";

export const UNCLASSIFIED_PROJECT_NAME = "未归类历史";

export type ProjectRetrospectiveRange = "30" | "90" | "180" | "all";

export type ProjectRetrospectiveItem = {
  entry: ReportHistoryEntry;
  project: ReportHistoryProject;
  anchorDate: string;
};

export type ProjectRetrospectiveSummary = {
  reportCount: number;
  commitCount: number;
  exportedCount: number;
  evidenceCount: number;
};

export type ProjectRetrospectiveResult = {
  items: ProjectRetrospectiveItem[];
  summary: ProjectRetrospectiveSummary;
};

type ProjectRecency = {
  name: string;
  latestDate: string;
};

export function listRetrospectiveProjects(entries: ReportHistoryEntry[]): string[] {
  const projects = new Map<string, ProjectRecency>();
  for (const entry of entries) {
    const anchorDate = getReportCalendarAnchorDate(entry);
    for (const project of projectsForEntry(entry)) {
      const current = projects.get(project.name);
      if (!current || anchorDate > current.latestDate) {
        projects.set(project.name, { name: project.name, latestDate: anchorDate });
      }
    }
  }
  return [...projects.values()]
    .sort((left, right) => right.latestDate.localeCompare(left.latestDate)
      || left.name.localeCompare(right.name, "zh-CN"))
    .map((project) => project.name);
}

export function deriveProjectRetrospective(
  entries: ReportHistoryEntry[],
  projectName: string,
  range: ProjectRetrospectiveRange,
  today = new Date(),
): ProjectRetrospectiveResult {
  const items = entries
    .flatMap((entry) => itemsForEntry(entry, projectName))
    .filter((item) => dateIsInRange(item.anchorDate, range, today))
    .sort(compareItems);
  const evidence = new Set<string>();
  let commitCount = 0;
  let exportedCount = 0;
  for (const item of items) {
    commitCount += item.project.commitCount;
    if (item.entry.outputFile.trim()) exportedCount += 1;
    item.project.evidenceIds.forEach((id) => evidence.add(id));
  }
  return {
    items,
    summary: {
      reportCount: items.length,
      commitCount,
      exportedCount,
      evidenceCount: evidence.size,
    },
  };
}

function itemsForEntry(entry: ReportHistoryEntry, projectName: string): ProjectRetrospectiveItem[] {
  const anchorDate = getReportCalendarAnchorDate(entry);
  return projectsForEntry(entry)
    .filter((project) => project.name === projectName)
    .map((project) => ({ entry, project, anchorDate }));
}

function projectsForEntry(entry: ReportHistoryEntry): ReportHistoryProject[] {
  if (entry.projects === undefined) {
    return [{ name: UNCLASSIFIED_PROJECT_NAME, commitCount: entry.commitCount, evidenceIds: [] }];
  }
  const projects = new Map<string, ReportHistoryProject>();
  for (const rawProject of entry.projects) {
    const name = rawProject.name.trim();
    if (!name) continue;
    const current = projects.get(name) ?? { name, commitCount: 0, evidenceIds: [] };
    current.commitCount += rawProject.commitCount;
    current.evidenceIds = uniqueStrings([...current.evidenceIds, ...rawProject.evidenceIds]).slice(0, 20);
    projects.set(name, current);
  }
  return [...projects.values()];
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const normalizedValues: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    normalizedValues.push(normalized);
  }
  return normalizedValues;
}

function dateIsInRange(anchorDate: string, range: ProjectRetrospectiveRange, today: Date): boolean {
  if (range === "all") return true;
  const anchor = parseDate(anchorDate);
  if (anchor === null) return false;
  const end = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const start = end - (Number(range) - 1) * 86_400_000;
  return anchor >= start && anchor <= end;
}

function parseDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = Date.UTC(year, month - 1, day);
  return new Date(parsed).toISOString().slice(0, 10) === value ? parsed : null;
}

function compareItems(left: ProjectRetrospectiveItem, right: ProjectRetrospectiveItem): number {
  return right.anchorDate.localeCompare(left.anchorDate)
    || right.entry.generatedAt.localeCompare(left.entry.generatedAt)
    || right.entry.id.localeCompare(left.entry.id);
}
