'use client';

/**
 * roughShapes.tsx
 * ===============
 * The hand-drawn overlays, via rough.js.
 *
 * TWO RULES THAT MATTER MORE THAN ANYTHING ELSE HERE:
 *
 * 1. DRAW AFTER LAYOUT. A box has to wrap MEASURED content, so nothing in this
 *    file may run until the element's real size is known. Every component here
 *    takes explicit width/height rather than trying to infer them.
 *
 * 2. ALWAYS PASS A SEED. rough.js randomises its wobble internally; without an
 *    explicit `seed` the same document produces a different PDF on every run,
 *    which kills reproducibility and visual diffing. There is no Math.random()
 *    in this codebase and rough.js must not be allowed to smuggle one in.
 */

import { useEffect, useRef } from 'react';
import rough from 'roughjs';
import type { RoughSVG } from 'roughjs/bin/svg';
import type { Options as RoughOptions } from 'roughjs/bin/core';
import { INK, INK_RED, LINE_H, PAPER, STICKY_YELLOW } from './geometry';
import type { Box } from './useBoxSize';

/** Shared canvas for every overlay: absolutely positioned, never interactive. */
const OVERLAY_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'visible',
  pointerEvents: 'none',
  zIndex: 0,
};

/**
 * A draw routine returns the nodes it produced; the overlay appends them.
 *
 * (RoughSVG keeps its own `svg` reference private, and returning the nodes is
 * the better shape anyway — a draw function stays pure and testable rather than
 * reaching into the DOM itself.)
 */
type Draw = (rc: RoughSVG, w: number, h: number) => SVGGElement[];

interface OverlayProps {
  width: number;
  height: number;
  draw: Draw;
  /** Re-draw when this changes. */
  deps?: unknown[];
}

/**
 * Runs a rough.js draw routine into an SVG sized to the measured element box.
 *
 * The SVG is cleared and redrawn on every dependency change, otherwise strokes
 * accumulate on re-render and the lines get progressively heavier — which looks
 * plausible enough that it can go unnoticed for a while.
 */
function RoughOverlay({ width, height, draw, deps = [] }: OverlayProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg || width <= 0 || height <= 0) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    for (const node of draw(rough.svg(svg), width, height)) svg.appendChild(node);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, ...deps]);

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={OVERLAY_STYLE}
      aria-hidden="true"
    />
  );
}

// ── 1. Definition — dashed box ──────────────────────────────────────────────

export function RoughDashedBox({
  width,
  height,
  seed,
  stroke = INK,
}: {
  width: number;
  height: number;
  seed: number;
  stroke?: string;
}) {
  return (
    <RoughOverlay
      width={width}
      height={height}
      deps={[seed, stroke]}
      draw={(rc, w, h) => {
        const opts: RoughOptions = {
          stroke,
          strokeWidth: 1.5,
          roughness: 1.45,
          bowing: 1.6,
          strokeLineDash: [9, 6],
          seed,
          fill: undefined,
        };
        return [rc.rectangle(2, 2, w - 4, h - 4, opts)];
      }}
    />
  );
}

// ── 2. Important note — red box, double-struck ──────────────────────────────

export function RoughRedBox({
  width,
  height,
  seed,
}: {
  width: number;
  height: number;
  seed: number;
}) {
  return (
    <RoughOverlay
      width={width}
      height={height}
      deps={[seed]}
      draw={(rc, w, h) => {
        const base: RoughOptions = {
          stroke: INK_RED,
          strokeWidth: 2,
          roughness: 1.9,
          bowing: 2,
        };
        // Drawn twice with different seeds. Students retrace a box they want to
        // stand out, and the doubled stroke is what actually sells "urgent"
        // far more than simply thickening a single line does.
        return [
          rc.rectangle(3, 3, w - 6, h - 6, { ...base, seed }),
          rc.rectangle(4.5, 4.5, w - 9, h - 9, {
            ...base,
            seed: seed + 1,
            strokeWidth: 1.2,
            roughness: 2.3,
          }),
        ];
      }}
    />
  );
}

// ── 3. Summary — hand-drawn divider ─────────────────────────────────────────

export function RoughDivider({
  width,
  seed,
  stroke = INK,
}: {
  width: number;
  seed: number;
  stroke?: string;
}) {
  const height = 12;
  return (
    <RoughOverlay
      width={width}
      height={height}
      deps={[seed, stroke]}
      draw={(rc, w) => {
        const opts: RoughOptions = {
          stroke,
          strokeWidth: 1.6,
          roughness: 2.2,
          bowing: 3,
          seed,
        };
        // Stops short of the full width at both ends — a ruled-off line drawn
        // by hand never quite reaches the margins.
        return [rc.line(6, 6, w - 14, 7, opts)];
      }}
    />
  );
}

