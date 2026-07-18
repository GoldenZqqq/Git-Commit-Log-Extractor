$ErrorActionPreference = "Continue"
$log = "C:\Learn\git_pulse\.trellis\tasks\07-14-blank-day-report-fill\cargo-check.log"
Set-Location C:\Learn\git_pulse\src-tauri
"=== cargo test blank_day $(Get-Date -Format o) ===" | Set-Content $log -Encoding UTF8
cargo test blank_day -- --nocapture 2>&1 | Add-Content $log -Encoding UTF8
"test_exit=$LASTEXITCODE" | Add-Content $log -Encoding UTF8
"=== cargo check ===" | Add-Content $log -Encoding UTF8
cargo check 2>&1 | Add-Content $log -Encoding UTF8
"check_exit=$LASTEXITCODE" | Add-Content $log -Encoding UTF8
"DONE $(Get-Date -Format o)" | Add-Content $log -Encoding UTF8
