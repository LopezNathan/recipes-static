import fs from 'node:fs';
import path from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';

// Raw recipe markdown, emitted at build time so `MOCK_GITHUB` Pages Functions
// can load real recipes from static assets instead of GitHub. It sits under
// /editor/, so production keeps it behind Cloudflare Access like the editor.
const recipesDir = path.join(process.cwd(), 'src/content/recipes');

export const getStaticPaths: GetStaticPaths = () =>
  fs
    .readdirSync(recipesDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ params: { slug: name.slice(0, -3) } }));

export const GET: APIRoute = ({ params }) =>
  new Response(fs.readFileSync(path.join(recipesDir, `${params.slug}.md`), 'utf8'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
