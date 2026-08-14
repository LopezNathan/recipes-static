const API = 'https://api.github.com';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  baseBranch: string;
}

interface GitHubResponse<T> {
  data: T;
  response: Response;
}

async function gh<T>(config: GitHubConfig, path: string, init: RequestInit = {}): Promise<GitHubResponse<T>> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'User-Agent': 'recipes-static-editor',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  let data: T;
  try {
    data = (await response.json()) as T;
  } catch {
    data = {} as T;
  }
  return { data, response };
}

function repositoryPath(config: GitHubConfig): string {
  return `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
}

export function githubConfig(env: {
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BASE_BRANCH?: string;
}): GitHubConfig {
  const required = (name: 'GITHUB_TOKEN' | 'GITHUB_OWNER' | 'GITHUB_REPO'): string => {
    const value = env[name];
    if (!value) throw new Error(`Missing ${name} configuration`);
    return value;
  };
  return {
    token: required('GITHUB_TOKEN'),
    owner: required('GITHUB_OWNER'),
    repo: required('GITHUB_REPO'),
    baseBranch: env.GITHUB_BASE_BRANCH || 'main',
  };
}

export async function getBaseSha(config: GitHubConfig): Promise<string> {
  const result = await gh<{ object?: { sha?: string } }>(
    config,
    `${repositoryPath(config)}/git/ref/heads/${encodeURIComponent(config.baseBranch)}`,
  );
  if (!result.response.ok || !result.data.object?.sha) {
    throw new Error(`Could not read base branch (${result.response.status})`);
  }
  return result.data.object.sha;
}

export async function createBranch(config: GitHubConfig, branch: string, sha: string): Promise<void> {
  const result = await gh(config, `${repositoryPath(config)}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });
  if (!result.response.ok) throw new Error(`Could not create branch (${result.response.status})`);
}

export interface GitHubFile {
  sha: string;
  content: string;
}

export async function getFile(config: GitHubConfig, path: string, ref: string): Promise<GitHubFile | null> {
  const result = await gh<{ sha?: string; content?: string }>(
    config,
    `${repositoryPath(config)}/contents/${path}?ref=${encodeURIComponent(ref)}`,
  );
  if (result.response.status === 404) return null;
  if (!result.response.ok || !result.data.sha || typeof result.data.content !== 'string') {
    throw new Error(`Could not read recipe file (${result.response.status})`);
  }
  return { sha: result.data.sha, content: decodeBase64(result.data.content) };
}

export async function putFile(
  config: GitHubConfig,
  path: string,
  branch: string,
  content: string,
  sha?: string,
  message = 'Update recipe',
): Promise<void> {
  const result = await gh(config, `${repositoryPath(config)}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({ message, branch, content: encodeBase64(content), ...(sha ? { sha } : {}) }),
  });
  if (!result.response.ok) throw new Error(`Could not commit recipe (${result.response.status})`);
}

export async function openPullRequest(
  config: GitHubConfig,
  branch: string,
  title: string,
  body: string,
): Promise<string> {
  const result = await gh<{ html_url?: string }>(config, `${repositoryPath(config)}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title, body, head: branch, base: config.baseBranch }),
  });
  if (!result.response.ok || !result.data.html_url) {
    throw new Error(`Could not open pull request (${result.response.status})`);
  }
  return result.data.html_url;
}

/** GitHub content endpoints use base64, while Workers do not provide Node Buffer. */
export function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
