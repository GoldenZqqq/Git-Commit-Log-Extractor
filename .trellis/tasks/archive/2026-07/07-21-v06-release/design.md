# v0.6.0 发布设计

## Release Boundary

- 代码源：最新 `origin/main` 对应的 clean `main`。
- 版本源：`scripts/version-utils.mjs` 同步 `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`。
- 发布事务：`scripts/publish-release.mjs` 负责版本提交/推送、exact-SHA CI 等待、Windows release build、签名、draft Release、资产上传和发布。
- 发布正文：`release-notes/v0.6.0.md` 读取为 GitHub Release body；保留在本地工作目录。

## Data Flow

1. 从 `v0.5.3..HEAD` 整理用户可见变更，更新 `CHANGELOG.md` 并生成/润色本地 Release Notes。
2. 完成发布前验证后，推送当前 main，使发布源与远程同步。
3. `release:win:minor` 将 0.5.3 计算为 0.6.0，更新五个版本文件，提交并推送版本提交。
4. 发布脚本等待该版本提交的成功主线 CI，重新确认 `HEAD === origin/main`。
5. 构建并签名 NSIS `.exe`，生成 `.exe.sig` 和 `gitpulse-latest.json`，创建 draft Release 并上传三项资产。
6. 资产齐全后发布 draft、创建不可变 `v0.6.0` tag，并验证 latest manifest。

## Safety And Rollback

- 发布前如果工作区 dirty、分支非 main、main 落后或 CI 失败，发布脚本必须拒绝继续。
- 已存在 tag/Release 时停止，不覆盖历史资产。
- draft 上传失败时仅清理本次事务产生的 draft/tag；不得删除已发布 Release。
- 发布完成后若发现问题，创建后续修复版本，不移动 `v0.6.0` tag。
- 凭据只从 `.release.env.local` / 环境变量读取，日志和任务文档不打印敏感值。
