/** @jsxImportSource preact */
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatQty, scaleQty } from '../lib/fractions';

interface Ingredient {
  qty: number | null;
  unit: string | null;
  item: string;
  group?: string;
}
interface Step {
  text: string;
  timer?: number;
}
interface Props {
  baseServings: number;
  ingredients: Ingredient[];
  steps: Step[];
}

const MIN = 1;
const MAX = 12;

function ingredientLine(ing: Ingredient, servings: number, base: number): string {
  const scaled = ing.qty === null ? null : scaleQty(ing.qty, servings, base);
  const qty = formatQty(scaled);
  const parts = [qty, ing.unit ?? '', ing.item].filter((p) => p && p.length > 0);
  return parts.join(' ');
}

function mmss(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function StepTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [running]);

  const done = remaining === 0;
  return (
    <div class="step-timer">
      <span class="timer">{mmss(remaining)}</span>
      {!done && (
        <button type="button" onClick={() => setRunning((v) => !v)}>
          {running ? 'Pause' : remaining === seconds ? 'Start' : 'Resume'}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setRunning(false);
          setRemaining(seconds);
        }}
      >
        Reset
      </button>
      {done && (
        <span class="timer-done" role="status">
          time's up
        </span>
      )}
    </div>
  );
}

/**
 * Split ingredients into their display groups, preserving original order and
 * index (checkbox state is keyed by index into the flat ingredients array).
 * Ungrouped recipes collapse to a single entry with no heading.
 */
function groupIngredients(
  ingredients: Ingredient[]
): [string | undefined, { ing: Ingredient; i: number }[]][] {
  const groups = new Map<string | undefined, { ing: Ingredient; i: number }[]>();
  ingredients.forEach((ing, i) => {
    const key = ing.group;
    const list = groups.get(key);
    if (list) list.push({ ing, i });
    else groups.set(key, [{ ing, i }]);
  });
  return [...groups.entries()];
}

function toggle(set: Set<number>, i: number): Set<number> {
  const next = new Set(set);
  if (next.has(i)) next.delete(i);
  else next.add(i);
  return next;
}

export default function CookMode({ baseServings, ingredients, steps }: Props) {
  const [servings, setServings] = useState(baseServings);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<Set<number>>(new Set());

  return (
    <div>
      <div class="stepper" style="margin:.5rem 0 1rem">
        <strong>Servings</strong>
        <button
          type="button"
          aria-label="fewer servings"
          disabled={servings <= MIN}
          onClick={() => setServings((s) => Math.max(MIN, s - 1))}
        >
          −
        </button>
        <output>{servings}</output>
        <button
          type="button"
          aria-label="more servings"
          disabled={servings >= MAX}
          onClick={() => setServings((s) => Math.min(MAX, s + 1))}
        >
          +
        </button>
      </div>

      <div class="cook-grid">
        <div>
          <h2>
            Ingredients{' '}
            {checked.size > 0 && (
              <span class="progress">
                {checked.size}/{ingredients.length}
              </span>
            )}
          </h2>
          {groupIngredients(ingredients).map(([group, items]) => (
            <div class="ing-group" key={group ?? ''}>
              {group && <h3 class="ing-group-heading">{group}</h3>}
              <ul class="ingredients check-list">
                {items.map(({ ing, i }) => (
                  <li key={i} class={`ing-item${checked.has(i) ? ' checked' : ''}`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={checked.has(i)}
                        onChange={() => setChecked((s) => toggle(s, i))}
                      />
                      <span class="ing-text">{ingredientLine(ing, servings, baseServings)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div>
          <h2>
            Steps{' '}
            {done.size > 0 && (
              <span class="progress">
                {done.size}/{steps.length}
              </span>
            )}
          </h2>
          <ol class="steps step-cards">
            {steps.map((step, i) => (
              <li
                key={i}
                class={`step-card${done.has(i) ? ' done' : ''}`}
                // Clicking anywhere on the card toggles done, except inside the
                // timer controls. The checkbox keeps it keyboard/AT accessible.
                onClick={(e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest('.step-timer')) return; // timer controls
                  if (t.closest('label')) return; // the label toggles itself
                  setDone((s) => toggle(s, i));
                }}
              >
                {/* The number circle is the toggle: it shows the step number, or a
                    check once done. The input stays in the DOM for keyboard/AT. */}
                <label class="step-toggle">
                  <input
                    type="checkbox"
                    class="visually-hidden"
                    checked={done.has(i)}
                    onChange={() => setDone((s) => toggle(s, i))}
                  />
                  <span class="step-num">{done.has(i) ? '✓' : i + 1}</span>
                  <span class="visually-hidden">Mark step {i + 1} done</span>
                </label>
                <div class="step-body">
                  <p class="step-text">{step.text}</p>
                  {step.timer ? <StepTimer seconds={step.timer} /> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
