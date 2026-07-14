# 空白日补写 — 实现清单

## Checklist

1. **契约**  
   - [x] `models.rs`：`BlankDayFillOptions` / `BlankDayFillResult`  
   - [x] `model.ts`：TS 类型 + invoke 构建 helper + 默认 prompt 常量 + 气泡偏好读写  
   - [x] 历史写入约定：title / periodLabel 标记补写草稿

2. **Rust AI + pipeline**  
   - [x] `ai.rs`：`blank_day_system_prompt` + `fill_blank_day_report`  
   - [x] `commit_pipeline.rs`：提材摘要 + 调 AI（裁剪过长 commit 列表）  
   - [x] `lib.rs`：注册 `fill_blank_day_report`  
   - [x] 单元测试：prompt 拼装 / 空配置行为（对齐现有 ai tests 风格）

3. **前端 Dialog**  
   - [x] 新建 `BlankDayFillDialog.tsx`  
   - [x] 目标日、素材周期、条数 3/5/8、仓库 Tag、Prompt、恢复默认  
   - [x] disclaimer + 有提交轻提示  
   - [x] 生成 / loading / 错误 / 结果 textarea  
   - [x] 复制、重新生成、应用到预览（确认替换）

4. **Workbench 入口**  
   - [x] 仅日报模式显示「空白日补写」  
   - [x] 吸引气泡默认展开，关闭持久化  
   - [x] 样式与现有 preview 工具栏一致（`dialogs.css` / workbench 样式）

5. **App 编排**  
   - [x] open/close、busy、settings.ai  
   - [x] 生成成功 `rememberReportHistoryEntry`  
   - [x] 应用预览写入 `previewText` 并切换到日报预览

6. **验证**  
   - [x] `cd src-tauri; cargo test`（相关）  
   - [x] `cd src-tauri; cargo check`  
   - [x] 前端 `npm run build` 或现有 lint/typecheck  
   - [x] 手工：无 AI / 无素材 / 有提交日提示 / 历史标记 / 替换确认

## Validation Commands

```powershell
cd src-tauri; cargo test
cd src-tauri; cargo check
npm run build
```

## Risk Files

- `src/components/Workbench.tsx` — 工具栏拥挤风险  
- `src/model.ts` — 历史结构兼容  
- `src-tauri/src/ai.rs` — 勿改动现有润色 prompt 默认语义  
- `src-tauri/src/models.rs` — serde 字段命名与前端一致

## Out of Implementation Scope

- 幽默气泡开关  
- 周/月报补写  
- 历史 `source` 强类型字段（可作为 follow-up）  
- 无 AI 规则引擎

## Ready for start when

- [x] PRD 决策已收敛  
- [x] design.md / implement.md 已写  
- [x] 用户确认可 `task.py start` 进入实现

