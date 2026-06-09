import { describe, it, expect } from 'vitest';
import { parseCin7MassDownload } from '../parsers/cin7-mass-download';
import { utils, write } from 'xlsx';

describe('Cin7 Mass-Download Parser', () => {
  it('parses a mock Cin7 master worksheet correctly', async () => {
    const wsData = [
      [], [], [], // Empty leading rows
      ['ProductId', 'ManufacturerSKU', 'SupplierSKU', 'ShortDescription', 'Size', 'Colour', 'Custom1', 'Custom2', 'Custom3', 'BuyPriceEx', 'RRP'],
      [12345, 'XP-6100-S65-B', 'SUPP-XP-65', 'QSHS Slat 65mm Black Satin', '6100mm', 'Black Satin', 'slats', '65mm', 'horizontal', 10.50, 19.99],
      [12346, 'VS-3000-POST-G', '', 'VS Post 3000mm Woodland Grey', '3000mm', 'Woodland Grey', 'posts', 'vertical', '', 20.00, null],
    ];

    const ws = utils.aoa_to_sheet(wsData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Product Master');

    const wbBuffer = write(wb, { type: 'array', bookType: 'xlsx' });

    const results = await parseCin7MassDownload(wbBuffer);

    expect(results).toHaveLength(2);

    const row1 = results[0];
    expect(row1.product.sku).toBe('XP-6100-S65-B');
    expect(row1.product.name).toBe('QSHS Slat 65mm Black Satin');
    expect(row1.product.category).toBe('slat');
    expect(row1.product.system_types).toContain('QSHS');
    expect(row1.product.colours).toEqual(['black satin']);
    expect(row1.prices).toHaveLength(3);
    
    const t1 = row1.prices.find(p => p.tier_code === 'tier1');
    expect(t1?.price_cents).toBe(1999);

    const row2 = results[1];
    expect(row2.product.sku).toBe('VS-3000-POST-G');
    expect(row2.product.name).toBe('VS Post 3000mm Woodland Grey');
    expect(row2.product.category).toBe('post');
    expect(row2.product.system_types).toContain('VS');
    
    const t1_2 = row2.prices.find(p => p.tier_code === 'tier1');
    expect(t1_2?.price_cents).toBe(3000);
  });
});
