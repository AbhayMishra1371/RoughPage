'use client';

/**
 * handwriting.tsx
 * ===============
 * Turns plain strings into text that reads as hand-written.
 *
 * THE KEY DECISION: jitter PER WORD, not per character.
 *
 * Wrapping every glyph in its own span is the obvious idea and it is a trap.
 * It explodes the DOM (~2,000 nodes on a dense page, which Puppeteer then has
 * to lay out and paint twice — once to measure, once to draw), and once every
 * character is its own inline box Chrome's line-breaking degrades noticeably.
 * Per-word jitter gets ~95% of the visual payoff for ~5% of the nodes.
 *
 * Genuine per-character jitter is reserved for headings, where strings are
 * short, the text is large enough for the wobble to actually read, and the
 * node count stays trivial.
 */

import type { CSSProperties, ReactNode } from 'react';
import { INK, INK_RED } from './geometry';
import { jitterSoft, rngFrom, type Rng } from './rng';
import type { Importance } from './types';

/**
 * Ink shades. A real pen varies as it runs dry and re-wets, so each element
 * picks a slightly different blue-black rather than every word sharing one.
 */
const INK_SHADES = ['#1c2b6b', '#22306f', '#1a2660', '#26356f', '#1e2a66'] as const;

/** Per-element ink styling, driven by `importance`. */
export function inkFor(rng: Rng, importance: Importance = 'low'): CSSProperties {
  const shade = INK_SHADES[Math.floor(rng() * INK_SHADES.length) % INK_SHADES.length];

  if (importance === 'high') {
    return {
      color: '#141f52', // pressed harder
      fontWeight: 700,
      // A hint of ballpoint bleed. Kept under half a pixel or it turns into blur.
      textShadow: '0 0 0.45px currentColor',
    };
  }
  if (importance === 'medium') {
    return { color: shade, fontWeight: 600, textShadow: '0 0 0.3px currentColor' };
  }
  return { color: shade, fontWeight: 400, opacity: 0.86 };
}

// ── Glyph safety ────────────────────────────────────────────────────────────

/**
 * Characters Kalam does not have, mapped to what a hand would write instead.
 *
 * WHY THIS EXISTS: a glyph missing from Kalam does not fail visibly. The browser
 * quietly falls through the font stack and renders it from whatever the operating
 * system offers — on Windows that meant Segoe UI Symbol got embedded into the
 * PDF. Two problems at once, the same pair that made the bullet arrow and the
 * star into drawn shapes (see lib/roughShapes.tsx):
 *
 *   1. That font does not exist on a Linux box, so the same JSON produces
 *      different glyph widths, different wrapping, and different pagination
 *      elsewhere. Determinism becomes true only on this machine.
 *   2. A crisp geometric symbol in the middle of handwriting is exactly the
 *      "reads as print, not pen" tell this whole renderer exists to avoid.
 *
 * `flowchart` steps are where this bites hardest — an LLM writes
 * "If target > arr[mid] → low = mid + 1" every time.
 *
 * DELIBERATELY CONSERVATIVE. Only characters with an unambiguous ASCII
 * equivalent that a student would actually write are here. Mathematical symbols
 * (Σ, ∞, √, ≤) are NOT: mangling them into words would make formulas worse, not
 * better, and real math typesetting is the honest fix. `fontReport()` in
 * scripts/render-pdf.ts is the backstop that shouts if any of them slip through.
 */
const GLYPH_MAP: Record<string, string> = {
  '→': '->',
  '⟶': '->',
  '➔': '->',
  '➜': '->',
  '⇒': '=>',
  '←': '<-',
  '⟵': '<-',
  '⇐': '<=',
  '↔': '<->',
  '⇔': '<=>',
  '•': '-',
  '▪': '-',
  '▫': '-',
  '◦': '-',
  '‣': '-',
};

const GLYPH_RE = new RegExp(`[${Object.keys(GLYPH_MAP).join('')}]`, 'g');

/** Replaces glyphs Kalam lacks. Exported for the font audit. */
export function normalizeGlyphs(text: string): string {
  return String(text ?? '').replace(GLYPH_RE, (c) => GLYPH_MAP[c] ?? c);
}

