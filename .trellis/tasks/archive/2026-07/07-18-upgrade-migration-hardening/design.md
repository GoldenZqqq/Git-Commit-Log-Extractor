# v0.5.1 → v0.5.3 升级迁移与恢复设计

## Baseline Findings

- v0.5.1 设置通过 `gitpulse-settings` localStorage 保存，旧字段依靠默认值合并升级；目前缺少完整的版本快照回归测试，非预期类型可能穿透到运行时。
- `loadSettingsState` 会在迁移真正完成前覆盖/删除旧设置。若旧 `aiKeyEnv` 是原始 API Key，而写入系统凭据库失败，下一次启动可能只剩被脱敏的新设置，唯一密钥副本丢失。
- 报告历史已有版本 1 文件、备份、损坏隔离、clear rollback 和幂等迁移，但只有 30/60/120/200 条目上限，没有文件字节边界。
- 配置方案 V1 已执行严格白名单和 2 MiB 限制；本任务补升级组合与凭据引用不被覆盖的证据，不改变 schemaVersion。

## Settings Migration Contract

设置候选按以下顺序解析：当前 `gitpulse-settings`、旧 `git-report-studio-settings`、迁移备份。有效当前设置始终拥有业务字段优先级；迁移备份只用于补回尚未安全落入系统凭据库的旧 `aiKeyEnv`。

新增两个有界 localStorage 恢复键：

- `gitpulse-settings-migration-backup`：保存迁移前原文，直到新设置已经持久化，且原始 API Key 已成功写入系统凭据库。
- `gitpulse-settings-corrupt-backup`：保留最后一次无法解析的当前设置原文，供手动恢复；应用使用有效旧设置或默认值继续启动。

迁移完成条件：

1. 新设置已经通过现有 `settingsForPersistence` 写入 `gitpulse-settings`。
2. 环境变量引用可直接保留，不进入 secure store。
3. 原始 API Key 必须收到 `set_secure_ai_api_key` 成功结果；失败时保留 migration backup 并在下次启动重试。
4. 只有满足上述条件才删除旧 key 和 migration backup。

所有 AppSettings 字符串、布尔值、数组、枚举、温度和历史上限在加载时严格归一化；缺失或类型错误字段回退到当前默认值，不以 `Boolean("false")` 等宽松转换改变语义。

## Report History Capacity And Recovery

- 保持 envelope `version: 1` 与 IPC 不变。
- 主文件/备份读取前检查 metadata，单文件最大 32 MiB；超限按损坏文件处理并隔离，随后尝试备份恢复。
- 写入在序列化后、创建 temp 前检查 32 MiB；超限返回中文错误，不旋转 primary/backup。
- 临时路径不可写、序列化/写入/sync/rename 失败继续返回错误；既有 primary 或 backup 必须保持可恢复。
- 重复传入 v0.5.1 legacyEntries 时，已存在的有效文件仍是唯一权威来源，不重复追加。

## Config Profile Compatibility

- V1 schema 与字段白名单不变。
- merge/replace 只更新 shareable fields；`env:OPENAI_API_KEY`、secure saved flags、本地路径、历史和 OAuth 状态不被覆盖。
- 损坏 JSON、未知版本、未知根/设置字段、缺字段和超过 2 MiB 的输入都在预览前失败，不发生部分 apply。

## Validation Matrix

- v0.5.1 有效设置缺少新字段 → 保留工作区/作者/引用并补当前默认值。
- 当前设置损坏 + 有效旧设置 → 隔离损坏原文、使用旧设置并完成可重试迁移。
- 原始 `aiKeyEnv` + secure store 失败 → 新普通设置不含原始 Key，migration backup 保留；下次成功后才清理。
- 迁移重复启动 → 不重复历史、不覆盖更新后的当前设置。
- 历史 primary 损坏/超限 + backup 有效 → 隔离 primary、恢复 backup、给出警告。
- 历史写入超限/temp 失败 → 返回错误，原 primary 仍可加载。
- 配置方案损坏或不兼容 → 当前设置和安全凭据引用保持不变。

## Compatibility And Rollback

- 不改变 Tauri command 名称、payload、报告历史 envelope 版本或配置方案 schemaVersion。
- migration/corrupt backup 只保存单份原文，避免无界增长；原始敏感值仅在旧数据已经包含时短期保留，不新增明文来源。
- 回滚本任务代码后，既有 `gitpulse-settings` 与 version 1 报告历史仍可被 v0.5.3 读取；新增 backup key 会被旧代码忽略。
