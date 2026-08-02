import { describe, it, expect } from 'vitest';
import { DEFAULT_SORT, SORT_OPTIONS, isSortKey, sortRecipes } from '../src/lib/sort';

const day = (iso: string) => new Date(iso).getTime();

const recipes = [
  { title: 'Beef Stew', created: day('2026-06-03'), minutes: 180, rating: 5 },
  { title: 'Shakshuka', created: day('2026-07-19'), minutes: 30, rating: 0 },
  { title: 'Aji Verde', created: day('2026-06-03'), minutes: 10, rating: 4 },
  { title: 'Pozole', created: day('2026-07-26'), minutes: 90, rating: 0 },
];

const titles = (key: Parameters<typeof sortRecipes>[1]) =>
  sortRecipes(recipes, key).map((r) => r.title);

describe('sortRecipes', () => {
  it('defaults to newest added first', () => {
    expect(DEFAULT_SORT).toBe('added');
    expect(titles('added')).toEqual(['Pozole', 'Shakshuka', 'Aji Verde', 'Beef Stew']);
  });

  it('breaks ties on the same created date by title', () => {
    expect(titles('added').slice(2)).toEqual(['Aji Verde', 'Beef Stew']);
    expect(titles('oldest').slice(0, 2)).toEqual(['Aji Verde', 'Beef Stew']);
  });

  it('sorts oldest first', () => {
    expect(titles('oldest')).toEqual(['Aji Verde', 'Beef Stew', 'Shakshuka', 'Pozole']);
  });

  it('sorts by title in both directions', () => {
    expect(titles('title')).toEqual(['Aji Verde', 'Beef Stew', 'Pozole', 'Shakshuka']);
    expect(titles('title-desc')).toEqual(['Shakshuka', 'Pozole', 'Beef Stew', 'Aji Verde']);
  });

  it('sorts by total time, quickest first', () => {
    expect(titles('time')).toEqual(['Aji Verde', 'Shakshuka', 'Pozole', 'Beef Stew']);
  });

  it('puts recipes with no recorded time last, not first', () => {
    const withUntimed = [...recipes, { title: 'Aaa', created: 0, minutes: 0, rating: 0 }];
    expect(sortRecipes(withUntimed, 'time').at(-1)?.title).toBe('Aaa');
  });

  it('sorts by rating, highest first, with unrated last', () => {
    expect(titles('rating')).toEqual(['Beef Stew', 'Aji Verde', 'Pozole', 'Shakshuka']);
  });

  it('treats a missing created date as oldest', () => {
    const withUndated = [...recipes, { title: 'Zzz', created: 0, minutes: 5, rating: 0 }];
    expect(sortRecipes(withUndated, 'added').at(-1)?.title).toBe('Zzz');
  });

  it('does not mutate the input', () => {
    const before = recipes.map((r) => r.title);
    sortRecipes(recipes, 'title-desc');
    expect(recipes.map((r) => r.title)).toEqual(before);
  });

  it('validates sort keys', () => {
    expect(isSortKey('added')).toBe(true);
    expect(isSortKey('nope')).toBe(false);
    expect(isSortKey(null)).toBe(false);
    for (const opt of SORT_OPTIONS) expect(isSortKey(opt.value)).toBe(true);
  });
});
