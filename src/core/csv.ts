// CSV export / import. Pure string in, string out (no fs).
//
// Export columns: slot, marker, name, <one column per field in fields.ts>, raw_hex
// Import only applies cells whose value DIFFERS from what the file currently holds,
// so an unedited CSV produces a byte-identical .bak. raw_hex is informational and is
// never written back; every byte not covered by a field or the name is left untouched.

import { FIELDS } from './fields.ts';
import { getDisplayName, getField, listRecords, setField, setName, recordOffset, RECORD_SIZE, type Bak } from './bak.ts';

function quote(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function exportCsv(bak: Bak): string {
  const header = ['slot', 'marker', 'name', ...FIELDS.map((f) => f.key), 'raw_hex'];
  const lines = [header.join(',')];
  for (const r of listRecords(bak)) {
    const row = [
      String(r.slot),
      '0x' + r.marker.toString(16).padStart(4, '0'),
      quote(r.name),
      ...FIELDS.map((f) => getField(bak, r.slot, f).toFixed(f.decimals)),
      toHex(bak.bytes.subarray(recordOffset(r.slot), recordOffset(r.slot) + RECORD_SIZE)),
    ];
    lines.push(row.join(','));
  }
  return lines.join('\n') + '\n';
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((x) => x !== '')) rows.push(row); }
  return rows;
}

export interface Change { slot: number; column: string; from: string; to: string }

/** Applies edits from CSV text onto `bak` (mutates it). Throws on the first invalid cell. */
export function applyCsv(bak: Bak, csvText: string): Change[] {
  const rows = parseCsv(csvText);
  if (rows.length === 0) throw new Error('CSV is empty');
  const header = rows[0]!;
  const col = (name: string) => header.indexOf(name);
  if (col('slot') < 0) throw new Error('CSV has no "slot" column');
  const changes: Change[] = [];

  for (const [n, row] of rows.slice(1).entries()) {
    const slot = Number(row[col('slot')]);
    if (!Number.isInteger(slot) || slot < 0 || slot >= bak.recordCount) {
      throw new Error(`Row ${n + 2}: invalid slot "${row[col('slot')]}"`);
    }

    const nameIdx = col('name');
    if (nameIdx >= 0) {
      const want = row[nameIdx] ?? '';
      const have = getDisplayName(bak, slot).name;
      if (want !== have) {
        setName(bak, slot, want);
        changes.push({ slot, column: 'name', from: have, to: want });
      }
    }

    for (const f of FIELDS) {
      const idx = col(f.key);
      if (idx < 0 || row[idx] === undefined || row[idx] === '') continue;
      const want = Number(row[idx]);
      const have = getField(bak, slot, f);
      if (Number.isNaN(want)) throw new Error(`Row ${n + 2}, ${f.key}: "${row[idx]}" is not a number`);
      if (Math.abs(want - have) > 1e-9) {
        setField(bak, slot, f.key, want);
        changes.push({ slot, column: f.key, from: have.toFixed(f.decimals), to: want.toFixed(f.decimals) });
      }
    }
  }
  return changes;
}
