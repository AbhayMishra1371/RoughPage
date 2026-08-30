/**
 * paginate.ts
 * ===========
 * Reflows a flat element stream into physical pages.
 *
 * WHY THIS EXISTS: the AI's `pages[]` are TOPIC SECTIONS, not physical pages.
 * The system prompt tells it not to decide page breaks, `ai_service.py`
 * overwrites every `page_number`, and `total_pages` arrives as the topic-group
 * count. So real pagination is the renderer's job, exactly as the schema
 * docstring describes: a vertical cursor that starts a new page on overflow.
 *
 * This module is deliberately PURE — heights in, pages out, no DOM. Measuring
 * happens in the browser and is passed in. That keeps the tricky part testable.
 */

import {
  CONTENT_H,
  LINE_H,
  snapToLine,
} from './geometry';
import type { FlatElement, NotebookElement } from './types';

// ── Measurement input ───────────────────────────────────────────────────────

/**
 * One element's measured geometry, produced by the browser measure pass.
 * `head` and `parts` are only populated for splittable elements and are read
 * from the real rendered rows (not measured in isolation), so they are exact.
 */
export interface Measured {
  /** Full height of the element as rendered. */
  total: number;
  /** Height above the first splittable row (e.g. a bullet_list title). */
  head: number;
  /** Per-row heights, in order. Empty for non-splittable elements. */
  parts: number[];
}

export type HeightMap = Record<string, Measured>;

// ── Output ──────────────────────────────────────────────────────────────────

export interface PlacedElement extends FlatElement {
  /** Snapped height this element was allotted, in px. */
  height: number;
  /** Set below 1 only when an oversized atomic element had to shrink to fit. */
  scale?: number;
  /** True for the tail fragment of a split element (renders a "contd." marker). */
  isContinuation?: boolean;
}

export interface PhysicalPage {
  pageNumber: number;
  /** Shown in the page header — the topic the page opens with. */
  topic: string;
  items: PlacedElement[];
}

export interface PaginateOptions {
  /**
   * Start each topic group on a fresh page. Default true.
   *
   * The composition rules guarantee every group opens with a heading and closes
   * with a summary, so group boundaries are reliable. Starting a new topic on a
   * new page is what students actually do, and it contains the duplicate-topic
   * bleed caused by the 100-word chunk overlap on long transcripts.
   */
  breakOnTopic?: boolean;
  contentH?: number;
  /** Collects non-fatal layout complaints (oversized elements, etc.). */
  onWarn?: (message: string) => void;
}

// ── Split policy ────────────────────────────────────────────────────────────

/**
 * Never split.
 *
 * Two different reasons, both ending in the same place:
 *   - `definition`, `important_note`, `sticky_formula` carry a drawn box or a
 *     rotated note, and a box cut in half reads unmistakably as a bug rather
 *     than as a student running out of room.
 *   - `diagram` and `mind_map` ARE their geometry. Half a diagram is not half as
 *     useful, it is useless; and a mind map without its hub is not a mind map.
 *   - `paragraph` and `example` could in principle be cut, but only at RENDERED
 *     line boundaries — where a wrap lands is a browser decision, not a data one,
 *     and the head/parts model below cannot express it. So prose moves whole.
 *
 * DOCUMENTATION AND AUDIT SOURCE, not a lookup: the algorithm treats anything
 * absent from SPLITTABLE as atomic, so this set never needs to be consulted to
 * be correct. It is exported so the grid audit can assert the two sets are
 * disjoint and that together they cover every implemented type.
 */
const ATOMIC = new Set([
  'definition',
  'important_note',
  'sticky_formula',
  'heading',
  'paragraph',
  'example',
  'diagram',
  'mind_map',
]);

/**
 * Splittable at row boundaries.
 *
 * Every one of these renders a repeated `head` (a title, a language tag, a table
 * header) plus a list of independently-measured rows, and every one of them
 * survives being cut between two rows: the comparison table draws its frame per
 * row, the timeline draws its spine per event, and a flowchart's connector arrow
 * belongs to the step ABOVE it so a fragment ends on a closed box.
 */
const SPLITTABLE = new Set([
  'bullet_list',
  'summary',
  'code_block',
  'flowchart',
  'timeline',
  'comparison',
]);

