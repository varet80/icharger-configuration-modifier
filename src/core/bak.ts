// Core parser/editor for DX8 .bak files. No Node-only APIs here (no fs),
// so this module can be reused unchanged in a browser GUI.

import { BATTERY_TYPE_OFFSET, FIELDS, FIELD_BY_KEY, type FieldDef } from './fields.ts';

export const FILE_SIZE = 0x5a00;
export const ORDER_OFFSET = 0x0a00;
export const RECORDS_OFFSET = 0x1200;
export const RECORD_SIZE = 0x100;
export const MAX_MEMORIES = 64; // 10 built-in + 54 custom, per the DX8 manual
export const USER_MARKER = 0x55aa; // stored as bytes AA 55, read little-endian

const NAME_END = 0x28; // exclusive; the capacity field starts here
const NAME_LIMIT = 0x1f; // exclusive; a 29-char name from +0x02 ends at +0x1E, +0x1F stays 0

export interface MemoryRecord {
  slot: number; // physical position in the file (0-based)
  offset: number; // absolute file offset of the record
  marker: number;
  builtIn: boolean;
  name: string;
}

export interface Bak {
  bytes: Uint8Array; // private copy; mutated only through the setters below
  recordCount: number;
  order: number[]; // display order, as stored in the order table
  warnings: string[];
}

export function parseBak(input: Uint8Array): Bak {
  const bytes = Uint8Array.from(input);
  const warnings: string[] = [];
  if (bytes.length !== FILE_SIZE) {
    warnings.push(`Unexpected file size ${bytes.length} (expected ${FILE_SIZE}). Layout may differ.`);
  }
  if (bytes.length < ORDER_OFFSET + 2) throw new Error('File too small to be a DX8 backup');
  const recordCount = bytes[ORDER_OFFSET]!;
  if (recordCount > MAX_MEMORIES) throw new Error(`Record count ${recordCount} exceeds ${MAX_MEMORIES}`);
  if (RECORDS_OFFSET + recordCount * RECORD_SIZE > bytes.length) {
    throw new Error('Record area runs past end of file');
  }
  const order = Array.from(bytes.subarray(ORDER_OFFSET + 2, ORDER_OFFSET + 2 + recordCount));
  const sorted = [...order].sort((a, b) => a - b);
  if (sorted.some((v, i) => v !== i)) warnings.push('Order table is not a permutation of 0..count-1');
  return { bytes, recordCount, order, warnings };
}

export function recordOffset(slot: number): number {
  return RECORDS_OFFSET + slot * RECORD_SIZE;
}

function assertSlot(bak: Bak, slot: number): void {
  if (!Number.isInteger(slot) || slot < 0 || slot >= bak.recordCount) {
    throw new Error(`Slot ${slot} out of range (0..${bak.recordCount - 1})`);
  }
}

function nameStart(bak: Bak, slot: number): number {
  // Quirk: user-saved records often have 0x00 in the first name byte (the leading "L" is lost).
  return bak.bytes[recordOffset(slot) + 2] === 0 ? 3 : 2;
}

