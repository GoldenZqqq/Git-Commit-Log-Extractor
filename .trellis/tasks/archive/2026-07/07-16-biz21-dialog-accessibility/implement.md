# BIZ-21 实施计划

1. 新增共享焦点工具与 `useModalDialog`、`usePopover`，先覆盖顶层识别、Tab 圈定、Escape、外部点击和回焦。
2. 将设置、批量、补写、自定义周期、月报周期、仓库映射及设置内确认弹层接入 `useModalDialog`，保留运行中不可关闭约束。
3. 将工作台 AI 要求、导出、复制浮层和设置模型 listbox 接入 `usePopover`，补齐触发器/浮层关联语义。
4. 新增 `@axe-core/playwright` 开发依赖和 Playwright 用例，覆盖焦点、Tab、Escape、方向键、外部点击、回焦和严重级 axe 扫描。
5. 执行 `npm run build` 与 BIZ-21 定向 Playwright；失败时仅回滚本任务相关 hook、组件、测试和依赖变更。
6. 使用 `trellis-check` 完成规范、复用、数据流与全量相关回归检查；同步前端规范、归档任务并创建独立提交。

## Risk Files

- `src/components/SettingsDialog.tsx`：包含嵌套确认弹层与模型 listbox，必须验证最上层处理。
- `src/components/Workbench.tsx`：三个相邻浮层共享区域，必须确保一次只打开一个且焦点不串位。
- `package.json` / `package-lock.json`：仅允许新增 axe 测试依赖，不更新无关包。

## Validation Commands

```powershell
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
npm run build
npx playwright test tests/e2e/accessibility.spec.ts tests/e2e/workbench.spec.ts
```