/** Minimum rows to leave on either side of a split. */
const MIN_ROWS_PER_FRAGMENT = 2;

/** A heading with less than this much room beneath it is an orphan. */
const ORPHAN_MIN = 2 * LINE_H;

function isSplittable(el: NotebookElement, m: Measured): boolean {
  return SPLITTABLE.has(el.type) && m.parts.length >= MIN_ROWS_PER_FRAGMENT * 2;
}

// ── Row access ──────────────────────────────────────────────────────────────

/**
 * The rows of a splittable element, whatever its type calls them.
 *
 * `unknown[]` rather than `string[]`: a comparison's rows are `[left, right]`
 * pairs and a timeline's events are objects. Nothing here inspects a row — only
 * `.length` and `.slice()` are ever used — so the element type is the only thing
 * that needs to know what a row actually is.
 *
 * THESE MUST AGREE WITH WHAT THE COMPONENT RENDERS. Where a component drops
 * empty rows, the filter is mirrored here. If the two ever disagree, the
 * `rows.length !== m.parts.length` guard in `splitToFit` refuses the split and
 * the element moves to the next page whole — a worse layout, never wrong output.
 */
function rowsOf(el: NotebookElement): unknown[] {
  switch (el.type) {
    case 'bullet_list':
      return (el as { items?: unknown[] }).items ?? [];
    case 'summary':
      return (el as { points?: unknown[] }).points ?? [];
    case 'comparison':
      return (el as { rows?: unknown[] }).rows ?? [];
    case 'code_block':
      return String((el as { code?: string }).code ?? '').split('\n');
    case 'flowchart':
      // Mirrors Flowchart.tsx, which drops blank steps.
      return ((el as { steps?: unknown[] }).steps ?? [])
        .map((s) => String(s ?? ''))
        .filter(Boolean);
    case 'timeline':
      // Mirrors Timeline.tsx, which drops events with neither field.
      return ((el as { events?: { label?: unknown; description?: unknown }[] }).events ?? [])
        .filter(
          (e) => e && (String(e.label ?? '').trim() || String(e.description ?? '').trim()),
        );
    default:
      return [];
  }
}

function withRows(el: NotebookElement, rows: unknown[]): NotebookElement {
  switch (el.type) {
    case 'bullet_list':
      return { ...el, items: rows } as NotebookElement;
    case 'summary':
      return { ...el, points: rows } as NotebookElement;
    case 'comparison':
      return { ...el, rows } as NotebookElement;
    case 'code_block':
      // Rejoined rather than kept as an array: `code` is a single string in the
      // schema, and CodeBlock.tsx splits it again on render.
      return { ...el, code: rows.join('\n') } as NotebookElement;
    case 'flowchart':
      return { ...el, steps: rows } as NotebookElement;
    case 'timeline':
      return { ...el, events: rows } as NotebookElement;
    default:
      return el;
  }
}

// ── Splitting ───────────────────────────────────────────────────────────────

interface Fragment {
  item: FlatElement;
  measured: Measured;
  /** Set on every fragment after the first, so it can render "(contd.)". */
  isContinuation?: boolean;
}

/**
 * Splits a splittable element so its head fragment fits in `avail`.
 * Returns null when no split respects MIN_ROWS_PER_FRAGMENT on both sides.
 *
 * Both fragments carry the SAME `head` height, because the head (a bullet_list
 * title, a summary's divider + label) is repeated on the continuation — which is
 * what a real student does. So the two fragments together are one `head` taller
 * than the original element, by design.
 */
