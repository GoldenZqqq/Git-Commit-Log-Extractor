# BIZ-15 技术设计

## 1. 边界

项目回顾由两部分组成：Rust 报告生成链路负责产生可信的结构化项目归属，React 前端负责从已加载的报告历史派生项目列表、汇总和时间线。报告历史文件仍是唯一持久化来源，项目回顾不调用 Tauri 命令、不扫描 Git、不解析 Markdown。

## 2. 数据契约

新增跨层结构：

```rust
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportHistoryProject {
    pub name: String,
    pub commit_count: u64,
    pub evidence_ids: Vec<String>,
}
```

```ts
export type ReportHistoryProject = {
  name: string;
  commitCount: number;
  evidenceIds: string[];
};
```

`ExtractResult` 和 `PeriodReportResult` 增加必有的 `projects`；`ReportHistoryEntry` 和 `ReportPolishReview` 增加可选的 `projects`。结果对象由当前生成过程构造，历史字段可选以兼容 BIZ-26 版本 1 文件和旧 localStorage 数据。

Rust 新建 `project_retrospective.rs`，拥有结构类型、稳定分组、证据去重/截断和短证据编号逻辑。项目展示名仍由 `report.rs` 的既有映射解析函数提供，聚合器通过回调消费该名称，避免复制精确/通配/连接符规则。`report.rs` 提供一个脱敏感知的入口：先复用 `prepare_report_input`，再对准备后的提交和项目映射聚合。

## 3. 生成数据流

```text
collect_commits
  -> report::prepare_report_input（按需脱敏）
  -> report::build_report_history_projects
  -> ExtractResult.projects / PeriodReportResult.projects
  -> App.buildHistoryEntry
  -> ReportHistoryEntry.projects
  -> BIZ-26 文件存储
```

- 非脱敏：项目名采用精确映射 `repo(branch)`，再尝试通配映射 `repo(*)`，清理末尾连接符；无映射时回退为 `repo(branch)`。
- 脱敏：`prepare_report_input` 将仓库、分支和哈希替换为稳定别名并清空原映射；聚合结果只包含别名项目和 `commit-N`。
- 每个项目对全部提交计数，证据 ID 保持提交出现顺序、去重并截断到 20 个。
- 四种报告共用同一结构化结果，不在前端从 `commits` 重新实现规则。

## 4. AI 润色归属

`polishReport` 从当前活动历史复制 `projects` 到 `ReportPolishReview`。接受润色时，新历史条目携带这份不可变快照；AI 只改变正文，不改变项目归属。若当前预览并非来自结构化历史，`projects` 保持缺失并按旧历史规则进入 `未归类历史`。

## 5. 前端派生模型

新增 `src/projectRetrospective.ts`，提供不依赖 React 的纯函数：

- 校验/规范化历史项目项，忽略名称为空或数值非法的项目项。
- 对 `projects === undefined` 构造 `未归类历史` 虚拟项目；对 `projects: []` 不构造归属。
- 用 `getReportCalendarAnchorDate` 作为时间筛选日期，并允许注入“今天”以便确定性测试。
- 将同一历史项展开为一个或多个项目时间线项；同一项目在单份历史中若重复则合并提交数和证据编号。
- 计算报告数、项目提交总数、已导出报告数和全范围去重证据数。
- 项目列表按最近出现日期倒序，再按中文展示名排序；时间线按锚点日期、生成时间倒序。

`ProjectRetrospective.tsx` 只负责选择状态和呈现。项目选择在历史变化后若仍存在则保持，否则回落到第一个项目。时间筛选使用 30/90/180/全部的原生 `select`，避免为四个选项引入额外交互复杂度。

## 6. 视图布局

在 `InsightsView` 的报告日历后插入全宽区域：

```text
项目回顾标题 | 项目选择 | 时间范围
报告数 | 项目提交 | 已导出 | 证据
时间线：类型/周期 | 项目统计与状态 | 证据 | 打开
```

布局使用现有 `--paper`、`--paper-soft`、`--line`、`--ink` 等主题变量，控件圆角不超过既有 `--radius-sm`。窄视口下控件和摘要换行，时间线切换为单列；证据使用 `overflow-wrap: anywhere`。打开动作使用 Lucide `ExternalLink` 图标并提供文字与可访问名称。

## 7. 兼容、失败与回滚

- `ReportHistoryEntry.projects` 使用 Serde 默认值和 `skip_serializing_if`，旧版本 1 envelope 无需提升存储版本。
- TypeScript 的历史守卫接受字段缺失；字段存在时必须是合法结构数组。损坏的结构字段继续沿用 BIZ-26 的隔离/警告路径。
- 旧历史不会被原地改写，回滚本功能后原文件仍可由旧代码读取，因为新增字段会被 Serde 默认忽略。
- 若聚合逻辑或 UI 验证失败，可移除结果/历史可选字段和洞察组件，不影响已有报告正文与历史存储。

## 8. 关键权衡

- 选择生成时保存结构化归属，而非解析 Markdown：增加少量历史数据，但身份稳定且覆盖自定义模板、作者分组和脱敏。
- 选择每项目 20 个证据上限：历史文件体积受控，同时保留准确提交总数和足够追溯线索。
- 选择旧历史统一归类，不做启发式恢复：信息较粗，但行为可预测且不会错误归属。
- 选择洞察页内联全宽区域，不新增路由/弹层：复用现有工作流，降低导航和状态同步成本。
