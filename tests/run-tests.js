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
try {
  const collection4 = require('./htmlParser.test.js');
  tests = tests.concat(collection4);
} catch (e) {
  console.error('Failed loading HTML parser tests', e);
}
try {
  const collection5 = require('./columnTypeDetection.test.js');
  tests = tests.concat(collection5);
} catch (e) {
  console.error('Failed loading column type detection tests', e);
}
try {
  const collectionExport = require('./exportFormats.test.js');
  tests = tests.concat(collectionExport);
} catch (e) {
  console.error('Failed loading export formats tests', e);
}
try {
  const collection6 = require('./nestedTables.test.js');
  tests = tests.concat(collection6);
} catch (e) {
  console.error('Failed loading nested tables tests', e);
}
try {
  const collection7 = require('./nestedTableIntegration.test.js');
  tests = tests.concat(collection7);
} catch (e) {
  console.error('Failed loading nested table integration tests', e);
}
try {
  const stateTestModule = require('./tableState.test.js');
  // The state test module exports functions, so we need to wrap them in the expected format
  if (stateTestModule.runAllTests) {
    tests.push({
      name: 'Table State Management - Full Suite',
      fn: () => {
        const result = stateTestModule.runAllTests();
        if (!result) throw new Error('State management tests failed');
      }
    });
  }
} catch (e) {
  console.error('Failed loading table state tests', e);
}
try {
  const rowspanTestModule = require('./rowspanHandling.test.js');
  tests.push({
    name: 'Rowspan Handling - Tennis Champions Table',
    fn: () => {
      const result = rowspanTestModule.testRowspanHandling();
      if (!result) throw new Error('Rowspan handling test failed');
    }
  });
} catch (e) {
  console.error('Failed loading rowspan handling tests', e);
}
try {
  const colspanTestModule = require('./colspanHandling.test.js');
  tests.push({
    name: 'Colspan Handling - Student Scores Table',
    fn: () => {
      const result = colspanTestModule.testColspanHandling();
      if (!result) throw new Error('Colspan handling test failed');
    }
  });
} catch (e) {
  console.error('Failed loading colspan handling tests', e);
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
