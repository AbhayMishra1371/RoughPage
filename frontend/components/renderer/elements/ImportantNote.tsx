'use client';

/**
 * ImportantNote.tsx
 * =================
 * The "don't miss this" callout: red double-struck box, star, red-tinted ink.
 * Atomic. The schema caps these at 2 per topic group, so they stay loud.
 */

import { Hand } from '@/lib/handwriting';
import { BOX_INSET, EL_GAP, LINE_H } from '@/lib/geometry';
import { rngFrom, jitterSoft, seedFrom } from '@/lib/rng';
import { RoughRedBox, RoughStar } from '@/lib/roughShapes';
import { useBoxSize } from '@/lib/useBoxSize';
import type { ImportantNoteElement } from '@/lib/types';

export default function ImportantNote({
  el,
  seed,
}: {
  el: ImportantNoteElement;
  seed: string;
}) {
  const [ref, box] = useBoxSize<HTMLDivElement>();
  const rng = rngFrom(seed, 'note');

  return (
    <div className="el" style={{ paddingTop: BOX_INSET, paddingBottom: BOX_INSET + EL_GAP }}>
      <div
        ref={ref}
        style={{
          position: 'relative',
          padding: `${BOX_INSET}px 16px ${BOX_INSET}px 14px`,
        }}
      >
        {box.w > 0 && box.h > 0 && (
          <RoughRedBox width={box.w} height={box.h} seed={seedFrom(seed, 'redbox')} />
        )}

        <div
          className="el-body"
          style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
        >
          {/*
            Drawn, not typed. `★` is absent from Kalam and used to arrive from a
            system symbol font — see the note in lib/roughShapes.tsx. A
            fixed-size flex item, so it cannot enlarge the row.
          */}
          <span
            style={{
              flex: '0 0 auto',
              position: 'relative',
              width: 22,
              height: LINE_H,
              transform: `rotate(${jitterSoft(rng, 9).toFixed(2)}deg)`,
            }}
          >
            <RoughStar seed={seedFrom(seed, 'star')} stroke="#c0392b" />
          </span>
          <span
            style={{
              flex: 1,
              fontSize: 20,
              lineHeight: `${LINE_H}px`,
              fontWeight: 700,
              color: '#8e2b20',
            }}
          >
            <Hand text={el.text} seed={`${seed}-t`} importance="high" intensity={1.15} />
          </span>
        </div>
      </div>
    </div>
  );
}
