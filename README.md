# Table Chart Renderer - Chrome/Edge Extension

A powerful browser extension that converts tables found on web pages into interactive charts. Supports CSV, HTML tables, and Markdown table formats with export functionality.

## Features

- 📊 **Multiple Chart Types**: Line, Bar, Pie, Doughnut, and Horizontal Bar charts
- 📋 **Table Detection**: Automatically detects HTML tables, CSV data, and Markdown tables
- 🎨 **Interactive Charts**: Powered by Chart.js with smooth animations and tooltips
- 📤 **Export Options**: Export charts as PNG or SVG files
- 🔍 **Smart Data Detection**: Automatically identifies numeric columns and suggests chart configurations
- 📱 **Responsive Design**: Works on all screen sizes

## Supported Table Formats

### 1. HTML Tables
```html
<table>
  <tr><th>Product</th><th>Sales</th></tr>
  <tr><td>Product A</td><td>100</td></tr>
  <tr><td>Product B</td><td>150</td></tr>
</table>
```

### 2. CSV Data
```csv
Product,Sales,Profit
Product A,100,25
Product B,150,40
Product C,80,15
```

### 3. Markdown Tables
```markdown
| Product   | Sales | Profit |
|-----------|-------|--------|
| Product A | 100   | 25     |
| Product B | 150   | 40     |
| Product C | 80    | 15     |
```

## Installation

### Prerequisites
1. Download Chart.js library (v4.x) and place it in the `libs` folder as `chart.min.js`
2. Create icon files (16x16, 32x32, 48x48, 128x128 PNG) in the `icons` folder

### Manual Installation
1. Clone or download this repository
2. Download Chart.js from https://cdn.jsdelivr.net/npm/chart.js/dist/chart.min.js
3. Save it as `libs/chart.min.js`
4. Create extension icons (PNG format):
   - `icons/icon16.png` (16x16)
   - `icons/icon32.png` (32x32) 
   - `icons/icon48.png` (48x48)
   - `icons/icon128.png` (128x128)
5. Open Chrome/Edge and go to `chrome://extensions/` or `edge://extensions/`
6. Enable "Developer mode"
7. Click "Load unpacked" and select the extension folder

### Quick Setup Commands
```bash
# Download Chart.js
curl -o libs/chart.min.js https://cdn.jsdelivr.net/npm/chart.js/dist/chart.min.js

# Or using PowerShell (Windows)
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/chart.js/dist/chart.min.js" -OutFile "libs/chart.min.js"
```

## Usage

1. **Navigate to a webpage** containing tables
2. **Click the extension icon** in your browser toolbar
3. **Scan for tables** - The extension will automatically detect tables on the page
4. **Select a table** from the list of detected tables
5. **Configure your chart**:
   - Choose chart type (Line, Bar, Pie, etc.)
   - Select X-axis column (usually labels/categories)
   - Select Y-axis columns (numeric data)
6. **Generate the chart** - A new window opens with your interactive chart
7. **Export if needed** - Save as PNG or SVG file

## Chart Types

- **📈 Line Chart**: Perfect for showing trends over time
- **📊 Bar Chart**: Great for comparing values across categories
- **🥧 Pie Chart**: Ideal for showing parts of a whole
- **🍩 Doughnut Chart**: Modern alternative to pie charts
- **📊 Horizontal Bar**: When category names are long

## File Structure

```
json-ocr-chrome/
├── manifest.json          # Extension manifest
├── popup.html            # Extension popup interface
├── popup.css            # Popup styling
├── popup.js             # Popup logic
├── content.js           # Content script for table detection
├── content.css          # Content script styling
├── chart.html           # Chart viewer page
├── chart.js             # Chart rendering logic
├── libs/
│   └── chart.min.js     # Chart.js library (download required)
├── icons/
│   ├── icon16.png       # 16x16 icon (create required)
│   ├── icon32.png       # 32x32 icon (create required)
│   ├── icon48.png       # 48x48 icon (create required)
│   └── icon128.png      # 128x128 icon (create required)
└── README.md            # This file
```

## Development

### Key Components

- **Content Script** (`content.js`): Detects and parses tables on web pages
- **Popup** (`popup.js`): Manages the extension interface and user interactions
- **Chart Viewer** (`chart.js`): Renders interactive charts using Chart.js
- **Table Parser**: Handles CSV, HTML, and Markdown table formats

### Adding New Features

1. **New Chart Types**: Add to the `chartType` select options and update chart configuration
2. **New Table Formats**: Extend the `TableParser` class with new parsing methods
3. **Export Formats**: Add new export options in the chart viewer

### Testing

1. Test with various table formats on different websites
2. Verify chart generation with different data types
3. Test export functionality
4. Check responsive design on different screen sizes

## Browser Compatibility

- ✅ **Chrome** 88+ (Manifest V3)
- ✅ **Edge** 88+ (Manifest V3)
- ✅ **Other Chromium-based browsers**

## Troubleshooting

### Extension Not Loading
- Ensure all required files are present
- Check that Chart.js library is properly downloaded
- Verify icon files exist

### Tables Not Detected
- Try clicking "Scan for Tables" manually
- Check browser console for errors
- Ensure the page has finished loading

### Charts Not Generating
- Verify selected columns contain numeric data
- Check that X-axis column is selected
- Ensure at least one Y-axis column is selected

### Export Issues
- Check browser's download permissions
- Ensure popup blockers aren't interfering
- Try different export formats

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use and modify as needed.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Look at browser console for errors
3. Create an issue with detailed steps to reproduce

---

**Made with ❤️ for data visualization enthusiasts**