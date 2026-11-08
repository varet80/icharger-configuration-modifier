import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { diffBytes, getField, getName, listRecords, parseBak, setField, setName } from '../src/core/bak.ts';
import { FIELD_BY_KEY } from '../src/core/fields.ts';
import { applyCsv, exportCsv } from '../src/core/csv.ts';
import { syntheticBak } from './helpers.ts';

const same = (a: Uint8Array, b: Uint8Array) => assert.equal(diffBytes(a, b).length, 0);

test('parses synthetic file', () => {
  const bak = parseBak(syntheticBak());
  assert.equal(bak.recordCount, 3);
  assert.deepEqual(bak.order, [1, 0, 2]);
  const recs = listRecords(bak);
  assert.equal(recs[0]!.name, 'LiPo');
  assert.equal(recs[1]!.name, 'iPo_test');
  assert.equal(recs[1]!.builtIn, false);
  assert.equal(recs[0]!.builtIn, true);
  assert.equal(getField(bak, 2, FIELD_BY_KEY.get('battery_type')!), 2);
  assert.equal(getField(bak, 0, FIELD_BY_KEY.get('charge_current_A')!), 8.9);
  assert.equal(getField(bak, 0, FIELD_BY_KEY.get('max_capacity_pct')!), 120);
});

test('csv round trip without edits is byte-identical', () => {
  const orig = syntheticBak();
  const bak = parseBak(orig);
  const changes = applyCsv(bak, exportCsv(parseBak(orig)));
  assert.equal(changes.length, 0);
  same(bak.bytes, orig);
});

test('editing one field changes only its bytes', () => {
  const orig = syntheticBak();
  const bak = parseBak(orig);
  setField(bak, 1, 'capacity_mAh', 1200);
  const d = diffBytes(orig, bak.bytes);
  assert.equal(d.length, 2); // 5600 -> 1200 flips both bytes
  assert.ok(d.every((x) => x.offset >= 0x1300 + 0x28 && x.offset < 0x1300 + 0x2a));
});

test('nibble fields do not disturb each other', () => {
  const bak = parseBak(syntheticBak());
  setField(bak, 0, 'regen_mode', 1);
  assert.equal(bak.bytes[0x1200 + 0x3b], 0x12); // high nibble 1, low nibble (run counter) still 2
  setField(bak, 0, 'run_counter', 12);
  assert.equal(bak.bytes[0x1200 + 0x3b], 0x1c);
});

test('range checks and read-only fields are enforced', () => {
  const bak = parseBak(syntheticBak());
  assert.throws(() => setField(bak, 0, 'charge_current_A', 50), /outside allowed range/);
  assert.throws(() => setField(bak, 0, 'full_charge_mV', 9000), /outside allowed range/);
  assert.throws(() => setField(bak, 0, 'charge_end_pct', 20), /read-only/);
  assert.throws(() => setField(bak, 5, 'capacity_mAh', 1), /out of range/);
  assert.throws(() => setField(bak, 0, 'nope', 1), /Unknown field/);
});

test('verified settings from the 3S / 8S / options diffs', () => {
  const bak = parseBak(syntheticBak());
  assert.equal(getField(bak, 0, FIELD_BY_KEY.get('cells')!), 3);
  setField(bak, 0, 'cells', 8);
  assert.equal(bak.bytes[0x1200 + 0x3e], 8); // 8S saved 08 at +0x3E
  setField(bak, 0, 'cells', 0);
  assert.equal(bak.bytes[0x1200 + 0x3e], 0); // Auto
  assert.throws(() => setField(bak, 0, 'cells', 9), /outside allowed range/);

  setField(bak, 0, 'log_interval_s', 1.5);
  assert.equal(bak.bytes[0x1200 + 0x39], 0x0f); // 1.5 s saved 0F at +0x39
  assert.equal(getField(bak, 0, FIELD_BY_KEY.get('log_interval_s')!), 1.5);

  assert.equal(getField(bak, 0, FIELD_BY_KEY.get('balance_start_V')!), 0.2);
  assert.throws(() => setField(bak, 0, 'balance_start_V', 0.1), /read-only/);
});

test('LiPo voltage slots are only editable on LiPo memories', () => {
  const bak = parseBak(syntheticBak());
  setField(bak, 0, 'full_charge_mV', 4150);
  assert.throws(() => setField(bak, 2, 'full_charge_mV', 3550), /not a LiPo memory/);
  assert.throws(() => setField(bak, 2, 'storage_mV', 3300), /not a LiPo memory/);
  assert.throws(() => setField(bak, 0, 'battery_type', 1), /read-only/);
});

test('name editing keeps the missing-first-byte quirk', () => {
  const bak = parseBak(syntheticBak());
  setName(bak, 1, 'iPo_new');
  assert.equal(getName(bak, 1), 'iPo_new');
  assert.equal(bak.bytes[0x1300 + 2], 0);
  setName(bak, 1, 'x'.repeat(28)); // starts at +0x03, so 28 is the limit
  assert.throws(() => setName(bak, 1, 'x'.repeat(29)), /longer/);
  setName(bak, 0, 'y'.repeat(29));
  assert.throws(() => setName(bak, 0, 'y'.repeat(30)), /longer/);
  assert.throws(() => setName(bak, 1, 'bad\u00e9'), /ASCII/);
});

test('csv import applies edits and rejects bad values', () => {
  const bak = parseBak(syntheticBak());
  const csv = exportCsv(bak).replaceAll('8.90', '9.50');
  const changes = applyCsv(bak, csv);
  assert.equal(changes.length, 3); // every row had 8.90
  assert.equal(getField(bak, 0, FIELD_BY_KEY.get('charge_current_A')!), 9.5);
  const bad = exportCsv(parseBak(syntheticBak())).replace('8.90', '99.00');
  assert.throws(() => applyCsv(parseBak(syntheticBak()), bad), /outside allowed range/);
});

// Runs only if you put your own backup at private/DX8_SAVE1.bak (git-ignored).
const real = new URL('../private/DX8_SAVE1.bak', import.meta.url);
test('real backup: csv round trip is byte-identical', { skip: !existsSync(real) }, () => {
  const orig = new Uint8Array(readFileSync(real));
  const bak = parseBak(orig);
  assert.equal(applyCsv(bak, exportCsv(parseBak(orig))).length, 0);
  same(bak.bytes, orig);
  assert.ok(bak.recordCount >= 1);
});
