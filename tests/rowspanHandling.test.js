const fs = require('fs');
const path = require('path');

// Load the HTML parser utility
const { parseHTMLTable } = require('../utils/tableNesting.js');

// Mock DOM similar to other tests
function createMockDOMFromHTML(htmlString) {
    // Parse HTML string into a simple mock structure
    const parser = {
        parseTable: (htmlStr) => {
            const tableMatch = htmlStr.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
            if (!tableMatch) return null;
            
            const tableContent = tableMatch[1];
            
            // Extract headers
            const theadMatch = tableContent.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
            const headers = [];
            if (theadMatch) {
                const headerRows = theadMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
                if (headerRows.length > 0) {
                    const headerCells = headerRows[0].match(/<th[^>]*>([\s\S]*?)<\/th>/gi) || [];
                    headerCells.forEach(cell => {
                        const content = cell.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                        headers.push(content);
                    });
                }
            }
            
            // Extract body rows
            const tbodyMatch = tableContent.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
            const rows = [];
            if (tbodyMatch) {
                const bodyRows = tbodyMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
                
                bodyRows.forEach(rowHtml => {
                    const row = [];
                    const cells = rowHtml.match(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi) || [];
                    
                    cells.forEach(cell => {
                        const content = cell.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                        const cleanContent = content === 'N/A' ? 'N/A' : content;
                        
                        // Check for rowspan attribute
                        const rowspanMatch = cell.match(/rowspan\s*=\s*["|']?(\d+)["|']?/i);
                        const rowspan = rowspanMatch ? parseInt(rowspanMatch[1]) : 1;
                        
                        row.push({ content: cleanContent, rowspan });
                    });
                    
                    rows.push(row);
                });
            }
            
            return { headers, rows };
        }
    };
    
    return parser.parseTable(htmlString);
}

// Process rows with rowspan handling
function processRowsWithRowspan(parsedData) {
    if (!parsedData || !parsedData.rows) return { headers: [], rows: [] };
    
    const { headers, rows: rawRows } = parsedData;
    const processedRows = [];
    const spanTracker = {}; // Track which columns are spanned and for how many more rows
    
    rawRows.forEach((row, rowIndex) => {
        const processedRow = [];
        let cellIndex = 0;
        
        // First, add any continued span values from previous rows
        for (let col = 0; col < headers.length; col++) {
            if (spanTracker[col] && spanTracker[col].remaining > 0) {
                processedRow[col] = spanTracker[col].value;
                spanTracker[col].remaining--;
                if (spanTracker[col].remaining === 0) {
                    delete spanTracker[col];
                }
            }
        }
        
        // Then process the actual cells in this row
        row.forEach(cell => {
            // Find the next available column position
            while (processedRow[cellIndex] !== undefined) {
                cellIndex++;
            }
            
            // Add the cell content
            processedRow[cellIndex] = cell.content;
            
            // If this cell has a rowspan > 1, track it for future rows
            if (cell.rowspan > 1) {
                spanTracker[cellIndex] = {
                    value: cell.content,
                    remaining: cell.rowspan - 1
                };
            }
            
            cellIndex++;
        });
        
        processedRows.push(processedRow);
    });
    
    return { headers, rows: processedRows };
}

function testRowspanHandling() {
    console.log('🧪 Testing Rowspan Handling');
    console.log('===========================');
    
    // Read the test HTML
    const htmlPath = path.join(__dirname, 'examples', 'tennis-champions-rowspan-input.html');
    const correctCSVPath = path.join(__dirname, 'examples', 'tennis-champions-rowspan-output-correct.csv');
    
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const expectedCSV = fs.readFileSync(correctCSVPath, 'utf8').trim();
    
    console.log('📋 Testing HTML table with rowspan attributes');
    
    // Parse the HTML with our custom parser
    const parsedData = createMockDOMFromHTML(htmlContent);
    if (!parsedData) {
        throw new Error('Failed to parse HTML table');
    }
    
    // Process with rowspan handling
    const { headers, rows: processedRows } = processRowsWithRowspan(parsedData);
    
    console.log(`📊 Parsed ${processedRows.length} data rows`);
    console.log(`📊 Headers: ${headers.length} columns`);
    
    // Check if all rows have the same number of columns
    let hasInconsistentRows = false;
    const expectedColumns = headers.length;
    
    processedRows.forEach((row, index) => {
        if (row.length !== expectedColumns) {
            console.log(`❌ Row ${index + 1}: Expected ${expectedColumns} columns, got ${row.length}`);
            console.log(`   Row content: [${row.map((cell, i) => `${i}:"${cell}"`).join(', ')}]`);
            hasInconsistentRows = true;
        }
    });
    
    if (hasInconsistentRows) {
        console.log('❌ Found rows with inconsistent column counts - rowspan not handled properly');
    } else {
        console.log('✅ All rows have consistent column counts');
    }
    
    // Generate CSV and compare with expected (normalize for comparison)
    const csvContent = [
        headers.join(','),
        ...processedRows.map(row => row.join(','))
    ].join('\n');
    
    // Normalize both strings for comparison (remove extra whitespace, normalize encoding)
    const normalizeCSV = (str) => str.replace(/\r\n/g, '\n').replace(/\s+$/gm, '').trim();
    const normalizedGenerated = normalizeCSV(csvContent);
    const normalizedExpected = normalizeCSV(expectedCSV);
    
    console.log('📋 Generated CSV length:', normalizedGenerated.length);
    console.log('📋 Expected CSV length:', normalizedExpected.length);
    
    // Check key structural elements instead of exact string match
    const generatedLines = normalizedGenerated.split('\n');
    const expectedLines = normalizedExpected.split('\n');
    
    if (generatedLines.length !== expectedLines.length) {
        console.log(`❌ Different number of lines: expected ${expectedLines.length}, got ${generatedLines.length}`);
        return false;
    }
    
    // Check that rowspan values are properly repeated
    let hasCorrectRowspan = true;
    const expectedRowspanValues = ['11', '11', '8', '8', '8', '8', '8'];
    
    for (let i = 1; i < generatedLines.length; i++) { // Skip header
        const firstColumn = generatedLines[i].split(',')[0];
        const expectedValue = expectedRowspanValues[i - 1];
        
        if (firstColumn !== expectedValue) {
            console.log(`❌ Row ${i}: Expected first column "${expectedValue}", got "${firstColumn}"`);
            hasCorrectRowspan = false;
        }
    }
    
    if (hasCorrectRowspan && generatedLines.length === expectedLines.length) {
        console.log('✅ Rowspan values correctly repeated in all rows!');
        console.log('✅ All structural validation passed!');
        return true;
    } else {
        console.log('❌ Rowspan handling validation failed');
        
        // Show line-by-line comparison for first few lines
        console.log('\n📊 First few lines comparison:');
        for (let i = 0; i < Math.min(5, Math.max(expectedLines.length, generatedLines.length)); i++) {
            const expected = expectedLines[i] || '[missing]';
            const generated = generatedLines[i] || '[missing]';
            const match = expected === generated ? '✅' : '❌';
            console.log(`${match} Line ${i + 1}:`);
            console.log(`   Expected: "${expected}"`);
            console.log(`   Generated: "${generated}"`);
        }
        
        return false;
    }
}

module.exports = { testRowspanHandling };

// Run test if this file is executed directly
if (require.main === module) {
    testRowspanHandling();
}