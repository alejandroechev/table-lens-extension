# Table Chart Renderer Extension Setup Script

Write-Host "Table Chart Renderer Extension Setup..." -ForegroundColor Green

# Check if Chart.js exists
$chartJsPath = "libs/chart.min.js"
if (Test-Path $chartJsPath) {
    $chartSize = (Get-Item $chartJsPath).Length
    Write-Host "Chart.js library found ($([math]::Round($chartSize/1KB, 2)) KB)" -ForegroundColor Green
} else {
    Write-Host "Downloading Chart.js library..." -ForegroundColor Yellow
    try {
        if (-not (Test-Path "libs")) {
            New-Item -ItemType Directory -Path "libs" -Force
        }
        Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/chart.js/dist/chart.min.js" -OutFile $chartJsPath
        Write-Host "✅ Chart.js downloaded successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to download Chart.js: $_" -ForegroundColor Red
        Write-Host "Please download manually from: https://cdn.jsdelivr.net/npm/chart.js/dist/chart.min.js" -ForegroundColor Yellow
    }
}

# Check for icons
$iconSizes = @(16, 32, 48, 128)
$missingIcons = @()

foreach ($size in $iconSizes) {
    $iconPath = "icons/icon$size.png"
    if (Test-Path $iconPath) {
        Write-Host "✅ Icon $($size)x$size found" -ForegroundColor Green
    } else {
        $missingIcons += $size
    }
}

if ($missingIcons.Count -gt 0) {
    Write-Host "⚠️ Missing icons: $($missingIcons -join ', ')" -ForegroundColor Yellow
    Write-Host "📝 Please create PNG icons with these dimensions and place them in the 'icons' folder:" -ForegroundColor Yellow
    foreach ($size in $missingIcons) {
        Write-Host "   - icons/icon$size.png ($size x $size pixels)" -ForegroundColor Cyan
    }
    Write-Host "See ICONS.md for creation instructions" -ForegroundColor Blue
}

# Check if all files exist
$requiredFiles = @(
    "manifest.json",
    "popup.html",
    "popup.css", 
    "popup.js",
    "content.js",
    "content.css",
    "chart.html",
    "chart.js"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $file" -ForegroundColor Red
        $allFilesExist = $false
    }
}

Write-Host "`n📋 Setup Summary:" -ForegroundColor Cyan
if ($allFilesExist -and (Test-Path $chartJsPath)) {
    Write-Host "✅ All core files are present" -ForegroundColor Green
} else {
    Write-Host "⚠️ Some required files are missing" -ForegroundColor Yellow
}

if ($missingIcons.Count -eq 0) {
    Write-Host "✅ All icons are present" -ForegroundColor Green
} else {
    Write-Host "⚠️ $($missingIcons.Count) icon(s) missing" -ForegroundColor Yellow
}

Write-Host "`n🎯 Next Steps:" -ForegroundColor Cyan
if ($missingIcons.Count -gt 0) {
    Write-Host "1. Create missing icon files (see ICONS.md)" -ForegroundColor White
    Write-Host "2. Load extension in Chrome/Edge" -ForegroundColor White
} else {
    Write-Host "1. Open Chrome/Edge and go to chrome://extensions/ or edge://extensions/" -ForegroundColor White
    Write-Host "2. Enable 'Developer mode'" -ForegroundColor White
    Write-Host "3. Click 'Load unpacked' and select this folder" -ForegroundColor White
    Write-Host "4. Start using the extension on web pages with tables!" -ForegroundColor White
}

Write-Host "`n📚 Documentation:" -ForegroundColor Cyan
Write-Host "• README.md - Complete usage guide" -ForegroundColor White
Write-Host "• ICONS.md - Icon creation instructions" -ForegroundColor White

Write-Host "`n🎉 Setup complete! Happy chart making! 📊" -ForegroundColor Green