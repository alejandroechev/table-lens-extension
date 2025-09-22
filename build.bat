@echo off
echo.
echo 📦 Building TableLens Extension...
echo.

REM Remove old zip file if it exists
if exist "tablelens-extension.zip" (
    del "tablelens-extension.zip"
    echo 🗑️ Removed old zip file
)

REM Check if PowerShell is available
powershell -Command "Get-Host" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PowerShell not found. Please install PowerShell.
    pause
    exit /b 1
)

REM Run the PowerShell build script
powershell -ExecutionPolicy Bypass -File "build-extension.ps1"

if %errorlevel% equ 0 (
    echo.
    echo ✅ Build completed successfully!
    echo 📁 Check for tablelens-extension.zip file
) else (
    echo.
    echo ❌ Build failed. Check the output above for errors.
)

echo.
pause