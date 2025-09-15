const tests = require('./numberFormat.test.js');

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
