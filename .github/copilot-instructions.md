# TableLens Extension - Copilot Instructions

First rule to follow: After making relevant changes to the application#### Recent Development Progress (September 2025)

#### Emp### Test Suite Summary (Node-Based Utilities)

Added pure utility modules under `utils/` with corresponding tests under `tests/`:

- `utils/numberFormat.js`: Inference & parsing (locale-aware)
- `utils/stats.js`: Numeric statistics (population std dev) mirroring TableViewer logic
- `tests/numberFormat.test.js`: Chilean money detection & parsing
- `tests/stats.test.js`: Verifies stats calculations (sum, avg, min, max, std, count) for CLP columns
- `tests/tableCleanup.test.js`: Validates empty row/column removal with 10 test cases including complex table structures
- `tests/htmlParser.test.js`: Validates HTML table parsing with colspan/rowspan support
- `tests/run-tests.js`: Aggregates and runs all tests (run via `npm test`)

Total test coverage: **17 tests passing** covering number format detection, statistical calculations, table data cleaning, and HTML parsing.

These utilities ensure future refactors of in-UI logic (TableViewer) don't silently break numeric parsing, statistical correctness, or table processing reliability.

#### Empty Row/Column Removal Feature
- **Table Data Cleaning**: Implemented automatic removal of empty rows and columns from displayed tables
  - Automatically removes columns that contain only empty/whitespace-only cells
  - Automatically removes rows that contain only empty/whitespace-only data 
  - Preserves header row (index 0) even if empty to maintain table structure
  - **Smart Complex Table Detection**: Detects tables with colspan/rowspan and uses conservative cleanup to prevent data loss
  - Enhanced HTML parser with proper colspan/rowspan support for accurate table structure parsing
  - Handles edge cases: all-empty tables, partial data, null/undefined values, complex calendar layouts
  - Comprehensive test coverage with 12 test cases including complex table structures and HTML parsing validation
  - Integrated into `handleTableData()` method for automatic cleanup before display

#### Chart System Enhancementspdate this file.

Second rule to follow: Always add tests and run-tests after making a change.

Third rule to follow: Never try to add or commit your changes.

## Current State and Design

### User-Facing Features

The extension has been consolidated to provide a single, streamlined user experience:

**Primary Action:**
- **"Extract All Tables" button** - The only exposed feature that intelligently detects context and extracts tables from both webpages and PDFs

### Architecture Overview

#### User Interface (popup.html + popup.css)
- **Single prominent button**: "📑 Extract All Tables" 
- **Table list display**: Shows extracted tables with preview and metadata
- **Chart generation interface**: Allows users to create visualizations from extracted data
- **Status notifications**: Progress and error feedback

#### Core Functionality Flow

1. **Context Detection**: When user clicks "Extract All Tables", the extension:
   - Detects if current page is a PDF (`*.pdf` URL pattern)
   - Routes to appropriate extraction method

2. **PDF Extraction Path** (`extractFromPDF`):
   - Uses background service worker to call external API
   - Endpoint: `https://table-extract-service-production.up.railway.app/extract-all-tables-from-url`
   - Handles service response normalization
   - Includes fallback for legacy services requiring page ranges

3. **Webpage Extraction Path** (`extractFromWebpage`):
   - Scans DOM for HTML tables, CSV-like content in `<pre>`/`<code>` blocks
   - Detects Markdown table format
   - Processes selected text that looks like tabular data

#### Hidden/Internal Features (Kept for Future Use)

The following functionality exists in the codebase but is hidden from users (`style="display: none;"`):

- **Scan Tables** (`scanTables`): Manual webpage table detection
- **Smart Table Capture** (`ocrCapture`): OCR-based region selection for PDFs
- **Image→Table** (`imageCapture`): Image upload to extraction service

### Technical Architecture

#### Files and Responsibilities

**Frontend (Popup Interface):**
- `popup.html` - User interface structure
- `popup.css` - Styling with single prominent action button
- `popup.js` - Main controller with context-aware extraction logic

**Core Logic:**
- `content.js` - DOM interaction, table detection, batch injection
- `background.js` - Service worker for API calls (bypasses CORS)
- `ocr-capture.js` - Coordinate mapping, PDF context detection (used internally)

**Libraries:**
- `libs/chart.min.js` - Chart.js for visualization
- `libs/pdf.min.js` - PDF.js for metadata extraction
- `libs/tesseract.min.js` - OCR capabilities (legacy)

#### Data Flow

1. **User Action**: Click "Extract All Tables"
2. **Context Detection**: Check URL for PDF vs webpage
3. **Extraction Route**:
   - **PDF**: Background → External API → Normalize response → Inject into content script
   - **Webpage**: Content script → DOM parsing → Table detection
