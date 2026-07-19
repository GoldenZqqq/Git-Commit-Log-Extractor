import { CheckCircle2 } from "lucide-react";
import type { AppSettings, RepoInfo } from "../model";
import { SectionTitle } from "./SettingsPrimitives";

type Props = { settings: AppSettings; repos: RepoInfo[] };

export function LocalDataBoundarySection({ settings, repos }: Props) {
  const rootDirSummary = settings.rootDirs.length > 0
    ? `${settings.rootDirs.length} 个仓库根目录，当前索引 ${repos.length} 个仓库`
    : "尚未配置仓库根目录";
  const aiReady = isAiConnectionConfigured(settings);
  const aiBoundary = aiReady
    ? `使用 AI 润色时，仅当前报告草稿、系统提示词和附加润色指令会发送到 ${formatAiDestination(settings)}。`
    : "未配置或未点击 AI 润色时，报告草稿、提交记录和项目映射不会发送到外部 AI 服务。";

  return (
    <section className="settings-section local-boundary-section">
      <SectionTitle icon={<CheckCircle2 size={16} />} title="本地数据边界" />
      <div className="local-boundary-grid">
        <BoundaryItem title="仓库扫描" body="GitPulse 只读取你选择的本机目录和 Git 元数据，用于提取提交、分支、作者与提交信息。" detail={rootDirSummary} />
        <BoundaryItem title="报告与历史" body="生成的报告、最近历史、项目映射、模板和设置偏好保存在本机应用数据中。" detail="可在通用设置中调整保留条数或清空历史；只影响本机记录，不会改动仓库。" />
        <BoundaryItem title="凭据存储" body={formatCredentialBoundary(settings)} detail="诊断页和报告预览不会展示完整密钥。" />
        <BoundaryItem title="AI 发送范围" body={aiBoundary} detail="生成报告始终可完全在本机完成；只有手动润色当前报告时才会调用 AI。" />
      </div>
    </section>
  );
}

function isAiConnectionConfigured(settings: AppSettings) {
  if (settings.aiProvider === "codex-oauth") return Boolean(settings.aiModel.trim());
  return Boolean(settings.aiBaseUrl.trim() && settings.aiModel.trim() && settings.aiApiKey.trim());
}

function BoundaryItem({ title, body, detail }: { title: string; body: string; detail: string }) {
  return <article className="local-boundary-item"><strong>{title}</strong><p>{body}</p><small>{detail}</small></article>;
}

function formatAiDestination(settings: AppSettings) {
  if (settings.aiProvider === "codex-oauth") return "ChatGPT Codex OAuth";
  const baseUrl = settings.aiBaseUrl.trim();
  const model = settings.aiModel.trim();
  if (baseUrl && model) return `${baseUrl} / ${model}`;
  return baseUrl || "当前配置的 AI 服务";
}

function formatCredentialBoundary(settings: AppSettings) {
  if (settings.aiProvider === "codex-oauth") return "ChatGPT 账号状态由本机 OAuth 会话读取，不需要在 GitPulse 中保存 API Key。";
  const apiKey = settings.aiApiKey.trim();
  if (apiKey.toLowerCase().startsWith("env:") || apiKey.toUpperCase().endsWith("_API_KEY")) return "API Key 可通过环境变量引用，GitPulse 只保存变量名，不保存变量值。";
  if (settings.aiApiKeySaved) return "API Key 已保存到系统凭据库，设置文件只记录已保存状态。";
  if (apiKey) return "当前输入的 API Key 会保存到系统凭据库，避免明文写入普通设置。";
  return "尚未配置 API Key；不使用 AI 润色时不需要任何外部服务凭据。";
}
