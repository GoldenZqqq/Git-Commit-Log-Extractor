# 实施计划

## 1. Regression Contract

- [x] 更新或新增 Playwright 测试，锁定空状态唯一主动作、结果动作按条件出现、范围侧栏默认语义和仓库独立编辑入口。
- [x] 为工作台与侧栏 tabs 增加键盘方向键/roving tabIndex 断言，为生成进度增加 live-region 断言。
- [x] 保留现有生成、批量、空白日补写、复制、润色、导出、扫描、筛选和批量启停测试路径。

## 2. Information Architecture

- [x] 将 `WorkbenchHeader` 重构为紧凑应用工具栏，合并一级导航、运行状态和设置，删除重复统计 chrome。
- [x] 重排 `ReportCanvas`：报告类型/周期与范围摘要在上，空状态承载唯一生成动作，结果动作只在有报告时显示。
- [x] 将批量生成移入次级入口；让空白日补写只在零提交建议路径中出现，同时保持原功能可达。
- [x] 将范围摘要从七个 framed chips 收敛为四项文本信息，风险项按条件显示。

## 3. Scope Sidebar

- [x] 将 `WorkbenchAssistRail` 改为默认“本次范围”侧栏，最近/交付改为紧凑二级入口。
- [x] 重构 `RepositoryPanel` 头部、搜索、筛选和管理动作，减少常驻按钮。
- [x] 将仓库卡片改为分隔列表，明确选择控件与独立映射编辑按钮；保留禁用、空、扫描和筛选状态。

## 4. Visual System

- [x] 调整 `tokens.css`：移除装饰网格，建立纯色背景和两级中性表面。
- [x] 调整工作台样式：移除 Hero 营销构图、大阴影、重复嵌套边框和英文 eyebrow。
- [x] 统一按钮层级、目标尺寸、焦点、浅/深主题和 reduced-motion 行为。
- [x] 保证 1040px 以下堆叠，320x900、640x450、1280x480 无水平溢出或遮挡。

## 5. Validation

- [x] `npm run build`。
- [x] `npm run test:e2e:a11y`、`npm run test:e2e:responsive` 和定向 workbench/repository/task-state 测试。
- [x] `npm run test:e2e` 全量通过（80/80）。
- [x] `npm run build:tauri:smoke` 与 `cargo check`、`cargo test` 通过。
- [x] `git diff --check`；确认无新增依赖、无 Tauri payload 变化。
- [x] 启动本地页面并用 Playwright 截取浅/深桌面、320px、640x450、1280x480；检查非空像素、边界、重叠和交互可达性。
- [x] 对照 Impeccable critique 复评 P1/P2 项。
- [ ] 真实 Windows WebView smoke：匹配驱动和 debug 应用均成功启动，但 WebDriver session 在默认与隔离 profile 下仍超时；正式安装版仍在运行，需关闭后完成最后一次环境隔离复跑。

## Rollback Points

- 工作台主路径测试失败：停止视觉扩展，先恢复空/结果状态行为兼容。
- 仓库启停或映射行为回归：保留旧事件回调，回退侧栏展示层，不修改业务 hooks。
- 窄窗口或暗色 WebView 出现溢出/原生控件异常：按 frontend quality spec 修复，不放宽测试断言。
