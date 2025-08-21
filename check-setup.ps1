# Simple Setup Verification Script
Write-Host "Checking Table Chart Renderer Extension Setup..." -ForegroundColor Green

# Check Chart.js
if (Test-Path "libs/chart.min.js") {
    $size = (Get-Item "libs/chart.min.js").Length / 1KB
    Write-Host "Chart.js library: OK ($([math]::Round($size, 1)) KB)" -ForegroundColor Green
} else {
    Write-Host "Chart.js library: MISSING" -ForegroundColor Red
    Write-Host "Run: curl -o libs/chart.min.js https://cdn.jsdelivr.net/npm/chart.js/dist/chart.min.js" -ForegroundColor Yellow
}

# Check icons
$iconSizes = @(16, 32, 48, 128)
$iconCount = 0
foreach ($size in $iconSizes) {
    if (Test-Path "icons/icon$size.png") {
        $iconCount++
    }
}
Write-Host "Icons: $iconCount/4 present" -ForegroundColor $(if($iconCount -eq 4){"Green"}else{"Yellow"})

# Check core files
$coreFiles = @("manifest.json", "popup.html", "popup.js", "content.js", "chart.html", "chart.js")
$fileCount = 0
foreach ($file in $coreFiles) {
    if (Test-Path $file) {
        $fileCount++
    }
}
Write-Host "Core files: $fileCount/$($coreFiles.Length) present" -ForegroundColor $(if($fileCount -eq $coreFiles.Length){"Green"}else{"Red"})

Write-Host "`nTo install:" -ForegroundColor Cyan
Write-Host "1. Open Chrome/Edge -> chrome://extensions/" -ForegroundColor White
Write-Host "2. Enable Developer mode" -ForegroundColor White
Write-Host "3. Click Load unpacked -> select this folder" -ForegroundColor White

if ($fileCount -eq $coreFiles.Length -and (Test-Path "libs/chart.min.js") -and $iconCount -eq 4) {
    Write-Host "`nExtension is ready to install!" -ForegroundColor Green
} else {
    Write-Host "`nSome files are missing. Please check the requirements." -ForegroundColor Yellow
}