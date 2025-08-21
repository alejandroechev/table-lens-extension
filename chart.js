class ChartViewer {
  constructor() {
    console.log('ChartViewer constructor called');
    this.chart = null;
    this.chartData = null;
    this.chartConfig = null;
    
    this.initializeElements();
    this.attachEventListeners();
    
    // Listen for messages from content script
    window.addEventListener('message', (event) => {
      console.log('Chart viewer received message:', event.data);
      if (event.data.type === 'INIT_CHART') {
        console.log('Initializing chart with config:', event.data.config);
        this.initChart(event.data.config);
      } else if (event.data.type === 'UPDATE_CHART') {
        console.log('Updating chart with config:', event.data.config);
        this.updateChart(event.data.config);
      }
    });
    
    // Show ready state
    this.elements.chartTypeBadge.textContent = '⏳ Ready';
    this.elements.dataInfo.textContent = 'Waiting for table data...';
    
    // Signal to parent that we're ready
    if (window.opener) {
      console.log('Signaling ready to parent window');
      window.opener.postMessage({ type: 'CHART_READY' }, '*');
    }
  }
  
  initializeElements() {
    this.elements = {
      chart: document.getElementById('chart'),
      chartTypeBadge: document.getElementById('chartTypeBadge'),
      dataInfo: document.getElementById('dataInfo'),
      exportPNG: document.getElementById('exportPNG'),
      exportSVG: document.getElementById('exportSVG'),
      showData: document.getElementById('showData'),
      dataTable: document.getElementById('dataTable'),
      sourceDataTable: document.getElementById('sourceDataTable')
    };
  }
  
  attachEventListeners() {
    this.elements.exportPNG.addEventListener('click', () => this.exportChart('png'));
    this.elements.exportSVG.addEventListener('click', () => this.exportChart('svg'));
    this.elements.showData.addEventListener('click', () => this.toggleDataTable());
  }
  
  initChart(config) {
    console.log('initChart called with:', config);
    try {
      // Destroy existing chart if it exists
      if (this.chart) {
        console.log('Destroying existing chart...');
        this.chart.destroy();
        this.chart = null;
      }
      
      this.chartConfig = config;
      this.processData();
      this.createChart();
      this.updateUI();
      this.renderDataTable();
      console.log('Chart initialization completed successfully');
    } catch (error) {
      console.error('Error initializing chart:', error);
      this.showError('Error creating chart: ' + error.message);
    }
  }
  
  updateChart(config) {
    this.chartConfig = config;
    this.processData();
    
    if (this.chart) {
      console.log('Destroying existing chart for update...');
      this.chart.destroy();
      this.chart = null;
    }
    
    this.createChart();
    this.updateUI();
    this.renderDataTable();
  }
  
  processData() {
    const { data, xColumn, yColumns, chartType } = this.chartConfig;
    
    if (!data || data.length < 2) {
      throw new Error('Insufficient data for chart generation');
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
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
    
    this.chartData = {
      labels: labels,
      datasets: datasets
    };
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
    // Simple color darkening
    const hex = color.replace('#', '');
    const rgb = [
      parseInt(hex.substr(0, 2), 16),
      parseInt(hex.substr(2, 2), 16),
      parseInt(hex.substr(4, 2), 16)
    ];
    
    const darkened = rgb.map(c => Math.floor(c * (1 - factor)));
    
    return `#${darkened.map(c => c.toString(16).padStart(2, '0')).join('')}`;
  }
  
  createChart() {
    console.log('Creating chart...');
    
    if (typeof Chart === 'undefined') {
      throw new Error('Chart.js library is not loaded');
    }
    
    // Ensure any existing chart is destroyed first
    if (this.chart) {
      console.log('Warning: Found existing chart, destroying it first');
      this.chart.destroy();
      this.chart = null;
    }
    
    const ctx = this.elements.chart.getContext('2d');
    const { chartType } = this.chartConfig;
    
    console.log('Chart type:', chartType);
    console.log('Chart data:', this.chartData);
    
    // Chart.js configuration
    const config = {
      type: chartType === 'horizontalBar' ? 'bar' : chartType,
      data: this.chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: this.generateChartTitle(),
            font: {
              size: 16,
              weight: 'bold'
            },
            padding: 20
          },
          legend: {
            display: chartType !== 'pie' && chartType !== 'doughnut' || this.chartData.datasets.length > 1,
            position: chartType === 'pie' || chartType === 'doughnut' ? 'right' : 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
                return `${label}: ${this.formatValue(value)}`;
              }
            }
          }
        },
        scales: this.getScaleConfig(chartType),
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        }
      }
    };
    
    // Special handling for horizontal bar charts
    if (chartType === 'horizontalBar') {
      config.options.indexAxis = 'y';
    }
    
    console.log('Chart config:', config);
    
    try {
      this.chart = new Chart(ctx, config);
      console.log('Chart created successfully:', this.chart);
    } catch (error) {
      if (error.message.includes('Canvas is already in use')) {
        console.log('Canvas reuse error, attempting to reset canvas...');
        this.resetCanvas();
        const newCtx = this.elements.chart.getContext('2d');
        this.chart = new Chart(newCtx, config);
        console.log('Chart created after canvas reset:', this.chart);
      } else {
        console.error('Error creating Chart.js instance:', error);
        throw error;
      }
    }
  }
  
  getScaleConfig(chartType) {
    if (chartType === 'pie' || chartType === 'doughnut') {
      return {}; // No scales for pie charts
    }
    
    const isHorizontal = chartType === 'horizontalBar';
    
    return {
      x: {
        display: true,
        title: {
          display: true,
          text: this.getAxisLabel('x')
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: this.getAxisLabel('y')
        },
        beginAtZero: true,
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    };
  }
  
  getAxisLabel(axis) {
    if (!this.chartConfig) return '';
    
    const { data, xColumn, yColumns } = this.chartConfig;
    const headers = data[0] || [];
    
    if (axis === 'x') {
      return headers[xColumn] || 'X-Axis';
    } else {
      if (yColumns.length === 1) {
        return headers[yColumns[0]] || 'Y-Axis';
      }
      return 'Values';
    }
  }
  
  generateChartTitle() {
    if (!this.chartConfig) return 'Chart';
    
    const { chartType, data, xColumn, yColumns } = this.chartConfig;
    const headers = data[0] || [];
    
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
  
  formatValue(value) {
    if (typeof value !== 'number') return value;
    
    // Format numbers with appropriate decimal places
    if (value % 1 === 0) {
      return value.toLocaleString();
    }
    
    return value.toFixed(2).replace(/\.?0+$/, '');
  }
  
  updateUI() {
    const { chartType, data, yColumns } = this.chartConfig;
    
    // Update chart type badge
    const chartTypeNames = {
      line: '📈 Line Chart',
      bar: '📊 Bar Chart',
      pie: '🥧 Pie Chart',
      doughnut: '🍩 Doughnut Chart',
      horizontalBar: '📊 Horizontal Bar Chart'
    };
    
    this.elements.chartTypeBadge.textContent = chartTypeNames[chartType] || 'Chart';
    
    // Update data info
    const rowCount = data.length - 1; // Exclude header
    const colCount = yColumns.length;
    this.elements.dataInfo.textContent = `${rowCount} rows, ${colCount} data series`;
  }
  
  renderDataTable() {
    if (!this.chartConfig) return;
    
    const { data } = this.chartConfig;
    const table = this.elements.sourceDataTable;
    
    // Clear existing content
    table.querySelector('thead').innerHTML = '';
    table.querySelector('tbody').innerHTML = '';
    
    if (data.length === 0) return;
    
    // Create header
    const headerRow = document.createElement('tr');
    data[0].forEach(header => {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.appendChild(th);
    });
    table.querySelector('thead').appendChild(headerRow);
    
    // Create body rows
    data.slice(1).forEach(row => {
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      });
      table.querySelector('tbody').appendChild(tr);
    });
  }
  
  toggleDataTable() {
    const isVisible = this.elements.dataTable.style.display !== 'none';
    this.elements.dataTable.style.display = isVisible ? 'none' : 'block';
    this.elements.showData.textContent = isVisible ? '📋 Show Data' : '📋 Hide Data';
  }
  
  async exportChart(format) {
    if (!this.chart) return;
    
    try {
      let dataUrl;
      let filename;
      
      if (format === 'png') {
        dataUrl = this.chart.toBase64Image('image/png', 1.0);
        filename = `chart-${Date.now()}.png`;
      } else if (format === 'svg') {
        // For SVG, we need to create an SVG version
        // This is a simplified approach - Chart.js doesn't natively support SVG export
        const canvas = this.elements.chart;
        const ctx = canvas.getContext('2d');
        
        // Convert canvas to SVG (simplified)
        const svgData = this.canvasToSVG(canvas);
        dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
        filename = `chart-${Date.now()}.svg`;
      }
      
      // Send export message to parent window
      window.parent.postMessage({
        type: 'CHART_EXPORT',
        format: format,
        data: dataUrl,
        filename: filename
      }, '*');
      
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting chart. Please try again.');
    }
  }
  
  canvasToSVG(canvas) {
    // Simplified canvas to SVG conversion
    const width = canvas.width;
    const height = canvas.height;
    const dataUrl = canvas.toDataURL('image/png');
    
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <image href="${dataUrl}" width="${width}" height="${height}"/>
      </svg>
    `;
  }
  
  showError(message) {
    const chartContainer = document.querySelector('.chart-container');
    chartContainer.innerHTML = `
      <div class="error">
        <h3>❌ Chart Error</h3>
        <p>${message}</p>
        <p><small>Check the browser console for more details.</small></p>
      </div>
    `;
  }
  
  resetCanvas() {
    // Reset canvas by recreating it
    const oldCanvas = this.elements.chart;
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'chart';
    newCanvas.width = 800;
    newCanvas.height = 400;
    
    oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
    this.elements.chart = newCanvas;
    console.log('Canvas reset');
  }
}

// Initialize chart viewer when page loads
let chartViewer;
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, Chart.js available:', typeof Chart !== 'undefined');
  console.log('Chart object:', typeof Chart !== 'undefined' ? Chart : 'undefined');
  chartViewer = new ChartViewer();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  console.log('Chart window unloading, cleaning up...');
  if (chartViewer && chartViewer.chart) {
    chartViewer.chart.destroy();
    chartViewer.chart = null;
  }
});

// Handle page visibility change (when window loses focus)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('Chart window hidden');
  } else {
    console.log('Chart window visible');
  }
});