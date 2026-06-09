import { parseCin7MassDownload } from './cin7-mass-download';
import { parseGenericCsv } from './generic-csv';
import type { ParsedRow } from '../types';

export interface ParserRegistryEntry {
  slug: string;
  name: string;
  parse: (fileBuffer: ArrayBuffer) => Promise<ParsedRow[]>;
}

export const PARSERS: ParserRegistryEntry[] = [
  {
    slug: 'cin7_mass_download',
    name: 'Cin7 Inventory Mass-Download (XLSX)',
    parse: parseCin7MassDownload,
  },
  {
    slug: 'generic_csv',
    name: 'Generic CSV Price List',
    parse: parseGenericCsv,
  },
];

export function getParser(slug: string): ParserRegistryEntry | undefined {
  return PARSERS.find((p) => p.slug === slug);
}
export * from './cin7-mass-download';
export * from './generic-csv';
