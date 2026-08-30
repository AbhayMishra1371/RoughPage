'use client';

/**
 * Summary.tsx
 * ===========
 * End-of-topic recap: a hand-drawn divider, a small label, then the takeaways.
 * Splittable at row boundaries, so each point carries `data-part` and the
 * divider/label block carries `data-head`.
 *
 * The divider gets a whole ruled line of its own rather than a 12px sliver.
 * That sliver was what pushed every point below it into the gaps between rules
 * instead of onto them — see the vertical rhythm note in lib/geometry.ts.
 */

import { Hand } from '@/lib/handwriting';
import { CONTENT_W, EL_GAP, LINE_H } from '@/lib/geometry';
import { seedFrom } from '@/lib/rng';
import { RoughDivider } from '@/lib/roughShapes';
import type { SummaryElement } from '@/lib/types';
import ContdMarker from './ContdMarker';

export default function Summary({
  el,
  seed,
  continued,
}: {
  el: SummaryElement;
  seed: string;
  continued?: boolean;
}) {
  const points = el.points ?? [];

  return (
    <div className="el" style={{ paddingBottom: EL_GAP }}>
      <div className="el-body">
        <div data-head="1">
          <div style={{ position: 'relative', height: LINE_H }}>
            {/* Drawn low in its line, so it reads as ruling off the section
                above rather than underlining the label below. */}
            <div style={{ position: 'absolute', left: 0, top: 14, width: CONTENT_W, height: 12 }}>
              <RoughDivider width={CONTENT_W} seed={seedFrom(seed, 'div')} />
            </div>
          </div>
          <div
            style={{
              fontSize: 16,
              lineHeight: `${LINE_H}px`,
              color: '#c0392b',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <Hand text="In short" seed={`${seed}-lbl`} intensity={0.5} />
            {continued && <ContdMarker />}
          </div>
        </div>

        {points.map((p, i) => (
          <div
            key={i}
            data-part={i}
            style={{
              display: 'flex',
              gap: 8,
              fontSize: 17,
              lineHeight: `${LINE_H}px`,
              paddingLeft: 6,
              opacity: 0.9,
            }}
          >
            <span style={{ flex: '0 0 auto', color: '#7c86ad' }}>{i + 1}.</span>
            <span style={{ flex: 1 }}>
              <Hand text={p} seed={`${seed}-p${i}`} intensity={0.85} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
