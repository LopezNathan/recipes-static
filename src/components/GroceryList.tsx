/** @jsxImportSource preact */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { mergeIngredients, type RawIngredient } from '../lib/merge';
import { scaleQty } from '../lib/fractions';
import type { Unit } from '../lib/units';

interface RecipeIngredient {
  qty: number | null;
  unit: Unit;
  item: string;
  key?: string;
}
interface RecipeInput {
  slug: string;
  title: string;
  baseServings: number;
  ingredients: RecipeIngredient[];
}
interface Props {
  recipes: RecipeInput[];
}

interface Selection {
  selected: boolean;
  servings: number;
}
type State = Record<string, Selection>;

const STORAGE_KEY = 'grocery-selection-v1';
const CHECKED_STORAGE_KEY = 'grocery-checked-v1';

function loadState(): State {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as State;
  } catch {
    return {};
  }
}

function loadChecked(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = JSON.parse(window.localStorage.getItem(CHECKED_STORAGE_KEY) ?? '[]') as string[];
    return new Set(raw);
  } catch {
    return new Set();
  }
}

export default function GroceryList({ recipes }: Props) {
  const [state, setState] = useState<State>({});
  const [query, setQuery] = useState('');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setState(loadState());
    setCheckedItems(loadChecked());
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CHECKED_STORAGE_KEY, JSON.stringify([...checkedItems]));
    }
  }, [checkedItems]);

  function toggleChecked(key: string) {
    setCheckedItems((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function sel(slug: string, base: number): Selection {
    return state[slug] ?? { selected: false, servings: base };
  }

  function toggle(slug: string, base: number) {
    setState((s) => {
      const cur = s[slug] ?? { selected: false, servings: base };
      return { ...s, [slug]: { ...cur, selected: !cur.selected } };
    });
  }

  function setServings(slug: string, base: number, servings: number) {
    setState((s) => {
      const cur = s[slug] ?? { selected: false, servings: base };
      return { ...s, [slug]: { ...cur, servings } };
    });
  }

  const merged = useMemo(() => {
    const scaled: RawIngredient[] = [];
    for (const r of recipes) {
      const s = sel(r.slug, r.baseServings);
      if (!s.selected) continue;
      for (const ing of r.ingredients) {
        scaled.push({
          qty: ing.qty === null ? null : scaleQty(ing.qty, s.servings, r.baseServings),
          unit: ing.unit,
          item: ing.item,
          key: ing.key,
        });
      }
    }
    return mergeIngredients(scaled);
  }, [state, recipes]);

  const anySelected = recipes.some((r) => sel(r.slug, r.baseServings).selected);

  const q = query.trim().toLowerCase();
  const visibleRecipes = recipes.filter(
    (r) => sel(r.slug, r.baseServings).selected || !q || r.title.toLowerCase().includes(q),
  );

  return (
    <div class="grocery-layout">
      <div class="grocery-picker">
        <h2>Recipes</h2>
        <input
          type="search"
          class="search-input"
          placeholder="Filter recipes…"
          aria-label="Filter recipes"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <div class="recipe-picker-list">
          {visibleRecipes.length === 0 && <p class="muted">No recipes match.</p>}
          {visibleRecipes.map((r) => {
            const s = sel(r.slug, r.baseServings);
            return (
              <label class="check" key={r.slug}>
                <input type="checkbox" checked={s.selected} onChange={() => toggle(r.slug, r.baseServings)} />
                <span style="flex:1">{r.title}</span>
                <span class="stepper">
                  <button
                    type="button"
                    class="btn-sm"
                    aria-label="fewer servings"
                    disabled={s.servings <= 1}
                    onClick={() => setServings(r.slug, r.baseServings, Math.max(1, s.servings - 1))}
                  >
                    −
                  </button>
                  <output>{s.servings}</output>
                  <button
                    type="button"
                    class="btn-sm"
                    aria-label="more servings"
                    disabled={s.servings >= 12}
                    onClick={() => setServings(r.slug, r.baseServings, Math.min(12, s.servings + 1))}
                  >
                    +
                  </button>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div class="grocery-result">
        <div class="grocery-result-header">
          <h2>
            Grocery list{' '}
            {merged.length > 0 && (
              <span class="progress">
                {merged.filter((m) => checkedItems.has(m.key)).length}/{merged.length}
              </span>
            )}
          </h2>
          {anySelected && (
            <div class="grocery-actions">
              <button
                type="button"
                class="btn-sm"
                onClick={() => setState((s) => {
                  const next: State = {};
                  for (const k of Object.keys(s)) next[k] = { ...s[k], selected: false };
                  return next;
                })}
              >
                Clear selection
              </button>
              {checkedItems.size > 0 && (
                <button type="button" class="btn-sm" onClick={() => setCheckedItems(new Set())}>
                  Clear checked
                </button>
              )}
            </div>
          )}
        </div>
        {!anySelected && <p class="muted">Select recipes to build your list.</p>}
        {anySelected && merged.length === 0 && <p class="muted">No quantifiable ingredients.</p>}
        <ul class="ingredients check-list">
          {merged.map((m) => (
            <li key={m.key} class={`ing-item${checkedItems.has(m.key) ? ' checked' : ''}`}>
              <label>
                <input
                  type="checkbox"
                  checked={checkedItems.has(m.key)}
                  onChange={() => toggleChecked(m.key)}
                />
                <span class="ing-text">{m.display}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
