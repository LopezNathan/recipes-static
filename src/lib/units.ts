// Unit system shared by ingredient scaling (CookMode) and the grocery merge.
//
// Three dimensions, each with a canonical base unit:
//   mass   -> g
//   volume -> ml
//   count  -> unitless (unit === null)
//
// Quantities are NEVER converted across dimensions.

export type Unit = 'g' | 'kg' | 'oz' | 'lb' | 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup' | null;
export type Dimension = 'mass' | 'volume' | 'count';

// factor = how many base units (g / ml) one of this unit is worth
const MASS: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
};

const VOLUME: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892159375,
  tbsp: 14.78676478125, // exactly 3 tsp
  cup: 236.5882365, // exactly 16 tbsp
};

// Display ladders: try units largest-factor-first, pick the largest with value >= 1.
const MASS_LADDER: Array<[string, number]> = [
  ['kg', MASS.kg],
  ['g', MASS.g],
];
const VOLUME_LADDER: Array<[string, number]> = [
  ['cup', VOLUME.cup],
  ['tbsp', VOLUME.tbsp],
  ['tsp', VOLUME.tsp],
];

export function dimensionOf(unit: Unit): Dimension {
  if (unit === null) return 'count';
  if (unit in MASS) return 'mass';
  if (unit in VOLUME) return 'volume';
  // Unknown unit: treat as countable so it is never silently converted.
  return 'count';
}

/** Convert a quantity to its dimension's base unit (g, ml, or unitless count). */
export function toBase(qty: number, unit: Unit): number {
  const d = dimensionOf(unit);
  if (d === 'mass') return qty * MASS[unit as string];
  if (d === 'volume') return qty * VOLUME[unit as string];
  return qty; // count
}

/** Trim a number for display: 2.0 -> "2", 1.20 -> "1.2", 0.125 -> "0.13". */
export function trimNumber(n: number, maxDecimals = 2): string {
  const rounded = Number(n.toFixed(maxDecimals));
  return String(rounded);
}

/**
 * Format a base-unit quantity using the dimension's display ladder:
 * pick the largest unit whose value is >= 1, else the smallest unit.
 */
export function formatFromBase(baseQty: number, dimension: Dimension): string {
  if (dimension === 'count') {
    return trimNumber(baseQty);
  }
  const ladder = dimension === 'mass' ? MASS_LADDER : VOLUME_LADDER;
  for (const [name, factor] of ladder) {
    const value = baseQty / factor;
    if (value >= 1) return `${trimNumber(value)} ${name}`;
  }
  // Smaller than the smallest ladder unit: use that smallest unit anyway.
  const [name, factor] = ladder[ladder.length - 1];
  return `${trimNumber(baseQty / factor)} ${name}`;
}
