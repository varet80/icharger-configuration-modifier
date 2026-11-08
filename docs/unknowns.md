# Known and unknown DX8 memory settings

Status as of 2026-11-08. Offsets are inside one 256-byte memory record.

**Important:** the setting names below follow the usual iCharger menu layout (Charge, Discharge, Storage, Cycle, Balance, advanced options). Compare them with the menus on your own DX8 and fix this list where they differ. Everything marked "hint" is a guess from how bytes vary between memories, not a result.

## Mapped (used by the tool)

| Setting | Offset | Confidence | Evidence |
|---|---|---|---|
| Battery type | +0x3D | high | built-in slots 0..9 hold 0..9 |
| Capacity | +0x28 | high | matches names (1200, 5600, 800 mAh) |
| Cell count (0 = auto) | +0x3E | medium | diffs: 3S -> 3, 8S -> 8, Auto -> 0 |
| Full charge V/cell (LiPo) | +0x50 | high | 4200 default |
| Storage V/cell (LiPo) | +0x56 | high | 3850 default; 3800 in the custom memory |
| Discharge cut-off V/cell | +0x5C | medium | matches 3200/3000/3300 in memory names/values |
| Charge current | +0x62 | high | matches names (1.8 A, 8.9 A, 0.5 A) |
| Discharge current | +0x64 | high | matches names (2 A, 11.2 A, 0.3 A) |
| Run counter | +0x3B low nibble | medium | one diff: 0 -> 12 |
| Regen discharge | +0x3B high nibble | medium | memory named `regen_i` holds 1 |
| Log interval | +0x39 | medium | one diff: 1.0 s -> 1.5 s = 0x0A -> 0x0F |
| Balance start (below CV) | +0x48 | medium | one diff: 0.2 V -> 0.1 V = 2 -> 1 (read-only in the tool) |

## Unknown, by menu group

For each: what to change on the charger, and any hint from the current backups.

### Charge
| Setting | Hint | Test |
|---|---|---|
| Charge end current (%) | +0x66 holds 10 normally, 1 and 2 in the two memories named 0.1 A / 0.5 A | change it, save |
| Charge mode (balance / non-balance) | not at +0x3E. Candidates: +0x41 (1 only in the two `1s` memories), +0x4F | toggle only this |
| Safety timer | unknown | set to e.g. 77 min |
| Safety capacity (% of nominal) | maybe +0x9A/+0x9C area; factory LiPo holds 36500 | set to e.g. 123 % |
| Charge delay / max capacity limit | +0x9A holds 12000 (= 120 %?) | change, save |
| Trickle / keep charging | unknown | toggle |

### Discharge
| Setting | Hint | Test |
|---|---|---|
| Discharge end current | unknown | change, save |
| Discharge delay | unknown | change, save |
| Discharge safety timer / capacity | unknown | change, save |

### Storage
| Setting | Hint | Test |
|---|---|---|
| Storage compensation / time | +0x57..+0x5D (voltage table neighbours) | change, save |
| Storage charge/discharge current | unknown, may reuse charge/discharge current | change, save |

### Cycle
| Setting | Hint | Test |
|---|---|---|
| Cycle count | +0x8C is 0 in most memories, 4 in the custom 1.2 Ah memory and 5 in the `regen` memory | set to e.g. 7 |
| Cycle mode (C>D, D>C, ...) | +0x8A is 3 in most memories and 10 in the custom 1.2 Ah memory | change, save |
| Cycle delay | +0x82 is 1000 normally and 500 in the custom 1.2 Ah memory | set to e.g. 3 min |

### Balance
| Setting | Hint | Test |
|---|---|---|
| Balance speed (slow / normal / fast) | +0x4F is 1 only in the custom 1.2 Ah memory, which you set to slow balance | switch to fast, save |
| Balance set point (cell delta) | +0x68 / +0x6A | change, save |
| Balance end / delay | +0x47 is 3 in the two `1s` memories | change, save |

### Temperature, resistance, other advanced
| Setting | Hint | Test |
|---|---|---|
| Temperature cut-off | +0x9C / +0x9E area | change, save |
| Internal resistance compensation | unknown | change, save |
| Fan / sync / channel options | maybe in the global block (0x200..0x2B3) | change, save |

## Bytes that differ between memories but are not mapped
+0x2C, +0x35, +0x41, +0x42, +0x47, +0x4F, +0x57, +0x5D, +0x68, +0x6A, +0x6C, +0x82, +0x83, +0x8A, +0x8C, +0x8F, +0x9A..+0x9F.

Values in the custom 1.2 Ah memory that stand out: +0x4F = 1 (others 0), +0x82 = 500 (others 1000), +0x8A = 10 (others 3), +0x8C = 4 (others 0), +0x8F = 0xC8 (others 0x78), +0x9F = 0x14 (others 0x0A). That memory has the most non-default settings, so these bytes are good first candidates.

## Not decoded at all
- Global settings block, 0x200..0x2B3 (180 bytes).
- Header 0x00..0x4F. Byte 0x1B changed from 0 to 0x0F in every backup saved after a change on the charger; it may mirror the log interval.
- A stray `A` at +0x14 in the name area of the custom 1.2 Ah memory.

## Faster way to find many settings at once
Make one extra memory and give each setting a different, odd value that no other setting uses, for example safety timer 77, cycle count 7, cycle delay 3, safety capacity 123, end current 17. Save one backup. Each value then shows up as a distinct byte, so many settings are identified from one file. Safety-relevant ones should still get a one-setting follow-up before the tool is allowed to write them.
