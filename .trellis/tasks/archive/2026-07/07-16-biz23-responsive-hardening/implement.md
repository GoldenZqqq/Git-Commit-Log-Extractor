# BIZ-23 实施计划

1. 调整全局最小宽度与 1040px 以下滚动模型，保留宽屏固定高度双栏。
2. 加固 720px/360px 工作台头部、视图标签、报告工具栏、主次动作、辅助栏和 popover 宽度；移除按钮内联左边距。
3. 为设置与 `range-dialog` 增加窄屏/小高度布局、滚动边界和 sticky 关闭头部。
4. 新增 320×900、640×450、1280×480 Playwright 场景，执行 overflow/bounding-box/主路径断言并输出截图。
5. 执行 `npm run build`、响应式专用测试和完整 `npm run test:e2e`；用 `trellis-check` 审核桌面宽屏回归。
6. 同步前端响应式规范、归档任务并创建独立提交 `feat: 加固窄屏与高缩放布局`。

## Risk Files

- `src/styles/tokens.css`：全局 `body` 宽度和 overflow 影响所有表面。
- `src/styles/layout.css`：固定高度工作台与单列文档流的切换边界。
- `src/styles/preview.css`：多个分裂按钮与绝对定位 popover。
- `src/styles/dialogs.css`：设置、批量、补写和确认弹层共享规则。

## Validation Commands

```powershell
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
npm run build
npx playwright test tests/e2e/responsive-hardening.spec.ts
npm run test:e2e
```
