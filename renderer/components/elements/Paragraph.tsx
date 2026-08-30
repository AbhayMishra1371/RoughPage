'use client';

/**
 * Paragraph.tsx
 * =============
 * Plain explanatory prose. The most ordinary thing in a notebook, and the one
 * element that needs no decoration at all: ink on ruled lines, nothing else.
 *
 * ATOMIC ON PURPOSE. It emits no `data-part`, so pagination treats it as
 * unsplittable and moves the whole paragraph to the next page rather than
 * cutting it. Splitting prose would mean measuring individual RENDERED LINES —
 * where a wrap lands is a browser decision, not a data one — and the
 * `head`/`parts` model in paginate.ts has no way to express that. A paragraph
 * longer than a whole page falls through to the existing scale-down-and-warn
 * path, which is the right failure for something the AI should not have emitted.
 */

import { Hand } from '@/lib/handwriting';
import { EL_GAP, LINE_H } from '@/lib/geometry';
import type { ParagraphElement } from '@/lib/types';
import { importanceOf } from '@/lib/types';

export default function Paragraph({ el, seed }: { el: ParagraphElement; seed: string }) {
  const importance = importanceOf(el);

  return (
    <div className="el" style={{ paddingBottom: EL_GAP }}>
      <div
        className="el-body"
        style={{
          fontSize: 19,
          lineHeight: `${LINE_H}px`,
          // A small first-line indent. Not typographic convention — it is what
          // happens when someone starts writing a little way in from the margin.
          textIndent: 15,
        }}
      >
        <Hand text={el.text} seed={`${seed}-para`} importance={importance} />
      </div>
    </div>
  );
}
