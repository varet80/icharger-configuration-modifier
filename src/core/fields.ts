// Data-driven field table for one 256-byte memory record.
// Add or correct fields here as they are verified by diffing backups.
// Offsets are relative to the start of the record. Little-endian.

export type Confidence = 'high' | 'medium' | 'low';
export type FieldKind = 'u32' | 'u16' | 'u8';

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
  { key: 'capacity_mAh', label: 'Capacity (mAh, 0 = ignore)', offset: 0x28, kind: 'u32', scale: 1, decimals: 0, min: 0, max: 999900, confidence: 'high', writable: true, notes: 'Manual: Ignore (default) or 50-999900 mAh, so it needs 4 bytes.' },
  { key: 'cells', label: 'Cell count (0 = auto)', offset: 0x3e, kind: 'u8', scale: 1, decimals: 0, min: 0, max: 8, confidence: 'high', writable: true, notes: 'Confirmed by diffs: 3S saved 3, 8S saved 8, Auto saved 0. Manual: Auto (default) or 1-8S.' },
  { key: 'run_counter', label: 'Run counter', offset: 0x3b, kind: 'u16', scale: 1, decimals: 0, min: 0, max: 999, confidence: 'medium', writable: true, notes: 'One diff: counter 0 -> 12 changed +0x3B from 00 to 0C. Manual range 0-999, so 2 bytes. Earlier mislabelled as cell count.' },
  { key: 'log_interval_s', label: 'Log interval (s)', offset: 0x39, kind: 'u16', scale: 0.1, decimals: 1, min: 0.5, max: 60, confidence: 'medium', writable: true, notes: 'One diff: 1.0 s -> 1.5 s changed +0x39 from 0A to 0F (tenths of a second). Manual range 0.5-60 s, so 2 bytes. The header byte 0x1B also changed to 0F; it is not touched by this tool.' },
  { key: 'balance_start_V', label: 'Balance start: volts below CV', offset: 0x48, kind: 'u8', scale: 0.1, decimals: 1, min: 0, max: 1, confidence: 'medium', writable: false, notes: 'One diff: CV-0.2 V -> CV-0.1 V changed +0x48 from 02 to 01. Manual: CV, CV-0.1..1 V, or Always (encoding of Always unknown). Read-only until a second value is verified; it affects balancing.' },
  { key: 'full_charge_mV', label: 'Full charge voltage per cell, LiPo (mV)', offset: 0x50, kind: 'u16', scale: 1, decimals: 0, min: 3850, max: 4350, confidence: 'high', writable: true, lipoOnly: true, notes: 'Part of a per-chemistry table (+0x50 full: LiPo, LiIo, LiFe; +0x56 storage: LiPo, LiIo, LiFe). This slot is the LiPo value.' },
  { key: 'storage_mV', label: 'Storage voltage per cell, LiPo (mV)', offset: 0x56, kind: 'u16', scale: 1, decimals: 0, min: 3700, max: 3900, confidence: 'high', writable: true, lipoOnly: true, notes: 'Part of a per-chemistry table (+0x50 full: LiPo, LiIo, LiFe; +0x56 storage: LiPo, LiIo, LiFe). This slot is the LiPo value.' },
  { key: 'discharge_cutoff_mV', label: 'Discharge voltage per cell, LiPo (mV)', offset: 0x5c, kind: 'u16', scale: 1, decimals: 0, min: 3000, max: 4100, confidence: 'medium', writable: true, lipoOnly: true, notes: 'Manual LiPo range 3.0-4.1 V/cell, default 3.5 V. Per-chemistry table like the charge and storage voltages: this slot is the LiPo value.' },
  { key: 'charge_current_A', label: 'Charge current (A)', offset: 0x62, kind: 'u16', scale: 0.01, decimals: 2, min: 0.05, max: 30, confidence: 'high', writable: true, notes: 'Stored in 10 mA units. 30 A is the per-channel maximum of the DX8.' },
  { key: 'discharge_current_A', label: 'Discharge current (A)', offset: 0x64, kind: 'u16', scale: 0.01, decimals: 2, min: 0.05, max: 30, confidence: 'high', writable: true, notes: 'Stored in 10 mA units.' },
  { key: 'charge_end_pct', label: 'Charge end current (% of charge current)', offset: 0x66, kind: 'u16', scale: 1, decimals: 0, min: 1, max: 50, confidence: 'medium', writable: true, notes: 'Manual: 1-50 %, default 10 %. Backups hold 10 normally and 1 / 2 in the memories with 0.1 A / 0.5 A. Not yet confirmed by a diff.' },
  { key: 'discharge_end_pct', label: 'Discharge end current (% of discharge current)', offset: 0x68, kind: 'u16', scale: 1, decimals: 0, min: 1, max: 100, confidence: 'medium', writable: false, notes: 'Manual: 1-100 %, default 50 %. The built-in LiIo..Power slots hold 50 here. Read-only until confirmed by a diff.' },
  { key: 'restore_lowest_mV', label: 'Charge restore: lowest voltage per cell (mV)', offset: 0x82, kind: 'u16', scale: 1, decimals: 0, min: 500, max: 2500, confidence: 'medium', writable: false, notes: 'Manual: 0.5-2.5 V/cell, default 1.0 V. Backups hold 1000, and 500 in the custom 1.2 Ah memory. Matches a default, not yet confirmed by a diff.' },
  { key: 'charge_max_capacity_pct', label: 'Charge safety: max capacity (%)', offset: 0x8f, kind: 'u16', scale: 1, decimals: 0, min: 50, max: 200, confidence: 'medium', writable: false, notes: 'Manual: 50-200 %, default 120 %. Packed at an odd offset. Backups hold 120, and 200 in the custom 1.2 Ah memory. Not yet confirmed by a diff.' },
  { key: 'charge_cut_temp_C', label: 'Charge safety: cut temperature (C)', offset: 0x91, kind: 'u16', scale: 0.1, decimals: 1, min: 20, max: 80, confidence: 'medium', writable: false, notes: 'Manual: 20-80 C, default 45 C. Stored in tenths of a degree (450). Not yet confirmed by a diff.' },
  { key: 'charge_safety_timer_min', label: 'Charge safety: timer (min, 0 = off)', offset: 0x93, kind: 'u16', scale: 1, decimals: 0, min: 0, max: 9999, confidence: 'medium', writable: false, notes: 'Manual: 1-9999 min, default off. Holds 0 in every memory. Not yet confirmed by a diff.' },
  { key: 'discharge_max_capacity_pct', label: 'Discharge safety: max capacity (%)', offset: 0x95, kind: 'u16', scale: 1, decimals: 0, min: 50, max: 200, confidence: 'medium', writable: false, notes: 'Manual: 50-200 %, default 90 %. Not yet confirmed by a diff.' },
  { key: 'discharge_cut_temp_C', label: 'Discharge safety: cut temperature (C)', offset: 0x97, kind: 'u16', scale: 0.1, decimals: 1, min: 20, max: 80, confidence: 'medium', writable: false, notes: 'Manual: 20-80 C, default 45 C. Not yet confirmed by a diff.' },
];

export const FIELD_BY_KEY: ReadonlyMap<string, FieldDef> = new Map(FIELDS.map((f) => [f.key, f]));
