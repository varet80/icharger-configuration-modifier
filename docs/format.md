# DX8 .bak format (reverse-engineered)

Status: partial. Derived from one 23,040-byte backup (checked against the owner's DX8_SAVE1.bak on 2026-11-08: 14 records, byte-identical CSV round trip). Little-endian. Erased flash reads 0xFF.
Verify against your charger firmware (manual mentions v1.17); the layout may change between versions.

## File map
| Offset | Size | Content |
|---|---|---|
| 0x0000 | 0x50 | Header: magic/version bytes, 10-digit ASCII serial-like string at 0x10, ~15 u16 values near 0x8000 from 0x20 (possibly calibration offsets, unverified) |
| 0x0050 | | Padding |
| 0x0200 | 0xB4 | Global settings block (NOT decoded) |
| 0x0A00 | 2 + N | Order table: byte0 = record count N, byte1 = pad, then N bytes = display order of records |
| 0x1200 | N x 0x100 | Memory records |
| after | | Erased up to 0x5A00 (room for 72 records; charger limit is 64 = 10 built-in + 54 custom per the DX8 manual) |

## Memory record (256 bytes)
Fields are packed: 16-bit values can sit at odd offsets (for example +0x8F). Setting names and ranges come from the DX8 English manual 1.0.2 (kept in the repo root). The authoritative list of mapped fields is `docs/fields.csv` / `src/core/fields.ts`; this page records the layout notes.

- +0x00 marker bytes: `00 00` = built-in slot, `AA 55` = user-saved (0x55AA read little-endian).
- +0x02 name, null-terminated, at most 29 chars ending by +0x1E; +0x1F is always 0. In user records byte +0x02 is often 0x00 (the leading letter is lost), so the text starts at +0x03.
- +0x28 u32 capacity in mAh (manual allows up to 999,900, so 4 bytes).
- +0x39 u16 log interval in 0.1 s [medium, one diff].
- +0x3B u16 run counter, 0-999 [medium, one diff: 0 -> 12 gave 0x0C]. Earlier guesses (cell count, nibbles, regen mode) were wrong.
- +0x3D u8 battery type, 0 LiPo, 1 LiIo, 2 LiFe, 3 LiHV, 4 LTO, 5 NiMH, 6 NiCd, 7 NiZn, 8 Pb, 9 Power [high].
- +0x3E u8 cell count, 0 = auto [high: 3S -> 3, 8S -> 8, Auto -> 0, manual 1-8S].
- +0x48 u8 balance start, volts below CV in 0.1 V (2 = CV-0.2 V, the manual default) [medium, one diff].
- +0x50 / +0x52 / +0x54 u16 charge mV per cell for LiPo / LiIo / LiFe; +0x56 / +0x58 / +0x5A storage mV; +0x5C / +0x5E discharge mV. The tool exposes only the LiPo slots and only lets them be edited on LiPo memories.
- +0x62 u16 charge current, 10 mA units; +0x64 u16 discharge current, 10 mA units.
- +0x66 u16 charge end current % (manual 1-50, default 10) [medium].
- +0x68 u16 discharge end current % (manual 1-100, default 50; built-in LiIo..Power hold 50) [medium].
- +0x82 u16 charge restore lowest voltage in mV (default 1000) [medium, matches default].
- +0x8F u16 charge max capacity % (default 120); +0x91 u16 charge cut temperature in 0.1 C (450); +0x93 u16 charge safety timer in min (0 = off) [medium, match defaults].
- +0x95 u16 discharge max capacity % (default 90); +0x97 u16 discharge cut temperature in 0.1 C (450) [medium, match defaults].
- +0x9A u16: 12000 in user records, 36500 in the factory LiPo slot; meaning unknown.
- +0xBC: constant tail `05 00 00 ff`, then 0xFF padding.
- Other bytes: mostly identical across records. Preserved untouched.

Voltage tables repeat for other chemistries inside every record, so the same layout serves all chemistries and field meaning depends on the battery type (+0x3D). Where LiHV, LTO, Ni*, Pb values live is not yet mapped.

Charge mode (Slow / Normal / Fast / User / Not Balance) is not located yet. Hints: +0x41 is 1 in the two "Unbal" memories; +0x4F is 1 only in the custom 1.2 Ah memory, which uses slow balance.

Header byte 0x1B went from 0x00 to 0x0F in every backup saved after a charger-side change; meaning unknown. A stray byte appeared at +0x14 of record 10's name area in the options save.

## Not known
- Checksum: none seen, not proven absent.
- Global settings block, header values, remaining record bytes.

## Mapping method
Change exactly one setting on the charger, save a new backup, run `node src/cli.ts diff a.bak b.bak`. The differing offsets identify that setting.
