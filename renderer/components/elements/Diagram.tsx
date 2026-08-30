'use client';

/**
 * Diagram.tsx
 * ===========
 * A labelled node-and-arrow diagram, laid out top-to-bottom in levels.
 *
 * ATOMIC. There is no honest place to cut a diagram: the arrows are what carry
 * the meaning, and half a diagram is not half as useful — it is useless. If one
 * will not fit on a page it moves to the next, and if it will not fit on any page
 * the existing scale-down-and-warn path shrinks it.
 *
 * Layout comes from lib/graphLayout.ts. Everything positional is computed there,
 * so this component only places what it is told to — which keeps the tricky part
 * pure and testable, and means the same JSON always produces the same picture.
 */

import { useEffect, useMemo } from 'react';
import { Hand } from '@/lib/handwriting';
import { EL_GAP, LINE_H } from '@/lib/geometry';
import { layoutDiagram } from '@/lib/graphLayout';
import { seedFrom } from '@/lib/rng';
import { RoughGraph } from '@/lib/roughShapes';
import type { DiagramElement } from '@/lib/types';
import GraphText from './GraphText';

export default function Diagram({ el, seed }: { el: DiagramElement; seed: string }) {
  const layout = useMemo(
    () => layoutDiagram(el.nodes, el.edges, el.edge_labels),
    [el.nodes, el.edges, el.edge_labels],
  );

  // Edges naming a node that does not exist are dropped rather than crashing the
  // render — but silently dropping them would hide a real AI mistake.
  useEffect(() => {
    for (const note of layout.notes) console.warn(note);
  }, [layout]);

  return (
    <div className="el" style={{ paddingBottom: EL_GAP }}>
      <div className="el-body">
        {el.title && (
          <div style={{ fontSize: 20, lineHeight: `${LINE_H}px`, color: '#1a2660' }}>
            <Hand text={el.title} seed={`${seed}-title`} importance="medium" />
          </div>
        )}

        <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
          <RoughGraph
            width={layout.width}
            height={layout.height}
            seed={seedFrom(seed, 'diagram')}
            nodes={layout.nodes}
            edges={layout.edges}
          />
          {layout.labels.map((label, i) => (
            <GraphText key={i} label={label} seed={`${seed}-n${i}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
