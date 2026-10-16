/**
 * graphLayout.ts
 * ==============
 * Node positions and edge routing for diagrams and mind maps.
 *
 * Designed for hand-drawn academic notebooks:
 * 1. Semantic shape classification (capsule for terminals, cylinder for databases,
 *    diamond for decisions, process box with sketch shadow for computations).
 * 2. Exact perimeter intersection for smooth, natural connector attachments.
 * 3. Color-coordinated topic groupings for mind maps.
 * 4. PURE: deterministic coordinates, guaranteed whole-multiple LINE_H height snapping.
 */

import { CONTENT_W, LINE_H, snapToLine } from './geometry';
import {
  PALETTE,
  TOPIC_PALETTES,
  intersectDiamondPerimeter,
  intersectEllipsePerimeter,
  intersectRectPerimeter,
} from './handDrawnStyle';
import type { GraphEdgeShape, GraphNodeShape } from './roughShapes';

/** A text label to be absolutely positioned over the drawn graph. */
export interface GraphLabel {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Font size in px. */
  size: number;
  align: 'center' | 'left';
  emphasis?: boolean;
  isEdgeLabel?: boolean;
}

export interface GraphLayout {
  width: number;
  height: number;
  nodes: GraphNodeShape[];
  edges: GraphEdgeShape[];
  labels: GraphLabel[];
  notes: string[];
}

const EMPTY: GraphLayout = {
  width: CONTENT_W,
  height: LINE_H,
  nodes: [],
  edges: [],
  labels: [],
  notes: [],
};

function clean(xs: unknown): string[] {
  if (!Array.isArray(xs)) return [];
  return xs.map((x) => String(x ?? '').trim()).filter(Boolean);
}

// ── Diagram: layered top-to-bottom ──────────────────────────────────────────

const LEVEL_H = 3 * LINE_H; // 96px
const D_NODE_H = 44;
const D_GAP = 18;
const D_NODE_MAX_W = 210;
const D_MAX_LEVELS = 7;

