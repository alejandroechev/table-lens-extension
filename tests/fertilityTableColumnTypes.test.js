/**
 * Test for fertility rate table column type detection
 * This test ensures that country names are properly detected as categorical
 */

const { analyzeColumnTypes } = require('../utils/columnTypes.js');

// Sample data from the fertility rate table (first few rows)
const fertilityTableData = [
  ["Rank", "Country", "Total fertility rate in 2025 (births/woman)"],
  ["1", "Chad", "5.94"],
  ["2", "Somalia", "5.91"],
  ["3", "DR Congo", "5.90"],
  ["4", "Central African Republic", "5.81"],
  ["5", "Niger", "5.79"],
  ["6", "Mali", "5.42"],
  ["7", "Angola", "4.95"],
  ["8", "Burundi", "4.68"],
  ["9", "Afghanistan", "4.66"],
  ["10", "Mozambique", "4.62"]
];

console.log('🧪 Testing fertility rate table column types...');

// Analyze column types
const columnTypes = analyzeColumnTypes(fertilityTableData);

console.log(`📊 Detected column types: [${columnTypes.map((t, i) => `${i}: ${t}`).join(', ')}]`);

// Test expectations (updated for new simplified rules - data only)
const expectedTypes = ['numeric', 'categorical', 'numeric']; // Rank should be numeric, Country should be categorical, fertility rate should be numeric

let testsPassed = 0;
let totalTests = expectedTypes.length;

expectedTypes.forEach((expected, index) => {
  const actual = columnTypes[index];
  const header = fertilityTableData[0][index];
  
  if (actual === expected) {
    console.log(`✅ Column ${index} "${header}": Expected ${expected}, got ${actual}`);
    testsPassed++;
  } else {
    console.log(`❌ Column ${index} "${header}": Expected ${expected}, got ${actual}`);
  }
});

console.log(`\n📊 Test Results: ${testsPassed}/${totalTests} tests passed`);

if (testsPassed === totalTests) {
  console.log('🎉 All fertility table column type tests passed!');
  process.exit(0);
} else {
  console.log('💥 Some fertility table column type tests failed!');
  process.exit(1);
}