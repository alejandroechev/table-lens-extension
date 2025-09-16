/**
 * Test for column type detection using the actual utility logic
 * Tests the analyzeColumnTypes method from utils/columnTypes.js
 */

const { analyzeColumnTypes } = require('../utils/columnTypes.js');

// Test data from the CSV
const testData = [
  // Headers
  ['Rainfall\n(inches)', 'Americas', 'Asia', 'Europe', 'Africa'],
  // Data rows
  ['2010', '', '', '', ''],
  ['Average', '104', '201', '193', '144'],
  ['24 hour high', '15', '26', '27', '18'],
  ['12 hour high', '9', '10', '11', '12'],
  ['2009', '', '', '', ''],
  ['Average', '133', '244', '155', '166'],
  ['24 hour high', '27', '28', '29', '20'],
  ['12 hour high', '11', '12', '13', '16']
];

// Expected column types based on the data content
const expectedTypes = [
  'categorical',  // Column 0: "Rainfall\n(inches)" - mixed text/years
  'numeric',      // Column 1: "Americas" - only numbers and empty values
  'numeric',      // Column 2: "Asia" - only numbers and empty values  
  'numeric',      // Column 3: "Europe" - only numbers and empty values
  'numeric'       // Column 4: "Africa" - only numbers and empty values
];

console.log('🧪 Testing Column Type Detection with Actual Utility');
console.log('===================================================');

const detectedTypes = analyzeColumnTypes(testData);

console.log('\n📋 RESULTS COMPARISON:');
console.log('======================');
for (let i = 0; i < detectedTypes.length; i++) {
  const header = testData[0][i];
  const expected = expectedTypes[i];
  const detected = detectedTypes[i];
  const match = expected === detected ? '✅' : '❌';
  
  console.log(`${match} Column ${i}: "${header}"`);
  console.log(`   Expected: ${expected}`);
  console.log(`   Detected: ${detected}`);
  if (expected !== detected) {
    console.log(`   ⚠️  MISMATCH!`);
  }
  console.log('');
}

// Summary
const correctDetections = detectedTypes.filter((type, i) => type === expectedTypes[i]).length;
const totalColumns = detectedTypes.length;
console.log(`📊 SUMMARY: ${correctDetections}/${totalColumns} columns detected correctly (${(correctDetections/totalColumns*100).toFixed(1)}%)`);

if (correctDetections < totalColumns) {
  console.log('❌ Column type detection has issues that need to be fixed!');
  throw new Error(`Column type detection failed: ${correctDetections}/${totalColumns} columns correct`);
} else {
  console.log('✅ All column types detected correctly!');
}

// Export for test runner
module.exports = [
  {
    name: 'Column Type Detection - CSV Rainfall Data',
    fn: () => {
      const detectedTypes = analyzeColumnTypes(testData);
      const correctDetections = detectedTypes.filter((type, i) => type === expectedTypes[i]).length;
      const totalColumns = detectedTypes.length;
      
      if (correctDetections !== totalColumns) {
        throw new Error(`Column type detection failed: ${correctDetections}/${totalColumns} columns detected correctly`);
      }
    }
  }
];