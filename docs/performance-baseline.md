# GitPulse Workspace Performance Baseline

This document records the release-mode baseline for synthetic multi-repository
workspaces. It is intended for maintainers changing Git discovery, commit
extraction, or report rendering. It does not contain measurements from a user
workspace.

## Baseline Environment

Recorded on 2026-07-18:

| Field | Value |
| --- | --- |
| OS / architecture | Linux / aarch64 |
| Logical CPUs visible to process | 2 |
| Git | 2.43.0 |
| Rust | 1.97.1 (`8bab26f4f`, 2026-07-14) |
| GitPulse | 0.5.3 |
| Build mode | Cargo `--release` |
| AI / network | Disabled / offline |

`firstScanMs` is the first GitPulse scan after fixture generation. The benchmark
does not clear the operating system filesystem cache, so this metric must not be
described as a physical cold-cache measurement.

## Profiles

| Profile | Repositories | Total commits | Iterations | Purpose |
| --- | ---: | ---: | ---: | --- |
| `smoke` | 5 | 500 | 3 | Fast correctness check |
| `standard` | 50 | 50,000 | 3 | Routine release baseline |
| `large` | 200 | 50,000 | 3 | High repository-count baseline |

Repositories are generated deterministically with `git fast-import`. Every run
uses the same synthetic author, UTC date sequence, commit-message shape, and
single-file change pattern.

## Recorded Results

| Metric | Smoke | Standard | Large |
| --- | ---: | ---: | ---: |
| Fixture generation | 97 ms | 2,477 ms | 4,770 ms |
| First scan | 11 ms | 105 ms | 377 ms |
| Warm scan samples | 10 / 9 / 10 ms | 91 / 89 / 94 ms | 389 / 444 / 362 ms |
| Warm scan P50 / P95 | 10 / 10 ms | 91 / 94 ms | 389 / 444 ms |
| Extraction samples | 43 / 37 / 38 ms | 2,145 / 2,101 / 2,063 ms | 2,538 / 2,758 / 2,491 ms |
| Extraction P50 / P95 | 38 / 43 ms | 2,101 / 2,145 ms | 2,538 / 2,758 ms |
| Scan cancellation response | 1 ms | 2 ms | 1 ms |
| Peak RSS | 34.19 MiB | 133.50 MiB | 132.69 MiB |
| Fixture size | 0.29 MiB | 17.31 MiB | 21.34 MiB |
| Summary output size | 0.08 MiB | 8.16 MiB | 8.22 MiB |
| Repositories / commits verified | 5 / 500 | 50 / 50,000 | 200 / 50,000 |
| Result | Pass | Pass | Pass |

The standard result exposed and verified a report-rendering performance defect:

| Standard run | Extraction P95 | Finding |
| --- | ---: | --- |
| Initial implementation | 168,686 ms | Per-message regular expressions were repeatedly compiled |
| After caching message-cleaning regexes | 92,652 ms | Evidence regexes still recompiled; title dedupe remained O(n^2) |
| After caching all invariant regexes and using first-seen `HashSet` dedupe | 2,145 ms | Passed with exact output counts |

The final result is about 43 times faster than the intermediate 92,652 ms run
and about 79 times faster than the initial run. The optimization preserves
message cleaning, evidence extraction, and first-seen report ordering.

## Regression Thresholds

| Profile | First scan | Warm P95 | Extraction P95 | Cancellation | Peak RSS |
| --- | ---: | ---: | ---: | ---: | ---: |
| `smoke` | 5,000 ms | 3,000 ms | 20,000 ms | 250 ms | 1 GiB |
| `standard` | 15,000 ms | 10,000 ms | 90,000 ms | 250 ms | 2 GiB |
| `large` | 30,000 ms | 20,000 ms | 120,000 ms | 250 ms | 2 GiB |

These are deliberately broad portability and catastrophic-regression guards,
not user-facing SLAs or fine-grained budgets. A performance-sensitive change must
compare its raw samples with the recorded baseline and explain material shifts,
even when the JSON still reports `passed: true`. Repository/commit mismatches and
failed cancellation are correctness failures rather than threshold tolerances.

## Reproduction

```bash
cd src-tauri
cargo run --release --features workspace-benchmark --bin gitpulse-workspace-benchmark -- \
  --profile smoke \
  --output ../artifacts/benchmarks/smoke.json
cargo run --release --features workspace-benchmark --bin gitpulse-workspace-benchmark -- \
  --profile standard \
  --output ../artifacts/benchmarks/standard.json
cargo run --release --features workspace-benchmark --bin gitpulse-workspace-benchmark -- \
  --profile large \
  --output ../artifacts/benchmarks/large.json
```

The commands require the repository's normal Rust toolchain and Git on `PATH`.
Use the same release profile and record environment fields when comparing runs
from another machine.

Generated JSON lives under the ignored `artifacts/benchmarks/` directory. The
result includes raw samples, P50/P95, exact counts, environment, resource sizes,
thresholds, failure details, and `schemaVersion: 1`.

By default the tool uses a unique temporary directory and removes it only after
validating the GitPulse benchmark marker. Use `--keep-fixture` only for local
inspection. Never use `--fixture-dir` for a real or shared workspace.