function splitToFit(
  item: FlatElement,
  m: Measured,
  avail: number,
): [Fragment, Fragment] | null {
  const rows = rowsOf(item.element);
  if (rows.length !== m.parts.length) return null;

  // How many rows fit alongside the head?
  let used = m.head;
  let take = 0;
  for (let i = 0; i < m.parts.length; i++) {
    if (snapToLine(used + m.parts[i]) > avail) break;
    used += m.parts[i];
    take++;
  }

  const keepBack = rows.length - take;
  if (take < MIN_ROWS_PER_FRAGMENT || keepBack < MIN_ROWS_PER_FRAGMENT) return null;

  const headParts = m.parts.slice(0, take);
  const tailParts = m.parts.slice(take);

  return [
    {
      item: { ...item, element: withRows(item.element, rows.slice(0, take)) },
      measured: { total: m.head + sum(headParts), head: m.head, parts: headParts },
    },
    {
      item: {
        ...item,
        key: `${item.key}-contd`,
        element: withRows(item.element, rows.slice(take)),
        startsTopic: false,
      },
      measured: { total: m.head + sum(tailParts), head: m.head, parts: tailParts },
      isContinuation: true,
    },
  ];
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

// ── The algorithm ───────────────────────────────────────────────────────────

export function paginate(
  items: FlatElement[],
  heights: HeightMap,
  opts: PaginateOptions = {},
): PhysicalPage[] {
  const breakOnTopic = opts.breakOnTopic ?? true;
  const contentH = opts.contentH ?? CONTENT_H;
  const warn = opts.onWarn ?? (() => {});

  const pages: PhysicalPage[] = [];
  let current: PlacedElement[] = [];
  let used = 0;
  let currentTopic = items[0]?.topic ?? '';

  const flush = () => {
    if (current.length === 0) return;
    pages.push({ pageNumber: pages.length + 1, topic: currentTopic, items: current });
    current = [];
    used = 0;
  };

  const place = (item: FlatElement, height: number, extra: Partial<PlacedElement> = {}) => {
    if (current.length === 0) currentTopic = item.topic;
    current.push({ ...item, height, ...extra });
    used += height;
  };

  const fallback: Measured = { total: LINE_H, head: 0, parts: [] };

  // A queue, so a split can push its tail back to the front.
  const queue: Fragment[] = items.map((item) => ({
    item,
    measured: heights[item.key] ?? fallback,
  }));

  let guard = 0;
  const GUARD_MAX = queue.length * 64 + 1000;

  while (queue.length > 0) {
    if (++guard > GUARD_MAX) {
      warn('paginate: split loop guard tripped — emitting remainder as-is.');
      for (const f of queue) place(f.item, snapToLine(f.measured.total));
      break;
    }

    const { item, measured, isContinuation } = queue.shift()!;
    const el = item.element;
    const h = snapToLine(measured.total);
    // Threaded onto everything this fragment becomes: a tail that has to split
    // again is still a continuation of the original element.
    const carry: Partial<PlacedElement> = isContinuation ? { isContinuation: true } : {};

    // New topic starts a new page.
    if (breakOnTopic && item.startsTopic && current.length > 0) flush();

    // Don't leave a heading stranded at the foot of a page.
    if (el.type === 'heading' && current.length > 0 && used + h + ORPHAN_MIN > contentH) {
      flush();
    }

    const avail = contentH - used;

    if (h <= avail) {
      place(item, h, carry);
      continue;
    }

    // Doesn't fit in what's left. Try splitting into the remaining space.
    if (isSplittable(el, measured) && avail >= LINE_H * 2) {
      const parts = splitToFit(item, measured, avail);
      if (parts) {
        place(parts[0].item, snapToLine(parts[0].measured.total), carry);
        queue.unshift({ ...parts[1], item: { ...parts[1].item, startsTopic: false } });
        flush();
        continue;
      }
    }

    // Move it to a fresh page.
    if (current.length > 0) {
      flush();
      queue.unshift({ item: { ...item, startsTopic: false }, measured, isContinuation });
      continue;
    }

    // Already alone on a fresh page and STILL too tall.
    if (isSplittable(el, measured)) {
      const parts = splitToFit(item, measured, contentH);
      if (parts) {
        place(parts[0].item, snapToLine(parts[0].measured.total), carry);
        queue.unshift({ ...parts[1], item: { ...parts[1].item, startsTopic: false } });
        flush();
        continue;
      }
    }

    // Atomic and taller than a whole page: shrink it rather than clip or crash.
    const scale = Math.max(0.55, contentH / measured.total);
    warn(
      `paginate: <${el.type}> is ${Math.round(measured.total)}px, taller than a page ` +
        `(${contentH}px). Scaling to ${scale.toFixed(2)}. Consider shortening the content.`,
    );
    place(item, contentH, { ...carry, scale });
    flush();
  }

  flush();
  return pages;
}

/** True page count after reflow — `metadata.total_pages` on input is not this. */
export function pageCount(pages: PhysicalPage[]): number {
  return pages.length;
}

export { ATOMIC, SPLITTABLE, ORPHAN_MIN };
