import { describe, expect, it } from 'vitest';
import { onRequest } from '../functions/_middleware';

function context(url: string) {
  return {
    request: new Request(url), env: {}, next: () => Promise.resolve(new Response('next')),
  } as unknown as Parameters<typeof onRequest>[0];
}

describe('editor access middleware', () => {
  it('permits only local Pages development requests without an Access JWT', async () => {
    expect((await onRequest(context('http://localhost:8788/editor/api/import'))).status).toBe(200);
    expect((await onRequest(context('https://recipes.nathanlopez.com/editor/api/import'))).status).toBe(401);
  });
});
