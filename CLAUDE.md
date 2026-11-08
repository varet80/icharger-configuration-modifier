# DX8 .bak tool — project brief for Claude Code

Unofficial, reverse-engineered tool for the Junsi iCharger DX8 backup file (`.bak`):
inspect, export battery memories to CSV, edit, re-import into a NEW `.bak`, and diff two backups.
A browser GUI (hosted on GitHub Pages) is planned later.

## Ground rules
- `src/core/` must stay free of Node-only APIs (no `fs`, no `process`) so the GUI can reuse it unchanged. File access belongs in `src/cli.ts`.
- The field map is data: `src/core/fields.ts` (mirrored in `docs/fields.csv`). New findings go there first.
- Byte-identical round trip is the invariant. Never rewrite bytes the tool does not understand.
- Never write over the input file. Writers produce a new file.
- Never commit real backups (`*.bak`, `private/`). They hold a serial-like string and the owner's memory names. Tests use synthetic data from `tests/helpers.ts`; the real-file test auto-skips unless `private/DX8_SAVE1.bak` exists.
- Safety-relevant fields (currents, voltages, cell count) are range-checked on write. Fields with `confidence: low` are read-only until verified on the real charger.
- Zero runtime dependencies. Requires Node >= 22.18 (runs `.ts` directly via type stripping). Tests use `node:test`.

## Commands
- `npm test` — run tests
- `npm run typecheck` — needs `npm install` first (typescript, @types/node)
- `node src/cli.ts show|export|import|diff ...` (see README)

## Current knowledge
See `docs/format.md`. Confidence levels: high = confirmed by memory names / manual defaults, medium = inferred from other memories, low = guess.

## Next steps (owner is doing the charger-side work)
1. Owner saves a baseline backup, then one backup per single changed setting on the charger (name files after the change, e.g. `safety_timer_60min.bak`).
2. For each pair run `node src/cli.ts diff baseline.bak changed.bak`, then add or correct the field in `src/core/fields.ts` and `docs/fields.csv`, plus a test.
3. Decode the 0xB4-byte global settings block at 0x200 the same way.
4. Test restoring an unedited round-trip file on the charger first, then one single-field edit, checking the charger screen before using any battery.
5. Browser GUI (Vite or plain HTML) on top of `src/core/`, published with GitHub Pages.
6. Open question: confirm there is no checksum (an edited file accepted by the charger is the real test) and the exact name-field length.
