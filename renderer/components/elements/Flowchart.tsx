'use client';

/**
 * Flowchart.tsx
 * =============
 * A vertical chain of drawn boxes joined by arrows — an algorithm as a student
 * would sketch it down the page.
 *
 * SPLITTABLE AT STEP BOUNDARIES, and the arrow placement is what makes that
 * safe: each step's connector is drawn in its OWN band BELOW the box, and the
 * last step of a fragment has no connector. So a flowchart cut across a page
 * break ends on a closed box rather than on an arrow pointing into the margin.
 *
 * Each step is its own component because each one measures itself — the drawn
 * frame has to wrap however many lines the text wrapped to, and React hooks
 * cannot be called in a loop.
 */

import { Hand } from '@/lib/handwriting';
import { BOX_INSET, CONTENT_W, EL_GAP, LINE_H } from '@/lib/geometry';
import { seedFrom } from '@/lib/rng';
import { RoughDownArrow, RoughPlainBox } from '@/lib/roughShapes';
import { useBoxSize } from '@/lib/useBoxSize';
import type { FlowchartElement, Importance } from '@/lib/types';
import { importanceOf } from '@/lib/types';
import ContdMarker from './ContdMarker';

/**
 * Narrower than the column, and indented. A flowchart box spanning the full
 * content width reads as a banner rather than as a step in a chain; leaving
 * margin on both sides is what makes the vertical flow legible.
 */
const STEP_W = Math.round(CONTENT_W * 0.66); // 442
const STEP_INDENT = 24;

function FlowStep({
  text,
  seed,
  index,
  last,
  importance,
}: {
  text: string;
  seed: string;
  index: number;
  last: boolean;
  importance: Importance;
}) {
  const [ref, box] = useBoxSize<HTMLDivElement>();

  return (
    <div data-part={index} style={{ paddingLeft: STEP_INDENT }}>
      {/*
        BOX_INSET above and below the text = one whole ruled line between them,
        so a one-line step measures exactly 2 × LINE_H and the drawn border lands
        midway between two rules instead of on one.
      */}
      <div
        ref={ref}
        style={{
          position: 'relative',
          width: STEP_W,
          padding: `${BOX_INSET}px 16px`,
        }}
      >
        {box.w > 0 && box.h > 0 && (
          <RoughPlainBox
            width={box.w}
            height={box.h}
            seed={seedFrom(seed, 'step', index)}
            radiusHint={6}
          />
        )}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            fontSize: 17,
            lineHeight: `${LINE_H}px`,
          }}
        >
          <Hand text={text} seed={`${seed}-step${index}`} importance={importance} intensity={0.9} />
        </div>
      </div>

      {!last && (
        <div style={{ position: 'relative', width: STEP_W, height: LINE_H }}>
          <RoughDownArrow width={STEP_W} height={LINE_H} seed={seedFrom(seed, 'flow', index)} />
        </div>
      )}
    </div>
  );
}

export default function Flowchart({
  el,
  seed,
  continued,
}: {
  el: FlowchartElement;
  seed: string;
  continued?: boolean;
}) {
  const importance = importanceOf(el);
  const steps = (el.steps ?? []).map((s) => String(s ?? '')).filter(Boolean);

  return (
    <div className="el" style={{ paddingBottom: EL_GAP }}>
      <div className="el-body">
        {(el.title || continued) && (
          <div
            data-head="1"
            style={{ fontSize: 20, lineHeight: `${LINE_H}px`, color: '#1a2660' }}
          >
            <Hand text={el.title ?? 'Steps'} seed={`${seed}-title`} importance="medium" />
            {continued && <ContdMarker />}
          </div>
        )}

        {steps.map((s, i) => (
          <FlowStep
            key={i}
            text={s}
            seed={seed}
            index={i}
            last={i === steps.length - 1}
            importance={importance}
          />
        ))}
      </div>
    </div>
  );
}
