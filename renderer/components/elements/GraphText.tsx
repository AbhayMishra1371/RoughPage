'use client';

/**
 * GraphText.tsx
 * =============
 * A label placed over a drawn graph, shared by Diagram and MindMap.
 *
 * Absolutely positioned from coordinates computed in lib/graphLayout.ts, because
 * a graph has no flow for CSS to follow. That makes this the one place in the
 * renderer where text does NOT sit on the ruled lines — which is correct: nobody
 * writing inside a box they just drew lines it up with the paper's ruling. The
 * grid is preserved at the level that matters, by the graph's overall height
 * being a whole number of ruled lines.
 */

import { Hand } from '@/lib/handwriting';
import type { GraphLabel } from '@/lib/graphLayout';

export default function GraphText({ label, seed }: { label: GraphLabel; seed: string }) {
  const centred = label.align === 'center';

  return (
    <div
      style={{
        position: 'absolute',
        left: label.x,
        top: label.y,
        width: label.w,
        height: label.h,
        display: 'flex',
        alignItems: 'center',
        justifyContent: centred ? 'center' : 'flex-start',
        textAlign: centred ? 'center' : 'left',
        fontSize: label.size,
        // Tight leading: these labels live inside drawn boxes, so a two-line one
        // has to fit the box rather than the page's ruling.
        lineHeight: `${Math.round(label.size * 1.25)}px`,
        zIndex: 1,
        overflow: 'hidden',
      }}
    >
      <Hand
        text={label.text}
        seed={seed}
        importance={label.emphasis ? 'high' : 'medium'}
        // Damped: a wobble tuned for 19px body text looks like a tremor at 12px.
        intensity={0.65}
      />
    </div>
  );
}
