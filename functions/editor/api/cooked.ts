import { parseRecipeMarkdown, serializeRecipeMarkdown } from '../../../src/lib/recipeMarkdown';
import { getFile, githubConfig, putFile } from '../../_lib/github';
import { getMockRecipe, type AssetsBinding } from '../../_lib/mockRecipes';

interface Env {
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BASE_BRANCH?: string;
  MOCK_GITHUB?: string;
  ASSETS?: AssetsBinding;
}

type Context = {
  request: Request;
  env: Env;
};

const recipePath = (slug: string) => `src/content/recipes/${slug}.md`;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected GitHub error';
}

/** Increment a recipe's `cooked` count and commit it to the base branch. */
export async function onRequestPost({ request, env }: Context): Promise<Response> {
  let payload: { slug?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }

  const slug = payload.slug;
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return json({ error: 'A valid recipe slug is required.' }, 400);
  }
  if (env.MOCK_GITHUB === 'true') {
    // Report what the count would become, from the local build, without saving.
    const content = await getMockRecipe(env.ASSETS, request.url, slug);
    if (!content) return json({ error: 'Recipe not found in the local build. Run `npm run build` first.' }, 404);
    return json({ slug, cooked: (parseRecipeMarkdown(content).data.cooked ?? 0) + 1, mocked: true });
  }

  try {
    const config = githubConfig(env);
    const path = recipePath(slug);
    // The read-increment-write is not atomic; if another commit lands between
    // our read and write, GitHub rejects the stale sha and we retry once.
    for (let attempt = 0; ; attempt++) {
      const existing = await getFile(config, path, config.baseBranch);
      if (!existing) return json({ error: 'Recipe not found.' }, 404);
      const { data, body } = parseRecipeMarkdown(existing.content);
      const cooked = (data.cooked ?? 0) + 1;
      try {
        await putFile(
          config,
          path,
          config.baseBranch,
          serializeRecipeMarkdown({ ...data, cooked }, body),
          existing.sha,
          `Cooked: ${data.title}`,
        );
        return json({ slug, cooked });
      } catch (error) {
        if (attempt >= 1 || !/\((409|422)\)/.test(errorMessage(error))) throw error;
      }
    }
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
}
