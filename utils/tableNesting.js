/**
 * Enhanced table detection utility that handles nested table structures
 * Prioritizes inner tables with actual data over outer container tables
 */

// Simple HTML parser for testing - parses HTML string into DOM-like structure
function parseHTMLTable(table) {
  if (typeof table === 'string') {
    // Mock implementation for testing with HTML strings
    return parseHTMLTableFromString(table);
  }
  
  // Real implementation for DOM elements (from content.js logic)
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
            // For rowspan: repeat content in all spanned rows
            // For colspan: only put content in the first column
            if (c === 0) {
              grid[targetRow][targetCol] = cellData.content;
            } else {
              grid[targetRow][targetCol] = '';
            }
          }
        }
      }
      
      colOffset += cellData.colspan;
    });
  });
  
  return grid.filter(row => row && row.length > 0);
}

// Helper function for testing with HTML strings
function parseHTMLTableFromString(htmlString) {
  // This would be a more complex implementation
  // For now, return empty array for string input
  return [];
}

function detectTablesWithNestingLogic(allTables, parseHTMLTableFn = parseHTMLTable) {
  const validTables = [];
  
  for (const table of allTables) {
    const data = parseHTMLTableFn(table);
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
      
      // Check if this table contains OTHER tables (not itself)
      const nestedTables = table.querySelectorAll('table');
      const actualNestedCount = Array.from(nestedTables).filter(nested => nested !== table).length;
      const isContainerTable = actualNestedCount > 0;
      
      // Calculate average row length (to detect tables with many empty columns)
      const avgRowLength = data.reduce((sum, row) => {
        const filledInRow = row.filter(cell => cell && cell.trim() !== '').length;
        return sum + filledInRow;
      }, 0) / data.length;
      
      // Detect tables that look like presentation/layout containers
      const isPresentationContainer = (
        table.getAttribute('role') === 'presentation' ||
        table.getAttribute('name') === 'GroupContainer' ||
        dataDensity < 0.15 || // Less than 15% filled
        (data[0] && data[0].length > 20 && avgRowLength < 5) // Many cols but few filled
      );
      
      validTables.push({
        element: table,
        data: data,
        dataDensity: dataDensity,
        isContainerTable: isContainerTable,
        isPresentationContainer: isPresentationContainer,
        nestedTableCount: actualNestedCount,
        avgRowLength: avgRowLength,
        id: table.getAttribute('id') || table.getAttribute('name') || 'unnamed'
      });
    }
  }
  
  // Prioritization logic:
  // 1. Exclude presentation containers unless no better options
  // 2. Prefer inner tables (non-containers) with good data density
  // 3. Sort by data density and content richness
  
  const nonPresentationTables = validTables.filter(t => !t.isPresentationContainer);
  const presentationTables = validTables.filter(t => t.isPresentationContainer);
  
  let candidateTables = nonPresentationTables.length > 0 ? nonPresentationTables : presentationTables;
  
  // Further filter: prefer non-container tables if available
  const innerTables = candidateTables.filter(t => !t.isContainerTable);
  if (innerTables.length > 0) {
    candidateTables = innerTables;
  }
  
  // Sort by quality score (data density * avg row length)
  return candidateTables.sort((a, b) => {
    const scoreA = a.dataDensity * Math.min(a.avgRowLength, 10); // Cap to avoid over-weighting
    const scoreB = b.dataDensity * Math.min(b.avgRowLength, 10);
    return scoreB - scoreA;
  });
}

// For Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { detectTablesWithNestingLogic, parseHTMLTable };
}

// For browser
if (typeof window !== 'undefined') {
  window.TableNestingUtils = { detectTablesWithNestingLogic, parseHTMLTable };
}