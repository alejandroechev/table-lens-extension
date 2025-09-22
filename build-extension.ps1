# Build TableLens Extension for Chrome Web Store
# Creates a production-ready zip file containing only essential extension files

param(
    [string]$OutputName = "tablelens-extension",
    [switch]$Verbose
)

Write-Host "🏗️  Building TableLens Extension for Chrome Web Store..." -ForegroundColor Cyan
Write-Host ""

# Configuration
$buildDir = "extension-build"
$zipName = "$OutputName.zip"
$outputPath = Join-Path (Get-Location) $zipName

# Clean previous build
if (Test-Path $buildDir) {
    Remove-Item -Recurse -Force $buildDir
    if ($Verbose) { Write-Host "🧹 Cleaned previous build directory" -ForegroundColor Yellow }
}

if (Test-Path $outputPath) {
    Remove-Item -Force $outputPath
    if ($Verbose) { Write-Host "🧹 Removed previous zip file" -ForegroundColor Yellow }
}

# Create build directory
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null

Write-Host "📋 Copying essential extension files..." -ForegroundColor Green

# Core extension files (required for functionality)
$coreFiles = @(
    "manifest.json",
    "popup.html",
    "popup.js", 
    "popup.css",
    "content.js",
    "content.css",
    "table-viewer.html",
    "table-viewer.js",
    "chart.html",
    "chart.js"
)

# Copy core files
$copiedFiles = 0
$missingFiles = @()

foreach ($file in $coreFiles) {
    if (Test-Path $file) {
        Copy-Item $file $buildDir
        $copiedFiles++
        if ($Verbose) { Write-Host "  ✅ $file" -ForegroundColor Gray }
    } else {
        $missingFiles += $file
        Write-Host "  ⚠️  Missing: $file" -ForegroundColor Red
    }
}

Write-Host "📁 Copying required directories..." -ForegroundColor Green

# Essential directories
$requiredDirs = @(
    @{Name="icons"; Required=$true; Description="Extension icons"},
    @{Name="libs"; Required=$true; Description="JavaScript libraries"},
    @{Name="utils"; Required=$true; Description="Utility modules"}
)

$copiedDirs = 0

foreach ($dir in $requiredDirs) {
    if (Test-Path $dir.Name) {
        Copy-Item -Recurse $dir.Name $buildDir
        $copiedDirs++
        if ($Verbose) { Write-Host "  ✅ $($dir.Name)/ - $($dir.Description)" -ForegroundColor Gray }
    } else {
        Write-Host "  ❌ Missing required directory: $($dir.Name)/" -ForegroundColor Red
        if ($dir.Required) {
            Write-Host "     This directory is required for the extension to work properly." -ForegroundColor Red
        }
    }
}

