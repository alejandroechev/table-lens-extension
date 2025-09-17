/**
 * Test for nested table handling - ensuring we extract the inner data table 
 * instead of the outer container table when dealing with table-within-table structures
 */

const assert = require('assert');
const { detectTablesWithNestingLogic } = require('../utils/tableNesting.js');

// Mock DOM environment for testing
class MockElement {
  constructor(tagName, attributes = {}, textContent = '', innerHTML = '') {
    this.tagName = tagName.toLowerCase();
    this.attributes = attributes;
    this.textContent = textContent;
    this.innerHTML = innerHTML;
    this.children = [];
    this.parent = null;
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  querySelectorAll(selector) {
    const results = [];
    this._querySelectorAll(selector, results);
    return results;
  }

  _querySelectorAll(selector, results) {
    // Simple selector parsing for testing
    if (selector === 'tr') {
      if (this.tagName === 'tr') results.push(this);
    } else if (selector === 'td, th') {
      if (this.tagName === 'td' || this.tagName === 'th') results.push(this);
    } else if (selector === 'table') {
      if (this.tagName === 'table') results.push(this);
    }

    this.children.forEach(child => child._querySelectorAll(selector, results));
  }
}

// Simplified parseHTMLTable function extracted from content.js
function parseHTMLTable(table) {
  const rows = table.querySelectorAll('tr');
  const data = [];
  
  // First pass: determine the maximum number of columns needed
  let maxCols = 0;
  const parsedRows = [];
  
  rows.forEach(row => {
    const cells = row.querySelectorAll('td, th');
    const rowData = [];
    let colIndex = 0;
    
    cells.forEach(cell => {
      const content = cell.textContent.trim();
      const colspan = parseInt(cell.getAttribute('colspan') || '1');
      const rowspan = parseInt(cell.getAttribute('rowspan') || '1');
      
      // Add the cell content
      rowData.push({
        content,
        colspan,
        rowspan,
        startCol: colIndex
      });
      
      colIndex += colspan;
    });
    
    if (rowData.length > 0) {
      parsedRows.push(rowData);
      maxCols = Math.max(maxCols, colIndex);
    }
  });
  
  // Second pass: create a grid structure
  const grid = [];
  
  parsedRows.forEach((rowCells, rowIndex) => {
    if (!grid[rowIndex]) grid[rowIndex] = new Array(maxCols).fill('');
    
    let colOffset = 0;
    
    rowCells.forEach(cellData => {
      // Find the next available column position
      while (colOffset < maxCols && grid[rowIndex][colOffset] !== '') {
        colOffset++;
      }
      
      // Fill the cell and handle colspan/rowspan
      for (let r = 0; r < cellData.rowspan; r++) {
        for (let c = 0; c < cellData.colspan; c++) {
          const targetRow = rowIndex + r;
          const targetCol = colOffset + c;
          
          if (!grid[targetRow]) grid[targetRow] = new Array(maxCols).fill('');
          
          if (targetRow < grid.length && targetCol < maxCols) {
            // Only put content in the first cell of a colspan/rowspan
            grid[targetRow][targetCol] = (r === 0 && c === 0) ? cellData.content : '';
          }
        }
      }
      
      colOffset += cellData.colspan;
    });
  });
  
  return grid.filter(row => row && row.length > 0);
}

// Enhanced table detection that prioritizes inner tables with actual data
function detectTablesWithNestingLogicOld(document) {
  const allTables = document.querySelectorAll('table');
  const validTables = [];
  
  for (const table of allTables) {
    const data = parseHTMLTable(table);
    if (data.length > 1) {
      // Calculate data density - what percentage of cells have meaningful content
      let totalCells = 0;
      let filledCells = 0;
      
      data.forEach(row => {
        row.forEach(cell => {
          totalCells++;
          if (cell && cell.trim() !== '') {
            filledCells++;
          }
        });
      });
      
      const dataDensity = filledCells / totalCells;
      
      // Check if this table is a container for other tables
      const nestedTables = table.querySelectorAll('table');
      const isContainerTable = nestedTables.length > 0; // This table contains other tables
      
      validTables.push({
        element: table,
        data: data,
        dataDensity: dataDensity,
        isContainerTable: isContainerTable,
        nestedTableCount: nestedTables.length,
        id: table.getAttribute('id') || table.getAttribute('name') || 'unnamed'
      });
    }
  }
  
  // Filter out container tables if we have better alternatives
  const innerTables = validTables.filter(t => !t.isContainerTable);
  const containerTables = validTables.filter(t => t.isContainerTable);
  
  // If we have inner tables with good data density, prefer them
  if (innerTables.length > 0) {
    // Sort by data density, highest first
    return innerTables.sort((a, b) => b.dataDensity - a.dataDensity);
  }
  
  // Otherwise, return all tables sorted by data density
  return validTables.sort((a, b) => b.dataDensity - a.dataDensity);
}

function createNestedTableStructure() {
  // Create the outer container table
  const outerTable = new MockElement('table', { 
    name: 'GroupContainer', 
    class: 'displayPageTable table table-thead',
    role: 'presentation'
  });
  
  const outerTbody = new MockElement('tbody');
  outerTable.appendChild(outerTbody);
  
  // First row - empty presentation row
  const presentationRow1 = new MockElement('tr', { role: 'presentation' });
  const presentationCell1 = new MockElement('td', { role: 'presentation', colspan: '2' });
  presentationRow1.appendChild(presentationCell1);
  outerTbody.appendChild(presentationRow1);
  
  // Second row - contains the actual data table
  const presentationRow2 = new MockElement('tr', { role: 'presentation' });
  const presentationCell2 = new MockElement('td', { role: 'presentation', colspan: '2' });
  presentationRow2.appendChild(presentationCell2);
  outerTbody.appendChild(presentationRow2);
  
  // Create the inner data table
  const innerTable = new MockElement('table', {
    name: 'IFD_204_1_record_Table',
    id: 'ConsultaSaldoYMovimientosPortletPersonaip_consultaSaldoIFD_204_1_record_table',
    width: '100%',
    class: 'table table-striped border-bottom mb-0'
  });
  
  const innerTbody = new MockElement('tbody');
  innerTable.appendChild(innerTbody);
  
  // Header row
  const headerRow = new MockElement('tr', { name: 'TableHeaderContainer', class: 'tableHeadRow' });
  
  const headers = [
    { text: 'Fecha', name: 'FECOPE_iso8601_ColumnHeaderSorted' },
    { text: 'Movimientos', name: 'OBSERVA_ColumnHeaderSorted' },
    { text: 'Observa Vale', name: 'OBSERVA_VALE_ColumnHeaderSorted' },
    { text: 'Cargos', name: 'EGRESO_ColumnHeaderSorted' },
    { text: 'Abonos', name: 'INGRESO_ColumnHeaderSorted' },
    { text: 'Saldo', name: 'SALDO_ColumnHeaderSorted' },
    { text: 'Montos', name: 'MONTOS_ColumnHeaderSorted' }
  ];
  
  headers.forEach(header => {
    const th = new MockElement('th', { name: header.name, class: 'text-left', scope: 'col' }, header.text);
    headerRow.appendChild(th);
  });
  
  innerTbody.appendChild(headerRow);
  
  // Data rows
  const transactions = [
    ['08/09/2025', 'Transferencia a fintual', 'Transferencia A Fintual', '$ 3.430.000', '', '$ 4.821', '$ 3.430.000'],
    ['08/09/2025', 'Transferencia a fintual', 'Transferencia A Fintual', '$ 5.000.000', '', '$ 3.434.821', '$ 5.000.000'],
    ['05/09/2025', 'Transferencia a fintual', 'Transferencia A Fintual', '$ 5.000.000', '', '$ 8.434.821', '$ 5.000.000'],
    ['04/09/2025', 'Transferencia a fintual', 'Transferencia A Fintual', '$ 5.000.000', '', '$ 13.434.821', '$ 5.000.000'],
    ['04/09/2025', 'Transferencia a fintual', 'Transferencia A Fintual', '$ 5.000.000', '', '$ 18.434.821', '$ 5.000.000'],
    ['02/09/2025', 'Transferencia a fintual', 'Transferencia A Fintual', '$ 300.000', '', '$ 23.434.821', '$ 300.000'],
    ['02/09/2025', 'Transferencia de buda com sp', 'Transferencia De Buda Com Sp', '', '$ 7.000.000', '$ 23.734.821', '$ 7.000.000'],
    ['02/09/2025', 'Transferencia de buda com sp', 'Transferencia De Buda Com Sp', '', '$ 7.000.000', '$ 16.734.821', '$ 7.000.000'],
    ['02/09/2025', 'Transferencia de buda com sp', 'Transferencia De Buda Com Sp', '', '$ 2.729.839', '$ 9.734.821', '$ 2.729.839'],
    ['02/09/2025', 'Transferencia de buda com sp', 'Transferencia De Buda Com Sp', '', '$ 7.000.000', '$ 7.004.982', '$ 7.000.000'],
    ['01/09/2025', 'Transferencia a alejandro ec', 'Transferencia A Alejandro Ec', '$ 200.000', '', '$ 4.982', '$ 200.000'],
    ['01/09/2025', 'Transferencia de alejandro a', 'Transferencia De Alejandro A', '', '$ 200.000', '$ 204.982', '$ 200.000']
  ];
  
  transactions.forEach((transaction, index) => {
    const dataRow = new MockElement('tr', { 
      name: 'DataContainer', 
      class: index % 2 === 0 ? 'tableRowOdd' : 'tableRowEven' 
    });
    
    transaction.forEach((cellData, cellIndex) => {
      const td = new MockElement('td', {
        name: headers[cellIndex].name.replace('ColumnHeaderSorted', 'ColumnData'),
        valign: 'top',
        class: 'tableCell'
      }, cellData);
      dataRow.appendChild(td);
    });
    
    innerTbody.appendChild(dataRow);
  });
  
  // Add inner table to the presentation cell
  presentationCell2.appendChild(innerTable);
  
  return outerTable;
}

function createMockDocument(rootElement) {
  return {
    querySelectorAll: (selector) => {
      const results = [];
      rootElement._querySelectorAll(selector, results);
      return results;
    }
  };
}

function testNestedTableDetection() {
  console.log('🧪 Testing Nested Table Detection');
  console.log('==================================');
  
  const nestedTableStructure = createNestedTableStructure();
  const document = createMockDocument(nestedTableStructure);
  
  // Test with current logic (should find both tables)
  const allTables = document.querySelectorAll('table');
  console.log(`📋 Found ${allTables.length} tables total`);
  
  const tablesWithData = [];
  allTables.forEach(table => {
    const data = parseHTMLTable(table);
    if (data.length > 1) {
      tablesWithData.push({
        id: table.getAttribute('name') || table.getAttribute('id'),
        rows: data.length,
        cols: data[0] ? data[0].length : 0,
        data: data
      });
    }
  });
  
  console.log(`📊 Tables with data: ${tablesWithData.length}`);
  tablesWithData.forEach(table => {
    console.log(`  - ${table.id}: ${table.rows} rows x ${table.cols} cols`);
  });
  
  // Test with enhanced logic
  const allTablesArray = Array.from(allTables);
  const enhancedResults = detectTablesWithNestingLogic(allTablesArray, parseHTMLTable);
  console.log(`✨ Enhanced detection found ${enhancedResults.length} preferred tables`);
  
  enhancedResults.forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.id}`);
    console.log(`     - Data density: ${(result.dataDensity * 100).toFixed(1)}%`);
    console.log(`     - Is container: ${result.isContainerTable}`);
    console.log(`     - Is presentation: ${result.isPresentationContainer}`);
    console.log(`     - Nested tables: ${result.nestedTableCount}`);
    console.log(`     - Avg row length: ${result.avgRowLength.toFixed(1)}`);
    console.log(`     - Dimensions: ${result.data.length} rows x ${result.data[0]?.length || 0} cols`);
  });
  
  // Verify the best result matches expected
  const bestTable = enhancedResults[0];
  const expectedHeaders = ['Fecha', 'Movimientos', 'Observa Vale', 'Cargos', 'Abonos', 'Saldo', 'Montos'];
  
  assert.strictEqual(bestTable.id, 'ConsultaSaldoYMovimientosPortletPersonaip_consultaSaldoIFD_204_1_record_table', 'Should select the inner data table');
  assert.strictEqual(bestTable.data[0].length, 7, 'Should have exactly 7 columns');
  assert.deepStrictEqual(bestTable.data[0], expectedHeaders, 'Should have correct headers');
  assert.strictEqual(bestTable.isContainerTable, false, 'Selected table should not be a container');
  assert.strictEqual(bestTable.isPresentationContainer, false, 'Selected table should not be a presentation container');
  
  // Verify first data row
  const expectedFirstDataRow = ['08/09/2025', 'Transferencia a fintual', 'Transferencia A Fintual', '$ 3.430.000', '', '$ 4.821', '$ 3.430.000'];
  assert.deepStrictEqual(bestTable.data[1], expectedFirstDataRow, 'First data row should match expected content');
  
  console.log('✅ All nested table detection tests passed!');
}

// Export for test runner
module.exports = [
  {
    name: 'Nested Table Detection - Container vs Data Table Prioritization',
    fn: testNestedTableDetection
  }
];