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
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th');
      const rowData = Array.from(cells).map(cell => cell.textContent.trim());
      if (rowData.length > 0) {
        data.push(rowData);
      }
    });
    
    return data;
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
    
    // Detect HTML tables
    const htmlTables = document.querySelectorAll('table');
    htmlTables.forEach((table, index) => {
      const data = TableParser.parseHTMLTable(table);
      if (data.length > 1) { // At least header + 1 row
        this.tables.push({
          type: 'html',
          element: table,
          data: data,
          preview: this.generatePreview(data),
          id: `html-${index}`
        });
      }
    });
    
    // Detect CSV-like content in pre/code elements
    const preElements = document.querySelectorAll('pre, code');
    preElements.forEach((element, index) => {
      const text = element.textContent;
      if (this.looksLikeCSV(text)) {
        const data = TableParser.parseCSV(text);
        if (data.length > 1) {
          this.tables.push({
            type: 'csv',
            element: element,
            data: data,
            preview: this.generatePreview(data),
            id: `csv-${index}`
          });
        }
      }
      
      if (this.looksLikeMarkdown(text)) {
        const data = TableParser.parseMarkdownTable(text);
        if (data.length > 1) {
          this.tables.push({
            type: 'markdown',
            element: element,
            data: data,
            preview: this.generatePreview(data),
            id: `markdown-${index}`
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
        this.tables.push({
          type: `${type}-selection`,
          element: null,
          data: data,
          preview: this.generatePreview(data),
          id: 'selection-0'
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