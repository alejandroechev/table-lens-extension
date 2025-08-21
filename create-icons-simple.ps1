# Simple icon creation script
Add-Type -AssemblyName System.Drawing

function Create-SimpleIcon {
    param([int]$Size, [string]$Path)
    
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Blue background
    $blueBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(102, 126, 234))
    $graphics.FillRectangle($blueBrush, 0, 0, $Size, $Size)
    
    # White shape in center
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $centerX = $Size / 2
    $centerY = $Size / 2
    
    if ($Size -ge 32) {
        # Draw bars for larger icons
        $barWidth = [int]($Size / 8)
        $barHeight1 = [int]($Size * 0.3)
        $barHeight2 = [int]($Size * 0.5) 
        $barHeight3 = [int]($Size * 0.2)
        
        $baseY = [int]($Size * 0.8)
        $startX = [int]($centerX - ($barWidth * 1.5))
        
        $graphics.FillRectangle($whiteBrush, $startX, $baseY - $barHeight1, $barWidth, $barHeight1)
        $graphics.FillRectangle($whiteBrush, $startX + $barWidth + 2, $baseY - $barHeight2, $barWidth, $barHeight2)
        $graphics.FillRectangle($whiteBrush, $startX + ($barWidth + 2) * 2, $baseY - $barHeight3, $barWidth, $barHeight3)
    } else {
        # Simple circle for small icons
        $radius = [int]($Size / 4)
        $graphics.FillEllipse($whiteBrush, $centerX - $radius, $centerY - $radius, $radius * 2, $radius * 2)
    }
    
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $bitmap.Dispose()
    $blueBrush.Dispose()
    $whiteBrush.Dispose()
}

# Create icons
$sizes = @(16, 32, 48, 128)
foreach ($size in $sizes) {
    $path = "icons/icon$size.png"
    Create-SimpleIcon -Size $size -Path $path
    Write-Host "Created $path"
}