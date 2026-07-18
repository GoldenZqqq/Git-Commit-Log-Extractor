# BIZ-11 补充非 Git 工作事项 — 技术设计

## Architecture

补充事项是“用户明确提供的当前报告事实”，不是 Git commit，也不是全局设置。数据流为：

```text
Workbench inline editor
  → App 按 mode + period 保存临时草稿
  → buildExtractOptions / buildPeriodReportOptions
  → ExtractOptions / PeriodReportOptions.supplementalItems
  → Rust 报告渲染后追加标准化「用户补充事项（非 Git）」区块
  → 可选 AI 润色（明确要求保留用户事实，不推导额外结果）
  → ReportHistoryEntry.supplementalItems
```

批量报告不接入本功能：一个批次包含多个周期，无法把同一组手工事实安全归属到每个周期。

## Frontend State

- 新增独立模块 `src/supplementalItems.ts`，负责限制、文本解析、展示计数和 period draft key。
- App 用 `Record<string, string>` 保存会话内草稿，key 由 `PreviewMode + DateRange` 组成。切换模式或周期不会把事项带到错误周期，也不会丢失用户刚才在其他周期写的草稿。
- `ReportHistoryEntry.supplementalItems?: string[]` 保持旧历史兼容；新历史总是写入数组。
- 打开历史时恢复对应周期草稿；重新生成时把历史中的事项作为显式 override 传给生成函数，避免 React state 异步造成旧值。

## UI

- 在报告周期/生成动作下方使用内联渐进展开编辑器，不使用 modal 或悬浮 popover。
- 收起态显示「补充事项」与当前条数；展开态显示 textarea、限制提示和清空操作。
- 一行一项，适合会议、联调、上线验证、线上支持等短事实。
- 复用现有按钮、边框、主题 token；明暗色均保持低噪音工作台风格。

## Contract

Rust `ExtractOptions`、`PeriodReportOptions` 与兼容的 `MonthlyReportOptions` 增加：

```rust
#[serde(default)]
pub supplemental_items: Vec<String>
```

前端 camelCase 为 `supplementalItems`。限制为最多 20 项，每项最多 200 个 Unicode 字符；空白项忽略。前端在 invoke 前给出中文错误，Rust 再做同等校验作为边界保护。

## Rendering

- 不新增模板 token：旧用户模板可能不包含新 token，若依赖 token 会静默丢失事实。
- 统一在已渲染报告末尾追加：

```markdown
## 用户补充事项（非 Git）

- 参与支付联调并确认异常回退路径
- 完成上线后验证与问题跟踪
```

- 补充事项不参与 `commitCount`、`projectCount`、代码行数或证据链接。
- 开启脱敏时，对补充事项应用同一组自定义字面量替换规则。
- 追加发生在 AI 之前，确保 AI 输入和失败回退都保留本地事实。

## AI Safety

`buildReportEnhanceOptions` 在存在补充事项时追加固定指令：这些内容是用户提供事实，应保留其语义，但不得推导未提供的上线结论、验收结果、百分比或业务指标。

## Compatibility

- IPC 新字段有 serde default，旧前端 payload 可继续调用。
- 历史字段为可选并由类型守卫归一化，旧 localStorage 记录不会被丢弃。
- 无补充事项时报告输出逐字保持现状。

## Risks and Rollback

- 风险：事项被带到错误周期。通过 period-key 草稿和重新生成 override 避免。
- 风险：自定义模板漏内容。通过模板后追加而非 token 解决。
- 风险：用户输入过长拖大 AI prompt。通过前后端双重限制解决。
- 回滚：删除新字段、编辑器、追加函数及相关测试即可；serde default 保证中间版本兼容。
