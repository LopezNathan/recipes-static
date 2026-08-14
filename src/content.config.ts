import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { recipeFrontmatterSchema, UNITS } from './lib/recipeSchema';

// Kept as a compatibility export for code that imports units from the content config.
export { UNITS } from './lib/recipeSchema';

const recipes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/recipes' }),
  schema: recipeFrontmatterSchema,
});

export const collections = { recipes };
