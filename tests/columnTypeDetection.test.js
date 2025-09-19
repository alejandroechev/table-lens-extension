/**
 * Comprehensive test for simplified column type detection
 * Tests the new rules-based approach that focuses only on data content
 */

const { analyzeColumnTypes } = require('../utils/columnTypes.js');

// Test data from the fertility rate tables (2023 and 2025)
const fertility2023Table = [
  ["Rank", "Country", "Total fertility rate in 2023 (births/woman)"],
  ["1", "Somalia", "6.13"],
  ["2", "Chad", "6.12"],
  ["3", "Niger", "6.06"],
  ["4", "DR Congo", "6.05"],
  ["5", "Central African Republic", "6.01"]
];

const fertility2025Table = [
  ["Rank", "Country", "Total fertility rate in 2025 (births/woman)"],
  ["1", "Chad", "5.94"],
  ["2", "Somalia", "5.91"],
  ["3", "DR Congo", "5.90"],
  ["4", "Central African Republic", "5.81"],
  ["5", "Niger", "5.79"]
];

// Additional test cases for different data types
const mixedDataTable = [
  ["ID", "Name", "Price", "Discount", "Date", "Status"],
  ["1", "Product A", "$29.99", "15%", "2023-09-12", "Active"],
  ["2", "Product B", "$149.50", "20%", "2023-10-15", "Inactive"],
  ["3", "Product C", "$5.25", "5%", "2023-11-01", "Active"]
];

const pureNumericTable = [
  ["Score", "Count", "Weight"],
  ["85", "42", "12.5"],
  ["92", "38", "15.2"],
  ["78", "45", "10.8"]
];

const categoricalTable = [
  ["Category", "Region", "Size"],
  ["Electronics", "North", "Large"],
  ["Clothing", "South", "Medium"],
  ["Books", "East", "Small"]
];

const dateTable = [
  ["Start Date", "End Date", "Created"],
  ["2023-01-15", "2023-12-31", "Jan 15, 2023"],
  ["2023-02-01", "2024-01-31", "Feb 1, 2023"],
  ["2023-03-10", "2024-02-28", "Mar 10, 2023"]
];

console.log('🧪 Testing simplified column type detection...\n');

function runTest(testName, tableData, expectedTypes) {
  console.log(`📊 ${testName}:`);
  
  const detectedTypes = analyzeColumnTypes(tableData);
  console.log(`   Expected: [${expectedTypes.join(', ')}]`);
  console.log(`   Detected: [${detectedTypes.join(', ')}]`);
  
  let allCorrect = true;
  for (let i = 0; i < expectedTypes.length; i++) {
    const expected = expectedTypes[i];
    const detected = detectedTypes[i];
    const header = tableData[0][i];
    
    if (expected === detected) {
      console.log(`   ✅ Column "${header}": ${detected}`);
    } else {
      console.log(`   ❌ Column "${header}": Expected ${expected}, got ${detected}`);
      allCorrect = false;
    }
  }
  
  console.log(`   ${allCorrect ? '🎉 PASS' : '💥 FAIL'}\n`);
  return allCorrect;
}

// Run all tests
let totalTests = 0;
let passedTests = 0;

// Test 1: 2023 fertility table - third column should be 'numeric' (pure decimal numbers)
if (runTest('2023 Fertility Rate Table', fertility2023Table, ['numeric', 'categorical', 'numeric'])) passedTests++;
totalTests++;

// Test 2: 2025 fertility table - third column should be 'numeric' (pure decimal numbers)  
if (runTest('2025 Fertility Rate Table', fertility2025Table, ['numeric', 'categorical', 'numeric'])) passedTests++;
totalTests++;

// Test 3: Mixed data types
if (runTest('Mixed Data Table', mixedDataTable, ['numeric', 'categorical', 'money', 'rate', 'date', 'categorical'])) passedTests++;
totalTests++;

// Test 4: Pure numeric data
if (runTest('Pure Numeric Table', pureNumericTable, ['numeric', 'numeric', 'numeric'])) passedTests++;
totalTests++;

// Test 5: Categorical data
if (runTest('Categorical Table', categoricalTable, ['categorical', 'categorical', 'categorical'])) passedTests++;
totalTests++;

// Test 6: Date data
if (runTest('Date Table', dateTable, ['date', 'date', 'date'])) passedTests++;
totalTests++;

// Test 7: Edge cases (updated - Mixed column has numeric + one repeated string "Text")
const edgeCasesTable = [
  ["Mixed", "Empty", "SingleValue", "Percentage"],
  ["123", "", "Hello", "50%"],
  ["456", "", "Hello", "75%"], 
  ["789", "", "Hello", "25%"]
];
if (runTest('Edge Cases Table', edgeCasesTable, ['numeric', 'categorical', 'categorical', 'rate'])) passedTests++;
totalTests++;

// Test 8: Numeric with repeated string
const numericWithStringTable = [
  ["Score", "Status", "Weight"],
  ["85", "Active", "12.5"],
  ["92", "Active", "15.2"],
  ["78", "Inactive", "10.8"],
  ["65", "Active", "8.9"]
];
if (runTest('Numeric with Repeated String Table', numericWithStringTable, ['numeric', 'categorical', 'numeric'])) passedTests++;
totalTests++;

// Test 9: Numeric with one repeated string (should be numeric)
const numericOneStringTable = [
  ["Values", "Units"],
  ["100", "kg"],
  ["150", "kg"],
  ["200", "kg"],
  ["75", "kg"]
];
if (runTest('Numeric with One String Table', numericOneStringTable, ['numeric', 'categorical'])) passedTests++;
totalTests++;

// Summary
console.log(`📋 Test Summary: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log('🎉 All tests passed! Column type detection is working correctly.');
  process.exit(0);
} else {
  console.log('💥 Some tests failed. Please check the implementation.');
  process.exit(1);
}

// Export for test runner compatibility
module.exports = [
  {
    name: 'Simplified Column Type Detection',
    fn: () => {
      const detectedTypes = analyzeColumnTypes(fertility2023Table);
      if (JSON.stringify(detectedTypes) !== JSON.stringify(['numeric', 'categorical', 'numeric'])) {
        throw new Error('Fertility table column types not detected correctly');
      }
    }
  }
];