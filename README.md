# dx8-bak-tool

Unofficial tool to inspect, export to CSV, edit and re-import battery memories from an
iCharger DX8 `.bak` backup. Not affiliated with Junsi. The file format is reverse-engineered
from a single backup, so treat it as experimental and keep your original backups.

## Requirements
Node.js >= 22.18. No runtime dependencies. (`npm install` is only needed for `npm run typecheck`.)

## Usage
```
node src/cli.ts show   private/DX8_SAVE1.bak
node src/cli.ts export private/DX8_SAVE1.bak memories.csv
# edit memories.csv in a spreadsheet or editor
node src/cli.ts import private/DX8_SAVE1.bak memories.csv private/edited.bak
node src/cli.ts diff   private/DX8_SAVE1.bak private/edited.bak
```
- Import never writes over its inputs and refuses to overwrite an existing file without `--force`.
- Only cells you actually changed are applied; every other byte is copied through untouched.
- Values are range-checked. Low-confidence fields are read-only.
- After restoring an edited file on the charger, check currents, voltages and cell count on its screen before connecting a battery.

## Reference
Setting names and ranges come from the DX8 English manual 1.0.2 (`icharger dx8 en manual.pdf`). What is mapped and what is still unknown: `docs/unknowns.md`.

## Tests
```
npm test
```
Uses synthetic data. To also run the real-file round-trip test, put your backup at
`private/DX8_SAVE1.bak` (the folder is git-ignored; never commit real backups).

## Layout
```
src/core/   parser, field table, CSV logic (no fs, reusable in a browser GUI)
src/cli.ts  command line wrapper
docs/       format.md (what is known), fields.csv (field map with confidence)
tests/
```
See `CLAUDE.md` for the project brief and next steps.

## License
Choose one before publishing (MIT is common).
