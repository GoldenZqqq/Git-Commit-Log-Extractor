$ErrorActionPreference = "Continue"
$out = "C:\Learn\git_pulse\.trellis\tasks\07-14-blank-day-report-fill\full-verify.out"
function Log($m) { Add-Content $out $m -Encoding UTF8 }
Set-Content $out "start $(Get-Date -Format o)" -Encoding UTF8
while (Get-Process cargo,rustc -ErrorAction SilentlyContinue) { Start-Sleep 3 }
Set-Location C:\Learn\git_pulse\src-tauri
cargo test blank_day -- --nocapture 2>&1 | ForEach-Object { Log $_ }
Log "test_exit=$LASTEXITCODE"
cargo check 2>&1 | ForEach-Object { Log $_ }
Log "check_exit=$LASTEXITCODE"
Set-Location C:\Learn\git_pulse
npx tsc --noEmit 2>&1 | ForEach-Object { Log $_ }
Log "tsc_exit=$LASTEXITCODE"
Log "DONE $(Get-Date -Format o)"
