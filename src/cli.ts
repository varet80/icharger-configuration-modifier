#!/usr/bin/env node
// CLI wrapper. All file access lives here; src/core stays browser-safe.
//
//   node src/cli.ts show   <in.bak>
//   node src/cli.ts export <in.bak> <out.csv>
//   node src/cli.ts import <in.bak> <edits.csv> <out.bak> [--force]
//   node src/cli.ts diff   <a.bak> <b.bak>
//
// Safety: never writes over the input file; refuses to overwrite any existing output
// unless --force is given.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describeOffset, diffBytes, listRecords, parseBak, getField } from './core/bak.ts';
import { FIELDS } from './core/fields.ts';
import { applyCsv, exportCsv } from './core/csv.ts';

function load(path: string) {
  const bak = parseBak(new Uint8Array(readFileSync(path)));
  for (const w of bak.warnings) console.warn(`warning: ${w}`);
  return bak;
}

function safeWrite(path: string, data: string | Uint8Array, inputs: string[], force: boolean): void {
  const abs = resolve(path);
  if (inputs.some((i) => resolve(i) === abs)) throw new Error('Refusing to overwrite an input file');
  if (existsSync(abs) && !force) throw new Error(`${path} exists; use --force to overwrite`);
  writeFileSync(abs, data);
}

function main(argv: string[]): void {
  const force = argv.includes('--force');
  const args = argv.filter((a) => a !== '--force');
  const [cmd, ...rest] = args;

  switch (cmd) {
    case 'show': {
      const bak = load(rest[0] ?? usage());
      console.log(`records: ${bak.recordCount}, display order: [${bak.order.join(', ')}]`);
      for (const r of listRecords(bak)) {
        const vals = FIELDS.map((f) => `${f.key}=${getField(bak, r.slot, f).toFixed(f.decimals)}`).join(' ');
        console.log(`#${r.slot} ${r.builtIn ? '[built-in]' : '[user]    '} ${r.name}\n    ${vals}`);
      }
      break;
    }
    case 'export': {
      const [inp, out] = rest;
      if (!inp || !out) usage();
      safeWrite(out, exportCsv(load(inp)), [inp], force);
      console.log(`wrote ${out}`);
      break;
    }
    case 'import': {
      const [inp, csv, out] = rest;
      if (!inp || !csv || !out) usage();
      const bak = load(inp);
      const changes = applyCsv(bak, readFileSync(csv, 'utf8'));
      for (const c of changes) console.log(`slot ${c.slot} ${c.column}: ${c.from} -> ${c.to}`);
      console.log(`${changes.length} change(s)`);
      safeWrite(out, bak.bytes, [inp, csv], force);
      console.log(`wrote ${out}. Check values on the charger before using a battery.`);
      break;
    }
    case 'diff': {
      const [a, b] = rest;
      if (!a || !b) usage();
      const A = load(a);
      const B = load(b);
      const diffs = diffBytes(A.bytes, B.bytes);
      if (diffs.length === 0) console.log('files are identical');
      for (const d of diffs) {
        const hex = (v: number) => (v < 0 ? '--' : v.toString(16).padStart(2, '0'));
        console.log(`0x${d.offset.toString(16).padStart(4, '0')}  ${hex(d.a)} -> ${hex(d.b)}  ${describeOffset(d.offset, A.recordCount)}`);
      }
      if (diffs.length) console.log(`${diffs.length} byte(s) differ`);
      break;
    }
    default:
      usage();
  }
}

function usage(): never {
  console.error('usage: show <in.bak> | export <in.bak> <out.csv> | import <in.bak> <edits.csv> <out.bak> [--force] | diff <a.bak> <b.bak>');
  process.exit(2);
}

try {
  main(process.argv.slice(2));
} catch (e) {
  console.error(`error: ${(e as Error).message}`);
  process.exit(1);
}
