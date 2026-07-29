// Ingredient-quantity display for CookMode scaling.
//
// Rule:
//   qty >= 10   -> round to a whole integer
//   qty <  10   -> snap the fractional part to one of
//                  ⅛ ¼ ⅓ ½ ⅔ ¾ (tolerance 0.06) and render a unicode fraction.
//                  If nothing is within tolerance, fall back to a short decimal.

interface SnapTarget {
  value: number;
  glyph: string;
}

// Ordered snap targets for the fractional part, including the carry point (1).
const TARGETS: SnapTarget[] = [
  { value: 0, glyph: '' },
  { value: 1 / 8, glyph: '⅛' },
  { value: 1 / 4, glyph: '¼' },
  { value: 1 / 3, glyph: '⅓' },
  { value: 1 / 2, glyph: '½' },
  { value: 2 / 3, glyph: '⅔' },
  { value: 3 / 4, glyph: '¾' },
  { value: 1, glyph: '' }, // carries into the whole number
];

const TOLERANCE = 0.06;

/** Scale a quantity from a base serving count to a target serving count. */
export function scaleQty(qty: number, servings: number, baseServings: number): number {
  if (baseServings <= 0) return qty;
  return (qty * servings) / baseServings;
}

/**
 * Render a scaled quantity per the rule above.
 * `null` qty ("to taste") is returned as null so the caller can omit it.
 */
export function formatQty(qty: number | null): string | null {
  if (qty === null) return null;
  if (!isFinite(qty)) return null;
  if (qty >= 10) return String(Math.round(qty));

  const whole = Math.floor(qty);
  const frac = qty - whole;

  // nearest snap target to the fractional part
  let best = TARGETS[0];
  let bestDelta = Infinity;
  for (const t of TARGETS) {
    const delta = Math.abs(frac - t.value);
    if (delta < bestDelta) {
      best = t;
      bestDelta = delta;
    }
  }

  if (bestDelta <= TOLERANCE) {
    let w = whole;
    let glyph = best.glyph;
    if (best.value === 1) {
      w += 1; // carry
      glyph = '';
    }
    if (w === 0 && glyph === '') return '0';
    if (glyph === '') return String(w);
    if (w === 0) return glyph;
    return `${w}${glyph}`;
  }

  // No fraction within tolerance: short decimal.
  return String(Number(qty.toFixed(2)));
}
