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
      newChartBtn: document.getElementById('newChartBtn'),
      // Data controls
      filterColumn: document.getElementById('filterColumn'),
      filterValue: document.getElementById('filterValue'),
      clearFilter: document.getElementById('clearFilter'),
      resetSort: document.getElementById('resetSort'),
      exportCSV: document.getElementById('exportCSV'),
      exportTSV: document.getElementById('exportTSV')
    };
    
    // Initialize theme
    this.initializeTheme();
  }
  
  attachEventListeners() {
    this.elements.newChartBtn.addEventListener('click', () => this.createNewChart());
    this.elements.themeToggle?.addEventListener('click', () => this.toggleTheme());
    
    // Data controls
    this.elements.filterValue.addEventListener('input', () => this.applyFilter());
    this.elements.filterColumn.addEventListener('change', () => this.applyFilter());
    this.elements.clearFilter.addEventListener('click', () => this.clearFilter());
    this.elements.resetSort.addEventListener('click', () => this.resetSort());
    this.elements.exportCSV.addEventListener('click', () => this.exportData('csv'));
    this.elements.exportTSV.addEventListener('click', () => this.exportData('tsv'));
    
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
      }
    });
  }
  
  loadTableData() {
    // Signal to parent that we're ready
    if (window.opener) {
      console.log('Requesting table data from parent');
      window.opener.postMessage({ type: 'REQUEST_TABLE_DATA' }, '*');
    }
    
    // Fallback: get from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const tableIndex = urlParams.get('table');
    if (tableIndex !== null) {
      console.log('Getting table data from URL parameter:', tableIndex);
      // This would require passing data through URL, which has limitations
      // Better to use postMessage approach above
    }
  }
  
  handleTableData(data) {
    this.tableData = data.tableData;
    this.tableInfo = data.tableInfo;
    this.originalData = [...this.tableData]; // Store original order
    this.filteredData = [...this.tableData];
    
    this.analyzeColumnTypes();
    this.initializeColumnStats();
    this.updateHeader();
    this.renderDataTable();
    this.setupDataControls();
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
    
    const headers = this.tableData[0];
    const rows = this.tableData.slice(1);
    
    this.columnTypes = headers.map((header, colIndex) => {
      // Check header name for specific type keywords
      const headerName = header.toLowerCase();
      
      // Money/Currency detection
      const moneyKeywords = [
        'price','cost','amount','salary','wage','revenue','budget','expense','payment','fee','bill','total','subtotal','tax','discount','refund','balance','debt','income','profit','loss',
        // Spanish / intl synonyms
        'monto','importe','pago','cargo','valor','precio'
      ];
      const hasMoneyKeyword = moneyKeywords.some(keyword => headerName.includes(keyword));
      
      // Percentage detection
      const percentKeywords = ['percent', 'percentage', 'rate', 'ratio', 'proportion', 'share', 'growth', 'change', 'increase', 'decrease', 'margin', 'roi', 'apy', 'apr', 'tax rate', 'interest'];
      const hasPercentKeyword = percentKeywords.some(keyword => headerName.includes(keyword)) || headerName.includes('%');
      
      // Date detection
      const dateKeywords = [
        'date','time','created','updated','modified','birth','start','end','deadline','due','expiry','timestamp','when','day','month','year',
        // Spanish
        'fecha','creado','actualizado'
      ];
      const hasDateKeyword = dateKeywords.some(keyword => headerName.includes(keyword));
      
      // Numeric detection
      const numericKeywords = ['count', 'sum', 'avg', 'average', 'number', 'value', 'score', 'quantity', 'size', 'weight', 'height', 'width', 'length', 'volume', 'area', 'distance', 'speed', 'temperature'];
      const hasNumericKeyword = numericKeywords.some(keyword => headerName.includes(keyword));
      
      // Analyze actual data values for better detection
      const sampleSize = Math.min(rows.length, 20); // Sample first 20 rows
      let moneyCount = 0;
      let percentCount = 0;
      let dateCount = 0;
      let numericCount = 0;
      
      for (let i = 0; i < sampleSize; i++) {
        const raw = rows[i][colIndex];
        const value = String(raw == null ? '' : raw).trim();
        if (value === '') continue;
        
        // Money pattern detection (extended for locale formats: thousand separators '.', space, comma decimals, currency code suffix/prefix)
        // Examples to match: "$ 113.100", "$3.408", "1.234,56 €", "EUR 1 234,56", "CLP 12.345", "12.345 CLP"
        const moneyPatterns = [
          /^[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]?\s*[+-]?[\d\.\s,]+\d(?:[,\.]\d{2})?\s*[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]?$/, // generic with symbol
          /^[+-]?[\d\.\s]+(?:,\d{2})?\s*(usd|eur|gbp|jpy|cad|aud|chf|cny|inr|clp|mxn|ars|cop|brl|dkk|sek|nok|chf|zar)$/i,
          /^(usd|eur|gbp|jpy|cad|aud|chf|cny|inr|clp|mxn|ars|cop|brl|dkk|sek|nok|chf|zar)\s+[+-]?[\d\.\s]+(?:,\d{2})?$/i
        ];
        if (moneyPatterns.some(r => r.test(value))) {
          moneyCount++;
        }
        
        // Percentage pattern detection
        else if (/^\d+\.?\d*\s*%$/.test(value) || 
                 (hasPercentKeyword && /^\d+\.?\d*$/.test(value) && parseFloat(value) <= 100)) {
          percentCount++;
        }
        
        // Date pattern detection
        else {
          const datePatterns = [
            /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/ ,          // 12/09/2025 or 12-09-25
            /^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/ ,            // 2025-09-12
            /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i, // Sep 12 2025
            /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}$/i,  // 12 Sep 2025
            /^\d{1,2}-[A-Za-z]{3}-\d{4}$/ ,                  // 12-Sep-2025
            /^\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4}$/i  // 12 de septiembre de 2025 (basic Spanish)
          ];
          if (datePatterns.some(r => r.test(value)) || !isNaN(Date.parse(value))) {
          dateCount++;
            continue;
          }
          // General numeric detection (strip currency symbols, spaces)
          const cleaned = value.replace(/[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9\s]/g,'');
          // Replace thousand separators and normalize decimal
          const normalized = cleaned.match(/,\d{2}$/) ? cleaned.replace(/\./g,'').replace(',','.') : cleaned.replace(/,/g,'');
          if (!isNaN(parseFloat(normalized))) {
            // If it had a currency symbol but patterns failed, still treat as money
            if (/^[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]/.test(value)) moneyCount++; else numericCount++;
          }
        }
      }
      
      const totalValues = sampleSize;
      const threshold = 0.7; // 70% threshold for type detection
      
      // Priority-based type assignment
      if (moneyCount / totalValues > threshold || hasMoneyKeyword) {
        return 'money';
      } else if (percentCount / totalValues > threshold || hasPercentKeyword) {
        return 'percentage';
      } else if (dateCount / totalValues > threshold || hasDateKeyword) {
        return 'date';
      } else if (numericCount / totalValues > threshold || hasNumericKeyword || /\d/.test(headerName)) {
        return 'numeric';
      } else {
        return 'categorical';
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

    // Button handlers
    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    const applyBtn = modal.querySelector('[data-action="apply"]');
    cancelBtn.addEventListener('click', () => modal.remove());
    applyBtn.addEventListener('click', () => this.applyColumnTypeChange(columnIndex, modal));
  }
  
  applyColumnTypeChange(columnIndex, modal) {
    const selectedType = modal.querySelector('input[name="columnType"]:checked')?.value;
    if (selectedType && selectedType !== this.columnTypes[columnIndex]) {
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
      
      // Re-render the table with new types
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
  }
  
  setupDataControls() {
    if (!this.tableData || this.tableData.length === 0) return;
    
    const headers = this.tableData[0];
    
    // Populate filter column dropdown
    this.elements.filterColumn.innerHTML = '<option value="">All columns</option>';
    headers.forEach((header, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = header;
      this.elements.filterColumn.appendChild(option);
    });
  }
  
  applyFilter() {
    if (!this.originalData) return;
    
    const filterColumn = this.elements.filterColumn.value;
    const filterValue = this.elements.filterValue.value.toLowerCase().trim();
    
    if (!filterValue) {
      this.filteredData = [...this.originalData];
    } else {
      const headers = this.originalData[0];
      const rows = this.originalData.slice(1);
      
      const filteredRows = rows.filter(row => {
        if (filterColumn === '') {
          // Search all columns
          return row.some(cell => 
            cell && cell.toString().toLowerCase().includes(filterValue)
          );
        } else {
          // Search specific column
          const columnIndex = parseInt(filterColumn);
          const cell = row[columnIndex];
          return cell && cell.toString().toLowerCase().includes(filterValue);
        }
      });
      
      this.filteredData = [headers, ...filteredRows];
    }
    
    // Reapply current sort if any
    if (this.currentSort.column !== -1 && this.currentSort.direction !== 'none') {
      this.sortTable(this.currentSort.column, this.currentSort.direction);
    } else {
      this.renderDataTable();
    }
  }
  
  clearFilter() {
    this.elements.filterColumn.value = '';
    this.elements.filterValue.value = '';
    this.filteredData = [...this.originalData];
    this.renderDataTable();
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
      if (columnType === 'numeric' || columnType === 'money' || columnType === 'percentage') {
        const numericValues = values.map(v => {
          const cleaned = String(v).replace(/[$,%\u00A3\u20AC\u00A5\u20B9]/g, '');
          return parseFloat(cleaned);
        }).filter(v => !isNaN(v));
        
        switch (statFunction) {
          case 'count':
            result = numericValues.length;
            break;
          case 'sum':
            result = numericValues.reduce((a, b) => a + b, 0);
            if (columnType === 'money') result = result.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            else if (columnType === 'percentage') result = result.toFixed(2) + '%';
            else result = result.toLocaleString();
            break;
          case 'avg':
            const avg = numericValues.length > 0 ? (numericValues.reduce((a, b) => a + b, 0) / numericValues.length) : 0;
            if (columnType === 'money') result = avg.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            else if (columnType === 'percentage') result = avg.toFixed(2) + '%';
            else result = avg.toFixed(2);
            break;
          case 'min':
            const min = numericValues.length > 0 ? Math.min(...numericValues) : 0;
            if (columnType === 'money') result = min.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            else if (columnType === 'percentage') result = min.toFixed(2) + '%';
            else result = min;
            break;
          case 'max':
            const max = numericValues.length > 0 ? Math.max(...numericValues) : 0;
            if (columnType === 'money') result = max.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            else if (columnType === 'percentage') result = max.toFixed(2) + '%';
            else result = max;
            break;
          case 'std':
            if (numericValues.length > 1) {
              const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
              const variance = numericValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numericValues.length;
              const std = Math.sqrt(variance);
              if (columnType === 'money') result = std.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
              else if (columnType === 'percentage') result = std.toFixed(2) + '%';
              else result = std.toFixed(2);
            } else {
              result = 0;
            }
            break;
        }
      } else if (columnType === 'date') {
        const dateValues = values.map(v => new Date(v)).filter(d => !isNaN(d.getTime()));
        
        switch (statFunction) {
          case 'count':
            result = dateValues.length;
            break;
          case 'unique':
            result = new Set(values).size;
            break;
          case 'mode':
            const frequency = {};
            values.forEach(val => {
              frequency[val] = (frequency[val] || 0) + 1;
            });
            const maxCount = Math.max(...Object.values(frequency));
            const modes = Object.keys(frequency).filter(key => frequency[key] === maxCount);
            result = modes[0] || 'N/A';
            if (modes.length > 1) result += ` (+${modes.length - 1})`;
            break;
          case 'earliest':
            result = dateValues.length > 0 ? new Date(Math.min(...dateValues)).toLocaleDateString() : 'N/A';
            break;
          case 'latest':
            result = dateValues.length > 0 ? new Date(Math.max(...dateValues)).toLocaleDateString() : 'N/A';
            break;
          case 'range':
            if (dateValues.length > 1) {
              const earliest = new Date(Math.min(...dateValues));
              const latest = new Date(Math.max(...dateValues));
              const diffTime = Math.abs(latest - earliest);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              result = `${diffDays} days`;
            } else {
              result = 'N/A';
            }
            break;
        }
      } else {
        // Categorical column
        switch (statFunction) {
          case 'count':
            result = values.length;
            break;
          case 'unique':
            result = new Set(values).size;
            break;
          case 'mode':
            const frequency = {};
            values.forEach(val => {
              frequency[val] = (frequency[val] || 0) + 1;
            });
            const maxCount = Math.max(...Object.values(frequency));
            const modes = Object.keys(frequency).filter(key => frequency[key] === maxCount);
            result = modes[0] || 'N/A';
            if (modes.length > 1) result += ` (+${modes.length - 1})`;
            break;
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
        // Normalize numeric-like values (handle locale thousands/decimals & currency)
        const parseNum = (v) => {
          const str = String(v).trim();
          if (!str) return 0;
          // Remove currency symbols & spaces
            let cleaned = str.replace(/[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9\s]/g,'');
            // If comma used as decimal (pattern 1.234,56)
            if (/,\d{1,2}$/.test(cleaned) && /\./.test(cleaned)) {
              cleaned = cleaned.replace(/\./g,'').replace(',','.');
            } else {
              cleaned = cleaned.replace(/,/g,'');
            }
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
        };
        const aNum = parseNum(aVal);
        const bNum = parseNum(bVal);
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
    
    const separator = format === 'tsv' ? '\t' : ',';
    const extension = format === 'tsv' ? 'tsv' : 'csv';
    const mimeType = format === 'tsv' ? 'text/tab-separated-values' : 'text/csv';
    
    // Convert data to CSV/TSV format
    const csvContent = this.filteredData.map(row => 
      row.map(cell => {
        // Escape quotes and wrap in quotes if necessary
        const cellStr = (cell || '').toString();
        if (cellStr.includes(separator) || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(separator)
    ).join('\n');
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const fileName = `table-data-${new Date().toISOString().split('T')[0]}.${extension}`;
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Show success message
    this.showGlobalStatus(`Data exported as ${extension.toUpperCase()} successfully!`, 'success');
  }
  
  createNewChart() {
    const chartId = `chart-${++this.chartCounter}`;
    const chartName = `Chart ${this.chartCounter}`;
    
    // Create tab
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.setAttribute('data-tab', chartId);
    tab.innerHTML = `
      📈 ${chartName}
      <span class="close-btn" title="Close chart">×</span>
    `;
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
    const headers = this.tableData ? this.tableData[0] : [];
    
    return `
      <div class="status-message" id="${chartId}-status" style="display: none;"></div>
      
      <div class="chart-controls">
        <div class="form-row">
          <div class="form-group">
            <label for="${chartId}-type">Chart Type:</label>
            <select id="${chartId}-type" class="form-control">
              <option value="line">📈 Line Chart</option>
              <option value="bar">📊 Bar Chart</option>
              <option value="pie">🥧 Pie Chart</option>
              <option value="doughnut">🍩 Doughnut Chart</option>
              <option value="horizontalBar">📊 Horizontal Bar</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="${chartId}-x">X-Axis Column:</label>
            <select id="${chartId}-x" class="form-control">
              <option value="">Select column...</option>
              ${headers.map((header, index) => 
                `<option value="${index}">${header}</option>`
              ).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <button id="${chartId}-generate" class="btn btn-primary" disabled>Generate Chart</button>
          </div>
        </div>
        
        <div class="form-group">
          <label>Y-Axis Columns:</label>
          <div class="checkbox-group" id="${chartId}-y">
            ${headers.map((header, index) => `
              <div class="checkbox-item">
                <input type="checkbox" id="${chartId}-col-${index}" value="${index}">
                <label for="${chartId}-col-${index}">${header}</label>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      
      <div class="chart-container" id="${chartId}-container">
        <div class="chart-export-buttons">
          <button class="export-btn" onclick="tableViewer.exportChart('${chartId}', 'png')">PNG</button>
          <button class="export-btn" onclick="tableViewer.exportChart('${chartId}', 'svg')">SVG</button>
        </div>
        <div class="chart-placeholder">
          Configure chart options above and click "Generate Chart" to create your visualization.
        </div>
      </div>
    `;
  }
  
  initializeChartControls(chartId) {
    const elements = {
      type: document.getElementById(`${chartId}-type`),
      xAxis: document.getElementById(`${chartId}-x`),
      yCheckboxes: document.getElementById(`${chartId}-y`),
      generate: document.getElementById(`${chartId}-generate`),
      container: document.getElementById(`${chartId}-container`),
      status: document.getElementById(`${chartId}-status`)
    };
    
    // Validation function
    const validateInputs = () => {
      const hasX = elements.xAxis.value !== '';
      const hasY = elements.yCheckboxes.querySelectorAll('input:checked').length > 0;
      elements.generate.disabled = !hasX || !hasY;
    };
    
    // Event listeners
    elements.xAxis.addEventListener('change', validateInputs);
    elements.yCheckboxes.addEventListener('change', validateInputs);
    
    elements.generate.addEventListener('click', () => {
      this.generateChart(chartId);
    });
    
    // Auto-select suggestions
    this.autoSelectChartColumns(chartId);
  }
  
  autoSelectChartColumns(chartId) {
    if (!this.tableData) return;
    
    const headers = this.tableData[0];
    const xSelect = document.getElementById(`${chartId}-x`);
    const yCheckboxes = document.getElementById(`${chartId}-y`);
    
    // Auto-select first column as X-axis if it looks like labels
    if (headers.length > 0 && !this.isNumericColumn(0)) {
      xSelect.value = '0';
    }
    
    // Auto-select numeric columns for Y-axis
    headers.forEach((header, index) => {
      if (this.isNumericColumn(index)) {
        const checkbox = document.getElementById(`${chartId}-col-${index}`);
        if (checkbox) {
          checkbox.checked = true;
        }
      }
    });
    
    // Trigger validation
    xSelect.dispatchEvent(new Event('change'));
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
  
  generateChart(chartId) {
    console.log('Generating chart:', chartId);
    
    const elements = {
      type: document.getElementById(`${chartId}-type`),
      xAxis: document.getElementById(`${chartId}-x`),
      yCheckboxes: document.getElementById(`${chartId}-y`),
      container: document.getElementById(`${chartId}-container`),
      status: document.getElementById(`${chartId}-status`)
    };
    
    try {
      // Get configuration
      const chartType = elements.type.value;
      const xColumn = parseInt(elements.xAxis.value);
      const yColumns = Array.from(elements.yCheckboxes.querySelectorAll('input:checked'))
        .map(cb => parseInt(cb.value));
      
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
      
    } catch (error) {
      console.error('Error generating chart:', error);
      this.showStatus(chartId, `Error generating chart: ${error.message}`, 'error');
    }
  }
  
  processChartData(xColumn, yColumns, chartType) {
    const headers = this.tableData[0];
    const rows = this.tableData.slice(1);
    
    // Extract labels (X-axis data)
    const labels = rows.map(row => row[xColumn] || '');
    
    // Extract datasets (Y-axis data)
    const datasets = yColumns.map((yCol, index) => {
      const columnName = headers[yCol] || `Column ${yCol + 1}`;
      const values = rows.map(row => {
        const value = row[yCol];
        return this.parseNumericValue(value);
      });
      
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
  
  parseNumericValue(value) {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    
    // Remove common non-numeric characters
    const cleaned = String(value).replace(/[$,%]/g, '');
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? 0 : parsed;
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
    const headers = this.tableData[0];
    
    return {
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
  }
  
  generateChartTitle(chartType, xColumn, yColumns) {
    const headers = this.tableData[0];
    const chartTypeNames = {
      line: 'Line Chart',
      bar: 'Bar Chart', 
      pie: 'Pie Chart',
      doughnut: 'Doughnut Chart',
      horizontalBar: 'Horizontal Bar Chart'
    };
    
    const xLabel = headers[xColumn] || 'Category';
    const yLabels = yColumns.map(col => headers[col] || `Data ${col + 1}`);
    
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
        right: 20px;
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
  }
}

// Initialize when page loads
let tableViewer;
document.addEventListener('DOMContentLoaded', () => {
  tableViewer = new TableViewer();
});

// Handle page cleanup
window.addEventListener('beforeunload', () => {
  if (tableViewer) {
    tableViewer.charts.forEach(chart => chart.destroy());
  }
});