// ── 4. Sticky formula — filled note ─────────────────────────────────────────

export function RoughSticky({
  width,
  height,
  seed,
  fill = STICKY_YELLOW,
}: {
  width: number;
  height: number;
  seed: number;
  fill?: string;
}) {
  return (
    <RoughOverlay
      width={width}
      height={height}
      deps={[seed, fill]}
      draw={(rc, w, h) => [
        rc.rectangle(1, 1, w - 2, h - 2, {
          fill,
          fillStyle: 'solid',
          stroke: '#e0c65a',
          strokeWidth: 1.1,
          roughness: 1.15,
          bowing: 0.9,
          seed,
        }),
      ]}
    />
  );
}

// ── Red underline, for importance: high ─────────────────────────────────────

/**
 * How far above the bottom of the measured box the stroke sits.
 *
 * MEASURED, NOT GUESSED. The baseline of Kalam at 17–21px in a LINE_H line box
 * sits 22px below the box top — i.e. 10px above its bottom — at every one of
 * those sizes. A hand underline goes about 5px under the baseline, clear of the
 * descenders on g/y/p, which puts the stroke 5px above the box bottom; the
 * stroke is drawn 4px down inside a 10px-tall overlay, hence 9.
 *
 * Anchoring to the box BOTTOM rather than its top is what makes a term that
 * wrapped to a second line get underlined under that line instead of the first.
 */
const UNDERLINE_DROP = 9;

/**
 * The red underline, in place.
 *
 * Absolutely positioned, so it adds NO layout height — an underline that
 * occupied a few pixels of flow would push everything below it off the ruled
 * grid, which is the failure this whole file is careful about. The parent must
 * therefore be `position: relative`, and `box` must come from `useBoxSize` on
 * that same parent: the width is the text's own shrink-to-fit width, not the
 * full content column, so the line stops where the writing stops.
 *
 * It does run a few pixels past the last letter, because `Hand` gives every word
 * a right margin and the last word keeps its. That is left alone deliberately —
 * a real underline overshoots.
 */
export function RoughUnderline({
  box,
  seed,
  stroke = INK_RED,
}: {
  box: Box;
  seed: number;
  stroke?: string;
}) {
  const height = 10;
  if (box.w <= 0 || box.h <= 0) return null;

  return (
    <span
      style={{
        position: 'absolute',
        left: 0,
        top: box.h - UNDERLINE_DROP,
        width: box.w,
        height,
        pointerEvents: 'none',
      }}
    >
      <RoughOverlay
        width={box.w}
        height={height}
        deps={[seed, stroke]}
        draw={(rc, w) => [
          rc.line(1, 4, w - 2, 5, {
            stroke,
            strokeWidth: 1.8,
            roughness: 2.4,
            bowing: 4,
            seed,
          }),
        ]}
      />
    </span>
  );
}

// ── Heading underline — double stroke, ink ──────────────────────────────────

export function RoughHeadingRule({
  width,
  seed,
  level,
}: {
  width: number;
  seed: number;
  level: 1 | 2;
}) {
  const height = 14;
  return (
    <RoughOverlay
      width={width}
      height={height}
      deps={[seed, level]}
      draw={(rc, w) => {
        const opts: RoughOptions = {
          stroke: INK,
          strokeWidth: level === 1 ? 2.1 : 1.4,
          roughness: 1.8,
          bowing: 2.5,
          seed,
        };
        const nodes = [rc.line(1, 5, w - 3, 6, opts)];
        if (level === 1) {
          // Level-1 titles get a second, lighter pass underneath.
          nodes.push(
            rc.line(3, 9, w - 8, 10, {
              ...opts,
              seed: seed + 7,
              strokeWidth: 1.1,
              roughness: 2.6,
            }),
          );
        }
        return nodes;
      }}
    />
  );
}

export { RoughOverlay };

// ── Drawn glyphs ────────────────────────────────────────────────────────────

/**
 * WHY THE ARROW AND THE STAR ARE DRAWN RATHER THAN TYPED.
 *
 * They used to be the characters `→` and `★`. Kalam has neither, so the browser
 * fell through the font stack and rendered them from whatever the operating
 * system offered — on Windows that turned out to be Segoe Print and Segoe UI
 * Symbol, both of which got embedded into the PDF. Two separate problems in one:
 *
 *   1. Those fonts do not exist on a Linux box, so the same JSON produced a
 *      different document elsewhere — different glyph widths, different
 *      wrapping, different pagination. Determinism was true only on this machine.
 *   2. They are crisp, geometric, printed marks sitting in the middle of
 *      handwriting. Exactly the "reads as print, not pen" tell the whole
 *      renderer exists to avoid.
 *
 * Drawn marks fix both at once and need no font at all. Check with:
 *   node -e "…/BaseFont…"  — only Kalam should appear for finished output.
 */

