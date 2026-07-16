# Project Retrospective Attribution

> Executable cross-layer contract for generating, persisting, and presenting project-level report history.

## 1. Scope / Trigger

- Trigger: daily, custom, weekly, or monthly generation adds project attribution to a report result or `ReportHistoryEntry`.
- Trigger: the insights UI groups report history by project, filters it by time, or opens the original report.
- Attribution is generated from extracted commits once. The retrospective must not rescan Git, read exported files, or infer identity from Markdown.

## 2. Signatures

Rust shared shape and generation results:

```rust
pub struct ReportHistoryProject {
    pub name: String,
    pub commit_count: u64,
    pub evidence_ids: Vec<String>,
}

pub struct ExtractResult {
    // existing fields
    pub projects: Vec<ReportHistoryProject>,
}

pub struct PeriodReportResult {
    // existing fields
    pub projects: Vec<ReportHistoryProject>,
}

pub struct ReportHistoryEntry {
    // existing fields
    pub projects: Option<Vec<ReportHistoryProject>>,
}
```

Frontend mirror and projection:

```ts
type ReportHistoryProject = {
  name: string;
  commitCount: number;
  evidenceIds: string[];
};

listRetrospectiveProjects(entries: ReportHistoryEntry[]): string[];

deriveProjectRetrospective(
  entries: ReportHistoryEntry[],
  projectName: string,
  range: "30" | "90" | "180" | "all",
  today?: Date,
): ProjectRetrospectiveResult;
```

## 3. Contracts

- `report.rs` is the project-identity owner: exact `repo(branch)` mapping wins, wildcard `repo(*)` is next, trailing connectors are removed, and missing mappings fall back to `repo(branch)`.
- `project_retrospective.rs` owns stable grouping, full project commit counts, evidence dedupe, seven-character hash shortening, and the per-project/per-report limit of 20 evidence IDs.
- Redaction runs before attribution. Redacted history stores alias names such as `仓库1(分支1)` and evidence IDs such as `commit-1`; raw repository, branch, mapped name, author, and hash values must not re-enter `projects`.
- `ExtractResult.projects` covers daily/custom and `PeriodReportResult.projects` covers weekly/monthly. `App.tsx` copies these values into history without recalculating mappings.
- `ReportPolishReview.projects?` is a source snapshot. Accepting AI output creates a new history entry with the same attribution; AI changes text only.
- `ReportHistoryEntry.projects` stays optional under report-history envelope version 1:
  - `undefined` means legacy/unattributed and projects to `未归类历史`.
  - `[]` means a new structured report with no project commits and must not project to `未归类历史`.
- The UI filters by `getReportCalendarAnchorDate`, uses the user's local calendar day for 30/90/180-day cutoffs, sorts newest-first, and calculates report, project-commit, exported-report, and unique-evidence totals from the filtered project rows.
- Opening a row passes its original `ReportHistoryEntry` to the existing `onOpenHistory`; there is no copied preview, modal, new storage, or Tauri command.

## 4. Validation & Error Matrix

- Missing history `projects` -> accept the entry and expose it only under `未归类历史`.
- Present `projects` is not an array or contains an invalid item -> reject through the frontend history guard or Rust serde/normalization path.
- Project name empty -> reject persisted history; the projection also ignores empty names defensively.
- `commitCount` is not a non-negative integer -> reject in the frontend history guard.
- Evidence ID empty or an item contains more than 20 IDs -> reject persisted history.
- Duplicate project names inside one entry -> projection merges counts and evidence, then reapplies the 20-ID limit.
- Invalid/missing anchor date with a bounded range -> omit the row from that range; `all` may still show the legacy row.
- No history -> show the instructional empty state and disable project/time selectors.
- Selected project has no rows in the range -> keep the selection and show the range-specific empty state.

## 5. Good / Base / Bad Cases

- Good: one weekly report has two mapped projects; it appears in both timelines with different counts/evidence while opening the same history ID.
- Good: a redacted report persists `仓库1(分支1)` and `commit-1`, then AI acceptance preserves those exact values.
- Base: an old entry without `projects` loads under `未归类历史` without modifying the file.
- Base: a zero-commit new entry has `projects: []` and does not invent attribution.
- Bad: parse `## 项目名` headings from report text; custom templates and author grouping make this identity unreliable.
- Bad: recompute daily projects in React from `commits` while period reports use Rust totals; mapping and redaction behavior will diverge.
- Bad: aggregate raw commits first and redact only rendered text; the history file then leaks raw project names and hashes.

## 6. Tests Required

- Rust unit tests: multi-project counts, evidence order/dedupe/20 limit, short hashes, exact/wildcard mapping, connector trimming, redacted aliases, and history round-trip.
- Playwright: no history, structured single/multi-project history, the same report in multiple timelines, legacy `未归类历史`, `projects: []`, time filters, AI/export state, evidence totals, and opening the original report.
- Cross-layer generation test: all four report modes persist the returned `projects` snapshot.
- AI test: accepted polish history keeps the source `projects` unchanged.
- Redaction test: stored project attribution contains aliases/`commit-N` and no raw identity.
- Visual checks: light/dark desktop and narrow viewport; assert no component overflow or action-button escape.
- Full gates: `cargo fmt -- --check`, `cargo check`, `cargo test`, Clippy with only documented pre-existing lint allows, `npm run build`, full Playwright, and `git diff --check`.

## 7. Wrong vs Correct

### Wrong

```ts
const project = parseMarkdownHeading(entry.reportText);
const commits = countCommitProjects(result.commits, projectNames);
rememberHistory({ ...entry, projects: [{ name: project, commitCount: commits, evidenceIds: [] }] });
```

### Correct

```rust
let prepared = prepare_report_input(commits, project_names, &[], "", redaction);
let projects = summarize_projects(prepared.commits.as_ref(), |commit| {
    monthly_project_name(prepared.project_names.as_ref(), commit)
});
```

```ts
rememberHistory(buildHistoryEntry({
  ...source,
  projects: result.projects,
}));
```
