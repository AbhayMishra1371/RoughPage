'use client';

/**
 * latex.tsx
 * =========
 * Real math typesetting, via rehype-katex.
 *
 * WHY THIS EXISTS: `sticky_formula.formula` arrives as a LaTeX string and used to
 * be drawn with `Hand`, the per-word handwriting helper. Kalam has no idea what
 * `\frac` means, so the page showed the SOURCE — literal backslashes and braces
 * wrapping onto three lines. `StickyFormula` carried a regex "prettifier" that
 * swapped a dozen commands for lookalike characters, which handled `\sum` and
 * `\times` and mangled everything else. That whole approach is now gone; the note
 * in lib/handwriting.tsx about mathematical symbols already said what the honest
 * fix was ("real math typesetting"), and this is it.
 *
 * WHY REHYPE-KATEX AND NOT `katex.renderToString` DIRECTLY: rehype-katex owns the
 * error path, and that is the part worth not writing twice. It tries strict, and
 * on a parse failure retries with `strict: 'ignore'` so KaTeX emits its own red
 * `.katex-error` markup with the raw source in a tooltip, and only falls back to
 * a hand-built span if even that throws. Broken AI LaTeX therefore lands on the
 * page VISIBLY instead of taking the render down or vanishing — the same
 * philosophy as components/elements/Unsupported.tsx.
 *
 * THE ONE THING THAT MUST NOT BE FORGOTTEN: KaTeX lays out with its own fonts,
 * and its span geometry is meaningless until they load. Measuring a formula
 * before then produces a height that is wrong by an unpredictable amount — the
 * exact trap `ensureFonts` in components/NotebookRenderer.tsx exists to avoid for
 * Kalam. `KATEX_FONT_PROBES` below is that guard, and it is imported there.
 */

import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import type { ElementContent, Root } from 'hast';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import rehypeKatex from 'rehype-katex';
import { unified } from 'unified';
import { VFile } from 'vfile';

// ── Font probes ─────────────────────────────────────────────────────────────

/**
 * Every face katex.min.css declares — all twenty, deliberately.
 *
 * Over-probing is free and under-probing is silent. A formula reaching for a face
 * nobody waited on measures against a fallback, so its height is wrong, so the
 * ruled grid drifts from that element on. Which faces a given formula touches is
 * a property of its LaTeX (`\mathbb` pulls AMS, a tall `\left(` pulls Size2/3/4),
 * so it cannot be known ahead of time. Loading a face does NOT get it embedded in
 * the PDF — Chrome embeds only what it actually paints glyphs with, which is why
 * the existing `300 19px Kalam` probe never put Kalam-Light in the font report.
 */
export const KATEX_FONT_PROBES: readonly string[] = [
  '400 10px "KaTeX_Main"',
  '700 10px "KaTeX_Main"',
  'italic 400 10px "KaTeX_Main"',
  'italic 700 10px "KaTeX_Main"',
  'italic 400 10px "KaTeX_Math"',
  'italic 700 10px "KaTeX_Math"',
  '400 10px "KaTeX_Size1"',
  '400 10px "KaTeX_Size2"',
  '400 10px "KaTeX_Size3"',
  '400 10px "KaTeX_Size4"',
  '400 10px "KaTeX_AMS"',
  '400 10px "KaTeX_Caligraphic"',
  '700 10px "KaTeX_Caligraphic"',
  '400 10px "KaTeX_Fraktur"',
  '700 10px "KaTeX_Fraktur"',
  '400 10px "KaTeX_SansSerif"',
  '700 10px "KaTeX_SansSerif"',
  'italic 400 10px "KaTeX_SansSerif"',
  '400 10px "KaTeX_Script"',
  '400 10px "KaTeX_Typewriter"',
];

// ── Is this even LaTeX? ─────────────────────────────────────────────────────

/**
 * Patterns that mean "this string wants a typesetter".
 *
 * `is_latex` is set by the LLM and is not reliable — it defaults to `False` in
 * notebook.py, and a model that writes `\frac{QK^T}{\sqrt{d_k}}` and then forgets
 * the flag would put raw backslashes back on the page. So the flag is treated as
 * a hint, not an authority, and anything that LOOKS like LaTeX is typeset.
 *
 * The asymmetry justifies leaning this way: a plain expression sent through KaTeX
 * comes out slightly over-italicised, while LaTeX sent through Kalam comes out as
 * unreadable source. One is a blemish, the other is the bug being fixed.
 */
