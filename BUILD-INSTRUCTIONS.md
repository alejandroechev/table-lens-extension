# Building TableLens Extension for Chrome Web Store

This directory contains several scripts to help you build a production-ready zip file for Chrome Web Store submission.

## 📦 Available Build Scripts

### 1. **build-extension.ps1** (Recommended)
The main build script with comprehensive validation and reporting.

```powershell
# Full build with detailed output
.\build-extension.ps1 -Verbose

# Quiet build (minimal output)
.\build-extension.ps1

# Custom output name
.\build-extension.ps1 -OutputName "my-extension"
```

**Features:**
- ✅ Validates manifest.json structure and permissions
- ✅ Checks for required icons (16x16, 32x32, 48x48, 128x128)
- ✅ Verifies essential JavaScript libraries are present
- ✅ Creates optimized zip file ready for Chrome Web Store
- ✅ Provides detailed file inventory and size information
- ✅ Shows Chrome Web Store submission instructions

### 2. **quick-build.ps1**
Simple script for fast builds without extensive validation.

```powershell
.\quick-build.ps1
```

**Features:**
- ✅ Quick zip creation with essential files
- ✅ Minimal output, fast execution
- ✅ Good for development iterations

### 3. **build.bat**
Double-click batch file that calls the main PowerShell script.

```batch
# Just double-click the file or run:
build.bat
```

**Features:**
- ✅ No PowerShell knowledge required
- ✅ Windows-friendly double-click execution
- ✅ Automatically checks for PowerShell availability

## 📁 Files Included in Extension Package

### Core Extension Files
- `manifest.json` - Extension configuration
- `popup.html/css/js` - Main extension interface
- `content.js/css` - Web page interaction scripts
- `table-viewer.html/js` - Advanced table analysis interface
- `chart.html/js` - Chart generation functionality

### Required Directories
- `icons/` - Extension icons (16, 32, 48, 128px PNG files)
- `libs/` - JavaScript libraries (Chart.js, SheetJS, PDF.js, etc.)
- `utils/` - Utility modules (license management, column detection, etc.)

### Files **NOT** Included (Development Only)
- `tests/` - Test suite and validation scripts
- `docs/` - Development documentation
- `DEV-MODE-TESTING.md` - Developer testing guide
- `*.ps1` - Build scripts
- `package.json` - Node.js development configuration
- `.git/` - Git version control data

## 🚀 Chrome Web Store Submission

After running the build script:

1. **Go to Chrome Web Store Developer Dashboard**
   ```
   https://chrome.google.com/webstore/devconsole
   ```

2. **Create New Item or Update Existing**
   - Click "New Item" for first-time submission
   - Click on existing item to update

3. **Upload Extension Package**
   - Upload the generated `tablelens-extension.zip` file
   - Chrome Web Store will automatically validate the package

4. **Complete Store Listing**
   - Add description, screenshots, promotional images
   - Set category, language, pricing
   - Configure distribution settings

5. **Submit for Review**
   - Review all information
   - Submit to Chrome Web Store review team
   - Wait for approval (typically 1-3 days)

## 🔍 Validation Checks

The build script automatically validates:

### Manifest Validation
- ✅ Valid JSON structure
- ✅ Required permissions (activeTab, storage, downloads)
- ✅ Correct Manifest V3 format
- ✅ Extension name, version, description

### File Validation  
- ✅ All core extension files present
- ✅ Icon files exist in correct sizes
- ✅ Required JavaScript libraries included
- ✅ No unnecessary development files

### Size Optimization
- ✅ Excludes test files and documentation
- ✅ Includes only production-ready code
- ✅ Optimal compression for faster upload

## ❌ Troubleshooting

**"PowerShell execution policy" error:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope CurrentUser
```

**Missing libraries warning:**
- Download required libraries to `libs/` folder
- Ensure Chart.js, SheetJS (xlsx.full.min.js) are present

**Missing icons error:**
- Create PNG icon files: 16x16, 32x32, 48x48, 128x128 pixels
- Place in `icons/` directory with names like `icon16.png`

**Large file size:**
- Current package should be ~0.5-1MB
- If larger, check for unnecessary files in build

## 📊 Expected Package Size

Typical TableLens extension package:
- **Size**: ~500KB - 1MB
- **Files**: ~25-30 files
- **Main contributors**: 
  - `xlsx.full.min.js` (~900KB) - Excel export functionality
  - `chart.min.js` (~180KB) - Chart visualization
  - `table-viewer.js` (~120KB) - Main application logic

## 🔐 Security Notes

- No external API keys included in package
- License management handled at runtime
- All sensitive configuration loaded dynamically
- Extension requests minimal permissions for security