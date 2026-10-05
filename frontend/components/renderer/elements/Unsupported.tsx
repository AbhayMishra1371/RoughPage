'use client';

/**
 * Unsupported.tsx
 * ===============
 * Visible placeholder for an element this renderer cannot draw.
 *
 * As of v2 there is exactly one such type in the schema: `screenshot`. It is not
 * a missing component but a missing CAPABILITY — the backend never downloads the
 * video, so there is no frame to paste. `timestamp_seconds` is in the schema and
 * in the system prompt, and nothing acts on it.
 *
 * A visible placeholder is strictly better than content silently vanishing off
 * the page, which is indistinguishable from the AI having never produced it. This
 * also still catches a `type` the schema does not define at all, which is the only
 * defence lib/types.ts asks for.
 *
 * It is deliberately ugly. It should not be mistakable for finished output.
 */

import { EL_GAP, LINE_H } from '@/lib/geometry';
import type { NotebookElement } from '@/lib/types';

/**
 * JetBrains Mono FIRST, because it is bundled via @fontsource and every other
 * name here is a system font.
 *
 * `ui-monospace, monospace` alone resolved to Consolas on Windows and Puppeteer
 * embedded Consolas + Consolas-Bold into the PDF — a Windows-only font in output
 * that is supposed to be byte-identical on any machine. Same failure mode as the
 * missing-glyph fallback documented in lib/handwriting.tsx, reached from the
 * other direction.
 */
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** A one-line hint of what the element contained, for eyeballing coverage. */
function describe(el: NotebookElement): string {
  const e = el as Record<string, unknown>;

  if (el.type === 'screenshot') {
    const t = e.timestamp_seconds;
    const caption = String(e.caption ?? '').trim();
    return `frame @ ${typeof t === 'number' ? `${t}s` : '?'}${caption ? ` — ${caption}` : ''}`;
  }

  // An unknown type: show whichever common text field it happens to carry.
  for (const k of ['text', 'title', 'label', 'term', 'center', 'context']) {
    const v = e[k];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 70);
  }
  return '';
}

export default function Unsupported({ el }: { el: NotebookElement }) {
  const detail = describe(el);

  return (
    <div className="el" style={{ paddingBottom: EL_GAP }}>
      <div
        className="el-body"
        style={{
          border: '2px dashed #b0a99a',
          background: 'rgba(176,169,154,0.09)',
          borderRadius: 3,
          height: LINE_H,
          padding: '0 12px',
          fontFamily: MONO,
          fontSize: 12.5,
          lineHeight: `${LINE_H - 4}px`,
          color: '#7a7264',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {/*
          `[type]` deliberately NOT in a <strong>. Only JetBrains Mono 400 is
          bundled (see app/layout.tsx), so asking for bold here made Chrome
          synthesise it from a system face and embed Consolas-Bold into the PDF —
          the very thing the MONO stack above exists to prevent. Brackets and the
          dashed border already make this read as a placeholder.
        */}
        [{el.type}] not rendered
        {detail && <span style={{ opacity: 0.75 }}> — {detail}</span>}
      </div>
    </div>
  );
}
