import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

const pricelistDir = 'C:\\Users\\Liam\\Documents\\GitHub\\quickscreen-colorbond-bom-generator\\Pricelist';

function inspectFile(filename) {
  const filepath = path.join(pricelistDir, filename);
  const workbook = xlsx.readFile(filepath);
  const sheet = workbook.Sheets['Product Master'];
  
  // Convert sheet to 2D array
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  // Find the header row (typically has Product Code or Name)
  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && row.includes('Product Code') || (row && row.includes('Code') && row.includes('Name'))) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    // If not found, look at row 5 (index 5)
    headerRowIndex = 5;
  }
  
  const headers = rows[headerRowIndex] || [];
  console.log(`\n======================================================`);
  console.log(`File: ${filename}`);
  console.log(`Header Row Index: ${headerRowIndex}`);
  console.log(`Headers (first 8):`, headers.slice(0, 8));
  
  // Show first 5 data rows
  console.log(`First 3 data rows:`);
  let shown = 0;
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && row.length > 0 && row.some(x => x !== null && x !== '')) {
      console.log(`  Row ${i + 1}: Code="${row[headers.indexOf('Product Code') || 0]}", Name="${row[headers.indexOf('Name') || 1]}", Supplier="${row[headers.indexOf('Supplier') || headers.indexOf('Default Supplier') || -1] || 'N/A'}"`);
      shown++;
      if (shown >= 3) break;
    }
  }
}

async function run() {
  const files = fs.readdirSync(pricelistDir).filter(f => f.endsWith('.xlsx'));
  for (const file of files) {
    inspectFile(file);
  }
}

run().catch(console.error);
