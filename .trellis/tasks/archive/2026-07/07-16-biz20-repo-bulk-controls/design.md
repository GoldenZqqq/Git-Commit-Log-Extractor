# BIZ-20 仓库搜索与批量操作 — 技术设计

## UX Structure

仓库辅助面板保持单一滚动区域，不增加 modal 或卡片网格。标题/重扫下方增加紧凑控制区：

1. 搜索框：占满首行，提示可搜索项目、仓库、路径和分支。
2. 状态分段按钮：全部、已启用、已禁用，按钮内显示数量。
3. 当前结果摘要与两个批量动作：显示“命中 N / 总计 M”，启用/禁用只作用于可见结果。
4. 全禁用提示：明确生成范围为 0，提供“查看已禁用”恢复入口。
5. 结果列表：沿用现有开关、映射编辑、名称/分支/路径层级。

搜索无命中与状态筛选无命中使用列表内空态；清除搜索或切换筛选是显式按钮，不依赖 hover。批量操作可逆，不增加确认弹窗。

## Component Boundary

新增 `RepositoryPanel.tsx`，从 `Workbench.tsx` 提取现有仓库标题、扫描进度、空索引引导和仓库行，并在该边界内拥有搜索/筛选 UI 状态。组件接收：

- `repos`、`disabledRepos`、`projectNames`、`rootDirs`。
- 扫描状态、进度与重扫/取消回调。
- 单仓库切换、映射编辑、批量启停、添加目录和打开设置回调。

搜索和筛选不持久化；离开并重新进入仓库辅助 tab 时回到“全部 + 空搜索”，避免把瞬时管理视图变成隐藏配置。

## Filter Model

```ts
type RepoStatusFilter = "all" | "enabled" | "disabled";

type RepositoryEntry = {
  repo: RepoInfo;
  displayName: string;
  enabled: boolean;
  searchText: string;
};
```

`searchText` 由 `repo.name`、映射显示名、`repo.path`、`repo.branch` 拼接并小写化。先按状态过滤，再按规范化 query 做子串匹配。批量路径直接来自最终 `visibleEntries`，不重新推导另一套集合。

## State Update Flow

```text
RepositoryPanel visible paths
  → App.setReposEnabled(paths, enabled)
  → one functional settings update for disabledRepos
  → useWorkspaceHealth.setReposDisabled(paths, !enabled)
  → Workbench enabled count / generation scope rerender
  → settings persistence effect writes localStorage
  → Chinese success status with changed count
```

App 用 `Set` 去重路径。启用时只删除命中路径；禁用时把命中路径加入现有集合，因此不会删除未命中或已失效的禁用路径。单仓库 `toggleRepo` 行为保持不变。

## Accessibility and Visual Rules

- 搜索框有可见图标与 `aria-label="搜索仓库"`；状态筛选使用 `role="group"` 和 `aria-pressed`。
- 命中数使用 `aria-live="polite"`；批量按钮在无结果或无实际变化时禁用。
- 空态恢复按钮可通过键盘聚焦；全禁用提示不只依赖颜色。
- 复用现有按钮、token、浅色/深色主题；控制区保持密集桌面工具形态，不挤压报告生成主操作。

## Tests

- Playwright 用多仓库、映射名和不同分支验证四字段搜索与状态组合。
- 批量禁用后断言可见集合消失/转入禁用筛选、生成范围与 localStorage 同步，未命中仓库不变。
- 批量恢复后断言范围恢复；全禁用初始状态显示 0 范围和恢复路径。
- 视觉核验 1280×720 明暗主题，检查控制区密度、空态、按钮禁用态与列表滚动。

## Rollback

删除 `RepositoryPanel` 并恢复 `Workbench` 原仓库列表；移除 App/hook 批量回调即可。设置和缓存 schema 均未变化，无数据迁移。
