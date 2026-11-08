# Known and unknown DX8 memory settings

Status as of 2026-11-08. Setting names and ranges are from the DX8 English manual 1.0.2 (`icharger dx8 en manual.pdf`), LiPo/LiIo/LiFe/LiHV/LTO/User memories. Offsets are inside one 256-byte memory record; 16-bit values can sit at odd offsets.

Confidence: **diff** = confirmed by changing it on the charger; **default** = the byte holds exactly the manual's default in the built-in memories (strong hint, not proof); **hint** = a guess from how bytes vary.

## Mapped (in `src/core/fields.ts`)

| Menu | Setting | Offset | Evidence |
|---|---|---|---|
| Setup | Battery type | +0x3D | built-in slots hold 0..9 |
| Setup | Cells (Auto, 1-8S) | +0x3E | diff: 3S, 8S, Auto |
| Setup | Capacity (Ignore, 50-999900 mAh) | +0x28 (4 bytes) | matches memory names |
| Option | Run counter (0-999) | +0x3B (2 bytes) | diff: 0 -> 12 |
| Option | Log interval (0.5-60 s) | +0x39 (2 bytes) | diff: 1.0 -> 1.5 s; built-ins hold the 1 s default |
| Charge | Chg current (0.05-30 A) | +0x62 | matches names |
| Charge | Chg cell volt (LiPo 3.85-4.35 V) | +0x50 | default 4.2 V |
| Charge | Chg end current (1-50 %) | +0x66 | default 10 %; 1 and 2 in memories with 0.1 A / 0.5 A |
| Charge | Balance start (CV, CV-0.1..1 V, Always) | +0x48 | diff: CV-0.2 -> CV-0.1; built-ins hold the CV-0.2 default. Read-only |
| Storage | Storage cell volt (LiPo 3.7-3.9 V) | +0x56 | default 3.85 V |
| Discharge | Discharge current (0.05-30 A) | +0x64 | matches names |
| Discharge | Discharge volt (LiPo 3.0-4.1 V) | +0x5C | default 3.5 V |
| Discharge | End current (1-100 %) | +0x68 | default: built-ins hold 50. Read-only |
| Charge safety | Max capacity (50-200 %), Cut-Temp (20-80 C), Safety timer | +0x8F, +0x91, +0x93 | default: 120 %, 45 C, off. Read-only |
| Discharge safety | Max capacity, Cut-Temp | +0x95, +0x97 | default: 90 %, 45 C. Read-only |
| Charge advanced | Restore lowest voltage (0.5-2.5 V) | +0x82 | default 1.0 V (custom memory holds 0.5 V). Read-only |

## Not mapped yet

Test column = what to change on the charger, one setting per backup (or several at once with distinct values, see the end).

### Charge
| Setting (manual range, default) | Hint | Test |
|---|---|---|
| Chg Mode: Slow / Normal / Fast / User Balance / Not Balance (default Normal) | +0x4F = 1 only in the custom 1.2 Ah memory (slow balance); +0x41 = 1 in the two "Unbal" memories | switch to Fast, then to Not Balance |
| Balance Diff (1-10 mV, 5), Balance Set Point (1-50 mV, 5), Balance Over Charge (0-50 mV, 0), Balance Done Delay (0-20 min, 1) | +0x70..+0x76 hold 0, 5, 5, 1 in every memory (default) | User Balance, then change each to a distinct value |
| Chg End Current "Set..." condition (4 balance-end rules) | unknown | change the rule |
| Restore Charge Time (1-5 min, 3), Restore Charge Current (0.02-0.5 A, 0.1) | +0x6C / +0x6E hold 3 in every memory; +0x80 holds 2300 | set 5 min / 0.3 A |
| Keep charging after the done | unknown | toggle |

### Storage
| Setting | Hint | Test |
|---|---|---|
| Storage Compensation (0-0.2 V, 0.01) | unknown | set 0.05 V |
| Accelerated storage | unknown | toggle |

### Discharge
| Setting | Hint | Test |
|---|---|---|
| Regenerative Mode: OFF / To input / To channel | +0x6A is 1 in the `regen_i` memory (to input), 2 in the built-in LiPo | switch to To channel |
| Channel regenerative: Channel Join, Voltage Limit (2-36.5 V, 12), Current Limit (0.05-30 A, 1) | unknown | set To channel, then change both limits |
| Extra Discharge Enable, Balance Enable | unknown | toggle each |
| Discharge Safety Timer | probably +0x99 | set 77 min |

### Cycle
| Setting | Hint | Test |
|---|---|---|
| Cycle Mode (7 options, default CHG>DCHG) | unknown | change |
| Cycle Count (1-99, 3) | +0x6C holds 3 in every memory (also a Restore Time candidate) | set 7 |
| Delay Time (0-9999 min, 3) | +0x8A holds 3, and 10 in the custom 1.2 Ah memory | set 11 |

### Options and elsewhere
| Setting | Hint | Test |
|---|---|---|
| Channel Mode (Async / Sync) | unknown | switch |
| Auto save before the program runs | unknown | toggle |
| Log save to SD card | unknown | toggle |
| Show tick (memory shown in list) | unknown | toggle |
| Display order of memories | order table at 0xA00 (decoded) | move one memory |

### Bytes that differ between memories but are not mapped
+0x2C, +0x35, +0x41, +0x42, +0x47, +0x4F, +0x57, +0x5D, +0x6A, +0x6C, +0x83, +0x8A, +0x8C, +0x9A..+0x9F.

Custom 1.2 Ah memory values that stand out: +0x4F = 1, +0x8A = 10, +0x8C = 4, +0x9F = 0x14. That memory has the most non-default settings.

## Not decoded at all
- Global settings block 0x200..0x2B3 (180 bytes). Probably the charger-wide menu (input limits, buzzer, language, calibration).
- Header 0x00..0x4F. Byte 0x1B went from 0 to 0x0F after charger-side changes.
- Other battery types (NiMH/NiCd, NiZn, Pb, Power) use different menus (reflex charge, sensitivity, trickle, ...). Only the shared fields are mapped.
- Voltage tables for LiIo, LiFe, LiHV, LTO inside each record are read but not exposed.

## Faster way to find many settings at once
Make one extra memory and give each setting a different odd value that no other setting uses, for example cycle count 7, cycle delay 11, safety timer 77, balance diff 4 mV, restore time 5 min. Save one backup. Each value then shows up as a distinct byte, so many settings are identified from one file. Safety-related ones still get a one-setting check before the tool is allowed to write them.
