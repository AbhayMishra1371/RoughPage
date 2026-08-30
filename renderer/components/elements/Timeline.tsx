'use client';

/**
 * Timeline.tsx
 * ============
 * Events down a drawn vertical spine, each marked with a hollow ring.
 *
 * SPLITTABLE AT EVENT BOUNDARIES, and the spine is drawn PER EVENT rather than
 * as one long line for the same reason the comparison table is drawn per row: a
 * single stroke spanning the whole element could not survive a page break. Each
 * segment runs the full height of its own row and overruns the top by a pixel, so
 * consecutive segments overlap into what looks like one continuous line — and a
 * fragment on a new page brings its own spine with it.
 */

import { Hand } from '@/lib/handwriting';
import { EL_GAP, LINE_H } from '@/lib/geometry';
import { seedFrom } from '@/lib/rng';
import { RoughSpineSegment } from '@/lib/roughShapes';
import { useBoxSize } from '@/lib/useBoxSize';
import type { Importance, TimelineElement, TimelineEvent } from '@/lib/types';
import { importanceOf } from '@/lib/types';
import ContdMarker from './ContdMarker';

/** The gutter the spine runs down, and where in it the line sits. */
const SPINE_W = 34;
const SPINE_X = 14;
/** Centre of the first line of the row — where this event's ring goes. */
const DOT_Y = 16;

function Event({
  ev,
  seed,
  index,
  last,
  importance,
}: {
  ev: TimelineEvent;
  seed: string;
  index: number;
  last: boolean;
  importance: Importance;
}) {
  const [ref, box] = useBoxSize<HTMLDivElement>();

  const label = String(ev?.label ?? '').trim();
  const description = String(ev?.description ?? '').trim();

  return (
    <div
      ref={ref}
      data-part={index}
      style={{ display: 'flex', alignItems: 'stretch', position: 'relative' }}
    >
      <div style={{ flex: '0 0 auto', width: SPINE_W, position: 'relative' }}>
        {box.h > 0 && (
          <RoughSpineSegment
            width={SPINE_W}
            height={box.h}
            seed={seedFrom(seed, 'spine', index)}
            x={SPINE_X}
            dotY={DOT_Y}
            last={last}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {label && (
          <div
            style={{
              fontSize: 18,
              lineHeight: `${LINE_H}px`,
              fontWeight: 700,
              color: '#141f52',
            }}
          >
            <Hand text={label} seed={`${seed}-lab${index}`} importance="medium" intensity={0.8} />
          </div>
        )}
        {description && (
          <div style={{ fontSize: 17, lineHeight: `${LINE_H}px`, opacity: 0.92 }}>
            <Hand
              text={description}
              seed={`${seed}-desc${index}`}
              importance={importance === 'high' ? 'medium' : 'low'}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Timeline({
  el,
  seed,
  continued,
}: {
  el: TimelineElement;
  seed: string;
  continued?: boolean;
}) {
  const importance = importanceOf(el);
  const events = (el.events ?? []).filter(
    (e) => e && (String(e.label ?? '').trim() || String(e.description ?? '').trim()),
  );

  return (
    <div className="el" style={{ paddingBottom: EL_GAP }}>
      <div className="el-body">
        {(el.title || continued) && (
          <div
            data-head="1"
            style={{ fontSize: 20, lineHeight: `${LINE_H}px`, color: '#1a2660' }}
          >
            <Hand text={el.title ?? 'Timeline'} seed={`${seed}-title`} importance="medium" />
            {continued && <ContdMarker />}
          </div>
        )}

        {events.map((ev, i) => (
          <Event
            key={i}
            ev={ev}
            seed={seed}
            index={i}
            last={i === events.length - 1}
            importance={importance}
          />
        ))}
      </div>
    </div>
  );
}
