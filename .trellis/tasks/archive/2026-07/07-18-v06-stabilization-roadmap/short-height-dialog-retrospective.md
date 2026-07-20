# Bug Analysis: 短窗口支持包弹层溢出

## 1. Root Cause Category

- **Category**：E - Implicit Assumption，伴随 D - Test Coverage Gap。
- **Specific Cause**：支持包弹层是 backdrop grid 的子项。前一次修复假设 `height/max-height + overflow-y` 会稳定压缩 border box，但没有设置 `min-height: 0`，自动 min-content 尺寸在 Linux Chromium 的字体/布局结果下把底部推出 480px 视口。

## 2. Why Fixes Failed

1. `1b15d6b` 只增加 `100vh` 高度和最大高度，处理了表面边界，没有解除 grid item 的自动最小高度。
2. 当时 exact-SHA CI 通过证明该环境的一次布局结果可用，但没有证明不同 Chromium/字体时序下的 min-content 尺寸始终可收缩。
3. 父审计 CI 首次失败后只重跑 job；第二次仍以约 514px 的稳定结果失败，排除了偶发启动抖动并确认是布局契约缺口。

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
| --- | --- | --- | --- |
| P0 | Architecture | 短窗口 grid/flex 弹层显式使用 `min-height: 0`、`100dvh` 和内部滚动 | DONE |
| P0 | Test Coverage | 保留 `1280x480` border-box、关闭按钮和滚动断言 | DONE |
| P0 | Documentation | 更新 desktop quality gate 与 responsive layout contract | DONE |
| P1 | Debug Evidence | CI 失败时保留 screenshot、trace 和实际 bounding box，不用放宽阈值掩盖溢出 | DONE |

## 4. Systematic Expansion

- **Similar Issues**：任何作为 grid/flex 子项、只声明 `max-height/overflow` 的长弹层都可能有同类问题。
- **Design Improvement**：未来新增弹层应从共享 `.range-dialog` 契约继承视口边界，并在内容复杂时显式声明可收缩尺寸。
- **Process Improvement**：响应式失败先查看截图和实际 bounding box；同一几何结果连续出现时按真实缺陷处理，不无限重跑。

## 5. Knowledge Capture

- [x] 更新 `.trellis/spec/frontend/desktop-quality-gates.md`。
- [x] 更新 `.trellis/spec/frontend/quality-guidelines.md`。
- [x] 使用现有 `responsive-hardening.spec.ts` 防止回归。
- [x] 项目没有 `src/templates/markdown/spec/` 镜像源，无额外模板可同步。
