'use client';

/**
 * Example.tsx
 * ===========
 * A worked example: the setup, then how it plays out.
 *
 * The "e.g." tag is a FLEX ITEM, not an inline span. At 15px next to 19px body
 * text an inline tag would inflate the shared line box by a couple of pixels and
 * knock the row off the ruled grid — see the vertical rhythm note in
 * lib/geometry.ts. Flex rows are immune to that, which is why every mixed-size
 * row in this codebase is one.
 *
 * Two rows and no `data-part`, so it is atomic. Nothing is gained by cutting a
 * two-line example in half.
 */

import { Hand } from '@/lib/handwriting';
import { EL_GAP, INK_RED, LINE_H } from '@/lib/geometry';
import type { ExampleElement } from '@/lib/types';
import { importanceOf } from '@/lib/types';

export default function Example({ el, seed }: { el: ExampleElement; seed: string }) {
  const importance = importanceOf(el);

  return (
    <div className="el" style={{ paddingBottom: EL_GAP }}>
      <div className="el-body">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: `${LINE_H}px` }}>
          <span
            style={{
              flex: '0 0 auto',
              fontSize: 15,
              color: INK_RED,
              fontStyle: 'italic',
              letterSpacing: '0.03em',
            }}
          >
            e.g.
          </span>
          <span style={{ flex: 1, fontSize: 19 }}>
            <Hand text={el.context} seed={`${seed}-ctx`} importance={importance} />
          </span>
        </div>

        {el.walkthrough && (
          <div
            style={{
              // Lines up under the context text rather than under the tag, so
              // the whole example reads as one indented aside.
              paddingLeft: 38,
              fontSize: 17.5,
              lineHeight: `${LINE_H}px`,
              opacity: 0.92,
            }}
          >
            <Hand text={el.walkthrough} seed={`${seed}-walk`} importance="low" intensity={0.9} />
          </div>
        )}
      </div>
    </div>
  );
}
