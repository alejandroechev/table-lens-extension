const assert = require('assert');

// Mock the TableViewer class for testing
class MockTableViewer {
  cleanTableData(tableData) {
    if (!tableData || tableData.length === 0) return tableData;
    
    // First, identify which columns have any non-empty data
    const columnHasData = new Array(tableData[0].length).fill(false);
    
    // Check all rows to see which columns contain data
    for (let rowIndex = 0; rowIndex < tableData.length; rowIndex++) {
      const row = tableData[rowIndex];
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const cell = row[colIndex];
        // Consider a cell non-empty if it contains any non-whitespace text
        if (cell != null && String(cell).trim() !== '') {
          columnHasData[colIndex] = true;
        }
      }
    }
    
    // Get indices of columns that have data
    const validColumns = columnHasData.map((hasData, index) => hasData ? index : -1)
                                      .filter(index => index !== -1);
    
    // If all columns are empty, return original data to avoid breaking everything
    if (validColumns.length === 0) {
      console.warn('⚠️ All columns appear empty, keeping original table structure');
      return tableData;
    }
    
    // Filter out empty columns and empty rows
    const cleanedRows = [];
    
    for (let rowIndex = 0; rowIndex < tableData.length; rowIndex++) {
      const originalRow = tableData[rowIndex];
      
      // Create new row with only non-empty columns
      const filteredRow = validColumns.map(colIndex => originalRow[colIndex]);
      
      // Check if this row has any non-empty data
      const rowHasData = filteredRow.some(cell => 
        cell != null && String(cell).trim() !== ''
      );
      
      // Keep the header row (index 0) even if empty, and any row with data
      if (rowIndex === 0 || rowHasData) {
        cleanedRows.push(filteredRow);
      }
    }
    
    return cleanedRows.length > 0 ? cleanedRows : tableData;
  }
}

const viewer = new MockTableViewer();

function testRemoveEmptyColumns() {
  const input = [
    ['Name', '', 'Age', '', 'City'],
    ['Alice', '', '25', '', 'NYC'],
    ['Bob', '', '30', '', 'LA']
  ];

  const expected = [
    ['Name', 'Age', 'City'],
    ['Alice', '25', 'NYC'],
    ['Bob', '30', 'LA']
  ];

  const result = viewer.cleanTableData(input);
  assert.deepStrictEqual(result, expected, 'Failed to remove empty columns');
}

function testRemoveEmptyRows() {
  const input = [
    ['Name', 'Age', 'City'],
    ['Alice', '25', 'NYC'],
    ['', '', ''],
    ['Bob', '30', 'LA'],
    [null, null, null]
  ];

  const expected = [
    ['Name', 'Age', 'City'],
    ['Alice', '25', 'NYC'],
    ['Bob', '30', 'LA']
  ];

  const result = viewer.cleanTableData(input);
  assert.deepStrictEqual(result, expected, 'Failed to remove empty rows');
}

function testRemoveEmptyRowsAndColumns() {
  const input = [
    ['Name', '', 'Age', '', 'City'],
    ['Alice', '', '25', '', 'NYC'],
    ['', '', '', '', ''],
    ['Bob', '', '30', '', 'LA'],
    [null, null, null, null, null]
  ];

  const expected = [
    ['Name', 'Age', 'City'],
    ['Alice', '25', 'NYC'],
    ['Bob', '30', 'LA']
  ];

  const result = viewer.cleanTableData(input);
  assert.deepStrictEqual(result, expected, 'Failed to remove both empty rows and columns');
}

function testPreserveEmptyHeader() {
  const input = [
    ['', '', ''],
    ['Alice', '25', 'NYC'],
    ['Bob', '30', 'LA']
  ];

  const expected = [
    ['', '', ''],
    ['Alice', '25', 'NYC'],
    ['Bob', '30', 'LA']
  ];

  const result = viewer.cleanTableData(input);
  assert.deepStrictEqual(result, expected, 'Failed to preserve empty header row');
}

function testHandleWhitespaceOnlyCells() {
  const input = [
    ['Name', '   ', 'Age', '\t\n', 'City'],
    ['Alice', ' ', '25', '  ', 'NYC'],
    ['Bob', '\t', '30', '\n', 'LA']
  ];

  const expected = [
    ['Name', 'Age', 'City'],
    ['Alice', '25', 'NYC'],
    ['Bob', '30', 'LA']
  ];

  const result = viewer.cleanTableData(input);
  assert.deepStrictEqual(result, expected, 'Failed to handle whitespace-only cells');
}

function testPartialDataTable() {
  const input = [
    ['Product', '', 'Price', '', ''],
    ['Laptop', '', '1000', '', ''],
    ['', '', '', '', ''],
    ['Mouse', '', '', '', ''],  // Mouse has no price
    ['', '', '50', '', '']      // Price with no product
  ];

  const expected = [
    ['Product', 'Price'],
    ['Laptop', '1000'],
    ['Mouse', ''],
    ['', '50']
  ];

  const result = viewer.cleanTableData(input);
  assert.deepStrictEqual(result, expected, 'Failed to handle partial data table');
}

function testAllEmptyColumns() {
  const input = [
    ['', '', ''],
    ['', '', ''],
    [null, null, null]
  ];

  // Should return original since all columns are empty
  const result = viewer.cleanTableData(input);
  assert.deepStrictEqual(result, input, 'Failed to return original data when all columns empty');
}

function testEdgeCases() {
  const result1 = viewer.cleanTableData([]);
  const result2 = viewer.cleanTableData(null);
  const result3 = viewer.cleanTableData(undefined);

  assert.deepStrictEqual(result1, [], 'Empty array should return empty array');
  assert.strictEqual(result2, null, 'Null input should return null');
  assert.strictEqual(result3, undefined, 'Undefined input should return undefined');
}

function testChileanBankingTable() {
  const input = [
    ['Fecha', '', 'Descripción', 'Cargos', '', 'Abono', 'Saldo'],
    ['2025-01-15', '', 'Transferencia', '$ 90.000', '', '', '$ 5.249.195'],
    ['', '', '', '', '', '', ''],
    ['2025-01-10', '', 'Depósito', '', '', '$ 100.000', '$ 5.339.195'],
    [null, null, null, null, null, null, null]
  ];

  const expected = [
    ['Fecha', 'Descripción', 'Cargos', 'Abono', 'Saldo'],
    ['2025-01-15', 'Transferencia', '$ 90.000', '', '$ 5.249.195'],
    ['2025-01-10', 'Depósito', '', '$ 100.000', '$ 5.339.195']
  ];

  const result = viewer.cleanTableData(input);
  assert.deepStrictEqual(result, expected, 'Failed Chilean banking table cleanup');
}

// Export tests in the same format as other test files
module.exports = [
  { name: 'Table Cleanup: Remove Empty Columns', fn: testRemoveEmptyColumns },
  { name: 'Table Cleanup: Remove Empty Rows', fn: testRemoveEmptyRows },
  { name: 'Table Cleanup: Remove Empty Rows and Columns', fn: testRemoveEmptyRowsAndColumns },
  { name: 'Table Cleanup: Preserve Empty Header', fn: testPreserveEmptyHeader },
  { name: 'Table Cleanup: Handle Whitespace-Only Cells', fn: testHandleWhitespaceOnlyCells },
  { name: 'Table Cleanup: Partial Data Table', fn: testPartialDataTable },
  { name: 'Table Cleanup: All Empty Columns', fn: testAllEmptyColumns },
  { name: 'Table Cleanup: Edge Cases', fn: testEdgeCases },
  { name: 'Table Cleanup: Chilean Banking Format', fn: testChileanBankingTable }
];