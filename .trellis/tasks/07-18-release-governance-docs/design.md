# 发布治理与 v0.5.3 文档同步设计

## Baseline Gaps

- `publish-release.mjs` 的 dry-run 在 Git 校验前返回，非 `main`、落后 `origin/main` 或脏工作区也能显示成功。
- 普通发布先在本地修改版本并构建，构建后才提交、推送和打 tag；tag 对应的版本提交没有先通过主线 CI。
- `release.yml` 只要收到 `v*` tag 就直接构建，不校验 tag 是否属于 `origin/main`，也不核对该提交的主线 CI。
- 新 Release 在 tag 已推送后创建并逐个上传资产，上传失败可能留下无法代表完整发布的 tag 或半成品 Release。
- README、根 CHANGELOG 与官网 changelog 没有完整表达 v0.5.2/v0.5.3 已发布能力。

## Release Source Contract

发布入口统一执行以下本地预检：

1. 当前必须是具名 `main` 分支且工作区干净。
2. `git fetch origin main --tags` 后，`HEAD` 必须等于 `origin/main`。
3. 普通 bump/set 发布先同步版本并形成独立版本提交，推送 `main` 后等待该提交的 `CI` push run 成功。
4. `current` 模式不创建版本提交，但同样要求当前 `HEAD` 的主线 CI 成功。
5. CI 成功后再次 fetch 并确认 `HEAD == origin/main`，避免等待期间主线已前进。

dry-run 执行第 1、2 项并展示版本计划，不读取签名密钥、不构建、不上传；因此可用于明确拒绝错误分支和落后主线。

## CI And Tag Gate

- 新增可测试的 Node release-governance 模块，封装 Git 状态、主线同步、tag 祖先和 GitHub Actions run 校验。
- 主 CI 运行 release-governance 单元测试。
- `release.yml` 增加前置 validate job：解析 tag、fetch 完整历史、确认 tag commit 是 `origin/main` 祖先，并确认同一 SHA 存在成功的 `CI` push run；构建矩阵只在 validate 成功后启动。
- GitHub Token 除 `Contents: Read and write` 外还需要 `Actions: Read`，用于查询主线 CI。

## Publication Transaction

新版本发布不预先推送 tag：

1. 在版本提交通过主线 CI 后构建 Windows 安装包、签名和本地 updater manifest。
2. 创建 draft Release，上传 `.exe`、`.exe.sig` 与 `gitpulse-latest.json`。
3. 确认 draft 资产完整后，将 draft 发布；GitHub 以已经通过验证的 `origin/main` SHA 创建 tag。
4. draft 创建或上传失败时删除本次 draft；远端不产生新 tag，也不会更新 `latest`。

`current` 模式只允许现有 tag 指向当前主线提交，用于重传同版本资产；不移动 tag。既有已发布 Release 不在失败补偿中删除。

## Documentation Scope

- README：补充 v0.5.2/v0.5.3 的工作台能力与受控发布说明。
- CHANGELOG：增加 v0.5.2、v0.5.3 已发布条目并保持 `Unreleased` 为空白收集区。
- `docs/business-improvement-roadmap.md`：记录 BIZ-11～15、20～27 已在 v0.5.2/v0.5.3 完成交付，下一阶段进入稳定化与证据驱动选线。
- 官网中英文 changelog：补充 v0.5.2、v0.5.3，平台限制与 README 保持一致。

## Compatibility And Rollback

- 不改变 Tauri IPC、安装包格式、updater manifest 字段或用户数据。
- 仍保留 `release:win:*` 命令；行为变化仅是更早拒绝错误发布源，并在构建前等待 CI。
- workflow 或脚本异常时可回滚本任务提交；不得移动或重打已有 v0.5.2/v0.5.3 tag。
- 若版本提交 CI 失败，保留可审计的主线版本提交但不创建 tag/Release；修复后重新执行发布。
