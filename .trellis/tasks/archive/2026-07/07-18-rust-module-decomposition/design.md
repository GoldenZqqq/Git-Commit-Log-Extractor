# Rust 超大模块拆分设计

## Architecture

### report facade

- `report.rs` 保留现有 `report::*` 公共入口并通过 `pub use` 导出。
- `render_api.rs` 负责提取结果、摘要/明细、补充事项和公开渲染入口。
- `render_core.rs` 负责模板值、模板替换、脱敏准备和通用内容分派。
- `commit_items.rs` 负责提交清洗、按作者/项目分组与条目渲染。
- `evidence.rs` 负责证据引用解析、链接规则与展示文本。
- `period_content.rs` 负责周报/月报业务区块和标题。
- `date_range.rs` 负责上月范围及日/周/月子周期切分。
- `export.rs` 负责输出目录校验和 Markdown/DOCX/PDF 保存。
- `batch_naming.rs` 负责批量格式归一化、文件名模板和冲突预留。

### git_ops facade

- `git_ops.rs` 保留现有 `git_ops::*` 公共入口并通过 `pub use` 导出。
- `scan.rs` 负责仓库发现、循环保护、warning 上限、progress 与取消。
- `commits.rs` 负责查询结构、Git log/numstat 参数和输出解析。
- `command.rs` 负责 Git 可用性、进程创建、Windows 无窗口标志和 config/version 调用。

## Compatibility Contracts

- `crate::report::*` 与 `crate::git_ops::*` 的既有调用无需改路径。
- Tauri command 名称、camelCase payload、模型结构、错误文案、报告 Markdown 和导出文件命名保持字节级兼容。
- 仓库扫描仍以 canonical path 去重，保持稳定排序、warning cap、取消文本和最终 progress 语义。
- Git 子进程继续在 Windows 使用 `CREATE_NO_WINDOW`，命令参数顺序不变。

## Data Flow

1. `lib.rs` / CLI 调用 `commit_pipeline` 或 facade。
2. `git_ops` facade 把扫描交给 `scan`，把提交查询交给 `commits`，底层进程统一由 `command` 执行。
3. `commit_pipeline` 继续通过 `report` facade 构建、渲染、命名和保存报告。
4. 子模块只传递现有 models 与内部准备结构，不引入新的跨层 DTO。

## Rollout And Rollback

- 批次 1：拆 `git_ops`，定向 fmt/test/check；失败只恢复该 facade。
- 批次 2：拆 report 的日期、导出、批量命名等低耦合逻辑。
- 批次 3：拆模板、条目、证据和周期内容，保持 golden 断言原样。
- 每批只做移动、visibility 和 import 修复；算法优化或 contract 调整立即停止并另开任务。
