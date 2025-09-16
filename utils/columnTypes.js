/**
 * Column Type Detection Utilities
 * Analyzes table data to determine the appropriate data type for each column
 */

/**
 * Analyze column types based on header names and data content
 * @param {Array[]} tableData - 2D array representing table (first row is headers)
 * @returns {Array} Array of column types: 'categorical', 'numeric', 'money', 'percentage', 'date'
 */
function analyzeColumnTypes(tableData) {
  if (!tableData || tableData.length < 2) return [];
  
  const headers = tableData[0];
  const rows = tableData.slice(1);
  
  return headers.map((header, colIndex) => {
    // Check header name for specific type keywords
    const headerName = header.toLowerCase();
    
    // Money/Currency detection keywords
    const moneyKeywords = [
      'price','cost','amount','salary','wage','revenue','budget','expense','payment','fee','bill','total','subtotal','tax','discount','refund','balance','debt','income','profit','loss',
      // Spanish / intl synonyms
      'monto','importe','pago','cargo','cargos','valor','precio','abono','saldo','deposito','retiro'
    ];
    const hasMoneyKeyword = moneyKeywords.some(keyword => headerName.includes(keyword));
    
    // Percentage detection keywords
    const percentKeywords = ['percent', 'percentage', 'rate', 'ratio', 'proportion', 'share', 'growth', 'change', 'increase', 'decrease', 'margin', 'roi', 'apy', 'apr', 'tax rate', 'interest'];
    const hasPercentKeyword = percentKeywords.some(keyword => headerName.includes(keyword)) || headerName.includes('%');
    
    // Date detection keywords
    const dateKeywords = [
      'date','time','created','updated','modified','birth','start','end','deadline','due','expiry','timestamp','when','day','month','year',
      // Spanish
      'fecha','creado','actualizado'
    ];
    const hasDateKeyword = dateKeywords.some(keyword => headerName.includes(keyword));
    
    // Numeric detection keywords
    const numericKeywords = ['count', 'sum', 'avg', 'average', 'number', 'value', 'score', 'quantity', 'size', 'weight', 'height', 'width', 'length', 'volume', 'area', 'distance', 'speed', 'temperature'];
    const hasNumericKeyword = numericKeywords.some(keyword => headerName.includes(keyword));
    
    // Analyze actual data values for better detection
    const sampleSize = Math.min(rows.length, 30); // Sample first 30 rows
    let moneyCount = 0;
    let percentCount = 0;
    let dateCount = 0;
    let numericCount = 0;
    const numericSamples = [];
    
    for (let i = 0; i < sampleSize; i++) {
      const raw = rows[i][colIndex];
      const value = String(raw == null ? '' : raw).trim();
      if (value === '') continue;
      
      // Money pattern detection (more strict - must have currency symbol or keyword)
      // Examples to match: "$ 113.100", "$3.408", "1.234,56 €", "EUR 1 234,56", "CLP 12.345", "12.345 CLP"
      const moneyPatterns = [
        /^[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]\s*[+-]?[\d\.\s,]+\d(?:[,\.]\d{2})?$/, // currency symbol at start
        /^[+-]?[\d\.\s,]+\d(?:[,\.]\d{2})?\s*[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]$/, // currency symbol at end
        /^[+-]?[\d\.\s]+(?:,\d{2})?\s*(usd|eur|gbp|jpy|cad|aud|chf|cny|inr|clp|mxn|ars|cop|brl|dkk|sek|nok|chf|zar)$/i, // currency code at end
        /^(usd|eur|gbp|jpy|cad|aud|chf|cny|inr|clp|mxn|ars|cop|brl|dkk|sek|nok|chf|zar)\s+[+-]?[\d\.\s]+(?:,\d{2})?$/i // currency code at start
      ];
      if (moneyPatterns.some(r => r.test(value))) {
        moneyCount++;
        // Capture numeric portion for format inference
        numericSamples.push(value);
      }
      
      // Percentage pattern detection
      else if (/^\d+\.?\d*\s*%$/.test(value) || 
               (hasPercentKeyword && /^\d+\.?\d*$/.test(value) && parseFloat(value) <= 100)) {
        percentCount++;
      }
      
      // Date pattern detection
      else {
        const datePatterns = [
          /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/ ,          // 12/09/2025 or 12-09-25
          /^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/ ,            // 2025-09-12
          /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i, // Sep 12 2025
          /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}$/i,  // 12 Sep 2025
          /^\d{1,2}-[A-Za-z]{3}-\d{4}$/ ,                  // 12-Sep-2025
          /^\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4}$/i  // 12 de septiembre de 2025 (basic Spanish)
        ];
        if (datePatterns.some(r => r.test(value)) || (!isNaN(Date.parse(value)) && value.length > 3)) {
          dateCount++;
          continue;
        }
        
        // Pure numeric detection (integers and decimals without currency)
        if (/^[+-]?\d+(\.\d+)?$/.test(value)) {
          numericCount++;
          numericSamples.push(value);
          continue;
        }
        
        // General numeric detection with separators (strip currency symbols, spaces)
        const cleaned = value.replace(/[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9\s]/g,'');
        if (/^[+-]?[0-9][0-9.,]*$/.test(cleaned)) {
          numericSamples.push(value);
          // Replace thousand separators and normalize decimal (fallback heuristic)
          const normalized = cleaned.match(/,\d{2}$/) ? cleaned.replace(/\./g,'').replace(',','.') : cleaned.replace(/,/g,'');
          if (!isNaN(parseFloat(normalized))) {
            // If it had a currency symbol but patterns failed, still treat as money
            if (/^[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]/.test(value)) {
              moneyCount++;
            } else {
              numericCount++;
            }
          }
        }
      }
    }
    
    const totalValues = sampleSize;
    const threshold = 0.7; // 70% threshold for type detection
    
    // Priority-based type assignment
    let inferredType = 'categorical';
    if (moneyCount / totalValues > threshold || hasMoneyKeyword) {
      inferredType = 'money';
    } else if (percentCount / totalValues > threshold || hasPercentKeyword) {
      inferredType = 'percentage';
    } else if (dateCount / totalValues > threshold || hasDateKeyword) {
      inferredType = 'date';
    } else if (numericCount / totalValues > threshold || hasNumericKeyword || /\d/.test(headerName)) {
      inferredType = 'numeric';
    }
    
    return inferredType;
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