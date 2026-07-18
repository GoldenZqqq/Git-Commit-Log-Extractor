# BIZ-23 技术设计

## Target Contexts

- `320×900`：极窄但可纵向滚动的桌面窗口，验证最小宽度。
- `640×450`：典型 1280×900 窗口在 200% 缩放下的等效 CSS 视口，验证主流程。
- `1280×480`：宽而矮的桌面窗口，验证固定桌面工作台与弹层高度。

## Layout Strategy

### Global shell

- 将 `body` 的固定 980px 最小宽度降为 320px。
- 宽屏继续由 `.app-root`/`.workbench` 锁定一屏并让报告内部滚动。
- 在现有 1040px 单列断点下，把根容器切为文档滚动和自动高度；报告画布、洞察/健康视图与辅助栏按自然高度纵向排列。
- 在 720px 以下收紧根内边距、卡片内边距和头部间距，不缩小正文可读字号。

### Workbench controls

- 头部动作允许换行，状态胶囊占据剩余宽度，设置按钮保持可见。
- 报告类型使用等宽四列；周期、生成、批量与补写入口在极窄屏占满可用宽度。
- AI/导出/复制分裂组允许换行并从左侧排列，popover 宽度使用 `min()`/`calc(100vw - padding)` 限制。
- 移除 JSX 中只为桌面间距服务的 `marginLeft` 内联样式，统一交给 flex `gap`。

### Dialogs

- 所有 `range-dialog` 设置 `max-height` 与 `overflow-y: auto`；在窄屏或小高度媒体查询中减少 backdrop/panel padding。
- 窄屏时 header 设为 sticky，保证滚动长表单时关闭按钮留在顶部。
- 设置对话框继续使用三行 grid；窄屏设置导航变成三列两行，内容区域独立滚动，header/footer 不进入滚动区。

## Overflow Contract

- 文档与主要卡片的横向溢出容差为 1px，以覆盖子像素舍入。
- 允许纵向文档滚动和弹层内容滚动；禁止用横向滚动承载主操作。
- 长路径、模型名和状态文本保留已有 ellipsis/overflow-wrap 语义，不通过缩小到不可读字号解决。

## Verification

- 新增 `tests/e2e/responsive-hardening.spec.ts`，复用 Tauri mock。
- 每个 viewport 检查 document/card `scrollWidth`、关键按钮 bounding box、对话框顶部/底部和关闭按钮可视性。
- 640×450 场景真实执行生成、clipboard 复制和设置开关；三个场景写入 `testInfo.outputPath()` 截图。

## Rollback

- 变更仅涉及 CSS、两处内联间距和 Playwright；若断点回归，可按 global shell、workbench controls、dialogs 三组独立回退。
