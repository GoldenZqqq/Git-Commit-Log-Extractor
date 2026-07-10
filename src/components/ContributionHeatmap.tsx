import { Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import "./ContributionHeatmap.css";

type HeatmapEntry = {
  date: string;
  count: number;
};

export type HeatmapResult = {
  entries: HeatmapEntry[];
  totalCommits: number;
  activeDays: number;
  maxStreak: number;
  busiestDay: string;
  busiestCount: number;
};

type Props = {
  data: HeatmapResult | null;
  loading: boolean;
  fullWidth?: boolean;
};

const CELL_SIZE = 11;
const CELL_SIZE_FULL = 13;
const GAP = 3;
const STEP = CELL_SIZE + GAP;
const STEP_FULL = CELL_SIZE_FULL + GAP;
const WEEKDAY_LABEL_WIDTH = 28;
const MONTH_LABEL_HEIGHT = 16;
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_NAMES_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function getLevel(count: number, maxCount: number): number {
  if (count === 0) return 0;
  if (maxCount <= 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function buildWeekColumns(entries: HeatmapEntry[]): { col: number; row: number; entry: HeatmapEntry }[] {
  if (entries.length === 0) return [];
  const firstDate = new Date(entries[0].date + "T00:00:00");
  const startDow = firstDate.getDay();
  const cells: { col: number; row: number; entry: HeatmapEntry }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const dayIndex = startDow + i;
    const col = Math.floor(dayIndex / 7);
    const row = dayIndex % 7;
    cells.push({ col, row, entry: entries[i] });
  }
  return cells;
}

function buildMonthLabels(cells: { col: number; row: number; entry: HeatmapEntry }[]): { col: number; label: string }[] {
  const labels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (const cell of cells) {
    const date = new Date(cell.entry.date + "T00:00:00");
    const month = date.getMonth();
    if (month !== lastMonth) {
      lastMonth = month;
      if (cell.row <= 1) {
        labels.push({ col: cell.col, label: MONTH_NAMES[month] });
      }
    }
  }
  return labels;
}

export function ContributionHeatmap({ data, loading, fullWidth }: Props) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMouseEnter = useCallback((event: React.MouseEvent<SVGRectElement>, entry: HeatmapEntry) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const date = new Date(entry.date + "T00:00:00");
    const dayName = WEEKDAY_NAMES_CN[date.getDay()];
    const text = `${entry.date}（${dayName}）\n${entry.count} 次提交`;
    setTooltip({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top - 4,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  if (loading) {
    return (
      <div className="contribution-heatmap">
        <div className="heatmap-loading">
          <Loader2 className="spin" size={24} />
          <span>正在加载热力图数据...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="contribution-heatmap">
        <p className="heatmap-empty">暂无热力图数据。请先在设置中添加工作区目录。</p>
      </div>
    );
  }

  const cells = buildWeekColumns(data.entries);
  const maxCount = data.busiestCount;
  const totalCols = cells.length > 0 ? cells[cells.length - 1].col + 1 : 52;
  const cellSize = fullWidth ? CELL_SIZE_FULL : CELL_SIZE;
  const step = fullWidth ? STEP_FULL : STEP;
  const svgWidth = WEEKDAY_LABEL_WIDTH + totalCols * step;
  const svgHeight = MONTH_LABEL_HEIGHT + 7 * step;
  const monthLabels = buildMonthLabels(cells);

  return (
    <div className="contribution-heatmap">
      <div className="heatmap-grid-wrapper">
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          role="img"
          aria-label="工作热力图"
        >
          {monthLabels.map((ml) => (
            <text
              key={`m-${ml.col}`}
              className="heatmap-month-label"
              x={WEEKDAY_LABEL_WIDTH + ml.col * step}
              y={MONTH_LABEL_HEIGHT - 4}
            >
              {ml.label}
            </text>
          ))}
          {WEEKDAY_LABELS.map((label, i) =>
            label ? (
              <text
                key={`w-${i}`}
                className="heatmap-weekday-label"
                x={0}
                y={MONTH_LABEL_HEIGHT + i * step + cellSize - 1}
              >
                {label}
              </text>
            ) : null,
          )}
          {cells.map((cell) => (
            <rect
              key={cell.entry.date}
              className="heatmap-cell"
              data-level={getLevel(cell.entry.count, maxCount)}
              x={WEEKDAY_LABEL_WIDTH + cell.col * step}
              y={MONTH_LABEL_HEIGHT + cell.row * step}
              width={cellSize}
              height={cellSize}
              onMouseEnter={(e) => handleMouseEnter(e, cell.entry)}
              onMouseLeave={handleMouseLeave}
            />
          ))}
        </svg>
      </div>
      {tooltip && (
        <div
          className={`heatmap-tooltip ${tooltip ? "visible" : ""}`}
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {tooltip.text.split("\n").map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
      <div className="heatmap-legend">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className="heatmap-legend-cell"
            style={{ background: `var(--heatmap-${level})` }}
          />
        ))}
        <span>多</span>
      </div>
      <div className="heatmap-summary">
        过去 {Math.ceil(data.entries.length / 7)} 周共 <strong>{data.totalCommits.toLocaleString()}</strong> 次提交
        {" · "}活跃 <strong>{data.activeDays}</strong> 天
        {" · "}最长连续 <strong>{data.maxStreak}</strong> 天
        {data.busiestDay && (
          <>
            {" · "}最活跃 <strong>{data.busiestDay}</strong>（{data.busiestCount} 次）
          </>
        )}
      </div>
    </div>
  );
}
