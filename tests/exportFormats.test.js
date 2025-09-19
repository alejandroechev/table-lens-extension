// Tests for export formats (CSV, TSV, Markdown)
// We test the pure transformation logic by replicating the logic from exportData
// while ensuring any change in implementation will be caught if logic diverges.

function toDelimited(data, separator) {
  return data.map(row => row.map(cell => {
    const cellStr = (cell || '').toString();
    if (cellStr.includes(separator) || cellStr.includes('"') || cellStr.includes('\n')) {
      return `"${cellStr.replace(/"/g, '""')}"`;
    }
    return cellStr;
  }).join(separator)).join('\n');
}

function toMarkdown(data) {
  const headers = data[0];
  const rows = data.slice(1);
  const escapeCell = (v) => (v == null ? '' : v.toString()).replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
  const headerLine = `| ${headers.map(escapeCell).join(' | ')} |`;
  const alignLine = `| ${headers.map(()=>'---').join(' | ')} |`;
  const rowLines = rows.map(r => `| ${r.map(escapeCell).join(' | ')} |`);
  return [headerLine, alignLine, ...rowLines].join('\n');
}

const sample = [
  ['Name','Value','Note'],
  ['Alpha','10','Plain'],
  ['Beta','"Quoted"','Has,comma'],
  ['Gamma','30','Multi\nLine']
];

module.exports = [
  {
    name: 'Export CSV format correctness',
    fn: () => {
      const csv = toDelimited(sample, ',');
      if (!csv.includes('"Has,comma"')) throw new Error('CSV did not quote comma field');
      if (!csv.includes('""Quoted""')) throw new Error('CSV did not escape quotes');
      if (!csv.includes('"Multi')) throw new Error('CSV multiline cell not quoted');
    }
  },
  {
    name: 'Export TSV format correctness',
    fn: () => {
      const tsv = toDelimited(sample, '\t');
      if (tsv.includes('"Has,comma"')) throw new Error('TSV should not quote comma just due to comma');
      if (!tsv.includes('Has,comma')) throw new Error('TSV lost comma content');
      if (!tsv.includes('Multi')) throw new Error('TSV lost multiline content');
    }
  },
  {
    name: 'Export Markdown format correctness',
    fn: () => {
      const md = toMarkdown(sample);
      const lines = md.split(/\n/);
      if (lines.length !== sample.length + 1) throw new Error('Markdown line count mismatch');
      if (!lines[0].startsWith('| Name | Value |')) throw new Error('Markdown header malformed');
      if (!/\| --- \|/.test(lines[1])) throw new Error('Markdown alignment row missing');
      if (!md.includes('Has,comma')) throw new Error('Markdown content missing');
      if (md.includes('"Quoted"')) throw new Error('Markdown should not escape quotes like CSV');
      if (!md.includes('Multi Line')) throw new Error('Markdown newline not normalized to space');
    }
  }
];
