# 发布治理与文档同步实施计划

1. [x] 固化 release source、CI run、tag 祖先和 draft 发布契约，并激活任务。
2. [x] 为 clean latest main、非 main、落后远端、tag 非主线祖先和 CI run 结果增加 Node 单元测试。
3. [x] 实现 release-governance 模块和 CLI，把 dry-run 与真实发布统一接入主线预检。
4. [x] 将版本提交提前到构建前，推送后等待对应主线 CI 成功并再次确认主线未前进。
5. [x] 将新版本发布改为 draft staging，完整上传后再发布；失败时清理本次 draft，既有 tag 不移动。
6. [x] 在 `ci.yml` 运行治理测试；在 `release.yml` 增加 tag 祖先/CI validate job 并阻断未验证构建。
7. [x] 同步 README、CHANGELOG、业务路线图、官网中英文 v0.5.2/v0.5.3 内容和维护者发布说明。
8. [x] 更新 Trellis release code-spec，运行脚本测试、workflow 解析、站点/前端构建、E2E、Rust CI 与 release dry-run。
9. [x] 勾选 AC，记录 CI/验证证据，归档任务并独立 push。

## Validation Commands

```bash
npm run test:release-governance
npm run build
npm run test:e2e
npm --prefix site run build
node -e "import('yaml').then(({parse}) => parse(require('fs').readFileSync('.github/workflows/ci.yml', 'utf8')))"
node -e "import('yaml').then(({parse}) => parse(require('fs').readFileSync('.github/workflows/release.yml', 'utf8')))"
npm run release:win -- --dry-run
cd src-tauri && cargo fmt -- --check && cargo check && cargo test
git diff --check
```

## Risk Files

- `scripts/publish-release.mjs`
- `scripts/github-release.mjs`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `package.json`
- `CONTRIBUTING.md`
- `README.md`
- `CHANGELOG.md`
- `docs/business-improvement-roadmap.md`
- `site/src/i18n/content.ts`
