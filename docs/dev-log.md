#### Recent Development Progress (September 2025)

#### Save Functionality & Chart Auto-Loading Fixes
- **Fixed Save Button**: Corrected HTML/JS mismatch where button had `id="saveStateBtn"` but code looked for `getElementById('saveState')`
- **Removed Automatic Chart Loading**: Eliminated automatic state restoration that was loading charts on every table open
  - **Previous Issue**: Charts were auto-loading from localStorage even for new tables, causing confusion
  - **Solution**: Removed `loadState()` and `restoreAdvancedState()` calls from `handleTableData()` 
  - **New Behavior**: Charts only restore when explicitly loading a saved workspace from popup
  - **Clean Startup**: Tables now start fresh without any automatic state interference
- **Explicit-Only Restoration**: Charts, filters, and configurations only restore when user clicks "Load" on saved state
- **Improved User Control**: Users see exactly what they expect - fresh tables start clean, saved states load completely

#### Explicit State Management System
- **Architecture Overhaul**: Replaced automatic state saving with user-controlled explicit saving system
  - **Removed Automatic Saving**: Eliminated `setupAutoSave()` method and all automatic `saveState()` calls throughout table-viewer.js
  - **Manual Save Button**: Added "💾 Save State" button to table viewer toolbar with green success styling (btn-success)
  - **Named State Storage**: Implemented named state saving with user-provided names and timestamps
  - **Cross-Page Loading**: Saved states can be loaded from any page, not just the original table page
  - **Enhanced State Management**: Saved states stored in localStorage with metadata (name, timestamp, fingerprint, URL)
- **UI Components**:
  - **Save Dialog Modal**: Custom modal for naming saved states with auto-generated defaults, validation, and keyboard shortcuts
  - **Popup Saved States Section**: Replaced "Clear Stored Tables" with "💾 Saved States" section showing all saved configurations
  - **Load/Delete Actions**: Each saved state shows Load and Delete buttons with appropriate styling and confirmation
- **Technical Implementation**:
  - **State Persistence**: Uses `tableLensSavedStates` localStorage key with 50-state limit to prevent storage bloat
  - **Message Passing**: Enhanced content script to handle `loadSavedState` messages and open table viewer with restored state
  - **State Restoration**: Added `restoreFromSavedState()` method to reconstruct complete table viewer state including filters, charts, and column types
  - **Data Security**: Includes HTML escaping and XSS prevention for user-provided state names
- **User Benefits**:
  - ✅ Full control over when and what gets saved
  - ✅ Meaningful names for different table configurations  
  - ✅ Ability to load any saved state from any page
  - ✅ No more unexpected state changes from data modifications
  - ✅ Clean separation between temporary and persistent state
- **Backward Compatibility**: Maintains existing state structure and restoration logic, only removes automatic triggers

#### Compact Data Toolbar Enhancement
- **Streamlined UI Design**: Redesigned the table viewer toolbar for better space efficiency and user experience
  - **Compact Height**: Reduced toolbar height from 15px padding to 8px padding for more screen real estate
  - **Left-Aligned Primary Actions**: Create Chart, Export CSV, and Export TSV buttons positioned on left for easy access
  - **Right-Aligned Reset**: Combined "Reset Filters & Sorting" button positioned on right for logical separation
  - **Moved Chart Creation**: Relocated chart creation from floating bottom-right button to prominent toolbar position
  - **Unified Reset Function**: Single button now handles both filter clearing and sort reset operations
- **Improved Button Hierarchy**: 
  - Primary action (Create Chart) uses `btn-primary` styling
  - Export and reset functions use `btn-secondary` for visual consistency
  - All buttons use `btn-sm` class for compact sizing
- **Clean CSS Architecture**: Replaced flexible control groups with simple left/right toolbar sections using flexbox
- **Maintained Functionality**: All existing features preserved with improved accessibility and discoverability
- **Export Fix**: Resolved duplicate download issue by moving export event listeners from `attachFilterEventListeners()` to main `attachEventListeners()` method to prevent multiple listener attachments
- **Scatter Plot X-axis Fix**: Fixed scatter plot X-axis range issue where axis always showed 0-1 instead of actual data range
  - Root cause: Scatter plots require `{x, y}` data point objects but were receiving separate labels and values arrays like other chart types
  - Solution: Added special handling in `processChartData()` method for scatter plots to format data as coordinate pairs
  - Both X and Y values now properly parsed as numeric values using `parseNumericValue()` method
  - X-axis now automatically scales to the actual data range from selected column
