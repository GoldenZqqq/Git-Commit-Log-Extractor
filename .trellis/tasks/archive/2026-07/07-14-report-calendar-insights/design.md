# 报告日历 — 技术设计草案

## Architecture

```
Workbench (insights view)
  → InsightsView
       → ContributionHeatmap（已有：提交活跃）
       → ReportCalendar（新增：报告产出）  ← 热力图正下方
       → WorkRhythm + Trend（已有 bottom-grid）
```

数据流：

```
localStorage reportHistory
  → App state reportHistory
  → InsightsView / ReportCalendar
  → 用户点击有报告 entry
  → onOpenHistory(entry) → 已有 openReportHistory
  → 用户点击空日
  → onGenerateDaily(date) / onOpenBlankDayFill(date)
  → App 现有 extractCommits / setBlankDayOpen + 目标日
```

无新 Tauri command。

## Components

| 文件 | 职责 |
|------|------|
| `src/components/ReportCalendar.tsx` | 月历 UI、月份切换、落点、多条选择 popover |
| `src/components/ReportCalendar.css` 或 `InsightsView.css` 扩展 | 布局与暗色 |
| `src/components/InsightsView.tsx` | 挂载区块、透传 props |
| `src/components/Workbench.tsx` | 向 InsightsView 传入 history + open/generate/blankDay callbacks |
| `src/model.ts` | `REPORT_HISTORY_LIMIT` 调整；可选 `getReportCalendarAnchorDate(entry)`、`isBlankDayHistoryEntry` 抽公共 |

## Anchor Day Rules

```ts
function getReportCalendarAnchorDate(entry: ReportHistoryEntry): string {
  if (entry.mode === "summary") return entry.range.startDate; // 日报/补写
  // weekly / monthly / custom
  return entry.range.endDate || entry.range.startDate;
}
```

补写仍为 `mode: "summary"`，靠 title/periodLabel 区分样式。

## Aggregation

```ts
Map<string /* YYYY-MM-DD */, ReportHistoryEntry[]>
```

同日多条按 `generatedAt` 降序。

## History Limit & Settings

### Settings model

```ts
// AppSettings
reportHistoryLimit: 30 | 60 | 120 | 200; // default 120
```

- 持久化：随现有 `settings` localStorage 方案
- UI：`SettingsDialog` →「报告历史」或扩展「报告与历史」
  - `<select>`：30 / 60 / 120 / 200
  - 按钮「清空全部历史」→ `window.confirm` → `clearReportHistory` + 清空 React state

### Read/Write

- 废弃「仅模块内写死 30」的单一真相；改为：
  - `DEFAULT_REPORT_HISTORY_LIMIT = 120`
  - `normalizeReportHistoryLimit(value) => 30|60|120|200`
  - `loadReportHistory(limit?)` / `saveReportHistory(entries, limit?)` 使用当前设置
- App 在 `settings.reportHistoryLimit` 变化时：
  1. `setReportHistory(saveReportHistory(current, limit))` 立即裁剪
  2. 持久化 settings

### Clear

- 工作台「清空」与设置「清空」调用同一 `clearHistoryRecords` 路径，避免双源。

## Layout Order

1. Insights header + refresh
2. ContributionHeatmap
3. **ReportCalendar**（通栏）
4. bottom-grid：WorkRhythm | Trend

## Empty Day Actions

Props（草案）：

```ts
onOpenHistory: (entry: ReportHistoryEntry) => void;
onGenerateDaily: (date: string) => void;      // YYYY-MM-DD
onOpenBlankDayFill: (date: string) => void; // 预填目标日
aiConfigured: boolean;
isBusy: boolean;
```

- 空日 popover / 底部 action sheet 二选一：MVP 用与多条历史相同的轻量 popover 样式
- `onGenerateDaily`：App 内 `setDailyDate(date); extractCommits(date);` 并可切回报告视图
- `onOpenBlankDayFill`：`setDailyDate(date); setBlankDayOpen(true);`（弹窗已用 targetDate=dailyDate）

## Week Start

- `weekStartsOn = 1`（周一 = 1，与常见 date-fns 语义一致；自研网格时周一为第一列）
- 不读系统 locale；不在 MVP 设置中暴露切换

## UI States

1. Loading：不必，历史已在内存
2. Empty：无 entries
3. Month with dots
4. Day popover when `entries.length > 1`
5. Dark theme tokens 与 insights 卡片一致

## Risks

| 风险 | 缓解 |
|------|------|
| 历史太少月历空 | 提上限 + 空态文案 |
| 周报落点不直观 | 图例说明 |
| Insights 页变长 | 日历默认折叠？MVP 展开，过长再加折叠 |

## Implementation Order（预告）

1. model：`reportHistoryLimit` 设置字段 + normalize + load/save 使用动态 limit
2. SettingsDialog：保留条数 + 清空
3. App：limit 变更裁剪、清空回调统一
4. ReportCalendar 纯展示 + anchor helper
5. InsightsView / Workbench 接入
6. 明暗色与 AC 手工验收

## Open for design freeze

见 `prd.md`：Open Questions 已全部关闭，规划可进入 implement.md 细化或 `task.py start`。
