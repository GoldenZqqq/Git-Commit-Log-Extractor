# 建立大规模工作区性能基线

## Goal

为 GitPulse 的多仓库扫描与提交提取建立可重复、离线、机器可读的性能基线，使后续重构能够发现规模回归，而不接触真实用户仓库。

## Background

- 当前 Rust 扫描会递归发现仓库并逐个读取分支；提交提取按 CPU 数在 2 至 8 个 worker 间并行，随后排序并渲染完整报告。
- 产品当前只支持取消仓库扫描，提交提取没有取消命令；本任务测量现有扫描取消响应，不扩展产品行为。
- “冷扫描”在无特权开发机和 CI 中无法可靠清空操作系统文件缓存，因此以数据刚生成后的 first-pass scan 作为稳定等价指标，并明确记录该口径。

## Requirements

- R1：提供固定 profile：`smoke` 为 5 仓库/500 提交，`standard` 为 50 仓库/5 万提交，`large` 为 200 仓库/5 万提交；数据由固定作者、日期、消息和文件变更确定性生成。
- R2：测量数据生成、first-pass scan、重复 warm scan、完整提交提取与报告渲染、扫描取消响应、进程峰值 RSS（平台支持时）、fixture 磁盘规模和报告输出规模。
- R3：基准默认只在受控临时目录生成数据，完全离线，不读取真实用户仓库，不启用外部 AI，不持久化任何凭据。
- R4：结果使用带 `schemaVersion` 的 JSON，包含原始样本、P50/P95、环境、profile、阈值、失败项和总体结论；超过阈值时仍先写出结果，再以非零状态退出。
- R5：提供可在 CI 使用的快速 `smoke` profile；标准和大型 profile 用于发布前或架构重构前后的人工基线，不增加每次主线 CI 的固定耗时。
- R6：基准是开发者工具，不新增 Tauri command、前端入口、遥测、常驻后台采样或生产依赖。

## Acceptance Criteria

- [ ] AC1：一条 `cargo run --release --bin gitpulse-workspace-benchmark -- ...` 命令可生成任一 profile 并输出有效 JSON 结果。
- [ ] AC2：自动化测试覆盖 profile 规模、percentile/阈值计算、fixture 清理保护、扫描取消和最小端到端 smoke。
- [ ] AC3：基线文档记录环境、样本口径、standard/large 实测值、P50/P95、资源与输出规模、回归阈值。
- [ ] AC4：基准验证真实扫描仓库数和提取提交数与 profile 完全一致，发现的阻断性能问题已修复或形成明确后续任务。
- [ ] AC5：现有 build、E2E、Rust 测试、真实 Tauri smoke 和 `git diff --check` 保持通过。

## Out of Scope

- 不把基准结果上传到远端服务，不采集真实用户设备性能。
- 不承诺跨操作系统数值完全可比，也不把 first-pass scan 宣称为已清空 OS cache 的物理冷启动。
- 不在本任务增加提交提取取消、扫描算法重写、Git 对象压缩调优或 UI 性能面板。

## Dependency

- 升级迁移任务已完成并归档；本任务在稳定的 v0.5.3 持久化基线上执行。
