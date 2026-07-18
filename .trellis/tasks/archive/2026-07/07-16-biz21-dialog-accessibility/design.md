# BIZ-21 技术设计

## Architecture

在 `src/hooks/` 增加两个局部基础能力：

1. `useModalDialog`：由组件传入 `open`、`onClose` 和 `closeEnabled`，返回容器 ref。hook 记录打开前的 `document.activeElement`，在弹层挂载后聚焦首个可操作控件，捕获 Tab/Escape，并在关闭或卸载时回焦。
2. `usePopover`：由组件传入触发器 ref、浮层 ref、打开状态、关闭回调和可选菜单选择器。hook 统一处理外部点击、Escape、Tab 离开关闭、方向键/Home/End 导航和回焦。

组件仍负责自己的 open state 与业务动作，hook 不接管业务数据。

## Focus Contract

- 可聚焦元素统一通过共享选择器查找，并排除 disabled、`aria-hidden="true"` 与负 tabindex 元素。
- 模态弹层优先聚焦 `[data-dialog-initial-focus]` 或原生 `autofocus`，否则聚焦首个可操作控件；容器保留 `tabIndex={-1}` 作为兜底。
- 文档中存在多个模态层时，仅 DOM 顺序最靠后的可见模态处理 Tab/Escape。
- hook 在 `open: false` 或卸载时把焦点交还给打开前仍连接在 DOM 中的元素。
- `closeEnabled: false` 时继续圈定焦点，但忽略 Escape；从而保留批量生成/AI 生成期间不可关闭的现有约束。

## Popover Contract

- 触发按钮设置 `aria-haspopup`、`aria-expanded` 和稳定 `aria-controls`。
- 普通 AI 要求浮层按非模态 dialog 处理：打开时聚焦 textarea，Escape/外部点击关闭并回焦。
- 导出、复制菜单和模型 listbox传入各自 item selector；ArrowDown/ArrowUp 循环移动，Home/End 跳到首尾。
- Tab 不被圈定；离开浮层时关闭，保持非模态菜单的标准行为。

## Testing

- 新增独立 Playwright 可访问性用例，复用现有 Tauri mock。
- 使用 `@axe-core/playwright` 对工作台、设置与至少一个次级弹层扫描 `serious`、`critical` 违规。
- 对设置和工作台菜单做可观测焦点断言，避免只验证 DOM 可见性。

## Compatibility and Rollback

- 不新增运行时依赖；`@axe-core/playwright` 仅为 devDependency。
- 若共享 hook 引发回归，可逐组件移除 hook，业务状态和 JSX 结构不需要迁移。