/** Fixed-size box for an inline mark. Never an inline box — always a flex item. */
const GLYPH_H = LINE_H;

/**
 * A bullet arrow, drawn in three strokes: the shaft, then two barbs sharing the
 * tip. Sized to sit in a LINE_H row alongside ~19px text.
 */
export function RoughArrowBullet({
  seed,
  stroke = INK_RED,
}: {
  seed: number;
  stroke?: string;
}) {
  const width = 17;
  return (
    <RoughOverlay
      width={width}
      height={GLYPH_H}
      deps={[seed, stroke]}
      draw={(rc, w) => {
        const y = 19; // just above the baseline of a 19px line in a 32px row
        const tipX = w - 3;
        const opts: RoughOptions = {
          stroke,
          strokeWidth: 1.6,
          roughness: 1.5,
          bowing: 1.4,
          seed,
        };
        return [
          rc.line(1, y + 1, tipX, y, opts),
          rc.line(tipX - 5.5, y - 4.5, tipX, y, { ...opts, seed: seed + 3 }),
          rc.line(tipX - 5.5, y + 4, tipX, y, { ...opts, seed: seed + 5 }),
        ];
      }}
    />
  );
}

/**
 * A five-pointed star. The tips are joined in pentagram order rather than drawn
 * as ten edges, because that is one continuous stroke — the way a star actually
 * gets drawn without lifting the pen.
 */
