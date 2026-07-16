import { FlaskConical, RotateCcw } from "lucide-react";

type StableProvider = "openai-compatible" | "anthropic-native";

type Props = {
  onSwitchProvider: (provider: StableProvider) => void;
};

export function CodexOAuthExperimentalNotice({ onSwitchProvider }: Props) {
  return (
    <aside className="codex-experimental-notice" role="note" aria-label="Codex OAuth 实验说明">
      <div className="codex-experimental-heading">
        <FlaskConical size={16} />
        <strong>Codex OAuth</strong>
        <span className="experimental-badge">实验</span>
      </div>
      <p>适用于 ChatGPT Plus/Pro 账号。登录与润色请求会发送至 OpenAI ChatGPT/Codex 服务，协议变化可能导致此通道失效。</p>
      <div className="codex-fallback-actions" aria-label="推荐回退方式">
        <span><RotateCcw size={13} /> 推荐回退</span>
        <button type="button" onClick={() => onSwitchProvider("openai-compatible")}>OpenAI Compatible</button>
        <button type="button" onClick={() => onSwitchProvider("anthropic-native")}>Anthropic Native</button>
      </div>
    </aside>
  );
}
