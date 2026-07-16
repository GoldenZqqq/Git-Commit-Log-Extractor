import { FolderOpen, Layers, X } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  AppSettings,
  BatchGroupMode,
  BatchReportProgress,
  BatchReportResult,
  RepoInfo,
  ReportExportFormat,
  SplitGranularity,
} from "../model";
import {
  buildBatchReportOptions,
  DEFAULT_BATCH_FILE_NAME_TEMPLATE,
  parseProjectNames,
} from "../model";
import { useModalDialog } from "../hooks/useOverlayFocus";
import { Field } from "./Primitives";

type Props = {
  open: boolean;
  settings: AppSettings;
  indexedRepos: RepoInfo[];
  onNotify: (message: string, tone: "success" | "error") => void;
  onClose: () => void;
};

type Stage = "config" | "running" | "done";

const GRANULARITY_OPTIONS: { value: SplitGranularity; label: string }[] = [
  { value: "daily", label: "按天" },
  { value: "weekly", label: "按周" },
  { value: "monthly", label: "按月" },
  { value: "custom", label: "整段范围" },
];

const FORMAT_OPTIONS: { value: ReportExportFormat; label: string }[] = [
  { value: "markdown", label: "Markdown" },
  { value: "docx", label: "Word" },
  { value: "pdf", label: "PDF" },
];

const GROUP_OPTIONS: { value: BatchGroupMode; label: string }[] = [
  { value: "all", label: "全部汇总" },
  { value: "author", label: "按作者" },
  { value: "project", label: "按项目" },
];

const GROUP_FILE_NAME_TEMPLATES: Record<BatchGroupMode, string> = {
  all: DEFAULT_BATCH_FILE_NAME_TEMPLATE,
  author: "{period}-{author}-{type}.{ext}",
  project: "{period}-{project}-{type}.{ext}",
};

const FILE_NAME_TEMPLATE_TOKENS = [
  "{period}",
  "{date}",
  "{week}",
  "{month}",
  "{startDate}",
  "{endDate}",
  "{author}",
  "{project}",
  "{type}",
  "{ext}",
] as const;

