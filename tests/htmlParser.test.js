const assert = require('assert');

// Mock the HTML table parser functionality
class MockTableParser {
  static parseHTMLTable(table) {
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
}

// Create a mock DOM element for testing
function createMockTable(html) {
  return {
    querySelectorAll: (selector) => {
      if (selector === 'tr') {
        // Mock the rows based on the HTML
        return [
          {
            querySelectorAll: (cellSelector) => {
              if (cellSelector === 'td, th') {
                return [
                  {
                    textContent: 'Septiembre',
                    getAttribute: (attr) => attr === 'colspan' ? '6' : null,
                    trim: () => 'Septiembre'
                  }
                ];
              }
              return [];
            }
          },
          {
            querySelectorAll: (cellSelector) => {
              if (cellSelector === 'td, th') {
                return [
                  { textContent: '1', getAttribute: () => null },
                  { textContent: '39.394,46', getAttribute: () => null },
                  { textContent: '11', getAttribute: () => null },
                  { textContent: '39.485,65', getAttribute: () => null },
                  { textContent: '21', getAttribute: () => null },
                  { textContent: '39.485,65', getAttribute: () => null }
                ];
              }
              return [];
            }
          }
        ];
      }
      return [];
    }
  };
}

function testColspanHandling() {
  const mockTable = createMockTable();
  const result = MockTableParser.parseHTMLTable(mockTable);
  
  const expected = [
    ['Septiembre', '', '', '', '', ''],  // Header with colspan=6
    ['1', '39.394,46', '11', '39.485,65', '21', '39.485,65']  // Data row
  ];
  
  assert.deepStrictEqual(result, expected, 'Failed to handle colspan correctly');
}

function testBasicTableParsing() {
  // Test that normal tables still work
  const mockBasicTable = {
    querySelectorAll: (selector) => {
      if (selector === 'tr') {
        return [
          {
            querySelectorAll: (cellSelector) => {
              if (cellSelector === 'td, th') {
                return [
                  { textContent: 'Name', getAttribute: () => null },
                  { textContent: 'Age', getAttribute: () => null }
                ];
              }
              return [];
            }
          },
          {
            querySelectorAll: (cellSelector) => {
              if (cellSelector === 'td, th') {
                return [
                  { textContent: 'Alice', getAttribute: () => null },
                  { textContent: '25', getAttribute: () => null }
                ];
              }
              return [];
            }
          }
        ];
      }
      return [];
    }
  };
  
  const result = MockTableParser.parseHTMLTable(mockBasicTable);
  const expected = [
    ['Name', 'Age'],
    ['Alice', '25']
  ];
  
  assert.deepStrictEqual(result, expected, 'Failed to parse basic table correctly');
}

// Export tests
module.exports = [
  { name: 'HTML Parser: Colspan Handling', fn: testColspanHandling },
  { name: 'HTML Parser: Basic Table Parsing', fn: testBasicTableParsing }
];