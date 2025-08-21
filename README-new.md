# 📊 Table Chart Renderer - Chrome Extension

A powerful Chrome extension that detects tables on web pages and converts them into interactive charts with comprehensive data analysis capabilities and OCR-powered table extraction.

## ✨ Features

### 🔍 Table Detection
- **HTML Tables**: Automatically detects `<table>` elements
- **CSV Data**: Finds CSV-formatted content in `<pre>` and `<code>` elements
- **Markdown Tables**: Detects markdown table syntax
- **Text Selection**: Processes selected CSV/Markdown table text
- **🆕 OCR Extraction**: Screenshot-based table extraction from images and PDFs

### 📊 Visualization & Analysis
- **Interactive Charts**: Line, Bar, Pie, Doughnut, and Horizontal Bar charts
- **Tabbed Interface**: Organized data view with multiple analysis tabs
- **Data Controls**: Filtering, sorting, and search capabilities
- **Statistics**: Automatic calculation of sum, count, average, min, max
- **Real-time Updates**: Dynamic chart updates based on filtered data

### 💾 Export Capabilities
- **Chart Export**: PNG and SVG formats
- **Data Export**: CSV and TSV formats
- **High Quality**: Vector and raster format support

### 🎨 User Interface
- **Modern Design**: Clean, intuitive interface with professional styling
- **Responsive**: Works seamlessly across different screen sizes
- **Visual Feedback**: Hover effects, selection highlights, and status indicators
- **Accessibility**: Keyboard navigation and screen reader support

## 🚀 Installation

1. **Download the Extension**
   ```bash
   git clone [repository-url]
   cd table-chrome-edge
   ```

2. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top-right toggle)
   - Click "Load unpacked"
   - Select the `table-chrome-edge` folder

3. **Verify Installation**
   - Look for the 📊 icon in your Chrome toolbar
   - Open `test-page.html` or `test-ocr.html` to test functionality

## 📖 Usage Guide

### Basic Table Detection

1. **Navigate to any page** with tables (HTML, CSV, or Markdown)
2. **Click the extension icon** 📊 in the toolbar
3. **Scan for tables** using the "🔄 Scan for Tables" button
4. **Select a table** from the detected list
5. **View in Table Viewer** - click on any table to open the comprehensive interface

### OCR Table Extraction 🆕

1. **Navigate to a page** with image-based tables or PDFs
2. **Click the extension icon** 📊 in the toolbar
3. **Start OCR Capture** using the "📷 OCR Table" button
4. **Select table area** by dragging across the table region
5. **Process extraction** - the system will analyze the selected area
6. **Use extracted data** - OCR tables appear in the regular table list

### Chart Generation

1. **Select a table** from the detected list
2. **Configure chart settings**:
   - Choose chart type (Line, Bar, Pie, etc.)
   - Select X-axis column (categorical data)
   - Select Y-axis columns (numeric data)
3. **Generate the chart** - opens in a new window
4. **Export if needed** (PNG/SVG formats)

### Advanced Data Analysis

1. **Open Table Viewer** by clicking on any detected table
2. **Use the tabbed interface**:
   - **📊 Data Tab**: View, filter, sort, and export raw data
   - **📈 Chart Tabs**: Multiple chart visualizations
3. **Apply filters** using the search and filter controls
4. **Generate statistics** - automatic calculations displayed
5. **Export data** as CSV/TSV or charts as PNG/SVG

## 🛠️ Technical Details

### Architecture
- **Manifest V3**: Latest Chrome extension standard
- **Content Scripts**: Page analysis and table detection
- **Service Worker**: Background processing for OCR
- **Chart.js**: Powerful charting library (UMD version for compatibility)
- **Popup Interface**: Extension control panel
- **Web Accessible Resources**: Chart and table viewer pages

