import { parseRecipeMarkdown, serializeRecipeMarkdown, slugify } from '../../../src/lib/recipeMarkdown';
import { recipeFrontmatterSchema, type RecipeFrontmatter } from '../../../src/lib/recipeSchema';
import {
  createBranch,
  getBaseSha,
  getFile,
  githubConfig,
  openPullRequest,
  putFile,
} from '../../_lib/github';

interface Env {
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BASE_BRANCH?: string;
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

export async function onRequestGet({ request, env }: Context): Promise<Response> {
  const slug = new URL(request.url).searchParams.get('slug');
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return json({ error: 'A valid recipe slug is required.' }, 400);
  }

  try {
    const file = await getFile(githubConfig(env), recipePath(slug), env.GITHUB_BASE_BRANCH || 'main');
    if (!file) return json({ error: 'Recipe not found.' }, 404);
    const parsed = parseRecipeMarkdown(file.content);
    return json({ recipe: parsed.data, body: parsed.body });
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
}

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  let payload: { mode?: 'create' | 'edit'; slug?: string; body?: string; recipe?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }

  const recipe = (payload.recipe ?? payload) as unknown;
  const validation = recipeFrontmatterSchema.safeParse(recipe);
  if (!validation.success) {
    return json({ error: 'Recipe validation failed.', issues: validation.error.issues }, 400);
  }

  const data: RecipeFrontmatter = validation.data;
  const mode = payload.mode === 'edit' ? 'edit' : 'create';
  const slug = mode === 'create' ? slugify(data.title) : payload.slug;
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return json({ error: 'A valid recipe slug could not be determined.' }, 400);
  }

  try {
    const config = githubConfig(env);
    const path = recipePath(slug);
    const existing = await getFile(config, path, config.baseBranch);
    if (mode === 'create' && existing) return json({ error: 'A recipe with this title already exists.' }, 409);
    if (mode === 'edit' && !existing) return json({ error: 'This recipe no longer exists.' }, 404);

    const branch = `editor/${mode}-${slug}-${Date.now()}`;
    const baseSha = await getBaseSha(config);
    await createBranch(config, branch, baseSha);
    await putFile(
      config,
      path,
      branch,
      serializeRecipeMarkdown(data, payload.body || ''),
      existing?.sha,
      `${mode === 'create' ? 'Add' : 'Update'} recipe: ${data.title}`,
    );
    const prUrl = await openPullRequest(
      config,
      branch,
      `${mode === 'create' ? 'Add' : 'Update'} recipe: ${data.title}`,
      `Opened via the \`/editor\` recipe editor. CI gates the merge.`,
    );
    return json({ url: prUrl, slug });
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
}
