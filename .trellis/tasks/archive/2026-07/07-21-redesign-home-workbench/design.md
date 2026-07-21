# 首页工作台重构设计

## 1. Feature Summary

将首页从“所有能力同时展示的仪表盘”重构为以报告生成为中心的桌面工作台。用户进入后先看到当前报告类型、周期和仓库范围，在空状态中执行唯一主动作；生成完成后，界面再切换到复制、AI 润色和导出等结果处理动作。

## 2. Primary User Action

用户确认当前周期和仓库范围后，生成一份本地工作报告。空报告阶段只有一个 filled primary action；结果阶段的主动作转为复制报告，重新生成、润色和导出作为次级操作。

## 3. Design Direction

- Color strategy：Restrained。中性表面承担 90% 以上面积，品牌蓝只用于主动作、选中和焦点，琥珀只用于需要处理的真实风险。
- Scene sentence：一名开发者在普通办公室或夜间桌面环境中赶写日报，需要快速确认范围、生成并交付，界面应安静到可以被忽略，同时始终让本地处理和运行状态可信。
- Anchor references：Linear 的层级克制与工具栏密度、GitHub Desktop 的仓库选择熟悉度、Raycast 的紧凑动作语言。
- 移除装饰网格、Hero 渐变和大阴影；保留现有品牌资产、系统字体、8px 以内圆角和浅/深主题。
- 视觉探针未生成：当前 harness 未暴露原生 image generation，且不切换到需要 API Key 的 CLI fallback。

## 4. Scope

- Fidelity：production-ready。
- Breadth：完整首页，包括顶部工作台导航、报告画布、空/结果状态、范围摘要、右侧侧栏和相关响应式行为。
- Interactivity：实际 React/Tauri 组件，不是静态原型；保留现有业务回调和状态管理。
- Time intent：达到可发布质量，完成视觉截图、键盘、响应式和 WebView 验证后再收口。

## 5. Layout Strategy

### App Toolbar

- 将 `WorkbenchHeader` 的大 Hero 改为紧凑工具栏，保留可见的“工作报告工作台”标题以兼容 WebView smoke。
- 左侧：品牌标识、标题、报告/洞察/健康一级导航。
- 右侧：单一运行状态、设置按钮；作者、仓库数、提交数和输出状态不再重复常驻。
- 运行状态空闲时使用“就绪 · 本地处理”，凭据读取等瞬时消息进入 event/message 反馈，不作为长期头部内容。

### Report Workspace

- 两列布局保持桌面固定高度：主画布 `minmax(0, 1fr)`，范围侧栏约 `296-320px`；1040px 以下自然堆叠。
- 报告类型使用单行中文 segmented control，删除 DAILY/WEEKLY/MONTHLY/CUSTOM eyebrow。
- 周期控件与四项范围摘要（周期、作者、仓库、分支）保持可见，但不再使用范围项套卡片。
- 补充事项继续使用折叠区，不与主动作争抢视觉权重。

### Empty And Result States

- 空状态显示动态句子：将为 `{author}` 汇总 `{enabledRepoCount}` 个仓库 `{branchScope}` 在 `{range}` 的提交，并说明“Git 数据仅在本机处理”。
- 空状态承载唯一 filled generate action；批量生成进入 secondary overflow，空白日补写仅在日报生成结果为 0 或对应建议状态出现。
- 有结果时显示报告正文与紧凑结果工具栏：复制为主动作，AI 润色、导出、重新生成为次级动作；全屏预览保留。
- 加载状态在内容区显示进度并使用 `role=status`/`aria-live=polite`，不改变画布尺寸。

### Scope Sidebar

- `WorkbenchAssistRail` 默认成为“本次范围”侧栏，不再用三个同级大 tabs。
- 侧栏头部显示“本次范围”和 `{enabled}/{total}`；最近、交付作为紧凑二级入口，交付只在有报告时启用。
- 搜索常驻；状态筛选收为 filter control；批量启停、添加目录和重扫进入带标签的管理菜单或二级管理区。
- 仓库列表改为分隔行：checkbox/开关明确表达纳入范围，名称与路径是信息，独立 edit icon 打开映射编辑。
- 侧栏在窄屏排到报告画布之后，列表使用自然高度，不产生水平滚动。

## 6. Key States

- Default empty：显示范围摘要、本地隐私说明和唯一生成动作。
- No repositories：主画布与侧栏共同提示添加目录/扫描，生成动作禁用且原因可见。
- All disabled：显示范围为 0、查看已禁用和恢复选择入口。
- Filtering empty：显示清除搜索/查看全部。
- Scanning：显示目录进度、发现数和取消动作。
- Generating：画布固定展示提取进度，侧栏范围不可产生冲突修改。
- Generated：正文与结果工具栏出现，交付入口启用。
- Review pending：保留现有 AI 对照接受/拒绝流程并锁定冲突动作。
- Error/advice：通过现有 event log 与就地空状态动作恢复，不丢失当前范围和报告草稿。

## 7. Interaction Model

- 一级 tabs 与侧栏二级视图支持 Left/Right、Home/End 和 roving tabIndex；Tab 进入当前面板内容。
- 空状态生成后原位置切换为 loading，再切换到结果，避免视线跳转。
- 仓库 checkbox 立即更新范围摘要；edit icon 单独进入映射编辑；管理菜单关闭后恢复触发器焦点。
- 结果动作按内容存在性渲染，不用低透明禁用按钮占位。
- Hover 只提供补充反馈，关键动作和语义不依赖 hover/title。

## 8. Technical Boundaries

- 主要组件：`WorkbenchHeader.tsx`、`ReportCanvas.tsx`、`WorkbenchControls.tsx`、`WorkbenchAssistRail.tsx`、`RepositoryPanel.tsx`、`MarkdownPreview.tsx`，必要时增加局部展示组件。
- 样式：`tokens.css`、`layout.css`、`preview.css`、`theme.css`、`RepositoryPanel.css`；继续使用全局 CSS 与现有 tokens，不引入依赖。
- 保持 `WorkbenchProps` 的业务回调和 Tauri payload 不变；仅在展示需要时增加派生 props/本地 UI state。
- 保留 `工作报告工作台` 可见 heading、现有 role/label 名称或同步更新 Playwright locator。
- 单文件不超过 600 行；新增局部组件只在能降低真实复杂度时创建。

## 9. Compatibility And Rollback

- 不迁移设置或历史数据，不改变本地存储、Rust 命令或版本 schema。
- 现有报告生成、批量、补写、复制、润色、导出、仓库启停和映射入口必须可达。
- 若新侧栏或空状态导致关键路径回归，可按组件分层回退：视觉 tokens → 侧栏结构 → 报告状态编排，业务 hooks 不受影响。

## 10. Recommended Impeccable References

- `distill.md`：减少常驻决策与重复状态。
- `layout.md`：建立工具栏、画布和窄侧栏层级。
- `quieter.md`：收敛网格、阴影、胶囊和强调色。
- `onboard.md`：设计空状态与首次生成路径。
- `clarify.md`：统一仓库范围、管理与结果动作语言。

