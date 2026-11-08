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
- +0x00 marker bytes: `00 00` = built-in slot, `AA 55` = user-saved (0x55AA read little-endian).
- +0x02 name, null-terminated. In user records byte +0x02 is often 0x00 (the leading "L" of "LiPo" is lost), so the text starts at +0x03.
- Name: at most 29 chars ending by +0x1E; +0x1F is always 0 (a 29-char name was cut off there by the charger).
- +0x28 u16 capacity (mAh)
- +0x39 u8: log interval in 0.1 s units (10 = 1.0 s, 15 = 1.5 s) [medium, one diff]
- +0x3B low nibble: run counter (0 -> 12 gave 0x0C) [medium, one diff]; high nibble: regen mode, 1 = to input [medium, from a memory named regen_i]
- +0x3D u8: battery type, 0 LiPo, 1 LiIo, 2 LiFe, 3 LiHV, 4 LTO, 5 NiMH, 6 NiCd, 7 NiZn, 8 Pb, 9 Power [high: built-in slots 0..9 hold 0..9]
- +0x3E u8: cell count, 0 = auto [medium: 3S -> 03, 8S -> 08, Auto -> 00]
- +0x48 u8: balance start offset below CV in 0.1 V units (2 -> 1 for 0.2 V -> 0.1 V) [medium, one diff]
- +0x50/+0x52/+0x54 u16 full-charge mV/cell for LiPo/LiIo/LiFe (4200/4100/3600); +0x56/+0x58/+0x5A storage mV/cell for LiPo/LiIo/LiFe (3850/3750/3300). The tool only exposes the LiPo slots and only lets them be edited on LiPo memories.
- +0x5C u16 discharge cut-off mV/cell [medium]
- +0x62 u16 charge current, 10 mA units; +0x64 u16 discharge current, 10 mA units
- +0x66 u16 probably charge end current % [low]
- +0x9A u16 12000 in user records; factory LiPo slot holds 36500 [low, meaning unclear]
- +0xBC: constant tail `05 00 00 ff`, then 0xFF padding.
- Other bytes: mostly identical across records (per-chemistry voltage tables for LiPo/LiIo/LiFe/LiHV/LTO). Preserved untouched.

Voltage tables repeat for other chemistries inside every record (e.g. 4100/3750 for LiIo, 3600/3300 for LiFe, 4350/3900 for LiHV, 2850 for LTO), so the same byte layout is used for all chemistries. Field meaning therefore depends on the battery type (+0x3D). Where LiHV, LTO, Ni*, Pb values live is not yet mapped.

Charge mode (balance / non-balance) is not located yet. Memories named "Unbal" have 1 at +0x3E, but that byte is the cell count (both are 1S), so it was not charge mode.

Header byte 0x1B went from 0x00 to 0x0F in every backup saved after a charger-side change (both the cell-count and the options changes); meaning unknown. A stray byte appeared at +0x14 of record 10's name area in the options save.

## Not known
- Checksum: none seen, not proven absent.
- Global settings block, header values, remaining record bytes.

## Mapping method
Change exactly one setting on the charger, save a new backup, run `node src/cli.ts diff a.bak b.bak`. The differing offsets identify that setting.
