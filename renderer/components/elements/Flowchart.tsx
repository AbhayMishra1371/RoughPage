'use client';

/**
 * Flowchart.tsx
 * =============
 * A vertical chain of hand-drawn process nodes joined by arrows.
 *
 * Visual hierarchy:
 * - Start step: rounded capsule with gentle sky wash.
 * - End step: rounded capsule with gentle mint wash.
 * - Decision step (contains '?' or 'if'): diamond or amber wash.
 * - Process steps: rounded sketch boxes with circled step number badges ① ② ③.
 * - Smooth vertical connectors with solid sketched arrowheads.
 */

import { Hand } from '@/lib/handwriting';
import { BOX_INSET, CONTENT_W, EL_GAP, LINE_H } from '@/lib/geometry';
import { seedFrom } from '@/lib/rng';
import { PALETTE } from '@/lib/handDrawnStyle';
import { CircledNumberBadge } from '@/lib/handDrawnDoodles';
import { RoughCapsuleBox, RoughDiamondBox, RoughDownArrow, RoughPlainBox } from '@/lib/roughShapes';
import { useBoxSize } from '@/lib/useBoxSize';
import type { FlowchartElement, Importance } from '@/lib/types';
import { importanceOf } from '@/lib/types';
import ContdMarker from './ContdMarker';

const STEP_W = Math.round(CONTENT_W * 0.72); // 482px
const STEP_INDENT = 20;

function FlowStep({
  text,
  seed,
  index,
  total,
  last,
  importance,
}: {
  text: string;
  seed: string;
  index: number;
  total: number;
  last: boolean;
  importance: Importance;
}) {
  const [ref, box] = useBoxSize<HTMLDivElement>();

  const isStart = index === 0;
  const isEnd = last && total > 2;
  const isDecision = text.includes('?') || text.toLowerCase().startsWith('if ') || text.toLowerCase().includes('check');

  let fill: string = '#ffffff';
  let stroke: string = PALETTE.ink;

  if (isStart) {
    fill = PALETTE.washBlue;
    stroke = PALETTE.ink;
  } else if (isEnd) {
    fill = PALETTE.washGreen;
    stroke = '#2e7d32';
  } else if (isDecision) {
    fill = PALETTE.washYellow;
    stroke = PALETTE.inkAmber;
  }

  return (
    <div data-part={index} style={{ paddingLeft: STEP_INDENT }}>
      <div
        ref={ref}
        style={{
          position: 'relative',
          width: STEP_W,
          padding: `${BOX_INSET}px 18px`,
        }}
      >
        {box.w > 0 && box.h > 0 && (
          <>
            {isStart || isEnd ? (
              <RoughCapsuleBox
                width={box.w}
                height={box.h}
                seed={seedFrom(seed, 'step', index)}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.8}
              />
            ) : isDecision ? (
              <RoughDiamondBox
                width={box.w}
                height={box.h}
                seed={seedFrom(seed, 'step', index)}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.8}
              />
            ) : (
              <RoughPlainBox
                width={box.w}
                height={box.h}
                seed={seedFrom(seed, 'step', index)}
                radiusHint={6}
                fill={fill}
                stroke={stroke}
              />
            )}
          </>
        )}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            fontSize: 17,
            lineHeight: `${LINE_H}px`,
          }}
        >
          <CircledNumberBadge
            num={index + 1}
            size={22}
            color={stroke}
            fill={isDecision ? '#ffe883' : isStart ? '#d5e8fc' : isEnd ? '#d5f0d9' : '#eaf2fd'}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Hand text={text} seed={`${seed}-step${index}`} importance={importance} intensity={0.9} />
          </div>
        </div>
      </div>

      {!last && (
        <div style={{ position: 'relative', width: STEP_W, height: LINE_H }}>
          <RoughDownArrow width={STEP_W} height={LINE_H} seed={seedFrom(seed, 'flow', index)} stroke={stroke} />
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
            <Hand text={el.title ?? 'Algorithm Steps'} seed={`${seed}-title`} importance="medium" />
            {continued && <ContdMarker />}
          </div>
        )}

        {steps.map((s, i) => (
          <FlowStep
            key={i}
            text={s}
            seed={seed}
            index={i}
            total={steps.length}
            last={i === steps.length - 1}
            importance={importance}
          />
        ))}
      </div>
    </div>
  );
}
