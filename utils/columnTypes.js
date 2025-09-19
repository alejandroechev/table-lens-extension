/**
 * Column Type Detection Utilities
 * Analyzes table data to determine the appropriate data type for each column
 * Rules:
 * - Rate: All values are numeric with % symbol
 * - Money: All values are numeric with currency symbols ($ € £ etc.) and may have separators
 * - Numeric: All values are only numeric, OR mostly numeric with at most one repeated non-numeric string (but must have some numeric values)
 * - Date: All values are dates in any recognized format
 * - Categorical: Any other case (mixed types, text, etc.)
 */

/**
 * Analyze column types based solely on data content (ignoring headers)
 * @param {Array[]} tableData - 2D array representing table (first row is headers)
 * @returns {Array} Array of column types: 'categorical', 'numeric', 'money', 'rate', 'date'
 */
function analyzeColumnTypes(tableData) {
  if (!tableData || tableData.length < 2) return [];
  
  const headers = tableData[0];
  const rows = tableData.slice(1);
  
  return headers.map((header, colIndex) => {
    const values = [];
    
    // Collect non-empty values for analysis
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i][colIndex];
      const value = String(raw == null ? '' : raw).trim();
      if (value === '') continue;
      values.push(value);
    }
    
    if (values.length === 0) return 'categorical';
    
    // Check if ALL values match each type pattern
    const allMatch = (pattern) => values.every(value => pattern.test(value));
    
    // Rate: All values are numeric with % symbol
    if (allMatch(/^[+-]?[\d.,\s]+%$/)) {
      return 'rate';
    }
    
    // Money: All values are numeric with currency symbol ($, €, £, etc.) and may have separators
    if (allMatch(/^[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]?\s*[+-]?[\d.,\s]+[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]?$/) &&
        values.some(value => /[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]/.test(value))) {
      return 'money';
    }
    
    // Numeric: All values are only numeric (no other symbols except +/- and decimal/thousand separators)
    // OR all values are numeric plus one repeated non-numeric string
    if (allMatch(/^[+-]?[\d.,\s]+$/)) {
      return 'numeric';
    }
    
    // Check for numeric + one repeated string pattern
    const numericValues = [];
    const nonNumericValues = [];
    
    for (const value of values) {
      if (/^[+-]?[\d.,\s]+$/.test(value)) {
        numericValues.push(value);
      } else {
        nonNumericValues.push(value);
      }
    }
    
    // If we have some numeric values and exactly one unique non-numeric string (that can repeat)
    if (numericValues.length > 0 && nonNumericValues.length > 0) {
      const uniqueNonNumeric = [...new Set(nonNumericValues)];
      if (uniqueNonNumeric.length === 1) {
        return 'numeric';
      }
    }
    
    // If there are no numeric values, only repeated strings should be categorical
    // (removed the previous logic that classified repeated non-numeric strings as numeric)
    
    // Date: All values are dates in any format
    if (values.every(value => {
      const datePatterns = [
        /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/, // 12/09/2025 or 12-09-25
        /^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/, // 2025-09-12
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i, // Sep 12 2025
        /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}$/i, // 12 Sep 2025
        /^\d{1,2}-[A-Za-z]{3}-\d{4}$/, // 12-Sep-2025
        /^\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4}$/i // 12 de septiembre de 2025
      ];
      return datePatterns.some(pattern => pattern.test(value)) || 
             (!isNaN(Date.parse(value)) && value.length > 3 && isNaN(parseFloat(value)));
    })) {
      return 'date';
    }
    
    // Default: Categorical for any other case
    return 'categorical';
  });
}

/**
 * Infer number format (thousand separator and decimal separator) from numeric samples
 * @param {Array} samples - Array of numeric strings to analyze
 * @returns {Object} Format object with thousand and decimal separators
 */
function inferNumberFormat(samples) {
  if (!samples || samples.length === 0) return { thousand: ',', decimal: '.' };
  
  let dotDecimal = 0, commaDecimal = 0, spaceThousand = 0, dotThousand = 0, commaThousand = 0;
  
  for (const raw of samples.slice(0, 60)) {
    const v = String(raw).trim();
    const core = v.replace(/[\s\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]/g,'');
    
    if (/,\d{2}$/.test(core)) commaDecimal++;
    if (/\.\d{2}$/.test(core)) dotDecimal++;
    if (/\d\.\d{3}(?:[.,]|$)/.test(core)) dotThousand++;
    if (/\d,\d{3}(?:[.,]|$)/.test(core)) commaThousand++;
    if (/\d\s\d{3}(?:[.,]|$)/.test(core)) spaceThousand++;
  }
  
  let thousand = ',';
  let decimal = '.';
  
  const hasDecimalInfo = (dotDecimal + commaDecimal) > 0;
  if (hasDecimalInfo) {
    if (commaDecimal > dotDecimal) {
      decimal = ',';
    } else if (dotDecimal > commaDecimal) {
      decimal = '.';
    }
    
    const candidates = [];
    if (dotThousand) candidates.push({sep:'.', count:dotThousand});
    if (commaThousand) candidates.push({sep:',', count:commaThousand});
    if (spaceThousand) candidates.push({sep:' ', count:spaceThousand});
    
    candidates.sort((a,b)=>b.count-a.count);
    if (candidates.length) {
      thousand = candidates[0].sep;
    } else {
      thousand = decimal === '.' ? ',' : '.';
    }
    
    if (thousand === decimal) {
      thousand = decimal === '.' ? ',' : '.';
    }
  } else {
    // No decimal markers -> infer typical locale pairing
    if (dotThousand > 0 && commaThousand === 0) { 
      thousand = '.'; 
      decimal = ','; 
    } else if (commaThousand > 0 && dotThousand === 0) { 
      thousand = ','; 
      decimal = '.'; 
    } else if (spaceThousand > 0) { 
      thousand = ' '; 
      decimal = ','; 
    }
  }
  
  return { thousand, decimal };
}

// Export for Node.js (tests) and browser (table-viewer)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    analyzeColumnTypes,
    inferNumberFormat
  };
} else if (typeof window !== 'undefined') {
  window.ColumnTypeUtils = {
    analyzeColumnTypes,
    inferNumberFormat
  };
}