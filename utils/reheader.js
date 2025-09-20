// Utility to change which row acts as the header of a table (2D array)
// headerIndex: zero-based index of the row to become the new header
// Returns a new 2D array with the chosen header first and all other rows (in original order) following.
function reheaderTable(tableData, headerIndex) {
  if (!Array.isArray(tableData) || tableData.length === 0) return tableData;
  const idx = Math.max(0, Math.min(headerIndex, tableData.length - 1));
  if (idx === 0) return tableData.slice();
  const headerRow = tableData[idx];
  const remaining = tableData.filter((_, i) => i !== idx);
  return [headerRow, ...remaining];
}

if (typeof module !== 'undefined') {
  module.exports = { reheaderTable };
}
