'use client';

/**
 * app/render/page.tsx
 * ===================
 * The canonical surface Puppeteer visits. Nothing here is preview chrome — what
 * this page paints is exactly what lands in the PDF.
 *
 * The document arrives as `window.__NOTEBOOK__`, injected by
 * `scripts/render-pdf.ts` via `evaluateOnNewDocument` BEFORE navigation. Not a
 * query param (a real notebook is far too big for a URL) and not an API route
 * (that would need server-side state for what is a one-shot render).
 */

import { useEffect, useState } from 'react';
import NotebookRenderer from '@/components/NotebookRenderer';
import type { NotebookDocument } from '@/lib/types';

type Load =
  | { state: 'waiting' }
  | { state: 'missing' }
  | { state: 'ok'; doc: NotebookDocument; breakOnTopic: boolean };

export default function RenderPage() {
  // Read in an effect, not during render: touching `window` while rendering
  // breaks hydration, and the injected global is only visible on the client.
  const [load, setLoad] = useState<Load>({ state: 'waiting' });

  useEffect(() => {
    const doc = window.__NOTEBOOK__;
    if (doc && Array.isArray(doc.pages)) {
      setLoad({
        state: 'ok',
        doc,
        breakOnTopic: window.__ROUGHPAGE_OPTS__?.breakOnTopic ?? true,
      });
    } else setLoad({ state: 'missing' });
  }, []);

  if (load.state === 'waiting') return null;

  /**
   * Deliberately NOT falling back to the bundled fixture.
   *
   * A silent fallback would mean a broken injection produces a perfectly
   * plausible PDF of the wrong document — the worst possible failure mode,
   * because nothing looks wrong. So: no document, no ready flag. The render
   * script times out with this message visible on the page.
   */
  if (load.state === 'missing') {
    return (
      <pre
        style={{
          fontFamily: 'ui-monospace, monospace',
          color: '#fca5a5',
          background: '#111827',
          padding: 32,
          margin: 0,
          minHeight: '100vh',
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {[
          'window.__NOTEBOOK__ is not set.',
          '',
          'This page renders only an injected document. It is reached by',
          'scripts/render-pdf.ts, which sets the global before navigating.',
          '',
          'To look at a notebook by hand, use the preview at / instead.',
        ].join('\n')}
      </pre>
    );
  }

  return (
    <NotebookRenderer
      doc={load.doc}
      breakOnTopic={load.breakOnTopic}
      shadow={false}
      signalReady
    />
  );
}