export function RoughStar({
  seed,
  size = 19,
  stroke = INK_RED,
}: {
  seed: number;
  size?: number;
  stroke?: string;
}) {
  const width = size + 3;
  return (
    <RoughOverlay
      width={width}
      height={GLYPH_H}
      deps={[seed, size, stroke]}
      draw={(rc) => {
        const r = size / 2;
        const cx = r + 1.5;
        const cy = 16;
        const tips: [number, number][] = [];
        for (let i = 0; i < 5; i++) {
          // Two fifths of a turn per step is what makes it a pentagram.
          const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
          tips.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
        return [
          rc.polygon(tips, {
            stroke,
            strokeWidth: 1.5,
            roughness: 1.35,
            bowing: 1,
            seed,
          }),
        ];
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// v2 shapes — flowchart, comparison, timeline, code, diagram, mind map
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A plain drawn rectangle. The workhorse for flowchart steps and the code panel.
 *
 * Inset by 2px on every side because rough.js scribbles OUTSIDE the nominal
 * path — a rectangle at (0,0,w,h) has strokes landing at negative coordinates,
 * which the overlay's viewBox then clips into a suspiciously straight edge.
 */
export function RoughPlainBox({
  width,
  height,
  seed,
  stroke = INK,
  strokeWidth = 1.5,
  roughness = 1.4,
  bowing = 1.5,
  fill,
  fillStyle = 'solid',
  radiusHint = 0,
}: {
  width: number;
  height: number;
  seed: number;
  stroke?: string;
  strokeWidth?: number;
  roughness?: number;
  bowing?: number;
  fill?: string;
  fillStyle?: string;
  /** Purely decorative: >0 clips the corners, which reads as a rounded hand box. */
  radiusHint?: number;
}) {
  return (
    <RoughOverlay
      width={width}
      height={height}
      deps={[seed, stroke, strokeWidth, roughness, fill, radiusHint]}
      draw={(rc, w, h) => {
        const opts: RoughOptions = {
          stroke,
          strokeWidth,
          roughness,
          bowing,
          seed,
          fill,
          fillStyle,
        };
        if (radiusHint <= 0) {
          return [rc.rectangle(2, 2, w - 4, h - 4, opts)];
        }
        // An octagon approximating a rounded rect — rough.js has no radius, and
        // clipped corners look hand-drawn in a way a true arc does not.
        const r = Math.min(radiusHint, Math.min(w, h) / 3);
        const x0 = 2;
        const y0 = 2;
        const x1 = w - 2;
        const y1 = h - 2;
        return [
          rc.polygon(
            [
              [x0 + r, y0],
              [x1 - r, y0],
              [x1, y0 + r],
              [x1, y1 - r],
              [x1 - r, y1],
              [x0 + r, y1],
              [x0, y1 - r],
              [x0, y0 + r],
            ],
            opts,
          ),
        ];
      }}
    />
  );
}

/**
 * The connector between two flowchart steps: a shaft down the middle of the
 * band, with a two-stroke arrowhead at the bottom.
 *
 * Drawn inside its own LINE_H-tall band BELOW a step rather than between two
 * steps, so a flowchart that splits across a page break ends its head fragment
 * with a clean box edge instead of an arrow pointing at nothing.
 */
export function RoughDownArrow({
  width,
  height,
  seed,
  stroke = INK,
}: {
  width: number;
  height: number;
  seed: number;
  stroke?: string;
}) {
  return (
    <RoughOverlay
      width={width}
      height={height}
      deps={[seed, stroke]}
      draw={(rc, w, h) => {
        const x = w / 2;
        const top = 2;
        const tip = h - 3;
        const opts: RoughOptions = {
          stroke,
          strokeWidth: 1.5,
          roughness: 1.5,
          bowing: 2.2,
          seed,
        };
        return [
          rc.line(x, top, x + 0.8, tip, opts),
          rc.line(x - 4.5, tip - 6, x + 0.8, tip, { ...opts, seed: seed + 3 }),
          rc.line(x + 5.5, tip - 6, x + 0.8, tip, { ...opts, seed: seed + 5 }),
        ];
      }}
    />
  );
}

/**
 * One row of a hand-drawn two-column table.
 *
 * WHY PER-ROW AND NOT ONE BIG GRID: a comparison table is splittable at row
 * boundaries, and a single drawn frame around the whole table cannot be cut in
 * half. Each row instead draws its own left edge, right edge, centre divider and
 * BOTTOM rule; stacked, those compose into a continuous table with single
 * strokes. The first row of a fragment also draws the top edge, so every
 * fragment is a complete little table rather than one with an open lid.
 */
export function RoughTableRow({
  width,
  height,
  seed,
  divX,
  top = false,
  stroke = INK,
  strokeWidth = 1.4,
}: {
  width: number;
  height: number;
  seed: number;
  /** X of the column divider, in px from the row's left edge. */
  divX: number;
  /** Draw the top edge too (only the first row of a fragment needs it). */
  top?: boolean;
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <RoughOverlay
      width={width}
      height={height}
      deps={[seed, divX, top, stroke, strokeWidth]}
      draw={(rc, w, h) => {
        const opts: RoughOptions = {
          stroke,
          strokeWidth,
          roughness: 1.6,
          bowing: 1.2,
          seed,
        };
        const nodes = [
          // Left and right edges, drawn slightly past the corners: a hand-ruled
          // table overshoots its junctions, and that overshoot is most of what
          // makes it read as drawn rather than as a <table>.
          rc.line(2, -1, 2.6, h + 1, opts),
          rc.line(w - 2, -1, w - 2.7, h + 1, { ...opts, seed: seed + 11 }),
          rc.line(divX, 0, divX + 0.9, h, { ...opts, seed: seed + 17 }),
          rc.line(1, h - 1, w - 1, h - 0.4, { ...opts, seed: seed + 23 }),
        ];
        if (top) {
          nodes.push(rc.line(1, 1, w - 1, 1.6, { ...opts, seed: seed + 29 }));
        }
        return nodes;
      }}
    />
  );
}

/**
 * One segment of a timeline's vertical spine, plus the node marker for this
 * event.
 *
 * Same reasoning as `RoughTableRow`: the spine is drawn per-event and the
 * segments abut, so a timeline can split across pages and each fragment still
 * carries its own continuous-looking spine.
 */
export function RoughSpineSegment({
  width,
  height,
  seed,
  x,
  dotY,
  last = false,
  stroke = INK,
}: {
  width: number;
  height: number;
  seed: number;
  /** X of the spine within the overlay. */
  x: number;
  /** Y of this event's node marker. */
  dotY: number;
  /** The last event stops the spine at its own node instead of running on. */
  last?: boolean;
  stroke?: string;
}) {
  return (
    <RoughOverlay
      width={width}
      height={height}
      deps={[seed, x, dotY, last, stroke]}
      draw={(rc, _w, h) => {
        const opts: RoughOptions = {
          stroke,
          strokeWidth: 1.6,
          roughness: 1.7,
          bowing: 1.8,
          seed,
        };
        // Overrun the top by 1px so consecutive segments overlap rather than
        // leaving a hairline gap at every join.
        const end = last ? dotY : h + 1;
        return [
          rc.line(x, -1, x + 0.7, end, opts),
          // A ring, not a filled dot: a hollow circle is what a pen actually
          // draws, and it stays legible at 8px where a blob just smudges.
          rc.circle(x + 0.4, dotY, 8, {
            ...opts,
            seed: seed + 13,
            strokeWidth: 1.7,
            roughness: 1.1,
            fill: PAPER,
            fillStyle: 'solid',
          }),
        ];
      }}
    />
  );
}

// ── Graphs: diagram and mind map ────────────────────────────────────────────

/** A node box, in overlay coordinates. Produced by lib/graphLayout.ts. */
export interface GraphNodeShape {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Ellipses for mind-map spokes, boxes for diagram nodes. */
  shape: 'box' | 'ellipse';
  emphasis?: boolean;
}

/** An edge, already resolved to absolute overlay coordinates. */
export interface GraphEdgeShape {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Curved spokes for mind maps, straight arrows for diagrams. */
  curve?: boolean;
  arrow?: boolean;
}

/**
 * Draws a whole graph — every node outline and every edge — in ONE overlay.
 *
 * Both a diagram and a mind map need node positions that CSS cannot produce, so
 * their layout is computed in JS (see lib/graphLayout.ts) and the labels are
 * absolutely positioned HTML on top of this. One overlay for the whole graph
 * rather than one per node, because the edges have to cross node boundaries.
 */
export function RoughGraph({
  width,
  height,
  seed,
  nodes,
  edges,
  stroke = INK,
  accent = INK_RED,
}: {
  width: number;
  height: number;
  seed: number;
  nodes: GraphNodeShape[];
  edges: GraphEdgeShape[];
  stroke?: string;
  accent?: string;
}) {
  return (
    <RoughOverlay
      width={width}
      height={height}
      deps={[seed, JSON.stringify(nodes), JSON.stringify(edges), stroke, accent]}
      draw={(rc) => {
        const out: SVGGElement[] = [];

        // Edges first, so node outlines sit on top and the joins look tucked in
        // rather than crossing over the boxes.
        edges.forEach((e, i) => {
          const s = seed + i * 7 + 1;
          const opts: RoughOptions = {
            stroke,
            strokeWidth: 1.4,
            roughness: 1.6,
            bowing: 2,
            seed: s,
          };
          if (e.curve) {
            // A single control point pulled off the straight line — enough of a
            // sag to read as drawn by hand, not enough to look like a noodle.
            const mx = (e.x1 + e.x2) / 2;
            const my = (e.y1 + e.y2) / 2;
            const dx = e.x2 - e.x1;
            const dy = e.y2 - e.y1;
            const len = Math.hypot(dx, dy) || 1;
            const bulge = Math.min(16, len * 0.14);
            out.push(
              rc.curve(
                [
                  [e.x1, e.y1],
                  [mx - (dy / len) * bulge, my + (dx / len) * bulge],
                  [e.x2, e.y2],
                ],
                opts,
              ),
            );
          } else {
            out.push(rc.line(e.x1, e.y1, e.x2, e.y2, opts));
          }

          if (e.arrow) {
            const a = Math.atan2(e.y2 - e.y1, e.x2 - e.x1);
            const len = 7;
            const spread = 0.45;
            out.push(
              rc.line(
                e.x2 - len * Math.cos(a - spread),
                e.y2 - len * Math.sin(a - spread),
                e.x2,
                e.y2,
                { ...opts, seed: s + 3 },
              ),
              rc.line(
                e.x2 - len * Math.cos(a + spread),
                e.y2 - len * Math.sin(a + spread),
                e.x2,
                e.y2,
                { ...opts, seed: s + 5 },
              ),
            );
          }
        });

        nodes.forEach((n, i) => {
          const s = seed + i * 13 + 101;
          const opts: RoughOptions = {
            stroke: n.emphasis ? accent : stroke,
            strokeWidth: n.emphasis ? 1.9 : 1.4,
            roughness: 1.35,
            bowing: 1.4,
            seed: s,
          };
          if (n.shape === 'ellipse') {
            out.push(rc.ellipse(n.x + n.w / 2, n.y + n.h / 2, n.w, n.h, opts));
          } else {
            out.push(rc.rectangle(n.x, n.y, n.w, n.h, opts));
          }
          if (n.emphasis) {
            // The hub gets retraced, the same way a student thickens the thing
            // everything else hangs off.
            const inner: RoughOptions = {
              ...opts,
              seed: s + 7,
              strokeWidth: 1.1,
              roughness: 2,
            };
            out.push(
              n.shape === 'ellipse'
                ? rc.ellipse(n.x + n.w / 2, n.y + n.h / 2, n.w - 5, n.h - 5, inner)
                : rc.rectangle(n.x + 2.5, n.y + 2.5, n.w - 5, n.h - 5, inner),
            );
          }
        });

        return out;
      }}
    />
  );
}
