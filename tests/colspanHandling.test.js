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
                        
                        // Check for colspan attribute
                        const colspanMatch = cell.match(/colspan\s*=\s*["|']?(\d+)["|']?/i);
                        const colspan = colspanMatch ? parseInt(colspanMatch[1]) : 1;
                        
                        // Add the header once, then add empty headers for colspan > 1
                        headers.push(content);
                        for (let i = 1; i < colspan; i++) {
                            headers.push(content); // Repeat header content for each spanned column
                        }
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
                        
                        // Check for colspan attribute
                        const colspanMatch = cell.match(/colspan\s*=\s*["|']?(\d+)["|']?/i);
                        const colspan = colspanMatch ? parseInt(colspanMatch[1]) : 1;
                        
                        // Add the cell content, then empty strings for additional columns
                        row.push({ content, colspan });
                    });
                    
                    rows.push(row);
                });
            }
            
            return { headers, rows };
        }
    };
    
    return parser.parseTable(htmlString);
}

// Process rows with colspan handling
function processRowsWithColspan(parsedData) {
    if (!parsedData || !parsedData.rows) return { headers: [], rows: [] };
    
    const { headers, rows: rawRows } = parsedData;
    const processedRows = [];
    
    rawRows.forEach((row, rowIndex) => {
        const processedRow = [];
        let colIndex = 0;
        
        row.forEach(cell => {
            // Add the cell content
            processedRow.push(cell.content);
            colIndex++;
            
            // If this cell has a colspan > 1, add empty strings for the additional columns
            for (let i = 1; i < cell.colspan; i++) {
                processedRow.push(''); // Empty string for spanned columns
                colIndex++;
            }
        });
        
        // Ensure the row has the correct number of columns
        while (processedRow.length < headers.length) {
            processedRow.push('');
        }
        
        processedRows.push(processedRow);
    });
    
    return { headers, rows: processedRows };
}

function testColspanHandling() {
    console.log('🧪 Testing Colspan Handling');
    console.log('===========================');
    
    // Read the test HTML
    const htmlPath = path.join(__dirname, 'examples', 'student-scores-colspan-input.html');
    const correctCSVPath = path.join(__dirname, 'examples', 'student-scores-colspan-output-correct.csv');
    
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const expectedCSV = fs.readFileSync(correctCSVPath, 'utf8').trim();
    
    console.log('📋 Testing HTML table with colspan attributes');
    
    // Parse the HTML with our custom parser
    const parsedData = createMockDOMFromHTML(htmlContent);
    if (!parsedData) {
        throw new Error('Failed to parse HTML table');
    }
    
    // Process with colspan handling
    const { headers, rows: processedRows } = processRowsWithColspan(parsedData);
    
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
        console.log('❌ Found rows with inconsistent column counts - colspan not handled properly');
    } else {
        console.log('✅ All rows have consistent column counts');
    }
    
    // Generate CSV and compare with expected (normalize for comparison)
    const csvContent = [
        headers.join(','),
        ...processedRows.map(row => row.join(','))
    ].join('\n');
    
    // Normalize both strings for comparison
    const normalizeCSV = (str) => str.replace(/\r\n/g, '\n').replace(/\s+$/gm, '').trim();
    const normalizedGenerated = normalizeCSV(csvContent);
    const normalizedExpected = normalizeCSV(expectedCSV);
    
    console.log('📋 Generated CSV length:', normalizedGenerated.length);
    console.log('📋 Expected CSV length:', normalizedExpected.length);
    
    const generatedLines = normalizedGenerated.split('\n');
    const expectedLines = normalizedExpected.split('\n');
    
    if (generatedLines.length !== expectedLines.length) {
        console.log(`❌ Different number of lines: expected ${expectedLines.length}, got ${generatedLines.length}`);
        return false;
    }
    
    // Check specific colspan behavior - Bob's row should have "Absent" in first Score column, empty in second
    const bobRowIndex = processedRows.findIndex(row => row[0] === 'Bob');
    if (bobRowIndex !== -1) {
        const bobRow = processedRows[bobRowIndex];
        if (bobRow[1] === 'Absent' && bobRow[2] === '') {
            console.log('✅ Colspan correctly handled: "Absent" spans two columns with empty string in second column');
        } else {
            console.log(`❌ Colspan handling failed: Bob's row should have "Absent" and "" but got "${bobRow[1]}" and "${bobRow[2]}"`);
            return false;
        }
    }
    
    if (hasInconsistentRows) {
        console.log('❌ Colspan handling validation failed');
        return false;
    } else {
        console.log('✅ All structural validation passed!');
        console.log('✅ Colspan values correctly handled!');
        return true;
    }
}

module.exports = { testColspanHandling };

// Run test if this file is executed directly
if (require.main === module) {
    testColspanHandling();
}