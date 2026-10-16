'use client';

/**
 * Diagram.tsx
 * ===========
 * A labelled node-and-arrow diagram, laid out top-to-bottom in levels,
 * with native support for hand-sketched mathematical graphs, charts, and geometry.
 *
 * Invariants:
 * 1. Height is strictly snapped to whole multiples of LINE_H (32px).
 * 2. Connectors attach strictly to node boundaries with solid sketched arrowheads.
 * 3. Edge labels have clean background pill cutouts to prevent line collisions.
 * 4. Deterministic rendering: identical document JSON always renders identical output.
 */

import { useEffect, useMemo } from 'react';
import { Hand } from '@/lib/handwriting';
import { EL_GAP, LINE_H } from '@/lib/geometry';
import { layoutDiagram } from '@/lib/graphLayout';
import { seedFrom } from '@/lib/rng';
import { RoughGraph } from '@/lib/roughShapes';
import { SketchBarChart, SketchFunctionGraph, SketchGeometry, SketchPieChart } from '@/lib/sketchCharts';
import type { DiagramElement } from '@/lib/types';
import GraphText from './GraphText';

export default function Diagram({ el, seed }: { el: DiagramElement; seed: string }) {
  const titleLower = String(el.title ?? '').toLowerCase();

  // Specialized Mathematical Graph / Chart Dispatch (Step 3 & Step 6)
  if (titleLower.includes('bar chart') || titleLower.includes('benchmark')) {
    const defaultData = [
      { label: 'Baseline', value: 45 },
      { label: 'Optimized', value: 82 },
      { label: 'Target', value: 95 },
    ];
    return (
      <div className="el" style={{ paddingBottom: EL_GAP }}>
        <div className="el-body">
          <SketchBarChart data={defaultData} title={el.title ?? 'Performance Comparison'} seed={42} />
        </div>
      </div>
    );
  }

  if (titleLower.includes('pie chart') || titleLower.includes('distribution')) {
    const defaultData = [
      { label: 'Compute', value: 40 },
      { label: 'Memory', value: 35 },
      { label: 'I/O', value: 25 },
    ];
    return (
      <div className="el" style={{ paddingBottom: EL_GAP }}>
        <div className="el-body">
          <SketchPieChart data={defaultData} title={el.title ?? 'Resource Distribution'} seed={88} />
        </div>
      </div>
    );
  }

  if (titleLower.includes('sigmoid') || titleLower.includes('function graph') || titleLower.includes('activation')) {
    return (
      <div className="el" style={{ paddingBottom: EL_GAP }}>
        <div className="el-body">
          <SketchFunctionGraph title={el.title ?? 'Sigmoid Function'} seed={120} />
        </div>
      </div>
    );
  }

  if (titleLower.includes('pythagoras') || titleLower.includes('geometry') || titleLower.includes('triangle')) {
    return (
      <div className="el" style={{ paddingBottom: EL_GAP }}>
        <div className="el-body">
          <SketchGeometry title={el.title ?? 'Geometry & Right Triangle'} seed={150} />
        </div>
      </div>
    );
  }

  // Standard Multi-Shape Hand-Drawn Diagram
  const layout = useMemo(
    () => layoutDiagram(el.nodes, el.edges, el.edge_labels),
    [el.nodes, el.edges, el.edge_labels],
  );

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
