import { discoverJsonLd, discoverRecipes, recipeDraft } from '../../../src/lib/recipeImport';

type Context = { request: Request };
export const MAX_BYTES = 5_000_000;
const MAX_REDIRECTS = 3;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export function publicHttpUrl(input: string): URL | null {
  let url: URL;
  try { url = new URL(input); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.includes(':')) return null;
  // Literal IPv4 addresses are checked before fetch. Cloudflare's network does
  // not route Workers to private address space for hostname lookups.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)?.slice(1).map(Number);
  if (v4 && (v4.some((n) => n > 255) || v4[0] === 0 || v4[0] === 10 || v4[0] === 127 || v4[0] >= 224 || (v4[0] === 100 && v4[1] >= 64 && v4[1] <= 127) || (v4[0] === 169 && v4[1] === 254) || (v4[0] === 172 && v4[1] >= 16 && v4[1] <= 31) || (v4[0] === 192 && v4[1] === 168) || (v4[0] === 198 && (v4[1] === 18 || v4[1] === 19)))) return null;
  return url;
}

export async function responseText(response: Response): Promise<string> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_BYTES) throw new Error('The page is too large to import (limit: 5 MB).');
  if (!response.body) return '';
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error('The page is too large to import (limit: 5 MB).'); }
    chunks.push(value);
  }
  const body = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(body);
}

export async function fetchRecipePage(initial: URL): Promise<{ html: string; url: string }> {
  let url = initial;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const response = await fetch(url.toString(), { redirect: 'manual', headers: { Accept: 'text/html,application/xhtml+xml' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      const next = location ? publicHttpUrl(new URL(location, url).toString()) : null;
      if (!next) throw new Error('The page redirected to a non-public or invalid address.');
      url = next; continue;
    }
    if (!response.ok) throw new Error(`The recipe page returned ${response.status}.`);
    if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) throw new Error('That URL did not return an HTML page.');
    return { html: await responseText(response), url: url.toString() };
  }
  throw new Error('The page redirected too many times.');
}

export async function onRequestPost({ request }: Context): Promise<Response> {
  let url: string;
  try { url = (await request.json() as { url?: unknown }).url as string; } catch { return json({ error: 'Request body must be valid JSON.' }, 400); }
  const initial = typeof url === 'string' ? publicHttpUrl(url) : null;
  if (!initial) return json({ error: 'Enter a public http or https URL. Local, private, and credentialed URLs are not allowed.' }, 400);
  try {
    const page = await fetchRecipePage(initial);
    const recipes = discoverJsonLd(page.html).flatMap(discoverRecipes);
    if (!recipes.length) return json({ error: 'No Schema.org Recipe metadata was found. You can still paste the recipe into the editor manually.' }, 422);
    const selected = recipes.find((recipe) => typeof recipe.name === 'string' && Array.isArray(recipe.recipeIngredient)) ?? recipes[0];
    const { draft, warnings } = recipeDraft(selected, initial.toString());
    if (recipes.length > 1) warnings.unshift(`Found ${recipes.length} recipe objects; imported the first complete-looking one. Review the draft.`);
    return json({ draft, warnings });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Could not import that page.' }, 422); }
}
