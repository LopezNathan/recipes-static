/**
 * Sort orders for the recipe list. Shared by the homepage's server render and
 * its client-side re-sort so both agree on ordering (and on tie-breaks).
 */

export type SortKey = 'added' | 'oldest' | 'title' | 'title-desc' | 'time' | 'rating';

export const DEFAULT_SORT: SortKey = 'added';

export const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: 'added', label: 'Recently added' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Name (A–Z)' },
  { value: 'title-desc', label: 'Name (Z–A)' },
  { value: 'time', label: 'Quickest first' },
  { value: 'rating', label: 'Highest rated' },
];

/**
 * The fields a sort needs. `created` is epoch ms and `rating` is 1-5, each 0
 * when the recipe has none. `minutes` is prep + cook, and 0 means "no time
 * recorded" — a few recipes carry `time: {prep: 0, cook: 0}`.
 */
export interface Sortable {
  title: string;
  created: number;
  minutes: number;
  rating: number;
}

type Comparator = (a: Sortable, b: Sortable) => number;

const byTitle: Comparator = (a, b) => a.title.localeCompare(b.title);

// Unknown values (0) sort last rather than winning "quickest" or "highest".
const unknownLast = (value: number) => (value > 0 ? value : Number.POSITIVE_INFINITY);

// Every order falls back to title so ties (same day added, same total time,
// same rating) land in a stable, predictable spot.
const comparators: Record<SortKey, Comparator> = {
  added: (a, b) => b.created - a.created || byTitle(a, b),
  oldest: (a, b) => a.created - b.created || byTitle(a, b),
  title: byTitle,
  'title-desc': (a, b) => byTitle(b, a),
  time: (a, b) => unknownLast(a.minutes) - unknownLast(b.minutes) || byTitle(a, b),
  rating: (a, b) => b.rating - a.rating || byTitle(a, b),
};

export function isSortKey(value: string | null | undefined): value is SortKey {
  return !!value && value in comparators;
}

/** Returns a new array; the input is left alone. */
export function sortRecipes<T extends Sortable>(items: readonly T[], key: SortKey): T[] {
  return [...items].sort(comparators[key]);
}
