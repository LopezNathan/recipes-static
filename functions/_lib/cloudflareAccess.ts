const ACCESS_ISSUER = 'https://lopeznathan.cloudflareaccess.com';
// Cloudflare Access calls this the application audience. It is public metadata,
// but binding it here prevents a token issued for a different Access app from
// authorizing the editor.
const ACCESS_AUDIENCE = '7dcbbcf5e2e7d0f3c80a2793300aaead4394633f5727eebfe6e1166403a3974d';
const ACCESS_CERTS_URL = `${ACCESS_ISSUER}/cdn-cgi/access/certs`;

type AccessJwtPayload = {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  nbf?: unknown;
};

type AccessJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

let certsPromise: Promise<AccessJwk[]> | undefined;

function decodeBase64Url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function accessCerts(): Promise<AccessJwk[]> {
  if (!certsPromise) {
    certsPromise = fetch(ACCESS_CERTS_URL, { cf: { cacheTtl: 14_400, cacheEverything: true } } as RequestInit)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Cloudflare Access certificates returned ${response.status}`);
        const body = (await response.json()) as { keys?: AccessJwk[] };
        if (!body.keys?.length) throw new Error('Cloudflare Access returned no signing certificates');
        return body.keys;
      })
      .catch((error) => {
        certsPromise = undefined;
        throw error;
      });
  }
  return certsPromise;
}

function hasAudience(audience: unknown): boolean {
  return Array.isArray(audience)
    ? audience.includes(ACCESS_AUDIENCE)
    : audience === ACCESS_AUDIENCE;
}

/**
 * Cryptographically validates the JWT Cloudflare Access sends to the origin.
 * This is needed because the Pages *.pages.dev hostname bypasses the Access
 * application attached to recipes.nathanlopez.com.
 */
export async function hasValidAccessJwt(token: string | null): Promise<boolean> {
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  let header: { alg?: unknown; kid?: unknown } | null;
  let payload: AccessJwtPayload | null;
  try {
    header = parseJson<{ alg?: unknown; kid?: unknown }>(new TextDecoder().decode(decodeBase64Url(encodedHeader)));
    payload = parseJson<AccessJwtPayload>(new TextDecoder().decode(decodeBase64Url(encodedPayload)));
  } catch {
    return false;
  }
  if (!header || !payload || header.alg !== 'RS256' || typeof header.kid !== 'string') return false;
  if (payload.iss !== ACCESS_ISSUER || !hasAudience(payload.aud)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) return false;
  if (typeof payload.nbf === 'number' && payload.nbf > now + 30) return false;

  try {
    const jwk = (await accessCerts()).find((certificate) => certificate.kid === header.kid);
    if (!jwk) return false;

    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    return crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
  } catch {
    return false;
  }
}

export function isEditorPath(pathname: string): boolean {
  // Decode repeatedly so an encoded separator such as `%252F` cannot evade
  // the check and then be decoded by a later layer in the request pipeline.
  for (let index = 0; index < 3; index++) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return true;
    }
    if (decoded === pathname) break;
    pathname = decoded;
  }

  const path = pathname.toLowerCase();
  return path === '/editor' || path.startsWith('/editor/') || path.startsWith('/editor.');
}
