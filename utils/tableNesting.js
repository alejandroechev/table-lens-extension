/**
 * Enhanced table detection utility that handles nested table structures
 * Prioritizes inner tables with actual data over outer container tables
 */

function detectTablesWithNestingLogic(allTables, parseHTMLTable) {
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
  module.exports = { detectTablesWithNestingLogic };
}

// For browser
if (typeof window !== 'undefined') {
  window.TableNestingUtils = { detectTablesWithNestingLogic };
}