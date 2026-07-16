import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  FolderGit2,
  FolderPlus,
  Loader2,
  Rocket,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AppSettings, RepoInfo } from "../model";

type Props = {
  settings: AppSettings;
  repos: RepoInfo[];
  isScanning: boolean;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onAddRootDirs: () => void;
  onRemoveRootDir: (dir: string) => void;
  onComplete: () => void;
};

const STEPS = [
  { title: "欢迎使用", desc: "了解 GitPulse 能做什么" },
  { title: "仓库根目录", desc: "告诉我们代码放在哪里" },
  { title: "统计作者", desc: "可选单人、多人或全部" },
] as const;

export function OnboardingWizard({ settings, repos, isScanning, updateSetting, onAddRootDirs, onRemoveRootDir, onComplete }: Props) {
  const [step, setStep] = useState(0);

  const rootReady = settings.rootDirs.length > 0;
  const hasRepos = repos.length > 0;
  const canAdvance = step === 0 || (step === 1 ? rootReady : true);

  function goNext() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    onComplete();
  }

  return (
    <div className="onboarding-stage">
      <section className="onboarding-card" aria-label="首次使用引导">
        <aside className="onboarding-rail">
          <div className="brand-logo onboarding-brand" role="img" aria-label="GitPulse" />
          <ol className="onboarding-steps">
            {STEPS.map((item, index) => (
              <li
                key={item.title}
                className={index === step ? "current" : index < step ? "done" : ""}
                aria-current={index === step ? "step" : undefined}
              >
                <span className="step-dot">{index < step ? <Check size={13} /> : index + 1}</span>
                <span className="step-copy">
                  <strong>{item.title}</strong>
                  <small>{item.desc}</small>
                </span>
              </li>
            ))}
          </ol>
          <p className="onboarding-rail-note">数据仅存本机，可在设置中修改。</p>
        </aside>

        <div className="onboarding-pane" key={step}>
          {step === 0 && (
            <StepBody
              icon={<Sparkles size={22} />}
              kicker="Welcome"
              title="三步开始生成工作报告"
              subtitle="扫描本地 Git，按作者与日期生成工作报告。"
            >
              <ul className="onboarding-points">
                <li><FolderGit2 size={16} />自动发现根目录下的全部 Git 仓库</li>
                <li><Sparkles size={16} />日报、上月绩效月报一键生成，支持 AI 润色</li>
                <li><UserRound size={16} />完全本地运行，提交数据不离开你的电脑</li>
              </ul>
            </StepBody>
          )}

          {step === 1 && (
            <StepBody
              icon={<FolderGit2 size={22} />}
              kicker="Step 1"
              title="选择仓库根目录"
              subtitle="选择代码目录，GitPulse 将扫描其中的 Git 仓库。"
            >
              {settings.rootDirs.length > 0 && (
                <ul className="root-dir-list onboarding-dir-list">
                  {settings.rootDirs.map((dir) => (
                    <li className="root-dir-row" key={dir}>
                      <FolderGit2 size={15} />
                      <span className="root-dir-path" title={dir}>
                        {dir}
                      </span>
                      <button type="button" onClick={() => onRemoveRootDir(dir)} aria-label={`移除目录 ${dir}`}>
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="onboarding-picker" onClick={onAddRootDirs}>
                <FolderPlus size={18} />
                <span className="placeholder">
                  {settings.rootDirs.length > 0 ? "继续添加目录" : "点击选择文件夹，例如 D:\\workspace"}
                </span>
              </button>
              {rootReady && isScanning && (
                <p className="onboarding-feedback">
                  <Loader2 className="spin" size={14} />
                  正在扫描仓库……
                </p>
              )}
              {rootReady && !isScanning && hasRepos && (
                <p className="onboarding-feedback ok">
                  <Check size={14} />
                  已发现 {repos.length} 个 Git 仓库
                </p>
              )}
              {rootReady && !isScanning && !hasRepos && (
                <div className="onboarding-empty-workspace" role="status" aria-live="polite">
                  <div className="onboarding-empty-title">
                    <AlertCircle size={15} />
                    <strong>暂未发现 Git 仓库</strong>
                  </div>
                  <p>请选择代码工作区或项目上层目录。</p>
                  <ul>
                    <li>目录本身或子目录需要包含 `.git`。</li>
                    <li>如果仓库在更深层目录，可继续添加那个上层目录。</li>
                    <li>公司同步盘或权限受限目录可能需要换到本地路径。</li>
                  </ul>
                </div>
              )}
            </StepBody>
          )}

          {step === 2 && (
            <StepBody
              icon={<UserRound size={22} />}
              kicker="Step 2"
              title="确认统计作者"
              subtitle="默认使用本机 Git 作者；留空统计全部作者。"
            >
              <label className="onboarding-author">
                <span>Git 作者</span>
                <input
                  value={settings.author}
                  onChange={(event) => updateSetting("author", event.target.value)}
                  placeholder="留空取全部作者；如 张三, 李四"
                  autoFocus
                />
              </label>
            </StepBody>
          )}

          <footer className="onboarding-footer">
            {step > 0 ? (
              <button type="button" className="onboarding-back" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={15} />
                上一步
              </button>
            ) : (
              <button type="button" className="onboarding-skip" onClick={onComplete}>
                暂时跳过，稍后在设置中配置
              </button>
            )}
            <button type="button" className="onboarding-next" onClick={goNext} disabled={!canAdvance}>
              {step === 0 && (
                <>
                  开始配置
                  <ArrowRight size={15} />
                </>
              )}
              {step === 1 && (
                <>
                  下一步
                  <ArrowRight size={15} />
                </>
              )}
              {step === 2 && (
                <>
                  <Rocket size={15} />
                  进入工作台
                </>
              )}
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}

function StepBody({
  icon,
  kicker,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  kicker: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="onboarding-body">
      <span className="onboarding-glyph">{icon}</span>
      <p className="kicker">{kicker}</p>
      <h1>{title}</h1>
      <p className="onboarding-subtitle">{subtitle}</p>
      {children}
    </div>
  );
}