export function BatchDialog({ open: isOpen, settings, indexedRepos, onNotify, onClose }: Props) {
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [granularity, setGranularity] = useState<SplitGranularity>("daily");
  const [groupMode, setGroupMode] = useState<BatchGroupMode>("all");
  const [formats, setFormats] = useState<ReportExportFormat[]>(["markdown"]);
  const [fileNameTemplate, setFileNameTemplate] = useState(DEFAULT_BATCH_FILE_NAME_TEMPLATE);
  const [outputDir, setOutputDir] = useState(settings.outputDir || "");
  const [stage, setStage] = useState<Stage>("config");
  const [progress, setProgress] = useState<BatchReportProgress | null>(null);
  const [result, setResult] = useState<BatchReportResult | null>(null);
  const [error, setError] = useState("");
  const [openError, setOpenError] = useState("");
  const dialogRef = useModalDialog({
    open: isOpen,
    onClose: handleClose,
    closeEnabled: stage !== "running",
  });

  useEffect(() => {
    if (isOpen) {
      setStage("config");
      setProgress(null);
      setResult(null);
      setError("");
      setOpenError("");
      setGroupMode("all");
      setFormats(["markdown"]);
      setFileNameTemplate(DEFAULT_BATCH_FILE_NAME_TEMPLATE);
      setOutputDir(settings.outputDir || "");
    }
  }, [isOpen, settings.outputDir]);

  useEffect(() => {
    if (!isOpen) return;
    let unlisten: (() => void) | undefined;
    listen<BatchReportProgress>("batch-report-progress", ({ payload }) => {
      setProgress(payload);
    })
      .then((cleanup) => { unlisten = cleanup; })
      .catch(() => undefined);
    return () => unlisten?.();
  }, [isOpen]);

  if (!isOpen) return null;

  const rangeInvalid = !rangeStart || !rangeEnd || rangeStart > rangeEnd;
  const templateError = validateFileNameTemplateInput(fileNameTemplate);
  const configInvalid = rangeInvalid || formats.length === 0 || Boolean(templateError) || !outputDir;

  async function browseOutputDir() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") setOutputDir(selected);
  }

  function toggleFormat(format: ReportExportFormat) {
    setFormats((current) => {
      const selected = new Set(current);
      if (selected.has(format)) selected.delete(format);
      else selected.add(format);
      return FORMAT_OPTIONS.filter((option) => selected.has(option.value)).map((option) => option.value);
    });
  }

  function selectGroupMode(nextMode: BatchGroupMode) {
    setFileNameTemplate((current) =>
      current === GROUP_FILE_NAME_TEMPLATES[groupMode]
        ? GROUP_FILE_NAME_TEMPLATES[nextMode]
        : current,
    );
    setGroupMode(nextMode);
  }

  async function copyFileNameToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      onNotify(`已复制 ${token}`, "success");
    } catch {
      onNotify(`复制失败：${token}`, "error");
    }
  }

  async function startBatch() {
    setStage("running");
    setProgress(null);
    setError("");
    setOpenError("");
    try {
      const projectNames = parseProjectNames(settings.projectNamesText);
      const options = buildBatchReportOptions(
        settings,
        projectNames,
        rangeStart,
        rangeEnd,
        granularity,
        groupMode,
        formats,
        fileNameTemplate,
        outputDir,
        indexedRepos,
      );
      const batchResult = await invoke<BatchReportResult>("batch_generate_reports", { options });
      setResult(batchResult);
      setStage("done");
    } catch (err) {
      setError(String(err));
      setStage("done");
    }
  }

  async function openOutputDir() {
    const dir = result?.outputDir || outputDir;
    if (!dir) return;

    setOpenError("");
    try {
      await invoke("open_output_directory", { path: dir });
    } catch (err) {
      setOpenError(`无法打开输出目录：${String(err)}`);
    }
  }

  function handleClose() {
    if (stage === "running") return;
    onClose();
  }

  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <div className="dialog-backdrop compact-backdrop" role="presentation" onMouseDown={handleClose}>
      <section
        ref={dialogRef}
        className="range-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-dialog-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="range-dialog-header">
          <div>
            <p className="kicker">Batch Generate</p>
            <h2 id="batch-dialog-title">批量生成报告</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={handleClose}
            disabled={stage === "running"}
            aria-label="关闭批量生成"
          >
            <X size={17} />
          </button>
        </header>

        {stage === "config" && (
          <>
            <div className="range-fields">
              <Field label="开始日期">
                <input
                  data-dialog-initial-focus
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                />
              </Field>
              <Field label="结束日期">
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                />
              </Field>
            </div>

            <div className="range-fields batch-export-row">
              <Field label="拆分粒度">
                <select
                  value={granularity}
                  onChange={(e) => setGranularity(e.target.value as SplitGranularity)}
                >
                  {GRANULARITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>
              <div className="field batch-format-field">
                <span>导出格式</span>
                <div className="batch-choice-options" role="group" aria-label="导出格式">
                  {FORMAT_OPTIONS.map((option) => (
                    <label
                      className={`batch-choice-option ${formats.includes(option.value) ? "selected" : ""}`}
                      key={option.value}
                    >
                      <input
                        type="checkbox"
                        checked={formats.includes(option.value)}
                        onChange={() => toggleFormat(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="field batch-group-field">
              <span>分组方式</span>
              <div className="batch-choice-options" role="radiogroup" aria-label="分组方式">
                {GROUP_OPTIONS.map((option) => (
                  <label
                    className={`batch-choice-option ${groupMode === option.value ? "selected" : ""}`}
                    key={option.value}
                  >
                    <input
                      type="radio"
                      name="batch-group-mode"
                      value={option.value}
                      checked={groupMode === option.value}
                      onChange={() => selectGroupMode(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="field batch-template-field">
              <label htmlFor="batch-file-name-template">文件命名模板</label>
              <input
                id="batch-file-name-template"
                value={fileNameTemplate}
                onChange={(event) => setFileNameTemplate(event.target.value)}
              />
              <div className="batch-template-tokens" role="group" aria-label="可用文件名变量">
                <span>可用变量</span>
                {FILE_NAME_TEMPLATE_TOKENS.map((token) => (
                  <button
                    type="button"
                    className="batch-template-token"
                    key={token}
                    onClick={() => void copyFileNameToken(token)}
                    aria-label={`复制变量 ${token}`}
                    title={`复制变量 ${token}`}
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>

            <Field label="输出目录">
              <div className="path-input">
                <input value={outputDir} readOnly placeholder="选择输出目录" />
                <button type="button" onClick={browseOutputDir} aria-label="选择输出目录">
                  <FolderOpen size={17} />
                </button>
              </div>
            </Field>

            {rangeInvalid && rangeStart && rangeEnd && (
              <p className="range-error">开始日期不能晚于结束日期。</p>
            )}
            {formats.length === 0 && (
              <p className="range-error">请至少选择一种导出格式。</p>
            )}
            {templateError && <p className="range-error">{templateError}</p>}

            <footer className="range-dialog-actions">
              <button type="button" className="mapping-import" onClick={handleClose}>
                取消
              </button>
              <button
                type="button"
                className="mapping-add"
                disabled={configInvalid}
                onClick={startBatch}
              >
                <Layers size={16} />
                开始生成
              </button>
            </footer>
          </>
        )}

        {stage === "running" && !progress && (
          <div className="batch-preparing" role="status">
            <div className="progress-track batch-preparing-track" aria-hidden="true">
              <div className="batch-preparing-bar" />
            </div>
            <p>正在扫描提交并准备批量任务...</p>
          </div>
        )}

        {stage === "running" && progress && (
          <div style={{ padding: "0 0 20px" }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 6,
                color: "var(--text-secondary)",
              }}>
                <span>{progress.currentLabel}</span>
                <span>{progress.completed}/{progress.total}</span>
              </div>
              <div style={{
                height: 6,
                borderRadius: 3,
                background: "var(--border)",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  borderRadius: 3,
                  background: "var(--accent)",
                  transition: "width 0.3s ease",
                }} />
              </div>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>
              {progress.done
                ? "正在整理生成结果..."
                : `正在生成第 ${progress.completed + 1} / ${progress.total} 个文件...`}
            </p>
          </div>
        )}

        {stage === "done" && (
          <div style={{ padding: "0 0 20px" }}>
            {error ? (
              <p className="range-error">{error}</p>
            ) : result && (
              <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                <p>生成完成：共 {result.total} 个文件</p>
                <p style={{ color: "var(--accent)" }}>成功 {result.succeeded} 个</p>
                {result.failed > 0 && (
                  <>
                    <p style={{ color: "var(--error, #ef4444)" }}>失败 {result.failed} 个</p>
                    <details style={{ marginTop: 8, fontSize: 13 }}>
                      <summary style={{ cursor: "pointer", color: "var(--text-secondary)" }}>
                        查看失败详情
                      </summary>
                      <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                        {result.failures.map((f, i) => (
                          <li key={i} style={{ color: "var(--text-secondary)" }}>
                            {f.label}：{f.error}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </>
                )}
              </div>
            )}
            {openError && <p className="range-error">{openError}</p>}

            <footer className="range-dialog-actions" style={{ marginTop: 16 }}>
              {result && result.succeeded > 0 && (
                <button type="button" className="mapping-import" onClick={openOutputDir}>
                  <FolderOpen size={16} />
                  打开输出目录
                </button>
              )}
              <button type="button" className="mapping-add" onClick={handleClose}>
                关闭
              </button>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}

function validateFileNameTemplateInput(template: string) {
  const value = template.trim();
  if (!value) return "文件名模板不能为空。";
  if (!value.endsWith(".{ext}")) return "文件名模板必须以 .{ext} 结尾。";
  return "";
}
