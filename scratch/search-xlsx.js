import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';

const pricelistDir = 'c:/Users/Liam/Documents/GitHub/quickscreen-colorbond-bom-generator/Pricelist';

async function main() {
  const files = fs.readdirSync(pricelistDir).filter(f => f.endsWith('.xlsx'));
  console.log(`Searching for timber terms in ${files.length} Excel files...`);

  const terms = ['paling', 'pine', 'hardwood', 'treated', 'rail', 'post'];

  for (const file of files) {
    const filePath = path.join(pricelistDir, file);
    const workbook = xlsx.readFile(filePath);
    let matchedInFile = false;

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
      
      let termMatches = {};
      terms.forEach(t => { termMatches[t] = 0; });

      for (const row of rawData) {
        if (!row) continue;
        const rowStr = row.map(cell => String(cell || '')).join(' ').toLowerCase();
        
        terms.forEach(term => {
          if (rowStr.includes(term)) {
            termMatches[term]++;
          }
        });
      }

      const found = Object.values(termMatches).some(c => c > 0);
      if (found) {
        matchedInFile = true;
        console.log(`\nFile: ${file}, Sheet: ${sheetName}`);
        Object.entries(termMatches).forEach(([term, count]) => {
          if (count > 0) {
            console.log(`  - "${term}": found ${count} times`);
          }
        });
      }
    }
  }
}

main().catch(console.error);
