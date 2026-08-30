/**
 * globals.d.ts
 * ============
 * The Node ↔ browser handshake surface.
 *
 * `scripts/render-pdf.ts` injects the document as `window.__NOTEBOOK__` before
 * navigation, then polls `window.__ROUGHPAGE_READY__`. Both sides need to agree
 * on these names, so they are declared once, here.
 */

import type { NotebookDocument } from './types';

declare global {
  interface Window {
    /** Injected by Puppeteer via evaluateOnNewDocument, before any script runs. */
    __NOTEBOOK__?: NotebookDocument;
    /**
     * Render options, injected alongside the document. Lets the CLI reproduce
     * exactly what the preview page shows with a given checkbox state, instead of
     * the two surfaces silently disagreeing on layout policy.
     */
    __ROUGHPAGE_OPTS__?: { breakOnTopic?: boolean };
    /** Set true only when measurement, pagination and every rough.js draw are done. */
    __ROUGHPAGE_READY__?: boolean;
    /** True page count after reflow — NOT `metadata.total_pages` from the AI. */
    __ROUGHPAGE_PAGES__?: number;
    /** Non-fatal layout complaints, surfaced by the render script. */
    __ROUGHPAGE_WARNINGS__?: string[];
    /** Current state-machine phase, for debugging a stuck render. */
    __ROUGHPAGE_PHASE__?: string;
  }
}

export {};
