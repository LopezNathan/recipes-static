/** @jsxImportSource preact */
import { useEffect, useState } from 'preact/hooks';
import { recipeFrontmatterSchema, UNITS, type Ingredient, type RecipeFrontmatter, type RecipeStep } from '../../lib/recipeSchema';

interface Props {
  slug?: string;
  existingTags: string[];
}

type FormIngredient = Omit<Ingredient, 'qty'> & { qty: string };
type FormStep = Omit<RecipeStep, 'timer'> & { timer: string };

const emptyIngredient = (): FormIngredient => ({ qty: '', unit: null, item: '', key: '', group: '' });
const emptyStep = (): FormStep => ({ text: '', timer: '' });

function initialRecipe(): RecipeFrontmatter {
  return {
    title: '', servings: 4, time: { prep: 0, cook: 0 }, tags: [], source: null,
    ingredients: [{ qty: null, unit: null, item: '' }], steps: [{ text: '' }],
  };
}

function toForm(data: RecipeFrontmatter): { recipe: RecipeFrontmatter; ingredients: FormIngredient[]; steps: FormStep[] } {
  return {
    recipe: { ...data, tags: [...data.tags] },
    ingredients: data.ingredients.map((item) => ({ ...item, qty: item.qty === null ? '' : String(item.qty), key: item.key || '', group: item.group || '' })),
    steps: data.steps.map((step) => ({ ...step, timer: step.timer === undefined ? '' : String(step.timer) })),
  };
}

function cleanRecipe(recipe: RecipeFrontmatter, ingredients: FormIngredient[], steps: FormStep[]): RecipeFrontmatter {
  return {
    ...recipe,
    source: recipe.source || null,
    ingredients: ingredients.map((item) => ({
      qty: item.qty.trim() === '' ? null : Number(item.qty),
      unit: item.unit || null,
      item: item.item.trim(),
      ...(item.key?.trim() ? { key: item.key.trim() } : {}),
      ...(item.group?.trim() ? { group: item.group.trim() } : {}),
    })),
    steps: steps.map((step) => ({
      text: step.text.trim(),
      ...(step.timer.trim() ? { timer: Number(step.timer) } : {}),
    })),
  };
}

function IngredientRow({ ingredient, onChange, onRemove }: { ingredient: FormIngredient; onChange: (value: FormIngredient) => void; onRemove: () => void }) {
  return (
    <div class="editor-row editor-ingredient-row">
      <input class="editor-quantity" type="number" min="0" step="any" placeholder="Qty" aria-label="Quantity" value={ingredient.qty} onInput={(e) => onChange({ ...ingredient, qty: e.currentTarget.value })} />
      <select class="editor-unit" aria-label="Unit" value={ingredient.unit ?? ''} onChange={(e) => onChange({ ...ingredient, unit: e.currentTarget.value as Ingredient['unit'] })}>
        <option value="">count</option>
        {UNITS.map((unit) => <option value={unit}>{unit}</option>)}
      </select>
      <input class="editor-grow editor-item" placeholder="Ingredient" aria-label="Ingredient" value={ingredient.item} onInput={(e) => onChange({ ...ingredient, item: e.currentTarget.value })} />
      <input class="editor-group" placeholder="Group (optional)" aria-label="Ingredient group" value={ingredient.group} onInput={(e) => onChange({ ...ingredient, group: e.currentTarget.value })} />
      <button type="button" class="btn-sm editor-remove" onClick={onRemove} aria-label="Remove ingredient">×</button>
    </div>
  );
}

function StepRow({ step, index, onChange, onRemove }: { step: FormStep; index: number; onChange: (value: FormStep) => void; onRemove: () => void }) {
  return (
    <div class="editor-row editor-step-row">
      <span class="editor-row-number editor-step-number">{index + 1}</span>
      <textarea class="editor-grow editor-step-text" rows={2} placeholder="Describe this step" aria-label={`Step ${index + 1}`} value={step.text} onInput={(e) => onChange({ ...step, text: e.currentTarget.value })} />
      <input class="editor-step-timer" type="number" min="1" placeholder="Timer sec" aria-label="Timer seconds" value={step.timer} onInput={(e) => onChange({ ...step, timer: e.currentTarget.value })} />
      <button type="button" class="btn-sm editor-step-remove" onClick={onRemove} aria-label={`Remove step ${index + 1}`}>×</button>
    </div>
  );
}

