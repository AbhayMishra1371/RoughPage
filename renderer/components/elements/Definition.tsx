'use client';

/**
 * Definition.tsx
 * ==============
 * Term + meaning inside a hand-drawn DASHED box. Atomic — never split across a
 * page break, because a drawn box cut in half reads as a rendering bug rather
 * than as a student running out of room.
 */

import { Hand } from '@/lib/handwriting';
import { BOX_INSET, EL_GAP, LINE_H } from '@/lib/geometry';
import { seedFrom } from '@/lib/rng';
import { RoughDashedBox, RoughUnderline } from '@/lib/roughShapes';
import { useBoxSize } from '@/lib/useBoxSize';
import type { DefinitionElement } from '@/lib/types';
import { importanceOf } from '@/lib/types';

export default function Definition({ el, seed }: { el: DefinitionElement; seed: string }) {
  const [ref, box] = useBoxSize<HTMLDivElement>();
  const [termRef, termBox] = useBoxSize<HTMLSpanElement>();
  const importance = importanceOf(el);

  // BOX_INSET above the border + BOX_INSET below it = one whole line, so the
  // text inside starts on a rule while the border sits between two of them.
  return (
    <div className="el" style={{ paddingTop: BOX_INSET, paddingBottom: BOX_INSET + EL_GAP }}>
      <div
        ref={ref}
        style={{
          position: 'relative',
          padding: `${BOX_INSET}px 14px ${BOX_INSET}px 16px`,
        }}
      >
        {box.w > 0 && box.h > 0 && (
          <RoughDashedBox width={box.w} height={box.h} seed={seedFrom(seed, 'defbox')} />
        )}

        <div className="el-body">
          <div style={{ lineHeight: `${LINE_H}px`, fontSize: 20 }}>
            {/*
              The term is an inline-block purely so it can be measured — the
              underline has to be exactly as wide as the word, not as wide as the
              column. Same font size as the row, so baseline alignment keeps it
              inside the LINE_H band (see lib/geometry.ts).
            */}
            <span
              ref={termRef}
              style={{ display: 'inline-block', position: 'relative', fontWeight: 700, color: '#141f52' }}
            >
              <Hand text={el.term} seed={`${seed}-term`} importance="high" />
              {importance === 'high' && (
                <RoughUnderline box={termBox} seed={seedFrom(seed, 'termline')} />
              )}
            </span>
            <span style={{ opacity: 0.6, margin: '0 6px' }}>—</span>
            <Hand text={el.meaning} seed={`${seed}-mean`} importance={importance} />
          </div>

          {el.example && (
            <div
              style={{
                lineHeight: `${LINE_H}px`,
                fontSize: 17,
                paddingLeft: 18,
                opacity: 0.82,
                fontStyle: 'italic',
              }}
            >
              <span style={{ color: '#c0392b', marginRight: 6 }}>e.g.</span>
              <Hand text={el.example} seed={`${seed}-eg`} importance="low" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
