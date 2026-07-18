export const locales = ["zh-CN", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";
export const localeStorageKey = "gitpulse-site-locale";

export const localeLabels: Record<Locale, string> = {
  "zh-CN": "中文",
  en: "EN",
};

export interface PageContent {
  title: string;
  description: string;
  ogDescription: string;
  navAriaLabel: string;
  homeAriaLabel: string;
  githubLabel: string;
  languageLabel: string;
  demoAriaLabel: string;
  nav: Array<{ id: string; label: string; href?: string }>;
  hero: {
    eyebrow: string;
    copy: string;
    primaryAction: string;
    secondaryAction: string;
    actionsLabel: string;
    factsLabel: string;
    facts: Array<{ value: string; label: string }>;
  };
  workflow: {
    eyebrow: string;
    title: string;
    steps: Array<{ title: string; body: string }>;
  };
  demo: {
    eyebrow: string;
    title: string;
  };
  features: {
    eyebrow: string;
    title: string;
    items: Array<{ title: string; body: string }>;
  };
  privacy: {
    eyebrow: string;
    title: string;
    body: string;
    linkLabel: string;
    linkHash: string;
  };
  download: {
    eyebrow: string;
    title: string;
    body: string;
    primaryAction: string;
    secondaryAction: string;
    quickStartHash: string;
  };
  faq: {
    eyebrow: string;
    title: string;
    items: Array<{ question: string; answer: string }>;
  };
  changelog: {
    eyebrow: string;
    title: string;
    versions: Array<{
      version: string;
      date: string;
      changes: string[];
    }>;
  };
  footer: {
    releasesLabel: string;
  };
}

export const pageContent: Record<Locale, PageContent> = {
  "zh-CN": {
    title: "GitPulse - 本地优先的 Git 工作报告生成器",
    description:
      "GitPulse 是一款本地优先的 Git 工作报告生成器，把多个仓库里的提交一键整理成日报、周报、自定义区间报告和绩效月报。",
    ogDescription:
      "Local-first Git work reports. Turn scattered commits into daily, weekly, custom and monthly reports.",
    navAriaLabel: "主导航",
    homeAriaLabel: "GitPulse 首页",
    githubLabel: "GitHub",
    languageLabel: "切换语言",
    demoAriaLabel: "GitPulse 操作流程演示",
    nav: [
      { id: "workflow", label: "流程" },
      { id: "features", label: "功能" },
      { id: "privacy", label: "隐私" },
      { id: "download", label: "下载" },
      { id: "changelog", label: "更新日志", href: "/zh-CN/changelog" },
    ],
    hero: {
      eyebrow: "Local-first Git work reports",
      copy:
        "把散落在多个仓库里的提交，一键整理成日报、周报、自定义区间报告和绩效月报。数据全程留在本机，报告可以直接复制或导出交付。",
      primaryAction: "下载最新版本",
      secondaryAction: "查看源码",
      actionsLabel: "主要操作",
      factsLabel: "产品特性摘要",
      facts: [
        { value: "18+", label: "核心功能" },
        { value: "CLI", label: "命令行支持" },
        { value: "0", label: "默认云端依赖" },
      ],
    },
    workflow: {
      eyebrow: "Workflow",
      title: "从 git log 到可交付报告，只保留必要步骤。",
      steps: [
        {
          title: "指向工作区",
          body: "选择一个本地目录，GitPulse 会发现里面的 Git 仓库，并读取本机作者信息。",
        },
        {
          title: "选择报告周期",
          body: "按日报、周报、自定义区间或月份提取提交，支持当前分支或全部分支。",
        },
        {
          title: "生成可交付报告",
          body: "按项目聚合改动，生成 Markdown 报告，也可导出 Word 或 PDF。",
        },
      ],
    },
    demo: {
      eyebrow: "Product view",
      title: "真实桌面工作台，不是浏览器里的玩具界面。",
    },
    features: {
      eyebrow: "Features",
      title: "面向真实开发周报的功能，而不是又一个提交列表。",
      items: [
        { title: "本地优先", body: "扫描、提取、生成都在本机完成，提交记录不会上传到远程服务。" },
        { title: "多仓库聚合", body: "一次扫完整个工作区，把散落在不同项目里的提交按作者和时间汇总。" },
        { title: "代码变更量统计", body: "自动统计每个项目的新增/删除行数，在报告和绩效月报中展示变更量摘要。" },
        { title: "贡献热力图", body: "类似 GitHub 的 52 周活跃度热力图，覆盖所有本地仓库，一目了然。" },
        { title: "工作节奏分析", body: "24 小时提交分布、本周 vs 上周对比、加班比例检测，了解你的工作模式。" },
        { title: "趋势对比面板", body: "提交量折线趋势、项目投入分布，支持按周/月粒度切换，用数据支撑复盘。" },
        { title: "CLI 命令行模式", body: "无 GUI 依赖的 gitpulse-cli，可集成到 cron job、CI pipeline 和飞书机器人。" },
        { title: "IM 格式适配", body: "内置飞书、钉钉、企微、Confluence、纯文本预设，一键复制成目标平台格式。" },
        { title: "项目名映射", body: "把仓库名和分支名映射成业务项目名，报告读起来更像真实交付。" },
        { title: "补充工作事项", body: "把会议、设计、联调和上线支持等非 Git 事实纳入报告与历史。" },
        { title: "可审计 AI 润色", body: "接受前查看原稿与润色稿差异；Codex OAuth 明确标为实验能力，失败时回退本地模板。" },
        { title: "工作区健康", body: "识别不可访问或异常仓库，并支持搜索、批量启停和快速重扫。" },
        { title: "本地历史与项目回顾", body: "带备份恢复的文件化历史，按项目回看报告、提交证据、AI 与导出状态。" },
        { title: "脱敏配置迁移", body: "导入导出可共享配置，不包含 API Key 等敏感凭据。" },
        { title: "报告脱敏", body: "可配置替换规则，对仓库名、分支、作者、commit hash 系统化脱敏后安全分享。" },
        { title: "桌面轻量", body: "Tauri 2 + Rust 打包，启动快，不需要 Python 或额外运行时。" },
      ],
    },
    privacy: {
      eyebrow: "Local-first",
      title: "敏感的 Git 活动，默认不离开你的电脑。",
      body:
        "GitPulse 用 Rust 在本地扫描仓库、读取提交并生成报告。API Key 不应该写进配置文件；AI 润色是可选能力，失败时也会回退到本地报告模板。",
      linkLabel: "查看 AI 润色说明",
      linkHash: "-ai-润色",
    },
    download: {
      eyebrow: "Download",
      title: "安装后，下一次写周报就少翻几个仓库。",
      body: "Windows、macOS 和 Linux 安装包都在 GitHub Releases 中维护。",
      primaryAction: "前往 Releases",
      secondaryAction: "阅读快速开始",
      quickStartHash: "-快速开始",
    },
    faq: {
      eyebrow: "FAQ",
      title: "开始前你可能会问的几件事。",
      items: [
        {
          question: "GitPulse 会上传我的代码或提交记录吗？",
          answer:
            "不会。Git 仓库扫描、提交提取和报告生成默认都在本机完成。只有你主动启用 AI 润色时，报告文本才会发送给你配置的模型服务。",
        },
        {
          question: "支持哪些平台？",
          answer: "Release 页面提供 Windows、macOS 和 Linux 安装包。当前应用内自动更新主要面向 Windows。",
        },
        {
          question: "AI 润色是必须的吗？",
          answer: "不是。GitPulse 可以完全离线生成结构化报告；AI 只负责把报告改写得更像绩效或周报表述。",
        },
        {
          question: "它适合谁？",
          answer: "适合需要从多个本地仓库整理日报、周报、项目复盘或绩效月报的开发者。",
        },
      ],
    },
    changelog: {
      eyebrow: "Changelog",
      title: "版本更新日志",
      versions: [
        {
          version: "0.5.3",
          date: "2026-07-18",
          changes: [
            "支持脱敏配置方案导入导出，并隔离实验性 Codex OAuth",
            "加固弹层键盘操作、焦点管理与 320px / 200% 缩放布局",
            "补齐 a11y、响应式与真实 Windows Tauri WebView smoke 门禁",
          ],
        },
        {
          version: "0.5.2",
          date: "2026-07-16",
          changes: [
            "报告历史迁移到带备份恢复的本地文件存储，并增加项目回顾",
            "新增工作区健康、仓库搜索批量启停和扫描循环保护",
            "支持补充非 Git 工作事项与 AI 润色前后对照",
          ],
        },
        {
          version: "0.4.3",
          date: "2026-07-10",
          changes: [
            "洞察面板全宽视图：热力图、工作节奏、趋势面板移至独立视图",
            "修复暗色模式下视图切换和洞察面板样式",
            "修复平台格式预设下拉框无限箭头问题",
          ],
        },
        {
          version: "0.4.0",
          date: "2026-07-10",
          changes: [
            "代码变更量统计（LOC diff）",
            "工作热力图（52 周活跃度）",
            "工作节奏分析（24h 分布 + 加班检测）",
            "趋势对比面板（折线图 + 项目分布）",
            "CLI 命令行模式（gitpulse-cli）",
            "飞书/钉钉/企微格式适配",
            "报告脱敏与证据链路",
          ],
        },
        {
          version: "0.3.13",
          date: "2026-07-09",
          changes: [
            "启动自动更新提醒",
            "应用出站代理配置",
            "暗色模式界面补齐",
          ],
        },
      ],
    },
    footer: {
      releasesLabel: "Releases",
    },
  },
  en: {
    title: "GitPulse - Local-first Git work report generator",
    description:
      "GitPulse turns commits across local Git repositories into daily, weekly, custom-period, and monthly performance reports without sending data off your machine.",
    ogDescription:
      "Turn scattered commits into daily, weekly, custom-period, and monthly reports with a local-first desktop app.",
    navAriaLabel: "Primary navigation",
    homeAriaLabel: "GitPulse home",
    githubLabel: "GitHub",
    languageLabel: "Switch language",
    demoAriaLabel: "GitPulse workflow demo",
    nav: [
      { id: "workflow", label: "Workflow" },
      { id: "features", label: "Features" },
      { id: "privacy", label: "Privacy" },
      { id: "download", label: "Download" },
      { id: "changelog", label: "Changelog", href: "/en/changelog" },
    ],
    hero: {
      eyebrow: "Local-first Git work reports",
      copy:
        "Turn scattered commits across multiple repositories into daily, weekly, custom-period, and monthly performance reports. Your Git activity stays on your machine, and the report is ready to copy or export.",
      primaryAction: "Download latest",
      secondaryAction: "View source",
      actionsLabel: "Primary actions",
      factsLabel: "Product facts",
      facts: [
        { value: "18+", label: "core features" },
        { value: "CLI", label: "command-line support" },
        { value: "0", label: "default cloud dependency" },
      ],
    },
    workflow: {
      eyebrow: "Workflow",
      title: "From git log to a usable report, with only the steps that matter.",
      steps: [
        {
          title: "Pick a workspace",
          body: "Choose a local folder and GitPulse discovers the Git repositories inside it, including your local Git identity.",
        },
        {
          title: "Choose a period",
          body: "Extract commits for daily, weekly, custom, or monthly reports across the current branch or all branches.",
        },
        {
          title: "Generate the report",
          body: "Group changes by project, preview the Markdown, then copy it or export it as Word or PDF.",
        },
      ],
    },
    demo: {
      eyebrow: "Product view",
      title: "A real desktop workbench, not another browser toy.",
    },
    features: {
      eyebrow: "Features",
      title: "Built for real developer reporting, not just another commit list.",
      items: [
        { title: "Local-first", body: "Scanning, extraction, and report generation run on your machine by default." },
        { title: "Multi-repo aggregation", body: "Scan a whole workspace and collect commits by author and date range in one pass." },
        { title: "LOC diff stats", body: "Automatically count additions/deletions per project and include change summaries in reports." },
        { title: "Contribution heatmap", body: "GitHub-style 52-week activity heatmap covering all local repositories at a glance." },
        { title: "Work rhythm analysis", body: "24-hour commit distribution, week-over-week comparison, and overtime ratio detection." },
        { title: "Trend comparison", body: "Commit trend lines, project investment distribution, with weekly/monthly granularity toggle." },
        { title: "CLI mode", body: "GUI-free gitpulse-cli binary for cron jobs, CI pipelines, and chat-bot integrations." },
        { title: "IM format presets", body: "Built-in templates for Feishu, DingTalk, WeCom, Confluence, and plain text — copy in one click." },
        { title: "Project name mapping", body: "Map repositories and branches to readable business project names for cleaner reports." },
        { title: "Supplemental work items", body: "Include meetings, design, integration, and production support that have no Git commit." },
        { title: "Reviewable AI polishing", body: "Review the original and polished drafts before accepting; Codex OAuth stays explicitly experimental." },
        { title: "Workspace health", body: "Find inaccessible or stale repositories, then search, bulk enable or disable, and rescan." },
        { title: "Local history and project review", body: "File-backed history with recovery, plus project timelines for evidence, AI, and exports." },
        { title: "Redacted config migration", body: "Move shareable settings between machines without API keys or other credentials." },
        { title: "Report redaction", body: "Configurable rules to mask repo names, branches, authors, and commit hashes before sharing." },
        { title: "Light desktop app", body: "Built with Tauri 2 and Rust, with fast startup and no Python runtime dependency." },
      ],
    },
    privacy: {
      eyebrow: "Local-first",
      title: "Sensitive Git activity stays on your computer by default.",
      body:
        "GitPulse scans repositories, reads commits, and renders reports locally with Rust. API keys should not be written into plain config files; AI polishing is optional and falls back to local templates when it fails.",
      linkLabel: "Read the AI polishing notes",
      linkHash: "-ai-润色",
    },
    download: {
      eyebrow: "Download",
      title: "Install it once, spend less time digging through repos next week.",
      body: "Windows, macOS, and Linux installers are published on GitHub Releases.",
      primaryAction: "Open Releases",
      secondaryAction: "Read quick start",
      quickStartHash: "-快速开始",
    },
    faq: {
      eyebrow: "FAQ",
      title: "A few things worth knowing before you start.",
      items: [
        {
          question: "Does GitPulse upload my code or commit history?",
          answer:
            "No. Repository scanning, commit extraction, and report generation run locally by default. If you enable AI polishing, only the report text is sent to the model service you configure.",
        },
        {
          question: "Which platforms are supported?",
          answer: "GitHub Releases provide installers for Windows, macOS, and Linux. In-app auto updates currently focus on Windows.",
        },
        {
          question: "Is AI polishing required?",
          answer: "No. GitPulse can generate structured reports fully offline. AI polishing only rewrites the text into a smoother weekly or performance-report style.",
        },
        {
          question: "Who is this for?",
          answer: "Developers who need to turn local Git activity across multiple repositories into daily reports, weekly updates, project reviews, or monthly performance evidence.",
        },
      ],
    },
    changelog: {
      eyebrow: "Changelog",
      title: "Release Notes",
      versions: [
        {
          version: "0.5.3",
          date: "2026-07-18",
          changes: [
            "Added redacted configuration import/export and isolated experimental Codex OAuth",
            "Hardened keyboard focus, dialogs, 320px layouts, and 200% equivalent zoom",
            "Added accessibility, responsive, and real Windows Tauri WebView CI gates",
          ],
        },
        {
          version: "0.5.2",
          date: "2026-07-16",
          changes: [
            "Moved report history to recoverable local file storage and added project review",
            "Added workspace health, repository bulk controls, and scan loop protection",
            "Added supplemental non-Git work items and reviewable AI polish diffs",
          ],
        },
        {
          version: "0.4.3",
          date: "2026-07-10",
          changes: [
            "Full-width insights view: heatmap, rhythm, and trend panels in a dedicated view",
            "Fixed dark mode styling for view toggle and insights panels",
            "Fixed infinite dropdown arrow in platform format preset selector",
          ],
        },
        {
          version: "0.4.0",
          date: "2026-07-10",
          changes: [
            "LOC diff statistics (lines added/removed)",
            "Contribution heatmap (52-week activity)",
            "Work rhythm analysis (24h distribution + overtime detection)",
            "Trend comparison panel (line charts + project distribution)",
            "CLI mode (gitpulse-cli)",
            "Feishu / DingTalk / WeCom format presets",
            "Report redaction and evidence trail",
          ],
        },
        {
          version: "0.3.13",
          date: "2026-07-09",
          changes: [
            "Auto update check on startup",
            "Outbound proxy configuration",
            "Dark mode UI completion",
          ],
        },
      ],
    },
    footer: {
      releasesLabel: "Releases",
    },
  },
};

export function normalizeLocale(value: string | undefined | null): Locale {
  if (!value) return defaultLocale;
  const normalized = value.toLowerCase();
  return normalized.startsWith("zh") ? "zh-CN" : "en";
}
