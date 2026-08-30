'use client';

/**
 * NotebookRenderer.tsx
 * ====================
 * The measure → paginate → draw → ready machine. Everything that needs real
 * browser layout happens here; Node only drives Puppeteer around it.
 *
 * PHASES
 *   'fonts'   wait for Kalam to actually load. Non-negotiable: metrics differ
 *             wildly from any fallback, so measuring early poisons every height.
 *   'measure' render every element ONCE into a hidden container that is exactly
 *             CONTENT_W wide and styled identically to a real page's content box.
 *   'paged'   heights are read, snapped to the ruled grid, packed into physical
 *             pages, and committed. The measuring container is dropped.
 *   ready     the DOM has stopped changing (rough.js has finished drawing into
 *             every overlay), so window.__ROUGHPAGE_READY__ goes true.
 *
 * THE TRAP THIS AVOIDS: measure, then re-render, then trust the old numbers.
 * Measurement lives in its own container which is never re-measured and never
 * reused for output. Pagination reads only the height map it produced.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PaperPage, { paperVars } from './PaperPage';
import { renderElement } from './elements/registry';
import { CONTENT_W } from '@/lib/geometry';
import { KATEX_FONT_PROBES } from '@/lib/latex';
import { paginate, type HeightMap, type Measured, type PhysicalPage, type PlacedElement } from '@/lib/paginate';
import { hashString } from '@/lib/rng';
import { flatten, type FlatElement, type NotebookDocument } from '@/lib/types';

// ── Fonts ───────────────────────────────────────────────────────────────────

/**
 * One probe per (weight, family) actually used. Sizes are arbitrary — the
 * browser loads a whole face, not a size.
 */
const FONT_PROBES = [
  '300 19px Kalam',
  '400 19px Kalam',
  '700 31px Kalam',
  '400 13px "JetBrains Mono"',
  // KaTeX lays out from its own font metrics, so a formula measured before these
  // land has a height that is wrong by an unpredictable amount. See lib/latex.tsx.
  ...KATEX_FONT_PROBES,
];

/**
 * `document.fonts.ready` alone is NOT enough, and this is the single most
 * expensive thing to get wrong here.
 *
 * `ready` resolves once no font load is *pending* — and a webfont nothing has
 * painted yet is not pending. Await it before the text exists and it resolves
 * immediately with Kalam unloaded; the measure pass then sizes everything in a
 * fallback font, the real font swaps in afterwards, and every height in the
 * document is wrong by an amount that varies per string. Explicitly `load()`ing
 * each face makes the loads pending, so `ready` has something to wait for.
 */
async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    await Promise.all(FONT_PROBES.map((f) => document.fonts.load(f, 'Mg')));
  } catch {
    // An unparseable shorthand shouldn't stall the render; fall through.
  }
  await document.fonts.ready;
}

// ── Measurement ─────────────────────────────────────────────────────────────

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

/**
 * Reads the hidden container's cells, in order, into a height map.
 *
 * Cells are matched to items BY POSITION rather than by a `data-key` selector:
 * element `type` reaches us from JSON and an attribute-selector built from
 * untrusted text is a needless escaping hazard. One cell per item, same order,
 * so the index is the identity.
 *
 * `head` is derived as `total - sum(parts)` rather than measured from the
 * `data-head` block. That makes `total === head + sum(parts)` true by
 * construction — which is exactly the invariant `splitToFit` relies on when it
 * rebuilds fragment heights — and it correctly folds the wrapper's own top and
 * bottom padding into the head, since a continuation fragment gets that padding
 * again on the next page.
 */
function readHeights(container: HTMLElement, items: FlatElement[]): HeightMap {
  const cells = Array.from(container.children) as HTMLElement[];
  const map: HeightMap = {};

  items.forEach((item, i) => {
    const cell = cells[i];
    if (!cell) return;

    const total = cell.getBoundingClientRect().height;
    const rows = Array.from(cell.querySelectorAll<HTMLElement>('[data-part]'));
    const parts = rows.map((r) => r.getBoundingClientRect().height);
    const head = Math.max(0, total - sum(parts));

    const measured: Measured = { total, head, parts };
    map[item.key] = measured;
  });

  return map;
}

