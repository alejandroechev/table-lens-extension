const collection1 = require('./numberFormat.test.js');
let tests = [...collection1];
try {
  const collection2 = require('./stats.test.js');
  tests = tests.concat(collection2);
} catch (e) {
  console.error('Failed loading stats tests', e);
}
try {
  const collection3 = require('./tableCleanup.test.js');
  tests = tests.concat(collection3);
} catch (e) {
  console.error('Failed loading table cleanup tests', e);
}

let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    t.fn();
    console.log(`✅ ${t.name}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${t.name}: ${err.message}`);
    failed++;
  }
}

console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
