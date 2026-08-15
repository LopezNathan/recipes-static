import { hasValidAccessJwt, isEditorPath } from './_lib/cloudflareAccess';

interface Env {
  CF_ACCESS_AUD?: string;
}

type PagesContext = EventContext<Env, string, Record<string, unknown>>;

export const onRequest: PagesFunction<Env> = async (context: PagesContext) => {
  const url = new URL(context.request.url);
  if (!isEditorPath(url.pathname)) {
    return context.next();
  }

  const accessJwt = context.request.headers.get('CF-Access-JWT-Assertion');
  if (!(await hasValidAccessJwt(accessJwt))) {
    return new Response('Cloudflare Access authentication required.\n', {
      status: 401,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'WWW-Authenticate': 'Bearer',
      },
    });
  }

  return context.next();
};
