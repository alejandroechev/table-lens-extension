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
      generateChart: document.getElementById('generateChart'),
      exportPNG: document.getElementById('exportPNG'),
      exportSVG: document.getElementById('exportSVG'),
      status: document.getElementById('status')
    };
  }
  
  attachEventListeners() {
    this.elements.scanTables.addEventListener('click', () => this.scanForTables());
    this.elements.generateChart.addEventListener('click', () => this.generateChart());
    this.elements.exportPNG.addEventListener('click', () => this.exportChart('png'));
    this.elements.exportSVG.addEventListener('click', () => this.exportChart('svg'));
    
    this.elements.chartType.addEventListener('change', () => this.updateChartOptions());
    this.elements.xColumn.addEventListener('change', () => this.validateChartInputs());
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
  
  renderTableList() {
    if (this.tables.length === 0) {
      this.elements.tableList.innerHTML = `
        <div class="no-tables">
          <p>No tables detected on this page</p>
          <button id="scanTables" class="btn btn-primary">Scan for Tables</button>
        </div>
      `;
      
      document.getElementById('scanTables').addEventListener('click', () => this.scanForTables());
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
        this.selectTable(index);
      });
    });
  }
  
  getTableTypeDisplay(type) {
    const typeMap = {
      'html': '🏷️ HTML Table',
      'csv': '📊 CSV Data',
      'csv-selection': '📊 CSV Selection',
      'markdown': '📝 Markdown Table',
      'markdown-selection': '📝 Markdown Selection'
    };
    
    return typeMap[type] || '📋 Table';
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
  }
});

// Initialize popup when DOM is loaded
let popupController;
document.addEventListener('DOMContentLoaded', () => {
  popupController = new PopupController();
});