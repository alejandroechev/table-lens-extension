# TableLens Extension - Copilot Instructions

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

This architecture provides a clean user experience while maintaining the flexibility to expose additional features in the future without code restructuring.