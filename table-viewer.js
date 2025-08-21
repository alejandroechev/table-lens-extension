class TableViewer {
  constructor() {
    this.tableData = null;
    this.tableInfo = null;
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
      newChartBtn: document.getElementById('newChartBtn')
    };
  }
  
  attachEventListeners() {
    this.elements.newChartBtn.addEventListener('click', () => this.createNewChart());
    
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
    
    this.updateHeader();
    this.renderDataTable();
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
      'markdown-selection': 'Markdown Selection'
    };
    return typeMap[type] || 'Table';
  }
  
  renderDataTable() {
    if (!this.tableData || this.tableData.length === 0) return;
    
    const headers = this.tableData[0];
    const rows = this.tableData.slice(1);
    
    // Create table headers
    this.elements.dataTableHead.innerHTML = '';
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.appendChild(th);
    });
    this.elements.dataTableHead.appendChild(headerRow);
    
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
    if (!this.tableData || !this.tableData[0]) return false;
    
    const columnName = this.tableData[0][columnIndex].toLowerCase();
    const numericKeywords = ['count', 'total', 'sum', 'avg', 'average', 'number', 'amount', 'value', 'price', 'cost', 'score', 'rate', 'percent'];
    
    return numericKeywords.some(keyword => columnName.includes(keyword)) || 
           /\d/.test(columnName) ||
           columnName.includes('%');
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
      elements.container.innerHTML = `<canvas id="${chartId}-canvas" width="800" height="400"></canvas>`;
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