// Unit registry with conversion groups. Smallest unit per group is used in Recipe/BOM.
export type UnitGroup = 'mass' | 'volume' | 'count' | 'length' | 'other';

export interface UnitDef {
  code: string;
  label: string;
  group: UnitGroup;
  /** factor to convert 1 of this unit -> smallest unit in group */
  toBase: number;
}

export const UNITS: UnitDef[] = [
  // mass — base: g
  { code: 'kg', label: 'Kilogram (kg)', group: 'mass', toBase: 1000 },
  { code: 'g', label: 'Gram (g)', group: 'mass', toBase: 1 },
  { code: 'mg', label: 'Miligram (mg)', group: 'mass', toBase: 0.001 },
  { code: 'ton', label: 'Ton', group: 'mass', toBase: 1_000_000 },
  // volume — base: ml
  { code: 'l', label: 'Liter (L)', group: 'volume', toBase: 1000 },
  { code: 'ml', label: 'Mililiter (ml)', group: 'volume', toBase: 1 },
  // count — base: pcs
  { code: 'pcs', label: 'Pieces (pcs)', group: 'count', toBase: 1 },
  { code: 'lusin', label: 'Lusin (12 pcs)', group: 'count', toBase: 12 },
  { code: 'box', label: 'Box', group: 'count', toBase: 1 },
  { code: 'pack', label: 'Pack', group: 'count', toBase: 1 },
  // length — base: cm
  { code: 'm', label: 'Meter (m)', group: 'length', toBase: 100 },
  { code: 'cm', label: 'Centimeter (cm)', group: 'length', toBase: 1 },
  { code: 'mm', label: 'Milimeter (mm)', group: 'length', toBase: 0.1 },
];

export const unitOptions = () => UNITS.map(u => ({ value: u.code, label: u.label }));

export const findUnit = (code: string): UnitDef | undefined =>
  UNITS.find(u => u.code.toLowerCase() === (code || '').toLowerCase());

/** Smallest unit in the same group as the given unit code. Falls back to the unit itself. */
export const smallestUnitOf = (code: string): string => {
  const u = findUnit(code);
  if (!u) return code || 'pcs';
  const sameGroup = UNITS.filter(x => x.group === u.group);
  if (!sameGroup.length) return code;
  return sameGroup.reduce((a, b) => (a.toBase <= b.toBase ? a : b)).code;
};

/** Convert qty from one unit to another within the same group. Returns qty unchanged if groups differ. */
export const convertQty = (qty: number, from: string, to: string): number => {
  const a = findUnit(from); const b = findUnit(to);
  if (!a || !b || a.group !== b.group) return qty;
  return (qty * a.toBase) / b.toBase;
};