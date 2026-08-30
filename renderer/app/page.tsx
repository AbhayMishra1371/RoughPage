'use client';

/**
 * app/page.tsx
 * ============
 * The preview. Mounts the SAME <NotebookRenderer> the PDF surface uses, so what
 * you tune here with hot reload is what comes out of `npm run render` — there is
 * no second rendering path to drift out of sync.
 *
 * Everything in the bar is screen-only; globals.css hides it in print.
 */

import { useEffect, useMemo, useState } from 'react';
import NotebookRenderer, { type RenderStatus } from '@/components/NotebookRenderer';
import allElementsJson from '@/fixtures/all-elements.json';
import sampleJson from '@/fixtures/sample-notebook.json';
import type { NotebookDocument } from '@/lib/types';

/**
 * The bundled fixtures. Both are imported statically rather than fetched: they
 * live in `fixtures/`, not `public/`, so there is no URL to fetch them from —
 * and a static import means a bad fixture fails at build time, not at runtime.
 *
 * The fixture carries a `_comment` key that the schema doesn't declare; the
 * backend would ignore it and so do we.
 */
const FIXTURES: Record<string, NotebookDocument> = {
  'sample-notebook.json': sampleJson as unknown as NotebookDocument,
  'all-elements.json': allElementsJson as unknown as NotebookDocument,
};

const DEFAULT_FIXTURE = 'sample-notebook.json';

export default function PreviewPage() {
  const [doc, setDoc] = useState<NotebookDocument>(FIXTURES[DEFAULT_FIXTURE]);
  const [name, setName] = useState(DEFAULT_FIXTURE);
  const [breakOnTopic, setBreakOnTopic] = useState(true);
  const [status, setStatus] = useState<RenderStatus>({
    phase: 'fonts',
    pages: 0,
    warnings: [],
  });
  const [error, setError] = useState<string | null>(null);

  /**
   * `?fixture=all-elements.json` deep-links to a fixture, which is how the
   * screenshot and grid-audit passes reach it without a file dialog.
   *
   * Applied in an effect rather than in the initial state: `location` does not
   * exist while Next prerenders this page, and seeding state from it would be a
   * hydration mismatch.
   */
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get('fixture');
    if (want && FIXTURES[want]) {
      setDoc(FIXTURES[want]);
      setName(want);
    }
  }, []);

  function pickFixture(key: string) {
    if (!FIXTURES[key]) return;
    setError(null);
    setDoc(FIXTURES[key]);
    setName(key);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const parsed = JSON.parse(await file.text()) as NotebookDocument;
      if (!parsed || !Array.isArray(parsed.pages)) {
        throw new Error('No `pages` array — is this a NotebookDocument?');
      }
      setDoc(parsed);
      setName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const claimed = doc.metadata?.total_pages ?? 0;

  // The AI's total_pages is the topic-group count, not the real page count.
  // Showing both makes the discrepancy visible instead of confusing.
  const pageLabel = useMemo(() => {
    if (status.phase !== 'ready') return '…';
    return `${status.pages} page${status.pages === 1 ? '' : 's'} (JSON claimed ${claimed})`;
  }, [status, claimed]);

  return (
    <>
      <div className="preview-bar">
        <strong>RoughPage</strong>

        <select
          id="fixture"
          value={FIXTURES[name] ? name : ''}
          onChange={(e) => pickFixture(e.target.value)}
        >
          {/* Present only while a file loaded from disk is showing. */}
          {!FIXTURES[name] && <option value="">{name}</option>}
          {Object.keys(FIXTURES).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>

        <label className="file">
          Load JSON…
          <input
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={breakOnTopic}
            onChange={(e) => setBreakOnTopic(e.target.checked)}
          />
          new page per topic
        </label>

        <span className="spacer" />

        <span>{pageLabel}</span>
        <span style={{ opacity: 0.6 }}>{status.phase}</span>
        <button onClick={() => window.print()}>Print…</button>
      </div>

      {error && (
        <pre style={{ color: '#fca5a5', background: '#111827', margin: 0, padding: '10px 20px' }}>
          {error}
        </pre>
      )}

      {status.warnings.length > 0 && (
        <pre
          style={{
            color: '#fcd34d',
            background: '#1f2937',
            margin: 0,
            padding: '10px 20px',
            fontSize: 12.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {status.warnings.join('\n')}
        </pre>
      )}

      <NotebookRenderer
        doc={doc}
        breakOnTopic={breakOnTopic}
        onStatus={setStatus}
        signalReady={false}
      />
    </>
  );
}
