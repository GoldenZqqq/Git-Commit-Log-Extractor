import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AlertCircle, CheckCircle2, FileArchive, Loader2, ShieldCheck } from "lucide-react";
import { useReducer, type Dispatch } from "react";
import { useModalDialog } from "../hooks/useOverlayFocus";
import {
  buildSupportBundleOptions,
  type AppSettings,
  type DiagnosticResult,
  type RepoInfo,
  type SupportBundleEventInput,
  type SupportBundleExportResult,
  type SupportBundleOptions,
  type SupportBundlePreview,
} from "../model";
import { SupportBundleDialog } from "./SupportBundleDialog";

type Props = {
  settings: AppSettings;
  repos: RepoInfo[];
  diagnostics: DiagnosticResult | null;
  diagnosticError: string;
  diagnosticsBusy: boolean;
  recentEvents: SupportBundleEventInput[];
};

type Feedback = { tone: "success" | "error"; message: string };
type BusyAction = "preview" | "export" | null;
type State = {
  preview: SupportBundlePreview | null;
  options: SupportBundleOptions | null;
  selectedEntry: string;
  confirmed: boolean;
  busy: BusyAction;
  feedback: Feedback | null;
};

type Action =
  | { type: "busy"; value: BusyAction }
  | { type: "preview-ready"; preview: SupportBundlePreview; options: SupportBundleOptions }
  | { type: "selected-entry"; value: string }
  | { type: "confirmed"; value: boolean }
  | { type: "feedback"; value: Feedback | null }
  | { type: "reset-preview" };

const INITIAL_STATE: State = {
  preview: null,
  options: null,
  selectedEntry: "",
  confirmed: false,
  busy: null,
  feedback: null,
};

export function SupportBundleSection(props: Props) {
  const controller = useSupportBundleController(props);
  const activeEntry = controller.state.preview?.entries.find(
    (entry) => entry.name === controller.state.selectedEntry,
  ) ?? controller.state.preview?.entries[0];

  return (
    <>
      <section className="settings-section support-bundle-section">
        <div className="support-bundle-header">
          <div className="section-title"><ShieldCheck size={16} /><h2>支持材料</h2></div>
          <button
            type="button"
            className="mapping-import support-bundle-trigger"
            onClick={controller.actions.prepare}
            disabled={props.diagnosticsBusy}
            aria-disabled={controller.state.busy !== null}
            aria-busy={controller.state.busy === "preview"}
          >
            {controller.state.busy === "preview" ? <Loader2 className="spin" size={15} /> : <FileArchive size={15} />}
            {controller.state.busy === "preview" ? "准备中" : "准备支持包"}
          </button>
        </div>
        <p className="support-bundle-copy">预览和 ZIP 仅在本机生成；GitHub Issue 只使用不含路径和日志的安全摘要。</p>
        {!controller.state.preview && controller.state.feedback && (
          <SupportFeedback feedback={controller.state.feedback} />
        )}
      </section>
      {controller.state.preview && activeEntry && (
        <SupportBundleDialog
          dialogRef={controller.dialogRef}
          preview={controller.state.preview}
          activeEntry={activeEntry}
          selectedEntry={controller.state.selectedEntry}
          confirmed={controller.state.confirmed}
          busy={controller.state.busy}
          feedback={controller.state.feedback}
          onClose={controller.actions.close}
          onSelectEntry={(name) => controller.dispatch({ type: "selected-entry", value: name })}
          onConfirm={(value) => controller.dispatch({ type: "confirmed", value })}
          onCopy={controller.actions.copy}
          onOpenIssue={controller.actions.openIssue}
          onExport={controller.actions.exportBundle}
        />
      )}
    </>
  );
}

function useSupportBundleController(props: Props) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const close = () => {
    if (state.busy === "export") return;
    dispatch({ type: "reset-preview" });
  };
  const actions = createActions(props, state, dispatch, close);
  const dialogRef = useModalDialog({
    open: Boolean(state.preview),
    onClose: close,
    closeEnabled: state.busy !== "export",
  });
  return { state, dispatch, actions, dialogRef };
}

function createActions(props: Props, state: State, dispatch: Dispatch<Action>, close: () => void) {
  return {
    prepare: () => void preparePreview(props, dispatch, state.busy),
    close,
    copy: () => void copySummary(state.preview, dispatch),
    openIssue: () => void openIssue(state.preview, dispatch),
    exportBundle: () => void exportBundle(state, dispatch),
  };
}

