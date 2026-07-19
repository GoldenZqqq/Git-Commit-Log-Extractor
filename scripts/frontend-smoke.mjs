import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

const files = {
  app: readSource("src/App.tsx"),
  settings: readSource("src/components/SettingsDialog.tsx"),
  settingsTabs: readSource("src/components/SettingsTabNav.tsx"),
  diagnosticsSection: readSource("src/components/DiagnosticsSection.tsx"),
  diagnosticsHook: readSource("src/hooks/useDiagnosticsPanel.ts"),
  workbench: readSource("src/components/Workbench.tsx"),
  reportCanvas: readSource("src/components/ReportCanvas.tsx"),
  reportWorkflow: readSource("src/hooks/useReportWorkflow.ts"),
  model: readSource("src/model.ts"),
  modelTypes: readSource("src/model/types.ts"),
  reportOptions: readSource("src/model/report-options.ts"),
  diagnostics: readSource("src-tauri/src/diagnostics.rs"),
  networkDiagnostics: readSource("src-tauri/src/diagnostics/network_checks.rs"),
};

const checks = [
  {
    name: "settings diagnostics tab is reachable",
    run: () => {
      matches(files.settingsTabs, /type SettingsTab = [^;]*"diagnostics"[^;]*;/);
      includes(files.settingsTabs, '{ id: "diagnostics", label: "诊断"');
      includes(files.settings, 'activeTab === "diagnostics"');
    },
  },
  {
    name: "settings diagnostics invokes backend command",
    run: () => {
      includes(files.settings, "useDiagnosticsPanel");
      includes(files.diagnosticsHook, 'invoke<DiagnosticResult>("run_diagnostics"');
      includes(files.diagnosticsHook, "rootDirs: settings.rootDirs");
      includes(files.diagnosticsHook, "indexedRepos: repos");
      includes(files.diagnosticsHook, "proxy: buildProxyConfig(settings)");
      includes(files.modelTypes, "export type DiagnosticResult");
    },
  },
  {
    name: "diagnostics result renders summary and actionable rows",
    run: () => {
      includes(files.diagnosticsSection, "result.errorCount");
      includes(files.diagnosticsSection, "result.warningCount");
      includes(files.diagnosticsSection, "result.okCount");
      includes(files.diagnosticsSection, "diagnostics-item");
      includes(files.diagnosticsSection, "{item.action && <small>{item.action}</small>}");
    },
  },
  {
    name: "diagnostics command includes network and updater checks",
    run: () => {
      includes(files.diagnostics, "network_checks::github(&options.proxy)");
      includes(files.diagnostics, "network_checks::updater_manifest(&options.proxy)");
      includes(files.networkDiagnostics, "GitHub 网络");
      includes(files.networkDiagnostics, "更新清单");
      includes(files.networkDiagnostics, "gitpulse-latest.json");
    },
  },
  {
    name: "export menu exposes markdown docx and pdf formats",
    run: () => {
      includes(files.reportCanvas, '["markdown", "docx", "pdf"] as ReportExportFormat[]');
      includes(files.reportCanvas, "onClick={() => onExport(format)}");
      includes(files.reportCanvas, 'aria-label="导出格式"');
    },
  },
  {
    name: "export action reaches save_report_file command",
    run: () => {
      includes(files.reportWorkflow, 'invoke<string>("save_report_file"');
      includes(files.reportWorkflow, "baseName,");
      includes(files.reportWorkflow, "format,");
      includes(files.reportWorkflow, "content: previewText");
      includes(files.reportWorkflow, "formatReportExportLabel");
    },
  },
  {
    name: "blank day fill stays concrete and follows commit item prefix mode",
    run: () => {
      includes(files.reportOptions, "export function buildCommitItemPrefix");
      includes(files.reportOptions, "export function buildBlankDayEvidenceText");
      includes(files.reportOptions, "resolveCommitMappedProjectName");
      includes(files.reportOptions, "项目前缀");
      includes(files.reportOptions, "具体锚点");
      includes(files.reportOptions, "功能延伸");
      includes(files.reportOptions, "缺陷或回归");
      includes(files.reportOptions, "测试补强");
      includes(files.reportOptions, "不得只写");
      excludes(files.reportOptions, "偏「跟进 / 排查 / 推进 / 整理」");
      const blankDay = readSource("src/components/BlankDayFillDialog.tsx");
      includes(blankDay, "settings.commitItemPrefixMode");
      includes(blankDay, "buildBlankDayEvidenceText");
      includes(blankDay, "projectNames");
    },
  },
];

let failed = 0;
for (const check of checks) {
  try {
    check.run();
    console.log(`ok - ${check.name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${check.name}`);
    console.error(`  ${error.message}`);
  }
}

if (failed > 0) {
  console.error(`frontend smoke failed: ${failed}/${checks.length} checks failed`);
  process.exit(1);
}

console.log(`frontend smoke passed: ${checks.length} checks`);

function readSource(relativePath) {
  return readFileSync(join(rootDir, relativePath), "utf8");
}

function includes(source, needle) {
  if (!source.includes(needle)) {
    throw new Error(`missing source marker: ${needle}`);
  }
}

function excludes(source, needle) {
  if (source.includes(needle)) {
    throw new Error(`unexpected source marker: ${needle}`);
  }
}

function matches(source, pattern) {
  if (!pattern.test(source)) {
    throw new Error(`missing source pattern: ${pattern}`);
  }
}
