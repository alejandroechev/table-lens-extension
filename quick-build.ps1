# Quick Build Script for TableLens Extension
# Simple version that just creates the zip file

Write-Host "📦 Quick build for TableLens Extension..." -ForegroundColor Green

$zipName = "tablelens-extension-quick.zip"

# Remove old zip if exists
if (Test-Path $zipName) {
    Remove-Item $zipName -Force
    Write-Host "🗑️ Removed old zip file" -ForegroundColor Yellow
}

# Files and folders to include in the extension
$includeItems = @(
    # Core files
    "manifest.json",
    "popup.html", "popup.css", "popup.js",
    "content.js", "content.css", 
    "table-viewer.html", "table-viewer.js",
    "chart.html", "chart.js",
    
    # Directories
    "icons",
    "libs", 
    "utils"
)

# Create zip file
Write-Host "📋 Including files:" -ForegroundColor Cyan
$filesToZip = @()

foreach ($item in $includeItems) {
    if (Test-Path $item) {
        $filesToZip += $item
        if (Test-Path $item -PathType Container) {
            Write-Host "  📁 $item/" -ForegroundColor Gray
        } else {
            Write-Host "  📄 $item" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠️ Missing: $item" -ForegroundColor Red
    }
}

try {
    Compress-Archive -Path $filesToZip -DestinationPath $zipName -CompressionLevel Optimal -Force
    
    $zipInfo = Get-Item $zipName
    $sizeMB = [math]::Round($zipInfo.Length / 1MB, 2)
    
    Write-Host ""
    Write-Host "✅ Success! Created $zipName ($sizeMB MB)" -ForegroundColor Green
    Write-Host "🚀 Ready to upload to Chrome Web Store" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Failed to create zip: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}