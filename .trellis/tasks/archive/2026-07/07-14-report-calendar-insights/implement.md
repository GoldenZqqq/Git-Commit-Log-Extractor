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
npx tsc --noEmit
```

## Manual checks

1. 设置 → 通用 → 改保留条数并确认历史被裁剪
2. 洞察 → 报告日历月份切换与落点
3. 空日快捷生成日报 / 补写
4. 点击历史条目打开工作台

## Archive Verification (2026-07-18)

- [x] `npm run build`
- [x] `npm run test:e2e`（20 passed）
- [x] GitHub Actions CI `29405253090`：Windows / Linux 的前端 E2E、前端构建、`cargo check`、`cargo test` 全部通过
- [x] 对照 PRD 复核历史上限、清空历史、月历落点、单条/多条打开、空日快捷操作与明暗色样式
