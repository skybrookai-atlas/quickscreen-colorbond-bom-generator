import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

const file = 'C:\\Users\\Liam\\Documents\\GitHub\\quickscreen-colorbond-bom-generator\\Pricelist\\MassDownloadProducts_20260603_1003AM.xlsx';
const workbook = xlsx.readFile(file);
const sheet = workbook.Sheets['Product Master'];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log("Printing first 15 rows of the workbook:");
for (let i = 0; i < Math.min(rows.length, 15); i++) {
  console.log(`Row ${i + 1}:`, rows[i]);
}
