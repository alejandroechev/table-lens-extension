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
        'monto','importe','pago','cargo','cargos','valor','precio','abono','saldo','deposito','retiro'
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
  const sampleSize = Math.min(rows.length, 30); // Sample first 30 rows
      let moneyCount = 0;
      let percentCount = 0;
      let dateCount = 0;
      let numericCount = 0;
  const numericSamples = [];
      
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
          // Capture numeric portion for format inference
          numericSamples.push(value);
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
          if (/^[+-]?[0-9][0-9.,]*$/.test(cleaned)) {
            numericSamples.push(value);
          }
          // Replace thousand separators and normalize decimal (fallback heuristic)
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
      let inferredType = 'categorical';
      if (moneyCount / totalValues > threshold || hasMoneyKeyword) {
        inferredType = 'money';
      } else if (percentCount / totalValues > threshold || hasPercentKeyword) {
        inferredType = 'percentage';
      } else if (dateCount / totalValues > threshold || hasDateKeyword) {
        inferredType = 'date';
      } else if (numericCount / totalValues > threshold || hasNumericKeyword || /\d/.test(headerName)) {
        inferredType = 'numeric';
      }
      if (['numeric','money','percentage'].includes(inferredType)) {
        const fmt = this.inferNumberFormat(numericSamples);
        this.numericFormatMap[colIndex] = fmt || { thousand: ',', decimal: '.' };
      }
      return inferredType;
    });
  }

  inferNumberFormat(samples) {
    if (!samples || samples.length === 0) return { thousand: ',', decimal: '.' };
    let dotDecimal = 0, commaDecimal = 0, spaceThousand = 0, dotThousand = 0, commaThousand = 0;
    for (const raw of samples.slice(0, 60)) {
      const v = String(raw).trim();
      const core = v.replace(/[\s\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]/g,'');
      if (/,\d{2}$/.test(core)) commaDecimal++;
      if (/\.\d{2}$/.test(core)) dotDecimal++;
      if (/\d\.\d{3}(?:[.,]|$)/.test(core)) dotThousand++;
      if (/\d,\d{3}(?:[.,]|$)/.test(core)) commaThousand++;
      if (/\d\s\d{3}(?:[.,]|$)/.test(core)) spaceThousand++;
    }
    let thousand = ',';
    let decimal = '.';
    const hasDecimalInfo = (dotDecimal + commaDecimal) > 0;
    if (hasDecimalInfo) {
      if (commaDecimal > dotDecimal) decimal = ','; else if (dotDecimal > commaDecimal) decimal = '.';
      const candidates = [];
      if (dotThousand) candidates.push({sep:'.', count:dotThousand});
      if (commaThousand) candidates.push({sep:',', count:commaThousand});
      if (spaceThousand) candidates.push({sep:' ', count:spaceThousand});
      candidates.sort((a,b)=>b.count-a.count);
      if (candidates.length) thousand = candidates[0].sep; else thousand = decimal === '.' ? ',' : '.';
      if (thousand === decimal) thousand = decimal === '.' ? ',' : '.';
    } else {
      // No decimal markers -> infer typical locale pairing
      if (dotThousand > 0 && commaThousand === 0) { thousand = '.'; decimal = ','; }
      else if (commaThousand > 0 && dotThousand === 0) { thousand = ','; decimal = '.'; }
      else if (spaceThousand > 0) { thousand = ' '; decimal = ','; }
    }
    return { thousand, decimal };
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
        const numericValues = values.map(v => this.parseNumericValue(v, columnIndex)).filter(v => !isNaN(v));
        
        switch (statFunction) {
          case 'count':
            result = numericValues.length;
            break;
          case 'sum':
            result = numericValues.reduce((a, b) => a + b, 0);
            if (columnType === 'money') result = result.toLocaleString();
            else if (columnType === 'percentage') result = result.toFixed(2) + '%';
            else result = result.toLocaleString();
            break;
          case 'avg':
            const avg = numericValues.length > 0 ? (numericValues.reduce((a, b) => a + b, 0) / numericValues.length) : 0;
            if (columnType === 'money') result = avg.toLocaleString();
            else if (columnType === 'percentage') result = avg.toFixed(2) + '%';
            else result = avg.toFixed(2);
            break;
          case 'min':
            const min = numericValues.length > 0 ? Math.min(...numericValues) : 0;
            if (columnType === 'money') result = min.toLocaleString();
            else if (columnType === 'percentage') result = min.toFixed(2) + '%';
            else result = min;
            break;
          case 'max':
            const max = numericValues.length > 0 ? Math.max(...numericValues) : 0;
            if (columnType === 'money') result = max.toLocaleString();
            else if (columnType === 'percentage') result = max.toFixed(2) + '%';
            else result = max;
            break;
          case 'std':
            if (numericValues.length > 1) {
              const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
              const variance = numericValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numericValues.length;
              const std = Math.sqrt(variance);
              if (columnType === 'money') result = std.toLocaleString();
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
      yCheckboxes: document.getElementById(`${chartId}-y`), // For multiple selection
      ySingle: document.getElementById(`${chartId}-y-single`), // For single selection
      container: document.getElementById(`${chartId}-container`),
      status: document.getElementById(`${chartId}-status`)
    };
    
    try {
      // Get configuration
      const chartType = elements.type.value;
      const chartDef = this.chartTypeDefinitions[chartType];
      const xColumn = parseInt(elements.xAxis.value);
      
      // Handle Y-axis columns based on chart type
      let yColumns = [];
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
    // Remove currency symbols and %
    let cleaned = str.replace(/[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]/g,'').replace(/%/g,'');
    // Remove thousand separators only when in thousand position (lookahead 3 digits)
    if (fmt.thousand) {
      const ts = fmt.thousand === ' ' ? /\s(?=\d{3}(?:\D|$))/g : new RegExp('(?<=\d)\\' + fmt.thousand + '(?=\d{3}(?:\D|$))','g');
      cleaned = cleaned.replace(ts,'');
    }
    if (fmt.decimal && fmt.decimal !== '.') {
      const decRegex = new RegExp('\\' + fmt.decimal + '(?=\d{1,4}$)');
      cleaned = cleaned.replace(decRegex, '.');
    }
    cleaned = cleaned.replace(/[^0-9+\-.]/g,'');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
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
    const headers = this.tableData[0];
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