async function preparePreview(props: Props, dispatch: Dispatch<Action>, busy: BusyAction) {
  if (busy !== null) return;
  const options = buildSupportBundleOptions({
    settings: props.settings,
    repos: props.repos,
    diagnostics: props.diagnostics,
    diagnosticError: props.diagnosticError,
    recentEvents: props.recentEvents,
  });
  dispatch({ type: "busy", value: "preview" });
  dispatch({ type: "feedback", value: null });
  try {
    const preview = await invoke<SupportBundlePreview>("preview_support_bundle", { options });
    dispatch({ type: "preview-ready", preview, options });
  } catch (error) {
    dispatch({ type: "feedback", value: { tone: "error", message: errorMessage(error, "准备支持包预览失败") } });
  } finally {
    dispatch({ type: "busy", value: null });
  }
}

async function exportBundle(state: State, dispatch: Dispatch<Action>) {
  if (!state.preview || !state.options || !state.confirmed || state.busy !== null) return;
  dispatch({ type: "busy", value: "export" });
  dispatch({ type: "feedback", value: null });
  try {
    const result = await saveSupportBundle(state.preview, state.options);
    if (!result) return;
    dispatch({
      type: "feedback",
      value: { tone: "success", message: `支持包已保存：${result.outputFile}（${formatBytes(result.bytes)}）` },
    });
    dispatch({ type: "reset-preview" });
  } catch (error) {
    dispatch({ type: "feedback", value: { tone: "error", message: errorMessage(error, "导出支持包失败") } });
  } finally {
    dispatch({ type: "busy", value: null });
  }
}

async function saveSupportBundle(preview: SupportBundlePreview, options: SupportBundleOptions) {
  const path = await save({
    defaultPath: preview.suggestedFileName,
    filters: [{ name: "ZIP 支持包", extensions: ["zip"] }],
  });
  if (typeof path !== "string") return null;
  return invoke<SupportBundleExportResult>("export_support_bundle", { path, options });
}

async function copySummary(preview: SupportBundlePreview | null, dispatch: Dispatch<Action>) {
  if (!preview) return;
  try {
    await navigator.clipboard.writeText(`${preview.issueTitle}\n\n${preview.issueBody}`);
    dispatch({ type: "feedback", value: { tone: "success", message: "安全摘要已复制" } });
  } catch (error) {
    dispatch({ type: "feedback", value: { tone: "error", message: errorMessage(error, "复制安全摘要失败") } });
  }
}

async function openIssue(preview: SupportBundlePreview | null, dispatch: Dispatch<Action>) {
  if (!preview) return;
  try {
    await openUrl(buildIssueUrl(preview));
    dispatch({ type: "feedback", value: { tone: "success", message: "已在浏览器打开 GitHub Issue" } });
  } catch (error) {
    dispatch({ type: "feedback", value: { tone: "error", message: errorMessage(error, "打开 GitHub Issue 失败") } });
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "busy": return { ...state, busy: action.value };
    case "preview-ready": return { ...state, preview: action.preview, options: action.options, selectedEntry: action.preview.entries[0]?.name ?? "", confirmed: false };
    case "selected-entry": return { ...state, selectedEntry: action.value };
    case "confirmed": return { ...state, confirmed: action.value };
    case "feedback": return { ...state, feedback: action.value };
    case "reset-preview": return { ...state, preview: null, options: null, selectedEntry: "", confirmed: false };
  }
}

function SupportFeedback({ feedback }: { feedback: Feedback }) {
  const Icon = feedback.tone === "success" ? CheckCircle2 : AlertCircle;
  return <p className={`support-bundle-feedback ${feedback.tone}`} role="status"><Icon size={14} />{feedback.message}</p>;
}

function buildIssueUrl(preview: SupportBundlePreview) {
  const url = new URL("https://github.com/GoldenZqqq/GitPulse/issues/new");
  url.searchParams.set("title", preview.issueTitle);
  url.searchParams.set("body", preview.issueBody);
  return url.toString();
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function errorMessage(error: unknown, context: string) {
  const detail = error instanceof Error ? error.message : String(error);
  return `${context}：${detail}`;
}
