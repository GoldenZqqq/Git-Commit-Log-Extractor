# BIZ-12 AI 润色对照与事实提示 — 技术设计

## State and Data Flow

`App.tsx` 新增内存态 `ReportPolishReview | null`：

```ts
type ReportPolishReview = {
  mode: PreviewMode;
  range: DateRange;
  periodLabel: string;
  originalText: string;
  polishedText: string;
  warnings: string[];
  repoCount: number;
  commitCount: number;
  projectCount: number;
  supplementalItems: string[];
};
```

```text
当前报告快照
  → enhance_report（BIZ-22 polish task）
  → 失败：保留原稿 + 显示 warning
  → 成功：ReportPolishReview（不改预览/历史/文件）
      → 保留原稿 / Esc：丢弃 review
      → 接受：可选写文件 → 更新原模式预览 → 写历史 → 清除 review
```

对照未决时禁用生成、再次润色、导出、周期与报告类型切换，避免快照和当前报告分叉。设置入口、对照滚动与两个决策按钮保持可用。

## Local Diff Engine

新增 `src/reportDiff.ts`，输出统一行序列：

```ts
type ReportDiffLine = {
  kind: "unchanged" | "added" | "removed";
  text: string;
  oldLine?: number;
  newLine?: number;
};
```

- 统一 `CRLF/LF` 后按行比较。
- 常规报告用 LCS 生成稳定的行级增删序列；连续 removed + added 即为改写，不伪造字符级精度。
- 当 `oldLines * newLines` 超过 200,000 单元时，不构建矩阵：保留公共前缀/后缀，中间分别标为删除和新增。
- 相同文本全部标为 `unchanged`；空行也保留，保证用户能对照 Markdown 结构。

## Fact-Risk Heuristics

只扫描 diff 中的新增/删除行：

1. **新增指标**：新增行出现原稿不存在的百分比、倍数、金额、用户数、时长等明确量化 token。
2. **强结论**：新增行出现原稿未包含的“验收通过、正式上线、零故障、显著提升、业务增长”等结论词。
3. **证据删除**：删除行包含 `来源：`、commit 证据或 `用户补充事项（非 Git）` 标记。

结果最多展示 8 条并去重。UI 固定展示：“以下为启发式风险提示，不等于事实错误，请结合提交证据与实际情况核对。”提示不改变润色文本。

## UI

新增 `ReportPolishReviewPanel`，在现有 `preview-shell` 内替换普通 Markdown 预览：

- 顶部粘性工具条：改动统计、风险数、“保留原稿”“接受润色”。
- 双栏原稿/润色稿纯文本快照，保留 Markdown 原貌。
- 下方统一 diff，使用 `+ / − / 空格`、行号与语义色区分新增/删除/未变。
- 区域出现时聚焦自身标题，`Esc` 调用保留原稿；按钮顺序先安全操作、后主操作。
- 使用现有 token，浅色/深色均保持工作台密度，不引入新弹层或装饰性动画。

## Acceptance Semantics

- AI 请求成功但用户未决：当前 `previewText`、history localStorage 和输出文件都不变。
- 接受：使用 review 捕获的 mode/range/repoCount/commitCount/projectCount/supplementalItems，避免扫描或设置变化污染原稿快照；保存失败时保留 review 供重试。
- 放弃：仅清除 review 并显示“已保留原稿”，不新增历史。
- AI 失败：不创建 review，现有失败 warning 与本地草稿回退保持不变。

## Tests

- 纯 diff 逻辑通过 Playwright 可见输出覆盖新增/删除/未变、风险提示与大报告降级。
- 接受路径断言：确认前无 save/history/preview mutation，确认后一次性更新。
- 放弃路径断言：原稿和历史不变，无 save。
- 失败路径断言：不出现对照面板，原稿可见且 warning 保留。
- 键盘 `Esc`、浅色/深色对照态做自动化或截图核验。

## Rollback

移除 review state、diff helper、面板与样式，恢复成功后直接应用 AI 结果的旧逻辑；Rust 与持久化 schema 无需回滚。
