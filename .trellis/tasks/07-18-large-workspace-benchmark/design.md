# 大规模工作区基准设计

## Architecture And Boundaries

- 新增开发者二进制 `src-tauri/src/bin/gitpulse-workspace-benchmark.rs`，直接调用公开的 `gitpulse_lib::git_ops`、`commit_pipeline` 和 `models`，避免通过 UI mock 或重新实现业务逻辑测出假指标。
- fixture、profile/参数和统计分别放在 `src-tauri/src/bin/workspace_benchmark/` 的小模块中，单文件保持在项目 600 行上限内。
- Cargo 会自动发现 `src/bin` 二进制；不修改生产 Tauri command、IPC、`package.json`、依赖或常规 CI workflow。
- 基准 stdout 只输出 JSON；诊断与失败原因写 stderr。指定 `--output` 时先写结果文件，再依据阈值决定退出码。

## Profiles And Fixture Contract

| Profile | Repositories | Total commits | Default iterations | Purpose |
| --- | ---: | ---: | ---: | --- |
| `smoke` | 5 | 500 | 3 | 快速正确性与 CI 可运行性 |
| `standard` | 50 | 50,000 | 3 | 常规大工作区发布基线 |
| `large` | 200 | 50,000 | 3 | 高仓库数调度与扫描基线 |

- 每个仓库由 `git init` 和流式 `git fast-import` 生成，提交均使用固定作者、UTC 时间序列、消息格式和单文件变化；不会调用网络。
- 提交按仓库均匀分配，余数从低序号仓库开始补齐，实际总数必须等于 profile 声明。
- 默认 fixture 位于系统临时目录。清理只允许删除包含 GitPulse benchmark marker 的目录；用户指定的非空无 marker 路径必须拒绝。
- `--keep-fixture` 可保留数据复核，否则无论成功或失败都尝试清理受控 fixture。

## Measurement Data Flow

```text
parse profile
  -> create deterministic repositories
  -> first-pass find_git_repos_with_progress
  -> repeated warm find_git_repos_with_progress
  -> repeated extract_commits_sync(indexed_repos, AI disabled)
  -> cancellation scan with AtomicBool set from progress callback
  -> collect fixture/output bytes and process peak RSS
  -> evaluate thresholds
  -> serialize/write report
  -> cleanup fixture
  -> exit 0/1
```

- first-pass scan 是 fixture 生成后的第一次业务扫描；不声称操作系统缓存已被强制清空。
- warm scan 与 extraction 各保存原始毫秒样本，并用 nearest-rank 计算 P50/P95。
- extraction 使用 first-pass 返回的 indexed repositories，隔离扫描成本，但保留真实并行 Git log、numstat、排序和报告渲染。
- cancellation 在扫描进度达到固定目录数后设置同一个 `AtomicBool`，测量从请求写入到扫描返回“已取消”错误的时间。
- Linux 从 `/proc/self/status` 读取 `VmHWM`；Windows 读取当前进程 `PeakWorkingSet64`；不支持的平台输出 `null`，不得伪装为 0。

## Result Contract

结果顶层使用 camelCase JSON：

```json
{
  "schemaVersion": 1,
  "profile": { "name": "standard", "repositoryCount": 50, "commitCount": 50000 },
  "environment": { "os": "linux", "arch": "aarch64", "cpuCount": 2, "gitVersion": "..." },
  "fixture": { "path": "...", "bytes": 0, "kept": false },
  "measurements": {
    "generationMs": 0,
    "firstScanMs": 0,
    "warmScan": { "samplesMs": [], "p50Ms": 0, "p95Ms": 0 },
    "extraction": { "samplesMs": [], "p50Ms": 0, "p95Ms": 0, "commitCount": 50000 },
    "cancellation": { "responseMs": 0, "cancelled": true },
    "processPeakRssBytes": 0
  },
  "thresholds": {},
  "failures": [],
  "passed": true
}
```

- 时间使用整数毫秒；小于 1 ms 的取消响应向上取整为 1，避免机器输出产生误导性的 0 ms。
- 阈值是保守回归护栏而非用户 SLA：smoke/standard/large 分别限制 first scan、warm P95、extraction P95、取消响应和支持平台的峰值 RSS。
- 仓库数、提交数或取消语义不匹配属于 correctness failure，不受性能阈值容差影响。

## Compatibility, Safety And Rollback

- 不改变现有库函数签名、生产二进制或桌面行为；基准只消费公开 Rust API。
- 输出中只包含 synthetic 路径与环境摘要，不包含用户仓库、Git 全局身份或凭据。
- 若基准引入问题，可删除新增 `src/bin`、文档和测试；生产应用无需数据迁移或配置回滚。
- 第一轮实测若超过保守阈值，先记录原始结果和根因；只有真实性能缺陷才修改业务代码，否则校准并解释环境相关阈值。
