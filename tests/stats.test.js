const assert = require('assert');
const { computeNumericStats, computeDateStats } = require('../utils/stats');
const { inferNumberFormat } = require('../utils/numberFormat');

// Shared Chilean table sample (same as numberFormat test)
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

// Column extraction
const fechas = sampleRows.map(r=>r[0]).filter(v=>v && v.trim()!=='');
const cargos = sampleRows.map(r=>r[3]).filter(v=>v && v.trim()!== '');
const abono = sampleRows.map(r=>r[4]).filter(v=>v && v.trim()!== '');
const saldo = sampleRows.map(r=>r[5]).filter(v=>v && v.trim()!== '');

// Infer format from all money samples (should detect thousand '.' and decimal ',')
const fmt = inferNumberFormat([...cargos, ...abono, ...saldo]);

function nearlyEqual(a, b, epsilon = 1e-6) { return Math.abs(a-b) <= epsilon; }

function testCargosStats() {
  // Expected manual numbers
  const expectedSum = 14124328; // 90,000 + 4,000 + 740,328 + 45,000 + 45,000 + 3,200,000 + 5,000,000 + 5,000,000
  const count = computeNumericStats(cargos, 'count', fmt);
  assert.strictEqual(count, 8, 'Cargos count mismatch');
  const sum = computeNumericStats(cargos, 'sum', fmt);
  assert.strictEqual(sum, expectedSum, 'Cargos sum mismatch');
  const avg = computeNumericStats(cargos, 'avg', fmt);
  assert.strictEqual(avg, expectedSum / 8, 'Cargos avg mismatch');
  const min = computeNumericStats(cargos, 'min', fmt);
  assert.strictEqual(min, 4000, 'Cargos min mismatch');
  const max = computeNumericStats(cargos, 'max', fmt);
  assert.strictEqual(max, 5000000, 'Cargos max mismatch');
  const std = computeNumericStats(cargos, 'std', fmt);
  // Recompute expected std (population)
  const values = [90000,4000,740328,45000,45000,3200000,5000000,5000000];
  const mean = expectedSum / values.length;
  const variance = values.reduce((a,b)=>a+Math.pow(b-mean,2),0)/values.length;
  const expectedStd = Math.sqrt(variance);
  assert.ok(nearlyEqual(std, expectedStd), 'Cargos std mismatch');
}

function testAbonoStats() {
  const expectedSum = 225000; // 15,000 + 210,000
  const count = computeNumericStats(abono, 'count', fmt);
  assert.strictEqual(count, 2, 'Abono count mismatch');
  const sum = computeNumericStats(abono, 'sum', fmt);
  assert.strictEqual(sum, expectedSum, 'Abono sum mismatch');
  const avg = computeNumericStats(abono, 'avg', fmt);
  assert.strictEqual(avg, expectedSum / 2, 'Abono avg mismatch');
  const min = computeNumericStats(abono, 'min', fmt);
  assert.strictEqual(min, 15000, 'Abono min mismatch');
  const max = computeNumericStats(abono, 'max', fmt);
  assert.strictEqual(max, 210000, 'Abono max mismatch');
  const std = computeNumericStats(abono, 'std', fmt);
  const values = [15000,210000];
  const mean = expectedSum / 2;
  const variance = values.reduce((a,b)=>a+Math.pow(b-mean,2),0)/values.length;
  const expectedStd = Math.sqrt(variance);
  assert.ok(nearlyEqual(std, expectedStd), 'Abono std mismatch');
}

function testSaldoCountOnly() {
  const count = computeNumericStats(saldo, 'count', fmt);
  assert.strictEqual(count, 10, 'Saldo count mismatch');
}

function testDateStats() {
  const count = computeDateStats(fechas, 'count');
  assert.strictEqual(count, 10, 'Fecha count mismatch');
  const earliest = computeDateStats(fechas, 'earliest');
  const latest = computeDateStats(fechas, 'latest');
  const range = computeDateStats(fechas, 'range');
  // Earliest should be 08/09/2025, latest 15/09/2025, range 7 days
  const fmtDate = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  assert.strictEqual(fmtDate(earliest), '08/09/2025', 'Earliest date mismatch');
  assert.strictEqual(fmtDate(latest), '15/09/2025', 'Latest date mismatch');
  assert.strictEqual(range, 7, 'Date range mismatch');
}

module.exports = [
  { name: 'Cargos stats (sum, avg, min, max, std)', fn: testCargosStats },
  { name: 'Abono stats (sum, avg, min, max, std)', fn: testAbonoStats },
  { name: 'Saldo stats (count)', fn: testSaldoCountOnly },
  { name: 'Fecha date stats (count, earliest, latest, range)', fn: testDateStats }
];
