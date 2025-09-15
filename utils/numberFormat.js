// Pure utility functions for number & column type inference (usable in tests and UI)
// Designed to mirror logic in TableViewer but without DOM dependencies.

const MONEY_KEYWORDS = [
  'price','cost','amount','salary','wage','revenue','budget','expense','payment','fee','bill','total','subtotal','tax','discount','refund','balance','debt','income','profit','loss',
  'monto','importe','pago','cargo','cargos','valor','precio','abono','saldo','deposito','retiro'
];

const PERCENT_KEYWORDS = ['percent','percentage','rate','ratio','proportion','share','growth','change','increase','decrease','margin','roi','apy','apr','tax rate','interest'];
const DATE_KEYWORDS = ['date','time','created','updated','modified','birth','start','end','deadline','due','expiry','timestamp','when','day','month','year','fecha','creado','actualizado'];
const NUMERIC_KEYWORDS = ['count','sum','avg','average','number','value','score','quantity','size','weight','height','width','length','volume','area','distance','speed','temperature'];

// Money regex patterns (expanded)
const MONEY_PATTERNS = [
  /^[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]?\s*[+-]?[\d\.\s,]+\d(?:[,\.]\d{2})?\s*[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]?$/,
  /^[+-]?[\d\.\s]+(?:[,\.]\d{2})?\s*(usd|eur|gbp|jpy|cad|aud|chf|cny|inr|clp|mxn|ars|cop|brl|dkk|sek|nok|zar)$/i,
  /^(usd|eur|gbp|jpy|cad|aud|chf|cny|inr|clp|mxn|ars|cop|brl|dkk|sek|nok|zar)\s+[+-]?[\d\.\s]+(?:[,\.]\d{2})?$/i
];

function isMoneyValue(value) {
  if (!value) return false;
  const v = String(value).trim();
  return MONEY_PATTERNS.some(r => r.test(v));
}

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
    if (commaDecimal > dotDecimal) decimal = ','; else if (dotDecimal > commaDecimal) decimal = '.';
  } else {
    // No decimals found: infer from thousand separators preferences (e.g., Chilean: 1.234.567 -> thousand '.', assume decimal ',')
    if (dotThousand > 0 && commaThousand === 0) {
      thousand = '.';
      decimal = ','; // adopt common pairing
    } else if (commaThousand > 0 && dotThousand === 0) {
      thousand = ',';
      decimal = '.';
    } else if (spaceThousand > 0) {
      thousand = ' ';
      decimal = ','; // arbitrary default different from space
    }
  }

  // Determine thousand if decimals existed or ambiguous case
  if (hasDecimalInfo) {
    const candidates = [];
    if (dotThousand) candidates.push({sep:'.', count:dotThousand});
    if (commaThousand) candidates.push({sep:',', count:commaThousand});
    if (spaceThousand) candidates.push({sep:' ', count:spaceThousand});
    candidates.sort((a,b)=>b.count-a.count);
    if (candidates.length) {
      thousand = candidates[0].sep;
    } else {
      thousand = decimal === '.' ? ',' : '.'; // pick opposite
    }
    if (thousand === decimal) {
      // Force distinct; prefer keeping decimal and switching thousand
      thousand = decimal === '.' ? ',' : '.';
    }
  }

  return { thousand, decimal };
}

function parseNumericValue(value, format) {
  if (value === null || value === undefined || value === '') return 0;
  const str = String(value).trim();
  const fmt = format || { thousand: ',', decimal: '.' };
  // Remove currency symbols and percent and trim
  let cleaned = str.replace(/[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9]/g,'').replace(/%/g,'').trim();
  // Remove spaces at start and collapse
  cleaned = cleaned.replace(/\s+/g,' ');
  // Extract sign
  let sign = 1;
  if (/^-/.test(cleaned)) { sign = -1; }
  cleaned = cleaned.replace(/^[-+]/,'');
  // Keep only digits, separators, spaces
  cleaned = cleaned.replace(/[^0-9.,\s]/g,'');
  // Strategy: split on decimal separator occurrence nearest to end
  let integerPart = cleaned;
  let decimalPart = '';
  if (fmt.decimal && cleaned.includes(fmt.decimal)) {
    const lastIdx = cleaned.lastIndexOf(fmt.decimal);
    integerPart = cleaned.slice(0, lastIdx);
    decimalPart = cleaned.slice(lastIdx + 1).replace(/[^0-9]/g,'');
  }
  // Remove thousand separators from integerPart
  const thousandRegex = fmt.thousand === ' ' ? /\s+/g : new RegExp('\\' + fmt.thousand, 'g');
  if (fmt.thousand) integerPart = integerPart.replace(thousandRegex, '');
  // Remove all non-digits
  integerPart = integerPart.replace(/[^0-9]/g,'');
  if (integerPart === '') integerPart = '0';
  let normalized = integerPart;
  if (decimalPart) normalized += '.' + decimalPart;
  const num = parseFloat(normalized) * sign;
  return isNaN(num) ? 0 : num;
}

function detectColumnType(header, sampleValues) {
  const headerName = (header || '').toLowerCase();
  let moneyCount=0, percentCount=0, dateCount=0, numericCount=0;
  const samples = [];
  const sampleSize = Math.min(sampleValues.length, 50);
  for (let i=0;i<sampleSize;i++) {
    const raw = sampleValues[i];
    const value = String(raw == null ? '' : raw).trim();
    if (!value) continue;
    if (isMoneyValue(value)) { moneyCount++; samples.push(value); continue; }
    if (/^\d+\.?\d*\s*%$/.test(value)) { percentCount++; samples.push(value); continue; }
    const datePatterns = [
      /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/,
      /^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/,
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i,
      /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}$/i,
      /^\d{1,2}-[A-Za-z]{3}-\d{4}$/,
      /^\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4}$/i
    ];
    if (datePatterns.some(r=>r.test(value)) || !isNaN(Date.parse(value))) { dateCount++; continue; }
    const cleaned = value.replace(/[\$€£¥₽₹R\u00A3\u20AC\u00A5\u20B9\s]/g,'');
    if (/^[+-]?[0-9][0-9.,]*$/.test(cleaned)) { numericCount++; samples.push(value); }
  }
  const total = sampleSize || 1;
  const threshold = 0.7;
  const hasMoneyKeyword = MONEY_KEYWORDS.some(k=>headerName.includes(k));
  const hasPercentKeyword = PERCENT_KEYWORDS.some(k=>headerName.includes(k)) || headerName.includes('%');
  const hasDateKeyword = DATE_KEYWORDS.some(k=>headerName.includes(k));
  const hasNumericKeyword = NUMERIC_KEYWORDS.some(k=>headerName.includes(k));

  let inferred = 'categorical';
  if (moneyCount/total > threshold || hasMoneyKeyword) inferred='money';
  else if (percentCount/total > threshold || hasPercentKeyword) inferred='percentage';
  else if (dateCount/total > threshold || hasDateKeyword) inferred='date';
  else if (numericCount/total > threshold || hasNumericKeyword) inferred='numeric';

  let format = null;
  if (['money','numeric','percentage'].includes(inferred)) {
    format = inferNumberFormat(samples);
  }
  return { type: inferred, format };
}

module.exports = { inferNumberFormat, parseNumericValue, detectColumnType, isMoneyValue };