const LATEX_HINTS: readonly RegExp[] = [
  /\\[A-Za-z]{2,}/, //        \frac \sum \text \sqrt \alpha
  /\\[[\](){}|,;!]/, //       \[ \] \( \) \{ \} and the spacing commands
  /\\\\/, //                  a row break inside an array or matrix
  /[_^]\s*[{(]/, //           x^{2}  a_{i,j}
  /[_^]\s*[A-Za-z0-9]/, //    mc^2  a_i
];

export function looksLikeLatex(raw: string): boolean {
  const s = String(raw ?? '');
  return LATEX_HINTS.some((re) => re.test(s));
}

/**
 * Unwraps the math delimiters, which KaTeX does not accept — it is given the
 * expression, not a document containing one. `$O(\log n)$` used to render its own
 * dollar signs onto the page.
 *
 * Each pattern requires the delimiter at BOTH ends and forbids a bare `$` in
 * between, so `$a$ + $b$` is left alone rather than half-stripped into something
 * that then fails to parse. Two expressions in one `formula` field is malformed
 * input; better it reach KaTeX intact and show up as a visible error.
 */
export function stripMathDelimiters(raw: string): string {
  const s = String(raw ?? '').trim();
  const unwrap: readonly RegExp[] = [
    /^\$\$([^$]+)\$\$$/,
    /^\$([^$]+)\$$/,
    /^\\\[([\s\S]+)\\\]$/,
    /^\\\(([\s\S]+)\\\)$/,
  ];
  for (const re of unwrap) {
    const m = s.match(re);
    if (m) return m[1].trim();
  }
  return s;
}

// ── The pipeline ────────────────────────────────────────────────────────────

/**
 * KaTeX settings. Three of these are load-bearing.
 *
 * `output: 'html'` — KaTeX's default also emits a hidden MathML copy of every
 * expression for screen readers. A PDF has no screen reader, so that is pure
 * weight: double the nodes for Puppeteer to lay out twice, and a `<math>` element
 * that Chrome now understands natively sitting inside a box whose height is being
 * measured to the pixel. Dropped.
 *
 * `trust: false` — the default, made explicit because it matters here: this LaTeX
 * comes from an LLM, and `trust: true` would let `\href` and `\includegraphics`
 * through, i.e. let model output inject a link or fetch a URL during a render
 * that is supposed to be hermetic.
 *
 * `maxSize` / `maxExpand` — geometry guards. `\rule{999em}{999em}` is a one-line
 * way to produce an element taller than the page, and `\def` can be recursive.
 * Both are capped so bad input degrades instead of breaking pagination.
 */
const KATEX_OPTIONS = {
  output: 'html',
  strict: 'ignore' as const,
  trust: false,
  maxSize: 10,
  maxExpand: 1000,
  // Hairlines in a fraction bar disappear at print resolution.
  minRuleThickness: 0.06,
} as const;

const processor = unified().use(rehypeKatex, KATEX_OPTIONS);

/**
 * Same expression in, same React tree out.
 *
 * Not just a speed-up: every element is rendered TWICE, once into the hidden
 * measuring container and once onto a real page, and the second render must agree
 * with the first to the pixel or pagination is built on a lie. A cache makes that
 * identity structural rather than a property of KaTeX being deterministic.
 */
const cache = new Map<string, ReactNode>();
/** The preview page lives for hours across hot reloads; don't grow without bound. */
const CACHE_MAX = 512;

function typeset(latex: string, display: boolean): ReactNode {
  const key = `${display ? 'd' : 'i'}:${latex}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  // Built by hand rather than parsed. rehype-katex keys off a class name, so the
  // whole "parse HTML or markdown first" layer is unnecessary for what is already
  // a bare expression — `math-display` and `math-inline` are the classes
  // remark-math would have produced from `$$…$$` and `$…$`.
  const tree: Root = {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'span',
        properties: { className: [display ? 'math-display' : 'math-inline'] },
        children: [{ type: 'text', value: latex }],
      } satisfies ElementContent,
    ],
  };

  // A real VFile, because rehype-katex reports parse failures through
  // `file.message()` on its way to the visible-error fallback. Hand it a duck and
  // a malformed formula becomes a TypeError that takes down the render.
  const file = new VFile({ path: 'formula.tex' });
  const out = processor.runSync(tree, file) as Root;

  for (const m of file.messages) {
    console.warn(`latex: ${m.reason} — ${JSON.stringify(latex)}`);
  }

  const node = toJsxRuntime(out, { Fragment, jsx, jsxs });

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, node);
  return node;
}

// ── Component ───────────────────────────────────────────────────────────────

export interface KatexProps {
  /** A bare expression. Delimiters are stripped for you. */
  latex: string;
  /**
   * Display math: centred, big operators at full size, and — this is the part
   * that matters for layout — `white-space: nowrap`, so it never wraps and the
   * caller is responsible for the width it ends up needing.
   */
  display?: boolean;
  /**
   * Font size in px for the surrounding box. KaTeX scales every span from the
   * inherited size (its root is `1.21em`), so this is the one knob for how big
   * the maths comes out.
   */
  size?: number;
  style?: CSSProperties;
}

/**
 * Typeset maths, styled to sit on this paper.
 *
 * `color: inherit` is the whole integration: KaTeX sets no colour of its own, so
 * the expression comes out in whatever ink the surrounding element is using
 * rather than in black. `line-height: 1.2` is KaTeX's own and is restated here so
 * the 32px ruled-line strut inherited from `.page-content` cannot add a phantom
 * line to the measured height.
 */
export default function Katex({ latex, display = true, size, style }: KatexProps): ReactNode {
  const expr = stripMathDelimiters(latex);
  if (!expr) return null;

  return (
    <span
      className="katex-host"
      style={{ fontSize: size, lineHeight: 1.2, color: 'inherit', ...style }}
    >
      {typeset(expr, display)}
    </span>
  );
}