- **Chart Export Fix**: Fixed PNG and SVG chart export buttons that were showing JavaScript errors when clicked
  - Root cause: `tableViewer` variable was declared in local scope but HTML buttons used `onclick="tableViewer.exportChart()"`
  - Solution: Made `tableViewer` globally accessible by assigning to `window.tableViewer` during initialization
  - PNG export uses Chart.js built-in `toBase64Image()` method for high-quality bitmap output
  - SVG export converts canvas to SVG format with embedded PNG data for vector compatibility

#### Enhanced Rowspan and Colspan Table Handling
- **Comprehensive Span Attribute Support**: Implemented proper rowspan and colspan handling in HTML table parser
  - **Rowspan Fix**: Modified `parseHTMLTable` in `content.js` to repeat cell content across all spanned rows instead of leaving them empty
  - **Colspan Support**: Enhanced existing colspan logic to properly handle column spanning with empty cells in additional columns
  - **Consistent Row Structure**: All parsed rows now maintain consistent column counts regardless of span attributes
  - **Test Coverage**: Added comprehensive test suite covering both rowspan and colspan scenarios
    - `tests/rowspanHandling.test.js`: Tennis champions table with complex rowspan patterns
    - `tests/colspanHandling.test.js`: Student scores table with colspan spanning headers and data
  - **Production Integration**: Updated `utils/tableNesting.js` to include the enhanced parsing logic for Node.js testing
- **Root Cause Analysis**: Previous implementation set spanned cells to empty strings, causing inconsistent CSV output with missing data
- **Solution Benefits**:
  - ✅ Rowspan cells properly repeat their values in all affected rows
  - ✅ Colspan cells fill additional columns with appropriate empty values  
  - ✅ All table rows maintain consistent column structure
  - ✅ CSV exports include complete data from complex table layouts
  - ✅ Comprehensive test validation ensures reliability

#### Clear Stored Tables Feature
- **User-Requested Data Management**: Added ability to clear all stored tables for the current page from extension popup
  - **New UI Button**: Added "🗑️ Clear Stored Tables" button to main popup interface with danger styling (red background)
  - **Compact Design**: Button uses `btn-danger btn-small` classes for visual distinction and space efficiency
  - **Message Communication**: Implements Chrome extension message passing between popup and content script
  - **Complete Cleanup**: Clears both content script storage (`tableDetector.tables`) and popup cache (`this.tables`, `this.tableSearchCache`)
  - **Persistent State Clearing**: **Enhanced to clear saved table state from localStorage and sessionStorage**
    - Iterates through all table IDs and removes corresponding `tableLens_state_${tableId}` entries
    - Handles both localStorage (primary) and sessionStorage (fallback) storage locations
    - Provides detailed feedback showing number of tables and state entries cleared
  - **User Feedback**: Enhanced status messages with counts of cleared tables and states
  - **Error Handling**: Graceful handling of tab access errors, storage access issues, and communication failures
- **Implementation Details**:
  - `popup.html`: Added clear button to table-actions section
  - `popup.css`: Added `.btn-danger` and `.btn-small` styling classes
  - `popup.js`: Enhanced `clearStoredTables()` method with detailed feedback and error handling
  - `content.js`: Enhanced `clearAllTables` handler to clear both memory and persistent storage with comprehensive logging
- **User Benefits**: Users can now completely reset their table extraction and analysis session, removing all traces of table data and saved states from browser storage

#### Table State Persistence System
- **Session Storage Integration**: Complete state management system for table viewer sessions
  - **Persistent State**: Automatically saves and restores table viewer state across browser sessions
  - **Comprehensive Coverage**: Preserves charts, filters, sorting, column types, number formats, UI state, and active tab
  - **Smart State Restoration**: Validates data compatibility with fingerprinting before applying saved state
  - **Auto-save Functionality**: Debounced automatic saving on user actions (sorting, filtering, chart creation/modification)
  - **State Validation**: Data fingerprint checking ensures state compatibility with current table data
- **State Components**:
  - Column configuration (types, stats, number formats)
  - Sorting state (column, direction)
  - Active filters (numeric ranges, date ranges, categorical selections)
  - Chart states (configurations, types, axis selections)
  - UI state (active tab, theme preference)
  - Table metadata for validation
- **Robust Implementation**:
  - Session storage with 24-hour expiration
  - Graceful degradation when DOM unavailable (testing environment)
  - Consistent table ID generation for reliable state tracking
  - Memory-efficient chart serialization and restoration
  - Error handling and fallback mechanisms
