/**
 * geometry.ts
 * ===========
 * Page and line metrics. Every visual decision in the renderer derives from
 * these numbers, so they live in exactly one place.
 *
 * THE GRID IS THE BACKBONE.
 * `LINE_H` is the ruled-line pitch. Every element's height is rounded UP to a
 * multiple of it, so the vertical cursor can only ever land on a line boundary.
 * That is the whole reason handwriting stays sitting ON the blue lines instead
 * of drifting off them a few pixels at a time down the page and across breaks.
 */

/** Ruled line pitch, px. Also the body `line-height`. */
export const LINE_H = 32;

/** True A4 at 96 CSS dpi: 210mm x 297mm. */
export const PAGE_W = 794;
export const PAGE_H = 1123;

/** Header zone above the first ruled line. */
export const PAD_TOP = 3 * LINE_H; // 96

/**
 * 67, deliberately not a round number.
 *
 * A4 at 96dpi is 1122.5px, which is not a multiple of LINE_H. If the page div
 * and the `page.pdf()` paper size disagree by even a pixel or two, Chrome emits
 * a trailing sliver page — a classic and maddening Puppeteer bug. So the page
 * box stays exactly true A4 and the leftover slack is parked here, which leaves
 * CONTENT_H an exact multiple of LINE_H.
 */
export const PAD_BOT = 67;

/** 960 = exactly 30 ruled lines. */
export const CONTENT_H = PAGE_H - PAD_TOP - PAD_BOT;

/** Where the red margin rule sits, and where content starts. */
export const RULE_X = 68;
export const MARGIN_X = 76;
export const PAD_RIGHT = 48;

/** The measuring container must be exactly this wide or measurements lie. */
export const CONTENT_W = PAGE_W - MARGIN_X - PAD_RIGHT; // 670

// ── Vertical rhythm ─────────────────────────────────────────────────────────

/**
 * THE RULE THAT KEEPS TEXT ON THE LINES:
 * every vertical space an element puts ABOVE a row of text must be a multiple
 * of LINE_H. Snapping element heights is not enough on its own — that only
 * guarantees each element *starts* on a ruled line. An element with 12px of
 * internal padding then writes its text 12px below that line, and every row it
 * contains sits in the gap between rules instead of on them.
 *
 * So padding comes from these two constants and nothing else.
 */

/** Blank line after an element. */
export const EL_GAP = LINE_H;

/**
 * The one deliberate exception: a HALF line, used only as the inset between a
 * drawn box's border and the text inside it. It keeps the text on the grid while
 * putting the border itself midway between two rules — which is where a
 * hand-drawn box actually lands, since nobody rules a box along a printed line.
 * Always used in pairs (top and bottom) so the total stays a whole line.
 */
export const BOX_INSET = LINE_H / 2;

/**
 * THE SECOND, LESS OBVIOUS HALF OF THE SAME RULE: padding is not the only thing
 * that can make a row taller than LINE_H. Inline boxes on a line are aligned by
 * BASELINE, and each one keeps half of its own leftover leading above and below
 * its text. So two inline boxes sharing `line-height: 32px` but differing in
 * font size do NOT occupy the same 32px band — the larger reaches further above
 * the baseline, the smaller further below it, and the line box grows to cover
 * the union. Measured cost, Kalam at LINE_H: about 2px per 6px of font-size
 * difference. Enough to spend a whole extra ruled line and push every row in the
 * element off the grid.
 *
 * Two safe patterns, both verified in the browser:
 *   - a SMALLER inline inside a row  → give it `line-height: 1`, so its box fits
 *     entirely inside the row's strut. Keeps the shared baseline. See
 *     components/elements/ContdMarker.tsx.
 *   - an inline-block that IS the row → give it `vertical-align: top`, so its
 *     own height wins outright instead of being adjusted against the strut. See
 *     components/elements/Heading.tsx.
 *
 * Flex rows are immune: flex items are not inline boxes and never share a
 * baseline-aligned line box, which is why the bullet/summary item rows can mix
 * an 18px arrow with 19px text and still measure exactly LINE_H.
 */

// ── Palette ─────────────────────────────────────────────────────────────────

export const PAPER = '#fdfaf2';
export const RULE_BLUE = '#a8c4e0';
export const RULE_RED = '#d94a3d';
/** Ballpoint blue-black. Never pure black — that reads as print, not pen. */
export const INK = '#1c2b6b';
export const INK_RED = '#c0392b';
export const STICKY_YELLOW = '#ffe883';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Rounds a measured height up to whole ruled lines. */
export function snapToLine(px: number): number {
  return Math.max(LINE_H, Math.ceil(px / LINE_H) * LINE_H);
}

/** How many ruled lines a height occupies. */
export function linesFor(px: number): number {
  return snapToLine(px) / LINE_H;
}

/** Total ruled lines available in one page's content box. */
export const LINES_PER_PAGE = CONTENT_H / LINE_H; // 30

// Fail loudly at import time if the grid is ever broken by an edit.
if (CONTENT_H % LINE_H !== 0) {
  throw new Error(
    `geometry: CONTENT_H (${CONTENT_H}) must be a multiple of LINE_H (${LINE_H}). ` +
      `Adjust PAD_BOT, not PAGE_H — PAGE_H must stay true A4.`,
  );
}
