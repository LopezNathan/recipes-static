# recipes-static

A fully static recipe site: [Astro](https://astro.build) + markdown recipes
with Zod-validated frontmatter, deployed to Cloudflare Pages.

## Quick start

```bash
npm install
npm run dev            # http://localhost:4321 — Astro only, no editor API
npm run build          # astro build → dist/
npm test               # vitest: grocery-merge and fraction rules
```

### Local dev with the editor API (Pages Functions)

`npm run dev` serves the site but not `functions/`, so the editor's
import/save and the "I cooked this" button fail there. To exercise them, build
and run the output under Wrangler:

```bash
# put MOCK_GITHUB=true in .dev.vars (see .dev.vars.example)
npm run build && npm run pages:dev
# or, without a .dev.vars:
npm run build && npx wrangler pages dev dist --binding MOCK_GITHUB=true
```

Mock mode never calls GitHub: the editor and the cooked button load recipes
from the local build (`dist/editor/source/*.md`), and saves only validate.
Rebuild after editing recipe files. To commit for real from local, drop
`MOCK_GITHUB` and set `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, and
`GITHUB_BASE_BRANCH` in `.dev.vars` (a fine-grained token with Contents
read/write on this repo).

## Structure

```
src/
  content/
    config.ts          # Zod schema — the source of truth for frontmatter
    recipes/*.md       # one file per recipe, slug = kebab-case title
  layouts/Base.astro
  pages/
    index.astro        # all recipes, client-side tag filter
    recipes/[slug].astro
    tags/[tag].astro
    grocery.astro      # merged grocery list
  components/
    CookMode.tsx       # serving stepper + per-step timers (client:visible)
    GroceryList.tsx    # recipe selection + merge (client:visible)
  lib/
    units.ts           # dimensions, conversions, display ladder
    fractions.ts       # quantity scaling + unicode-fraction display
    merge.ts           # grocery merge
tests/                 # vitest
```

## Features

- **Recipes** as markdown with structured, validated frontmatter. Invalid
  frontmatter fails the build by design.
- **Recipe cards** on the homepage show the recipe's photo as a full-bleed
  background (dark gradient behind the title/meta text); recipes without a
  photo fall back to a plain gradient card instead of a broken image.
- **Cook Mode** on each recipe: serving stepper (1–12) that scales quantities,
  rendering fractions (`⅛ ¼ ⅓ ½ ⅔ ¾`) below 10 and integers at/above 10; plus
  independent per-step countdown timers.
- **Edit on GitHub** link at the bottom of each recipe page, linking straight
  to that recipe's markdown file in GitHub's editor.
- **Cooked count**: an "I cooked this" button on each recipe page bumps the
  recipe's `cooked` frontmatter count via a commit (requires the editor's
  Cloudflare Access session). Shown in the recipe meta and as a "Most cooked"
  sort on the homepage.
- **Grocery list** (`/grocery`): pick recipes and servings (saved in
  `localStorage`), quantities merge by item and dimension. Mass, volume, and
  count are never mixed — the same item measured two ways shows as
  `onion — 2, plus 200 g`.
- **Private recipe editor** (`/editor`): Cloudflare Access-protected recipe
  creation and editing, with valid changes committed directly to `main`.
- Dark, minimal styling, no CSS framework.

## Adding recipes

See [`CLAUDE.md`](./CLAUDE.md) for the schema, slug convention, and the list of
existing `tag`/`key` values to reuse.

## Deploy (Cloudflare Pages)

Build output is `dist/` (`pages_build_output_dir` in `wrangler.toml`).

```bash
npm run build
npx wrangler pages deploy dist
```

Or connect the repo to a Cloudflare Pages project (Git integration) with
build command `npm run build`, output directory `dist`, and production
branch `main` — pushes to `main` then auto-build and deploy. If a repo you
just created isn't selectable when connecting, the Cloudflare GitHub App is
likely scoped to "only select repositories" — add it from
[github.com/settings/installations](https://github.com/settings/installations)
first.
