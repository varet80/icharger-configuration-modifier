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
  assert.equal(recs[1]!.name, 'LiPo_test'); // display guess
  assert.equal(recs[1]!.nameGuessed, true);
  assert.equal(getName(bak, 1), 'iPo_test'); // stored form
  assert.equal(recs[0]!.nameGuessed, false);
  assert.equal(recs[1]!.builtIn, false);
  assert.equal(recs[0]!.builtIn, true);
  assert.equal(getField(bak, 2, FIELD_BY_KEY.get('battery_type')!), 2);
  assert.equal(getField(bak, 0, FIELD_BY_KEY.get('charge_current_A')!), 8.9);
  assert.equal(getField(bak, 0, FIELD_BY_KEY.get('charge_max_capacity_pct')!), 120);
  assert.equal(getField(bak, 0, FIELD_BY_KEY.get('charge_cut_temp_C')!), 45);
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

test('multi-byte fields are little-endian and do not disturb neighbours', () => {
  const bak = parseBak(syntheticBak());
  setField(bak, 0, 'run_counter', 300);
  assert.equal(bak.bytes[0x1200 + 0x3b], 0x2c); // 300 = 0x012C
  assert.equal(bak.bytes[0x1200 + 0x3c], 0x01);
  assert.equal(bak.bytes[0x1200 + 0x3e], 3); // cells untouched
  assert.throws(() => setField(bak, 0, 'run_counter', 1000), /outside allowed range/);
  setField(bak, 0, 'capacity_mAh', 999900); // needs 4 bytes
  assert.equal(getField(bak, 0, FIELD_BY_KEY.get('capacity_mAh')!), 999900);
  assert.equal(bak.bytes[0x1200 + 0x2a], 0x0f); // 999900 = 0x000F4240
});

test('range checks and read-only fields are enforced', () => {
  const bak = parseBak(syntheticBak());
  assert.throws(() => setField(bak, 0, 'charge_current_A', 50), /outside allowed range/);
  assert.throws(() => setField(bak, 0, 'full_charge_mV', 9000), /outside allowed range/);
  assert.throws(() => setField(bak, 0, 'charge_end_pct', 60), /outside allowed range/);
  assert.throws(() => setField(bak, 0, 'discharge_end_pct', 20), /read-only/);
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

  assert.throws(() => setField(bak, 0, 'log_interval_s', 0.4), /outside allowed range/);
  setField(bak, 0, 'log_interval_s', 1.5);
  assert.equal(bak.bytes[0x1200 + 0x39], 0x0f); // 1.5 s saved 0F at +0x39
  assert.equal(getField(bak, 0, FIELD_BY_KEY.get('log_interval_s')!), 1.5);

  assert.equal(getField(bak, 0, FIELD_BY_KEY.get('balance_start_V')!), 0.2);
  assert.throws(() => setField(bak, 0, 'balance_start_V', 0.1), /read-only/);
});

test('LiPo voltage slots are only editable on LiPo memories', () => {
  const bak = parseBak(syntheticBak());
  setField(bak, 0, 'full_charge_mV', 4150);
  assert.throws(() => setField(bak, 2, 'full_charge_mV', 4000), /not a LiPo memory/);
  assert.throws(() => setField(bak, 2, 'storage_mV', 3800), /not a LiPo memory/);
  assert.throws(() => setField(bak, 2, 'discharge_cutoff_mV', 3500), /not a LiPo memory/);
  assert.throws(() => setField(bak, 0, 'full_charge_mV', 3000), /outside allowed range/);
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

test('guessed first letter is display-only', () => {
  const orig = syntheticBak();
  const bak = parseBak(orig);
  const csv = exportCsv(bak);
  assert.match(csv, /LiPo_test/);
  assert.equal(applyCsv(bak, csv).length, 0); // untouched name is not rewritten
  same(bak.bytes, orig);
  const renamed = parseBak(orig);
  assert.equal(applyCsv(renamed, csv.replace('LiPo_test', 'LiPo_new')).length, 1);
  assert.equal(listRecords(renamed)[1]!.name, 'LiPo_new');
  assert.equal(renamed.bytes[0x1300 + 3], 0x4c); // an edited name keeps its real 'L'
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
