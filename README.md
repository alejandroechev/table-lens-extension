# TableLens - Advanced Table Extraction & Analysis Extension

A powerful browser extension that extracts tables from any webpage or PDF, transforms them into interactive charts, and exports data in multiple formats. Features a comprehensive workspace system for saving and managing your table analysis projects.

## 🚀 Key Features

### 📊 **Smart Table Extraction**
- **One-Click Detection**: Extract all tables from any webpage with a single button
- **PDF Support**: Advanced table extraction from PDF documents using external services
- **Multiple Formats**: Supports HTML tables, CSV data, and Markdown tables
- **Intelligent Detection**: Automatically identifies and prioritizes data-rich tables over container tables
- **OCR Capabilities**: Extract tables from images and complex layouts

### � **Interactive Charts & Analysis**
- **6 Chart Types**: Line, Bar, Horizontal Bar, Pie, Doughnut, and Scatter Plot charts
- **Smart Column Detection**: Automatic data type detection (numeric, categorical, money, percentage, date)
- **Advanced Filtering**: Excel-style popup filters with type-aware controls
- **Column Statistics**: Automatic calculation of sum, average, min, max, standard deviation
- **Theme Support**: Full dark/light theme with persistent user preferences

### 💾 **Workspace Management**
- **Save Workspaces**: Preserve complete table analysis sessions with charts, filters, and configurations
- **Cross-Page Loading**: Load saved workspaces from any browser tab or page
- **Named States**: Organize workspaces with custom names and timestamps
- **State Restoration**: Automatically restore previous work when reopening tables

### 📤 **Multiple Export Formats**
- **XLSX (Excel)**: Professional spreadsheet format with proper formatting
- **CSV**: Comma-separated values for data analysis
- **TSV**: Tab-separated values for specialized tools
- **Markdown**: GitHub-compatible table format
- **PNG/SVG Charts**: High-quality chart exports for presentations

### 🪪 **Flexible Licensing**
- **Free Tier**: 25 table extractions, 2 single XLSX exports, 5 export-all operations per month
- **Premium**: Unlimited extractions, exports, and workspace saves
- **License Management**: Built-in license verification and usage tracking
- **Monthly Resets**: Free tier quotas reset monthly

## 🎯 Quick Start

### Installation
1. **Download the extension files** to a local folder
2. **Open Chrome/Edge** and navigate to `chrome://extensions/` or `edge://extensions/`
3. **Enable "Developer mode"** (toggle in top-right corner)
4. **Click "Load unpacked"** and select the extension folder
5. **Start extracting tables!** Click the TableLens icon on any webpage

### Basic Usage
1. **Navigate to any webpage** with tables or open a PDF document
2. **Click the TableLens extension icon** in your browser toolbar
3. **Click "Extract All Tables"** - the extension automatically detects the content type
4. **Browse detected tables** in the popup with live previews
5. **Click any table** to open the full analysis interface
6. **Create charts, apply filters, and export data** as needed
7. **Save workspaces** to preserve your analysis for later

## 📋 Supported Data Sources

### Web Pages
- **HTML Tables**: Standard `<table>` elements with proper structure
- **CSV Data**: Comma-separated data in `<pre>` or `<code>` blocks
- **Markdown Tables**: GitHub-style markdown table format
- **Selected Text**: Copy-paste tabular data from any source

### PDF Documents  
- **Automatic Detection**: Recognizes PDF URLs and switches to PDF extraction mode
- **Advanced Service**: Uses external API for robust PDF table extraction
- **Multi-Page Support**: Extracts tables from entire PDF documents
- **Fallback Options**: Page range selection for legacy services

### Images & OCR
- **Screen Capture**: Select table regions for OCR-based extraction
- **Image Upload**: Process uploaded images containing tabular data
- **Tesseract Integration**: Built-in OCR capabilities for text recognition

## 🛠️ Advanced Features

### Column Type Detection & Formatting
- **Auto-Detection**: Automatically identifies numeric, categorical, money, percentage, and date columns
- **Manual Override**: Click column headers to change data types with emoji indicators
- **Locale Support**: Handles international number formats (Chilean pesos, European decimals)
- **Smart Parsing**: Automatic thousand/decimal separator detection

### Excel-Style Filtering
- **Popup Filters**: Click dropdown arrows (▼) in column headers for type-aware filter controls
- **Range Filters**: Min/max inputs for numeric, money, and percentage columns
- **Date Ranges**: From/to date pickers for temporal data
- **Multi-Select**: Categorical filters with search and multiple selection
- **Smart Positioning**: Filter popups adjust position based on viewport boundaries

### Workspace & State Management
- **Auto-Save**: Table states automatically persist across browser sessions
- **Named Workspaces**: Save analysis sessions with custom names and timestamps
- **Cross-Page Loading**: Access saved workspaces from any browser tab
- **Complete State**: Preserves charts, filters, sorting, column types, and UI preferences
- **Data Validation**: Fingerprint checking ensures state compatibility

