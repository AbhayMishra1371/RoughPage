'use client';

/**
 * StickyFormula.tsx
 * =================
 * A formula on a rotated yellow sticky note, stuck onto the page.
 *
 * ROTATION AND MEASUREMENT: `transform` is purely visual and does not affect
 * layout, so the wrapper's measured height stays the UNROTATED height — which
 * is what pagination wants. But the rotated note does visually overhang its
 * box, so the wrapper adds padding to absorb the overhang instead of letting it
 * collide with the neighbouring element.
 *
 * THE FORMULA IS TYPESET, NOT HANDWRITTEN. See lib/latex.tsx for why. The label
 * above it stays in Kalam, so the note reads as a printed formula a student wrote
 * a heading on — which is a deliberate concession: the alternative was Kalam
 * rendering `\frac{QK^T}{\sqrt{d_k}}` as literal backslashes and braces. Plain
 * expressions with no LaTeX in them (`O(log n)`) are still handwritten.
 */

import Katex, { looksLikeLatex, stripMathDelimiters } from '@/lib/latex';
import { Hand } from '@/lib/handwriting';
import { BOX_INSET, EL_GAP } from '@/lib/geometry';
import { between, rngFrom, seedFrom } from '@/lib/rng';
import { RoughSticky } from '@/lib/roughShapes';
import { useBoxSize, useLayoutBox } from '@/lib/useBoxSize';
import type { StickyFormulaElement } from '@/lib/types';

/**
 * How wide the note is allowed to get, and how much of that the maths may use.
 *
 * Derived, not picked: the content column is CONTENT_W (670) and `offsetX` below
 * pushes the note up to 74px in from the margin, so 596 is the true ceiling.
 * 520 leaves headroom, and the maths ceiling is that minus the note's 22px side
 * padding either side.
 */
const NOTE_MAX_W = 520;
const MATH_MAX_W = NOTE_MAX_W - 44;

/** Container size for the maths. KaTeX's root is 1.21em, so this lands near 25px. */
const MATH_SIZE = 21;

export default function StickyFormula({
  el,
  seed,
}: {
  el: StickyFormulaElement;
  seed: string;
}) {
  const [ref, box] = useBoxSize<HTMLDivElement>();
  const rng = rngFrom(seed, 'sticky');

  const tilt = between(rng, -3.2, -1.4);
  const offsetX = between(rng, 12, 74);

  const raw = el.formula ?? '';
  const typeset = Boolean(el.is_latex) || looksLikeLatex(raw);

  /**
   * Display maths does not wrap — `.katex-display > .katex` is `white-space:
   * nowrap` — so a long expression would simply hang out over the edge of the
   * note. Measured here and scaled down if it does not fit.
   *
   * `useLayoutBox` (offset geometry), NOT `useBoxSize` (client rects), because the
   * scale below is applied to the very node being measured. Read through a rect
   * that is a loop; read through `offsetWidth` it converges in one pass. And note
   * what is deliberately NOT set: the outer box has no explicit height. A
   * transform does not affect layout, so this box's auto height is the UNSCALED
   * height in both passes — identical before and after the measurement lands,
   * which is what keeps the hidden measure pass in agreement with the real page.
   * A scaled formula gets a little vertical air inside the note; the grid stays
   * exact.
   *
   * AND NO `overflow: hidden` ANYWHERE, tempting as it is. The scale is computed
   * to land the maths on exactly MATH_MAX_W, so there is nothing to clip — and a
   * clip cannot be limited to one axis (CSS promotes the other to `auto`), so the
   * one that was here sheared the top off a tall `\left(`.
   */
  const [mathRef, natural] = useLayoutBox<HTMLDivElement>();
  const scale = natural.w > MATH_MAX_W ? MATH_MAX_W / natural.w : 1;

  return (
    <div
      className="el"
      style={{
        // Absorbs the rotation overhang so the note cannot collide upward.
        // A sticky note is stuck ON the page, so unlike written text it makes no
        // attempt to sit on the rules — but its outer box still consumes whole
        // lines, which is what keeps the elements after it on the grid.
        paddingTop: BOX_INSET,
        paddingBottom: BOX_INSET + EL_GAP,
      }}
    >
      <div
        className="el-body"
        style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: offsetX }}
      >
        <div
          style={{
            transform: `rotate(${tilt.toFixed(2)}deg)`,
            filter: 'drop-shadow(2px 4px 3px rgba(90,74,42,0.28))',
          }}
        >
          <div
            ref={ref}
            style={{
              position: 'relative',
              minWidth: 190,
              maxWidth: NOTE_MAX_W,
              padding: '12px 22px 14px',
              textAlign: 'center',
            }}
          >
            {box.w > 0 && box.h > 0 && (
              <RoughSticky width={box.w} height={box.h} seed={seedFrom(seed, 'note')} />
            )}

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: '19px',
                  color: '#7a6420',
                  textTransform: 'uppercase',
                  letterSpacing: '0.09em',
                }}
              >
                <Hand text={el.label} seed={`${seed}-label`} intensity={0.6} />
              </div>

              {typeset ? (
                <div
                  style={{
                    // max-content while it fits, pinned once it doesn't — so a
                    // short formula still lets the note shrink-wrap around it.
                    width: scale < 1 ? MATH_MAX_W : 'max-content',
                    maxWidth: MATH_MAX_W,
                    // The note is centred text; the maths box is a block, so it
                    // needs its own centring once it is narrower than the note.
                    margin: '0 auto',
                    // Tall delimiters overshoot: a `\left(` grown to wrap a
                    // fraction puts ~5px of ink ABOVE the box KaTeX reports for
                    // it, measured with a Range over the glyphs. Without this the
                    // overshoot lands in the label's line box. Present in both the
                    // measure and the render pass, so the grid is unaffected.
                    paddingTop: 6,
                  }}
                >
                  <div
                    ref={mathRef}
                    style={{
                      width: 'max-content',
                      transform: scale < 1 ? `scale(${scale})` : undefined,
                      // LEFT, not centre. The child is `max-content` and therefore
                      // WIDER than this box whenever a scale is needed, and a block
                      // overflows only to the right — so scaling about its own
                      // centre lands it half the overflow too far right. Measured:
                      // 29px of the beam-score formula sheared off the note. From
                      // the left corner the scaled box lands on exactly MATH_MAX_W.
                      transformOrigin: 'top left',
                    }}
                  >
                    <Katex latex={raw} size={MATH_SIZE} style={{ color: '#2a2410' }} />
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 25,
                    lineHeight: '32px',
                    fontWeight: 700,
                    color: '#2a2410',
                    letterSpacing: '0.02em',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <Hand
                    text={stripMathDelimiters(raw)}
                    seed={`${seed}-f`}
                    intensity={0.75}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