### File Structure
```
table-chrome-edge/
├── manifest.json              # Extension configuration
├── popup.html/js/css          # Extension popup interface
├── content.js/css             # Page content analysis
├── background.js              # Service worker for OCR
├── ocr-capture.js             # OCR screenshot functionality
├── ocr-overlay.css            # OCR interface styling
├── chart.html/js              # Chart rendering window
├── table-viewer.html/js       # Comprehensive table viewer
├── libs/chart.umd.js          # Chart.js library
├── icons/                     # Extension icons
└── test-*.html               # Test pages
```

### Permissions
- `activeTab`: Access current tab content
- `storage`: Save user preferences
- `downloads`: Export functionality
- `desktopCapture`: OCR screenshot capture

## 🔧 Development

### Local Setup
```bash
# Clone the repository
git clone [repository-url]
cd table-chrome-edge

# Open test pages
# Windows
start test-page.html
start test-ocr.html

# macOS/Linux
open test-page.html
open test-ocr.html
```

### Testing OCR Functionality
1. Open `test-ocr.html` in Chrome
2. Load the extension in developer mode
3. Test OCR on various table formats:
   - Image-based tables
   - PDF tables (screenshot required)
   - Complex formatted data

### Development Tools
- Chrome DevTools for debugging
- Extension Reloader for quick updates
- Console logging for troubleshooting

## 🆕 What's New in v1.1

### Major Features
- **📷 OCR Table Extraction**: Revolutionary screenshot-based table detection
- **🎯 Enhanced Table Detection**: Improved accuracy for various formats
- **📊 Advanced Analytics**: Comprehensive data analysis tools
- **💾 Multiple Export Formats**: PNG, SVG, CSV, TSV support
- **🎨 Modern UI**: Refreshed interface with better UX

### Technical Improvements
- **Chart.js UMD**: Fixed ES module compatibility issues
- **Service Worker**: Background processing for OCR
- **Memory Management**: Better resource cleanup
- **Error Handling**: Comprehensive error reporting
- **Performance**: Optimized for large datasets

## 📋 Supported Table Formats

| Format | Detection Method | Export Support |
|--------|------------------|----------------|
| HTML Tables | DOM parsing | ✅ Full |
| CSV Data | Pattern matching | ✅ Full |
| Markdown Tables | Syntax parsing | ✅ Full |
| Selected Text | Clipboard analysis | ✅ Full |
| **OCR Images** 🆕 | Screenshot analysis | ✅ Full |

## 🎯 Use Cases

- **📈 Data Analysis**: Convert spreadsheet data to charts
- **📊 Report Generation**: Create visual reports from web data
- **🔍 Research**: Analyze data from various online sources
- **📱 Presentations**: Generate charts for presentations
- **🆕 PDF Analysis**: Extract tables from PDF documents via OCR
- **🆕 Image Processing**: Analyze table data from screenshots

## 🚀 Future Enhancements

- **🤖 AI-Powered OCR**: Integration with advanced OCR services
- **📡 Cloud Storage**: Save and sync table data
- **🔄 Real-time Updates**: Live data refresh capabilities
- **📱 Mobile Support**: Extended functionality for mobile Chrome
- **🎨 Custom Themes**: User-customizable interface themes

## 🐛 Troubleshooting

### Common Issues

**Extension not detecting tables**:
- Refresh the page and try again
- Check if tables are dynamically loaded
- Use OCR for image-based tables

**OCR not working**:
- Ensure screen capture permission is granted
- Try selecting a larger, clearer area
- Check browser console for errors

**Charts not rendering**:
- Verify Chart.js library is loaded
- Check for JavaScript errors in console
- Ensure popup blocker is disabled

**Export functionality issues**:
- Check download permissions
- Verify file system write access
- Try different export formats

### Getting Help
1. Check browser console for error messages
2. Verify all extension permissions are granted
3. Test with provided test pages
4. Report issues with detailed reproduction steps

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For support, issues, or feature requests, please create an issue in the repository.

---

**Made with ❤️ for data visualization enthusiasts**