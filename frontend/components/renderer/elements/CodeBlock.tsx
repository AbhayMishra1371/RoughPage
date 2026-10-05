'use client';

/**
 * CodeBlock.tsx
 * =============
 * Source code on a dark inset panel, in JetBrains Mono.
 *
 * WHY THIS ONE ELEMENT IS NOT HANDWRITTEN: nobody hand-letters code into their
 * notes and gets the indentation right, and a monospace panel is instantly
 * legible as "this is code, read it literally" in a way jittered Kalam never
 * would be. The hand-drawn frame around it keeps it part of the same page rather
 * than a screenshot dropped on top.
 *
 * SPLITTABLE AT LINE BOUNDARIES. Each source line carries `data-part`, so a long
 * listing continues onto the next page with its language tag repeated — which is
 * exactly the `head`/`parts` mechanism bullet_list uses for its title.
 *
 * Lines are allowed to WRAP rather than clip. A wrapped line simply measures 32px
 * instead of 16px, and because every line is measured individually the split
 * arithmetic stays exact either way. Clipping would silently lose code.
 */

import { BOX_INSET, EL_GAP, LINE_H } from '@/lib/geometry';
import { seedFrom } from '@/lib/rng';
import { RoughPlainBox } from '@/lib/roughShapes';
import { useBoxSize } from '@/lib/useBoxSize';
import type { CodeBlockElement } from '@/lib/types';
import ContdMarker from './ContdMarker';

/**
 * Half a ruled line per code line. Tighter than handwriting because monospace at
 * 13px does not need 32px of leading, and a 20-line listing that consumed 20
 * ruled lines would swallow two thirds of a page.
 */
const CODE_LINE_H = LINE_H / 2;
const CODE_SIZE = 13;

/** Panel ink. Dark, but tinted toward the page's blue rather than neutral black. */
const PANEL_BG = '#20263a';
const PANEL_FG = '#e9e6dc';

const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export default function CodeBlock({
  el,
  seed,
  continued,
}: {
  el: CodeBlockElement;
  seed: string;
  continued?: boolean;
}) {
  const [ref, box] = useBoxSize<HTMLDivElement>();

  // Tabs are normalised to two spaces: a tab's rendered width depends on the
  // element's tab-size and would make measured line widths unpredictable.
  const lines = String(el.code ?? '').replace(/\t/g, '  ').split('\n');
  const language = String(el.language ?? '').trim();

  return (
    <div className="el" style={{ paddingTop: BOX_INSET, paddingBottom: BOX_INSET + EL_GAP }}>
      <div className="el-body">
        <div
          ref={ref}
          style={{
            position: 'relative',
            padding: '10px 14px 12px',
          }}
        >
          {box.w > 0 && box.h > 0 && (
            <RoughPlainBox
              width={box.w}
              height={box.h}
              seed={seedFrom(seed, 'codebox')}
              fill={PANEL_BG}
              fillStyle="solid"
              stroke="#0f1424"
              strokeWidth={1.6}
              roughness={1.1}
              bowing={0.8}
              radiusHint={5}
            />
          )}

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              data-head="1"
              style={{
                fontFamily: MONO,
                fontSize: 11,
                lineHeight: `${LINE_H - 12}px`,
                paddingBottom: 6,
                color: '#8d9bc4',
                letterSpacing: '0.08em',
                textTransform: 'lowercase',
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
              }}
            >
              <span>{language || 'code'}</span>
              {continued && <ContdMarker />}
            </div>

            {lines.map((line, i) => (
              <div
                key={i}
                data-part={i}
                style={{
                  fontFamily: MONO,
                  fontSize: CODE_SIZE,
                  lineHeight: `${CODE_LINE_H}px`,
                  color: PANEL_FG,
                  // `pre-wrap` keeps leading indentation AND allows wrapping.
                  whiteSpace: 'pre-wrap',
                  // A wrapped continuation is indented, so it reads as overflow
                  // rather than as a new statement.
                  paddingLeft: 14,
                  textIndent: -14,
                  // An empty line still has to occupy its row.
                  minHeight: CODE_LINE_H,
                }}
              >
                {line || ' '}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
