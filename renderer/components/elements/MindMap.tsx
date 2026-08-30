'use client';

/**
 * MindMap.tsx
 * ===========
 * A central idea with branches spoking off it, sub-points hanging under each.
 *
 * ATOMIC, for the same reason as Diagram: the hub is the element. A fragment
 * containing three branches and no centre is not a mind map.
 *
 * The layout is a hub in the middle with branches stacked up the left and right
 * sides rather than a true radial fan — see the note in lib/graphLayout.ts about
 * why a circle does not fit a 670px column.
 */

import { useMemo } from 'react';
import { EL_GAP } from '@/lib/geometry';
import { layoutMindMap } from '@/lib/graphLayout';
import { seedFrom } from '@/lib/rng';
import { RoughGraph } from '@/lib/roughShapes';
import type { MindMapElement } from '@/lib/types';
import GraphText from './GraphText';

export default function MindMap({ el, seed }: { el: MindMapElement; seed: string }) {
  const layout = useMemo(
    () => layoutMindMap(el.center, el.branches, el.sub_branches),
    [el.center, el.branches, el.sub_branches],
  );

  return (
    <div className="el" style={{ paddingBottom: EL_GAP }}>
      <div className="el-body">
        <div style={{ position: 'relative', width: layout.width, height: layout.height }}>
          <RoughGraph
            width={layout.width}
            height={layout.height}
            seed={seedFrom(seed, 'mindmap')}
            nodes={layout.nodes}
            edges={layout.edges}
          />
          {layout.labels.map((label, i) => (
            <GraphText key={i} label={label} seed={`${seed}-m${i}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