export function getName(bak: Bak, slot: number): string {
  assertSlot(bak, slot);
  const base = recordOffset(slot);
  let s = '';
  for (let i = nameStart(bak, slot); i < NAME_END; i++) {
    const c = bak.bytes[base + i]!;
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

export function setName(bak: Bak, slot: number, name: string): void {
  assertSlot(bak, slot);
  if (!/^[\x20-\x7e]*$/.test(name)) throw new Error('Name must be printable ASCII');
  const base = recordOffset(slot);
  const start = nameStart(bak, slot);
  const max = NAME_LIMIT - start;
  if (name.length > max) throw new Error(`Name longer than ${max} characters`);
  for (let i = start; i < NAME_END; i++) bak.bytes[base + i] = 0;
  for (let i = 0; i < name.length; i++) bak.bytes[base + start + i] = name.charCodeAt(i);
}

export function listRecords(bak: Bak): MemoryRecord[] {
  const out: MemoryRecord[] = [];
  for (let slot = 0; slot < bak.recordCount; slot++) {
    const offset = recordOffset(slot);
    const marker = bak.bytes[offset]! | (bak.bytes[offset + 1]! << 8);
    out.push({ slot, offset, marker, builtIn: marker !== USER_MARKER, name: getName(bak, slot) });
  }
  return out;
}

function readRaw(bytes: Uint8Array, abs: number, kind: FieldDef['kind']): number {
  switch (kind) {
    case 'u32': return (bytes[abs]! | (bytes[abs + 1]! << 8) | (bytes[abs + 2]! << 16) | (bytes[abs + 3]! << 24)) >>> 0;
    case 'u16': return bytes[abs]! | (bytes[abs + 1]! << 8);
    case 'u8': return bytes[abs]!;
  }
}

function writeRaw(bytes: Uint8Array, abs: number, kind: FieldDef['kind'], raw: number): void {
  switch (kind) {
    case 'u32': bytes[abs] = raw & 0xff; bytes[abs + 1] = (raw >>> 8) & 0xff; bytes[abs + 2] = (raw >>> 16) & 0xff; bytes[abs + 3] = (raw >>> 24) & 0xff; break;
    case 'u16': bytes[abs] = raw & 0xff; bytes[abs + 1] = (raw >> 8) & 0xff; break;
    case 'u8': bytes[abs] = raw & 0xff; break;
  }
}

export function getField(bak: Bak, slot: number, def: FieldDef): number {
  assertSlot(bak, slot);
  const raw = readRaw(bak.bytes, recordOffset(slot) + def.offset, def.kind);
  return Math.round(raw * def.scale * 1e6) / 1e6;
}

export function setField(bak: Bak, slot: number, key: string, value: number): void {
  assertSlot(bak, slot);
  const def = FIELD_BY_KEY.get(key);
  if (!def) throw new Error(`Unknown field "${key}"`);
  if (!def.writable) throw new Error(`Field "${key}" is read-only (confidence: ${def.confidence})`);
  if (!Number.isFinite(value)) throw new Error(`Field "${key}": value is not a number`);
  if (value < def.min || value > def.max) {
    throw new Error(`Field "${key}": ${value} outside allowed range ${def.min}..${def.max}`);
  }
  if (def.lipoOnly && bak.bytes[recordOffset(slot) + BATTERY_TYPE_OFFSET] !== 0) {
    throw new Error(`Field "${key}" holds the LiPo value; slot ${slot} is not a LiPo memory`);
  }
  const raw = Math.round(value / def.scale);
  writeRaw(bak.bytes, recordOffset(slot) + def.offset, def.kind, raw);
}

export interface ByteDiff { offset: number; a: number; b: number }

export function diffBytes(a: Uint8Array, b: Uint8Array): ByteDiff[] {
  const out: ByteDiff[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? -1;
    const y = b[i] ?? -1;
    if (x !== y) out.push({ offset: i, a: x, b: y });
  }
  return out;
}

/** Human-readable location of an absolute offset, using the field table where it matches. */
export function describeOffset(offset: number, recordCount = MAX_MEMORIES): string {
  if (offset < 0x50) return 'header (0x00-0x4F)';
  if (offset < 0x200) return 'header padding';
  if (offset < 0x2b4) return `global settings block (+0x${(offset - 0x200).toString(16)})`;
  if (offset >= ORDER_OFFSET && offset < ORDER_OFFSET + 2 + MAX_MEMORIES) {
    const i = offset - ORDER_OFFSET;
    return i === 0 ? 'order table: record count' : i === 1 ? 'order table: pad' : `order table entry ${i - 2}`;
  }
  if (offset >= RECORDS_OFFSET && offset < RECORDS_OFFSET + MAX_MEMORIES * RECORD_SIZE) {
    const slot = Math.floor((offset - RECORDS_OFFSET) / RECORD_SIZE);
    const rel = (offset - RECORDS_OFFSET) % RECORD_SIZE;
    const tag = slot < recordCount ? '' : ' (beyond record count)';
    if (rel < 2) return `record ${slot}${tag}: marker`;
    if (rel < NAME_END) return `record ${slot}${tag}: name area (+0x${rel.toString(16)})`;
    const f = FIELDS.find((d) => rel >= d.offset && rel < d.offset + (d.kind === 'u32' ? 4 : d.kind === 'u16' ? 2 : 1));
    return `record ${slot}${tag}: ${f ? f.key : 'UNMAPPED'} (+0x${rel.toString(16)})`;
  }
  return 'unused/erased area';
}