- **User Experience**: Seamless table reopening with full context restoration - users can close and reopen tables maintaining all work progress
- **Testing Coverage**: Complete test suite with 21 passing tests covering state save/load/apply operations, data fingerprinting, and filter extraction
- **Chart Tab Title Management**: Fixed chart tab title duplication issue where emojis (📈) and close buttons (×) were accumulating on each state restoration
  - Enhanced `getChartName()` method with global regex replacement for proper emoji/close button stripping
  - Improved whitespace cleanup to prevent formatting issues in restored chart tabs
  - Root cause: State restoration was adding decorative elements to existing chart tab names rather than cleaning them first

#### Per-Column Filtering System
- **Excel-Style Popup Filters**: Replaced traditional inline filters with Excel-style popup dialogs
  - **Header Filter Buttons**: Small dropdown arrows (▼) positioned at the right of each column header
  - **Popup Positioning**: Smart positioning that adjusts based on viewport boundaries
  - **Type-Aware Controls**: Each popup shows appropriate filter controls based on detected column data type
    - **Numeric/Money/Percentage**: Min/max range inputs with numeric validation
    - **Date**: Date range picker with from/to inputs  
    - **Categorical**: Multi-select dropdown with text search capability
  - **Space-Efficient Design**: Filters only appear when needed, saving precious table space
  - **Interactive Features**: 
    - Click outside or press Escape to close popup
    - Real-time filtering as values are modified
    - Clear individual filter or global "Clear All Filters" button
    - Visual indicators show which columns have active filters
  - **Smart Value Detection**: Automatic extraction of unique values for categorical dropdowns (limited to 20 most common)
  - **Comprehensive Filter Logic**: Supports range filtering, text matching, date ranges, and multi-value selection
  - **Graceful Data Handling**: Null-safe parsing with locale-aware numeric and date interpretation

#### Emp### Test Suite Summary (Node-Based Utilities)

Added pure utility modules under `utils/` with corresponding tests under `tests/`:

- `utils/numberFormat.js`: Inference & parsing (locale-aware)
- `utils/stats.js`: Numeric statistics (population std dev) mirroring TableViewer logic  
- `utils/columnTypes.js`: **REFACTORED** - Column type detection logic extracted for testability (Rule 1 compliance)
- `utils/tableNesting.js`: **NEW** - Enhanced table detection for nested table scenarios with prioritization logic
- `tests/numberFormat.test.js`: Chilean money detection & parsing
- `tests/stats.test.js`: Verifies stats calculations (sum, avg, min, max, std, count) for CLP columns
- `tests/tableCleanup.test.js`: Validates empty row/column removal with 10 test cases including complex table structures
- `tests/htmlParser.test.js`: Validates HTML table parsing with colspan/rowspan support
- `tests/columnTypeDetection.test.js`: **REFACTORED** - Now tests actual production code from `utils/columnTypes.js` instead of copied logic
- `tests/nestedTables.test.js`: **NEW** - Validates nested table detection prioritizing inner data tables over container tables
- `tests/run-tests.js`: Aggregates and runs all tests (run via `npm test`)

Total test coverage: **19 tests passing** covering number format detection, statistical calculations, table data cleaning, HTML parsing, column type detection using production code, and **nested table prioritization**.

These utilities ensure future refactors of in-UI logic (TableViewer) don't silently break numeric parsing, statistical correctness, table processing reliability, column type detection accuracy, or nested table handling logic.

#### Rule 1 Compliance Achievement
- **Code Testability**: Successfully refactored column type detection logic from inline TableViewer method into standalone `utils/columnTypes.js` utility
- **Test Validation**: Tests now import and validate the actual production logic via `require('../utils/columnTypes.js')`, ensuring test coverage reflects real application behavior
- **Dual Export System**: Utility supports both Node.js testing (`module.exports`) and browser usage (`window.ColumnTypeUtils`) for maximum flexibility
- **Architecture Benefits**: Column type detection logic now reusable across multiple components and fully validated through comprehensive test coverage

#### Nested Table Handling Enhancement
- **Problem Identified**: Table-within-table structures were incorrectly extracting outer container tables instead of inner data tables
- **Enhanced Detection Logic**: Created `utils/tableNesting.js` with sophisticated table prioritization algorithm
  - **Data Density Calculation**: Measures percentage of cells with meaningful content vs empty cells
  - **Container Detection**: Identifies tables that contain other tables vs actual data tables
  - **Presentation Table Recognition**: Detects layout/container tables with `role="presentation"` or low data density
  - **Quality Scoring**: Combines data density with average row content to rank table quality
- **Prioritization Rules**: 
  1. Exclude presentation containers unless no better options exist
  2. Prefer inner tables (non-containers) with good data density 
  3. Sort by quality score favoring content-rich tables
- **Integration**: Enhanced detection integrated into `content.js` `detectTables()` method
- **Test Coverage**: Comprehensive test suite validates nested table scenarios with mock DOM structures

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