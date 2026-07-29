// Grocery-list merge.
//
// Bin ingredients by `${itemKey}::${dimension}` and sum within each bin in the
// dimension's base unit. Quantities are never converted across dimensions, so
// the same item measured by count and by mass produces two lines under one
// entry (e.g. "onion — 2, plus 200 g"). Each dimension line is rendered with
// the display ladder (largest unit >= 1).

import { dimensionOf, formatFromBase, toBase, type Dimension, type Unit } from './units';

export interface RawIngredient {
  qty: number | null;
  unit: Unit;
  item: string;
  key?: string;
}

export interface MergedLine {
  dimension: Dimension;
  base: number; // summed quantity in the base unit
  display: string; // e.g. "2 tbsp", "1.2 kg", "2"
}

export interface MergedItem {
  key: string;
  item: string; // representative display name
  lines: MergedLine[]; // one per dimension present, count first
  toTaste: boolean; // a "to taste" (qty null) occurrence was seen
  display: string; // joined line text, e.g. "onion — 2, plus 200 g"
}

// Modifier / prep words stripped when deriving a key from the item text.
const STOPWORDS = new Set([
  'fresh', 'freshly', 'finely', 'coarsely', 'roughly', 'chopped', 'diced',
  'minced', 'sliced', 'grated', 'ground', 'crushed', 'shredded', 'peeled',
  'large', 'small', 'medium', 'ripe', 'dried', 'whole', 'softened', 'melted',
  'cold', 'warm', 'hot', 'room', 'temperature', 'boneless', 'skinless',
  'cloves', 'clove', 'of', 'a', 'an', 'the', 'to', 'taste',
]);

/** Derive a grouping key from an item string when no explicit `key` is set. */
export function deriveKey(item: string): string {
  const beforeComma = item.split(',')[0] ?? item;
  const words = beforeComma
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
  const key = words.join('-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return key || beforeComma.trim().toLowerCase();
}

function keyOf(ing: RawIngredient): string {
  return ing.key && ing.key.trim() ? ing.key.trim() : deriveKey(ing.item);
}

// Display order for the dimension lines within one item.
const DIM_ORDER: Record<Dimension, number> = { count: 0, mass: 1, volume: 2 };

/** Merge a flat list of (already scaled) ingredients into grocery entries. */
export function mergeIngredients(ingredients: RawIngredient[]): MergedItem[] {
  interface Acc {
    key: string;
    item: string;
    toTaste: boolean;
    bins: Map<Dimension, number>;
  }
  const items = new Map<string, Acc>();

  for (const ing of ingredients) {
    const key = keyOf(ing);
    let acc = items.get(key);
    if (!acc) {
      acc = { key, item: ing.item, toTaste: false, bins: new Map() };
      items.set(key, acc);
    }
    if (ing.qty === null) {
      acc.toTaste = true;
      continue;
    }
    const dim = dimensionOf(ing.unit);
    const base = toBase(ing.qty, ing.unit);
    acc.bins.set(dim, (acc.bins.get(dim) ?? 0) + base);
  }

  const result: MergedItem[] = [];
  for (const acc of items.values()) {
    const lines: MergedLine[] = [];
    for (const [dim, base] of acc.bins) {
      lines.push({ dimension: dim, base, display: formatFromBase(base, dim) });
    }
    lines.sort((a, b) => DIM_ORDER[a.dimension] - DIM_ORDER[b.dimension]);

    const parts = lines.map((l) => l.display);
    if (acc.toTaste && lines.length === 0) parts.push('to taste');
    const display = `${cleanName(acc.item)} — ${parts.join(', plus ')}`;

    result.push({
      key: acc.key,
      item: cleanName(acc.item),
      lines,
      toTaste: acc.toTaste,
      display,
    });
  }

  // Stable alphabetical order by key for a predictable grocery list.
  result.sort((a, b) => a.key.localeCompare(b.key));
  return result;
}

/** Human-friendly item name: drop the prep note after the first comma. */
function cleanName(item: string): string {
  return (item.split(',')[0] ?? item).trim();
}
