$ErrorActionPreference = "Continue"
$output = & npx next build 2>&1 | Out-String
Write-Host "=== BUILD OUTPUT ==="
Write-Host $output
if ($output -match "error" -or $output -match "Error" -or $output -match "failed") {
    Write-Host "=== BUILD FAILED ==="
    exit 1
} else {
    Write-Host "=== BUILD OK ==="
    exit 0
}