### Chart System
- **Dynamic UI**: Chart controls show only valid columns based on data types
- **Smart Defaults**: Auto-selection of appropriate axes based on column content
- **Theme Integration**: Charts automatically match light/dark theme preferences
- **Export Quality**: High-resolution PNG and vector SVG export options

## 🧰 Technical Architecture

### File Structure
```
TableLens/
├── manifest.json              # Extension configuration (Manifest V3)
├── popup.html/css/js         # Main extension interface
├── table-viewer.html/js      # Full table analysis interface
├── content.js                # Web page interaction and table detection
├── ocr-capture.js           # Screen capture and OCR functionality
├── icons/                   # Extension icons (16, 32, 48, 128px)
├── libs/
│   ├── chart.min.js         # Chart.js for visualizations
│   ├── xlsx.full.min.js     # SheetJS for Excel export
│   ├── pdf.min.js           # PDF.js for PDF processing
│   └── tesseract.min.js     # OCR capabilities
├── utils/
│   ├── license.js           # License management system
│   ├── columnTypes.js       # Column type detection logic
│   ├── numberFormat.js      # Locale-aware number parsing
│   ├── stats.js             # Statistical calculations
│   └── tableNesting.js      # Nested table handling
└── tests/                   # Comprehensive test suite
```

### Core Components
- **PopupController**: Main extension interface with context-aware extraction
- **TableViewer**: Full-featured table analysis with charts and filtering
- **LicenseManager**: Free/premium tier management with monthly quotas
- **TableDetector**: Intelligent table discovery and prioritization
- **StateManager**: Persistent workspace and session management

## 🧪 Development & Testing

### Dev Mode (Monthly Reset Testing)
TableLens includes a hidden dev mode for testing monthly quota resets:
1. **Enable Dev Panel**: Press `Ctrl+Shift+D` in the extension popup
2. **Activate Dev Mode**: Click "Enable Dev Mode" button
3. **Test Scenarios**: Use buttons to simulate different usage levels
4. **Month Simulation**: Test monthly resets without waiting 30 days

### Test Suite
Run the comprehensive test suite to ensure code quality:
```bash
npm test
# or
node tests/run-tests.js
```

**Test Coverage** (27 tests passing):
- Column type detection using production code
- Number format parsing (locale-aware)
- Statistical calculations (sum, avg, min, max, std)
- Table cleanup (empty row/column removal)  
- HTML parsing with rowspan/colspan support
- Nested table detection and prioritization
- Export format validation (CSV, TSV, Markdown, XLSX)
- State management and workspace functionality

### Key Development Principles
1. **Test First**: All complex logic has corresponding tests
2. **Production Testing**: Tests validate actual production code, not copies
3. **No Commits**: Developers should not commit changes (per project rules)

## 🌐 Browser Compatibility

- ✅ **Chrome** 88+ (Manifest V3 required)
- ✅ **Edge** 88+ (Chromium-based)
- ✅ **Brave, Opera, Vivaldi** (Other Chromium browsers)
- ❌ **Firefox** (Uses Manifest V2)
- ❌ **Safari** (Different extension system)

## 🔧 Troubleshooting

### Common Issues

**Extension Won't Load**
- Verify all required libraries are present in `/libs/` folder
- Check that icon files exist in `/icons/` folder
- Ensure Manifest V3 compatibility (Chrome 88+)

**Tables Not Detected**
- Try the "Extract All Tables" button manually
- Check browser console (F12) for error messages
- Ensure page has finished loading completely
- Verify table data is not inside iframes

**Charts Not Generating**
- Confirm selected columns contain valid numeric data
- Check that X-axis column is properly selected
- Ensure at least one Y-axis column is chosen
- Verify Chart.js library loaded correctly

**Export Issues**  
- Check browser download permissions
- Disable popup blockers temporarily
- Try different export formats (CSV vs XLSX)
- Ensure sufficient disk space available

**License/Quota Issues**
- Check Plan & Usage section in popup
- Verify license key format if using premium
- Wait for monthly reset if free tier limits reached
- Use dev mode to test quota functionality

### Performance Tips
- **Large Tables**: Use filtering to reduce displayed data
- **Memory Usage**: Close unused table viewers to free RAM
- **PDF Extraction**: Specify page ranges for large documents
- **Workspace Management**: Delete unused saved workspaces

## 📄 License & Distribution

**MIT License** - Free for personal and commercial use

### Chrome Web Store Distribution
To package for Chrome Web Store:
1. Remove development files (`tests/`, `docs/`, `DEV-MODE-TESTING.md`)
2. Create ZIP file with production files only
3. Upload to Chrome Web Store Developer Dashboard
4. All required libraries and dependencies are included

## 🤝 Contributing

While this project welcomes feedback and issue reports, please note:
1. **No direct commits** - Follow project-specific contribution rules
2. **Test coverage required** - All new features must include tests
3. **Dev log updates** - Document insights in `docs/dev-log.md`

## 📞 Support

For assistance:
1. **Check troubleshooting section** above
2. **Review browser console** for error messages (F12)
3. **Test with dev mode** to isolate quota/license issues
4. **Create detailed issue reports** with reproduction steps

---

**TableLens** - *Making tabular data analysis accessible to everyone* 📊✨