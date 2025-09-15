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
  }
  
  attachEventListeners() {
    this.elements.newChartBtn.addEventListener('click', () => this.createNewChart());
    
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
      // Check header name for numeric keywords
      const headerName = header.toLowerCase();
      const numericKeywords = ['count', 'total', 'sum', 'avg', 'average', 'number', 'amount', 'value', 'price', 'cost', 'score', 'rate', 'percent', 'quantity', 'size', 'weight', 'height', 'width', 'length'];
      const hasNumericKeyword = numericKeywords.some(keyword => headerName.includes(keyword));
      
      if (hasNumericKeyword || /\d/.test(headerName) || headerName.includes('%')) {
        return 'numeric';
      }
      
      // Analyze actual data values
      const sampleSize = Math.min(rows.length, 20); // Sample first 20 rows
      let numericCount = 0;
      
      for (let i = 0; i < sampleSize; i++) {
        const value = rows[i][colIndex];
        if (value != null && value !== '') {
          const numValue = parseFloat(String(value).replace(/[$,%]/g, ''));
          if (!isNaN(numValue)) {
            numericCount++;
          }
        }
      }
      
      // If more than 70% of sampled values are numeric, consider it numeric
      return (numericCount / sampleSize) > 0.7 ? 'numeric' : 'categorical';
    });
  }
  
  initializeColumnStats() {
    this.columnStats = this.columnTypes.map(type => 
      type === 'numeric' ? 'count' : 'count'
    );
  }
  
  resetSort() {
    this.currentSort = { column: -1, direction: 'none' };
    this.filteredData = [...this.originalData];
    this.applyFilter(); // Reapply any active filters
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
      
      th.innerHTML = `
        ${header}
        <span class="category-indicator category-${columnType}">${columnType === 'numeric' ? 'NUM' : 'CAT'}</span>
      `;
      th.className = `sortable ${columnType}`;
      th.setAttribute('data-column', index);
      th.title = `${columnType.charAt(0).toUpperCase() + columnType.slice(1)} column - Click to sort`;
      
      // Add current sort indicator
      if (this.currentSort.column === index) {
        th.classList.add(`sort-${this.currentSort.direction}`);
      }
      
      // Add click listener for sorting
      th.addEventListener('click', () => this.sortTable(index));
      
      headerRow.appendChild(th);
    });
    this.elements.dataTableHead.appendChild(headerRow);
    
    // Create stats row
    const statsRow = document.createElement('tr');
    statsRow.className = 'stats-row';
    headers.forEach((header, index) => {
      const td = document.createElement('td');
      const columnType = this.columnTypes[index] || 'categorical';
      
      if (columnType === 'numeric') {
        td.innerHTML = `
          <select class="stat-select" data-column="${index}">
            <option value="count">Count</option>
            <option value="sum">Sum</option>
            <option value="avg">Average</option>
            <option value="min">Min</option>
            <option value="max">Max</option>
            <option value="std">Std Dev</option>
          </select>
          <div id="stat-result-${index}"></div>
        `;
        const select = td.querySelector('.stat-select');
        select.value = this.columnStats[index] || 'count';
        select.addEventListener('change', (e) => this.updateColumnStat(index, e.target.value));
      } else {
        td.innerHTML = `
          <select class="stat-select" data-column="${index}">
            <option value="count">Count</option>
            <option value="unique">Unique</option>
            <option value="mode">Mode</option>
          </select>
          <div id="stat-result-${index}"></div>
        `;
        const select = td.querySelector('.stat-select');
        select.value = this.columnStats[index] || 'count';
        select.addEventListener('change', (e) => this.updateColumnStat(index, e.target.value));
      }
      
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
      if (columnType === 'numeric') {
        const numericValues = values.map(v => parseFloat(String(v).replace(/[$,%]/g, ''))).filter(v => !isNaN(v));
        
        switch (statFunction) {
          case 'count':
            result = numericValues.length;
            break;
          case 'sum':
            result = numericValues.reduce((a, b) => a + b, 0).toLocaleString();
            break;
          case 'avg':
            result = numericValues.length > 0 ? (numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(2) : 0;
            break;
          case 'min':
            result = numericValues.length > 0 ? Math.min(...numericValues) : 0;
            break;
          case 'max':
            result = numericValues.length > 0 ? Math.max(...numericValues) : 0;
            break;
          case 'std':
            if (numericValues.length > 1) {
              const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
              const variance = numericValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numericValues.length;
              result = Math.sqrt(variance).toFixed(2);
            } else {
              result = 0;
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
            if (modes.length > 1) result += ` (+${modes.length - 1} more)`;
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
      
      if (columnType === 'numeric') {
        // Numeric comparison
        const aNum = parseFloat(String(aVal).replace(/[$,%]/g, '')) || 0;
        const bNum = parseFloat(String(bVal).replace(/[$,%]/g, '')) || 0;
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
    return this.columnTypes && this.columnTypes[columnIndex] === 'numeric';
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