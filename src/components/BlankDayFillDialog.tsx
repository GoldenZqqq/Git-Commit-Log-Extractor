import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Copy, Loader2, RotateCcw, Sparkles, Wand2, X } from "lucide-react";
import type {
  AppSettings,
  BlankDayFillResult,
  BlankDayItemCount,
  CommitRecord,
  DateRange,
  ExtractResult,
  RepoInfo,
} from "../model";
import {
  BLANK_DAY_ITEM_COUNT_OPTIONS,
  DEFAULT_BLANK_DAY_ITEM_COUNT,
  DEFAULT_BLANK_DAY_USER_PROMPT,
  buildBlankDayEvidenceText,
  buildBlankDayFillOptions,
  buildExtractOptions,
  collectBlankDayRepoTags,
  getBlankDaySourceRange,
  getSingleDayRange,
  parseProjectNames,
  validateAiSettings,
  validateExtractSettings,
} from "../model";
import { useModalDialog } from "../hooks/useOverlayFocus";
import { DatePickerField } from "./date-picker";
import { Field } from "./Primitives";

type Props = {
  open: boolean;
  settings: AppSettings;
  indexedRepos: RepoInfo[];
  targetDate: string;
  aiConfigured: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onGenerated: (payload: {
    draftText: string;
    targetDate: string;
    sourceRange: DateRange;
    commitCount: number;
    repoCount: number;
  }) => void;
  onApply: (draftText: string, targetDate: string) => void;
  onNotify: (message: string, tone: "success" | "error" | "warning" | "info") => void;
};

type Stage = "config" | "result";

