/** Static asset binding Cloudflare Pages gives every Function. */
export interface AssetsBinding {
  fetch: (request: Request | string) => Promise<Response>;
}

/**
 * In `MOCK_GITHUB` mode, read a recipe's markdown from the build output
 * (`/editor/source/<slug>.md`) instead of GitHub. Returns null when missing.
 */
export async function getMockRecipe(assets: AssetsBinding | undefined, requestUrl: string, slug: string): Promise<string | null> {
  if (!assets) return null;
  const response = await assets.fetch(new URL(`/editor/source/${slug}.md`, requestUrl).toString());
  return response.ok ? response.text() : null;
}
