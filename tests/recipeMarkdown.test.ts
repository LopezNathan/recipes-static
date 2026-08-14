import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRecipeMarkdown, serializeRecipeMarkdown, slugify } from '../src/lib/recipeMarkdown';

const recipesDir = path.join(process.cwd(), 'src/content/recipes');

describe('recipe markdown', () => {
  it('round-trips every real recipe structurally', () => {
    for (const file of fs.readdirSync(recipesDir).filter((name) => name.endsWith('.md'))) {
      const parsed = parseRecipeMarkdown(fs.readFileSync(path.join(recipesDir, file), 'utf8'));
      const reparsed = parseRecipeMarkdown(serializeRecipeMarkdown(parsed.data, parsed.body));
      expect(reparsed.data, file).toEqual(parsed.data);
      expect(reparsed.body, file).toBe(parsed.body);
    }
  });

  it('has a stable byte-exact snapshot for a simple recipe', () => {
    const markdown = `---\ntitle: Toast\nservings: 1\ntime:\n  prep: 1\n  cook: 2\ntags:\n- quick\nsource: null\ningredients:\n- qty: 1\n  unit: null\n  item: bread\nsteps:\n- text: Toast the bread.\n---\n`;
    const parsed = parseRecipeMarkdown(markdown);
    expect(serializeRecipeMarkdown(parsed.data, parsed.body)).toBe(markdown);
  });

  it('normalizes Date values back to a plain YYYY-MM-DD', () => {
    const parsed = parseRecipeMarkdown(fs.readFileSync(path.join(recipesDir, 'beef-stew.md'), 'utf8'));
    const output = serializeRecipeMarkdown(parsed.data, parsed.body);
    expect(output).toContain("created: '2026-06-03'");
    expect(output).not.toContain('T00:00:00');
  });

  it.each([
    ['Crème brûlée & eggs!', 'creme-brulee-and-eggs'],
    ['  repeated---hyphens  ', 'repeated-hyphens'],
    ['Fish / chips', 'fish-chips'],
  ])('slugifies %s', (title, expected) => {
    expect(slugify(title)).toBe(expected);
  });
});
