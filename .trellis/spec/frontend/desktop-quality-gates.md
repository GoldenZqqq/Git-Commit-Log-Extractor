# Desktop Quality Gate Contract

## Scenario: Real Tauri WebView smoke

### 1. Scope / Trigger

This contract applies when changing desktop startup, onboarding, Tauri command registration, responsive layout, overlay accessibility, or CI/release verification. It prevents browser mocks from being treated as proof that the packaged WebView can start and reach Rust IPC.

### 2. Signatures

```text
npm run test:e2e:a11y
npm run test:e2e:responsive
npm run build:tauri:smoke
npm run test:tauri-smoke -- [absolute-or-relative-debug-binary]
```

The smoke client uses these local WebDriver endpoints:

```text
GET    /status
POST   /session
POST   /session/{id}/execute/sync
POST   /session/{id}/execute/async
GET    /session/{id}/screenshot
DELETE /session/{id}
```

### 3. Contracts

- `build:tauri:smoke` must set `VITE_TAURI_SMOKE=1` while building the debug binary. This compile-time flag disables only the automatic startup updater check so the smoke runtime has no updater/GitHub dependency.
- Manual update behavior and all normal/release builds keep their existing updater behavior.
- `TAURI_SMOKE_ARTIFACT_DIR` optionally overrides `artifacts/tauri-smoke`.
- `TAURI_SMOKE_PORT`, `TAURI_SMOKE_TIMEOUT_MS`, and `TAURI_DRIVER_PATH` are optional local overrides.
- Windows requires `tauri-driver` and a matching `msedgedriver` on `PATH`. Non-Windows execution prints an explicit skip and exits successfully.
- A passing smoke proves the `工作报告工作台` heading and an object response from `window.__TAURI_INTERNALS__.invoke("get_git_identity")`.
- Failure output contains `summary.json`, `app.log`, driver stdout/stderr, and `failure.png` when a session exists.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Debug binary missing | Fail before starting the driver and name the missing path. |
| Driver unavailable or exits early | Fail with driver startup/exit detail and preserve logs. |
| Onboarding is present | Click the explicit skip action, then continue polling. |
| Workbench never appears | Fail after the bounded timeout and capture a screenshot. |
| `get_git_identity` rejects or returns a non-object | Fail the smoke and record the IPC error. |
| Session cleanup fails | Keep the original result, record cleanup failure in `app.log`, and stop the driver. |

### 5. Good / Base / Bad Cases

- Good: a fresh Windows profile opens onboarding, skips it, renders the workbench, completes local IPC, and cleans up all processes.
- Base: an existing profile opens directly to the workbench and completes the same IPC check.
- Bad: browser-only Playwright passes while the Tauri binary cannot start or the Rust command is not registered; the Windows smoke must fail.

### 6. Tests Required

- Accessibility: changed overlays have focus entry, Tab/Escape navigation, trigger restoration, and no serious/critical axe violations.
- Responsive: `320x900`, `640x450`, and `1280x480` assert overflow, bounding boxes, dialog bounds, and screenshots.
- WebView: build the real debug binary, run `test:tauri-smoke`, assert workbench heading and `get_git_identity` round trip.
- Release-impacting changes still run full Playwright, `npm run build`, `cargo fmt -- --check`, `cargo check`, `cargo test`, and `git diff --check`.

### 7. Wrong vs Correct

#### Wrong

```yaml
- run: npm run test:e2e
# Browser mocks pass, so desktop startup is assumed healthy.
```

#### Correct

```yaml
- run: npm run test:e2e:a11y
- run: npm run test:e2e:responsive
- run: npm run test:e2e
- run: npm run build:tauri:smoke
- run: npm run test:tauri-smoke -- src-tauri/target/debug/gitpulse.exe
```

The real WebView step remains Windows-only; Linux/macOS do not claim equivalent coverage without a stable platform driver.
