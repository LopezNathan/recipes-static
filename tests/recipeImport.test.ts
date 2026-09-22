import { describe, expect, it, vi } from 'vitest';
import { discoverJsonLd, discoverRecipes, normalizeInstructions, parseIngredient, parseIsoDuration, recipeDraft } from '../src/lib/recipeImport';
import { fetchRecipePage, MAX_BYTES, publicHttpUrl, responseText } from '../functions/editor/api/import';
import { recipeFrontmatterSchema } from '../src/lib/recipeSchema';

describe('recipe JSON-LD import', () => {
  it('finds recipes in graph and array JSON-LD', () => {
    const html = `<script type="application/ld+json">[{"@graph":[{"@type":"WebPage"},{"@type":["Thing","Recipe"],"name":"Graph recipe"}]}]</script>`;
    expect(discoverJsonLd(html).flatMap(discoverRecipes)).toHaveLength(1);
  });

  it('ignores malformed JSON-LD rather than parsing page content', () => {
    expect(discoverJsonLd('<script type="application/ld+json">{not json}</script>')).toEqual([]);
  });

  it('parses ISO-8601 recipe durations', () => {
    expect(parseIsoDuration('PT1H25M')).toBe(85);
    expect(parseIsoDuration('P1DT2H')).toBe(1560);
    expect(parseIsoDuration('90 minutes')).toBeUndefined();
  });

  it('maps standard ingredient prefixes and preserves unfamiliar measures as text', () => {
    expect(parseIngredient('1 1/2 cups flour')).toMatchObject({ qty: 1.5, unit: 'cup', item: 'flour' });
    expect(parseIngredient('2 large eggs')).toMatchObject({ qty: 2, unit: null, item: 'large eggs' });
    expect(parseIngredient('1 pinch smoked paprika')).toEqual({ qty: null, unit: null, item: '1 pinch smoked paprika' });
  });

  it('normalizes string and HowTo-style instructions', () => {
    expect(normalizeInstructions([{ text: 'Mix well.' }, { itemListElement: [{ text: 'Bake.' }] }])).toEqual([{ text: 'Mix well.' }, { text: 'Bake.' }]);
  });

  it('keeps a multi-sentence cooking action together and strips publisher markup', () => {
    expect(normalizeInstructions('**Wash and dry all produce.** Preheat oven to 400 degrees or grill to high.')).toEqual([
      { text: 'Wash and dry all produce. Preheat oven to 400 degrees or grill to high.' },
    ]);
    expect(normalizeInstructions({ name: 'Ignored section title', itemListElement: [{ text: '<p>Cook <strong>onion</strong>.</p>' }] })).toEqual([
      { text: 'Cook onion.' },
    ]);
  });

  it('creates an incomplete review draft with clear warnings', () => {
    const result = recipeDraft({ '@type': 'Recipe', name: 'Soup', recipeIngredient: ['1 pinch salt'] }, 'https://example.com/soup');
    expect(result.draft).toMatchObject({ title: 'Soup', source: 'https://example.com/soup' });
    expect(result.warnings.join(' ')).toMatch(/servings|instructions|unfamiliar/i);
    expect(recipeFrontmatterSchema.safeParse(result.draft).success).toBe(false);
  });
});

describe('import fetch safeguards', () => {
  it('allows public HTTP URLs and rejects non-public targets', () => {
    expect(publicHttpUrl('https://recipes.example.com/x')?.hostname).toBe('recipes.example.com');
    for (const url of ['ftp://example.com/x', 'http://localhost/x', 'http://127.0.0.1/x', 'http://10.0.0.1/x', 'http://100.64.0.1/x', 'http://192.168.1.2/x', 'http://[::1]/x', 'https://user:pass@example.com/x']) expect(publicHttpUrl(url)).toBeNull();
  });

  it('checks every redirect destination before fetching it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 302, headers: { Location: 'http://127.0.0.1/private' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchRecipePage(new URL('https://example.com/recipe'))).rejects.toThrow(/non-public/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('rejects non-HTML and oversized responses', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('image', { headers: { 'Content-Type': 'image/jpeg' } }))
      .mockResolvedValueOnce(new Response('x', { headers: { 'Content-Type': 'text/html', 'Content-Length': String(MAX_BYTES + 1) } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchRecipePage(new URL('https://example.com/image'))).rejects.toThrow(/HTML/i);
    await expect(fetchRecipePage(new URL('https://example.com/large'))).rejects.toThrow(/too large/i);
    vi.unstubAllGlobals();
  });

  it('enforces the streaming response-size limit', async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(MAX_BYTES + 1)); controller.close(); } });
    await expect(responseText(new Response(stream))).rejects.toThrow(/too large/i);
  });
});
