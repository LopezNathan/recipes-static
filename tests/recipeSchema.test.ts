import { describe, expect, it } from 'vitest';
import { recipeFrontmatterSchema } from '../src/lib/recipeSchema';

const validRecipe = {
  title: 'Test recipe',
  servings: 2,
  time: { prep: 5, cook: 10 },
  tags: ['quick', 'one-pot'],
  source: null,
  ingredients: [{ qty: 1, unit: 'cup', item: 'rice' }],
  steps: [{ text: 'Cook the rice.' }],
};

describe('recipeFrontmatterSchema', () => {
  it('accepts the required shape and leaves optional extension fields omitted', () => {
    const result = recipeFrontmatterSchema.safeParse(validRecipe);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.image).toBeUndefined();
    expect(result.data.rating).toBeUndefined();
    expect(result.data.created).toBeUndefined();
    expect(result.data.tags).toEqual(['quick', 'one-pot']);
  });

  it('rejects uppercase, underscored, and punctuated tags', () => {
    for (const tag of ['Quick', 'one_pot', 'one pot']) {
      expect(recipeFrontmatterSchema.safeParse({ ...validRecipe, tags: [tag] }).success).toBe(false);
    }
  });

  it('rejects missing required fields, empty lists, and invalid units', () => {
    const { title: _title, ...missingTitle } = validRecipe;
    expect(recipeFrontmatterSchema.safeParse(missingTitle).success).toBe(false);
    expect(recipeFrontmatterSchema.safeParse({ ...validRecipe, ingredients: [] }).success).toBe(false);
    expect(recipeFrontmatterSchema.safeParse({ ...validRecipe, steps: [] }).success).toBe(false);
    expect(recipeFrontmatterSchema.safeParse({
      ...validRecipe,
      ingredients: [{ qty: 1, unit: 'pinch', item: 'salt' }],
    }).success).toBe(false);
  });

  it('accepts null quantity and unit for countable or to-taste ingredients', () => {
    const result = recipeFrontmatterSchema.safeParse({
      ...validRecipe,
      ingredients: [{ qty: null, unit: null, item: 'salt, to taste' }],
    });
    expect(result.success).toBe(true);
  });
});