function levelsOf(count: number, edges: [number, number][]): number[] {
  const level = new Array<number>(count).fill(0);
  for (let pass = 0; pass < count; pass++) {
    let moved = false;
    for (const [a, b] of edges) {
      const want = Math.min(level[a] + 1, D_MAX_LEVELS - 1);
      if (want > level[b]) {
        level[b] = want;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return level;
}

/** Determines the visual shape and pastel wash of a node based on its name and role */
function classifyNode(
  name: string,
  isRoot: boolean,
  isLeaf: boolean,
  colorIdx: number,
): {
  shape: GraphNodeShape['shape'];
  fill: string;
  stroke: string;
} {
  const s = name.toLowerCase();

  if (s.includes('?') || s.includes('if ') || s.includes('check') || s.includes('condition')) {
    return { shape: 'diamond', fill: PALETTE.washYellow, stroke: PALETTE.inkAmber };
  }
  if (s.includes('db') || s.includes('database') || s.includes('storage') || s.includes('sql') || s.includes('table')) {
    return { shape: 'cylinder', fill: PALETTE.washTeal, stroke: PALETTE.inkTeal };
  }
  if (isRoot || isLeaf || s.includes('input') || s.includes('output') || s.includes('start') || s.includes('end')) {
    const pal = TOPIC_PALETTES[colorIdx % TOPIC_PALETTES.length];
    return { shape: 'capsule', fill: pal.fill, stroke: pal.stroke };
  }
  if (s.includes('encoder') || s.includes('decoder') || s.includes('attention') || s.includes('model') || s.includes('latent') || s.includes('layer')) {
    return { shape: 'process', fill: PALETTE.washBlue, stroke: PALETTE.ink };
  }

  return { shape: 'box', fill: '#ffffff', stroke: PALETTE.ink };
}

export function layoutDiagram(
  rawNodes: unknown,
  rawEdges: unknown,
  rawEdgeLabels: unknown,
  width = CONTENT_W,
): GraphLayout {
  const names = Array.from(new Set(clean(rawNodes)));
  if (names.length === 0) return EMPTY;

  const notes: string[] = [];
  const indexOf = new Map(names.map((n, i) => [n, i]));

  const inDegree = new Array<number>(names.length).fill(0);
  const outDegree = new Array<number>(names.length).fill(0);

  const pairs: [number, number][] = [];
  const rawPairs = Array.isArray(rawEdges) ? rawEdges : [];
  const edgeLabels = clean(rawEdgeLabels);
  const labelIndexFor: number[] = [];

  rawPairs.forEach((e, i) => {
    if (!Array.isArray(e) || e.length < 2) return;
    const a = indexOf.get(String(e[0] ?? '').trim());
    const b = indexOf.get(String(e[1] ?? '').trim());
    if (a === undefined || b === undefined) {
      notes.push(`diagram: edge ${JSON.stringify(e)} names a node not in \`nodes\` — dropped.`);
      return;
    }
    if (a === b) return;
    pairs.push([a, b]);
    labelIndexFor.push(i);
    outDegree[a]++;
    inDegree[b]++;
  });

  const level = levelsOf(names.length, pairs);

  // Group by level
  const byLevel = new Map<number, number[]>();
  names.forEach((_, i) => {
    const l = level[i];
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l)!.push(i);
  });
  const levelKeys = Array.from(byLevel.keys()).sort((a, b) => a - b);

  const nodes: GraphNodeShape[] = new Array(names.length);
  const labels: GraphLabel[] = new Array(names.length);

  levelKeys.forEach((l, row) => {
    const ids = byLevel.get(l)!;

    const nodeW = Math.min(
      D_NODE_MAX_W,
      Math.max(76, (width - (ids.length - 1) * D_GAP) / ids.length),
    );
    const groupW = ids.length * nodeW + (ids.length - 1) * D_GAP;
    const x0 = Math.max(0, (width - groupW) / 2);
    const y = row * LEVEL_H + (LEVEL_H - D_NODE_H) / 2;

    ids.forEach((id, i) => {
      const x = x0 + i * (nodeW + D_GAP);
      const isRoot = inDegree[id] === 0 && outDegree[id] > 0;
      const isLeaf = inDegree[id] > 0 && outDegree[id] === 0;

      const classification = classifyNode(names[id], isRoot, isLeaf, id);

      nodes[id] = {
        x,
        y,
        w: nodeW,
        h: D_NODE_H,
        shape: classification.shape,
        fill: classification.fill,
        stroke: classification.stroke,
        emphasis: isRoot || isLeaf,
      };

      labels[id] = {
        text: names[id],
        x: x + 8,
        y: y + 3,
        w: nodeW - 16,
        h: D_NODE_H - 6,
        size: nodeW < 110 ? 12.5 : 14,
        align: 'center',
        emphasis: isRoot || isLeaf,
      };
    });
  });

  // Accurate edge routing with boundary intersection
  const edges: GraphEdgeShape[] = [];
  const edgeLabelOut: GraphLabel[] = [];

  pairs.forEach(([a, b], i) => {
    const na = nodes[a];
    const nb = nodes[b];
    if (!na || !nb) return;

    const centerA = { x: na.x + na.w / 2, y: na.y + na.h / 2 };
    const centerB = { x: nb.x + nb.w / 2, y: nb.y + nb.h / 2 };

    // Intersection from na to nb
    let p1 = intersectRectPerimeter(na, centerB);
    if (na.shape === 'ellipse' || na.shape === 'capsule') {
      p1 = intersectEllipsePerimeter(na, centerB);
    } else if (na.shape === 'diamond') {
      p1 = intersectDiamondPerimeter(na, centerB);
    }

    // Intersection from nb to na
    let p2 = intersectRectPerimeter(nb, centerA);
    if (nb.shape === 'ellipse' || nb.shape === 'capsule') {
      p2 = intersectEllipsePerimeter(nb, centerA);
    } else if (nb.shape === 'diamond') {
      p2 = intersectDiamondPerimeter(nb, centerA);
    }

    const isDownward = nb.y > na.y + 1;
    const isCurved = isDownward ? Math.abs(p2.x - p1.x) > 28 : true;

    edges.push({
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      arrow: true,
      curve: isCurved,
      stroke: na.stroke || PALETTE.ink,
    });

    const text = edgeLabels[labelIndexFor[i]];
    if (text) {
      // Calculate label midpoint with clearance
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const labelW = Math.min(110, Math.max(50, text.length * 7.5 + 16));

      edgeLabelOut.push({
        text,
        x: midX - labelW / 2,
        y: midY - 10,
        w: labelW,
        h: 20,
        size: 11.5,
        align: 'center',
        isEdgeLabel: true,
      });
    }
  });

  return {
    width,
    height: snapToLine(levelKeys.length * LEVEL_H),
    nodes,
    edges,
    labels: [...labels.filter(Boolean), ...edgeLabelOut],
    notes,
  };
}

// ── Mind map: an organic central hub with colored branch groups ─────────────

const M_SIDE_W = 224;
const M_GUTTER = 24;
const M_BRANCH_H = 38;
const M_SUB_H = 24;
const M_BLOCK_GAP = 16;
const M_HUB_H = 62;

export function layoutMindMap(
  center: unknown,
  rawBranches: unknown,
  rawSubs: unknown,
  width = CONTENT_W,
): GraphLayout {
  const hubText = String(center ?? '').trim();
  const branches = clean(rawBranches);
  if (!hubText && branches.length === 0) return EMPTY;

  const subsOf = (name: string): string[] => {
    if (!rawSubs || typeof rawSubs !== 'object') return [];
    const v = (rawSubs as Record<string, unknown>)[name];
    return clean(v);
  };

  // Alternate right, left, right...
  const right: string[] = [];
  const left: string[] = [];
  branches.forEach((b, i) => (i % 2 === 0 ? right : left).push(b));

  const blockH = (name: string) =>
    M_BRANCH_H + subsOf(name).length * M_SUB_H + M_BLOCK_GAP;

  const colH = (col: string[]) => col.reduce((a, n) => a + blockH(n), 0);
  const contentH = Math.max(colH(left), colH(right), M_HUB_H + LINE_H);
  const height = snapToLine(contentH + M_BLOCK_GAP);

  const hubW = Math.max(130, width - 2 * (M_SIDE_W + M_GUTTER));
  const hubX = M_SIDE_W + M_GUTTER;
  const hubY = (height - M_HUB_H) / 2;

  const nodes: GraphNodeShape[] = [];
  const labels: GraphLabel[] = [];
  const edges: GraphEdgeShape[] = [];

  // 1. Central Hub with warm highlighter fill and double-retrace
  nodes.push({
    x: hubX,
    y: hubY,
    w: hubW,
    h: M_HUB_H,
    shape: 'capsule',
    fill: PALETTE.washYellow,
    stroke: PALETTE.inkAmber,
    emphasis: true,
  });

  labels.push({
    text: hubText,
    x: hubX + 14,
    y: hubY + 6,
    w: hubW - 28,
    h: M_HUB_H - 12,
    size: hubText.length > 24 ? 14 : 16.5,
    align: 'center',
    emphasis: true,
  });

  // 2. Branches with color-coordinated topic palettes
  let branchIdx = 0;

  const placeColumn = (col: string[], side: 'left' | 'right') => {
    const total = colH(col);
    let y = Math.max(0, (height - total) / 2);
    const x = side === 'left' ? 0 : width - M_SIDE_W;

    for (const name of col) {
      const palette = TOPIC_PALETTES[branchIdx % TOPIC_PALETTES.length];
      branchIdx++;

      nodes.push({
        x,
        y,
        w: M_SIDE_W,
        h: M_BRANCH_H,
        shape: 'process',
        fill: palette.fill,
        stroke: palette.stroke,
      });

      labels.push({
        text: name,
        x: x + 10,
        y: y + 2,
        w: M_SIDE_W - 20,
        h: M_BRANCH_H - 4,
        size: 14.5,
        align: 'center',
        emphasis: true,
      });

      // Spoke connecting hub to branch with matching topic ink
      edges.push({
        x1: side === 'left' ? hubX : hubX + hubW,
        y1: hubY + M_HUB_H / 2,
        x2: side === 'left' ? x + M_SIDE_W : x,
        y2: y + M_BRANCH_H / 2,
        curve: true,
        stroke: palette.stroke,
      });

      // Sub-branches with organic leaf indicators
      subsOf(name).forEach((sub, si) => {
        labels.push({
          text: `• ${sub}`,
          x: x + (side === 'left' ? 16 : 20),
          y: y + M_BRANCH_H + si * M_SUB_H + 2,
          w: M_SIDE_W - 24,
          h: M_SUB_H,
          size: 13,
          align: 'left',
        });
      });

      y += blockH(name);
    }
  };

  placeColumn(right, 'right');
  placeColumn(left, 'left');

  return { width, height, nodes, edges, labels, notes: [] };
}
