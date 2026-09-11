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

export interface PageStats {
  used: number;
  available: number;
  utilization: number;
  elements: string[];
}

export interface PhysicalPage {
  pageNumber: number;
  /** Shown in the page header — the topic the page opens with. */
  topic: string;
  items: PlacedElement[];
  stats?: PageStats;
}

export interface PaginateOptions {
  /**
   * Start each topic group on a fresh page. Default false.
   *
   * By default, topic sections flow continuously across physical pages so
   * physical pages achieve high content utilization (~75-90%) instead of
   * leaving 50-80% of the page blank.
   */
  breakOnTopic?: boolean;
  contentH?: number;
  /** Collects non-fatal layout complaints (oversized elements, etc.). */
  onWarn?: (message: string) => void;
  /** Log per-page utilization stats to the console. Default true. */
  debug?: boolean;
}

// ── Split policy ────────────────────────────────────────────────────────────

/**
 * Atomic elements: kept together on a physical page whenever possible.
 *
 * `definition`, `important_note`, `sticky_formula`, `comparison`, `flowchart`,
 * `diagram`, `code_block`, `example`, `timeline`, `mind_map`, `screenshot`,
 * `heading`, `paragraph`.
 */
const ATOMIC = new Set([
  'definition',
  'important_note',
  'sticky_formula',
  'comparison',
  'flowchart',
  'diagram',
  'code_block',
  'example',
  'timeline',
  'mind_map',
  'screenshot',
  'heading',
  'paragraph',
]);

/**
 * Splittable during inline packing: only row-based lists whose items are
 * independently readable and cleanly breakable across page boundaries.
 */
const SPLITTABLE_INLINE = new Set([
  'bullet_list',
  'summary',
]);

/**
 * All elements that have row structure (can split in an emergency if taller than a whole page).
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
  return SPLITTABLE_INLINE.has(el.type) && m.parts.length >= MIN_ROWS_PER_FRAGMENT * 2;
}

// ── Row access ──────────────────────────────────────────────────────────────

/**
 * The rows of a splittable element, whatever its type calls them.
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
      return ((el as { steps?: unknown[] }).steps ?? [])
        .map((s) => String(s ?? ''))
        .filter(Boolean);
    case 'timeline':
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
  const breakOnTopic = opts.breakOnTopic ?? false;
  const contentH = opts.contentH ?? CONTENT_H;
  const warn = opts.onWarn ?? (() => {});
  const debug = opts.debug ?? true;

  const pages: PhysicalPage[] = [];
  let current: PlacedElement[] = [];
  let used = 0;
  let currentTopic = items[0]?.topic ?? '';

  const flush = () => {
    if (current.length === 0) return;
    const pageNumber = pages.length + 1;
    const elemTypes = current.map((p) => p.element.type);
    const utilization = Math.round((used / contentH) * 1000) / 10;
    const stats: PageStats = {
      used,
      available: contentH,
      utilization,
      elements: elemTypes,
    };

    if (debug) {
      console.log(
        `Physical Page ${pageNumber}:\n` +
          `  Used: ${used}px\n` +
          `  Available: ${contentH}px\n` +
          `  Utilization: ${utilization.toFixed(1)}%\n` +
          `  Elements: ${elemTypes.join(', ')}`,
      );
    }

    pages.push({
      pageNumber,
      topic: currentTopic,
      items: current,
      stats,
    });
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
    const carry: Partial<PlacedElement> = isContinuation ? { isContinuation: true } : {};

    // 1. Explicit breakOnTopic option (if caller explicitly requests topic isolation)
    if (breakOnTopic && item.startsTopic && current.length > 0) {
      flush();
    }

    // 2. Look-ahead for section transitions:
    // If starting a new topic section on an existing page, look ahead to ensure
    // there is enough vertical room for the section to breathe (heading + content).
    if (!breakOnTopic && item.startsTopic && current.length > 0) {
      let lookaheadNeeded = h + 3 * LINE_H; // heading + at least 3 lines of follower room
      if (queue.length > 0) {
        const nextH = snapToLine(queue[0].measured.total);
        if (nextH <= 6 * LINE_H) {
          lookaheadNeeded = h + nextH;
        }
      }
      if (used + lookaheadNeeded > contentH) {
        flush();
      }
    }

    // 3. Heading orphan prevention:
    // A heading must never be stranded at the foot of a page without body content.
    if (el.type === 'heading' && current.length > 0) {
      let lookaheadNeeded = h + ORPHAN_MIN;
      if (queue.length > 0) {
        const nextH = snapToLine(queue[0].measured.total);
        if (nextH <= 4 * LINE_H) {
          lookaheadNeeded = h + nextH;
        }
      }
      if (used + lookaheadNeeded > contentH) {
        flush();
      }
    }

    const avail = contentH - used;

    // 4. Fits within available space on current page
    if (h <= avail) {
      place(item, h, carry);
      continue;
    }

    // 5. Doesn't fit in remaining space.
    // Try splitting ONLY if the element is in SPLITTABLE_INLINE (bullet_list, summary)
    // and there is enough room for at least MIN_ROWS_PER_FRAGMENT on both sides.
    if (isSplittable(el, measured) && avail >= LINE_H * 3) {
      const parts = splitToFit(item, measured, avail);
      if (parts) {
        place(parts[0].item, snapToLine(parts[0].measured.total), carry);
        queue.unshift({ ...parts[1], item: { ...parts[1].item, startsTopic: false } });
        flush();
        continue;
      }
    }

    // 6. Move element whole to a fresh page if current page already has content
    if (current.length > 0) {
      flush();
      queue.unshift({ item: { ...item, startsTopic: false }, measured, isContinuation });
      continue;
    }

    // 7. Already alone on a fresh page and STILL too tall:
    // If it has row structure (code_block, comparison, flowchart, timeline, bullet_list, summary),
    // try splitting across pages to avoid unreadable downscaling.
    if (rowsOf(el).length >= MIN_ROWS_PER_FRAGMENT * 2 && measured.parts.length >= MIN_ROWS_PER_FRAGMENT * 2) {
      const parts = splitToFit(item, measured, contentH);
      if (parts) {
        place(parts[0].item, snapToLine(parts[0].measured.total), carry);
        queue.unshift({ ...parts[1], item: { ...parts[1].item, startsTopic: false } });
        flush();
        continue;
      }
    }

    // 8. Atomic and taller than a whole page: shrink it rather than clip or crash.
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
