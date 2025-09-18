class TableParser {
  static parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const data = [];
    
    for (const line of lines) {
      const row = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      row.push(current.trim());
      data.push(row);
    }
    
    return data;
  }
  
  static parseHTMLTable(table) {
    const rows = table.querySelectorAll('tr');
    const data = [];
    
    // First pass: determine the maximum number of columns needed
    let maxCols = 0;
    const parsedRows = [];
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th');
      const rowData = [];
      let colIndex = 0;
      
      cells.forEach(cell => {
        const content = cell.textContent.trim();
        const colspan = parseInt(cell.getAttribute('colspan') || '1');
        const rowspan = parseInt(cell.getAttribute('rowspan') || '1');
        
        // Add the cell content
        rowData.push({
          content,
          colspan,
          rowspan,
          startCol: colIndex
        });
        
        colIndex += colspan;
      });
      
      if (rowData.length > 0) {
        parsedRows.push(rowData);
        maxCols = Math.max(maxCols, colIndex);
      }
    });
    
    // Second pass: create a grid structure
    const grid = [];
    
    parsedRows.forEach((rowCells, rowIndex) => {
      if (!grid[rowIndex]) grid[rowIndex] = new Array(maxCols).fill('');
      
      let colOffset = 0;
      
      rowCells.forEach(cellData => {
        // Find the next available column position
        while (colOffset < maxCols && grid[rowIndex][colOffset] !== '') {
          colOffset++;
        }
        
        // Fill the cell and handle colspan/rowspan
        for (let r = 0; r < cellData.rowspan; r++) {
          for (let c = 0; c < cellData.colspan; c++) {
            const targetRow = rowIndex + r;
            const targetCol = colOffset + c;
            
            if (!grid[targetRow]) grid[targetRow] = new Array(maxCols).fill('');
            
            if (targetRow < grid.length && targetCol < maxCols) {
              // For rowspan: repeat content in all spanned rows
              // For colspan: only put content in the first column
              if (c === 0) {
                grid[targetRow][targetCol] = cellData.content;
              } else {
                grid[targetRow][targetCol] = '';
              }
            }
          }
        }
        
        colOffset += cellData.colspan;
      });
    });
    
    return grid.filter(row => row && row.length > 0);
  }
  
  static parseMarkdownTable(markdownText) {
    const lines = markdownText.trim().split('\n');
    const data = [];
    
    lines.forEach((line, index) => {
      // Skip separator line (contains |---|---|)
      if (line.includes('---')) return;
      
      const cells = line.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '');
      
      if (cells.length > 0) {
        data.push(cells);
      }
    });
    
    return data;
  }
}

class TableDetector {
  constructor() {
    this.tables = [];
    this.selectedTableIndex = -1;
    this.chartWindow = null;
  }
  
  detectTables() {
    this.tables = [];
    
    // Detect HTML tables with enhanced nested table logic
    const htmlTables = document.querySelectorAll('table');
    if (htmlTables.length > 0) {
      // Use enhanced detection to prioritize inner data tables over container tables
      const prioritizedTables = this.detectTablesWithNestingLogic(Array.from(htmlTables));
      
      prioritizedTables.forEach((tableInfo, index) => {
        const tableId = this.generateTableId(tableInfo, 'html', index);
        this.tables.push({
          type: 'html',
          element: tableInfo.element,
          data: tableInfo.data,
          preview: this.generatePreview(tableInfo.data),
          id: tableId,
          metadata: {
            dataDensity: tableInfo.dataDensity,
            isContainerTable: tableInfo.isContainerTable,
            isPresentationContainer: tableInfo.isPresentationContainer
          }
        });
      });
    }
    
    // Detect CSV-like content in pre/code elements
    const preElements = document.querySelectorAll('pre, code');
    preElements.forEach((element, index) => {
      const text = element.textContent;
      if (this.looksLikeCSV(text)) {
        const data = TableParser.parseCSV(text);
        if (data.length > 1) {
          const tableId = this.generateTableId({ element, data }, 'csv', index);
          this.tables.push({
            type: 'csv',
            element: element,
            data: data,
            preview: this.generatePreview(data),
            id: tableId
          });
        }
      }
      
      if (this.looksLikeMarkdown(text)) {
        const data = TableParser.parseMarkdownTable(text);
        if (data.length > 1) {
          const tableId = this.generateTableId({ element, data }, 'markdown', index);
          this.tables.push({
            type: 'markdown',
            element: element,
            data: data,
            preview: this.generatePreview(data),
            id: tableId
          });
        }
      }
    });
    
    // Detect text selections that might be tables
    const selectedText = window.getSelection().toString();
    if (selectedText && (this.looksLikeCSV(selectedText) || this.looksLikeMarkdown(selectedText))) {
      let data;
      let type;
      
      if (this.looksLikeCSV(selectedText)) {
        data = TableParser.parseCSV(selectedText);
        type = 'csv';
      } else {
        data = TableParser.parseMarkdownTable(selectedText);
        type = 'markdown';
      }
      
      if (data.length > 1) {
        const tableId = this.generateTableId({ data }, `${type}-selection`, 0);
        this.tables.push({
          type: `${type}-selection`,
          element: null,
          data: data,
          preview: this.generatePreview(data),
          id: tableId
        });
      }
    }
    
    return this.tables;
  }
  
  looksLikeCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return false;
    
    const commaCount = (lines[0].match(/,/g) || []).length;
    if (commaCount === 0) return false;
    
    // Check if most lines have similar comma counts
    let similarCount = 0;
    lines.forEach(line => {
      const count = (line.match(/,/g) || []).length;
      if (Math.abs(count - commaCount) <= 1) {
        similarCount++;
      }
    });
    
    return similarCount >= lines.length * 0.7;
  }
  
  looksLikeMarkdown(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return false;
    
    // Look for markdown table pattern: |column1|column2|
    const hasTableStructure = lines.some(line => 
      line.includes('|') && line.split('|').length >= 3
    );
    
    const hasSeparator = lines.some(line => 
      line.includes('---') && line.includes('|')
    );
    
    return hasTableStructure && (hasSeparator || lines.length >= 3);
  }
  
  detectTablesWithNestingLogic(allTables) {
    const validTables = [];
    
    for (const table of allTables) {
      const data = TableParser.parseHTMLTable(table);
      if (data.length > 1) {
        // Calculate data density - what percentage of cells have meaningful content
        let totalCells = 0;
        let filledCells = 0;
        
        data.forEach(row => {
          row.forEach(cell => {
            totalCells++;
            if (cell && cell.trim() !== '') {
              filledCells++;
            }
          });
        });
        
        const dataDensity = filledCells / totalCells;
        
        // Check if this table contains OTHER tables (not itself)
        const nestedTables = table.querySelectorAll('table');
        const actualNestedCount = Array.from(nestedTables).filter(nested => nested !== table).length;
        const isContainerTable = actualNestedCount > 0;
        
        // Calculate average row length (to detect tables with many empty columns)
        const avgRowLength = data.reduce((sum, row) => {
          const filledInRow = row.filter(cell => cell && cell.trim() !== '').length;
          return sum + filledInRow;
        }, 0) / data.length;
        
        // Detect tables that look like presentation/layout containers
        const isPresentationContainer = (
          table.getAttribute('role') === 'presentation' ||
          table.getAttribute('name') === 'GroupContainer' ||
          dataDensity < 0.15 || // Less than 15% filled
          (data[0] && data[0].length > 20 && avgRowLength < 5) // Many cols but few filled
        );
        
        validTables.push({
          element: table,
          data: data,
          dataDensity: dataDensity,
          isContainerTable: isContainerTable,
          isPresentationContainer: isPresentationContainer,
          nestedTableCount: actualNestedCount,
          avgRowLength: avgRowLength,
          id: table.getAttribute('id') || table.getAttribute('name') || 'unnamed'
        });
      }
    }
    
    // Prioritization logic:
    // 1. Exclude presentation containers unless no better options
    // 2. Prefer inner tables (non-containers) with good data density
    // 3. Sort by data density and content richness
    
    const nonPresentationTables = validTables.filter(t => !t.isPresentationContainer);
    const presentationTables = validTables.filter(t => t.isPresentationContainer);
    
    let candidateTables = nonPresentationTables.length > 0 ? nonPresentationTables : presentationTables;
    
    // Further filter: prefer non-container tables if available
    const innerTables = candidateTables.filter(t => !t.isContainerTable);
    if (innerTables.length > 0) {
      candidateTables = innerTables;
    }
    
    // Sort by quality score (data density * avg row length)
    return candidateTables.sort((a, b) => {
      const scoreA = a.dataDensity * Math.min(a.avgRowLength, 10); // Cap to avoid over-weighting
      const scoreB = b.dataDensity * Math.min(b.avgRowLength, 10);
      return scoreB - scoreA;
    });
  }
  
  generatePreview(data) {
    if (data.length === 0) return '';
    
    const maxCols = 3;
    const maxRows = 3;
    
    const preview = data.slice(0, maxRows).map(row => 
      row.slice(0, maxCols).map(cell => 
        cell.length > 15 ? cell.substring(0, 12) + '...' : cell
      ).join(' | ')
    ).join('\n');
    
    return preview + (data.length > maxRows ? '\n...' : '');
  }

  /**
   * Generate a consistent table ID for state management
   */
  generateTableId(tableInfo, type, index) {
    const data = tableInfo.data || [];
    const element = tableInfo.element;
    
    // Try to use existing element ID or name
    if (element && (element.id || element.getAttribute('name'))) {
      const elementId = element.id || element.getAttribute('name');
      return `${type}_${elementId}_${index}`;
    }
    
    // Generate ID from table content characteristics
    const headers = data[0] || [];
    const rowCount = data.length - 1;
    const colCount = headers.length;
    
    // Create a simple hash from headers
    let hash = 0;
    const str = headers.join('|') + `_${rowCount}x${colCount}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `${type}_${Math.abs(hash).toString(36)}_${index}`;
  }
  
  highlightTable(index) {
    // Remove previous highlights
    document.querySelectorAll('.table-chart-highlight').forEach(el => {
      el.classList.remove('table-chart-highlight');
    });
    
    if (index >= 0 && index < this.tables.length) {
      const table = this.tables[index];
      if (table.element) {
        table.element.classList.add('table-chart-highlight');
        table.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
  
  selectTable(index) {
    this.selectedTableIndex = index;
    this.highlightTable(index);
  }
  
  getSelectedTable() {
    if (this.selectedTableIndex >= 0 && this.selectedTableIndex < this.tables.length) {
      return this.tables[this.selectedTableIndex];
    }
    return null;
  }
  
  openChartWindow(chartConfig) {
    console.log('Opening chart window with config:', chartConfig);
    const chartUrl = chrome.runtime.getURL('chart.html');
    console.log('Chart URL:', chartUrl);
    
    if (this.chartWindow && !this.chartWindow.closed) {
      console.log('Updating existing chart window');
      this.chartWindow.postMessage({
        type: 'UPDATE_CHART',
        config: chartConfig
      }, '*');
      this.chartWindow.focus();
    } else {
      console.log('Opening new chart window');
      this.chartWindow = window.open(
        chartUrl,
        'tableChart',
        'width=1000,height=700,resizable=yes,scrollbars=yes'
      );
      
      // Store the config to send when ready
      this.pendingChartConfig = chartConfig;
      
      // Set up listener for ready signal from chart window
      const readyListener = (event) => {
        if (event.data.type === 'CHART_READY') {
          console.log('Chart window is ready, sending config:', this.pendingChartConfig);
          this.chartWindow.postMessage({
            type: 'INIT_CHART',
            config: this.pendingChartConfig
          }, '*');
          window.removeEventListener('message', readyListener);
        }
      };
      
      window.addEventListener('message', readyListener);
      
      // Fallback timeout in case ready signal is missed
      setTimeout(() => {
        console.log('Fallback: sending config after timeout');
        if (this.chartWindow && !this.chartWindow.closed) {
          this.chartWindow.postMessage({
            type: 'INIT_CHART',
            config: chartConfig
          }, '*');
        }
        window.removeEventListener('message', readyListener);
      }, 2000);
    }
  }
}

// Global instance
const tableDetector = new TableDetector();

// Make it available globally for OCR integration
window.tableDetector = tableDetector;

// Message passing with popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'detectTables') {
    const tables = tableDetector.detectTables();
    sendResponse({ tables: tables.map(t => ({
      type: t.type,
      preview: t.preview,
      id: t.id,
      columns: t.data.length > 0 ? t.data[0] : []
    }))});
  } else if (request.action === 'selectTable') {
    tableDetector.selectTable(request.index);
    sendResponse({ success: true });
  } else if (request.action === 'getTableData') {
    // Do NOT re-run detectTables() here; it would wipe dynamically added pdf-batch tables
    const tables = tableDetector.tables;
    if (request.index >= 0 && request.index < tables.length) {
      sendResponse({ success: true, data: tables[request.index].data });
    } else {
      sendResponse({ 
        success: false, 
        error: 'Invalid table index' 
      });
    }
  } else if (request.action === 'generateChart') {
    const selectedTable = tableDetector.getSelectedTable();
    if (selectedTable) {
      tableDetector.openChartWindow({
        data: selectedTable.data,
        chartType: request.chartType,
        xColumn: request.xColumn,
        yColumns: request.yColumns
      });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No table selected' });
    }
  } else if (request.action === 'startOCR') {
    if (window.ocrCapture) {
      window.ocrCapture.startCapture();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'OCR functionality not available' });
    }
  } else if (request.action === 'startImageCapture') {
    if (window.ocrCapture) {
      try {
        window.ocrCapture.imageServiceMode = true; // flag to use image service
        window.ocrCapture.startCapture();
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    } else {
      sendResponse({ success: false, error: 'Capture functionality not available' });
    }
  } else if (request.action === 'pdfTableDetected') {
    // Handle PDF table detection notification
    sendResponse({ success: true });
  } else if (request.action === 'getPDFContextInfo') {
    try {
      const pdfUrl = (window.ocrCapture && window.ocrCapture.getPDFUrl) ? window.ocrCapture.getPDFUrl() : null;
      if (!pdfUrl) {
        sendResponse({ success:false, error:'PDF URL not found' });
      } else {
        sendResponse({ success:true, pdfUrl });
      }
    } catch (e) {
      sendResponse({ success:false, error:e.message });
    }
  } else if (request.action === 'addBatchExtractedTables') {
    try {
      const tables = request.tables || [];
      console.log('[BatchInject] Incoming tables raw:', tables);
      tables.forEach((t, idx) => {
        // Accept normalized (rows at top-level) or original shape (table.rows)
        let rows = t.rows || t.data || (t.table && t.table.rows) || [];
        if (!rows || rows.length === 0) {
          // Some services return { columns:[], data:[...] } or similar; attempt reconstruction
          if (t.columns && Array.isArray(t.data)) {
            rows = [t.columns, ...t.data];
          } else if (t.columns && Array.isArray(t.rowsData)) {
            rows = [t.columns, ...t.rowsData];
          }
        }
        if (!rows || rows.length === 0) {
          console.warn('[BatchInject] Skipping table with no row data at index', idx, t);
          return;
        }
        const preview = tableDetector.generatePreview(rows);
        const page = t.page != null ? t.page : t.table?.page;
        const tableIndex = t.table_index != null ? t.table_index : t.index != null ? t.index : t.table?.table_index;
        console.log('[BatchInject] Adding table', { idx, page, tableIndex, rowCount: rows.length, colCount: rows[0]?.length });
        const tableId = tableDetector.generateTableId({ data: rows }, 'pdf-batch', idx);
        tableDetector.tables.push({
          type: 'pdf-batch',
          element: null,
            data: rows,
            preview: preview,
            id: tableId,
            page: page,
            tableIndex: tableIndex
        });
        // Notify popup incrementally if desired
        chrome.runtime.sendMessage({
          action: 'pdfTableDetected',
          table: {
            type: 'pdf-batch',
            preview,
            id: tableId,
            columns: Array.isArray(rows[0]) ? rows[0] : [],
            page: page,
            tableIndex: tableIndex
          }
        });
      });
      sendResponse({ success:true, added: tables.length });
    } catch (e) {
      console.error('Error adding batch tables:', e);
      sendResponse({ success:false, error:e.message });
    }
  } else if (request.action === 'listCurrentTables') {
    try {
      const meta = tableDetector.tables.map(t => ({
        type: t.type,
        preview: t.preview,
        id: t.id,
        columns: Array.isArray(t.data) && Array.isArray(t.data[0]) ? t.data[0] : [],
        page: t.page,
        tableIndex: t.tableIndex
      }));
      sendResponse({ success:true, tables: meta });
    } catch (e) {
      sendResponse({ success:false, error: e.message });
    }
  } else if (request.action === 'getAllTablesData') {
    try {
      const payload = tableDetector.tables.map(t => ({
        id: t.id,
        data: t.data
      }));
      sendResponse({ success:true, tables: payload });
    } catch (e) {
      sendResponse({ success:false, error: e.message });
    }
  } else if (request.action === 'clearAllTables') {
    try {
      // Clear all stored tables from memory
      const clearedTableIds = tableDetector.tables.map(table => table.id);
      tableDetector.tables = [];
      
      // Clear all table state from localStorage and sessionStorage for these table IDs
      let clearedStateCount = 0;
      clearedTableIds.forEach(tableId => {
        const stateKey = `tableLens_state_${tableId}`;
        
        // Try localStorage first
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            if (window.localStorage.getItem(stateKey)) {
              window.localStorage.removeItem(stateKey);
              clearedStateCount++;
              console.log(`🗑️ Cleared localStorage state for ${tableId}`);
            }
          }
        } catch (e) {
          console.warn('Could not access localStorage:', e);
        }
        
        // Try sessionStorage as fallback
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            if (window.sessionStorage.getItem(stateKey)) {
              window.sessionStorage.removeItem(stateKey);
              clearedStateCount++;
              console.log(`🗑️ Cleared sessionStorage state for ${tableId}`);
            }
          }
        } catch (e) {
          console.warn('Could not access sessionStorage:', e);
        }
      });
      
      console.log(`All stored tables have been cleared (${clearedTableIds.length} tables, ${clearedStateCount} state entries)`);
      sendResponse({ 
        success: true, 
        message: `Cleared ${clearedTableIds.length} tables and ${clearedStateCount} state entries`,
        clearedTables: clearedTableIds.length,
        clearedStates: clearedStateCount
      });
    } catch (e) {
      console.error('Error clearing tables:', e);
      sendResponse({ success: false, error: e.message });
    }
  } else if (request.action === 'loadSavedState') {
    try {
      const savedState = request.savedState;
      
      if (!savedState || !savedState.state) {
        sendResponse({ success: false, error: 'Invalid saved state data' });
        return;
      }
      
      // Open a new table viewer window with the saved state
      const tableViewerURL = chrome.runtime.getURL('table-viewer.html');
      const newWindow = window.open(tableViewerURL, '_blank');
      
      if (newWindow) {
        // Use a more reliable approach to send data to the new window
        const sendDataToWindow = () => {
          try {
            // Reconstruct the table data from the saved state
            const tableData = {
              tableData: savedState.state.tableData,
              tableInfo: {
                type: 'saved-state',
                source: savedState.name,
                timestamp: savedState.timestamp
              }
            };
            
            console.log('Sending TABLE_DATA to new window:', tableData);
            newWindow.postMessage({ 
              type: 'TABLE_DATA', 
              ...tableData 
            }, '*');
            
            // Send the full state for restoration after a short delay
            setTimeout(() => {
              console.log('Sending RESTORE_SAVED_STATE to new window');
              newWindow.postMessage({ 
                type: 'RESTORE_SAVED_STATE', 
                savedState: savedState.state 
              }, '*');
            }, 300);
          } catch (error) {
            console.error('Error sending data to new window:', error);
          }
        };
        
        // Try multiple approaches to ensure the data gets sent
        // 1. Immediate attempt
        setTimeout(sendDataToWindow, 100);
        
        // 2. Window load event
        newWindow.addEventListener('load', () => {
          setTimeout(sendDataToWindow, 50);
        });
        
        // 3. Document ready state check with polling
        const pollForReady = () => {
          try {
            if (newWindow.document && newWindow.document.readyState === 'complete') {
              sendDataToWindow();
            } else {
              setTimeout(pollForReady, 100);
            }
          } catch (e) {
            // Cross-origin or timing issues, use fallback
            setTimeout(sendDataToWindow, 200);
          }
        };
        setTimeout(pollForReady, 50);
        
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Failed to open new window. Popup blocked?' });
      }
    } catch (e) {
      console.error('Error loading saved state:', e);
      sendResponse({ success: false, error: e.message });
    }
  }
  
  return true; // Keep message channel open
});

// Listen for chart export messages
window.addEventListener('message', (event) => {
  if (event.data.type === 'CHART_EXPORT') {
    // Forward to popup
    chrome.runtime.sendMessage({
      action: 'chartExport',
      format: event.data.format,
      data: event.data.data,
      filename: event.data.filename
    });
  }
});

// Auto-detect tables when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => tableDetector.detectTables(), 1000);
  });
} else {
  setTimeout(() => tableDetector.detectTables(), 1000);
}