// ── One placed element on a real page ───────────────────────────────────────

/**
 * The cell's height is the SNAPPED height, not the natural one, so the vertical
 * cursor only ever lands on a ruled line. The leftover slack (at most
 * LINE_H - 1 px) shows up as breathing room under the element.
 *
 * `data-el-type` is inert at render time and exists so the grid audit can report
 * WHICH element type drifted off the ruled lines rather than just an index.
 */
function ElementCell({ placed, seed }: { placed: PlacedElement; seed: string }) {
  const inner = renderElement({
    element: placed.element,
    seed,
    continued: placed.isContinuation,
  });

  if (!placed.scale || placed.scale >= 1) {
    return (
      <div
        data-el-type={placed.element.type}
        style={{ position: 'relative', height: placed.height }}
      >
        {inner}
      </div>
    );
  }

  // Degenerate case: an atomic element taller than a whole page.
  // The inner box is widened by 1/scale first so that scaling it back down lands
  // on exactly CONTENT_W instead of leaving a bare strip down the right margin.
  // Reflowing at the wider width can only REDUCE the line count, so the result
  // is never taller than the space reserved for it.
  return (
    <div
      data-el-type={placed.element.type}
      data-el-scale={placed.scale.toFixed(3)}
      style={{ position: 'relative', height: placed.height, overflow: 'hidden' }}
    >
      <div
        style={{
          width: `${(100 / placed.scale).toFixed(3)}%`,
          transform: `scale(${placed.scale})`,
          transformOrigin: 'top left',
        }}
      >
        {inner}
      </div>
    </div>
  );
}

// ── The renderer ────────────────────────────────────────────────────────────

type Phase = 'fonts' | 'measure' | 'paged';

/** Consecutive mutation-free frames required before the render counts as done. */
const QUIET_FRAMES = 3;
/** Hard cap, so a pathological document fails loudly instead of hanging. */
const MAX_SETTLE_FRAMES = 240;

export interface RenderStatus {
  phase: Phase | 'ready';
  pages: number;
  warnings: string[];
}

export interface NotebookRendererProps {
  doc: NotebookDocument;
  /** Start each topic group on a fresh page. Default true. */
  breakOnTopic?: boolean;
  /** Screen-only page shadow. The PDF path turns this off. */
  shadow?: boolean;
  /** Publish the readiness flag Puppeteer waits on. Default true. */
  signalReady?: boolean;
  onStatus?: (status: RenderStatus) => void;
}

