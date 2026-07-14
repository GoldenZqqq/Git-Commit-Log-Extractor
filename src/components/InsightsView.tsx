import { Activity, RefreshCw, Loader2 } from "lucide-react";
import { ContributionHeatmap, type HeatmapResult } from "./ContributionHeatmap";
import { WorkRhythmPanel, type WorkRhythmResult } from "./WorkRhythmPanel";
import { TrendPanel, type TrendResult } from "./TrendPanel";
import { ReportCalendar } from "./ReportCalendar";
import type { ReportHistoryEntry } from "../model";
import "./InsightsView.css";

type Props = {
  heatmapData: HeatmapResult | null;
  heatmapLoading: boolean;
  rhythmData: WorkRhythmResult | null;
  rhythmLoading: boolean;
  trendData: TrendResult | null;
  trendLoading: boolean;
  trendGranularity: "weekly" | "monthly";
  onTrendGranularityChange: (g: "weekly" | "monthly") => void;
  onRefresh: () => void;
  reportHistory: ReportHistoryEntry[];
  aiConfigured: boolean;
  isBusy: boolean;
  onOpenHistory: (entry: ReportHistoryEntry) => void;
  onGenerateDaily: (date: string) => void;
  onOpenBlankDayFill: (date: string) => void;
};

export function InsightsView({
  heatmapData,
  heatmapLoading,
  rhythmData,
  rhythmLoading,
  trendData,
  trendLoading,
  trendGranularity,
  onTrendGranularityChange,
  onRefresh,
  reportHistory,
  aiConfigured,
  isBusy,
  onOpenHistory,
  onGenerateDaily,
  onOpenBlankDayFill,
}: Props) {
  const anyLoading = heatmapLoading || rhythmLoading || trendLoading;
  const hasAnyData = heatmapData || rhythmData || trendData || reportHistory.length > 0;

  return (
    <section className="insights-view" aria-label="数据洞察">
      <div className="insights-header">
        <h3>
          <Activity size={17} />
          数据洞察
        </h3>
        <button
          className="insights-refresh-button"
          type="button"
          onClick={onRefresh}
          disabled={anyLoading}
          aria-label="刷新洞察数据"
          title="刷新洞察数据"
        >
          {anyLoading ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}
          刷新
        </button>
      </div>

      {anyLoading && !hasAnyData ? (
        <div className="insights-loading">
          <Loader2 className="spin" size={28} />
          <span>正在加载洞察数据...</span>
        </div>
      ) : (
        <div className="insights-content">
          <div className="insights-heatmap-section">
            <ContributionHeatmap data={heatmapData} loading={heatmapLoading} fullWidth />
          </div>

          <div className="insights-calendar-section">
            <ReportCalendar
              entries={reportHistory}
              aiConfigured={aiConfigured}
              isBusy={isBusy}
              onOpenHistory={onOpenHistory}
              onGenerateDaily={onGenerateDaily}
              onOpenBlankDayFill={onOpenBlankDayFill}
            />
          </div>

          <div className="insights-bottom-grid">
            <div className="insights-rhythm-section">
              <WorkRhythmPanel data={rhythmData} loading={rhythmLoading} />
            </div>
            <div className="insights-trend-section">
              <TrendPanel
                data={trendData}
                loading={trendLoading}
                granularity={trendGranularity}
                onGranularityChange={onTrendGranularityChange}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
