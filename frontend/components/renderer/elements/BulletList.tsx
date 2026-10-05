'use client';

/**
 * BulletList.tsx
 * ==============
 * Arrow-bulleted list. Splittable across pages at row boundaries, so every row
 * carries `data-part` for the measure pass to read exact per-row heights, and
 * the header carries `data-head`.
 */

import { Hand } from '@/lib/handwriting';
import { EL_GAP, LINE_H } from '@/lib/geometry';
import { rngFrom, jitterSoft, seedFrom } from '@/lib/rng';
import { RoughArrowBullet, RoughUnderline } from '@/lib/roughShapes';
import { useBoxSize } from '@/lib/useBoxSize';
import type { BulletListElement } from '@/lib/types';
import { importanceOf } from '@/lib/types';
import ContdMarker from './ContdMarker';

export default function BulletList({
  el,
  seed,
  continued,
}: {
  el: BulletListElement;
  seed: string;
  continued?: boolean;
}) {
  const importance = importanceOf(el);
  const items = el.items ?? [];
  const rng = rngFrom(seed, 'bullets');
  const [titleRef, titleBox] = useBoxSize<HTMLSpanElement>();

  // No paddingTop: the title must start exactly on a ruled line. The blank line
  // of separation comes from the PREVIOUS element's paddingBottom.
  return (
    <div className="el" style={{ paddingBottom: EL_GAP }}>
      <div className="el-body">
        {el.title && (
          <div
            data-head="1"
            style={{
              fontSize: 21,
              fontWeight: 700,
              lineHeight: `${LINE_H}px`,
              color: '#1a2660',
            }}
          >
            {/*
              Inline-block so the title can be measured: a high-importance list
              gets its title underlined, and the line must be as wide as the
              title, not as wide as the column. "(contd.)" stays outside it — a
              student underlines the heading, not their own margin note.
            */}
            <span ref={titleRef} style={{ display: 'inline-block', position: 'relative' }}>
              <Hand text={el.title} seed={`${seed}-title`} importance="medium" />
              {importance === 'high' && (
                <RoughUnderline box={titleBox} seed={seedFrom(seed, 'titleline')} />
              )}
            </span>
            {continued && <ContdMarker />}
          </div>
        )}

        {items.map((item, i) => (
          <div
            key={i}
            data-part={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              lineHeight: `${LINE_H}px`,
              paddingLeft: 6,
            }}
          >
            {/*
              Drawn, not typed. `→` is absent from Kalam, so it used to be
              supplied by a system font — see the note in lib/roughShapes.tsx.
              A fixed-size FLEX ITEM, so it cannot disturb the row's line box.
            */}
            <span
              style={{
                flex: '0 0 auto',
                position: 'relative',
                width: 17,
                height: LINE_H,
                transform: `translateY(${jitterSoft(rng, 1.1).toFixed(2)}px)`,
              }}
            >
              <RoughArrowBullet seed={seedFrom(seed, `arrow${i}`)} />
            </span>
            <span style={{ flex: 1, fontSize: 19 }}>
              <Hand text={item} seed={`${seed}-i${i}`} importance={importance} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
