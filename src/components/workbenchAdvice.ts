import type { DateRange, PreviewMode } from "../model";
import { formatActiveRange, formatAuthorScope, getHistoryKindLabel } from "./WorkbenchControls";

export function buildEmptyReportAdvice({
  activePreview,
  dailyDate,
  weeklyRange,
  monthlyRange,
  customRange,
  author,
  enabledRepoCount,
}: {
  activePreview: PreviewMode;
  dailyDate: string;
  weeklyRange: DateRange;
  monthlyRange: DateRange;
  customRange: DateRange;
  author: string;
  enabledRepoCount: number;
}) {
  return {
    title: "本次报告没有匹配到提交",
    scope: `${getHistoryKindLabel(activePreview)} · ${formatActiveRange(activePreview, dailyDate, weeklyRange, monthlyRange, customRange)} · ${formatAuthorScope(author)} · ${enabledRepoCount} 个启用仓库`,
    checks: [
      "确认周期覆盖了真实提交时间，尤其是周报/月报跨月边界。",
      "若已填写作者，请核对 Git name/email；留空会按全部作者提取。",
      "如果提交在其他分支，请在设置中开启全部分支提取。",
      "刚添加或移动仓库后，请重新扫描仓库索引。",
    ],
  };
}
