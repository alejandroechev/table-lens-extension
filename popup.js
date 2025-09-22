class PopupController {
  constructor() {
    this.tables = [];
    this.selectedTableIndex = -1;
    this.selectedTable = null;
    this.tableSearchCache = []; // full-text per table (lowercased)
    this.searchCacheReady = false;
    this.license = null; // license state
    
    this.initializeElements();
    this.attachEventListeners();
    // Removed automatic table scanning - now done via Extract All Tables button
  this.restoreExistingTables();
  this.loadSavedStates();
  this.initializeSavedStateListener();
  this.initializeLicense();
  }
  
  initializeElements() {
    this.elements = {
      tableList: document.getElementById('tableList'),
      tableSearch: document.getElementById('tableSearch'),
      themeToggle: document.getElementById('themeToggle'),
      chartOptions: document.getElementById('chartOptions'),
      chartType: document.getElementById('chartType'),
      xColumn: document.getElementById('xColumn'),
      yColumns: document.getElementById('yColumns'),
      scanTables: document.getElementById('scanTables'),
      ocrCapture: document.getElementById('ocrCapture'),
      imageCapture: document.getElementById('imageCapture'),
      allTables: document.getElementById('allTables'),
      exportAllTablesXLSX: document.getElementById('exportAllTablesXLSX'),
      savedStatesList: document.getElementById('savedStatesList'),
      generateChart: document.getElementById('generateChart'),
      exportPNG: document.getElementById('exportPNG'),
      exportSVG: document.getElementById('exportSVG'),
      status: document.getElementById('status')
    };
    
    // Initialize theme
    this.initializeTheme();
  }  attachEventListeners() {
    this.elements.scanTables.addEventListener('click', () => this.scanForTables());
    this.elements.ocrCapture.addEventListener('click', () => this.startOCRCapture());
    this.elements.imageCapture.addEventListener('click', () => this.startImageCapture());
    this.elements.allTables.addEventListener('click', () => this.startAllTablesExtraction());
    this.elements.exportAllTablesXLSX.addEventListener('click', () => this.exportAllTablesToXLSX());
    this.elements.themeToggle?.addEventListener('click', () => this.toggleTheme());
    if (this.elements.tableSearch) {
      this.elements.tableSearch.addEventListener('input', () => this.renderTableList());
    }
    this.elements.generateChart.addEventListener('click', () => this.generateChart());
    this.elements.exportPNG.addEventListener('click', () => this.exportChart('png'));
    this.elements.exportSVG.addEventListener('click', () => this.exportChart('svg'));
    
    this.elements.chartType.addEventListener('change', () => this.updateChartOptions());
    this.elements.xColumn.addEventListener('change', () => this.validateChartInputs());
  }  async startAllTablesExtraction() {
    this.showStatus('Detecting content type...', 'info');
      if (!this.guardExtraction()) return;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we're on a PDF page
      const isPDFPage = tab.url && (tab.url.endsWith('.pdf') || tab.url.includes('.pdf'));
      
      if (isPDFPage) {
        // PDF extraction flow
        await this.extractFromPDF(tab);
      } else {
        // Webpage extraction flow
        await this.extractFromWebpage(tab);
      }
    } catch (e) {
      console.error('Extraction error:', e);
      this.showStatus('Error during extraction: ' + e.message, 'error');
    }
  }

  async extractFromPDF(tab) {
    this.showStatus('Extracting all tables from PDF...', 'info');
    try {
      // Ask content script to provide PDF URL
      const pdfInfo = await chrome.tabs.sendMessage(tab.id, { action: 'getPDFContextInfo' });
      if (!pdfInfo || !pdfInfo.success) {
        this.showStatus('Cannot detect PDF URL. Please refresh the page.', 'error');
        return;
      }
      const resp = await chrome.runtime.sendMessage({
        action: 'extractAllTablesFromPDF',
        pdfUrl: pdfInfo.pdfUrl
      });
      if (!resp || !resp.success) {
        // Fallback: some service versions still require explicit pages
        const errMsg = resp?.error || 'Unknown error';
        if (/no pages specified/i.test(errMsg)) {
          const fallback = await this.fallbackPageRangeFlow(pdfInfo.pdfUrl, tab.id);
          if (!fallback) {
            this.showStatus('Extraction cancelled (pages required).', 'error');
          }
          return;
        }
        this.showStatus('PDF extraction failed: ' + errMsg, 'error');
        return;
      }
      const result = resp.data;
      let rawTables;
      if (Array.isArray(result)) {
        rawTables = result;
      } else if (Array.isArray(result?.tables)) {
        rawTables = result.tables;
      } else {
        rawTables = [];
      }
      if (rawTables.length === 0) {
        this.showStatus('No tables found in PDF.', 'error');
        return;
      }
      // Normalize and inject tables
      const normalized = rawTables.map(rt => {
        const rows = rt.rows || rt.data || (rt.table && rt.table.rows) || [];
        return {
          rows,
          page: rt.page != null ? rt.page : rt.table?.page,
          table_index: rt.table_index != null ? rt.table_index : rt.table?.table_index,
          bbox: rt.bbox || rt.table?.bbox || null
        };
      });
      const addResp = await chrome.tabs.sendMessage(tab.id, { action: 'addBatchExtractedTables', tables: normalized });
      if (!addResp || !addResp.success) {
        this.showStatus('Failed processing extracted tables.', 'error');
        return;
      }
      // Add to popup list
      normalized.forEach((t, index) => {
        const preview = this.generatePreviewFromRaw(t.rows || []);
        const tableId = `pdf_p${t.page || 0}_t${t.table_index || index}_${Date.now()}`;
        this.tables.push({
          id: tableId, // Add consistent ID for state management
          type: 'pdf-batch',
          columns: (t.rows && Array.isArray(t.rows[0]) ? t.rows[0] : []),
          preview,
          page: t.page,
          tableIndex: t.table_index
        });
      });
      this.renderTableList();
      // Build search cache after adding tables
      this.buildSearchCache(tab.id);
      this.showStatus(`Successfully extracted ${normalized.length} table(s) from PDF`, 'success');
      setTimeout(() => this.hideStatus(), 2500);
    } catch (e) {
      console.error('PDF extraction error:', e);
      this.showStatus('Error during PDF extraction: ' + e.message, 'error');
    }
  }

  async extractFromWebpage(tab) {
    this.showStatus('Scanning webpage for tables...', 'info');
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'detectTables'
      });
      
      this.tables = response.tables || [];
      this.renderTableList();
  this.buildSearchCache(tab.id);
      
      if (this.tables.length === 0) {
        this.showStatus('No tables found on this webpage', 'error');
      } else {
        this.showStatus(`Found ${this.tables.length} table(s) on webpage`, 'success');
          // Record usage only if tables were actually found (free tier)
          await this.recordExtractionUsage(this.tables.length);
        setTimeout(() => this.hideStatus(), 2000);
      }
    } catch (error) {
      console.error('Error scanning webpage:', error);
      this.showStatus('Error scanning webpage. Please refresh and try again.', 'error');
    }
  }

  async restoreExistingTables() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      const resp = await chrome.tabs.sendMessage(tab.id, { action: 'listCurrentTables' });
      if (!resp || !resp.success || !Array.isArray(resp.tables) || resp.tables.length === 0) return;
      // Deduplicate by id if popup was reopened rapidly
      const existingIds = new Set(this.tables.map(t => t.id));
      let added = 0;
      resp.tables.forEach((t, index) => {
        if (existingIds.has(t.id)) return;
        // Ensure table has an ID for state management
        if (!t.id) {
          t.id = `restored_${t.type || 'table'}_${index}_${Date.now()}`;
        }
        this.tables.push(t);
        existingIds.add(t.id);
        added++;
      });
      if (added > 0) {
        this.renderTableList();
        this.buildSearchCache(tab.id);
        this.showStatus(`Restored ${added} table(s) from previous extraction`, 'success');
        setTimeout(()=>this.hideStatus(), 2000);
      }
    } catch (e) {
      // Silent fail – likely no content script yet
      console.debug('No existing tables to restore:', e.message);
    }
  }

  async buildSearchCache(tabId) {
    if (!tabId) {
      const tabs = await chrome.tabs.query({ active:true, currentWindow:true });
      tabId = tabs[0]?.id;
    }
    if (!tabId) return;
    try {
      this.searchCacheReady = false;
      const resp = await chrome.tabs.sendMessage(tabId, { action: 'getAllTablesData' });
      if (!resp || !resp.success) return;
      const map = new Map(resp.tables.map(t => [t.id, t.data]));
      this.tableSearchCache = this.tables.map(t => {
        const data = map.get(t.id);
        if (!data) return (t.preview||'').toLowerCase();
        // Flatten rows to a single search blob
        try {
          const flat = data.map(row => (Array.isArray(row)? row.join(' ') : '')).join(' \n ');
          return flat.toLowerCase();
        } catch {
          return (t.preview||'').toLowerCase();
        }
      });
      this.searchCacheReady = true;
      // Re-render if a query is in progress
      if ((this.elements.tableSearch?.value||'').trim()) {
        this.renderTableList();
      }
    } catch (e) {
      console.debug('Failed to build search cache:', e.message);
    }
  }

  // Fallback flow when backend insists on pages parameter
  async fallbackPageRangeFlow(pdfUrl, tabId) {
    try {
      const input = prompt('Service requires explicit page list. Enter page range (e.g. 1-3,5). Max 20 pages.');
      if (input == null) return false;
      const parsed = this.parsePageRange(input);
      if (!parsed.success) {
        this.showStatus('Page range error: ' + parsed.error, 'error');
        return false;
      }
      if (parsed.pages.length === 0) {
        this.showStatus('No valid pages specified.', 'error');
        return false;
      }
      this.showStatus('Retrying with pages: ' + parsed.pages.map(p=>p+1).join(', '), 'info');
      const resp = await chrome.runtime.sendMessage({
        action: 'extractAllTablesFromPDF',
        pdfUrl,
        pages: parsed.pages
      });
      if (!resp || !resp.success) {
        this.showStatus('Fallback extraction failed: ' + (resp?.error || 'Unknown error'), 'error');
        return false;
      }
      const result = resp.data;
      let rawTables;
      if (Array.isArray(result)) rawTables = result; else if (Array.isArray(result?.tables)) rawTables = result.tables; else rawTables = [];
      if (rawTables.length === 0) {
        this.showStatus('No tables found for specified pages.', 'error');
        return true; // handled, but empty
      }
      const normalized = rawTables.map(rt => {
        const rows = rt.rows || rt.data || (rt.table && rt.table.rows) || [];
        return {
          rows,
          page: rt.page != null ? rt.page : rt.table?.page,
          table_index: rt.table_index != null ? rt.table_index : rt.table?.table_index,
          bbox: rt.bbox || rt.table?.bbox || null
        };
      });
      const addResp = await chrome.tabs.sendMessage(tabId, { action: 'addBatchExtractedTables', tables: normalized });
      if (!addResp || !addResp.success) {
        this.showStatus('Failed injecting tables after fallback.', 'error');
        return false;
      }
      normalized.forEach((t, index) => {
        const preview = this.generatePreviewFromRaw(t.rows || []);
        const tableId = `fallback_p${t.page || 0}_t${t.table_index || index}_${Date.now()}`;
        this.tables.push({
          id: tableId, // Add consistent ID for state management
          type: 'pdf-batch',
          columns: (t.rows && Array.isArray(t.rows[0]) ? t.rows[0] : []),
          preview,
          page: t.page,
          tableIndex: t.table_index
        });
      });
      this.renderTableList();
      this.showStatus(`Added ${normalized.length} table(s) from specified pages`, 'success');
      setTimeout(()=>this.hideStatus(), 2500);
      return true;
    } catch (e) {
      console.error('Fallback page flow error:', e);
      this.showStatus('Fallback error: ' + e.message, 'error');
      return false;
    }
  }

  // Reintroduced page range parser for fallback only
  parsePageRange(input) {
    try {
      const cleaned = (input||'').replace(/\s+/g,'');
      if (!cleaned) return { success:false, error:'Empty input' };
      const parts = cleaned.split(',');
      const set = new Set();
      for (const part of parts) {
        if (!part) continue;
        if (part.includes('-')) {
          const [a,b] = part.split('-').map(n=>parseInt(n,10));
          if (isNaN(a)||isNaN(b)||a<1||b<1) return {success:false,error:'Invalid range: '+part};
          const start = Math.min(a,b); const end = Math.max(a,b);
          for (let p=start; p<=end; p++) set.add(p-1);
        } else {
          const v = parseInt(part,10);
          if (isNaN(v)||v<1) return {success:false,error:'Invalid page: '+part};
          set.add(v-1);
        }
      }
      const arr = Array.from(set).sort((x,y)=>x-y);
      if (arr.length>20) return {success:false,error:'More than 20 pages specified ('+arr.length+')'};
      return { success:true, pages: arr };
    } catch (e) {
      return { success:false, error: e.message };
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
          <p class="hint">Click "Extract All Tables" to automatically detect and extract HTML tables from webpages</p>
        </div>
      `;
      
      this.elements.chartOptions.style.display = 'none';
      // Hide export button when no tables
      if (this.elements.exportAllTablesXLSX) {
        this.elements.exportAllTablesXLSX.style.display = 'none';
      }
      return;
    }
    const q = (this.elements.tableSearch?.value || '').trim().toLowerCase();
    const filtered = q ? this.tables.filter((t, idx) => {
      const hay = this.tableSearchCache[idx] || (t.preview + '\n' + (t.columns||[]).join(' ')).toLowerCase();
      return hay.includes(q);
    }) : this.tables;

    const highlight = (text) => {
      if (!q) return text;
      try {
        const re = new RegExp('(' + q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + ')', 'ig');
        return text.replace(re, '<span class="match-highlight">$1</span>');
      } catch { return text; }
    };

    const tableItems = filtered.map((table, visibleIndex) => {
      const originalIndex = this.tables.indexOf(table);
      const previewHtml = highlight(table.preview || '');
      const metaBits = [];
      if (typeof table.page === 'number') metaBits.push('p' + (table.page+1));
      if (typeof table.tableIndex === 'number') metaBits.push('#' + table.tableIndex);
      const meta = metaBits.length ? metaBits.join(' ') : '';
      return `
      <div class="table-item" data-index="${originalIndex}">
        <div class="table-item-header">
          <span>${table.columns.length} cols ${meta ? '• ' + meta : ''}</span>
        </div>
        <div class="table-preview">${previewHtml}</div>
      </div>`;
    }).join('');
    
    this.elements.tableList.innerHTML = tableItems;
    
    // Attach click handlers
    this.elements.tableList.querySelectorAll('.table-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index, 10);
        this.openTableViewer(index);
      });
    });
    
    // Show export button when tables are available
    if (this.elements.exportAllTablesXLSX && this.tables.length > 0) {
      this.elements.exportAllTablesXLSX.style.display = 'inline-block';
    }
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
            tableInfo: { ...this.selectedTable, persistedId: this.selectedTable.id }
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
            tableInfo: { ...this.selectedTable, persistedId: this.selectedTable.id }
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

  /**
   * Export all detected tables to a single XLSX file with multiple sheets
   */
  async exportAllTablesToXLSX() {
    if (!this.guardExportAllXLSX()) return;
    if (!this.tables || this.tables.length === 0) {
      this.showStatus('No tables available to export', 'error');
      return;
    }

    if (typeof XLSX === 'undefined') {
      this.showStatus('XLSX library not loaded. Please refresh the page.', 'error');
      return;
    }

    this.showStatus('Exporting all tables to XLSX...', 'info');

    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Get all table data from content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'getAllTablesData'
      });

      if (!response || !response.success) {
        this.showStatus('Failed to get table data from page', 'error');
        return;
      }

      // Create a new workbook
      const wb = XLSX.utils.book_new();
      
      let successCount = 0;
      
      // Process each table
      for (let i = 0; i < this.tables.length && i < response.tables.length; i++) {
        const table = this.tables[i];
        const tableData = response.tables.find(t => t.id === table.id);
        
        if (!tableData || !tableData.data || tableData.data.length === 0) {
          console.warn(`Skipping table ${i + 1}: No data available`);
          continue;
        }

        // Create worksheet from table data
        const ws = XLSX.utils.aoa_to_sheet(tableData.data);
        
        // Create a safe sheet name (max 31 chars, no special chars)
        let sheetName = `Table_${i + 1}`;
        if (table.source && typeof table.source === 'string') {
          // Use table source/title if available, sanitized
          const cleanSource = table.source
            .replace(/[\\/*?:[\\]]/g, '') // Remove invalid characters
            .substring(0, 20); // Limit length
          if (cleanSource) {
            sheetName = `${cleanSource}_${i + 1}`;
          }
        }
        
        // Ensure unique sheet name (Excel requirement)
        let finalSheetName = sheetName.substring(0, 31);
        let counter = 1;
        while (wb.SheetNames.includes(finalSheetName)) {
          const suffix = `_${counter}`;
          finalSheetName = sheetName.substring(0, 31 - suffix.length) + suffix;
          counter++;
        }
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
        successCount++;
      }

      if (successCount === 0) {
        this.showStatus('No valid table data found to export', 'error');
        return;
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const siteName = this.getSiteName(tab.url);
      const fileName = `${siteName}_all_tables_${timestamp}.xlsx`;

      // Mark usage function for when export actually happens
      const markUsage = () => {
        if (this.licenseManager && !this.licenseManager.isPremium()) {
          this.licenseManager.markExportAllXLSX().then(() => {
            this.updateLicenseUI();
          }).catch(err => {
            console.warn('[LICENSE][ExportAllXLSX] markExportAllXLSX() error', err);
          });
        }
      };

      // Write and download the file with Chrome downloads API if available
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);

      if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
        // Use Chrome downloads API and only mark usage on successful completion (after user presses Save)
        chrome.downloads.download({ url, filename: fileName, saveAs: true }, (downloadId) => {
          if (!downloadId) {
            URL.revokeObjectURL(url);
            this.showStatus('XLSX export cancelled', 'error');
            return;
          }

            // Inform user to finish the save dialog
            this.showStatus('Confirm save location to complete export...', 'info');

            let usageMarked = false;
            let finished = false;
            const startedAt = Date.now();

            const finalize = (success) => {
              if (finished) return;
              finished = true;
              chrome.downloads.onChanged.removeListener(listener);
              URL.revokeObjectURL(url);
              if (success) {
                this.showStatus(`Successfully exported ${successCount} table(s) to ${fileName}`, 'success');
                setTimeout(()=>this.hideStatus(),3000);
              } else {
                this.showStatus('XLSX export cancelled', 'error');
                setTimeout(()=>this.hideStatus(),3000);
              }
            };

            const markIfNeeded = () => {
              if (!usageMarked) {
                usageMarked = true;
                markUsage();
              }
            };

            const listener = (delta) => {
              if (delta.id !== downloadId) return;
              if (delta.state && delta.state.current) {
                const state = delta.state.current;
                if (state === 'complete') {
                  // Only now do we count usage (user pressed Save and download finished)
                  markIfNeeded();
                  finalize(true);
                } else if (state === 'interrupted') {
                  finalize(false);
                }
              }
            };
            chrome.downloads.onChanged.addListener(listener);

            // Fallback polling for browsers (Edge) that may miss completion event
            const pollIntervalMs = 3000;
            const maxWaitMs = 30000; // 30s before giving up (do not mark usage if unknown)
            const poll = () => {
              if (finished) return;
              chrome.downloads.search({ id: downloadId }, (results) => {
                if (finished) return;
                const item = Array.isArray(results) ? results[0] : null;
                if (item) {
                  if (item.state === 'complete') {
                    markIfNeeded();
                    finalize(true);
                    return;
                  } else if (item.state === 'interrupted') {
                    finalize(false);
                    return;
                  }
                }
                if (Date.now() - startedAt < maxWaitMs) {
                  setTimeout(poll, pollIntervalMs);
                } else {
                  // Timed out waiting; assume user cancelled (do not mark usage)
                  finalize(false);
                }
              });
            };
            setTimeout(poll, pollIntervalMs);
        });
      } else {
        // Fallback to direct XLSX.writeFile
        try {
          XLSX.writeFile(wb, fileName);
          // Direct write implies user accepted (no Save As dialog path)
          this.showStatus(`Successfully exported ${successCount} table(s) to ${fileName}`, 'success');
          markUsage();
        } finally {
          URL.revokeObjectURL(url);
        }
      }

      // hideStatus handled in lifecycle above

    } catch (error) {
      console.error('XLSX export error:', error);
      this.showStatus(`Error exporting to XLSX: ${error.message}`, 'error');
    }
  }

  /* ================= License & Feature Gating ================= */
  async initializeLicense() {
    try {
      // Dynamically import license manager
      const mod = await import(chrome.runtime.getURL('utils/license.js'))
        .catch(() => null);
      if (mod && mod.licenseManager) {
        this.licenseManager = mod.licenseManager;
      } else if (window.licenseManager) {
        // Fallback to global
        this.licenseManager = window.licenseManager;
      } else {
        console.warn('License manager not available');
        return;
      }
      await this.licenseManager.init();
      this.bindLicenseUI();
      await this.licenseManager.verifyLicense().catch(()=>{});
      this.updateLicenseUI();
      // Schedule a second refresh in case async storage resolved late
      setTimeout(() => this.updateLicenseUI(), 500);
    } catch (e) {
      console.error('License init failed', e);
    }
  }

  bindLicenseUI() {
    this.licenseUI = {
      plan: document.getElementById('planName'),
      extract: document.getElementById('extractStatus'),
      exportAll: document.getElementById('exportAllStatus'),
      exportSingle: document.getElementById('exportSingleStatus'),
      workspaces: document.getElementById('workspaceStatus'),
      keyInput: document.getElementById('licenseKeyInput'),
      applyBtn: document.getElementById('licenseApply'),
      verifyBtn: document.getElementById('licenseVerify'),
      upgradeLink: document.getElementById('upgradeLink'),
      usageToggle: document.getElementById('licenseUsageToggle'),
      usagePanel: document.getElementById('planStatus')
    };
    if (this.licenseUI.applyBtn) {
      this.licenseUI.applyBtn.addEventListener('click', async () => {
        const key = this.licenseUI.keyInput.value.trim();
        await this.licenseManager.setLicenseKey(key);
        this.showStatus('License key saved. Verifying...', 'info');
        await this.licenseManager.verifyLicense(true);
        this.updateLicenseUI();
        this.hideStatus();
      });
    }
    if (this.licenseUI.verifyBtn) {
      this.licenseUI.verifyBtn.addEventListener('click', async () => {
        this.showStatus('Verifying license...', 'info');
        await this.licenseManager.verifyLicense(true);
        this.updateLicenseUI();
        this.hideStatus();
      });
    }

    if (this.licenseUI.usageToggle && this.licenseUI.usagePanel) {
      this.licenseUI.usageToggle.addEventListener('click', () => {
        const visible = this.licenseUI.usagePanel.style.display !== 'none';
        if (visible) {
          this.licenseUI.usagePanel.style.display = 'none';
          this.licenseUI.usageToggle.textContent = 'Usage Details ▾';
        } else {
          this.licenseUI.usagePanel.style.display = 'block';
          this.licenseUI.usageToggle.textContent = 'Usage Details ▴';
        }
      });
    }
  }

  updateLicenseUI() {
    if (!this.licenseManager || !this.licenseUI) return;
    const status = this.licenseManager.getDisplayStatus();
    if (this.licenseUI.plan) this.licenseUI.plan.textContent = status.plan;
    if (this.licenseUI.extract) this.licenseUI.extract.textContent = status.extract;
    if (this.licenseUI.exportAll) this.licenseUI.exportAll.textContent = status.exportAll;
    if (this.licenseUI.exportSingle) this.licenseUI.exportSingle.textContent = status.exportSingle;
    if (this.licenseUI.workspaces) this.licenseUI.workspaces.textContent = status.workspaces;
    if (this.licenseUI.keyInput && this.licenseManager.state.licenseKey) {
      this.licenseUI.keyInput.value = this.licenseManager.state.licenseKey;
    }
    // Visual premium indicator
    if (this.licenseManager.isPremium()) {
      document.body.classList.add('premium');
      const badge = document.getElementById('premiumBadge');
      if (badge) badge.style.display = 'block';
    } else {
      document.body.classList.remove('premium');
      const badge = document.getElementById('premiumBadge');
      if (badge) badge.style.display = 'none';
    }

    // Defensive refresh: if any still show placeholder, schedule a retry after async verify
    if (status.plan === 'Free' && (status.extract === '0/15' || status.extract.includes('15'))) {
      // looks consistent; no action
    }
  }

  guardExtraction() {
    if (!this.licenseManager) return true; // not initialized yet
    if (this.licenseManager.canExtractTables()) return true;
    this.showUpgradeModal();
    return false;
  }

  guardExportAllXLSX() {
    if (!this.licenseManager) return true;
    if (this.licenseManager.canExportAllXLSX()) return true;
    this.showUpgradeModal();
    return false;
  }

  guardExportSingleXLSX() {
    if (!this.licenseManager) return true;
    if (this.licenseManager.canExportSingleXLSX()) return true;
    this.showUpgradeModal();
    return false;
  }

  showUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    if (!modal) {
      this.showStatus('Upgrade at https://alejandroechev.gumroad.com/l/tablelens', 'error');
      return;
    }
    modal.style.display = 'flex';
    const close = document.getElementById('upgradeClose');
    if (close) close.onclick = () => { modal.style.display = 'none'; };
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display='none'; }, { once:true });
  }

  async recordExtractionUsage(foundTables) {
    if (!this.licenseManager) return;
    await this.licenseManager.recordExtraction(foundTables);
    this.updateLicenseUI();
  }

  /**
   * Extract a clean site name from URL for filename
   */
  getSiteName(url) {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname;
      
      // Remove common prefixes
      hostname = hostname.replace(/^www\./, '');
      
      // Take only the domain name (before first dot if multiple parts)
      const parts = hostname.split('.');
      if (parts.length > 2) {
        return parts[0];
      }
      
      // Return domain without extension
      return parts[0] || 'webpage';
    } catch (error) {
      return 'webpage';
    }
  }
  
  // Clear all stored tables for the current page
  /**
   * Load and display saved states
   */
  loadSavedStates() {
    try {
      const savedStates = JSON.parse(localStorage.getItem('tableLensSavedStates') || '[]');
      this.renderSavedStates(savedStates);
    } catch (error) {
      console.error('Error loading saved states:', error);
      this.renderSavedStates([]);
    }
  }

  /** Listen for refresh requests from viewer */
  initializeSavedStateListener() {
    try {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.action === 'refreshSavedStates') {
          this.loadSavedStates();
        }
      });
    } catch(_) {}
  }

  /**
   * Render saved states list
   */
  renderSavedStates(savedStates) {
    if (!this.elements.savedStatesList) return;

    if (savedStates.length === 0) {
      this.elements.savedStatesList.innerHTML = `
        <div class="no-saved-states">
          <p>No saved table workspaces yet</p>
          <p class="hint">Open a table in the viewer and click "💾 Save Workspace" to save table and charts</p>
        </div>`;
      return;
    }

    // Sort by timestamp (newest first)
    const sortedStates = [...savedStates].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    this.elements.savedStatesList.innerHTML = sortedStates.map(state => {
      const date = new Date(state.timestamp);
      const timeString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      return `
        <div class="saved-state-item" data-state-id="${state.id}">
          <div class="saved-state-header">
            <div class="saved-state-name">${this.escapeHtml(state.name)}</div>
            <div class="saved-state-timestamp">${timeString}</div>
          </div>
          <div class="saved-state-actions">
            <button class="saved-state-btn saved-state-load" data-action="load" data-state-id="${state.id}">Load</button>
            <button class="saved-state-btn saved-state-delete" data-action="delete" data-state-id="${state.id}">Delete</button>
          </div>
        </div>`;
    }).join('');

    // Attach event listeners for saved state actions
    this.attachSavedStateListeners();

    // Opportunistic refresh of license UI (helps first render race conditions)
    if (this.licenseManager && this.updateLicenseUI) {
      this.updateLicenseUI();
    }
  }

  /**
   * Attach event listeners for saved state actions
   */
  attachSavedStateListeners() {
    if (!this.elements.savedStatesList) return;

    this.elements.savedStatesList.addEventListener('click', async (e) => {
      const action = e.target.getAttribute('data-action');
      const stateId = e.target.getAttribute('data-state-id');

      if (!action || !stateId) return;

      if (action === 'load') {
        await this.loadSavedState(stateId);
      } else if (action === 'delete') {
        this.deleteSavedState(stateId);
      }
    });
  }

  /**
   * Load a saved state
   */
  async loadSavedState(stateId) {
    try {
      const savedStates = JSON.parse(localStorage.getItem('tableLensSavedStates') || '[]');
      const state = savedStates.find(s => s.id === stateId);
      
      if (!state) {
        this.showStatus('Saved state not found', 'error');
        return;
      }
      // Use a robust transfer token via localStorage to avoid timing races with postMessage
      const transferKey = `tableLens_transfer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const payload = {
        name: state.name,
        timestamp: state.timestamp,
        savedState: state.state
      };
      try {
        localStorage.setItem(transferKey, JSON.stringify(payload));
      } catch (e) {
        this.showStatus('Storage error saving workspace', 'error');
        console.error('Transfer storage error:', e);
        return;
      }

      const tableViewerURL = `${chrome.runtime.getURL('table-viewer.html')}?transfer=${encodeURIComponent(transferKey)}`;
      const newWindow = window.open(tableViewerURL, '_blank');
      if (!newWindow) {
        this.showStatus('Popup blocked opening viewer', 'error');
        return;
      }

      this.showStatus(`✅ Loading workspace "${state.name}"`, 'success');
      setTimeout(() => this.hideStatus(), 2000);
      setTimeout(() => window.close(), 800);
    } catch (error) {
      console.error('Error loading saved state:', error);
      this.showStatus('Error loading saved state', 'error');
      setTimeout(() => this.hideStatus(), 3000);
    }
  }

  /**
   * Delete a saved state
   */
  deleteSavedState(stateId) {
    try {
      const savedStates = JSON.parse(localStorage.getItem('tableLensSavedStates') || '[]');
      const stateIndex = savedStates.findIndex(s => s.id === stateId);
      
      if (stateIndex === -1) {
        this.showStatus('Saved state not found', 'error');
        return;
      }

      const stateName = savedStates[stateIndex].name;
      savedStates.splice(stateIndex, 1);
      
      localStorage.setItem('tableLensSavedStates', JSON.stringify(savedStates));

      // Decrement license workspace count (only if free tier had one)
      if (this.licenseManager && !this.licenseManager.isPremium()) {
        this.licenseManager.decrementWorkspaceCount();
        this.updateLicenseUI?.();
      }
      
      // Re-render the list
      this.renderSavedStates(savedStates);
      
      this.showStatus(`🗑️ Deleted state "${stateName}"`, 'success');
      setTimeout(() => this.hideStatus(), 2000);
    } catch (error) {
      console.error('Error deleting saved state:', error);
      this.showStatus('Error deleting saved state', 'error');
      setTimeout(() => this.hideStatus(), 3000);
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Theme management methods
  initializeTheme() {
    const savedTheme = localStorage.getItem('tableLensTheme') || 'light';
    this.setTheme(savedTheme);
  }
  
  toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }
  
  setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('tableLensTheme', theme);
    
    // Update theme toggle icon
    if (this.elements.themeToggle) {
      const icon = this.elements.themeToggle.querySelector('.theme-icon');
      if (icon) {
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
      }
    }
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