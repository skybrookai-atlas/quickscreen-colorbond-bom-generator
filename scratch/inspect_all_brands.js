import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

const pricelistDir = 'C:\\Users\\Liam\\Documents\\GitHub\\quickscreen-colorbond-bom-generator\\Pricelist';

function inspectBrands(filename) {
  const filepath = path.join(pricelistDir, filename);
  const workbook = xlsx.readFile(filepath);
  const sheet = workbook.Sheets['Product Master'];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  // Header row is index 9 (Row 10)
  const headers = rows[9] || [];
  const brandIdx = headers.indexOf('Brand');
  const manIdx = headers.indexOf('Manufacturer');
  const typeIdx = headers.indexOf('ProductType');
  const descIdx = headers.indexOf('ShortDescription');
  const skuIdx = headers.indexOf('SupplierSKU');
  
  const brands = new Set();
  const manufacturers = new Set();
  const types = new Set();
  let count = 0;
  
  for (let i = 10; i < rows.length; i++) {
    const row = rows[i];
    if (row && row.length > 0) {
      if (brandIdx !== -1 && row[brandIdx]) brands.add(row[brandIdx]);
      if (manIdx !== -1 && row[manIdx]) manufacturers.add(row[manIdx]);
      if (typeIdx !== -1 && row[typeIdx]) types.add(row[typeIdx]);
      count++;
    }
  }
  
  console.log(`\n======================================================`);
  console.log(`File: ${filename} (Total rows of data: ${count})`);
  console.log(`Brands:`, Array.from(brands));
  console.log(`Manufacturers:`, Array.from(manufacturers));
  console.log(`Product Types:`, Array.from(types).slice(0, 10));
}

async function run() {
  const files = fs.readdirSync(pricelistDir).filter(f => f.endsWith('.xlsx'));
  for (const file of files) {
    inspectBrands(file);
  }
}

run().catch(console.error);
