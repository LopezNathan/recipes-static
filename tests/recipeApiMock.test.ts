import { describe, expect, it } from 'vitest';
import { onRequestPost as postCooked } from '../functions/editor/api/cooked';
import { onRequestGet, onRequestPost } from '../functions/editor/api/recipe';

const toastMarkdown = `---\ntitle: Toast\nservings: 1\ntime:\n  prep: 1\n  cook: 2\ntags: []\nsource: null\ningredients:\n- qty: 1\n  unit: null\n  item: bread\nsteps:\n- text: Toast the bread.\ncooked: 4\n---\n`;

// Stands in for the Pages static-asset binding serving dist/editor/source/*.md.
const ASSETS = {
  fetch: async (url: Request | string) =>
    String(url).endsWith('/editor/source/toast.md') ? new Response(toastMarkdown) : new Response('Not found', { status: 404 }),
};

const validRecipe = {
  title: 'Mock save soup', servings: 2, time: { prep: 5, cook: 10 }, tags: [], source: null,
  ingredients: [{ qty: 1, unit: 'cup', item: 'stock' }], steps: [{ text: 'Simmer.' }],
};

describe('recipe API mock mode', () => {
  it('uses the production validation but never reaches GitHub', async () => {
    const response = await onRequestPost({
      request: new Request('http://localhost/editor/api/recipe', { method: 'POST', body: JSON.stringify({ mode: 'create', recipe: validRecipe }) }),
      env: { MOCK_GITHUB: 'true' },
    });
    expect(await response.json()).toEqual({ slug: 'mock-save-soup', mocked: true });
  });

  it('still rejects invalid recipes before reporting a mock save', async () => {
    const response = await onRequestPost({
      request: new Request('http://localhost/editor/api/recipe', { method: 'POST', body: JSON.stringify({ recipe: { ...validRecipe, title: '' } }) }),
      env: { MOCK_GITHUB: 'true' },
    });
    expect(response.status).toBe(400);
  });
});

describe('recipe API mock loading', () => {
  it('loads a recipe from the local build instead of GitHub', async () => {
    const response = await onRequestGet({ request: new Request('http://localhost/editor/api/recipe?slug=toast'), env: { MOCK_GITHUB: 'true', ASSETS } });
    const result = await response.json() as { recipe: { title: string } };
    expect(result.recipe.title).toBe('Toast');
  });

  it('404s for a recipe missing from the build', async () => {
    const response = await onRequestGet({ request: new Request('http://localhost/editor/api/recipe?slug=nope'), env: { MOCK_GITHUB: 'true', ASSETS } });
    expect(response.status).toBe(404);
  });
});

describe('cooked API mock mode', () => {
  it('reports the next count from the local build without saving', async () => {
    const response = await postCooked({
      request: new Request('http://localhost/editor/api/cooked', { method: 'POST', body: JSON.stringify({ slug: 'toast' }) }),
      env: { MOCK_GITHUB: 'true', ASSETS },
    });
    expect(await response.json()).toEqual({ slug: 'toast', cooked: 5, mocked: true });
  });

  it('rejects an invalid slug', async () => {
    const response = await postCooked({
      request: new Request('http://localhost/editor/api/cooked', { method: 'POST', body: JSON.stringify({ slug: '../etc' }) }),
      env: { MOCK_GITHUB: 'true', ASSETS },
    });
    expect(response.status).toBe(400);
  });
});
