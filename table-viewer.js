class TableViewer {
  constructor() {
    this.tableData = null;
    this.tableInfo = null;
    this.filteredData = null;
    this.originalData = null; // Store original order
    this.currentSort = { column: -1, direction: 'none' };
    this.columnTypes = []; // 'categorical' or 'numeric'
    this.columnStats = []; // Selected stat function per column
    this.charts = new Map(); // chartId -> chart instance
    this.chartCounter = 0;
    this.numericFormatMap = {}; // columnIndex -> { thousand: ',', decimal: '.' }
    this.stateManager = null; // Will be initialized when table data is loaded
    this.savedFilters = {}; // Persisted filters per column
    
    // Define chart type requirements
    this.chartTypeDefinitions = {
      'line': {
        name: '📈 Line Chart',
        description: 'Shows trends over time or categories',
        xAxis: { 
          required: true, 
          types: ['categorical', 'date', 'numeric'], 
          label: 'Categories/Time',
          hint: 'Choose dates, categories, or sequential data'
        },
        yAxis: { 
          required: true, 
          types: ['numeric', 'money', 'percentage'], 
          multiple: true,
          label: 'Values to Plot',
          hint: 'Select one or more numeric columns'
        }
      },
      'bar': {
        name: '📊 Bar Chart',
        description: 'Compares values across categories',
        xAxis: { 
          required: true, 
          types: ['categorical', 'date'], 
          label: 'Categories',
          hint: 'Choose categories or dates'
        },
        yAxis: { 
          required: true, 
          types: ['numeric', 'money', 'percentage'], 
          multiple: true,
          label: 'Values to Compare',
          hint: 'Select numeric values to compare'
        }
      },
      'horizontalBar': {
        name: '📊 Horizontal Bar Chart',
        description: 'Bar chart with horizontal orientation',
        xAxis: { 
          required: true, 
          types: ['categorical'], 
          label: 'Categories',
          hint: 'Choose category labels'
        },
        yAxis: { 
          required: true, 
          types: ['numeric', 'money', 'percentage'], 
          multiple: true,
          label: 'Values',
          hint: 'Select numeric values'
        }
      },
      'pie': {
        name: '🥧 Pie Chart',
        description: 'Shows proportions of a whole',
        xAxis: { 
          required: true, 
          types: ['categorical'], 
          label: 'Categories',
          hint: 'Choose category labels for pie slices'
        },
        yAxis: { 
          required: true, 
          types: ['numeric', 'money', 'percentage'], 
          multiple: false,
          label: 'Values',
          hint: 'Select ONE numeric column for slice sizes'
        }
      },
      'doughnut': {
        name: '🍩 Doughnut Chart',
        description: 'Pie chart with center hollow',
        xAxis: { 
          required: true, 
          types: ['categorical'], 
          label: 'Categories',
          hint: 'Choose category labels for segments'
        },
        yAxis: { 
          required: true, 
          types: ['numeric', 'money', 'percentage'], 
          multiple: false,
          label: 'Values',
          hint: 'Select ONE numeric column for segment sizes'
        }
      },
      'scatter': {
        name: '🔵 Scatter Plot',
        description: 'Shows correlation between two variables',
        xAxis: { 
          required: true, 
          types: ['numeric', 'money', 'percentage', 'date'], 
          label: 'X Variable',
          hint: 'Choose numeric or date data for X-axis'
        },
        yAxis: { 
          required: true, 
          types: ['numeric', 'money', 'percentage'], 
          multiple: false,
          label: 'Y Variable',
          hint: 'Select ONE numeric column for Y-axis'
        }
      }
    };
    
    this.initializeElements();
    this.attachEventListeners();
    this.loadTableData();
  }
  
  initializeElements() {
    this.elements = {
      headerTitle: document.getElementById('headerTitle'),
      tableInfo: document.getElementById('tableInfo'),
      themeToggle: document.getElementById('themeToggle'),
      tabBar: document.getElementById('tabBar'),
      dataTable: document.getElementById('dataTable'),
      dataTableHead: document.getElementById('dataTableHead'),
      dataTableBody: document.getElementById('dataTableBody'),
      dataToolbar: document.querySelector('.data-toolbar'),
      newChartBtn: document.getElementById('newChartBtn'),
      // Data controls
      filterColumn: document.getElementById('filterColumn'),
      filterValue: document.getElementById('filterValue'),
      resetFiltersAndSort: document.getElementById('resetFiltersAndSort'),
      exportData: document.getElementById('exportData'),
      saveState: document.getElementById('saveStateBtn')
    };
    
    // Initialize theme
    this.initializeTheme();
  }
  
  attachEventListeners() {
    this.elements.newChartBtn.addEventListener('click', () => this.createNewChart());
    this.elements.themeToggle?.addEventListener('click', () => this.toggleTheme());
    
    // Export button (static HTML, only attach once)
    if (this.elements.exportData) {
      this.elements.exportData.addEventListener('click', () => this.showExportFormatModal());
    }
    
  // Save button
    if (this.elements.saveState) {
      this.elements.saveState.addEventListener('click', () => this.showSaveStateDialog());
    }
    
    // Note: Filter event listeners are attached in attachFilterEventListeners()
    // which is called from setupDataControls()
    
    // Handle tab clicks with event delegation
    this.elements.tabBar.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab')) {
        const tabId = e.target.getAttribute('data-tab');
        this.switchTab(tabId);
      } else if (e.target.classList.contains('close-btn')) {
        const tab = e.target.closest('.tab');
        const tabId = tab.getAttribute('data-tab');
        this.closeTab(tabId);
        e.stopPropagation();
      }
    });
    
    // Listen for messages from parent window
    window.addEventListener('message', (event) => {
      if (event.data.type === 'TABLE_DATA') {
        console.log('Received table data:', event.data);
        this.handleTableData(event.data);
      } else if (event.data.type === 'RESTORE_SAVED_STATE') {
        console.log('Received saved state to restore:', event.data);
        this.restoreFromSavedState(event.data.savedState);
      }
    });
  }
  
  loadTableData() {
    const headerEl = document.getElementById('headerTitle');
    if (headerEl) headerEl.textContent = '⏳ Loading workspace...';

    const urlParams = new URLSearchParams(window.location.search);
    const transferKey = urlParams.get('transfer');

    if (transferKey) {
      // Attempt to read transfer payload
      try {
        const raw = localStorage.getItem(transferKey);
        if (!raw) {
          headerEl && (headerEl.textContent = '❌ Workspace not found');
          return;
        }
        const payload = JSON.parse(raw);
        // Clean up transfer key to avoid buildup
        localStorage.removeItem(transferKey);
        if (!payload || !payload.savedState || !payload.savedState.tableData) {
          headerEl && (headerEl.textContent = '❌ Invalid workspace payload');
          return;
        }
        // Construct minimal data object for existing handler
        this.handleTableData({
          tableData: payload.savedState.tableData,
          tableInfo: {
            type: 'saved-state',
            source: payload.name,
            timestamp: payload.timestamp
          }
        });
        // After base data render, restore full state
        setTimeout(() => this.restoreFromSavedState(payload.savedState), 150);
        // Store the workspace name and update title
        this.currentWorkspaceName = payload.name;
        headerEl && (headerEl.textContent = `💾 ${payload.name}`);
        return; // Done
      } catch (e) {
        console.error('Failed to load transfer workspace:', e);
        headerEl && (headerEl.textContent = '❌ Failed to load workspace');
        return;
      }
    }

    // Fallback legacy behavior (opener flow)
    if (window.opener) {
      console.log('Legacy: requesting table data from parent');
      window.opener.postMessage({ type: 'REQUEST_TABLE_DATA' }, '*');
      setTimeout(() => {
        if (!this.tableData) {
          headerEl && (headerEl.textContent = '❌ No data received');
        }
      }, 8000);
    } else {
      headerEl && (headerEl.textContent = '❌ No workspace key provided');
    }
  }
  
  handleTableData(data) {
    // Clean empty rows and columns before processing
    const cleanedData = this.cleanTableData(data.tableData);
    
    this.tableData = cleanedData;
    this.tableInfo = data.tableInfo;
    this.originalData = [...this.tableData]; // Store original order
    this.filteredData = [...this.tableData];
    
    // Initialize state manager with table ID (but don't auto-restore)
    const tableId = this.generateTableId();
    this.stateManager = new TableStateManager(tableId);
    
    // Always analyze column types normally (no automatic restoration)
    this.analyzeColumnTypes();
    this.initializeColumnStats();
    
    this.updateHeader();
    this.renderDataTable();
    this.setupDataControls();
    
    // No automatic state restoration - only when explicitly loading saved workspace
  }

  /**
   * Remove empty rows and columns from table data
   * @param {Array} tableData - 2D array representing table
   * @returns {Array} Cleaned table data
   */
  cleanTableData(tableData) {
    if (!tableData || tableData.length === 0) return tableData;
    
    // Ensure all rows have the same length (fill missing columns with empty strings)
    const maxCols = Math.max(...tableData.map(row => row.length));
    const normalizedData = tableData.map(row => {
      const normalizedRow = [...row];
      while (normalizedRow.length < maxCols) {
        normalizedRow.push('');
      }
      return normalizedRow;
    });
    
    // Be more conservative about what constitutes "empty"
    // A column is only empty if ALL non-header rows are empty
    const columnHasData = new Array(maxCols).fill(false);
    
    // Check all rows except the header to see which columns contain data
    for (let rowIndex = 1; rowIndex < normalizedData.length; rowIndex++) {
      const row = normalizedData[rowIndex];
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const cell = row[colIndex];
        // Consider a cell non-empty if it contains any non-whitespace text
        if (cell != null && String(cell).trim() !== '') {
          columnHasData[colIndex] = true;
        }
      }
    }
    
    // Also check the header row, but be more lenient 
    // (allow sparse headers due to colspan scenarios)
    const headerRow = normalizedData[0];
    for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
      const cell = headerRow[colIndex];
      if (cell != null && String(cell).trim() !== '') {
        columnHasData[colIndex] = true;
      }
    }
    
    // If fewer than half the columns have data, it might be a parsing issue
    // In this case, be very conservative and only remove columns that are completely empty
    const dataColumnCount = columnHasData.filter(Boolean).length;
    const isLikelyComplexTable = dataColumnCount < maxCols * 0.5;
    
    if (isLikelyComplexTable && maxCols > 3) {
      console.log(`⚠️ Detected complex table structure (${dataColumnCount}/${maxCols} columns have data). Using conservative cleanup.`);
      
      // For complex tables, only remove columns that are empty in ALL rows (including header)
      for (let colIndex = 0; colIndex < maxCols; colIndex++) {
        let hasAnyData = false;
        for (let rowIndex = 0; rowIndex < normalizedData.length; rowIndex++) {
          const cell = normalizedData[rowIndex][colIndex];
          if (cell != null && String(cell).trim() !== '') {
            hasAnyData = true;
            break;
          }
        }
        columnHasData[colIndex] = hasAnyData;
      }
    }
    
    // Get indices of columns that have data
    const validColumns = columnHasData.map((hasData, index) => hasData ? index : -1)
                                      .filter(index => index !== -1);
    
    // If all columns are empty, return original data to avoid breaking everything
    if (validColumns.length === 0) {
      console.warn('⚠️ All columns appear empty, keeping original table structure');
      return normalizedData;
    }
    
    // Filter out empty columns and empty rows
    const cleanedRows = [];
    
    for (let rowIndex = 0; rowIndex < normalizedData.length; rowIndex++) {
      const originalRow = normalizedData[rowIndex];
      
      // Create new row with only non-empty columns
      const filteredRow = validColumns.map(colIndex => originalRow[colIndex]);
      
      // Check if this row has any non-empty data
      const rowHasData = filteredRow.some(cell => 
        cell != null && String(cell).trim() !== ''
      );
      
      // Keep the header row (index 0) even if empty, and any row with data
      // But be more lenient about what constitutes an \"empty\" row
      if (rowIndex === 0 || rowHasData) {
        cleanedRows.push(filteredRow);
      }
    }
    
    // Log cleanup results
    const removedColumns = maxCols - validColumns.length;
    const removedRows = normalizedData.length - cleanedRows.length;
    
    if (removedColumns > 0 || removedRows > 0) {
      console.log(`🧹 Table cleanup: removed ${removedRows} empty rows and ${removedColumns} empty columns (${normalizedData.length}x${maxCols} → ${cleanedRows.length}x${validColumns.length})`);
    }
    
    return cleanedRows.length > 0 ? cleanedRows : normalizedData;
  }
  
  updateHeader() {
    if (this.tableInfo) {
      this.elements.headerTitle.textContent = `📊 ${this.getTableTypeDisplay(this.tableInfo.type)}`;
      this.elements.tableInfo.textContent = `${this.tableData.length - 1} rows, ${this.tableData[0].length} columns`;
    }
  }
  
  getTableTypeDisplay(type) {
    const typeMap = {
      'html': 'HTML Table',
      'csv': 'CSV Data',
      'csv-selection': 'CSV Selection',
      'markdown': 'Markdown Table',
      'markdown-selection': 'Markdown Selection',
      'ocr': 'Screen Captured',
      'pdf': 'PDF Extracted',
      'image': 'Image Extracted',
      'pdf-batch': 'PDF Table'
    };
    return typeMap[type] || 'Table';
  }

  analyzeColumnTypes() {
    if (!this.tableData || this.tableData.length < 2) return;
    
    // Use the shared column type detection utility
    this.columnTypes = ColumnTypeUtils.analyzeColumnTypes(this.tableData);
    
    // Generate number format inference for numeric columns
    const headers = this.tableData[0];
    const rows = this.tableData.slice(1);
    
    this.columnTypes.forEach((type, colIndex) => {
      if (['numeric','money','percentage'].includes(type)) {
        // Collect samples for format inference
        const numericSamples = [];
        for (let i = 0; i < Math.min(rows.length, 30); i++) {
          const raw = rows[i][colIndex];
          const value = String(raw == null ? '' : raw).trim();
          if (value !== '' && /[\d]/.test(value)) {
            numericSamples.push(value);
          }
        }
        
        const fmt = ColumnTypeUtils.inferNumberFormat(numericSamples);
        this.numericFormatMap[colIndex] = fmt || { thousand: ',', decimal: '.' };
      }
    });
  }

  
  initializeColumnStats() {
    this.columnStats = this.columnTypes.map(type => {
      switch (type) {
        case 'money':
        case 'numeric':
          return 'count';
        case 'percentage':
          return 'avg';
        case 'date':
          return 'count';
        default:
          return 'count';
      }
    });
  }
  
  getColumnTypeInfo(type) {
    const typeMap = {
      'categorical': { icon: '📝', label: '', description: 'Categorical data (text, categories)' },
      'numeric': { icon: '🔢', label: '', description: 'Numeric data (numbers, quantities)' },
      'money': { icon: '💰', label: '', description: 'Monetary values (currency, prices)' },
      'percentage': { icon: '📊', label: '', description: 'Percentage values (rates, ratios)' },
      'date': { icon: '📅', label: '', description: 'Date and time values' }
    };
    return typeMap[type] || typeMap['categorical'];
  }
  
  getStatsSelectHTML(columnType, index) {
    const baseOptions = '<option value="count">Count</option><option value="unique">Unique</option><option value="mode">Mode</option>';
    const numericOptions = '<option value="sum">Sum</option><option value="avg">Average</option><option value="min">Min</option><option value="max">Max</option><option value="std">Std Dev</option>';
    const dateOptions = '<option value="earliest">Earliest</option><option value="latest">Latest</option><option value="range">Range</option>';
    
    let options = baseOptions;
    
    if (columnType === 'numeric' || columnType === 'money') {
      options = baseOptions + numericOptions;
    } else if (columnType === 'percentage') {
      options = baseOptions + numericOptions;
    } else if (columnType === 'date') {
      options = baseOptions + dateOptions;
    }
    
    return `
      <select class="stat-select" data-column="${index}">
        ${options}
      </select>
      <div id="stat-result-${index}"></div>
    `;
  }
  
  showColumnTypeEditor(columnIndex, columnName, currentType) {
    const types = [
      { value: 'categorical', label: 'Categorical 📝', desc: 'Text, categories, labels' },
      { value: 'numeric', label: 'Numeric 🔢', desc: 'Numbers, quantities, measurements' },
      { value: 'money', label: 'Money 💰', desc: 'Currency, prices, financial values' },
      { value: 'percentage', label: 'Percentage 📊', desc: 'Rates, ratios, percentages' },
      { value: 'date', label: 'Date 📅', desc: 'Dates, times, timestamps' }
    ];
    
    const modal = document.createElement('div');
    modal.className = 'type-editor-modal';
    const currentFormat = this.numericFormatMap[columnIndex] || { thousand: ',', decimal: '.' };
    modal.innerHTML = `
      <div class="type-editor-content" role="dialog" aria-modal="true">
        <h3>Column Type for "${columnName}"</h3>
        <div class="type-options">
          ${types.map(type => `
            <label class="type-option ${type.value === currentType ? 'selected' : ''}" data-type="${type.value}">
              <input type="radio" name="columnType" value="${type.value}" ${type.value === currentType ? 'checked' : ''}>
              <div class="type-info">
                <div class="type-label">${type.label}</div>
                <div class="type-desc">${type.desc}</div>
              </div>
            </label>
          `).join('')}
        </div>
        <div class="numeric-format" id="numeric-format-section" style="display:none; margin-top:12px;">
          <h4 style="margin:4px 0 8px; font-size:14px;">Number Format</h4>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <label style="font-size:12px; display:flex; flex-direction:column; gap:4px;">
              Thousands
              <select id="thousand-separator" class="form-control" style="padding:4px 6px; font-size:12px;">
                <option value="," ${currentFormat.thousand===","? 'selected':''}>, (comma)</option>
                <option value="." ${currentFormat.thousand==="."? 'selected':''}>. (dot)</option>
                <option value=" " ${currentFormat.thousand===" "? 'selected':''}>(space)</option>
                <option value="" ${currentFormat.thousand===""? 'selected':''}>None</option>
              </select>
            </label>
            <label style="font-size:12px; display:flex; flex-direction:column; gap:4px;">
              Decimal
              <select id="decimal-separator" class="form-control" style="padding:4px 6px; font-size:12px;">
                <option value="." ${currentFormat.decimal==='.'? 'selected':''}>. (dot)</option>
                <option value="," ${currentFormat.decimal===','? 'selected':''}>, (comma)</option>
              </select>
            </label>
            <div style="flex:1; font-size:11px; line-height:1.4; color:var(--text-tertiary);">
              Example: 1${currentFormat.thousand===' ' ? ' ' : currentFormat.thousand}234${currentFormat.decimal}56
            </div>
          </div>
        </div>
        <div class="type-editor-actions">
          <button class="btn btn-secondary" data-action="cancel">Cancel</button>
          <button class="btn btn-primary" data-action="apply">Apply</button>
        </div>
      </div>`;
    
    document.body.appendChild(modal);
    
    // Add click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Highlight selection when clicking label area
    modal.querySelectorAll('.type-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        modal.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        const input = opt.querySelector('input');
        if (input) input.checked = true;
      });
    });

    // Show/hide number format section based on selected type
    const updateFormatVisibility = () => {
      const selected = modal.querySelector('input[name="columnType"]:checked')?.value;
      const section = modal.querySelector('#numeric-format-section');
      if (section) {
        section.style.display = (selected === 'numeric' || selected === 'money' || selected === 'percentage') ? 'block' : 'none';
      }
    };
    modal.querySelectorAll('input[name="columnType"]').forEach(r => r.addEventListener('change', updateFormatVisibility));
    updateFormatVisibility();

    // Button handlers
    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    const applyBtn = modal.querySelector('[data-action="apply"]');
    cancelBtn.addEventListener('click', () => modal.remove());
    applyBtn.addEventListener('click', () => this.applyColumnTypeChange(columnIndex, modal));
  }
  
  applyColumnTypeChange(columnIndex, modal) {
    const selectedType = modal.querySelector('input[name="columnType"]:checked')?.value;
    if (selectedType) {
      const typeChanged = selectedType !== this.columnTypes[columnIndex];
      if (typeChanged) {
        this.columnTypes[columnIndex] = selectedType;
        // Reset column stats to appropriate default
        switch (selectedType) {
          case 'money':
          case 'numeric':
            this.columnStats[columnIndex] = 'sum';
            break;
          case 'percentage':
            this.columnStats[columnIndex] = 'avg';
            break;
          case 'date':
            this.columnStats[columnIndex] = 'count';
            break;
          default:
            this.columnStats[columnIndex] = 'count';
        }
      }
      if (['numeric','money','percentage'].includes(selectedType)) {
        const thousand = modal.querySelector('#thousand-separator')?.value ?? ',';
        const decimal = modal.querySelector('#decimal-separator')?.value ?? '.';
        let safeDecimal = decimal;
        let safeThousand = thousand;
        if (safeDecimal === safeThousand && safeDecimal !== '') {
          safeThousand = safeDecimal === '.' ? ',' : '.';
        }
        console.log(`⚙️ User override applied for column ${columnIndex}:`, { thousand: safeThousand, decimal: safeDecimal });
        this.numericFormatMap[columnIndex] = { thousand: safeThousand, decimal: safeDecimal };
      }
      this.renderDataTable();
    }
    modal.remove();
  }
  
  renderDataTable() {
    if (!this.filteredData || this.filteredData.length === 0) return;
    
    const headers = this.filteredData[0];
    const rows = this.filteredData.slice(1);
    
    // Create table headers with sorting capability and type indicators
    this.elements.dataTableHead.innerHTML = '';
    const headerRow = document.createElement('tr');
    headers.forEach((header, index) => {
      const th = document.createElement('th');
      const columnType = this.columnTypes[index] || 'categorical';
      
      // Get appropriate icon and label for column type
      const typeInfo = this.getColumnTypeInfo(columnType);
      
      // Determine current sort arrow if applicable
      let sortArrow = '';
      if (this.currentSort.column === index) {
        if (this.currentSort.direction === 'asc') sortArrow = ' ▲';
        else if (this.currentSort.direction === 'desc') sortArrow = ' ▼';
      }
      th.innerHTML = `
        <div class="column-header">
          <span class="column-name" title="Click to sort">${header}${sortArrow}</span>
          <div class="column-type-container">
            <span class="category-indicator category-${columnType} type-edit-trigger" data-column="${index}" title="${typeInfo.description} (click to change type)">${typeInfo.icon}</span>
          </div>
        </div>`;
      th.className = `sortable ${columnType}`;
      th.setAttribute('data-column', index);
      th.title = `${typeInfo.description} - Click to sort`;
      
      // Add current sort indicator
      if (this.currentSort.column === index) {
        th.classList.add(`sort-${this.currentSort.direction}`);
      }
      
      // Add click listener for sorting (header text)
      th.querySelector('.column-name').addEventListener('click', () => this.sortTable(index));
      // Add click listener for type editing on emoji
      th.querySelector('.type-edit-trigger').addEventListener('click', (e) => {
        e.stopPropagation();
        this.showColumnTypeEditor(index, header, columnType);
      });
      
      headerRow.appendChild(th);
    });
    this.elements.dataTableHead.appendChild(headerRow);
    
    // Create stats row
    const statsRow = document.createElement('tr');
    statsRow.className = 'stats-row';
    headers.forEach((header, index) => {
      const td = document.createElement('td');
      const columnType = this.columnTypes[index] || 'categorical';
      
      td.innerHTML = this.getStatsSelectHTML(columnType, index);
      const select = td.querySelector('.stat-select');
      select.value = this.columnStats[index] || 'count';
      select.addEventListener('change', (e) => this.updateColumnStat(index, e.target.value));
      
      statsRow.appendChild(td);
    });
    this.elements.dataTableHead.appendChild(statsRow);
    
    // Create table body
    this.elements.dataTableBody.innerHTML = '';
    rows.forEach(row => {
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell || '';
        tr.appendChild(td);
      });
      this.elements.dataTableBody.appendChild(tr);
    });
    
    // Calculate and display initial stats
    this.calculateAllStats();
    
    // Add filter buttons to headers after table is rendered
    setTimeout(() => {
      this.addHeaderFilterButtons();
      this.updateAllFilterButtonStates();
    }, 100);
    // Note: Manual save required to persist structural changes
  }
  
  setupDataControls() {
    // The toolbar is now static in HTML, just attach event listeners
    this.attachFilterEventListeners();
  }

  /**
   * Add filter buttons to table headers
   */
  addHeaderFilterButtons() {
    if (!this.filteredData || this.filteredData.length < 2) {
      return;
    }
    
    const tableHeaders = this.elements.dataTable.querySelectorAll('th');
    const headers = this.filteredData[0];
    
    tableHeaders.forEach((th, index) => {
      if (index < headers.length) {
        // Remove existing filter button if any
        const existingBtn = th.querySelector('.filter-btn');
        if (existingBtn) {
          existingBtn.remove();
        }
        
        const columnType = this.columnTypes[index] || 'categorical';
        const typeInfo = this.getColumnTypeInfo(columnType);
        
        const filterBtn = document.createElement('button');
        filterBtn.className = 'filter-btn';
        filterBtn.innerHTML = '▼';
        filterBtn.title = `Filter ${headers[index]} (${typeInfo.description})`;
        filterBtn.setAttribute('data-column', index);
        
        // Position button at the end of header text
        th.style.position = 'relative';
        th.appendChild(filterBtn);
        
        // Add click handler
        filterBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showFilterPopup(index, filterBtn, headers[index], columnType);
        });
      }
    });
  }

  /**
   * Show filter popup for a specific column
   */
  showFilterPopup(columnIndex, triggerButton, header, columnType) {
    // Close any existing popup
    this.closeFilterPopup();
    
    const popup = document.createElement('div');
    popup.className = 'filter-popup';
    popup.setAttribute('data-column', columnIndex);
    
    const typeInfo = this.getColumnTypeInfo(columnType);
    const filterContent = this.createColumnFilter(header, columnIndex, columnType);
    
    popup.innerHTML = `
      <div class="filter-popup-header">
        <span>${typeInfo.icon} ${header}</span>
        <button class="filter-popup-close">×</button>
      </div>
      <div class="filter-popup-content">
        ${filterContent.innerHTML}
      </div>
    `;
    
    document.body.appendChild(popup);
    
    // Position popup relative to button
    this.positionFilterPopup(popup, triggerButton);
    
    // Add event listeners
    popup.querySelector('.filter-popup-close').addEventListener('click', () => this.closeFilterPopup());
    
    // Re-attach filter event listeners for the popup content
    this.attachPopupFilterListeners(popup, columnIndex);
    // Rehydrate existing saved filter if present
    const existing = this.savedFilters[columnIndex];
    if (existing) {
      try {
        if (existing.type === 'numeric') {
          if (existing.min != null) popup.querySelector('.filter-min').value = existing.min;
          if (existing.max != null) popup.querySelector('.filter-max').value = existing.max;
        } else if (existing.type === 'date') {
          if (existing.from) popup.querySelector('.filter-date-from').value = existing.from;
          if (existing.to) popup.querySelector('.filter-date-to').value = existing.to;
        } else if (existing.type === 'categorical') {
          const sel = popup.querySelector('.filter-select');
          if (sel && existing.selected) {
            Array.from(sel.options).forEach(o => { o.selected = existing.selected.includes(o.value); });
          }
          if (existing.text && popup.querySelector('.filter-text')) popup.querySelector('.filter-text').value = existing.text;
        }
      } catch (e) { console.debug('Filter restore failed', e); }
    }
    
    // Store reference for closing
    this.activeFilterPopup = popup;
    
    // Mark button as active
    triggerButton.classList.add('active');
  }

  /**
   * Position filter popup relative to trigger button
   */
  positionFilterPopup(popup, triggerButton) {
    const rect = triggerButton.getBoundingClientRect();
    const popupHeight = 300; // Estimated height
    const popupWidth = 280;
    
    let top = rect.bottom + 5;
    let left = rect.left;
    
    // Check if popup would go below viewport
    if (top + popupHeight > window.innerHeight) {
      top = rect.top - popupHeight - 5;
    }
    
    // Check if popup would go beyond right edge
    if (left + popupWidth > window.innerWidth) {
      left = window.innerWidth - popupWidth - 10;
    }
    
    // Ensure popup doesn't go beyond left edge
    if (left < 10) {
      left = 10;
    }
    
    popup.style.position = 'fixed';
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
    popup.style.zIndex = '1000';
  }

  /**
   * Close active filter popup
   */
  closeFilterPopup() {
    if (this.activeFilterPopup) {
      // Remove active state from button
      const columnIndex = this.activeFilterPopup.getAttribute('data-column');
      const filterBtn = document.querySelector(`.filter-btn[data-column="${columnIndex}"]`);
      if (filterBtn) filterBtn.classList.remove('active');
      
      this.activeFilterPopup.remove();
      this.activeFilterPopup = null;
      // Note: Manual save required to persist filter changes
    }
  }

  /**
   * Attach event listeners to popup filter controls
   */
  attachPopupFilterListeners(popup, columnIndex) {
    // Numeric filters
    popup.querySelectorAll('.filter-min, .filter-max').forEach(input => {
      input.addEventListener('input', () => {
        this.captureFilterState(columnIndex, popup, 'numeric');
        this.applyColumnFilters();
        this.updateFilterButtonState(columnIndex);
      });
    });

    // Date filters
    popup.querySelectorAll('.filter-date-from, .filter-date-to').forEach(input => {
      input.addEventListener('change', () => {
        this.captureFilterState(columnIndex, popup, 'date');
        this.applyColumnFilters();
        this.updateFilterButtonState(columnIndex);
      });
    });

    // Categorical filters (select)
    popup.querySelectorAll('.filter-select').forEach(select => {
      select.addEventListener('change', () => {
        this.captureFilterState(columnIndex, popup, 'categorical');
        this.applyColumnFilters();
        this.updateFilterButtonState(columnIndex);
      });
    });

    // Categorical filters (text)
    popup.querySelectorAll('.filter-text').forEach(input => {
      input.addEventListener('input', () => {
        this.captureFilterState(columnIndex, popup, 'categorical');
        this.applyColumnFilters();
        this.updateFilterButtonState(columnIndex);
      });
    });

    // Clear filter button
    const clearBtn = popup.querySelector('.filter-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearColumnFilter(columnIndex);
        this.updateFilterButtonState(columnIndex);
        delete this.savedFilters[columnIndex];
        this.saveState?.();
      });
    }
  }
  captureFilterState(columnIndex, popup, type) {
    try {
      const f = { type };
      if (type === 'numeric') {
        const minEl = popup.querySelector('.filter-min');
        const maxEl = popup.querySelector('.filter-max');
        if (minEl?.value) f.min = minEl.value; if (maxEl?.value) f.max = maxEl.value;
        if (!f.min && !f.max) { delete this.savedFilters[columnIndex]; return; }
      } else if (type === 'date') {
        const fromEl = popup.querySelector('.filter-date-from');
        const toEl = popup.querySelector('.filter-date-to');
        if (fromEl?.value) f.from = fromEl.value; if (toEl?.value) f.to = toEl.value;
        if (!f.from && !f.to) { delete this.savedFilters[columnIndex]; return; }
      } else if (type === 'categorical') {
        const sel = popup.querySelector('.filter-select');
        const txt = popup.querySelector('.filter-text');
        if (sel) {
          const selected = Array.from(sel.selectedOptions).map(o=>o.value).filter(v=>v);
          if (selected.length) f.selected = selected;
        }
        if (txt?.value.trim()) f.text = txt.value.trim();
        if (!f.selected && !f.text) { delete this.savedFilters[columnIndex]; return; }
      }
      this.savedFilters[columnIndex] = f;
    } catch(e) { console.debug('captureFilterState error', e); }
  }

  /**
   * Update filter button visual state based on active filters
   */
  updateFilterButtonState(columnIndex) {
    const filterBtn = document.querySelector(`.filter-btn[data-column="${columnIndex}"]`);
    if (!filterBtn) return;
    
    const hasActiveFilter = this.hasActiveFilter(columnIndex);
    
    if (hasActiveFilter) {
      filterBtn.classList.add('filtered');
      filterBtn.innerHTML = '▼';
    } else {
      filterBtn.classList.remove('filtered');
      filterBtn.innerHTML = '▼';
    }
  }

  updateAllFilterButtonStates() {
    // Update all filter button states based on savedFilters
    Object.keys(this.savedFilters).forEach(columnIndex => {
      this.updateFilterButtonState(parseInt(columnIndex));
    });
  }

  /**
   * Check if a column has active filters
   */
  hasActiveFilter(columnIndex) {
    // Check savedFilters first (persistent state)
    const savedFilter = this.savedFilters[columnIndex];
    if (savedFilter) {
      if (savedFilter.type === 'numeric') {
        return savedFilter.min != null || savedFilter.max != null;
      } else if (savedFilter.type === 'date') {
        return savedFilter.from || savedFilter.to;
      } else if (savedFilter.type === 'categorical') {
        return (savedFilter.selected && savedFilter.selected.length > 0) || (savedFilter.text && savedFilter.text.trim());
      }
    }
    
    // Fallback to popup state if active
    const popup = this.activeFilterPopup;
    if (popup && popup.getAttribute('data-column') == columnIndex) {
      const inputs = popup.querySelectorAll('input, select');
      for (const input of inputs) {
        if (input.type === 'text' || input.type === 'number' || input.type === 'date') {
          if (input.value.trim()) return true;
        } else if (input.type === 'select-multiple' && input.selectedOptions.length > 0) {
          const hasNonEmptySelection = Array.from(input.selectedOptions)
            .some(option => option.value !== '');
          if (hasNonEmptySelection) return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get unique values from a column for categorical filtering
   */
  getUniqueColumnValues(columnIndex) {
    if (!this.originalData || this.originalData.length < 2) return [];
    
    const rows = this.originalData.slice(1); // Skip header
    const values = new Set();
    
    rows.forEach(row => {
      const value = row[columnIndex];
      if (value != null && String(value).trim() !== '') {
        values.add(String(value).trim());
      }
    });
    
    return Array.from(values).sort();
  }

  /**
   * Create filter controls for a specific column based on its type
   */
  createColumnFilter(header, columnIndex, columnType) {
    const typeInfo = this.getColumnTypeInfo(columnType);
    
    const filterGroup = document.createElement('div');
    filterGroup.className = 'column-filter-content';
    filterGroup.setAttribute('data-column', columnIndex);
    
    let filterHTML = '';
    
    switch (columnType) {
      case 'numeric':
      case 'money':
      case 'percentage':
        filterHTML = `
          <div class="filter-header">
            <label>${typeInfo.icon} ${header}</label>
            <small>Numeric range filtering</small>
          </div>
          <div class="numeric-filter">
            <input type="number" class="form-control filter-min" placeholder="Min" data-column="${columnIndex}" data-type="min">
            <span class="filter-separator">to</span>
            <input type="number" class="form-control filter-max" placeholder="Max" data-column="${columnIndex}" data-type="max">
            <button class="btn btn-link filter-clear" data-column="${columnIndex}">Clear</button>
          </div>
        `;
        break;
        
      case 'date':
        filterHTML = `
          <div class="filter-header">
            <label>${typeInfo.icon} ${header}</label>
            <small>Date range filtering</small>
          </div>
          <div class="date-filter">
            <input type="date" class="form-control filter-date-from" data-column="${columnIndex}" data-type="from">
            <span class="filter-separator">to</span>
            <input type="date" class="form-control filter-date-to" data-column="${columnIndex}" data-type="to">
            <button class="btn btn-link filter-clear" data-column="${columnIndex}">Clear</button>
          </div>
        `;
        break;
        
      case 'categorical':
      default:
        // For categorical data, create a dropdown with unique values
        const uniqueValues = this.getUniqueColumnValues(columnIndex);
        const options = uniqueValues.slice(0, 20).map(value => 
          `<option value="${value}">${value}</option>`
        ).join('');
        
        filterHTML = `
          <div class="filter-header">
            <label>${typeInfo.icon} ${header}</label>
            <small>Select specific values</small>
          </div>
          <div class="categorical-filter">
            <select class="form-control filter-select" data-column="${columnIndex}" multiple>
              <option value="">All values</option>
              ${options}
            </select>
            <input type="text" class="form-control filter-text" placeholder="Or contains text..." data-column="${columnIndex}">
            <button class="btn btn-link filter-clear" data-column="${columnIndex}">Clear</button>
          </div>
        `;
        break;
    }
    
    filterGroup.innerHTML = filterHTML;
    return filterGroup;
  }

  /**
   * Attach event listeners to the new filter controls
   */
  attachFilterEventListeners() {
    // Combined reset filters and sort
    const resetFiltersAndSortBtn = document.getElementById('resetFiltersAndSort');
    if (resetFiltersAndSortBtn) {
      resetFiltersAndSortBtn.addEventListener('click', () => this.resetFiltersAndSort());
    }
    
    // Note: Export buttons are now handled in main attachEventListeners() to prevent duplicates
    
    // Close popup when clicking outside
    document.addEventListener('click', (e) => {
      if (this.activeFilterPopup && !this.activeFilterPopup.contains(e.target) && !e.target.classList.contains('filter-btn')) {
        this.closeFilterPopup();
      }
    });
    
    // Close popup on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeFilterPopup) {
        this.closeFilterPopup();
      }
    });
  }

  /**
   * Clear a specific column filter
   */
  clearColumnFilter(columnIndex) {
    const popup = this.activeFilterPopup;
    if (popup && popup.getAttribute('data-column') == columnIndex) {
      // Clear all input values in the active popup
      popup.querySelectorAll('input').forEach(input => input.value = '');
      popup.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
    }
    
    this.applyColumnFilters();
  }

  /**
   * Clear all column filters
   */
  clearAllFilters() {
    // Clear active popup if any
    if (this.activeFilterPopup) {
      this.activeFilterPopup.querySelectorAll('input').forEach(input => input.value = '');
      this.activeFilterPopup.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
    }
    
    // Reset filter button states
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('filtered'));
    
    this.applyColumnFilters();
  }

  /**
   * Apply all active column filters to the data
   */
  applyColumnFilters() {
    if (!this.originalData || this.originalData.length < 2) return;
    
    let filteredData = [this.originalData[0]]; // Keep header
    const dataRows = this.originalData.slice(1);
    
    const filteredRows = dataRows.filter(row => {
      return this.checkAllColumnFilters(row);
    });
    
    filteredData = filteredData.concat(filteredRows);
    this.filteredData = filteredData;
    
    // Re-render with filtered data
    this.renderDataTable();
    this.calculateAllStats();
  }

  /**
   * Check if a row passes all column filters
   */
  checkAllColumnFilters(row) {
    // For now, only check the active popup filter
    // In a full implementation, you'd store filter states and check all columns
    if (!this.activeFilterPopup) return true;
    
    const columnIndex = parseInt(this.activeFilterPopup.getAttribute('data-column'));
    const cellValue = row[columnIndex];
    
    return this.checkColumnFilter(this.activeFilterPopup, cellValue, columnIndex);
  }

  /**
   * Check if a cell value passes a specific column filter
   */
  checkColumnFilter(popup, cellValue, columnIndex) {
    const columnType = this.columnTypes[columnIndex];
    
    switch (columnType) {
      case 'numeric':
      case 'money':
      case 'percentage':
        return this.checkNumericFilter(filterGroup, cellValue);
        
      case 'date':
        return this.checkDateFilter(filterGroup, cellValue);
        
      case 'categorical':
      default:
        return this.checkCategoricalFilter(filterGroup, cellValue);
    }
  }

  /**
   * Check numeric range filters
   */
  checkNumericFilter(filterGroup, cellValue) {
    const minInput = filterGroup.querySelector('.filter-min');
    const maxInput = filterGroup.querySelector('.filter-max');
    
    if (!minInput || !maxInput) return true;
    
    const minValue = minInput.value ? parseFloat(minInput.value) : null;
    const maxValue = maxInput.value ? parseFloat(maxInput.value) : null;
    
    if (minValue === null && maxValue === null) return true;
    
    // Parse numeric value from cell
    const numericValue = this.parseNumericValue(cellValue);
    if (numericValue === null) return true; // Skip non-numeric values
    
    if (minValue !== null && numericValue < minValue) return false;
    if (maxValue !== null && numericValue > maxValue) return false;
    
    return true;
  }

  /**
   * Check date range filters
   */
  checkDateFilter(filterGroup, cellValue) {
    const fromInput = filterGroup.querySelector('.filter-date-from');
    const toInput = filterGroup.querySelector('.filter-date-to');
    
    if (!fromInput || !toInput) return true;
    
    const fromDate = fromInput.value ? new Date(fromInput.value) : null;
    const toDate = toInput.value ? new Date(toInput.value) : null;
    
    if (!fromDate && !toDate) return true;
    
    // Try to parse the cell value as a date
    const cellDate = this.parseDateValue(cellValue);
    if (!cellDate) return true; // Skip non-date values
    
    if (fromDate && cellDate < fromDate) return false;
    if (toDate && cellDate > toDate) return false;
    
    return true;
  }

  /**
   * Check categorical filters (select and text)
   */
  checkCategoricalFilter(filterGroup, cellValue) {
    const selectInput = filterGroup.querySelector('.filter-select');
    const textInput = filterGroup.querySelector('.filter-text');
    
    const cellText = String(cellValue || '').trim().toLowerCase();
    
    // Check select filter
    if (selectInput && selectInput.selectedOptions.length > 0) {
      const selectedValues = Array.from(selectInput.selectedOptions)
        .map(option => option.value.toLowerCase())
        .filter(value => value !== '');
      
      if (selectedValues.length > 0 && !selectedValues.includes(cellText)) {
        return false;
      }
    }
    
    // Check text filter
    if (textInput && textInput.value.trim()) {
      const searchText = textInput.value.trim().toLowerCase();
      if (!cellText.includes(searchText)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Parse a numeric value from text (handles money, percentages, etc.)
   */
  parseNumericValue(value) {
    if (value == null) return null;
    
    const text = String(value).trim();
    if (!text) return null;
    
    // Remove common non-numeric characters
    const cleaned = text.replace(/[$€£¥%,\s]/g, '').replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Parse a date value from text
   */
  parseDateValue(value) {
    if (value == null) return null;
    
    const text = String(value).trim();
    if (!text) return null;
    
    const parsed = new Date(text);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  
  /**
   * Apply all active column filters
   */
  applyColumnFilters() {
    if (!this.originalData) return;
    
    const headers = this.originalData[0];
    const rows = this.originalData.slice(1);
    
    // Filter via savedFilters map
    const filteredRows = rows.filter(row => headers.every((_, ci) => this.rowPassesSavedFilter(row, ci)));
    
    this.filteredData = [headers, ...filteredRows];
    
    // Reapply current sort if any
    if (this.currentSort.column !== -1 && this.currentSort.direction !== 'none') {
      this.sortTable(this.currentSort.column, this.currentSort.direction);
    } else {
      this.renderDataTable();
    }
  }

  rowPassesSavedFilter(row, columnIndex) {
    const f = this.savedFilters[columnIndex];
    if (!f) return true;
    const raw = row[columnIndex];
    if (f.type === 'numeric') {
      const num = this.parseNumericValue(raw, columnIndex);
      if (f.min != null && num < parseFloat(f.min)) return false;
      if (f.max != null && num > parseFloat(f.max)) return false;
      return true;
    }
    if (f.type === 'date') {
      const d = this.parseDateValue(raw);
      if (!d) return true;
      if (f.from && d < new Date(f.from)) return false;
      if (f.to && d > new Date(f.to)) return false;
      return true;
    }
    if (f.type === 'categorical') {
      const text = (raw == null ? '' : String(raw)).trim();
      if (f.selected && f.selected.length && !f.selected.includes(text)) return false;
      if (f.text && !text.toLowerCase().includes(f.text.toLowerCase())) return false;
      return true;
    }
    return true;
  }

  /**
   * Clear all column filters
   */
  clearAllFilters() {
    // Clear all filter inputs
    document.querySelectorAll('.filter-min, .filter-max, .filter-date-from, .filter-date-to, .filter-text').forEach(input => {
      input.value = '';
    });
    
    document.querySelectorAll('.filter-select').forEach(select => {
      select.selectedIndex = 0; // Reset to first option
      Array.from(select.options).forEach(option => option.selected = false);
    });
    
    // Reset filtered data and re-render
    this.filteredData = [...this.originalData];
    this.savedFilters = {};
    this.renderDataTable();
  }
  
  /**
   * Clear filter for a specific column
   */
  clearColumnFilter(columnIndex) {
    // Clear all filter inputs for this column
    document.querySelectorAll(`[data-column="${columnIndex}"]`).forEach(input => {
      if (input.type === 'number' || input.type === 'date' || input.type === 'text') {
        input.value = '';
      } else if (input.tagName === 'SELECT') {
        input.selectedIndex = 0;
        Array.from(input.options).forEach(option => option.selected = false);
      }
    });
    
    // Reapply filters and remove saved state
    delete this.savedFilters[columnIndex];
    this.applyColumnFilters();
  }

  updateColumnStat(columnIndex, statFunction) {
    this.columnStats[columnIndex] = statFunction;
    this.calculateColumnStat(columnIndex);
  }
  
  calculateColumnStat(columnIndex) {
    if (!this.filteredData || this.filteredData.length < 2) return;
    
    const rows = this.filteredData.slice(1);
    const values = rows.map(row => row[columnIndex]).filter(val => val !== null && val !== undefined && val !== '');
    const resultElement = document.getElementById(`stat-result-${columnIndex}`);
    
    if (!resultElement || values.length === 0) {
      if (resultElement) resultElement.textContent = '0';
      return;
    }
    
    const statFunction = this.columnStats[columnIndex];
    const columnType = this.columnTypes[columnIndex];
    let result = 0;
    
    try {
      if (!window.TableStats) throw new Error('Stats library not loaded');
      if (columnType === 'numeric' || columnType === 'money' || columnType === 'percentage') {
        const numericValues = values.map(v => this.parseNumericValue(v, columnIndex)).filter(v => !isNaN(v));
        let raw = window.TableStats.computeNumericStatsFromNumbers(numericValues, statFunction);
        const fmt = this.numericFormatMap[columnIndex] || { thousand: ',', decimal: '.' };
        
        switch (statFunction) {
          case 'count':
            result = raw;
            break;
          case 'sum':
          case 'min':
          case 'max':
            if (columnType === 'money') {
              // Format money using the column's thousand/decimal separators
              const formatted = this.formatNumber(raw, fmt);
              result = '$ ' + formatted;
            } else if (columnType === 'percentage') {
              result = Number(raw).toFixed(2) + '%';
            } else {
              result = this.formatNumber(raw, fmt);
            }
            break;
          case 'avg':
          case 'std':
            if (columnType === 'money') {
              const formatted = this.formatNumber(raw, fmt, 2);
              result = '$ ' + formatted;
            } else if (columnType === 'percentage') {
              result = Number(raw).toFixed(2) + '%';
            } else {
              result = this.formatNumber(raw, fmt, 2);
            }
            break;
        }
        result = result;
      } else if (columnType === 'date') {
        const statVal = window.TableStats.getStatValue('date', statFunction, values);
        if (statFunction === 'earliest' || statFunction === 'latest') {
          result = statVal ? statVal.toLocaleDateString() : 'N/A';
        } else if (statFunction === 'range') {
          result = statVal === 0 || statVal == null ? 'N/A' : `${statVal} days`;
        } else if (statFunction === 'count') {
          result = statVal;
        } else if (statFunction === 'mode' || statFunction === 'unique') {
          result = statVal; // Should not be typical for date unless chosen
        }
      } else {
        const catVal = window.TableStats.getStatValue('categorical', statFunction, values);
        if (statFunction === 'mode' && catVal && typeof catVal === 'object') {
          result = catVal.value + (catVal.extra ? ` (+${catVal.extra})` : '');
        } else {
          result = catVal;
        }
      }
      resultElement.textContent = result;
    } catch (error) {
      console.error('Error calculating stat:', error);
      resultElement.textContent = 'Error';
    }
  }
  
  calculateAllStats() {
    this.columnStats.forEach((statFunction, index) => {
      this.calculateColumnStat(index);
    });
  }
  
  sortTable(columnIndex, direction = null) {
    if (!this.filteredData || this.filteredData.length < 2) return;
    
    const headers = this.filteredData[0];
    const rows = this.filteredData.slice(1);
    
    // Determine sort direction
    if (direction === null) {
      if (this.currentSort.column === columnIndex) {
        // Cycle through: none -> asc -> desc -> none
        switch (this.currentSort.direction) {
          case 'none': direction = 'asc'; break;
          case 'asc': direction = 'desc'; break;
          case 'desc': direction = 'none'; break;
        }
      } else {
        direction = 'asc';
      }
    }
    
    this.currentSort = { column: columnIndex, direction };
    
    if (direction === 'none') {
      // Reset to filtered order (which maintains original order)
      this.applyFilter();
      return;
    }
    
    // Sort rows based on column type
    const columnType = this.columnTypes[columnIndex] || 'categorical';
    const sortedRows = [...rows].sort((a, b) => {
      const aVal = a[columnIndex] || '';
      const bVal = b[columnIndex] || '';
      
      let comparison = 0;
      
      if (columnType === 'numeric' || columnType === 'money' || columnType === 'percentage') {
        const aNum = this.parseNumericValue(aVal, columnIndex);
        const bNum = this.parseNumericValue(bVal, columnIndex);
        comparison = aNum - bNum;
      } else {
        // String comparison
        comparison = aVal.toString().localeCompare(bVal.toString());
      }
      
      return direction === 'asc' ? comparison : -comparison;
    });
    
    this.filteredData = [headers, ...sortedRows];
    this.renderDataTable();
  }
  
  exportData(format) {
    if (!this.filteredData || this.filteredData.length === 0) return;

    if (format === 'xlsx') {
      // Excel XLSX export using SheetJS
      try {
        // Create a new workbook
        const wb = XLSX.utils.book_new();
        
        // Convert filtered data to worksheet
        const ws = XLSX.utils.aoa_to_sheet(this.filteredData);
        
        // Add the worksheet to the workbook
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        
        // Generate filename
        const fileName = `table-data-${new Date().toISOString().split('T')[0]}.xlsx`;
        
        // Write and download the file
        XLSX.writeFile(wb, fileName);
        
        this.showGlobalStatus('Data exported as XLSX successfully!', 'success');
        return;
      } catch (error) {
        console.error('XLSX export error:', error);
        this.showGlobalStatus('Error exporting XLSX: ' + error.message, 'error');
        return;
      }
    }

    if (format === 'md') {
      // Markdown table export
      const headers = this.filteredData[0];
      const rows = this.filteredData.slice(1);
      const escapeCell = (v) => {
        const s = (v == null ? '' : v.toString()).replace(/\|/g, '\\|');
        return s.replace(/\r?\n/g, ' ');
      };
      const headerLine = `| ${headers.map(escapeCell).join(' | ')} |`;
      const alignLine = `| ${headers.map(()=>'---').join(' | ')} |`;
      const rowLines = rows.map(r => `| ${r.map(escapeCell).join(' | ')} |`);
      const mdContent = [headerLine, alignLine, ...rowLines].join('\n');
      const blob = new Blob([mdContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fileName = `table-data-${new Date().toISOString().split('T')[0]}.md`; 
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      this.showGlobalStatus('Data exported as MARKDOWN successfully!', 'success');
      return;
    }

    const separator = format === 'tsv' ? '\t' : ',';
    const extension = format === 'tsv' ? 'tsv' : 'csv';
    const mimeType = format === 'tsv' ? 'text/tab-separated-values' : 'text/csv';

    const textContent = this.filteredData.map(row =>
      row.map(cell => {
        const cellStr = (cell || '').toString();
        if (cellStr.includes(separator) || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(separator)
    ).join('\n');

    const blob = new Blob([textContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `table-data-${new Date().toISOString().split('T')[0]}.${extension}`;
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.showGlobalStatus(`Data exported as ${extension.toUpperCase()} successfully!`, 'success');
  }
  
  createNewChart() {
    const chartId = `chart-${++this.chartCounter}`;
    const chartName = `Chart ${this.chartCounter}`;
    
    // Create tab
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.setAttribute('data-tab', chartId);
    tab.innerHTML = `📈 ${chartName} <span class="close-btn" title="Close chart">×</span>`;
    this.elements.tabBar.appendChild(tab);
    
    // Create tab panel
    const panel = document.createElement('div');
    panel.className = 'tab-panel';
    panel.id = `${chartId}-panel`;
    panel.innerHTML = this.createChartPanelHTML(chartId, chartName);
    
    document.querySelector('.tab-content').appendChild(panel);
    
    // Switch to new tab
    this.switchTab(chartId);
    
    // Initialize chart controls
    this.initializeChartControls(chartId);
  }
  
  createChartPanelHTML(chartId, chartName) {
    if (!this.tableData || this.tableData.length === 0) {
      return '<div class="chart-placeholder">No data available for charting</div>';
    }

    const headers = this.tableData[0];
    
    return `
      <div class="status-message" id="${chartId}-status" style="display: none;"></div>
      
      <div class="chart-controls">
        <div class="form-row">
          <div class="form-group chart-type-group">
            <label for="${chartId}-type">Chart Type:</label>
            <select id="${chartId}-type" class="form-control">
              ${Object.entries(this.chartTypeDefinitions).map(([key, def]) => 
                `<option value="${key}">${def.name}</option>`
              ).join('')}
            </select>
            <div class="chart-description" id="${chartId}-description">
              ${this.chartTypeDefinitions['line'].description}
            </div>
          </div>
        </div>
        
        <div class="chart-axis-controls" id="${chartId}-axis-controls">
          <!-- Dynamic axis controls will be inserted here -->
        </div>
        
        <div class="form-group chart-actions">
          <button id="${chartId}-generate" class="btn btn-primary" disabled>Generate Chart</button>
          <button id="${chartId}-clear" class="btn btn-secondary">Clear Selection</button>
        </div>
      </div>
      
      <div class="chart-container" id="${chartId}-container">
        <div class="chart-export-buttons">
          <button class="export-btn" onclick="tableViewer.exportChart('${chartId}', 'png')">PNG</button>
          <button class="export-btn" onclick="tableViewer.exportChart('${chartId}', 'svg')">SVG</button>
        </div>
        <div class="chart-placeholder">
          Select a chart type and configure the axes to create your visualization.
        </div>
      </div>
    `;
  }
  
  initializeChartControls(chartId) {
    const typeSelect = document.getElementById(`${chartId}-type`);
    const generateBtn = document.getElementById(`${chartId}-generate`);
    
    if (!typeSelect || !generateBtn) return;

    // Initialize with default chart type
    this.updateAxisControls(chartId, typeSelect.value);

    // Chart type change handler
    typeSelect.addEventListener('change', (e) => {
      this.updateAxisControls(chartId, e.target.value);
    });

    // Generate button handler
    generateBtn.addEventListener('click', () => {
      this.generateChart(chartId);
    });
  }
  
  getValidColumnsForAxis(axisRequirements) {
    if (!this.tableData || !this.columnTypes) return [];
    
    const headers = this.tableData[0];
    return headers.map((header, index) => {
      const columnType = this.columnTypes[index];
      const typeIcon = this.getColumnTypeInfo(columnType).icon;
      
      return {
        index,
        header,
        type: columnType,
        icon: typeIcon,
        valid: axisRequirements.types.includes(columnType)
      };
    }).filter(col => col.valid);
  }

  generateAxisControlsHTML(chartId, chartType) {
    const chartDef = this.chartTypeDefinitions[chartType];
    if (!chartDef) return '';

    let html = '';
    
    // X-Axis controls
    if (chartDef.xAxis.required) {
      const validXCols = this.getValidColumnsForAxis(chartDef.xAxis);
      
      html += `
        <div class="form-group axis-group">
          <label for="${chartId}-x">${chartDef.xAxis.label}:</label>
          <select id="${chartId}-x" class="form-control" ${
            validXCols.length === 0 ? 'disabled' : ''
          }>
            <option value="">Select ${chartDef.xAxis.label.toLowerCase()}...</option>
            ${validXCols.map(col => 
              `<option value="${col.index}">${col.icon} ${col.header}</option>`
            ).join('')}
          </select>
          <div class="axis-hint">${chartDef.xAxis.hint}</div>
          ${validXCols.length === 0 ? 
            `<div class="axis-warning">⚠️ No suitable columns found for X-axis. Need: ${chartDef.xAxis.types.join(', ')}</div>` : 
            ''
          }
        </div>
      `;
    }
    
    // Y-Axis controls
    if (chartDef.yAxis.required) {
      const validYCols = this.getValidColumnsForAxis(chartDef.yAxis);
      
      if (chartDef.yAxis.multiple) {
        // Multiple selection for Y-axis (checkboxes)
        html += `
          <div class="form-group axis-group">
            <label>${chartDef.yAxis.label}:</label>
            <div class="checkbox-group" id="${chartId}-y">
              ${validYCols.map(col => `
                <div class="checkbox-item">
                  <input type="checkbox" id="${chartId}-col-${col.index}" value="${col.index}">
                  <label for="${chartId}-col-${col.index}">${col.icon} ${col.header}</label>
                </div>
              `).join('')}
            </div>
            <div class="axis-hint">${chartDef.yAxis.hint}</div>
            ${validYCols.length === 0 ? 
              `<div class="axis-warning">⚠️ No suitable columns found for Y-axis. Need: ${chartDef.yAxis.types.join(', ')}</div>` : 
              ''
            }
          </div>
        `;
      } else {
        // Single selection for Y-axis (dropdown)
        html += `
          <div class="form-group axis-group">
            <label for="${chartId}-y-single">${chartDef.yAxis.label}:</label>
            <select id="${chartId}-y-single" class="form-control" ${
              validYCols.length === 0 ? 'disabled' : ''
            }>
              <option value="">Select ${chartDef.yAxis.label.toLowerCase()}...</option>
              ${validYCols.map(col => 
                `<option value="${col.index}">${col.icon} ${col.header}</option>`
              ).join('')}
            </select>
            <div class="axis-hint">${chartDef.yAxis.hint}</div>
            ${validYCols.length === 0 ? 
              `<div class="axis-warning">⚠️ No suitable columns found for Y-axis. Need: ${chartDef.yAxis.types.join(', ')}</div>` : 
              ''
            }
          </div>
        `;
      }
    }
    
    return html;
  }

  updateAxisControls(chartId, chartType) {
    const axisContainer = document.getElementById(`${chartId}-axis-controls`);
    const descriptionDiv = document.getElementById(`${chartId}-description`);
    
    if (axisContainer) {
      axisContainer.innerHTML = this.generateAxisControlsHTML(chartId, chartType);
    }
    
    if (descriptionDiv && this.chartTypeDefinitions[chartType]) {
      descriptionDiv.textContent = this.chartTypeDefinitions[chartType].description;
    }
    
    // Re-attach event listeners for new controls
    this.attachAxisEventListeners(chartId, chartType);
  }

  attachAxisEventListeners(chartId, chartType) {
    const chartDef = this.chartTypeDefinitions[chartType];
    if (!chartDef) return;

    // Get elements based on chart type
    const elements = {
      type: document.getElementById(`${chartId}-type`),
      xAxis: document.getElementById(`${chartId}-x`),
      yAxis: chartDef.yAxis.multiple ? 
        document.getElementById(`${chartId}-y`) : 
        document.getElementById(`${chartId}-y-single`),
      generate: document.getElementById(`${chartId}-generate`),
      clear: document.getElementById(`${chartId}-clear`)
    };

    // Validation function
    const validateInputs = () => {
      let hasValidConfig = true;
      
      // Check X-axis
      if (chartDef.xAxis.required) {
        hasValidConfig = hasValidConfig && elements.xAxis && elements.xAxis.value !== '';
      }
      
      // Check Y-axis
      if (chartDef.yAxis.required) {
        if (chartDef.yAxis.multiple) {
          const checkedBoxes = elements.yAxis ? elements.yAxis.querySelectorAll('input:checked') : [];
          hasValidConfig = hasValidConfig && checkedBoxes.length > 0;
        } else {
          hasValidConfig = hasValidConfig && elements.yAxis && elements.yAxis.value !== '';
        }
      }
      
      if (elements.generate) {
        elements.generate.disabled = !hasValidConfig;
      }
    };

    // Attach event listeners
    if (elements.xAxis) {
      elements.xAxis.addEventListener('change', validateInputs);
    }
    
    if (elements.yAxis) {
      elements.yAxis.addEventListener('change', validateInputs);
    }
    
    if (elements.clear) {
      elements.clear.addEventListener('click', () => {
        if (elements.xAxis) elements.xAxis.value = '';
        if (elements.yAxis) {
          if (chartDef.yAxis.multiple) {
            const checkboxes = elements.yAxis.querySelectorAll('input[type="checkbox"]');
            if (checkboxes) {
              checkboxes.forEach(cb => cb.checked = false);
            }
          } else {
            elements.yAxis.value = '';
          }
        }
        validateInputs();
      });
    }

    // Auto-select smart defaults
    this.autoSelectSmartDefaults(chartId, chartType);
    
    // Initial validation
    validateInputs();
  }

  autoSelectSmartDefaults(chartId, chartType) {
    const chartDef = this.chartTypeDefinitions[chartType];
    if (!chartDef) return;

    // Auto-select X-axis if only one valid option or obvious choice
    if (chartDef.xAxis.required) {
      const validXCols = this.getValidColumnsForAxis(chartDef.xAxis);
      const xSelect = document.getElementById(`${chartId}-x`);
      
      if (validXCols.length === 1) {
        // Only one option, select it
        if (xSelect) xSelect.value = validXCols[0].index;
      } else if (validXCols.length > 0) {
        // Find first categorical or date column for categories-based charts
        const preferredCol = validXCols.find(col => 
          col.type === 'categorical' || col.type === 'date'
        );
        if (preferredCol && xSelect) {
          xSelect.value = preferredCol.index;
        }
      }
    }

    // Auto-select Y-axis for single-selection charts
    if (chartDef.yAxis.required && !chartDef.yAxis.multiple) {
      const validYCols = this.getValidColumnsForAxis(chartDef.yAxis);
      const ySelect = document.getElementById(`${chartId}-y-single`);
      
      if (validYCols.length === 1 && ySelect) {
        // Only one option, select it
        ySelect.value = validYCols[0].index;
      }
    }
  }

  formatNumber(value, format, decimals = 0) {
    if (isNaN(value) || value === null || value === undefined) return '0';
    
    const num = Number(value);
    const fmt = format || { thousand: ',', decimal: '.' };
    
    // Split into integer and decimal parts
    const parts = num.toFixed(decimals).split('.');
    let integerPart = parts[0];
    const decimalPart = parts[1];
    
    // Add thousand separators if specified
    if (fmt.thousand && integerPart.length > 3) {
      // Add thousand separators from right to left
      const reversed = integerPart.split('').reverse();
      const withSeparators = [];
      for (let i = 0; i < reversed.length; i++) {
        if (i > 0 && i % 3 === 0) {
          withSeparators.push(fmt.thousand);
        }
        withSeparators.push(reversed[i]);
      }
      integerPart = withSeparators.reverse().join('');
    }
    
    // Combine with decimal part if present
    if (decimals > 0 && decimalPart) {
      return integerPart + fmt.decimal + decimalPart;
    }
    
    return integerPart;
  }

  isNumericColumn(columnIndex) {
    const columnType = this.columnTypes && this.columnTypes[columnIndex];
    return columnType === 'numeric' || columnType === 'money' || columnType === 'percentage';
  }

  resetSort() {
    this.currentSort = { column: -1, direction: 'none' };
    this.filteredData = [...this.originalData];
    this.applyFilter(); // Reapply any active filters
  }
  
  /**
   * Combined method to reset both filters and sorting
   */
  resetFiltersAndSort() {
    // Clear all filters first
    this.clearAllFilters();
    // Reset sorting
    this.resetSort();
  }
  
  generateChart(chartId) {
    console.log('Generating chart:', chartId);
    
    const elements = {
      type: document.getElementById(`${chartId}-type`),
      xAxis: document.getElementById(`${chartId}-x`),
      yCheckboxes: document.getElementById(`${chartId}-y`), // For multiple selection
      ySingle: document.getElementById(`${chartId}-y-single`), // For single selection
      container: document.getElementById(`${chartId}-container`),
      status: document.getElementById(`${chartId}-status`)
    };
    
    try {
      // Check if we have pre-configured chart values (during restoration)
      const existingConfig = this.chartConfigs && this.chartConfigs[chartId];
      let chartType, xColumn, yColumns;
      
      if (existingConfig) {
        // Use pre-configured values during restoration
        console.log('🔄 Using pre-configured chart values during restoration:', existingConfig);
        chartType = existingConfig.chartType;
        xColumn = existingConfig.xColumn;
        yColumns = [...existingConfig.yColumns];
        
        // Validate the pre-configured values
        if (isNaN(xColumn) || xColumn < 0 || yColumns.length === 0) {
          throw new Error('Invalid pre-configured chart values');
        }
      } else {
        // Extract configuration from DOM elements (normal user interaction)
        chartType = elements.type.value;
        const chartDef = this.chartTypeDefinitions[chartType];
        xColumn = parseInt(elements.xAxis.value);
        
        // Handle Y-axis columns based on chart type
        yColumns = [];
        if (chartDef && chartDef.yAxis) {
          if (chartDef.yAxis.multiple && elements.yCheckboxes) {
            // Multiple selection (checkboxes) - for line, bar, etc.
            const checkedInputs = elements.yCheckboxes.querySelectorAll('input:checked');
            yColumns = Array.from(checkedInputs).map(cb => parseInt(cb.value));
          } else if (!chartDef.yAxis.multiple && elements.ySingle) {
            // Single selection (dropdown) - for pie, doughnut, scatter
            const selectedValue = elements.ySingle.value;
            if (selectedValue && selectedValue !== '') {
              yColumns = [parseInt(selectedValue)];
            }
          }
        }
        
        // Validate required inputs
        if (isNaN(xColumn) || xColumn < 0) {
          throw new Error('Please select a valid X-axis column');
        }
        
        if (yColumns.length === 0) {
          throw new Error('Please select at least one Y-axis column');
        }
      }
      
      // Destroy existing chart
      if (this.charts.has(chartId)) {
        this.charts.get(chartId).destroy();
      }
      
      // Process data
      const chartData = this.processChartData(xColumn, yColumns, chartType);
      
      // Create canvas
      elements.container.innerHTML = `
        <div class="chart-export-buttons">
          <button class="export-btn" onclick="tableViewer.exportChart('${chartId}', 'png')">PNG</button>
          <button class="export-btn" onclick="tableViewer.exportChart('${chartId}', 'svg')">SVG</button>
        </div>
        <canvas id="${chartId}-canvas" width="800" height="400"></canvas>
      `;
      const canvas = document.getElementById(`${chartId}-canvas`);
      const ctx = canvas.getContext('2d');
      
      // Chart configuration
      const config = this.createChartConfig(chartType, chartData, xColumn, yColumns);
      
      // Apply theme-sensitive styling
      this.applyChartTheme(config, canvas);
      // Create chart
      const chart = new Chart(ctx, config);
      this.charts.set(chartId, chart);
      
      this.showStatus(chartId, 'Chart generated successfully!', 'success');
      console.log('Chart created:', chart);
      
      // Save state after chart generation
      setTimeout(() => this.saveState(), 500);
      
    } catch (error) {
      console.error('Error generating chart:', error);
      this.showStatus(chartId, `Error generating chart: ${error.message}`, 'error');
    }
  }
  
  processChartData(xColumn, yColumns, chartType) {
    const headers = this.filteredData[0];
    const rows = this.filteredData.slice(1);
    
    // Special handling for scatter plots
    if (chartType === 'scatter') {
      const datasets = yColumns.map((yCol, index) => {
        const columnName = headers[yCol] || `Column ${yCol + 1}`;
        const dataPoints = rows.map(row => ({
          x: this.parseNumericValue(row[xColumn], xColumn),
          y: this.parseNumericValue(row[yCol], yCol)
        }));
        
        return {
          label: columnName,
          data: dataPoints,
          backgroundColor: this.generateColors(1, index),
          borderColor: this.generateBorderColors(1, index),
          borderWidth: 1,
          pointRadius: 4,
          pointHoverRadius: 6
        };
      });
      
      return { datasets };
    }
    
    // Default handling for other chart types
    const labels = rows.map(row => row[xColumn] || '');
    
    // Extract datasets (Y-axis data)
    const datasets = yColumns.map((yCol, index) => {
      const columnName = headers[yCol] || `Column ${yCol + 1}`;
      const values = rows.map(row => this.parseNumericValue(row[yCol], yCol));
      
      return {
        label: columnName,
        data: values,
        backgroundColor: this.generateColors(chartType === 'pie' || chartType === 'doughnut' ? values.length : 1, index),
        borderColor: this.generateBorderColors(chartType === 'pie' || chartType === 'doughnut' ? values.length : 1, index),
        borderWidth: chartType === 'line' ? 2 : 1,
        fill: chartType === 'line' ? false : true,
        tension: chartType === 'line' ? 0.4 : 0
      };
    });
    
    return { labels, datasets };
  }
  
  parseNumericValue(value, columnIndex) {
    if (value === null || value === undefined || value === '') return 0;
    const str = String(value).trim();
    const fmt = this.numericFormatMap[columnIndex] || { thousand: ',', decimal: '.' };
    
    // Remove currency symbols and percent and trim
    let cleaned = str.replace(/[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]/g,'').replace(/%/g,'').trim();
    // Remove spaces at start and collapse
    cleaned = cleaned.replace(/\s+/g,' ');
    // Extract sign
    let sign = 1;
    if (/^-/.test(cleaned)) { sign = -1; }
    cleaned = cleaned.replace(/^[-+]/,'');
    // Keep only digits, separators, spaces
    cleaned = cleaned.replace(/[^0-9.,\s]/g,'');
    
    // Strategy: split on decimal separator occurrence nearest to end
    let integerPart = cleaned;
    let decimalPart = '';
    if (fmt.decimal && cleaned.includes(fmt.decimal)) {
      const lastIdx = cleaned.lastIndexOf(fmt.decimal);
      integerPart = cleaned.slice(0, lastIdx);
      decimalPart = cleaned.slice(lastIdx + 1).replace(/[^0-9]/g,'');
    }
    
    // Remove thousand separators from integerPart
    const thousandRegex = fmt.thousand === ' ' ? /\s+/g : new RegExp('\\' + fmt.thousand, 'g');
    if (fmt.thousand) integerPart = integerPart.replace(thousandRegex, '');
    // Remove all non-digits
    integerPart = integerPart.replace(/[^0-9]/g,'');
    if (integerPart === '') integerPart = '0';
    
    let normalized = integerPart;
    if (decimalPart) normalized += '.' + decimalPart;
    
    const num = parseFloat(normalized) * sign;
    const result = isNaN(num) ? 0 : num;
    return result;
  }
  
  generateColors(count, datasetIndex) {
    const colorPalettes = [
      ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'],
      ['#a8edea', '#fed6e3', '#ffecd2', '#fcb69f', '#c3cfe2', '#f5f7fa'],
      ['#ff9a9e', '#fecfef', '#fecfef', '#d299c2', '#fe9a8b', '#87ceeb']
    ];
    
    const palette = colorPalettes[datasetIndex % colorPalettes.length];
    
    if (count === 1) {
      return palette[0];
    }
    
    return Array.from({ length: count }, (_, i) => {
      return palette[i % palette.length];
    });
  }
  
  generateBorderColors(count, datasetIndex) {
    const colors = this.generateColors(count, datasetIndex);
    
    if (Array.isArray(colors)) {
      return colors.map(color => this.darkenColor(color, 0.2));
    }
    
    return this.darkenColor(colors, 0.2);
  }
  
  darkenColor(color, factor) {
    const hex = color.replace('#', '');
    const rgb = [
      parseInt(hex.substr(0, 2), 16),
      parseInt(hex.substr(2, 2), 16),
      parseInt(hex.substr(4, 2), 16)
    ];
    
    const darkened = rgb.map(c => Math.floor(c * (1 - factor)));
    
    return `#${darkened.map(c => c.toString(16).padStart(2, '0')).join('')}`;
  }
  
  applyChartTheme(config, canvas) {
    const isDark = (document.body.getAttribute('data-theme') || 'light') === 'dark';
    const axisColor = isDark ? '#cbd5e0' : '#495057';
    const gridColor = isDark ? 'rgba(203,213,224,0.15)' : 'rgba(0,0,0,0.1)';
    const titleColor = isDark ? '#e2e8f0' : '#333';
    const backgroundColor = isDark ? '#2d3748' : '#ffffff';
    const tooltipBg = isDark ? '#4a5568' : '#333';
    const tooltipText = isDark ? '#e2e8f0' : '#fff';
    
    // Set canvas background
    if (canvas) {
      canvas.style.backgroundColor = backgroundColor;
    }
    
    // Apply theme to chart configuration
    if (!config.options) config.options = {};
    
    // Plugin styling
    config.options.plugins = config.options.plugins || {};
    
    // Legend styling
    config.options.plugins.legend = config.options.plugins.legend || {};
    config.options.plugins.legend.labels = config.options.plugins.legend.labels || {};
    config.options.plugins.legend.labels.color = axisColor;
    
    // Title styling
    config.options.plugins.title = config.options.plugins.title || {};
    if (config.options.plugins.title.display) {
      config.options.plugins.title.color = titleColor;
    }
    
    // Tooltip styling
    config.options.plugins.tooltip = config.options.plugins.tooltip || {};
    config.options.plugins.tooltip.backgroundColor = tooltipBg;
    config.options.plugins.tooltip.titleColor = tooltipText;
    config.options.plugins.tooltip.bodyColor = tooltipText;
    config.options.plugins.tooltip.borderColor = gridColor;
    config.options.plugins.tooltip.borderWidth = 1;
    
    // Scale styling
    if (config.options.scales) {
      Object.values(config.options.scales).forEach(scale => {
        // Tick styling
        if (scale.ticks) {
          scale.ticks.color = axisColor;
        } else {
          scale.ticks = { color: axisColor };
        }
        
        // Grid styling
        if (scale.grid) {
          scale.grid.color = gridColor;
        } else {
          scale.grid = { color: gridColor };
        }
        
        // Title styling
        if (scale.title) {
          scale.title.color = axisColor;
        }
      });
    }
  }

  updateAllChartsTheme() {
    // Update all existing charts with new theme
    this.charts.forEach((chart, chartId) => {
      const canvas = document.getElementById(`${chartId}-canvas`);
      if (canvas && chart) {
        // Apply theme to canvas
        const isDark = (document.body.getAttribute('data-theme') || 'light') === 'dark';
        const backgroundColor = isDark ? '#2d3748' : '#ffffff';
        canvas.style.backgroundColor = backgroundColor;
        
        // Apply theme to chart configuration and update
        this.applyChartTheme(chart.config, canvas);
        chart.update('none'); // Update without animation for theme switch
      }
    });
  }

  createChartConfig(chartType, chartData, xColumn, yColumns) {
    const headers = this.filteredData[0];
    
    const baseConfig = {
      type: chartType === 'horizontalBar' ? 'bar' : chartType,
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: this.generateChartTitle(chartType, xColumn, yColumns),
            font: { size: 16, weight: 'bold' },
            padding: 20
          },
          legend: {
            display: chartType !== 'pie' && chartType !== 'doughnut' || chartData.datasets.length > 1,
            position: chartType === 'pie' || chartType === 'doughnut' ? 'right' : 'top'
          }
        },
        scales: this.getScaleConfig(chartType, headers, xColumn, yColumns),
        animation: { duration: 1000, easing: 'easeOutQuart' },
        indexAxis: chartType === 'horizontalBar' ? 'y' : 'x'
      }
    };
    
    // Special handling for scatter plots
    if (chartType === 'scatter') {
      baseConfig.type = 'scatter';
      baseConfig.options.scales.x.type = 'linear';
      baseConfig.options.scales.x.position = 'bottom';
    }
    
    return baseConfig;
  }
  
  generateChartTitle(chartType, xColumn, yColumns) {
    const headers = this.filteredData[0];
    const chartTypeNames = {
      line: 'Line Chart',
      bar: 'Bar Chart', 
      pie: 'Pie Chart',
      doughnut: 'Doughnut Chart',
      horizontalBar: 'Horizontal Bar Chart',
      scatter: 'Scatter Plot'
    };
    
    const xLabel = headers[xColumn] || 'Category';
    const yLabels = yColumns.map(col => headers[col] || `Data ${col + 1}`);
    
    if (chartType === 'scatter') {
      return `${chartTypeNames[chartType]}: ${yLabels[0]} vs ${xLabel}`;
    }
    
    if (yLabels.length === 1) {
      return `${chartTypeNames[chartType]}: ${yLabels[0]} by ${xLabel}`;
    }
    
    return `${chartTypeNames[chartType]}: Multiple Metrics by ${xLabel}`;
  }
  
  getScaleConfig(chartType, headers, xColumn, yColumns) {
    if (chartType === 'pie' || chartType === 'doughnut') {
      return {};
    }
    
    return {
      x: {
        display: true,
        title: {
          display: true,
          text: headers[xColumn] || 'X-Axis'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: yColumns.length === 1 ? headers[yColumns[0]] || 'Y-Axis' : 'Values'
        },
        beginAtZero: true
      }
    };
  }
  
  switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === tabId);
    });
    
    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabId}-panel`);
    });
  }
  
  closeTab(tabId) {
    // Don't close data tab
    if (tabId === 'data') return;
    
    // Destroy chart if exists
    if (this.charts.has(tabId)) {
      this.charts.get(tabId).destroy();
      this.charts.delete(tabId);
    }
    
    // Remove tab and panel
    const tab = document.querySelector(`[data-tab="${tabId}"]`);
    const panel = document.getElementById(`${tabId}-panel`);
    
    if (tab) tab.remove();
    if (panel) panel.remove();
    
    // Switch to data tab if current tab was closed
    if (tab && tab.classList.contains('active')) {
      this.switchTab('data');
    }
  }
  
  showStatus(chartId, message, type) {
    const statusElement = document.getElementById(`${chartId}-status`);
    statusElement.style.display = 'block';
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    
    if (type === 'success') {
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }
  }
  
  showGlobalStatus(message, type) {
    // Create or update global status message
    let statusElement = document.getElementById('globalStatus');
    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.id = 'globalStatus';
      statusElement.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 20px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 9999;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(statusElement);
    }
    
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = 'block';
    
    if (type === 'success') {
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }
  }
  
  exportChart(chartId, format) {
    const chart = this.charts.get(chartId);
    if (!chart) {
      this.showGlobalStatus('Chart not found', 'error');
      return;
    }
    
    try {
      let dataUrl;
      let fileName;
      
      if (format === 'png') {
        dataUrl = chart.toBase64Image('image/png', 1.0);
        fileName = `chart-${chartId}-${new Date().toISOString().split('T')[0]}.png`;
      } else if (format === 'svg') {
        // For SVG export, we'll convert the canvas to SVG
        const canvas = chart.canvas;
        const ctx = canvas.getContext('2d');
        const svgData = this.canvasToSVG(canvas);
        dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
        fileName = `chart-${chartId}-${new Date().toISOString().split('T')[0]}.svg`;
      }
      
      // Create and trigger download
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.showGlobalStatus(`Chart exported as ${format.toUpperCase()} successfully!`, 'success');
      
    } catch (error) {
      console.error('Export error:', error);
      this.showGlobalStatus(`Error exporting chart: ${error.message}`, 'error');
    }
  }
  
  canvasToSVG(canvas) {
    // Convert canvas to SVG (simplified approach)
    const width = canvas.width;
    const height = canvas.height;
    const dataUrl = canvas.toDataURL('image/png');
    
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <image href="${dataUrl}" width="${width}" height="${height}"/>
      </svg>
    `.trim();
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
    // Update all existing charts with new theme
    this.updateAllChartsTheme();
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
    
    // Update existing charts if any
    if (this.charts && this.charts.size > 0) {
      this.updateAllChartsTheme();
    }
    
    // Save state when theme changes
    this.saveState();
  }
  
  /**
   * Generate a unique table ID for state management
   */
  generateTableId() {
    if (this.tableInfo) {
      if (this.tableInfo.persistedId) return this.tableInfo.persistedId;
      if (this.tableInfo.id) return this.tableInfo.id;
    }
    
    // Generate ID from table characteristics
    const headers = this.tableData && this.tableData[0] ? this.tableData[0] : [];
    const rowCount = this.tableData ? this.tableData.length - 1 : 0;
    const colCount = headers.length;
    
    // Create hash from headers and basic info
    let hash = 0;
    const str = headers.join('|') + `_${rowCount}x${colCount}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `table_${Math.abs(hash).toString(36)}`;
  }
  
  /**
   * Restore advanced state (filters, charts, active tab)
   */
  async restoreAdvancedState(savedState) {
    try {
      // Restore filters
      if (savedState.activeFilters) {
        this.stateManager.restoreFilters(savedState.activeFilters);
        // Apply the restored filters
        this.applyColumnFilters();
      }
      
      // Restore charts
      if (savedState.charts) {
        await this.stateManager.restoreCharts(this, savedState.charts);
      }
      
      // Restore active tab
      if (savedState.activeTab) {
        this.stateManager.restoreActiveTab(savedState.activeTab);
      }
      
      // Apply saved filters immediately
      if (Object.keys(this.savedFilters).length > 0) {
        console.log('🔍 Applying restored filters:', this.savedFilters);
        this.applyColumnFilters();
      }
      
      // Restore sorting if any
      if (savedState.currentSort && savedState.currentSort.column !== -1) {
        this.sortTable(savedState.currentSort.column, savedState.currentSort.direction);
      }
      
      console.log('🎯 Advanced state restoration completed');
    } catch (error) {
      console.error('Error restoring advanced state:', error);
    }
  }
  
  /**
   * Manually save current state to session storage
   */
  saveState() {
    if (this.stateManager && this.tableData) {
      this.stateManager.saveState(this);
      console.log('💾 Table state saved');
    }
  }

  /**
   * Show export format selection modal
   */
  showExportFormatModal() {
    const modal = document.getElementById('exportFormatModal');
    if (modal) {
      modal.style.display = 'flex';
      
      // Focus on the first radio button for accessibility
      const firstRadio = modal.querySelector('input[type="radio"]');
      if (firstRadio) firstRadio.focus();
      
      // Add event listeners for modal interactions
      this.attachExportModalListeners(modal);
    }
  }

  /**
   * Attach event listeners for export modal
   */
  attachExportModalListeners(modal) {
    // Close on escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeExportFormatModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Close when clicking on backdrop
    const clickHandler = (e) => {
      if (e.target === modal) {
        this.closeExportFormatModal();
        modal.removeEventListener('click', clickHandler);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    modal.addEventListener('click', clickHandler);
  }

  /**
   * Close export format modal
   */
  closeExportFormatModal() {
    const modal = document.getElementById('exportFormatModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Confirm export format selection and trigger export
   */
  confirmExportFormat() {
    const modal = document.getElementById('exportFormatModal');
    if (!modal) return;
    
    const selectedFormat = modal.querySelector('input[name="exportFormat"]:checked');
    if (selectedFormat) {
      const format = selectedFormat.value;
      this.closeExportFormatModal();
      this.exportData(format);
    }
  }

  /**
  * Show dialog to save current table & charts with a name
   */
  showSaveStateDialog() {
    const modal = document.createElement('div');
    modal.className = 'save-state-modal';
    modal.innerHTML = `
      <div class="save-state-content" role="dialog" aria-modal="true">
  <h3>💾 Save</h3>
        <div class="form-group">
          <label for="state-name">State Name:</label>
          <input type="text" id="state-name" class="form-control" placeholder="My table configuration" maxlength="50">
          <div class="save-hint">Give your saved state a meaningful name</div>
        </div>
        <div class="save-state-actions">
          <button class="btn btn-secondary" data-action="cancel">Cancel</button>
          <button class="btn btn-success" data-action="save">Save</button>
        </div>
      </div>`;
    
    document.body.appendChild(modal);
    
    // Focus the input
    const nameInput = modal.querySelector('#state-name');
    nameInput.focus();
    
    // Auto-generate a default name or use current workspace name
    let defaultName;
    if (this.currentWorkspaceName) {
      // If we have a current workspace name, use it as default
      defaultName = this.currentWorkspaceName;
    } else {
      // Generate a new default name
      const now = new Date();
      defaultName = `Table ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    }
    nameInput.value = defaultName;
    nameInput.select();
    
    // Add event handlers
    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    const saveBtn = modal.querySelector('[data-action="save"]');
    
    cancelBtn.addEventListener('click', () => modal.remove());
    
    saveBtn.addEventListener('click', () => {
      const stateName = nameInput.value.trim();
      if (stateName) {
        this.saveNamedState(stateName);
        modal.remove();
      } else {
        nameInput.focus();
        nameInput.classList.add('error');
        setTimeout(() => nameInput.classList.remove('error'), 2000);
      }
    });
    
    // Handle Enter key
    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveBtn.click();
      }
    });
    
    // Close on escape
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modal.remove();
      }
    });
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Save state with a specific name
   */
  saveNamedState(stateName) {
    if (!this.stateManager || !this.tableData) return;
    
    // Generate full snapshot including table & charts
    const currentState = this.stateManager.generateState(this);
    
    // Get existing saved states from localStorage
    const savedStates = JSON.parse(localStorage.getItem('tableLensSavedStates') || '[]');
    
    // Check if a state with this name already exists
    const existingIndex = savedStates.findIndex(state => state.name === stateName);
    
    // Create new state object
    const newState = {
      id: existingIndex !== -1 ? savedStates[existingIndex].id : Date.now().toString(),
      name: stateName,
      timestamp: new Date().toISOString(),
      state: currentState,
      tableFingerprint: currentState.dataFingerprint,
      url: window.location.href
    };
    
    if (existingIndex !== -1) {
      // Overwrite existing state
      savedStates[existingIndex] = newState;
      console.log(`💾 Overwriting existing workspace "${stateName}"`);
    } else {
      // Add new state
      savedStates.push(newState);
      console.log(`💾 Creating new workspace "${stateName}"`);
    }
    
    // Update current workspace name
    this.currentWorkspaceName = stateName;
    
    // Update title to show current workspace name
    this.elements.headerTitle.textContent = `💾 ${stateName}`;
    
    // Keep only last 50 states to avoid storage bloat
    if (savedStates.length > 50) {
      savedStates.splice(0, savedStates.length - 50);
    }
    
    // Save to localStorage
    localStorage.setItem('tableLensSavedStates', JSON.stringify(savedStates));
    
    // Show success message & subtle flash on button
    this.showGlobalStatus(`✅ Saved "${stateName}"`, 'success');
    const btn = this.elements.saveState;
    if (btn) {
      btn.disabled = true;
      btn.textContent = '✔ Saved';
      setTimeout(() => { btn.disabled = false; btn.textContent = '💾 Save'; }, 1200);
    }

    // Notify popup (if open) to refresh saved states list
    try { chrome.runtime?.sendMessage({ action: 'refreshSavedStates'}); } catch(_) {}
    
    console.log(`💾 Named state "${stateName}" ${existingIndex !== -1 ? 'updated' : 'saved'} with ${savedStates.length} total saved states`);
  }

  /**
   * Restore table viewer from a saved state
   */
  restoreFromSavedState(savedState) {
    if (!savedState || !this.stateManager) {
      console.error('Cannot restore: invalid saved state or no state manager');
      return;
    }

    try {
      // Apply the saved state using the state manager
      const restored = this.stateManager.applyState(this, savedState);
      
      if (restored) {
        console.log('✅ Successfully restored from saved state');
        
        // Update the header to show workspace name if available
        if (this.currentWorkspaceName) {
          this.elements.headerTitle.textContent = `💾 ${this.currentWorkspaceName}`;
        } else {
          this.elements.headerTitle.textContent = '💾 Saved Workspace Loaded';
        }
        
        // Re-render everything
        this.renderDataTable();
        this.setupDataControls();
        
        // Restore charts and advanced state
        setTimeout(() => this.restoreAdvancedState(savedState), 300);
        
        // Show a success message
        this.showGlobalStatus('✅ Saved workspace loaded successfully!', 'success');
      } else {
        console.error('Failed to apply saved state');
        this.showGlobalStatus('❌ Failed to restore saved state', 'error');
      }
    } catch (error) {
      console.error('Error restoring saved state:', error);
      this.showGlobalStatus('❌ Error loading saved state', 'error');
    }
  }
  
  /**
   * Clear saved state
   */
  clearSavedState() {
    if (this.stateManager) {
      this.stateManager.clearState();
    }
  }
}

// Initialize when page loads
let tableViewer;
document.addEventListener('DOMContentLoaded', () => {
  tableViewer = new TableViewer();
  // Make tableViewer globally accessible for chart export buttons
  window.tableViewer = tableViewer;

  // Hook export format modal buttons (added via HTML, no inline handlers due to CSP)
  const cancelBtn = document.getElementById('exportFormatCancel');
  const confirmBtn = document.getElementById('exportFormatConfirm');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => tableViewer.closeExportFormatModal());
  }
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => tableViewer.confirmExportFormat());
  }
});

// Handle page cleanup
window.addEventListener('beforeunload', () => {
  if (tableViewer) {
    tableViewer.charts.forEach(chart => chart.destroy());
  }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TableViewer };
}