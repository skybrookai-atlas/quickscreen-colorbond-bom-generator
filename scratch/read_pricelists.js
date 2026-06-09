import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

const pricelistDir = 'C:\\Users\\Liam\\Documents\\GitHub\\quickscreen-colorbond-bom-generator\\Pricelist';

function inspectFile(filename) {
  const filepath = path.join(pricelistDir, filename);
  console.log(`\n======================================================`);
  console.log(`Inspecting file: ${filename} (${fs.statSync(filepath).size} bytes)`);
  
  const workbook = xlsx.readFile(filepath);
  console.log(`Sheets:`, workbook.SheetNames);
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = xlsx.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const rowCount = range.e.r - range.s.r + 1;
    const colCount = range.e.c - range.s.c + 1;
    console.log(`  Sheet "${sheetName}": ${rowCount} rows, ${colCount} columns`);
    
    // Read first few rows
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }).slice(0, 5);
    console.log(`  Sample data (first 5 rows):`);
    data.forEach((row, i) => {
      console.log(`    Row ${i + 1}:`, row.slice(0, 8));
    });
  }
}

async function run() {
  const files = fs.readdirSync(pricelistDir).filter(f => f.endsWith('.xlsx'));
  console.log(`Found ${files.length} Excel files in ${pricelistDir}:`, files);
  
  for (const file of files) {
    inspectFile(file);
  }
}

run().catch(console.error);
