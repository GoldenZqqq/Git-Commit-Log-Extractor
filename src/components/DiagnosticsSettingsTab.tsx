import type { AppSettings, DiagnosticResult, RepoInfo, SupportBundleEventInput } from "../model";
import { DiagnosticsSection } from "./DiagnosticsSection";
import { LocalDataBoundarySection } from "./LocalDataBoundarySection";
import { SupportBundleSection } from "./SupportBundleSection";

type Props = {
  settings: AppSettings;
  repos: RepoInfo[];
  recentEvents: SupportBundleEventInput[];
  diagnostics: {
    result: DiagnosticResult | null;
    busy: boolean;
    message: string;
    ranAt: string;
    refresh: () => void;
  };
};

export function DiagnosticsSettingsTab({ settings, repos, recentEvents, diagnostics }: Props) {
  return (
    <>
      <LocalDataBoundarySection settings={settings} repos={repos} />
      <DiagnosticsSection
        result={diagnostics.result}
        busy={diagnostics.busy}
        message={diagnostics.message}
        ranAt={diagnostics.ranAt}
        onRefresh={diagnostics.refresh}
      />
      <SupportBundleSection
        settings={settings}
        repos={repos}
        diagnostics={diagnostics.result}
        diagnosticError={diagnostics.message}
        diagnosticsBusy={diagnostics.busy}
        recentEvents={recentEvents}
      />
    </>
  );
}