export function BlankDayFillDialog({
  open,
  settings,
  indexedRepos,
  targetDate: initialTargetDate,
  aiConfigured,
  onClose,
  onOpenSettings,
  onGenerated,
  onApply,
  onNotify,
}: Props) {
  const projectNames = useMemo(() => parseProjectNames(settings.projectNamesText), [settings.projectNamesText]);
  const [targetDate, setTargetDate] = useState(initialTargetDate);
  const [sourceRange, setSourceRange] = useState<DateRange>(() => getBlankDaySourceRange(initialTargetDate));
  const [itemCount, setItemCount] = useState<BlankDayItemCount>(DEFAULT_BLANK_DAY_ITEM_COUNT);
  const [userPrompt, setUserPrompt] = useState(DEFAULT_BLANK_DAY_USER_PROMPT);
  const [selectedRepoPaths, setSelectedRepoPaths] = useState<string[]>([]);
  const [sourceCommits, setSourceCommits] = useState<CommitRecord[]>([]);
  const [targetHasCommits, setTargetHasCommits] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [draftText, setDraftText] = useState("");
  const [stage, setStage] = useState<Stage>("config");
  const dialogRef = useModalDialog({ open, onClose, closeEnabled: !generating });

  const repoTags = useMemo(
    () => collectBlankDayRepoTags(sourceCommits, projectNames),
    [sourceCommits, projectNames],
  );
  const rangeInvalid = Boolean(sourceRange.startDate && sourceRange.endDate && sourceRange.startDate > sourceRange.endDate);
  const canGenerate =
    aiConfigured &&
    !rangeInvalid &&
    selectedRepoPaths.length > 0 &&
    sourceCommits.some((commit) => selectedRepoPaths.includes(commit.repoPath)) &&
    !scanning &&
    !generating;

  useEffect(() => {
    if (!open) return;
    setTargetDate(initialTargetDate);
    setSourceRange(getBlankDaySourceRange(initialTargetDate));
    setItemCount(DEFAULT_BLANK_DAY_ITEM_COUNT);
    setUserPrompt(DEFAULT_BLANK_DAY_USER_PROMPT);
    setSelectedRepoPaths([]);
    setSourceCommits([]);
    setTargetHasCommits(false);
    setError("");
    setDraftText("");
    setStage("config");
  }, [open, initialTargetDate]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function scanSource() {
      setScanning(true);
      setError("");
      try {
        validateExtractSettings(settings, sourceRange);
        const [sourceResult, targetResult] = await Promise.all([
          invoke<ExtractResult>("extract_commits", {
            options: buildExtractOptions(settings, projectNames, sourceRange, false, "", indexedRepos),
          }),
          invoke<ExtractResult>("extract_commits", {
            options: buildExtractOptions(settings, projectNames, getSingleDayRange(targetDate), false, "", indexedRepos),
          }),
        ]);
        if (cancelled) return;
        setSourceCommits(sourceResult.commits);
        const tags = collectBlankDayRepoTags(sourceResult.commits, projectNames);
        setSelectedRepoPaths(tags.map((tag) => tag.path));
        setTargetHasCommits(targetResult.commits.length > 0);
        if (sourceResult.commits.length === 0) {
          setError("素材周期内没有提交记录，请扩大日期范围或检查作者与仓库启用状态。");
        }
      } catch (err) {
        if (!cancelled) {
          setSourceCommits([]);
          setSelectedRepoPaths([]);
          setError(String(err));
        }
      } finally {
        if (!cancelled) setScanning(false);
      }
    }

    void scanSource();
    return () => {
      cancelled = true;
    };
  }, [open, sourceRange.startDate, sourceRange.endDate, targetDate, settings, projectNames, indexedRepos]);

  if (!open) return null;

  function toggleRepo(path: string) {
    setSelectedRepoPaths((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path],
    );
  }

  function selectAllRepos() {
    setSelectedRepoPaths(repoTags.map((tag) => tag.path));
  }

  function clearRepos() {
    setSelectedRepoPaths([]);
  }

  async function handleGenerate() {
    setError("");
    try {
      validateAiSettings(settings);
    } catch (err) {
      setError(String(err));
      return;
    }
    if (!canGenerate) {
      setError("请先选择至少有提交线索的仓库，并确认 AI 已配置。");
      return;
    }

    const evidence = buildBlankDayEvidenceText(
      sourceCommits,
      selectedRepoPaths,
      projectNames,
      settings.commitItemPrefixMode,
    );
    if (!evidence.trim()) {
      setError("当前勾选仓库在素材周期内没有提交线索。");
      return;
    }

    setGenerating(true);
    try {
      const result = await invoke<BlankDayFillResult>("fill_blank_day_report", {
        options: buildBlankDayFillOptions(settings, evidence, targetDate, sourceRange, itemCount, userPrompt),
      });
      const text = result.draftText.trim();
      if (!text) throw new Error("AI 未返回可用草稿");
      setDraftText(text);
      setStage("result");
      onGenerated({
        draftText: text,
        targetDate,
        sourceRange,
        commitCount: sourceCommits.filter((commit) => selectedRepoPaths.includes(commit.repoPath)).length,
        repoCount: selectedRepoPaths.length,
      });
      onNotify("空白日补写草稿已生成", "success");
    } catch (err) {
      setError(String(err));
      onNotify(`补写失败：${String(err)}`, "error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draftText);
      onNotify("已复制补写草稿", "success");
    } catch {
      onNotify("复制失败", "error");
    }
  }

  function handleApply() {
    onApply(draftText, targetDate);
  }

  return (
    <div className="dialog-backdrop compact-backdrop" role="presentation" onMouseDown={() => !generating && onClose()}>
      <section
        ref={dialogRef}
        className="range-dialog blank-day-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="blank-day-dialog-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="range-dialog-header">
          <div>
            <p className="kicker">Blank Day Fill</p>
            <h2 id="blank-day-dialog-title">空白日补写</h2>
            <p className="blank-day-subtitle">参考历史提交生成草稿，请核对后使用</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} disabled={generating} aria-label="关闭空白日补写">
            <X size={18} />
          </button>
        </header>

        <div className="blank-day-disclaimer" role="note">
          本内容基于历史 Git 提交线索推断生成，不是当天真实提交记录。请核对后使用。
        </div>

        {targetHasCommits && (
          <div className="blank-day-soft-warning" role="status">
            目标日已有提交记录，补写将基于历史线索生成延续草稿，不会替代真实提交摘要。也可先点「生成日报」。
          </div>
        )}

        {stage === "config" && (
          <>
            <div className="range-fields">
              <Field label="目标日">
                <DatePickerField
                  data-dialog-initial-focus
                  ariaLabel="目标日"
                  value={targetDate}
                  onChange={setTargetDate}
                />
              </Field>
              <Field label="生成条数">
                <select
                  value={itemCount}
                  onChange={(event) => setItemCount(Number(event.target.value) as BlankDayItemCount)}
                >
                  {BLANK_DAY_ITEM_COUNT_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      {count} 条
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="range-fields">
              <Field label="素材开始">
                <DatePickerField
                  ariaLabel="素材开始"
                  value={sourceRange.startDate}
                  onChange={(startDate) => setSourceRange((current) => ({ ...current, startDate }))}
                />
              </Field>
              <Field label="素材结束">
                <DatePickerField
                  ariaLabel="素材结束"
                  value={sourceRange.endDate}
                  onChange={(endDate) => setSourceRange((current) => ({ ...current, endDate }))}
                />
              </Field>
            </div>

            <div className="field blank-day-repo-field">
              <div className="blank-day-repo-header">
                <span>涉及仓库（可勾选）</span>
                <div className="blank-day-repo-actions">
                  <button type="button" className="blank-day-link-button" onClick={selectAllRepos} disabled={repoTags.length === 0}>
                    全选
                  </button>
                  <button type="button" className="blank-day-link-button" onClick={clearRepos} disabled={selectedRepoPaths.length === 0}>
                    清空
                  </button>
                </div>
              </div>
              {scanning ? (
                <p className="blank-day-muted">
                  <Loader2 size={14} className="spin" /> 正在扫描素材周期提交…
                </p>
              ) : repoTags.length === 0 ? (
                <p className="blank-day-muted">该素材周期暂无涉及仓库</p>
              ) : (
                <div className="blank-day-tags" role="group" aria-label="仓库标签">
                  {repoTags.map((tag) => {
                    const selected = selectedRepoPaths.includes(tag.path);
                    return (
                      <button
                        key={tag.path}
                        type="button"
                        className={`blank-day-tag ${selected ? "selected" : ""}`}
                        onClick={() => toggleRepo(tag.path)}
                        title={tag.path}
                      >
                        {tag.label}
                        <span className="blank-day-tag-count">{tag.count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="field blank-day-prompt-field">
              <div className="blank-day-repo-header">
                <label htmlFor="blank-day-prompt">提示词</label>
                <button
                  type="button"
                  className="blank-day-link-button"
                  onClick={() => setUserPrompt(DEFAULT_BLANK_DAY_USER_PROMPT)}
                >
                  <RotateCcw size={13} />
                  恢复默认
                </button>
              </div>
              <textarea
                id="blank-day-prompt"
                className="blank-day-prompt"
                value={userPrompt}
                onChange={(event) => setUserPrompt(event.target.value)}
                rows={6}
              />
            </div>

            {!aiConfigured && (
              <p className="range-error">
                请先在设置中配置 AI。
                <button type="button" className="blank-day-link-button" onClick={onOpenSettings}>
                  打开设置
                </button>
              </p>
            )}
            {rangeInvalid && <p className="range-error">素材开始日期不能晚于结束日期。</p>}
            {error && <p className="range-error">{error}</p>}

            <footer className="range-dialog-actions">
              <button type="button" className="mapping-import" onClick={onClose} disabled={generating}>
                取消
              </button>
              <button type="button" className="mapping-add" disabled={!canGenerate} onClick={() => void handleGenerate()}>
                {generating ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
                {generating ? "生成中…" : "生成草稿"}
              </button>
            </footer>
          </>
        )}

        {stage === "result" && (
          <>
            <div className="field blank-day-result-field">
              <span>补写草稿（可编辑）</span>
              <textarea
                className="blank-day-prompt blank-day-result"
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                rows={12}
              />
            </div>
            {error && <p className="range-error">{error}</p>}
            <footer className="range-dialog-actions blank-day-result-actions">
              <button type="button" className="mapping-import" onClick={() => setStage("config")}>
                返回调整
              </button>
              <button type="button" className="mapping-import" onClick={() => void handleCopy()}>
                <Copy size={15} />
                复制
              </button>
              <button type="button" className="mapping-import" disabled={!canGenerate || generating} onClick={() => void handleGenerate()}>
                {generating ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                重新生成
              </button>
              <button type="button" className="mapping-add" onClick={handleApply} disabled={!draftText.trim()}>
                应用到预览
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