export default function NotebookRenderer({
  doc,
  breakOnTopic = true,
  shadow = true,
  signalReady = true,
  onStatus,
}: NotebookRendererProps) {
  const items = useMemo(() => flatten(doc), [doc]);

  /**
   * Seeded from the document's own title, so the same JSON always produces the
   * same wobble. Per-element seeds key off `item.key` (group + element index)
   * rather than the page index, so re-pagination cannot change how a word looks.
   */
  const docSeed = useMemo(
    () => String(hashString(doc.metadata?.title ?? 'roughpage')),
    [doc],
  );

  const [phase, setPhase] = useState<Phase>('fonts');
  const [pages, setPages] = useState<PhysicalPage[]>([]);
  const warnings = useRef<string[]>([]);

  const measureRef = useRef<HTMLDivElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);

  const report = useCallback(
    (p: RenderStatus['phase'], n: number) => {
      if (typeof window !== 'undefined') window.__ROUGHPAGE_PHASE__ = p;
      onStatus?.({ phase: p, pages: n, warnings: warnings.current });
    },
    [onStatus],
  );

  // Restart the machine from scratch whenever the document changes.
  useEffect(() => {
    warnings.current = [];
    setPages([]);
    setPhase('fonts');
    if (typeof window !== 'undefined') {
      window.__ROUGHPAGE_READY__ = false;
      window.__ROUGHPAGE_PAGES__ = 0;
      window.__ROUGHPAGE_WARNINGS__ = [];
    }
  }, [doc]);

  // 1. Fonts.
  useEffect(() => {
    if (phase !== 'fonts') return;
    report('fonts', 0);
    let cancelled = false;
    ensureFonts().then(() => {
      if (!cancelled) setPhase('measure');
    });
    return () => {
      cancelled = true;
    };
  }, [phase, report]);

  // 2. Measure + paginate. useLayoutEffect, so the hidden pass never paints.
  useLayoutEffect(() => {
    if (phase !== 'measure') return;
    const container = measureRef.current;
    if (!container) return;

    const collected: string[] = [];
    const heights = readHeights(container, items);
    const result = paginate(items, heights, {
      breakOnTopic,
      onWarn: (m) => collected.push(m),
    });

    warnings.current = collected;
    if (typeof window !== 'undefined') {
      window.__ROUGHPAGE_WARNINGS__ = collected;
      window.__ROUGHPAGE_PAGES__ = result.length;
    }
    for (const w of collected) console.warn(w);

    setPages(result);
    setPhase('paged');
  }, [phase, items, breakOnTopic]);

  // 3. Wait for the DOM to go quiet, then raise the flag.
  //
  // Not a fixed number of frames: rough.js draws from an effect that runs after
  // each element has measured itself, so the number of settling passes depends
  // on what is on the page. A MutationObserver watching for the last append is
  // the only signal that actually corresponds to "finished".
  useEffect(() => {
    if (phase !== 'paged') return;
    const node = stackRef.current;
    if (!node) return;

    let mutated = true; // assume dirty until a frame passes untouched
    const observer = new MutationObserver(() => {
      mutated = true;
    });
    observer.observe(node, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    let quiet = 0;
    let frames = 0;
    let raf = 0;
    let done = false;

    const finish = () => {
      done = true;
      observer.disconnect();
      if (typeof window !== 'undefined') {
        window.__ROUGHPAGE_PAGES__ = pages.length;
        window.__ROUGHPAGE_WARNINGS__ = warnings.current;
        if (signalReady) window.__ROUGHPAGE_READY__ = true;
      }
      report('ready', pages.length);
    };

    const tick = () => {
      frames++;
      if (mutated) {
        mutated = false;
        quiet = 0;
      } else {
        quiet++;
      }

      if (quiet >= QUIET_FRAMES) return finish();

      if (frames >= MAX_SETTLE_FRAMES) {
        warnings.current = [
          ...warnings.current,
          `render: DOM still mutating after ${MAX_SETTLE_FRAMES} frames — ` +
            `proceeding anyway. Something is redrawing in a loop.`,
        ];
        console.warn(warnings.current[warnings.current.length - 1]);
        return finish();
      }

      raf = requestAnimationFrame(tick);
    };

    report('paged', pages.length);
    raf = requestAnimationFrame(tick);

    return () => {
      if (!done) observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [phase, pages, signalReady, report]);

  // ── Output ────────────────────────────────────────────────────────────────

  if (phase === 'measure') {
    return (
      <div
        aria-hidden="true"
        style={{
          ...paperVars,
          position: 'fixed',
          top: 0,
          // Off-screen rather than display:none — a hidden subtree has no
          // layout at all, so nothing could be measured.
          left: -100000,
          width: CONTENT_W,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {/*
          Identical class, identical width, identical inherited font — so a
          height read here is the height rendered on a real page. Only the
          positioning is overridden.
        */}
        <div
          ref={measureRef}
          className="page-content"
          style={{ position: 'static', width: CONTENT_W, height: 'auto' }}
        >
          {items.map((item) => (
            <div key={item.key}>
              {renderElement({ element: item.element, seed: `${docSeed}:${item.key}` })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack" ref={stackRef}>
      {pages.map((page, i) => (
        <PaperPage
          key={i}
          pageNumber={page.pageNumber}
          totalPages={pages.length}
          topic={page.topic}
          seedKey={`${docSeed}-p${i}`}
          shadow={shadow}
        >
          {page.items.map((placed) => (
            <ElementCell
              key={placed.key}
              placed={placed}
              seed={`${docSeed}:${placed.key.replace(/-contd$/, '')}`}
            />
          ))}
        </PaperPage>
      ))}

      {phase === 'paged' && pages.length === 0 && (
        <div style={{ color: '#f3f4f6', fontFamily: 'ui-monospace, monospace', padding: 40 }}>
          No elements to render — the document has no pages, or every topic group
          is empty.
        </div>
      )}
    </div>
  );
}
