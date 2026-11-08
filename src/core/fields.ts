// Data-driven field table for one 256-byte memory record.
// Add or correct fields here as they are verified by diffing backups.
// Offsets are relative to the start of the record. Little-endian.

export type Confidence = 'high' | 'medium' | 'low';
export type FieldKind = 'u16' | 'u8' | 'nibLo' | 'nibHi';

export interface FieldDef {
  key: string; // CSV column name
  label: string;
  offset: number;
  kind: FieldKind;
  scale: number; // displayed value = raw * scale
  decimals: number;
  min: number; // displayed units, enforced on write
  max: number;
  confidence: Confidence;
  writable: boolean; // low-confidence fields are read-only until verified on the charger
  lipoOnly?: boolean; // slot in the per-chemistry table that holds the LiPo value; only editable on LiPo records
  notes?: string;
}

// Battery type byte at +0x3D. Confirmed: built-in slots 0..9 hold 0..9 in this order.
export const BATTERY_TYPE_OFFSET = 0x3d;
export const BATTERY_TYPES = ['LiPo', 'LiIo', 'LiFe', 'LiHV', 'LTO', 'NiMH', 'NiCd', 'NiZn', 'Pb', 'Power'] as const;

export const FIELDS: readonly FieldDef[] = [
  { key: 'battery_type', label: 'Battery type (0 LiPo, 1 LiIo, 2 LiFe, 3 LiHV, 4 LTO, 5 NiMH, 6 NiCd, 7 NiZn, 8 Pb, 9 Power)', offset: 0x3d, kind: 'u8', scale: 1, decimals: 0, min: 0, max: 9, confidence: 'high', writable: false, notes: 'Read-only: changing it would leave the other settings meant for the old chemistry.' },
  { key: 'capacity_mAh', label: 'Capacity (mAh)', offset: 0x28, kind: 'u16', scale: 1, decimals: 0, min: 0, max: 65535, confidence: 'high', writable: true },
  { key: 'cells', label: 'Cell count (0 = auto)', offset: 0x3e, kind: 'u8', scale: 1, decimals: 0, min: 0, max: 8, confidence: 'medium', writable: true, notes: 'Confirmed by diffs: 3S saved 3, 8S saved 8, Auto saved 0. Max 8 is a conservative limit (DX8 is 2x8S per channel); raise it after testing larger packs.' },
  { key: 'run_counter', label: 'Run counter', offset: 0x3b, kind: 'nibLo', scale: 1, decimals: 0, min: 0, max: 15, confidence: 'medium', writable: true, notes: 'One diff: counter 0 -> 12 changed +0x3B from 00 to 0C. Earlier mislabelled as cell count.' },
  { key: 'regen_mode', label: 'Regen discharge (0 off, 1 to input)', offset: 0x3b, kind: 'nibHi', scale: 1, decimals: 0, min: 0, max: 2, confidence: 'medium', writable: true, notes: 'Value 2 (to channel) is a guess.' },
  { key: 'log_interval_s', label: 'Log interval (s)', offset: 0x39, kind: 'u8', scale: 0.1, decimals: 1, min: 0.1, max: 25, confidence: 'medium', writable: true, notes: 'One diff: 1.0 s -> 1.5 s changed +0x39 from 0A to 0F (tenths of a second). The header byte 0x1B also changed to 0F; it is not touched by this tool.' },
  { key: 'balance_start_V', label: 'Balance start offset below CV (V)', offset: 0x48, kind: 'u8', scale: 0.1, decimals: 1, min: 0, max: 1, confidence: 'medium', writable: false, notes: 'One diff: 0.2 V -> 0.1 V changed +0x48 from 02 to 01. Read-only until a second value is verified; it affects balancing.' },
  { key: 'full_charge_mV', label: 'Full charge voltage per cell, LiPo (mV)', offset: 0x50, kind: 'u16', scale: 1, decimals: 0, min: 1000, max: 4500, confidence: 'high', writable: true, lipoOnly: true, notes: 'Part of a per-chemistry table (+0x50 full: LiPo, LiIo, LiFe; +0x56 storage: LiPo, LiIo, LiFe). This slot is the LiPo value.' },
  { key: 'storage_mV', label: 'Storage voltage per cell, LiPo (mV)', offset: 0x56, kind: 'u16', scale: 1, decimals: 0, min: 1000, max: 4500, confidence: 'high', writable: true, lipoOnly: true, notes: 'Part of a per-chemistry table (+0x50 full: LiPo, LiIo, LiFe; +0x56 storage: LiPo, LiIo, LiFe). This slot is the LiPo value.' },
  { key: 'discharge_cutoff_mV', label: 'Discharge cut-off per cell (mV)', offset: 0x5c, kind: 'u16', scale: 1, decimals: 0, min: 1000, max: 4500, confidence: 'medium', writable: true },
  { key: 'charge_current_A', label: 'Charge current (A)', offset: 0x62, kind: 'u16', scale: 0.01, decimals: 2, min: 0.05, max: 30, confidence: 'high', writable: true, notes: 'Stored in 10 mA units. 30 A is the per-channel maximum of the DX8.' },
  { key: 'discharge_current_A', label: 'Discharge current (A)', offset: 0x64, kind: 'u16', scale: 0.01, decimals: 2, min: 0.05, max: 30, confidence: 'high', writable: true, notes: 'Stored in 10 mA units.' },
  { key: 'charge_end_pct', label: 'Charge end current (%)', offset: 0x66, kind: 'u16', scale: 1, decimals: 0, min: 1, max: 100, confidence: 'low', writable: false },
  { key: 'max_capacity_pct', label: 'Max capacity limit (%)? UNVERIFIED', offset: 0x9a, kind: 'u16', scale: 0.01, decimals: 0, min: 50, max: 200, confidence: 'low', writable: false, notes: 'User memories hold 12000 (= 120% if percent*100, the manual default), but the factory LiPo slot holds 36500, so this may be a different setting. Verify by diffing before enabling writes.' },
];

export const FIELD_BY_KEY: ReadonlyMap<string, FieldDef> = new Map(FIELDS.map((f) => [f.key, f]));
