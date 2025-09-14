class PopupController {
  constructor() {
    this.tables = [];
    this.selectedTableIndex = -1;
    this.selectedTable = null;
    
    this.initializeElements();
    this.attachEventListeners();
    this.scanForTables();
  }
  
  initializeElements() {
    this.elements = {
      tableList: document.getElementById('tableList'),
      chartOptions: document.getElementById('chartOptions'),
      chartType: document.getElementById('chartType'),
      xColumn: document.getElementById('xColumn'),
      yColumns: document.getElementById('yColumns'),
      scanTables: document.getElementById('scanTables'),
      ocrCapture: document.getElementById('ocrCapture'),
  imageCapture: document.getElementById('imageCapture'),
    allTables: document.getElementById('allTables'),
      generateChart: document.getElementById('generateChart'),
      exportPNG: document.getElementById('exportPNG'),
      exportSVG: document.getElementById('exportSVG'),
      status: document.getElementById('status')
    };
  }
  
  attachEventListeners() {
    this.elements.scanTables.addEventListener('click', () => this.scanForTables());
  this.elements.ocrCapture.addEventListener('click', () => this.startOCRCapture());
  this.elements.imageCapture.addEventListener('click', () => this.startImageCapture());
  this.elements.allTables.addEventListener('click', () => this.startAllTablesExtraction());
    this.elements.generateChart.addEventListener('click', () => this.generateChart());
    this.elements.exportPNG.addEventListener('click', () => this.exportChart('png'));
    this.elements.exportSVG.addEventListener('click', () => this.exportChart('svg'));
    
    this.elements.chartType.addEventListener('change', () => this.updateChartOptions());
    this.elements.xColumn.addEventListener('change', () => this.validateChartInputs());
  }

  async startAllTablesExtraction() {
    // Prompt for page range
    const input = prompt('Enter page range (e.g. 1-3,5,7). Max 20 pages.');
    if (input == null) return; // cancelled
    const pages = this.parsePageRange(input);
    if (!pages.success) {
      this.showStatus('Page range error: ' + pages.error, 'error');
      return;
    }
    if (pages.pages.length === 0) {
      this.showStatus('No valid pages specified.', 'error');
      return;
    }
    this.showStatus('Preparing batch extraction for pages: ' + pages.pages.map(p=>p+1).join(', '), 'info');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      // Ask content script to provide PDF URL (reuse OCR capture util indirectly if possible)
      const pdfInfo = await chrome.tabs.sendMessage(tab.id, { action: 'getPDFContextInfo' });
      if (!pdfInfo || !pdfInfo.success) {
        this.showStatus('Not on a PDF page or cannot detect PDF URL.', 'error');
        return;
      }
      const resp = await chrome.runtime.sendMessage({
        action: 'extractAllTablesFromPDF',
        pdfUrl: pdfInfo.pdfUrl,
        pages: pages.pages
      });
      if (!resp || !resp.success) {
        this.showStatus('Extraction failed: ' + (resp?.error || 'Unknown error'), 'error');
        return;
      }
      const result = resp.data;
      // Service may return either { tables: [...] } or a raw array
      let rawTables;
      if (Array.isArray(result)) {
        rawTables = result; // already the array of table wrappers
      } else if (Array.isArray(result?.tables)) {
        rawTables = result.tables;
      } else {
        rawTables = [];
      }
      console.log('[Popup Batch] Raw service tables length:', rawTables.length, 'Sample first:', rawTables[0]);
      if (rawTables.length === 0) {
        this.showStatus('No tables found in specified pages.', 'error');
        return;
      }
      // Normalize to a structure expected by content script: each object should expose rows directly.
      const normalized = rawTables.map(rt => {
        const rows = rt.rows || rt.data || (rt.table && rt.table.rows) || [];
        return {
          rows,
          page: rt.page != null ? rt.page : rt.table?.page,
          table_index: rt.table_index != null ? rt.table_index : rt.table?.table_index,
          bbox: rt.bbox || rt.table?.bbox || null
        };
      });
      console.log('[Popup Batch] Normalized tables preview:', normalized.slice(0,2));
      const addResp = await chrome.tabs.sendMessage(tab.id, { action: 'addBatchExtractedTables', tables: normalized });
      if (!addResp || !addResp.success) {
        this.showStatus('Failed injecting tables into page context.', 'error');
        return;
      }
      // Merge into popup list directly too using normalized
      normalized.forEach(t => {
        const preview = this.generatePreviewFromRaw(t.rows || []);
        console.log('[Popup BatchMerge] Normalized table added:', t);
        this.tables.push({
          type: 'pdf-batch',
          columns: (t.rows && Array.isArray(t.rows[0]) ? t.rows[0] : []),
          preview,
          page: t.page,
          tableIndex: t.table_index
        });
      });
      this.renderTableList();
      this.showStatus(`Added ${normalized.length} table(s) from batch extraction`, 'success');
      setTimeout(()=>this.hideStatus(), 2500);
    } catch (e) {
      console.error('Batch extraction error:', e);
      this.showStatus('Error during batch extraction: ' + e.message, 'error');
    }
  }

  parsePageRange(input) {
    try {
      const cleaned = input.replace(/\s+/g,'');
      if (!cleaned) return { success:false, error:'Empty input'};
      const parts = cleaned.split(',');
      const set = new Set();
      for (const part of parts) {
        if (!part) continue;
        if (part.includes('-')) {
          const [a,b] = part.split('-').map(n=>parseInt(n,10));
          if (isNaN(a)||isNaN(b)||a<1||b<1) return {success:false,error:'Invalid range token: '+part};
          const start = Math.min(a,b); const end = Math.max(a,b);
            for (let p=start;p<=end;p++) set.add(p-1); // store zero-based
        } else {
          const v = parseInt(part,10);
          if (isNaN(v) || v<1) return {success:false,error:'Invalid page number: '+part};
          set.add(v-1);
        }
      }
      const arr = Array.from(set).sort((x,y)=>x-y);
      if (arr.length>20) return {success:false,error:'More than 20 pages specified ('+arr.length+')'};
      return {success:true,pages:arr};
    } catch (e) {
      return {success:false,error:e.message};
    }
  }

  generatePreviewFromRaw(data) {
    if (!Array.isArray(data) || data.length===0) return '';
    const maxCols = 3; const maxRows = 3;
    const preview = data.slice(0,maxRows).map(r=> r.slice(0,maxCols).map(c=>{
      if (c==null) return '';
      const s = String(c);
      return s.length>15? s.substring(0,12)+'...' : s;
    }).join(' | ')).join('\n');
    return preview + (data.length>maxRows?'\n...':'');
  }
  
  async scanForTables() {
    this.showStatus('Scanning for tables...', 'info');
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'detectTables'
      });
      
      this.tables = response.tables || [];
      this.renderTableList();
      
      if (this.tables.length === 0) {
        this.showStatus('No tables found on this page', 'error');
      } else {
        this.showStatus(`Found ${this.tables.length} table(s)`, 'success');
        setTimeout(() => this.hideStatus(), 2000);
      }
    } catch (error) {
      console.error('Error scanning tables:', error);
      this.showStatus('Error scanning page. Please refresh and try again.', 'error');
    }
  }
  
  async startOCRCapture() {
    try {
      this.showStatus('Starting table capture...', 'info');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we're on a PDF page first to show appropriate message
      const isPDFPage = tab.url && (tab.url.endsWith('.pdf') || tab.url.includes('.pdf'));
      
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'startOCR'
      });
      
      if (response.success) {
        if (isPDFPage) {
          this.showStatus('Select a table area - will use advanced extraction service', 'info');
        } else {
          this.showStatus('Select a table area on the page', 'info');
        }
        // Close popup to allow full screen interaction
        setTimeout(() => window.close(), 1000);
      } else {
        this.showStatus('Table capture not available: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Error starting OCR:', error);
      this.showStatus('Error starting table capture. Please try again.', 'error');
    }
  }

  async startImageCapture() {
    try {
      this.showStatus('Starting image capture...', 'info');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'startImageCapture' });
      if (response && response.success) {
        this.showStatus('Select an area – will use image extraction service', 'info');
        setTimeout(() => window.close(), 800);
      } else {
        this.showStatus('Image capture not available: ' + (response?.error || 'Unknown error'), 'error');
      }
    } catch (e) {
      console.error('Error starting image capture:', e);
      this.showStatus('Error starting image capture.', 'error');
    }
  }
  
  renderTableList() {
    if (this.tables.length === 0) {
      this.elements.tableList.innerHTML = `
        <div class="no-tables">
          <p>No tables detected on this page</p>
          <p class="hint">Try scanning for HTML/CSV tables or use Screenshot Capture to extract tables from images</p>
        </div>
      `;
      
      this.elements.chartOptions.style.display = 'none';
      return;
    }
    
    const tableItems = this.tables.map((table, index) => `
      <div class="table-item" data-index="${index}">
        <div class="table-type">
          <strong>${this.getTableTypeDisplay(table.type)}</strong>
          <span class="table-columns">(${table.columns.length} columns)</span>
        </div>
        <div class="table-preview">${table.preview}</div>
      </div>
    `).join('');
    
    this.elements.tableList.innerHTML = tableItems;
    
    // Attach click handlers
    this.elements.tableList.querySelectorAll('.table-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        this.openTableViewer(index);
      });
    });
  }
  
  getTableTypeDisplay(type) {
    const typeMap = {
      'html': '🏷️ HTML Table',
      'csv': '📊 CSV Data',
      'csv-selection': '📊 CSV Selection',
      'markdown': '📝 Markdown Table',
      'markdown-selection': '📝 Markdown Selection',
      'ocr': '📸 Captured from Screen',
      'pdf': '📄 Extracted from PDF',
      'image': '🖼️ Image Extraction',
      'pdf-batch': '📄 PDF Table (Batch)'
    };
    
    return typeMap[type] || '📋 Table';
  }
  
  async openTableViewer(index) {
    try {
      // Show loading state
      this.showStatus('Opening table viewer...', 'info');
      
      this.selectedTableIndex = index;
      this.selectedTable = this.tables[index];
      
      // Visual feedback - highlight selected table
      document.querySelectorAll('.table-item').forEach((item, i) => {
        item.classList.toggle('selected', i === index);
      });
      
      // Get full table data from content script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'getTableData',
        index: index
      });
      
      if (!response.success) {
        this.showStatus('Error loading table data', 'error');
        return;
      }
      
      // Open table viewer window
      const viewerUrl = chrome.runtime.getURL('table-viewer.html');
      const viewerWindow = window.open(
        viewerUrl,
        `tableViewer-${index}`,
        'width=1200,height=800,resizable=yes,scrollbars=yes,location=yes'
      );
      
      if (!viewerWindow) {
        this.showStatus('Please allow pop-ups for this extension', 'error');
        return;
      }
      
      // Send data when viewer is ready
      const messageListener = (event) => {
        if (event.data.type === 'REQUEST_TABLE_DATA') {
          console.log('Table viewer requesting data, sending...');
          viewerWindow.postMessage({
            type: 'TABLE_DATA',
            tableData: response.data,
            tableInfo: this.selectedTable
          }, '*');
          window.removeEventListener('message', messageListener);
        }
      };
      
      window.addEventListener('message', messageListener);
      
      // Fallback: send data after timeout
      viewerWindow.addEventListener('load', () => {
        setTimeout(() => {
          viewerWindow.postMessage({
            type: 'TABLE_DATA',
            tableData: response.data,
            tableInfo: this.selectedTable
          }, '*');
          window.removeEventListener('message', messageListener);
        }, 500);
      });
      
      // Close popup after opening viewer
      setTimeout(() => window.close(), 1000);
      
    } catch (error) {
      console.error('Error opening table viewer:', error);
      this.showStatus('Error opening table viewer', 'error');
    }
  }
  
  async selectTable(index) {
    // Update visual selection
    this.elements.tableList.querySelectorAll('.table-item').forEach((item, i) => {
      item.classList.toggle('selected', i === index);
    });
    
    this.selectedTableIndex = index;
    this.selectedTable = this.tables[index];
    
    // Highlight table on page
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, {
        action: 'selectTable',
        index: index
      });
    } catch (error) {
      console.error('Error selecting table:', error);
    }
    
    // Show chart options
    this.setupChartOptions();
    this.elements.chartOptions.style.display = 'block';
  }
  
  async selectTable(index) {
    // Update visual selection
    this.elements.tableList.querySelectorAll('.table-item').forEach((item, i) => {
      item.classList.toggle('selected', i === index);
    });
    
    this.selectedTableIndex = index;
    this.selectedTable = this.tables[index];
    
    // Highlight table on page
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, {
        action: 'selectTable',
        index: index
      });
    } catch (error) {
      console.error('Error selecting table:', error);
    }
    
    // Show chart options
    this.setupChartOptions();
    this.elements.chartOptions.style.display = 'block';
  }
  
  setupChartOptions() {
    if (!this.selectedTable) return;
    
    const columns = this.selectedTable.columns;
    
    // Populate X-axis column dropdown
    this.elements.xColumn.innerHTML = '<option value="">Select column...</option>';
    columns.forEach((column, index) => {
      this.elements.xColumn.innerHTML += `<option value="${index}">${column}</option>`;
    });
    
    // Populate Y-axis checkboxes
    this.elements.yColumns.innerHTML = '';
    columns.forEach((column, index) => {
      const isNumeric = this.isNumericColumn(index);
      const checkbox = document.createElement('div');
      checkbox.className = 'checkbox-item';
      checkbox.innerHTML = `
        <input type="checkbox" id="col-${index}" value="${index}" ${isNumeric ? 'checked' : ''}>
        <label for="col-${index}">${column} ${isNumeric ? '🔢' : '📝'}</label>
      `;
      this.elements.yColumns.appendChild(checkbox);
    });
    
    // Auto-select first column as X-axis if it looks like labels
    if (columns.length > 0 && !this.isNumericColumn(0)) {
      this.elements.xColumn.value = '0';
    }
    
    this.elements.yColumns.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => this.validateChartInputs());
    });
    
    this.validateChartInputs();
  }
  
  isNumericColumn(columnIndex) {
    if (!this.selectedTable || !this.selectedTable.columns) return false;
    
    // Simple heuristic: check if column name suggests numeric data
    const columnName = this.selectedTable.columns[columnIndex].toLowerCase();
    const numericKeywords = ['count', 'total', 'sum', 'avg', 'average', 'number', 'amount', 'value', 'price', 'cost', 'score', 'rate', 'percent'];
    
    return numericKeywords.some(keyword => columnName.includes(keyword)) || 
           /\d/.test(columnName) ||
           columnName.includes('%');
  }
  
  updateChartOptions() {
    const chartType = this.elements.chartType.value;
    const isPieChart = chartType === 'pie' || chartType === 'doughnut';
    
    // For pie charts, we typically want one categorical and one numeric column
    if (isPieChart) {
      // Limit Y columns selection to 1 for pie charts
      const checkboxes = this.elements.yColumns.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((checkbox, index) => {
        if (checkbox.checked && index > 0) {
          checkbox.checked = false;
        }
      });
    }
    
    this.validateChartInputs();
  }
  
  validateChartInputs() {
    const hasXColumn = this.elements.xColumn.value !== '';
    const selectedYColumns = this.elements.yColumns.querySelectorAll('input[type="checkbox"]:checked');
    const hasYColumns = selectedYColumns.length > 0;
    
    this.elements.generateChart.disabled = !hasXColumn || !hasYColumns;
  }
  
  async generateChart() {
    if (!this.selectedTable) return;
    
    const xColumn = parseInt(this.elements.xColumn.value);
    const yColumns = Array.from(
      this.elements.yColumns.querySelectorAll('input[type="checkbox"]:checked')
    ).map(cb => parseInt(cb.value));
    
    const chartConfig = {
      chartType: this.elements.chartType.value,
      xColumn: xColumn,
      yColumns: yColumns
    };
    
    try {
      this.showStatus('Generating chart...', 'info');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'generateChart',
        ...chartConfig
      });
      
      if (response.success) {
        this.showStatus('Chart generated successfully!', 'success');
        this.elements.exportPNG.disabled = false;
        this.elements.exportSVG.disabled = false;
        setTimeout(() => this.hideStatus(), 2000);
      } else {
        this.showStatus('Error generating chart: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Error generating chart:', error);
      this.showStatus('Error generating chart. Please try again.', 'error');
    }
  }
  
  async exportChart(format) {
    try {
      this.showStatus(`Exporting chart as ${format.toUpperCase()}...`, 'info');
      
      // This will be handled by the chart window
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, {
        action: 'exportChart',
        format: format
      });
      
    } catch (error) {
      console.error('Error exporting chart:', error);
      this.showStatus('Error exporting chart. Please try again.', 'error');
    }
  }
  
  showStatus(message, type) {
    this.elements.status.style.display = 'block';
    this.elements.status.querySelector('.status-message').textContent = message;
    this.elements.status.querySelector('.status-message').className = `status-message status-${type}`;
  }
  
  hideStatus() {
    this.elements.status.style.display = 'none';
  }
}

// Handle chart export messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'chartExport') {
    // Trigger download
    const link = document.createElement('a');
    link.download = request.filename;
    link.href = request.data;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show success message
    if (popupController) {
      popupController.showStatus(`Chart exported as ${request.format.toUpperCase()}`, 'success');
      setTimeout(() => popupController.hideStatus(), 3000);
    }
  } else if (request.action === 'ocrTableDetected' || request.action === 'pdfTableDetected') {
    // Handle OCR/PDF table detection
    if (popupController) {
      popupController.tables.push(request.table);
      popupController.renderTableList();
      const method = request.action === 'pdfTableDetected' ? 'advanced extraction service' : 'screen capture';
      popupController.showStatus(`Table extracted using ${method} successfully!`, 'success');
    }
  }
});

// Initialize popup when DOM is loaded
let popupController;
document.addEventListener('DOMContentLoaded', () => {
  popupController = new PopupController();
});