/** @jsxImportSource preact */
import { useState } from 'preact/hooks';

interface Props {
  slug: string;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'done'; cooked?: number; mocked?: boolean }
  | { kind: 'signin' }
  | { kind: 'error'; text: string };

export default function CookedButton({ slug }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function markCooked() {
    setStatus({ kind: 'saving' });
    try {
      // Without an Access session, Cloudflare Access answers with a redirect to
      // its login page; `manual` surfaces that as an opaque redirect instead of
      // a cross-origin fetch failure.
      const response = await fetch('/editor/api/cooked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
        redirect: 'manual',
      });
      if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) {
        setStatus({ kind: 'signin' });
        return;
      }
      // A missing Pages Function (e.g. `astro dev`) or a proxy error page comes
      // back as HTML, so don't assume the body is JSON.
      const responseBody = await response.text();
      let result: { cooked?: number; mocked?: boolean; error?: string };
      try { result = JSON.parse(responseBody) as typeof result; } catch {
        throw new Error(`Unexpected response from the server (HTTP ${response.status}). Locally, run \`npm run build && npm run pages:dev\`; \`npm run dev\` has no API.`);
      }
      if (!response.ok) throw new Error(result.error || 'Could not record that.');
      setStatus({ kind: 'done', cooked: result.cooked, mocked: result.mocked });
    } catch (error) {
      setStatus({ kind: 'error', text: error instanceof Error ? error.message : 'Could not record that.' });
    }
  }

  if (status.kind === 'done') {
    return (
      <span class="cooked-status">
        Logged{status.cooked ? ` — cooked ${status.cooked}×` : ''}.{status.mocked ? ' (Mock mode: not saved.)' : ''}
      </span>
    );
  }
  return (
    <span class="cooked-button">
      <button type="button" class="btn-sm" disabled={status.kind === 'saving'} onClick={markCooked}>
        {status.kind === 'saving' ? 'Saving…' : 'I cooked this'}
      </button>
      {status.kind === 'signin' && (
        <span class="cooked-status">
          <a href="/editor/" target="_blank" rel="noopener">Sign in to the editor</a> first, then try again.
        </span>
      )}
      {status.kind === 'error' && <span class="cooked-status">{status.text}</span>}
    </span>
  );
}
