# Workspace Performance Benchmark

> Executable contract for repeatable, offline Git workspace performance checks.

## 1. Scope And Trigger

Use `gitpulse-workspace-benchmark` when a change can affect repository discovery,
commit extraction, report rendering, cancellation, or their memory use. The tool is
a developer-only Rust binary. It must not add a Tauri command, frontend entry,
telemetry, network request, credential read, or production dependency.

The benchmark measures synthetic repositories only. `firstScanMs` means the first
business scan immediately after fixture generation; it is not a claim that the OS
filesystem cache was cleared.

## 2. Invocation And Module Boundaries

Canonical invocation:

```bash
cd src-tauri
cargo run --release --bin gitpulse-workspace-benchmark -- \
  --profile standard \
  --output ../artifacts/benchmarks/standard.json
```

Supported options:

```text
--profile <smoke|standard|large>
--iterations <2..10>
--output <path>
--fixture-dir <path>
--keep-fixture
--allow-regressions
```

Ownership:

- `src/bin/gitpulse-workspace-benchmark.rs`: orchestration and result evaluation.
- `src/bin/workspace_benchmark/profile.rs`: profiles, thresholds, and CLI parsing.
- `src/bin/workspace_benchmark/fixture.rs`: controlled fixture lifecycle and
  deterministic `git fast-import` generation.
- `src/bin/workspace_benchmark/metrics.rs`: duration, nearest-rank percentile,
  and platform RSS collection.
- Production behavior must be measured through public `git_ops` and
  `commit_pipeline` APIs rather than duplicated benchmark-only logic.

## 3. Profiles And Result Contract

| Profile | Repositories | Commits | Default iterations | Intended use |
| --- | ---: | ---: | ---: | --- |
| `smoke` | 5 | 500 | 3 | Fast correctness and local/CI smoke |
| `standard` | 50 | 50,000 | 3 | Release and report-hot-path baseline |
| `large` | 200 | 50,000 | 3 | Repository fan-out and scan baseline |

The stdout and optional output file contain the same pretty-printed JSON. The
top-level contract is camelCase and starts with `schemaVersion: 1`:

```json
{
  "schemaVersion": 1,
  "profile": {
    "name": "standard",
    "repositoryCount": 50,
    "commitCount": 50000,
    "iterations": 3
  },
  "environment": {
    "os": "linux",
    "arch": "aarch64",
    "cpuCount": 2,
    "gitVersion": "git version 2.43.0",
    "rustVersion": "rustc ...",
    "gitpulseVersion": "0.5.3"
  },
  "fixture": { "path": "/tmp/...", "bytes": 0, "kept": false },
  "measurements": {
    "generationMs": 0,
    "firstScanMs": 0,
    "firstScanScannedDirs": 0,
    "warmScan": { "samplesMs": [], "p50Ms": 0, "p95Ms": 0 },
    "extraction": {
      "timing": { "samplesMs": [], "p50Ms": 0, "p95Ms": 0 },
      "commitCount": 50000,
      "warningCount": 0,
      "concurrency": 2,
      "summaryBytes": 0,
      "detailedBytes": 0
    },
    "cancellation": {
      "requestedAtScannedDirs": 0,
      "responseMs": 1,
      "cancelled": true
    },
    "processPeakRssBytes": 0
  },
  "thresholds": {},
  "failures": [],
  "passed": true
}
```

- Warm scan and extraction retain original samples and use nearest-rank P50/P95.
- Durations below 1 ms are serialized as 1 ms. Unsupported RSS platforms use
  `null`, never a fabricated zero.
- Repository count, commit count, and cancellation semantics are correctness
  checks. Timing and supported-platform RSS are threshold checks.
- Thresholds are broad cross-machine guards, not product SLAs. Review raw samples
  against `docs/performance-baseline.md` when evaluating a performance-sensitive
  change; `passed: true` alone is insufficient for fine-grained comparison.

## 4. Validation And Error Matrix

| Condition | Required behavior |
| --- | --- |
| Unknown profile/option or iterations outside `2..10` | Print a Chinese diagnostic to stderr and exit `2` |
| Requested fixture is non-empty without a valid marker | Refuse to delete or overwrite it |
| Fixture generation or business scan/extraction fails | Return an error, clean only a marker-controlled fixture, and exit `2` |
| Output is inside a fixture that will be cleaned | Reject the output path |
| Correctness or threshold check fails | Write/print JSON first, set `passed: false`, then exit `1` |
| Same failure with `--allow-regressions` | Preserve failures and `passed: false`, but exit `0` |
| `--keep-fixture` is set | Report `kept: true` and retain the controlled fixture |
| Unsupported RSS platform | Serialize `processPeakRssBytes: null` and skip the RSS limit |

Fixture cleanup requires `.gitpulse-benchmark-fixture` containing exactly the
recognized v1 marker line. All repositories, identities, dates, messages, and
file contents are deterministic synthetic data; Git network operations are
forbidden.

## 5. Good, Base, And Bad Cases

- Good: run `standard` before and after a report hot-path refactor, compare raw
  P50/P95 and memory values, and keep both ignored JSON artifacts for local review.
- Base: run `smoke` to verify the binary, exact counts, cancellation, schema, and
  cleanup contract quickly.
- Bad: point the tool at a real workspace, claim first-pass scan is a physical
  cold-cache result, or treat a broad threshold pass as proof of no regression.

## 6. Tests Required

Run these checks for benchmark or measured hot-path changes:

```bash
cd src-tauri
cargo fmt --all -- --check
cargo test --bin gitpulse-workspace-benchmark
cargo check
cargo test
cargo run --release --bin gitpulse-workspace-benchmark -- \
  --profile smoke --output ../artifacts/benchmarks/smoke.json
```

Before release or a scan/report architecture change, also run `standard` and
`large`. Tests must assert profile scale, exact commit distribution,
nearest-rank statistics, CLI rejection, cleanup refusal without a marker,
threshold failure payloads, and an end-to-end scan/extraction/cancellation case.

## 7. Wrong Versus Correct

Do not compile invariant regular expressions inside per-commit helpers or dedupe
large report batches by scanning an ever-growing `Vec`:

```rust
// Wrong: repeated compilation and O(n^2) duplicate checks.
let pattern = Regex::new(r"\s+").unwrap();
if !result.iter().any(|current| current.title == item.title) {
    result.push(item.clone());
}
```

Cache invariant regular expressions and preserve first-seen ordering with a set:

```rust
// Correct: one compiled regex and expected O(n) deduplication.
static WHITESPACE: OnceLock<Regex> = OnceLock::new();
let pattern = WHITESPACE.get_or_init(|| Regex::new(r"\s+").expect("valid regex"));
let mut seen = HashSet::new();
let unique = items
    .iter()
    .filter(|item| seen.insert(item.title.as_str()))
    .cloned()
    .collect::<Vec<_>>();
```

This distinction is observable at 50,000 commits and must remain covered by a
large-batch regression test.
