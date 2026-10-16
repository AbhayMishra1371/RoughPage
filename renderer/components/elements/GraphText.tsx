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
import { getDoodleForKeyword } from '@/lib/handDrawnDoodles';

export default function GraphText({ label, seed }: { label: GraphLabel; seed: string }) {
  const centred = label.align === 'center';
  const doodle = !label.isEdgeLabel && label.size >= 13 ? getDoodleForKeyword(label.text, 15) : null;

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
        zIndex: 2,
        overflow: 'hidden',
        backgroundColor: label.isEdgeLabel ? 'rgba(253, 250, 242, 0.95)' : undefined,
        border: label.isEdgeLabel ? '1px dashed #b8c4d6' : undefined,
        borderRadius: label.isEdgeLabel ? 4 : undefined,
        padding: label.isEdgeLabel ? '0 4px' : undefined,
        boxShadow: label.isEdgeLabel ? '0 1px 2px rgba(0,0,0,0.06)' : undefined,
      }}
    >
      {doodle && <span style={{ marginRight: 4, flexShrink: 0 }}>{doodle}</span>}
      <div style={{ flex: 1, minWidth: 0, textAlign: centred ? 'center' : 'left' }}>
        <Hand
          text={label.text}
          seed={seed}
          importance={label.emphasis ? 'high' : 'medium'}
          // Damped: a wobble tuned for 19px body text looks like a tremor at 12px.
          intensity={0.65}
        />
      </div>
    </div>
  );
}
