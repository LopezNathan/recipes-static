import yaml from 'js-yaml';
import { recipeFrontmatterSchema, type RecipeFrontmatter } from './recipeSchema';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/;
const FIELD_ORDER = ['title', 'servings', 'time', 'tags', 'source', 'ingredients', 'steps', 'image', 'rating', 'created'];

type ParsedRecipeMarkdown = {
  data: RecipeFrontmatter;
  body: string;
};

/** Parse a recipe markdown file and validate its YAML frontmatter. */
export function parseRecipeMarkdown(markdown: string): ParsedRecipeMarkdown {
  const match = markdown.match(FRONTMATTER);
  if (!match) throw new Error('Recipe is missing YAML frontmatter');

  const raw = yaml.load(match[1]);
  const result = recipeFrontmatterSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid recipe frontmatter: ${result.error.message}`);
  }
  return { data: result.data, body: match[2] };
}

function orderedData(data: RecipeFrontmatter): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const field of FIELD_ORDER) {
    const value = data[field as keyof RecipeFrontmatter];
    if (value !== undefined) {
      output[field] = field === 'created' && value instanceof Date
        ? value.toISOString().slice(0, 10)
        : value;
    }
  }
  return output;
}

/** Serialize validated recipe data and markdown notes into the repository format. */
export function serializeRecipeMarkdown(data: RecipeFrontmatter, body = ''): string {
  const parsed = recipeFrontmatterSchema.parse(data);
  const frontmatter = yaml.dump(orderedData(parsed), {
    lineWidth: 120,
    noArrayIndent: true,
    noRefs: true,
  }).trimEnd();
  // Keep the body’s leading newline when round-tripping existing files. New
  // notes get the conventional blank line after the closing delimiter.
  const serializedBody = body ? `\n${body}` : '\n';
  return `---\n${frontmatter}\n---${serializedBody}`;
}

/** Convert a recipe title into the filename slug used by the collection. */
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
