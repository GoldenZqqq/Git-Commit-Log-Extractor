# BIZ-24 隔离 Codex OAuth 实验能力

## Goal

把 Codex OAuth 明确隔离为实验能力，避免用户把非官方、可能失效的登录路径误认为稳定 AI 主路径。

## Requirements

- 协议选择项、配置区和状态显示均带“实验”标记。
- 在登录前说明适用账号、可能失效、数据发送目标和推荐回退方式。
- 提供切换回 OpenAI Compatible/Anthropic Native 的明确操作，不删除已有安全凭据。
- 不改变现有 OAuth 协议实现和安全存储边界。

## Acceptance Criteria

- [x] 用户在选择 Codex OAuth 前即可看到实验标记与限制。
- [x] 登录区展示回退路径，主流 provider 保持默认优先级。
- [x] 切换 provider 不泄露或误清空其他 provider 的凭据。
- [x] Playwright 覆盖实验文案与 provider 切换。

## Evidence

- 当前提示仅位于 Codex OAuth Field hint，协议下拉仍显示普通 `ChatGPT (Codex OAuth)`。
