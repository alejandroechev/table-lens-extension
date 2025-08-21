# Creating placeholder icons using PowerShell and .NET

Add-Type -AssemblyName System.Drawing

function Create-PlaceholderIcon {
    param(
        [int]$Size,
        [string]$OutputPath
    )
    
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Create gradient background
    $startColor = [System.Drawing.Color]::FromArgb(102, 126, 234)  # #667eea
    $endColor = [System.Drawing.Color]::FromArgb(118, 75, 162)     # #764ba2
    
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.Point]::new(0, 0),
        [System.Drawing.Point]::new($Size, $Size),
        $startColor,
        $endColor
    )
    
    # Fill background
    $graphics.FillRectangle($brush, 0, 0, $Size, $Size)
    
    # Add chart icon (simple bars)
    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 2)
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    
    if ($Size -ge 32) {
        # Draw simple bar chart
        $barWidth = [math]::Max(2, $Size / 8)
        $spacing = [math]::Max(2, $Size / 12)
        $centerX = $Size / 2
        $baseY = $Size * 0.8
        
        # Three bars of different heights
        $heights = @($Size * 0.3, $Size * 0.5, $Size * 0.2)
        
        for ($i = 0; $i -lt 3; $i++) {
            $x = $centerX - ($barWidth * 1.5) + ($i * ($barWidth + $spacing))
            $y = $baseY - $heights[$i]
            $graphics.FillRectangle($whiteBrush, $x, $y, $barWidth, $heights[$i])
        }
    } else {
        # For small icons, just draw a simple shape
        $centerX = $Size / 2
        $centerY = $Size / 2
        $radius = $Size / 4
        $graphics.FillEllipse($whiteBrush, $centerX - $radius, $centerY - $radius, $radius * 2, $radius * 2)
    }
    
    # Save the image
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Clean up
    $graphics.Dispose()
    $bitmap.Dispose()
    $brush.Dispose()
    $whitePen.Dispose()
    $whiteBrush.Dispose()
}

# Create icons directory if it doesn't exist
if (-not (Test-Path "icons")) {
    New-Item -ItemType Directory -Path "icons" -Force | Out-Null
}

# Create placeholder icons
$sizes = @(16, 32, 48, 128)
foreach ($size in $sizes) {
    $outputPath = "icons/icon$size.png"
    try {
        Create-PlaceholderIcon -Size $size -OutputPath $outputPath
        Write-Host "✅ Created $outputPath ($($size)x$size)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to create $outputPath : $_" -ForegroundColor Red
    }
}