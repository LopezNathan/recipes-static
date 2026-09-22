import type { Ingredient, RecipeFrontmatter, RecipeStep } from './recipeSchema';

export type ImportedRecipeDraft = Partial<Pick<RecipeFrontmatter, 'title' | 'servings' | 'time' | 'source' | 'image'>> & {
  ingredients: Ingredient[];
  steps: RecipeStep[];
};

type JsonObject = Record<string, unknown>;

const UNIT_ALIASES: Record<string, Ingredient['unit']> = {
  g: 'g', gram: 'g', grams: 'g', kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  tsp: 'tsp', 'tsp.': 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', 'tbsp.': 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup', c: 'cup',
};

const FRACTIONS: Record<string, number> = { '¼': .25, '½': .5, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875 };

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap(strings) : typeof value === 'string' ? [value.trim()].filter(Boolean) : [];
}

function types(value: unknown): string[] {
  return strings(value).map((type) => type.toLowerCase());
}

/** Finds Recipe objects in JSON-LD script data, including @graph and arrays. */
export function discoverRecipes(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap(discoverRecipes);
  const node = object(value);
  if (!node) return [];
  const found = types(node['@type']).includes('recipe') ? [node] : [];
  return [...found, ...discoverRecipes(node['@graph'])];
}

/** Extracts every well-formed JSON-LD script without treating page text as data. */
export function discoverJsonLd(html: string): unknown[] {
  const scripts = html.matchAll(/<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script\s*>/gi);
  const values: unknown[] = [];
  for (const match of scripts) {
    try { values.push(JSON.parse(match[2].trim())); } catch { /* publishers often ship unrelated malformed JSON-LD */ }
  }
  return values;
}

export function parseIsoDuration(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (!match) return undefined;
  const [, days, hours, minutes] = match;
  const total = (Number(days || 0) * 1440) + (Number(hours || 0) * 60) + Number(minutes || 0);
  return Number.isFinite(total) ? total : undefined;
}

function quantity(value: string): number | undefined {
  const text = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const unicode = text.match(/^(\d+)?([¼½¾⅓⅔⅛⅜⅝⅞])$/);
  if (unicode) return Number(unicode[1] || 0) + FRACTIONS[unicode[2]];
  return undefined;
}

/** Maps unambiguous conventional prefixes; unknown measures stay intact for review. */
export function parseIngredient(line: string): Ingredient {
  const original = line.replace(/\s+/g, ' ').trim();
  const match = original.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|\d*[¼½¾⅓⅔⅛⅜⅝⅞])\s+([a-zA-Z.]+)\s+(.+)$/);
  if (match) {
    const qty = quantity(match[1]);
    const unit = UNIT_ALIASES[match[2].toLowerCase()];
    if (qty !== undefined && unit) return { qty, unit, item: match[3].trim() };
  }
  const count = original.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|\d*[¼½¾⅓⅔⅛⅜⅝⅞])\s+(.+)$/);
  if (count) {
    const qty = quantity(count[1]);
    if (qty !== undefined && !/^(pinch|dash|handful|clove|slice|can|package)\b/i.test(count[2])) return { qty, unit: null, item: count[2].trim() };
  }
  return { qty: null, unit: null, item: original || 'Ingredient' };
}

function instructionText(value: string): string[] {
  // Recipe publishers commonly put HTML or Markdown in JSON-LD strings. The
  // editor stores plain text, so retain the prose but not presentation markup.
  const plain = value
    .replace(/<\s*br\s*\/?>/gi, '\n\n')
    .replace(/<\s*\/??(?:p|div|li|h[1-6])\b[^>]*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(?:\*\*|__|`)/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  // A structured step can contain several sentences. Split only explicit
  // paragraph breaks, never punctuation, so it remains one cooking action.
  return plain.split(/\n\s*\n+/).map((text) => text.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

export function normalizeInstructions(value: unknown): RecipeStep[] {
  if (typeof value === 'string') return instructionText(value).map((text) => ({ text }));
  if (!Array.isArray(value)) {
    const node = object(value);
    if (!node) return [];
    if (typeof node.text === 'string') return normalizeInstructions(node.text);
    if (node.itemListElement !== undefined) return normalizeInstructions(node.itemListElement);
    return typeof node.name === 'string' ? normalizeInstructions(node.name) : [];
  }
  return value.flatMap(normalizeInstructions);
}

function firstString(value: unknown): string | undefined { return strings(value)[0]; }

/** Converts one selected Recipe JSON-LD object to a deliberately incomplete, reviewable form draft. */
export function recipeDraft(recipe: JsonObject, source: string): { draft: ImportedRecipeDraft; warnings: string[] } {
  const warnings: string[] = [];
  const title = firstString(recipe.name);
  const servingsValue = firstString(recipe.recipeYield) ?? (typeof recipe.recipeYield === 'number' ? String(recipe.recipeYield) : undefined);
  const servings = servingsValue?.match(/\d+/)?.[0];
  const ingredientLines = strings(recipe.recipeIngredient);
  const steps = normalizeInstructions(recipe.recipeInstructions);
  if (!title) warnings.push('The recipe metadata has no title. Add one before creating the recipe.');
  if (!servings) warnings.push('The recipe metadata has no numeric servings. Choose a serving count.');
  if (!ingredientLines.length) warnings.push('The recipe metadata has no ingredients. Paste or enter them manually.');
  if (!steps.length) warnings.push('The recipe metadata has no usable instructions. Paste or enter them manually.');
  const ambiguous = ingredientLines.filter((line) => parseIngredient(line).qty === null && /^\d/.test(line));
  if (ambiguous.length) warnings.push(`${ambiguous.length} ingredient${ambiguous.length === 1 ? '' : 's'} used an unfamiliar measure and was kept as text for review.`);
  const image = firstString(recipe.image) ?? firstString(object(recipe.image)?.url);
  return {
    draft: {
      ...(title ? { title } : {}),
      ...(servings ? { servings: Number(servings) } : {}),
      time: { prep: parseIsoDuration(recipe.prepTime) ?? 0, cook: parseIsoDuration(recipe.cookTime) ?? 0 },
      source,
      ...(image ? { image } : {}),
      ingredients: ingredientLines.map(parseIngredient),
      steps,
    },
    warnings,
  };
}
