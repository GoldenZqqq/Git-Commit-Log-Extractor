export type ReportDiffKind = "unchanged" | "added" | "removed";
export type ReportDiffStrategy = "lcs" | "bounded-fallback";

export type ReportDiffLine = {
  kind: ReportDiffKind;
  text: string;
  oldLine?: number;
  newLine?: number;
};

export type ReportDiffResult = {
  lines: ReportDiffLine[];
  strategy: ReportDiffStrategy;
  added: number;
  removed: number;
  unchanged: number;
};

export type PolishFactRisk = {
  kind: "metric" | "conclusion" | "evidence";
  label: string;
  detail: string;
  line: string;
};

type DiffIndexes = {
  oldIndex?: number;
  newIndex?: number;
};

const MAX_LCS_CELLS = 200_000;
const METRIC_PATTERN = /\d+(?:\.\d+)?\s*(?:%|％|倍|万元|元|个用户|名用户|小时|分钟|天|毫秒|ms)/gi;
const STRONG_CONCLUSIONS = ["验收通过", "正式上线", "零故障", "无异常", "显著提升", "显著降低", "业务增长", "用户增长", "收益增长"];
const EVIDENCE_PATTERN = /来源：|commit|用户补充事项（非 Git）/i;

export function buildReportDiff(originalText: string, polishedText: string): ReportDiffResult {
  const original = splitLines(originalText);
  const polished = splitLines(polishedText);
  const strategy = original.length * polished.length <= MAX_LCS_CELLS
    ? "lcs"
    : "bounded-fallback";
  const lines = strategy === "lcs"
    ? buildLcsDiff(original, polished)
    : buildBoundedDiff(original, polished);
  return summarizeDiff(lines, strategy);
}

export function detectPolishFactRisks(originalText: string, lines: readonly ReportDiffLine[]) {
  const risks: PolishFactRisk[] = [];
  for (const line of lines) {
    if (line.kind === "added") {
      addMetricRisk(originalText, line.text, risks);
      addConclusionRisk(originalText, line.text, risks);
    } else if (line.kind === "removed" && EVIDENCE_PATTERN.test(line.text)) {
      risks.push({ kind: "evidence", label: "删除证据行", detail: "润色稿删除了可追溯证据或用户事实标记。", line: line.text });
    }
    if (risks.length >= 8) break;
  }
  return dedupeRisks(risks).slice(0, 8);
}

function splitLines(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function buildLcsDiff(original: string[], polished: string[]) {
  const matrix = buildLcsMatrix(original, polished);
  const lines: ReportDiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < original.length && newIndex < polished.length) {
    if (original[oldIndex] === polished[newIndex]) {
      lines.push(diffLine("unchanged", original[oldIndex], { oldIndex, newIndex }));
      oldIndex += 1;
      newIndex += 1;
    } else if (matrix[oldIndex + 1][newIndex] >= matrix[oldIndex][newIndex + 1]) {
      lines.push(diffLine("removed", original[oldIndex], { oldIndex }));
      oldIndex += 1;
    } else {
      lines.push(diffLine("added", polished[newIndex], { newIndex }));
      newIndex += 1;
    }
  }
  appendRemainder({ lines, original, polished, oldIndex, newIndex });
  return lines;
}

function buildLcsMatrix(original: string[], polished: string[]) {
  const matrix = Array.from({ length: original.length + 1 }, () => new Uint16Array(polished.length + 1));
  for (let oldIndex = original.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = polished.length - 1; newIndex >= 0; newIndex -= 1) {
      matrix[oldIndex][newIndex] = original[oldIndex] === polished[newIndex]
        ? matrix[oldIndex + 1][newIndex + 1] + 1
        : Math.max(matrix[oldIndex + 1][newIndex], matrix[oldIndex][newIndex + 1]);
    }
  }
  return matrix;
}

function appendRemainder({
  lines,
  original,
  polished,
  oldIndex,
  newIndex,
}: {
  lines: ReportDiffLine[];
  original: string[];
  polished: string[];
  oldIndex: number;
  newIndex: number;
}) {
  for (let index = oldIndex; index < original.length; index += 1) {
    lines.push(diffLine("removed", original[index], { oldIndex: index }));
  }
  for (let index = newIndex; index < polished.length; index += 1) {
    lines.push(diffLine("added", polished[index], { newIndex: index }));
  }
}

function buildBoundedDiff(original: string[], polished: string[]) {
  let prefix = 0;
  while (prefix < original.length && prefix < polished.length && original[prefix] === polished[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < original.length - prefix
    && suffix < polished.length - prefix
    && original[original.length - suffix - 1] === polished[polished.length - suffix - 1]
  ) suffix += 1;
  const lines: ReportDiffLine[] = [];
  for (let index = 0; index < prefix; index += 1) {
    lines.push(diffLine("unchanged", original[index], { oldIndex: index, newIndex: index }));
  }
  for (let index = prefix; index < original.length - suffix; index += 1) {
    lines.push(diffLine("removed", original[index], { oldIndex: index }));
  }
  for (let index = prefix; index < polished.length - suffix; index += 1) {
    lines.push(diffLine("added", polished[index], { newIndex: index }));
  }
  for (let offset = suffix; offset > 0; offset -= 1) {
    const oldIndex = original.length - offset;
    const newIndex = polished.length - offset;
    lines.push(diffLine("unchanged", original[oldIndex], { oldIndex, newIndex }));
  }
  return lines;
}

function diffLine(kind: ReportDiffKind, text: string, indexes: DiffIndexes): ReportDiffLine {
  const { oldIndex, newIndex } = indexes;
  return {
    kind,
    text,
    oldLine: oldIndex === undefined ? undefined : oldIndex + 1,
    newLine: newIndex === undefined ? undefined : newIndex + 1,
  };
}

function summarizeDiff(lines: ReportDiffLine[], strategy: ReportDiffStrategy): ReportDiffResult {
  return {
    lines,
    strategy,
    added: lines.filter((line) => line.kind === "added").length,
    removed: lines.filter((line) => line.kind === "removed").length,
    unchanged: lines.filter((line) => line.kind === "unchanged").length,
  };
}

function addMetricRisk(originalText: string, line: string, risks: PolishFactRisk[]) {
  const metrics = line.match(METRIC_PATTERN) ?? [];
  const newMetrics = metrics.filter((metric) => !originalText.includes(metric));
  if (newMetrics.length === 0) return;
  risks.push({ kind: "metric", label: "新增量化指标", detail: `原稿中未找到：${newMetrics.join("、")}`, line });
}

function addConclusionRisk(originalText: string, line: string, risks: PolishFactRisk[]) {
  const conclusions = STRONG_CONCLUSIONS.filter((phrase) => line.includes(phrase) && !originalText.includes(phrase));
  if (conclusions.length === 0) return;
  risks.push({ kind: "conclusion", label: "新增强结论", detail: `请核对结论依据：${conclusions.join("、")}`, line });
}

function dedupeRisks(risks: PolishFactRisk[]) {
  const seen = new Set<string>();
  return risks.filter((risk) => {
    const key = `${risk.kind}:${risk.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
