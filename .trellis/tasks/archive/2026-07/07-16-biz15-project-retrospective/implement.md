# BIZ-15 实施计划

## 1. 测试先行：Rust 结构化项目归属

- [x] 在新模块测试多项目分组、项目级提交计数、证据顺序/去重、20 条上限和七字符短哈希。
- [x] 在报告层测试精确映射优先、通配映射、末尾连接符回退以及脱敏项目名/`commit-N`。
- [x] 为 `ExtractResult`、`PeriodReportResult` 和报告历史序列化补契约断言，先观察新增字段缺失导致的失败。

## 2. 实现 Rust 契约与生成链路

- [x] 新增 `src-tauri/src/project_retrospective.rs`，定义 `ReportHistoryProject` 和聚合函数。
- [x] 在 `lib.rs` 注册模块，在 `models.rs` 的两类生成结果中增加 `projects`。
- [x] 在 `report.rs` 复用 `prepare_report_input`、既有项目映射和短证据规则构造归属。
- [x] 在 `commit_pipeline.rs` 的日报/自定义、周报/月报返回路径填充 `projects`。
- [x] 在 `report_history.rs` 增加可选字段及兼容性/往返测试。
- [x] 运行 `cargo fmt -- --check`、定向 `cargo test project_retrospective` 和相关报告/历史测试。

## 3. 测试先行：前端派生与集成

- [x] 扩展 Playwright Tauri mock 的结果和历史工厂，支持 `projects`。
- [x] 新增项目回顾 E2E，先覆盖无历史、单项目、多项目、项目级统计、打开原报告和时间筛选。
- [x] 补旧历史/空白日 `未归类历史`、空项目新报告、AI/导出状态和 AI 润色归属保留用例。
- [x] 补脱敏生成结果的跨层断言，确保历史不出现原项目名和原哈希。

## 4. 实现前端模型与界面

- [x] 在 `model.ts` 增加项目类型、结果/历史/润色字段及运行时守卫。
- [x] 新增 `projectRetrospective.ts` 纯派生函数，集中时间范围、合并、排序和汇总规则。
- [x] 修改 `App.tsx`，在四种生成历史与 AI 润色接受路径保存项目快照。
- [x] 新增 `ProjectRetrospective.tsx` 和样式，接入 `InsightsView` 的日历与底部洞察之间。
- [x] 完成无历史、未归类、无范围结果状态以及控件可访问名称。

## 5. 定向验证与视觉检查

- [x] 运行 `npm run build`。
- [x] 运行项目回顾、AI 润色、报告历史相关 Playwright 用例。
- [x] 启动开发服务器，用 Playwright 截图检查浅色/深色、桌面/窄视口；确认无溢出、重叠和不可读文本。
- [x] 检查控制台错误和 Tauri mock 调用结果。

## 6. 完整质量门禁

- [x] `cargo fmt -- --check`
- [x] `cargo check`
- [x] `cargo test`
- [x] `cargo clippy --all-targets --all-features -- -D warnings`；仅命中已记录的存量 lint，并以精确 allow 列表验证本任务无新增 warning。
- [x] `npm run build`
- [x] `npm run test:e2e`
- [x] `git diff --check`
- [x] 复核 `git status --short`，确认没有无关改动、生成物或根配置变化。

## 7. 规范、归档与提交

- [x] 使用 `trellis-check` 执行规格符合性与跨层数据流审查。
- [x] 使用 `trellis-update-spec` 将结构化项目归属与前端派生契约写入 `.trellis/spec/`。
- [x] 更新父路线图 BIZ-15 状态与完成计数。
- [x] 使用 `task.py archive ... --no-commit` 归档子任务。
- [x] 创建一个仅包含 BIZ-15 的本地 Conventional Commit；按后续用户授权与下一轻量任务一起通过 checkpoint 验证后推送。

## 风险文件与回滚点

- `src-tauri/src/report.rs`、`models.rs`、`commit_pipeline.rs` 已接近或超过项目文件上限；新逻辑必须放入聚焦模块，现有文件只做最小接线。
- `ReportHistoryEntry` 是 Rust/TypeScript/Playwright mock 的共享契约，任一侧遗漏会造成加载或测试假通过；每次契约编辑后先运行定向构建。
- 脱敏必须在聚合前发生；任何从原始 commits 聚合后再替换文本的做法都应回滚。
- AI 接受会创建新历史条目；若项目快照未随 review 传递，应先修复归属保留再继续 UI 工作。
- 不修改 BIZ-26 存储版本、根依赖、CI、路由或应用入口结构；出现需要这些变更的情况先回到规划阶段。
