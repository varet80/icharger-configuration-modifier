import { FILE_SIZE, ORDER_OFFSET, RECORDS_OFFSET, RECORD_SIZE } from '../src/core/bak.ts';

/** Builds a small synthetic backup (3 records) shaped like a real one. Never contains personal data. */
export function syntheticBak(): Uint8Array {
  const b = new Uint8Array(FILE_SIZE).fill(0xff);
  b.fill(0, 0, 0x200); // header area
  b.set([3, 0, 1, 0, 2], ORDER_OFFSET); // count=3, pad, order [1,0,2]

  const rec = (slot: number, marker: number, nameAt: number, name: string) => {
    const o = RECORDS_OFFSET + slot * RECORD_SIZE;
    b.fill(0xff, o, o + RECORD_SIZE);
    b.fill(0, o + 2, o + 0x2e);
    b[o] = marker & 0xff; b[o + 1] = marker >> 8;
    for (let i = 0; i < name.length; i++) b[o + nameAt + i] = name.charCodeAt(i);
    const u16 = (off: number, v: number) => { b[o + off] = v & 0xff; b[o + off + 1] = v >> 8; };
    u16(0x28, 5600); b[o + 0x39] = 10; b[o + 0x3b] = 0x02; b[o + 0x3d] = 0; b[o + 0x3e] = 3; b[o + 0x3f] = 0; b[o + 0x48] = 2;
    u16(0x50, 4200); u16(0x56, 3850); u16(0x5c, 3300);
    u16(0x62, 890); u16(0x64, 1120); u16(0x66, 10); u16(0x9a, 12000);
  };
  rec(0, 0x0000, 2, 'LiPo');
  rec(2, 0x0000, 2, 'LiFe');
  b[RECORDS_OFFSET + 2 * RECORD_SIZE + 0x3d] = 2; // battery type LiFe
  rec(1, 0x55aa, 3, 'iPo_test'); // marker bytes AA 55; 0x00 at +2 mimics the lost leading character
  return b;
}