// ── Per-word jitter ─────────────────────────────────────────────────────────

/**
 * Word gap, in em.
 *
 * MEASURED, not eyeballed: Kalam's own space glyph is 0.40em (7.61px at 19px),
 * and because the word spans are `inline-block` with no text node between them —
 * see the note on `Hand` — this margin is the ONLY thing separating two words.
 * It was 0.26em, which set every line 37% tighter than the font intends and read
 * as cramped print rather than handwriting.
 *
 * Sat a hair above natural: a hand lifts off the paper between words and comes
 * down a little further along than a typesetter would.
 *
 * Changing this reflows everything, so re-run the grid audit after touching it.
 */
const WORD_GAP_EM = 0.43;

export interface HandProps {
  text: string;
  /** Any stable string — same seed gives the same wobble every render. */
  seed: string;
  importance?: Importance;
  /** Multiplies the jitter. Raise for informal text, lower for tight spots. */
  intensity?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Body text with per-word rotation and baseline drift.
 *
 * Spacing is a `margin-right`, NOT whitespace between the spans: JSX emits
 * adjacent elements with no whitespace, and a trailing space inside an
 * inline-block gets collapsed away. Margin is the reliable way to space these.
 */
export function Hand({
  text,
  seed,
  importance = 'low',
  intensity = 1,
  className,
  style,
}: HandProps): ReactNode {
  const rng = rngFrom(seed);
  const ink = inkFor(rng, importance);
  const words = normalizeGlyphs(text).split(/\s+/).filter(Boolean);

  return (
    <span className={className} style={{ ...ink, ...style }}>
      {words.map((word, i) => (
        <span
          key={`${i}-${word}`}
          style={{
            display: 'inline-block',
            marginRight: `${WORD_GAP_EM}em`,
            transform:
              `rotate(${jitterSoft(rng, 0.75 * intensity).toFixed(3)}deg) ` +
              `translateY(${jitterSoft(rng, 0.7 * intensity).toFixed(2)}px)`,
          }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

// ── Per-character jitter (headings only) ────────────────────────────────────

export interface HandCharsProps {
  text: string;
  seed: string;
  intensity?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Per-character wobble. Only for short strings — see the note at the top of
 * this file about why this must not touch body text.
 *
 * Words are kept as inline-block wrappers so line breaking still happens at
 * word boundaries rather than mid-word.
 */
export function HandChars({
  text,
  seed,
  intensity = 1,
  className,
  style,
}: HandCharsProps): ReactNode {
  const rng = rngFrom(seed);
  const words = normalizeGlyphs(text).split(/\s+/).filter(Boolean);

  return (
    <span className={className} style={style}>
      {words.map((word, wi) => (
        <span
          key={`${wi}-${word}`}
          style={{ display: 'inline-block', marginRight: `${WORD_GAP_EM}em`, whiteSpace: 'nowrap' }}
        >
          {Array.from(word).map((ch, ci) => (
            <span
              key={ci}
              style={{
                display: 'inline-block',
                transform:
                  `rotate(${jitterSoft(rng, 2.1 * intensity).toFixed(3)}deg) ` +
                  `translateY(${jitterSoft(rng, 1.15 * intensity).toFixed(2)}px)`,
              }}
            >
              {ch}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

// ── Marker highlight ────────────────────────────────────────────────────────

/**
 * A translucent marker band behind text, drawn with soft uneven edges so it
 * looks stroked by hand rather than filled by a rectangle.
 */
export function markerStyle(rng: Rng, color = '#ffe07a'): CSSProperties {
  const a = jitterSoft(rng, 1.4);
  const b = jitterSoft(rng, 1.4);
  return {
    background: `linear-gradient(
      to bottom,
      transparent 12%,
      ${color}00 14%,
      ${color}cc ${28 + a}%,
      ${color}cc ${86 + b}%,
      transparent 92%
    )`,
    // Marker bleeds slightly past the glyphs.
    padding: '0 0.12em',
    borderRadius: '2px',
  };
}

export { INK, INK_RED };
