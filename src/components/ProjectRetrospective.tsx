import { useMemo, useState } from "react";
import { ExternalLink, History } from "lucide-react";
import {
  deriveProjectRetrospective,
  listRetrospectiveProjects,
  UNCLASSIFIED_PROJECT_NAME,
  type ProjectRetrospectiveRange,
} from "../projectRetrospective";
import { isBlankDayHistoryEntry, type ReportHistoryEntry } from "../model";
import "./ProjectRetrospective.css";

type Props = {
  entries: ReportHistoryEntry[];
  onOpenHistory: (entry: ReportHistoryEntry) => void;
};

export function ProjectRetrospective({ entries, onOpenHistory }: Props) {
  const projects = useMemo(() => listRetrospectiveProjects(entries), [entries]);
  const [selectedProject, setSelectedProject] = useState("");
  const [range, setRange] = useState<ProjectRetrospectiveRange>("90");
  const activeProject = projects.includes(selectedProject) ? selectedProject : (projects[0] ?? "");
  const result = useMemo(
    () => deriveProjectRetrospective(entries, activeProject, range),
    [activeProject, entries, range],
  );

  return (
    <section className="project-retrospective" aria-labelledby="project-retrospective-title">
      <div className="project-retrospective-header">
        <div className="project-retrospective-title">
          <History size={16} aria-hidden="true" />
          <div>
            <h4 id="project-retrospective-title">项目回顾</h4>
            <p>基于已保存报告归属，不重新扫描 Git</p>
          </div>
        </div>
        <div className="project-retrospective-controls">
          <label>
            <span>项目</span>
            <select
              aria-label="选择回顾项目"
              value={activeProject}
              disabled={projects.length === 0}
              onChange={(event) => setSelectedProject(event.target.value)}
            >
              {projects.length === 0 ? <option value="">暂无项目</option> : null}
              {projects.map((project) => <option key={project} value={project}>{project}</option>)}
            </select>
          </label>
          <label>
            <span>时间</span>
            <select
              aria-label="选择回顾时间范围"
              value={range}
              disabled={projects.length === 0}
              onChange={(event) => setRange(event.target.value as ProjectRetrospectiveRange)}
            >
              <option value="30">近 30 天</option>
              <option value="90">近 90 天</option>
              <option value="180">近 180 天</option>
              <option value="all">全部历史</option>
            </select>
          </label>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="project-retrospective-empty">
          {entries.length === 0
            ? "生成报告后，可在这里按项目回顾提交和证据。"
            : "当前历史没有可归属的项目记录。"}
        </div>
      ) : (
        <>
          {activeProject === UNCLASSIFIED_PROJECT_NAME ? (
            <p className="project-retrospective-notice">
              这些历史记录生成于结构化项目归属上线前，未根据正文猜测项目。
            </p>
          ) : null}
          <div className="project-retrospective-summary" aria-label="项目回顾汇总">
            <span><strong>{result.summary.reportCount}</strong> 份报告</span>
            <span><strong>{result.summary.commitCount}</strong> 次项目提交</span>
            <span><strong>{result.summary.exportedCount}</strong> 份已导出</span>
            <span><strong>{result.summary.evidenceCount}</strong> 个证据</span>
          </div>
          {result.items.length === 0 ? (
            <div className="project-retrospective-empty">当前时间范围内没有该项目的历史报告。</div>
          ) : (
            <div className="project-retrospective-timeline" aria-label={`${activeProject} 报告时间线`}>
              {result.items.map((item) => (
                <article className="project-retrospective-row" key={`${item.entry.id}-${item.project.name}`}>
                  <div className="project-retrospective-row-main">
                    <div className="project-retrospective-row-heading">
                      <span className="project-retrospective-kind">{reportKindLabel(item.entry)}</span>
                      <strong>{item.entry.periodLabel || item.anchorDate}</strong>
                      <time dateTime={item.anchorDate}>{item.anchorDate}</time>
                    </div>
                    <div className="project-retrospective-statuses">
                      <span>{item.project.commitCount} 次提交</span>
                      <span>{item.entry.aiEnhanced ? "AI 润色" : "本地原稿"}</span>
                      <span>{item.entry.outputFile.trim() ? "已导出" : "未导出"}</span>
                    </div>
                    <div className="project-retrospective-evidence" aria-label="证据编号">
                      {item.project.evidenceIds.length > 0
                        ? item.project.evidenceIds.map((evidenceId) => <code key={evidenceId}>{evidenceId}</code>)
                        : <span>无结构化证据</span>}
                    </div>
                  </div>
                  <button
                    className="project-retrospective-open"
                    type="button"
                    aria-label={`打开${item.entry.title}`}
                    title="打开原报告"
                    onClick={() => onOpenHistory(item.entry)}
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    打开
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function reportKindLabel(entry: ReportHistoryEntry) {
  if (entry.mode === "weekly") return "周报";
  if (entry.mode === "monthly") return "月报";
  if (entry.mode === "custom") return "自定义";
  return isBlankDayHistoryEntry(entry) ? "补写" : "日报";
}
