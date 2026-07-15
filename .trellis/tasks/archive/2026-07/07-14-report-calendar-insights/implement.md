# 报告日历 — 实现清单

## Done

- [x] `reportHistoryLimit` 设置（30/60/120/200，默认 120）
- [x] 设置「清空全部历史」
- [x] 动态 limit 的 load/save/remember/update
- [x] `ReportCalendar` 月历（周一起始、图例、落点）
- [x] 洞察热力图正下方接入
- [x] 有报告：单条直开 / 多条列表
- [x] 空日：生成日报 / 空白日补写
- [x] 明暗色样式

## Validation

```powershell
npm run build
npm run test:e2e
Set-Location src-tauri
cargo check
cargo test
```

2026-07-15 收口复验：前端构建通过；Playwright 18/20 在并行冷编译下通过，2 条 onboarding 超时项随后单独重跑 3/3 通过；Rust `cargo check` 及 99 项测试全部通过。

## Manual checks

- [x] 设置 → 通用 → 改保留条数并确认历史被裁剪
- [x] 洞察 → 报告日历月份切换与落点
- [x] 空日快捷生成日报 / 补写
- [x] 点击历史条目打开工作台
