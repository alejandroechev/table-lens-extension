const { reheaderTable } = require('../utils/reheader.js');

function run() {
  const original = [
    ['Top','Meta','Info'],
    ['Year','Country','Value'],
    ['2023','Chile','10'],
    ['2024','Peru','11']
  ];
  const result = reheaderTable(original, 1);
  if (result[0][0] !== 'Year' || result.length !== 4) {
    console.error('❌ Reheader failed basic reassignment');
    process.exit(1);
  }
  // Ensure previous header row now part of data (order after chosen header retained)
  const flattened = result.slice(1).map(r=>r.join('|')).join('::');
  if (!flattened.includes('Top|Meta|Info')) {
    console.error('❌ Original first row not present in data rows');
    process.exit(1);
  }
  console.log('✅ Reheader utility test passed');
}

run();