# Validate manifest.json
Write-Host "🔍 Validating extension manifest..." -ForegroundColor Blue
$manifestPath = Join-Path $buildDir "manifest.json"
if (Test-Path $manifestPath) {
    try {
        $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
        
        Write-Host "  ✅ Extension Name: $($manifest.name)" -ForegroundColor Gray
        Write-Host "  ✅ Version: $($manifest.version)" -ForegroundColor Gray
        Write-Host "  ✅ Manifest Version: $($manifest.manifest_version)" -ForegroundColor Gray
        Write-Host "  ✅ Description: $($manifest.description)" -ForegroundColor Gray
        
        # Validate required permissions
        $requiredPermissions = @("activeTab", "storage", "downloads")
        $missingPermissions = @()
        foreach ($perm in $requiredPermissions) {
            if ($manifest.permissions -notcontains $perm) {
                $missingPermissions += $perm
            }
        }
        
        if ($missingPermissions.Count -eq 0) {
            Write-Host "  ✅ All required permissions present" -ForegroundColor Gray
        } else {
            Write-Host "  ⚠️  Missing permissions: $($missingPermissions -join ', ')" -ForegroundColor Yellow
        }
        
        # Check for background script (should not be present for performance)
        if ($manifest.background) {
            Write-Host "  ⚠️  Background script detected - consider removing for better performance" -ForegroundColor Yellow
        } else {
            Write-Host "  ✅ No background script (optimal for performance)" -ForegroundColor Gray
        }
        
        # Validate icons
        $iconSizes = @(16, 32, 48, 128)
        foreach ($size in $iconSizes) {
            $iconPath = Join-Path $buildDir "icons" "icon$size.png"
            if (Test-Path $iconPath) {
                if ($Verbose) { Write-Host "  ✅ Icon $size×$size found" -ForegroundColor Gray }
            } else {
                Write-Host "  ⚠️  Missing icon: icons/icon$size.png" -ForegroundColor Yellow
            }
        }
        
    } catch {
        Write-Host "  ❌ Invalid JSON in manifest.json: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ❌ manifest.json not found in build directory" -ForegroundColor Red
    exit 1
}

# Validate required libraries
Write-Host "📚 Checking required libraries..." -ForegroundColor Blue
$requiredLibs = @(
    @{File="chart.min.js"; Description="Chart.js for visualizations"},
    @{File="xlsx.full.min.js"; Description="SheetJS for Excel export"},
)

foreach ($lib in $requiredLibs) {
    $libPath = Join-Path $buildDir "libs" $lib.File
    if (Test-Path $libPath) {
        if ($Verbose) { Write-Host "  ✅ $($lib.File) - $($lib.Description)" -ForegroundColor Gray }
    } else {
        Write-Host "  ⚠️  Missing library: $($lib.File) - $($lib.Description)" -ForegroundColor Yellow
    }
}

# Create zip file
Write-Host "📦 Creating extension package..." -ForegroundColor Blue
try {
    # Use .NET compression for better compatibility
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($buildDir, $outputPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    Write-Host "  ✅ Created: $zipName" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Failed to create zip: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Get package information
$zipInfo = Get-Item $outputPath
$sizeMB = [math]::Round($zipInfo.Length / 1MB, 2)
$sizeKB = [math]::Round($zipInfo.Length / 1KB, 1)

Write-Host ""
Write-Host "🎉 Extension package ready for Chrome Web Store!" -ForegroundColor Green
Write-Host "📄 File: $zipName" -ForegroundColor Cyan
Write-Host "📊 Size: $sizeMB MB ($sizeKB KB)" -ForegroundColor Cyan
Write-Host "📁 Files: $copiedFiles core files + $copiedDirs directories" -ForegroundColor Cyan

# List package contents for verification
if ($Verbose) {
    Write-Host ""
    Write-Host "📋 Package contents:" -ForegroundColor Blue
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($outputPath)
    
    $zip.Entries | Sort-Object Name | ForEach-Object {
        $itemSizeKB = [math]::Round($_.Length / 1KB, 1)
        Write-Host "  $($_.Name) ($itemSizeKB KB)" -ForegroundColor Gray
    }
    $zip.Dispose()
}

Write-Host ""
Write-Host "📤 Chrome Web Store submission steps:" -ForegroundColor Yellow
Write-Host "  1. Go to https://chrome.google.com/webstore/devconsole" -ForegroundColor Gray
Write-Host "  2. Click 'New Item' or update existing extension" -ForegroundColor Gray
Write-Host "  3. Upload $zipName" -ForegroundColor Gray
Write-Host "  4. Complete store listing details (description, screenshots, etc.)" -ForegroundColor Gray
Write-Host "  5. Submit for review" -ForegroundColor Gray

# Report any issues
if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  Warning: Missing core files:" -ForegroundColor Yellow
    foreach ($file in $missingFiles) {
        Write-Host "  - $file" -ForegroundColor Red
    }
    Write-Host "  Extension may not work correctly without these files." -ForegroundColor Yellow
}

# Clean up build directory
Remove-Item -Recurse -Force $buildDir
if ($Verbose) { Write-Host "🧹 Cleaned temporary build directory" -ForegroundColor Yellow }

Write-Host ""
Write-Host "✨ Build complete! Extension ready for Chrome Web Store." -ForegroundColor Green

# Return success/warning exit code
if ($missingFiles.Count -gt 0) {
    exit 1
} else {
    exit 0
}