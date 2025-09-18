/**
 * Table State Management Utility
 * Handles persistence and restoration of table viewer state in session storage
 */

class TableStateManager {
  constructor(tableId) {
    this.tableId = tableId;
    this.storageKey = `tableLens_state_${tableId}`;
    // Prefer localStorage so state survives closing the viewer window; fallback to sessionStorage; final fallback to in-memory store
    this.memoryStore = {};
    this.storage = this._resolveStorage();
  }

  _resolveStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    } catch (_) { /* ignore */ }
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
    } catch (_) { /* ignore */ }
    // Fallback simple storage interface
    return {
      getItem: (k) => this.memoryStore[k] || null,
      setItem: (k, v) => { this.memoryStore[k] = v; },
      removeItem: (k) => { delete this.memoryStore[k]; }
    };
  }

  /**
   * Build a full state snapshot (without persisting) so callers can decide how to store it.
   * Includes tableData for portable named saves (cross-page loading) – not stored in the
   * lightweight auto state previously.
   */
  generateState(tableViewer) {
    if (!tableViewer) return null;
    try {
      return {
        tableId: this.tableId,
        timestamp: Date.now(),
        // Core table structure
        tableData: Array.isArray(tableViewer.tableData) ? tableViewer.tableData.map(r => [...r]) : [],
        // Column configuration
        columnTypes: [...(tableViewer.columnTypes || [])],
        columnStats: [...(tableViewer.columnStats || [])],
        numericFormatMap: { ...(tableViewer.numericFormatMap || {}) },
        // Sorting & filters
        currentSort: { ...(tableViewer.currentSort || { column: -1, direction: 'none' }) },
        activeFilters: this.extractActiveFilters(),
        savedFilters: tableViewer.savedFilters ? { ...tableViewer.savedFilters } : {},
        // Charts (full serialization incl. axis selections)
        charts: this.serializeCharts(tableViewer.charts || new Map()),
        chartCounter: tableViewer.chartCounter || 0,
        // UI
        activeTab: this.getActiveTabId(),
        theme: typeof document !== 'undefined' ? (document.body.getAttribute('data-theme') || 'light') : 'light',
        // Meta
        tableInfo: tableViewer.tableInfo ? { ...tableViewer.tableInfo } : null,
        dataFingerprint: this.generateDataFingerprint(tableViewer.tableData)
      };
    } catch (e) {
      console.error('Failed to generate state snapshot:', e);
      return null;
    }
  }

  /**
   * Save complete table viewer state to session storage
   */
  saveState(tableViewer) {
    try {
      const state = this.generateState(tableViewer);
      if (!state) throw new Error('State generation failed');

      this.storage.setItem(this.storageKey, JSON.stringify(state));
      console.log(`💾 Table state saved for ${this.tableId}:`, Object.keys(state));
      return true;
    } catch (error) {
      console.error('Failed to save table state:', error);
      return false;
    }
  }

  /**
   * Restore table viewer state from session storage
   */
  loadState() {
    try {
      let stateStr = this.storage.getItem(this.storageKey);
      // Migration: if using old sessionStorage-only approach and nothing in localStorage, attempt to pull from sessionStorage explicitly
      if (!stateStr) {
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            const legacy = window.sessionStorage.getItem(this.storageKey);
            if (legacy) {
              console.log(`↪️ Migrating legacy session state for ${this.tableId} to persistent storage`);
              this.storage.setItem(this.storageKey, legacy);
              window.sessionStorage.removeItem(this.storageKey);
              stateStr = legacy;
            }
          }
        } catch (_) {/* ignore */}
      }
      if (!stateStr) {
        console.log(`No saved state found for table ${this.tableId}`);
        return null;
      }

      const state = JSON.parse(stateStr);
      
      // Check if state is recent (within 24 hours)
      const ageHours = (Date.now() - state.timestamp) / (1000 * 60 * 60);
      if (ageHours > 24) {
        console.log(`State for ${this.tableId} is too old (${ageHours.toFixed(1)}h), clearing`);
        this.clearState();
        return null;
      }

      console.log(`📂 Loading saved state for ${this.tableId}:`, Object.keys(state));
      return state;
    } catch (error) {
      console.error('Failed to load table state:', error);
      return null;
    }
  }

  /**
   * Apply loaded state to table viewer instance
   */
  applyState(tableViewer, state) {
    if (!state || !tableViewer) return false;

    try {
      // Validate data compatibility
      const currentFingerprint = this.generateDataFingerprint(tableViewer.tableData);
      if (state.dataFingerprint !== currentFingerprint) {
        console.log(`Data fingerprint mismatch for ${this.tableId}, state may be incompatible`);
        // Continue anyway - user may have same table from different session
      }

      // Apply column configuration
      if (state.columnTypes && Array.isArray(state.columnTypes)) {
        tableViewer.columnTypes = [...state.columnTypes];
      }
      
      if (state.columnStats && Array.isArray(state.columnStats)) {
        tableViewer.columnStats = [...state.columnStats];
      }
      
      if (state.numericFormatMap) {
        tableViewer.numericFormatMap = { ...state.numericFormatMap };
      }

      // Apply sorting state
      if (state.currentSort) {
        tableViewer.currentSort = { ...state.currentSort };
      }

      // Apply theme
      if (state.theme) {
        tableViewer.setTheme(state.theme);
      }

      // Apply saved filters
      if (state.savedFilters) {
        tableViewer.savedFilters = { ...state.savedFilters };
      }

      // Set chart counter
      if (typeof state.chartCounter === 'number') {
        tableViewer.chartCounter = state.chartCounter;
      }

      console.log(`✅ Applied basic state to ${this.tableId}`);
      return {
        ...state,
        applied: true
      };
    } catch (error) {
      console.error('Failed to apply table state:', error);
      return false;
    }
  }

  /**
   * Restore charts from saved state (called after table is rendered)
   */
  async restoreCharts(tableViewer, chartStates) {
    if (!chartStates || !Array.isArray(chartStates)) return;

    console.log(`🎨 Restoring ${chartStates.length} charts for ${this.tableId}`);
    
    for (const chartState of chartStates) {
      try {
        await this.recreateChart(tableViewer, chartState);
      } catch (error) {
        console.error(`Failed to restore chart ${chartState.id}:`, error);
      }
    }
  }

  /**
   * Recreate a single chart from saved state
   */
  async recreateChart(tableViewer, chartState) {
    const chartId = chartState.id;
    
    // Create tab - chartState.name should already be clean (no emoji/close button)
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.setAttribute('data-tab', chartId);
    tab.innerHTML = `📈 ${chartState.name} <span class="close-btn" title="Close chart">×</span>`;
    tableViewer.elements.tabBar.appendChild(tab);

    // Create tab panel
    const panel = document.createElement('div');
    panel.className = 'tab-panel';
    panel.id = `${chartId}-panel`;
    panel.innerHTML = tableViewer.createChartPanelHTML(chartId, chartState.name);
    
    document.querySelector('.tab-content').appendChild(panel);

    // Initialize chart controls
    tableViewer.initializeChartControls(chartId);

    // Restore chart configuration
    const typeSelect = document.getElementById(`${chartId}-type`);
    const xAxisSelect = document.getElementById(`${chartId}-x`);
    
    if (typeSelect && chartState.config.chartType) {
      typeSelect.value = chartState.config.chartType;
      tableViewer.updateAxisControls(chartId, chartState.config.chartType);
    }

    // Small delay to ensure axis controls are created
    await new Promise(resolve => setTimeout(resolve, 100));

    if (xAxisSelect && typeof chartState.config.xColumn === 'number') {
      xAxisSelect.value = chartState.config.xColumn.toString();
    }

    // Restore Y-axis selection
    if (chartState.config.yColumns && Array.isArray(chartState.config.yColumns)) {
      const chartDef = tableViewer.chartTypeDefinitions[chartState.config.chartType];
      
      if (chartDef && chartDef.yAxis && chartDef.yAxis.multiple) {
        // Multiple selection (checkboxes)
        const yCheckboxes = document.getElementById(`${chartId}-y`);
        if (yCheckboxes) {
          chartState.config.yColumns.forEach(colIndex => {
            const checkbox = yCheckboxes.querySelector(`input[value="${colIndex}"]`);
            if (checkbox) checkbox.checked = true;
          });
        }
      } else {
        // Single selection (dropdown)
        const ySingle = document.getElementById(`${chartId}-y-single`);
        if (ySingle && chartState.config.yColumns.length > 0) {
          ySingle.value = chartState.config.yColumns[0].toString();
        }
      }
    }

    // Wait a bit more to ensure elements are ready, then generate chart
    await new Promise(resolve => setTimeout(resolve, 200));

    // Generate the chart with restored configuration
    try {
      tableViewer.generateChart(chartId);
      console.log(`✅ Restored chart ${chartId}`);
    } catch (error) {
      console.error(`Failed to generate restored chart ${chartId}:`, error);
    }
  }

  /**
   * Restore active filters from saved state
   */
  restoreFilters(filterStates) {
    if (!filterStates || !Array.isArray(filterStates)) return;

    console.log(`🔍 Restoring ${filterStates.length} column filters`);

    filterStates.forEach(filter => {
      try {
        this.applyColumnFilter(filter);
      } catch (error) {
        console.error(`Failed to restore filter for column ${filter.columnIndex}:`, error);
      }
    });
  }

  /**
   * Apply a single column filter
   */
  applyColumnFilter(filter) {
    const { columnIndex, type, values } = filter;
    
    switch (type) {
      case 'numeric':
      case 'money':
      case 'percentage':
        if (values.min !== undefined) {
          const minInput = document.querySelector(`.filter-min[data-column="${columnIndex}"]`);
          if (minInput) minInput.value = values.min;
        }
        if (values.max !== undefined) {
          const maxInput = document.querySelector(`.filter-max[data-column="${columnIndex}"]`);
          if (maxInput) maxInput.value = values.max;
        }
        break;

      case 'date':
        if (values.from) {
          const fromInput = document.querySelector(`.filter-date-from[data-column="${columnIndex}"]`);
          if (fromInput) fromInput.value = values.from;
        }
        if (values.to) {
          const toInput = document.querySelector(`.filter-date-to[data-column="${columnIndex}"]`);
          if (toInput) toInput.value = values.to;
        }
        break;

      case 'categorical':
        if (values.selected && Array.isArray(values.selected)) {
          const select = document.querySelector(`.filter-select[data-column="${columnIndex}"]`);
          if (select) {
            Array.from(select.options).forEach(option => {
              option.selected = values.selected.includes(option.value);
            });
          }
        }
        if (values.text) {
          const textInput = document.querySelector(`.filter-text[data-column="${columnIndex}"]`);
          if (textInput) textInput.value = values.text;
        }
        break;
    }
  }

  /**
   * Restore active tab
   */
  restoreActiveTab(tabId) {
    if (!tabId) return;
    
    const tab = document.querySelector(`[data-tab="${tabId}"]`);
    if (tab) {
      // Use the table viewer's switchTab method if available
      if (window.tableViewer && typeof window.tableViewer.switchTab === 'function') {
        window.tableViewer.switchTab(tabId);
      } else {
        // Fallback direct DOM manipulation
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        const panel = document.getElementById(`${tabId}-panel`);
        if (panel) panel.classList.add('active');
      }
      console.log(`📑 Restored active tab: ${tabId}`);
    }
  }

  /**
   * Clear saved state for this table
   */
  clearState() {
    this.storage.removeItem(this.storageKey);
    console.log(`🗑️ Cleared state for ${this.tableId}`);
  }

  /**
   * Extract current active filters from DOM
   */
  extractActiveFilters() {
    // Handle cases where DOM is not available (e.g., tests)
    if (typeof document === 'undefined') {
      return [];
    }

    const filters = [];
    
    // Find all filter inputs and selects
    document.querySelectorAll('[data-column]').forEach(element => {
      const columnIndex = parseInt(element.getAttribute('data-column'));
      if (isNaN(columnIndex)) return;

      const filter = { columnIndex, values: {} };
      let hasValues = false;

      if (element.classList.contains('filter-min')) {
        if (element.value.trim()) {
          filter.type = 'numeric';
          filter.values.min = element.value;
          hasValues = true;
        }
      } else if (element.classList.contains('filter-max')) {
        const existingFilter = filters.find(f => f.columnIndex === columnIndex);
        if (existingFilter) {
          if (element.value.trim()) {
            existingFilter.values.max = element.value;
          }
        } else if (element.value.trim()) {
          filter.type = 'numeric';
          filter.values.max = element.value;
          hasValues = true;
        }
      } else if (element.classList.contains('filter-date-from')) {
        if (element.value) {
          filter.type = 'date';
          filter.values.from = element.value;
          hasValues = true;
        }
      } else if (element.classList.contains('filter-date-to')) {
        const existingFilter = filters.find(f => f.columnIndex === columnIndex);
        if (existingFilter) {
          if (element.value) {
            existingFilter.values.to = element.value;
          }
        } else if (element.value) {
          filter.type = 'date';
          filter.values.to = element.value;
          hasValues = true;
        }
      } else if (element.classList.contains('filter-select')) {
        const selected = Array.from(element.selectedOptions)
          .map(opt => opt.value)
          .filter(val => val !== '');
        if (selected.length > 0) {
          filter.type = 'categorical';
          filter.values.selected = selected;
          hasValues = true;
        }
      } else if (element.classList.contains('filter-text')) {
        if (element.value.trim()) {
          filter.type = 'categorical';
          filter.values.text = element.value.trim();
          hasValues = true;
        }
      }

      if (hasValues && !filters.some(f => f.columnIndex === columnIndex)) {
        filters.push(filter);
      }
    });

    return filters;
  }

  /**
   * Serialize chart instances to saveable state
   */
  serializeCharts(chartMap) {
    const charts = [];
    
    chartMap.forEach((chartInstance, chartId) => {
      try {
        const config = this.extractChartConfig(chartId);
        const name = this.getChartName(chartId);
        
        charts.push({
          id: chartId,
          name: name,
          config: config,
          created: Date.now()
        });
      } catch (error) {
        console.error(`Failed to serialize chart ${chartId}:`, error);
      }
    });

    return charts;
  }

  /**
   * Extract chart configuration from DOM elements
   */
  extractChartConfig(chartId) {
    // Handle cases where DOM is not available (e.g., tests)
    if (typeof document === 'undefined') {
      return {
        chartType: 'line',
        xColumn: 0,
        yColumns: []
      };
    }

    const typeSelect = document.getElementById(`${chartId}-type`);
    const xAxisSelect = document.getElementById(`${chartId}-x`);
    const yCheckboxes = document.getElementById(`${chartId}-y`);
    const ySingle = document.getElementById(`${chartId}-y-single`);

    const config = {
      chartType: typeSelect ? typeSelect.value : 'line',
      xColumn: xAxisSelect ? parseInt(xAxisSelect.value) : 0
    };

    // Extract Y-axis selection
    if (yCheckboxes) {
      // Multiple selection
      config.yColumns = Array.from(yCheckboxes.querySelectorAll('input:checked'))
        .map(cb => parseInt(cb.value))
        .filter(val => !isNaN(val));
    } else if (ySingle) {
      // Single selection
      const yValue = parseInt(ySingle.value);
      config.yColumns = !isNaN(yValue) ? [yValue] : [];
    } else {
      config.yColumns = [];
    }

    return config;
  }

  /**
   * Get chart name from tab
   */
  getChartName(chartId) {
    // Handle cases where DOM is not available (e.g., tests)
    if (typeof document === 'undefined') {
      return `Chart ${chartId.replace('chart-', '')}`;
    }

    const tab = document.querySelector(`[data-tab="${chartId}"]`);
    if (tab) {
      const text = tab.textContent || tab.innerText;
      // Remove the close button (×) and emoji (📈) more thoroughly
      let cleanName = text.replace(/×/g, '').replace(/📈/g, '').trim();
      // Remove any extra whitespace
      cleanName = cleanName.replace(/\s+/g, ' ').trim();
      return cleanName || `Chart ${chartId.replace('chart-', '')}`;
    }
    return `Chart ${chartId.replace('chart-', '')}`;
  }

  /**
   * Get currently active tab ID
   */
  getActiveTabId() {
    // Handle cases where DOM is not available (e.g., tests)
    if (typeof document === 'undefined') {
      return 'data';
    }

    const activeTab = document.querySelector('.tab.active');
    return activeTab ? activeTab.getAttribute('data-tab') : 'data';
  }

  /**
   * Generate fingerprint for data validation
   */
  generateDataFingerprint(tableData) {
    if (!tableData || !Array.isArray(tableData) || tableData.length === 0) return '';
    
    // Create a simple fingerprint from headers and row count
    const headers = tableData[0] || [];
    const rowCount = tableData.length - 1;
    const colCount = headers.length;
    
    // Include first few cell values for uniqueness
    let sampleData = '';
    if (tableData.length > 1) {
      const firstRow = tableData[1] || [];
      sampleData = firstRow.slice(0, 3).join('|');
    }
    
    return `${headers.join('|')}_${rowCount}x${colCount}_${sampleData}`.replace(/\s+/g, '');
  }
}

// Browser compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TableStateManager };
} else {
  window.TableStateManager = TableStateManager;
}