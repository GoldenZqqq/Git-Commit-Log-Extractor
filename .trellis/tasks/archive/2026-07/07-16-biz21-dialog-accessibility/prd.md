# BIZ-21 加固弹层菜单可访问性

## Goal

让 GitPulse 的主要模态弹层和分裂菜单可仅用键盘可靠操作，并统一关闭、焦点进入和焦点回收行为。

## Background

- 设置、批量生成、空白日补写、自定义周期、月报周期和仓库映射均使用自定义 `role="dialog"` 容器，但没有统一的焦点圈定与回焦机制（`src/components/SettingsDialog.tsx:497`、`src/components/BatchDialog.tsx:197`、`src/components/BlankDayFillDialog.tsx:224`、`src/components/CustomRangeDialog.tsx:26`、`src/components/MonthReportDialog.tsx:27`、`src/components/RepoMappingDialog.tsx:41`）。
- 仓库映射只有独立 Escape 监听；其他模态弹层主要依赖鼠标点击遮罩关闭（`src/components/RepoMappingDialog.tsx:27`）。
- 工作台的 AI、导出、复制分裂入口只有全局 Escape 关闭，缺少外部点击、方向键与触发按钮回焦（`src/components/Workbench.tsx:265`、`src/components/Workbench.tsx:525`）。
- 设置中的模型列表已有 combobox/listbox 语义和外部点击，但没有一致的键盘导航与回焦（`src/components/SettingsDialog.tsx:186`、`src/components/SettingsDialog.tsx:789`）。

## Requirements

- R1：建立共享模态焦点行为，支持打开后聚焦首个可操作控件、Tab/Shift+Tab 圈定、Escape 关闭和关闭后回到原触发控件。
- R2：共享模态行为必须识别最上层弹层，避免设置内二次确认弹层按一次 Escape 时同时关闭父子两层。
- R3：关闭被业务状态禁止时（例如批量生成或空白日补写正在运行），Escape 和遮罩点击不得绕过现有限制。
- R4：建立共享非模态 popover/menu 行为，支持外部点击、Escape、关闭后回焦；菜单同时支持 ArrowUp、ArrowDown、Home、End。
- R5：AI 额外要求弹层、导出菜单、复制格式菜单和模型 listbox 使用共享行为，并保持现有业务动作不变。
- R6：主要弹层、菜单项、图标按钮、错误提示和动态状态保留或补齐可访问名称与语义。
- R7：使用 Playwright 覆盖键盘路径，并用 `@axe-core/playwright` 扫描严重级及以上违规。

## Acceptance Criteria

- [x] AC1：设置、批量、补写、自定义周期、月报周期和仓库映射弹层打开后焦点进入，Tab 不逃逸，Escape 可按业务许可关闭，关闭后焦点回到触发按钮。
- [x] AC2：设置内删除确认仅操作最上层弹层，关闭确认后焦点仍留在设置内。
- [x] AC3：AI 额外要求、导出和复制分裂入口支持 Escape、外部点击与焦点回收；导出和复制菜单支持 ArrowUp、ArrowDown、Home、End。
- [x] AC4：模型 listbox 支持 Escape、外部点击和方向键导航，不破坏手动输入模型名。
- [x] AC5：主要弹层通过自动化 axe 扫描且无 `serious` 或 `critical` 违规。
- [x] AC6：Playwright 覆盖焦点进入、Tab 圈定、Escape、方向键和关闭后回焦，前端构建通过。

## Out of Scope

- 不替换现有自定义弹层为第三方组件库。
- 不重做设置导航、工作台布局或视觉风格。
- 不改变生成、导出、复制、AI 润色和配置保存的业务语义。
