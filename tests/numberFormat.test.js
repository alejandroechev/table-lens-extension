const assert = require('assert');
const { inferNumberFormat, detectColumnType, parseNumericValue } = require('../utils/numberFormat');

function testChileanMoneyDetection() {
  const headers = ['Fecha','Descripción','Canal o sucursal','Cargos (CLP)','Abono (CLP)','Saldo (CLP)'];
  const sampleRows = [
    ['15/09/2025','Traspaso A:Mascoteros Spa','Internet','$ 90.000','','$ 5.339.195'],
    ['15/09/2025','Pago:proveedores 0969361000','Oficina Central','','$ 15.000','$ 5.429.195'],
    ['15/09/2025','Traspaso A Cuenta:001770480108','Internet','$ 4.000','','$ 5.414.195'],
    ['12/09/2025','Traspaso De:Maria Daniela Valenzuela Schindler','Internet','','$ 210.000','$ 5.418.195'],
    ['10/09/2025','Pago Automat. Dividendo Hipotecario','Oficina Central','$ 740.328','','$ 5.208.195'],
    ['09/09/2025','Traspaso A:Alejandro Schmauk','Internet','$ 45.000','','$ 5.948.523'],
    ['08/09/2025','Traspaso A:Maria Paz Infante Bascunan','Internet','$ 45.000','','$ 5.993.523'],
    ['08/09/2025','Traspaso A:Fintual Agf Sa','Internet','$ 3.200.000','','$ 6.038.523'],
    ['08/09/2025','Traspaso A Cuenta:001770480108','Internet','$ 5.000.000','','$ 9.238.523'],
    ['08/09/2025','Traspaso A:Fintual Agf Sa','Internet','$ 5.000.000','','$ 14.238.523']
  ];

  // Extract columns 3,4,5 values
  const cargosCol = sampleRows.map(r=>r[3]).filter(Boolean);
  const abonoCol = sampleRows.map(r=>r[4]).filter(Boolean);
  const saldoCol = sampleRows.map(r=>r[5]).filter(Boolean);

  const cargos = detectColumnType(headers[3], cargosCol);
  const abono = detectColumnType(headers[4], abonoCol);
  const saldo = detectColumnType(headers[5], saldoCol);

  assert.strictEqual(cargos.type, 'money', 'Cargos should be detected as money');
  assert.strictEqual(abono.type, 'money', 'Abono should be detected as money');
  assert.strictEqual(saldo.type, 'money', 'Saldo should be detected as money');

  // Expect Chilean format thousand '.' decimal ','
  assert.deepStrictEqual(cargos.format, { thousand: '.', decimal: ',' }, 'Cargos format incorrect');
  assert.deepStrictEqual(abono.format, { thousand: '.', decimal: ',' }, 'Abono format incorrect');
  assert.deepStrictEqual(saldo.format, { thousand: '.', decimal: ',' }, 'Saldo format incorrect');

  // Parsing test
  const parsed = parseNumericValue('$ 5.339.195', { thousand: '.', decimal: ',' });
  if (parsed !== 5339195) {
    console.error('DEBUG parsed value:', parsed);
  }
  assert.strictEqual(parsed, 5339195, 'Parsing with Chilean format failed');
}

module.exports = [
  { name: 'Chilean money detection & format inference', fn: testChileanMoneyDetection }
];