function RatingPicker({ value, onChange }: { value?: number; onChange: (rating: number | undefined) => void }) {
  return (
    <div class="editor-rating" role="radiogroup" aria-label="Recipe rating">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          type="button"
          class="editor-star"
          aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
          aria-pressed={value === rating}
          onClick={() => onChange(value === rating ? undefined : rating)}
        >
          {value && value >= rating ? '★' : '☆'}
        </button>
      ))}
      {value && (
        <button
          type="button"
          class="editor-clear-rating"
          aria-label="Clear rating"
          title="Clear rating"
          onClick={() => onChange(undefined)}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}

function TagPicker({ tags, available, onChange }: { tags: string[]; available: string[]; onChange: (tags: string[]) => void }) {
  const [custom, setCustom] = useState('');
  const toggle = (tag: string) => onChange(tags.includes(tag) ? tags.filter((value) => value !== tag) : [...tags, tag]);
  const addCustom = () => {
    const tag = custom.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setCustom('');
  };
  return (
    <div>
      <div class="editor-tags">
        {available.map((tag) => <button type="button" class={`tag${tags.includes(tag) ? ' active' : ''}`} aria-pressed={tags.includes(tag)} onClick={() => toggle(tag)}>{tag}</button>)}
        {tags.filter((tag) => !available.includes(tag)).map((tag) => <button type="button" class="tag active" onClick={() => toggle(tag)}>{tag} ×</button>)}
      </div>
      <div class="editor-add-tag"><input value={custom} placeholder="Add tag" onInput={(e) => setCustom(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} /><button type="button" onClick={addCustom}>Add</button></div>
    </div>
  );
}

export default function RecipeEditor({ slug, existingTags }: Props) {
  // Astro emits this page statically, so the query string is only available
  // in the browser rather than while the page is being built.
  const [activeSlug, setActiveSlug] = useState<string | undefined>(slug);
  const editing = Boolean(activeSlug);
  const [recipe, setRecipe] = useState<RecipeFrontmatter>(initialRecipe);
  const [ingredients, setIngredients] = useState<FormIngredient[]>([emptyIngredient()]);
  const [steps, setSteps] = useState<FormStep[]>([emptyStep()]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(editing);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    const browserSlug = slug || new URLSearchParams(window.location.search).get('slug') || undefined;
    setActiveSlug(browserSlug);
    if (!browserSlug) return;
    setLoading(true);
    fetch(`/editor/api/recipe?slug=${encodeURIComponent(browserSlug)}`)
      .then(async (response) => {
        const result = await response.json() as { recipe?: RecipeFrontmatter; body?: string; error?: string };
        if (!response.ok) throw new Error(result.error || 'Could not load recipe.');
        if (!result.recipe) throw new Error('Recipe response was incomplete.');
        const form = toForm(result.recipe);
        setRecipe(form.recipe); setIngredients(form.ingredients); setSteps(form.steps); setBody(result.body || '');
      })
      .catch((error) => setMessage({ kind: 'error', text: error.message }))
      .finally(() => setLoading(false));
  }, [slug]);

  const updateRecipe = (patch: Partial<RecipeFrontmatter>) => setRecipe((current) => ({ ...current, ...patch }));
  const updateTime = (field: 'prep' | 'cook', value: string) => updateRecipe({ time: { ...recipe.time, [field]: Number(value) } });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    setMessage(null);
    const cleaned = cleanRecipe(recipe, ingredients, steps);
    const validation = recipeFrontmatterSchema.safeParse(cleaned);
    if (!validation.success) {
      setMessage({ kind: 'error', text: validation.error.issues.map((issue) => `${issue.path.join('.') || 'recipe'}: ${issue.message}`).join(' ') });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/editor/api/recipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: editing ? 'edit' : 'create', slug: activeSlug, recipe: validation.data, body }) });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok) throw new Error(result.error || 'Could not open pull request.');
      setMessage({ kind: 'success', text: 'Pull request opened.' });
      if (!result.url) throw new Error('GitHub did not return a pull request URL.');
      window.location.assign(result.url);
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Could not open pull request.' });
    } finally { setSubmitting(false); }
  }

  if (loading) return <p class="muted">Loading recipe…</p>;

  return (
    <form class="editor-form" onSubmit={submit}>
      <div class="editor-form-header"><div><h1>{editing ? recipe.title ? `Edit ${recipe.title}` : 'Edit recipe' : 'New recipe'}</h1>{!editing && <p class="muted">Submit a recipe as a GitHub pull request.</p>}</div><a class="btn" href="/editor/">All recipes</a></div>
      {message && <p class={`editor-message ${message.kind}`} role="status">{message.text}</p>}

      <fieldset><legend>Recipe details</legend>
        <label>Title<input required value={recipe.title} onInput={(e) => updateRecipe({ title: e.currentTarget.value })} /></label>
        <div class="editor-fields-3">
          <label>Servings<input required type="number" min="1" step="1" value={recipe.servings} onInput={(e) => updateRecipe({ servings: Number(e.currentTarget.value) })} /></label>
          <label>Prep minutes<input required type="number" min="0" step="1" value={recipe.time.prep} onInput={(e) => updateTime('prep', e.currentTarget.value)} /></label>
          <label>Cook minutes<input required type="number" min="0" step="1" value={recipe.time.cook} onInput={(e) => updateTime('cook', e.currentTarget.value)} /></label>
        </div>
        <label>Source URL<input type="url" value={recipe.source || ''} onInput={(e) => updateRecipe({ source: e.currentTarget.value || null })} /></label>
        <div class="editor-fields-2"><label>Image URL<input type="url" value={recipe.image || ''} onInput={(e) => updateRecipe({ image: e.currentTarget.value || undefined })} /></label><label>Rating<RatingPicker value={recipe.rating} onChange={(rating) => updateRecipe({ rating })} /></label></div>
        <label>Tags<TagPicker tags={recipe.tags} available={existingTags} onChange={(tags) => updateRecipe({ tags })} /></label>
      </fieldset>

      <fieldset><legend>Ingredients</legend><p class="muted editor-help">Leave quantity blank for “to taste”. Add a group heading when useful.</p>
        {ingredients.map((ingredient, index) => <IngredientRow key={index} ingredient={ingredient} onChange={(value) => setIngredients((all) => all.map((item, i) => i === index ? value : item))} onRemove={() => setIngredients((all) => all.length > 1 ? all.filter((_, i) => i !== index) : all)} />)}
        <button type="button" onClick={() => setIngredients((all) => [...all, emptyIngredient()])}>+ Add ingredient</button>
      </fieldset>

      <fieldset><legend>Steps</legend>
        {steps.map((step, index) => <StepRow key={index} index={index} step={step} onChange={(value) => setSteps((all) => all.map((item, i) => i === index ? value : item))} onRemove={() => setSteps((all) => all.length > 1 ? all.filter((_, i) => i !== index) : all)} />)}
        <button type="button" onClick={() => setSteps((all) => [...all, emptyStep()])}>+ Add step</button>
      </fieldset>

      <fieldset><legend>Notes</legend><textarea rows={6} value={body} placeholder="Optional markdown notes" onInput={(e) => setBody(e.currentTarget.value)} /></fieldset>
      <button class="editor-submit" type="submit" disabled={submitting}>{submitting ? 'Opening pull request…' : editing ? 'Open update PR' : 'Open create PR'}</button>
    </form>
  );
}
