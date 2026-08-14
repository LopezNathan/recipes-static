import { z } from 'zod';

// Canonical unit enum. `null` unit = a countable item (e.g. "2 eggs").
export const UNITS = ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'tsp', 'tbsp', 'cup'] as const;

export const ingredientSchema = z.object({
  qty: z.number().nullable(),
  unit: z.enum(UNITS).nullable(),
  item: z.string().min(1),
  key: z.string().optional(),
  group: z.string().optional(),
});

export const stepSchema = z.object({
  text: z.string().min(1),
  timer: z.number().int().positive().optional(),
});

export const recipeFrontmatterSchema = z.object({
  title: z.string().min(1),
  servings: z.number().int().positive(),
  time: z.object({
    prep: z.number().int().nonnegative(),
    cook: z.number().int().nonnegative(),
  }),
  tags: z
    .array(z.string().regex(/^[a-z0-9-]+$/, 'tags must be lowercase and hyphenated'))
    .default([]),
  source: z.string().url().nullable().default(null),
  ingredients: z.array(ingredientSchema).nonempty(),
  steps: z.array(stepSchema).nonempty(),
  image: z.string().url().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  created: z.coerce.date().optional(),
});

export type RecipeFrontmatter = z.infer<typeof recipeFrontmatterSchema>;
export type Ingredient = z.infer<typeof ingredientSchema>;
export type RecipeStep = z.infer<typeof stepSchema>;
