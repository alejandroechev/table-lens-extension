// Statistics utilities mirroring logic in TableViewer for numeric/money/percentage/date/categorical columns.
// Provides both parsing+stats (for tests) and pure numeric stats (for integration with existing parsed values).
let parseNumericValueFn;
try {
  // In Node test environment
  ({ parseNumericValue: parseNumericValueFn } = require('./numberFormat'));
} catch (e) {
  // In browser we rely on TableViewer's parsing; functions expecting parsed numbers can be used instead.
  parseNumericValueFn = null;
}

function computeNumericStatsFromNumbers(nums, stat) {
  const numbers = nums.filter(v => typeof v === 'number' && !isNaN(v));
  if (stat === 'count') return numbers.length;
  if (numbers.length === 0) return 0;
  switch (stat) {
    case 'sum': return numbers.reduce((a,b)=>a+b,0);
    case 'avg': return numbers.reduce((a,b)=>a+b,0) / numbers.length;
    case 'min': return Math.min(...numbers);
    case 'max': return Math.max(...numbers);
    case 'std': {
      if (numbers.length < 2) return 0;
      const mean = numbers.reduce((a,b)=>a+b,0) / numbers.length;
      const variance = numbers.reduce((a,b)=> a + Math.pow(b-mean,2), 0) / numbers.length; // population std
      return Math.sqrt(variance);
    }
    default: return 0;
  }
}

function computeNumericStats(rawValues, stat, format) {
  if (!parseNumericValueFn) {
    throw new Error('parseNumericValue not available in this environment');
  }
  const nums = rawValues
    .filter(v => v !== null && v !== undefined && v !== '')
    .map(v => parseNumericValueFn(v, format))
    .filter(v => !isNaN(v));
  return computeNumericStatsFromNumbers(nums, stat);
}

function parseDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  // dd/mm/yyyy
  const m = str.match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/);
  if (m) {
    const d = parseInt(m[1],10);
    const mo = parseInt(m[2],10) - 1;
    const y = parseInt(m[3],10);
    return new Date(y, mo, d);
  }
  const dObj = new Date(str);
  return isNaN(dObj.getTime()) ? null : dObj;
}

function computeDateStats(rawValues, stat) {
  const dates = rawValues
    .filter(v => v !== null && v !== undefined && v !== '')
    .map(parseDate)
    .filter(d => d && !isNaN(d.getTime()));
  if (stat === 'count') return dates.length;
  if (dates.length === 0) {
    if (['earliest','latest','range'].includes(stat)) return null;
    return 0;
  }
  switch (stat) {
    case 'earliest':
      return new Date(Math.min(...dates));
    case 'latest':
      return new Date(Math.max(...dates));
    case 'range': {
      if (dates.length < 2) return 0;
      const earliest = Math.min(...dates.map(d=>d.getTime()));
      const latest = Math.max(...dates.map(d=>d.getTime()));
      const diffDays = Math.ceil((latest - earliest)/(1000*60*60*24));
      return diffDays;
    }
    default: return 0;
  }
}

function computeCategoricalStats(rawValues, stat) {
  const values = rawValues.filter(v => v !== null && v !== undefined && v !== '');
  switch (stat) {
    case 'count': return values.length;
    case 'unique': return new Set(values).size;
    case 'mode': {
      if (values.length === 0) return 'N/A';
      const freq = {};
      values.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
      const max = Math.max(...Object.values(freq));
      const modes = Object.keys(freq).filter(k => freq[k] === max);
      return { value: modes[0], extra: modes.length > 1 ? modes.length - 1 : 0 };
    }
    default: return 0;
  }
}

function getStatValue(columnType, statFunction, rawValues, options = {}) {
  if (['numeric','money','percentage'].includes(columnType)) {
    const numbers = options.parsedNumbers || null;
    if (numbers) return computeNumericStatsFromNumbers(numbers, statFunction);
    return computeNumericStats(rawValues, statFunction, options.format);
  }
  if (columnType === 'date') {
    return computeDateStats(rawValues, statFunction);
  }
  // categorical
  return computeCategoricalStats(rawValues, statFunction);
}

const exported = {
  computeNumericStats,
  computeNumericStatsFromNumbers,
  computeDateStats,
  computeCategoricalStats,
  getStatValue
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exported;
}
if (typeof window !== 'undefined') {
  window.TableStats = exported;
}
