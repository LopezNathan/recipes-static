import { describe, expect, it } from 'vitest';
import { onRequestPost } from '../functions/editor/api/recipe';

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
