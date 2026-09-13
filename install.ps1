# ==============================================================================
# Hermes-Cloud-Relay Installer for Windows (PowerShell)
# Compatible with Windows 10/11 & Windows Server
# ==============================================================================

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "⚡ Hermes-Cloud-Relay: نصب خودکار در ویندوز (PowerShell)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Check Python availability
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    $pythonCmd = Get-Command python3 -ErrorAction SilentlyContinue
}

if (-not $pythonCmd) {
    Write-Host "❌ پایتون در سیستم شما یافت نشد. لطفاً ابتدا Python را از سایت python.org یا مایکروسافت استور نصب کنید." -ForegroundColor Red
    exit 1
}

$scriptUrl = "https://raw.githubusercontent.com/ketabchi-ar/Hermes-Cloud-Relay/main/auto_deploy.py?ts=" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Write-Host "📥 در حال اجرای اسکریپت خودکار..." -ForegroundColor Yellow
$pyScript = (Invoke-RestMethod -Uri $scriptUrl)
$pyScript | python -