4. **Display**: Populate table list with previews and metadata
5. **Interaction**: User can view tables, generate charts

#### Key Classes and Methods

**PopupController** (popup.js):
- `startAllTablesExtraction()` - Main entry point with context detection
- `extractFromPDF()` - PDF-specific extraction flow
- `extractFromWebpage()` - Webpage table detection flow
- `fallbackPageRangeFlow()` - Legacy service compatibility

**TableDetector** (content.js):
- `detectTables()` - Scans DOM for various table formats
- `generatePreview()` - Creates table previews for UI
- Hidden methods for OCR integration and highlighting

### Schema Handling

The extension normalizes different table response formats:
- Direct arrays: `[{rows: [...]}]`
- Wrapped format: `{tables: [{table: {rows: [...]}}]}`
- Column/data format: `{columns: [...], data: [...]}`

### Error Handling and Fallbacks

- **Service compatibility**: Detects "No pages specified" errors and prompts for page range
- **Schema flexibility**: Multiple normalization paths for different API versions
- **Graceful degradation**: Clear error messages for failed extractions

### Future Development Considerations

#### Hidden Features Ready for Activation
- OCR region selection with coordinate mapping
- Image-based table extraction
- Manual table scanning with highlighting

#### Potential Enhancements
- Table metadata display (page numbers, indices)
- Duplicate detection and filtering
- Header inference for headerless tables
- Progress indicators for batch operations

### Recent Development Progress (September 2025)

#### Chart System Enhancements
- **Dynamic Chart UI**: Implemented intelligent chart type definitions with column filtering
  - 6 chart types: Line, Bar, Horizontal Bar, Pie, Doughnut, Scatter Plot
  - Each chart type shows only valid columns based on data types
  - Smart axis validation (multiple vs single selection)
  - Auto-selection of appropriate defaults

#### Dark Theme Implementation
- **Comprehensive CSS Variables**: Complete dark/light theme system with localStorage persistence
- **Chart View Theming**: Full dark mode support for table analysis interface
  - Chart type/column selection UI properly themed
  - Empty chart placeholder styled for both themes
  - Tab close buttons and status messages theme-aware
  - All form controls and axis configurations responsive to theme
  - Chart controls panel (`.chart-controls`) and chart container (`.chart-container`) now use theme variables (no hardcoded light backgrounds)

#### Column Type Detection
- **Enhanced Data Types**: 5 column types with automatic detection
  - Numeric, categorical, money, percentage, date
  - Manual type override with emoji indicators
  - Spanish keyword support for international data
  - Chilean peso format support ("$ 113.100")
  - Locale-aware numeric & money parsing with auto-detected thousand (., comma, space) and decimal (., ,) separators; user-adjustable per column

#### Error Resolution
- **Chart Generation Fixes**: Resolved JavaScript errors in dynamic UI
  - Fixed null reference errors in `generateChart` method
  - Proper handling of single vs multiple Y-axis selections
  - Chart type definitions properly initialized in constructor

### Code Organization Patterns

- **Separation of concerns**: UI controller, content manipulation, service communication
- **Hidden feature preservation**: Code remains intact with CSS hiding
- **Extensible messaging**: Chrome extension message passing for cross-context communication
- **Service abstraction**: Background script handles all external API calls

### Testing Scenarios

1. **PDF documents**: Various PDF types with tables
2. **HTML pages**: Tables in different formats (HTML, CSV in pre blocks, Markdown)
3. **Error conditions**: Network failures, empty results, malformed responses
4. **Fallback scenarios**: Legacy service compatibility
5. **Locale Number Parsing & Stats**: Utility tests cover:
  - Chilean CLP money detection across multiple columns (Cargos, Abono, Saldo)
  - Thousand (.) + decimal (,) inference with no explicit decimal part present
  - Parsing correctness feeding into stats (sum, avg, min, max, std, count)

### Test Suite Summary (Node-Based Utilities)

Added pure utility modules under `utils/` with corresponding tests under `tests/`:

- `utils/numberFormat.js`: Inference & parsing (locale-aware)
- `utils/stats.js`: Numeric statistics (population std dev) mirroring TableViewer logic
- `tests/numberFormat.test.js`: Chilean money detection & parsing
- `tests/stats.test.js`: Verifies stats calculations (sum, avg, min, max, std, count) for CLP columns
- `tests/run-tests.js`: Aggregates and runs all tests (run via `npm test`)

These utilities ensure future refactors of in-UI logic (TableViewer) don’t silently break numeric parsing or statistical correctness.

This architecture provides a clean user experience while maintaining the flexibility to expose additional features in the future without code restructuring.