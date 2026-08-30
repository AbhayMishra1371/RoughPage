'use client';

/**
 * PaperPage.tsx
 * =============
 * One physical sheet: cream paper, ruled lines, double red margin rule, grain,
 * and a seeded micro-rotation.
 *
 * This component is also the single bridge between lib/geometry.ts and the CSS.
 * Every geometry number reaches the stylesheet as a custom property set here, so
 * the measured grid and the painted grid cannot drift apart.
 */

import type { CSSProperties, ReactNode } from 'react';
import {
  CONTENT_H,
  CONTENT_W,
  INK,
  LINE_H,
  MARGIN_X,
  PAD_TOP,
  PAGE_H,
  PAGE_W,
  PAPER,
  RULE_BLUE,
  RULE_RED,
  RULE_X,
} from '@/lib/geometry';
import { jitterSoft, rngFrom } from '@/lib/rng';

/** geometry.ts → CSS custom properties. */
export const paperVars: CSSProperties = {
  ['--page-w' as string]: `${PAGE_W}px`,
  ['--page-h' as string]: `${PAGE_H}px`,
  ['--line-h' as string]: `${LINE_H}px`,
  ['--pad-top' as string]: `${PAD_TOP}px`,
  ['--margin-x' as string]: `${MARGIN_X}px`,
  ['--content-w' as string]: `${CONTENT_W}px`,
  ['--content-h' as string]: `${CONTENT_H}px`,
  ['--rule-x' as string]: `${RULE_X}px`,
  ['--paper' as string]: PAPER,
  ['--rule-blue' as string]: RULE_BLUE,
  ['--rule-red' as string]: RULE_RED,
  ['--ink' as string]: INK,
};

/**
 * Paper grain via feTurbulence. One SVG filter for the whole page.
 *
 * The `seed` is fixed rather than derived: fractalNoise renders identically for
 * a given seed, and varying it per page would make PDFs differ between runs.
 */
function Grain({ id }: { id: string }) {
  return (
    <svg className="grain" aria-hidden="true">
      <filter id={id}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.82"
          numOctaves={4}
          stitchTiles="stitch"
          seed={7}
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

export interface PaperPageProps {
  children: ReactNode;
  /** 1-based page number shown bottom-right. Omit to hide the header. */
  pageNumber?: number;
  totalPages?: number;
  topic?: string;
  /** Drives the page's micro-rotation. */
  seedKey?: string;
  /** Screen-only drop shadow. Suppressed in print via CSS. */
  shadow?: boolean;
  /** Disable rotation — used by the hidden measuring container. */
  flat?: boolean;
  style?: CSSProperties;
}

export default function PaperPage({
  children,
  pageNumber,
  totalPages,
  topic,
  seedKey = 'page',
  shadow = true,
  flat = false,
  style,
}: PaperPageProps) {
  const rng = rngFrom('paper', seedKey);

  // Barely perceptible, and that is the point: enough to suggest a scanned
  // sheet, not enough to look like a deliberate effect.
  const tilt = flat ? 0 : jitterSoft(rng, 0.16);

  const filterId = `grain-${seedKey.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <div
      className={`paper${shadow ? ' paper-shadow' : ''}`}
      style={{
        ...paperVars,
        transform: flat ? undefined : `rotate(${tilt.toFixed(3)}deg)`,
        ...style,
      }}
    >
      <div className="paper-shade" aria-hidden="true" />
      <Grain id={filterId} />

      {pageNumber !== undefined && (
        <div className="page-header">
          <span>{topic}</span>
          <span className="page-number">
            {pageNumber}
            {totalPages ? ` / ${totalPages}` : ''}
          </span>
        </div>
      )}

      <div className="page-content">{children}</div>
    </div>
  );
}
