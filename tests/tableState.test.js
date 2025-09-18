const { TableStateManager } = require('../utils/tableState.js');

// Mock session storage for testing
const mockSessionStorage = {
  storage: {},
  getItem: function(key) {
    return this.storage[key] || null;
  },
  setItem: function(key, value) {
    this.storage[key] = value;
  },
  removeItem: function(key) {
    delete this.storage[key];
  },
  clear: function() {
    this.storage = {};
  }
};

// Mock document for testing
global.document = {
  body: { getAttribute: () => 'light' },
  querySelectorAll: () => [],
  querySelector: () => null
};

global.sessionStorage = mockSessionStorage;

/**
 * Test TableStateManager functionality
 */
function testTableStateManager() {
  console.log('🧪 Testing TableStateManager...');
  
  // Create a mock table viewer
  const mockTableViewer = {
    tableData: [
      ['Name', 'Age', 'City'],
      ['John', '25', 'New York'],
      ['Jane', '30', 'Boston']
    ],
    columnTypes: ['categorical', 'numeric', 'categorical'],
    columnStats: ['count', 'avg', 'count'],
    numericFormatMap: { 1: { thousand: ',', decimal: '.' } },
    currentSort: { column: 1, direction: 'asc' },
    charts: new Map(), // Empty charts for test
    chartCounter: 1,
    tableInfo: { type: 'html', source: 'test' }
  };
  
  const tableId = 'test_table_123';
  const stateManager = new TableStateManager(tableId);
  
  // Test 1: Save state
  console.log('  ✓ Test 1: Save state');
  const saved = stateManager.saveState(mockTableViewer);
  if (!saved) {
    console.error('    ❌ Failed to save state');
    return false;
  }
  
  // Test 2: Load state
  console.log('  ✓ Test 2: Load state');
  const loadedState = stateManager.loadState();
  if (!loadedState) {
    console.error('    ❌ Failed to load state');
    return false;
  }
  
  // Test 3: Validate state contents
  console.log('  ✓ Test 3: Validate state contents');
  if (loadedState.columnTypes.length !== mockTableViewer.columnTypes.length) {
    console.error('    ❌ Column types not preserved');
    return false;
  }
  
  if (loadedState.currentSort.column !== mockTableViewer.currentSort.column) {
    console.error('    ❌ Sort state not preserved');
    return false;
  }
  
  if (!loadedState.charts || loadedState.charts.length !== 0) {
    console.error('    ❌ Charts state not preserved (expected empty)');
    return false;
  }
  
  // Test 4: Apply state
  console.log('  ✓ Test 4: Apply state');
  const mockViewer2 = {
    columnTypes: [],
    columnStats: [],
    numericFormatMap: {},
    currentSort: { column: -1, direction: 'none' },
    chartCounter: 0,
    tableData: mockTableViewer.tableData,
    setTheme: function(theme) { /* Mock setTheme method */ }
  };
  
  const applied = stateManager.applyState(mockViewer2, loadedState);
  if (!applied) {
    console.error('    ❌ Failed to apply state');
    return false;
  }
  
  if (mockViewer2.columnTypes.length !== mockTableViewer.columnTypes.length) {
    console.error('    ❌ Column types not applied correctly');
    return false;
  }
  
  // Test 5: Clear state
  console.log('  ✓ Test 5: Clear state');
  stateManager.clearState();
  const clearedState = stateManager.loadState();
  if (clearedState) {
    console.error('    ❌ State not cleared properly');
    return false;
  }
  
  console.log('  ✅ All TableStateManager tests passed!');
  return true;
}

/**
 * Test data fingerprint generation
 */
function testDataFingerprint() {
  console.log('🧪 Testing data fingerprint generation...');
  
  const stateManager = new TableStateManager('test');
  
  const data1 = [
    ['Name', 'Age'],
    ['John', '25'],
    ['Jane', '30']
  ];
  
  const data2 = [
    ['Name', 'Age'],
    ['John', '25'],
    ['Jane', '30']
  ];
  
  const data3 = [
    ['Name', 'City'],
    ['John', 'NYC'],
    ['Jane', 'Boston']
  ];
  
  const fp1 = stateManager.generateDataFingerprint(data1);
  const fp2 = stateManager.generateDataFingerprint(data2);
  const fp3 = stateManager.generateDataFingerprint(data3);
  
  if (fp1 !== fp2) {
    console.error('  ❌ Identical data should have same fingerprint');
    return false;
  }
  
  if (fp1 === fp3) {
    console.error('  ❌ Different data should have different fingerprint');
    return false;
  }
  
  console.log('  ✅ Data fingerprint tests passed!');
  return true;
}

/**
 * Test filter state extraction
 */
function testFilterStateExtraction() {
  console.log('🧪 Testing filter state extraction...');
  
  // Mock DOM elements for filter inputs
  const mockElements = [
    { getAttribute: () => '0', classList: { contains: () => true }, value: '10', className: 'filter-min' },
    { getAttribute: () => '0', classList: { contains: () => true }, value: '50', className: 'filter-max' }
  ];
  
  global.document.querySelectorAll = (selector) => {
    if (selector === '[data-column]') return mockElements;
    return [];
  };
  
  const stateManager = new TableStateManager('test');
  const filters = stateManager.extractActiveFilters();
  
  // Should extract one filter for column 0 with min/max values
  if (filters.length === 0) {
    console.error('  ❌ No filters extracted');
    return false;
  }
  
  console.log('  ✅ Filter state extraction tests passed!');
  return true;
}

// Run all tests
function runAllTests() {
  console.log('🚀 Running TableStateManager tests...\n');
  
  const results = [
    testTableStateManager(),
    testDataFingerprint(),
    testFilterStateExtraction()
  ];
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n📊 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed!');
    return true;
  } else {
    console.log('❌ Some tests failed');
    return false;
  }
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testTableStateManager,
    testDataFingerprint,
    testFilterStateExtraction
  };
}

// Auto-run if called directly
if (require.main === module) {
  runAllTests();
}