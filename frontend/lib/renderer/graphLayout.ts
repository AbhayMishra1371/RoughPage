/**
 * graphLayout.ts
 * ==============
 * Node positions for the two element types CSS cannot lay out: `diagram` and
 * `mind_map`.
 *
 * WHY THIS IS A MODULE AND NOT A COMPONENT: everything else in the renderer gets
 * its geometry from the browser — text wraps, boxes measure themselves, the
 * ruled grid does the rest. A graph has no flow to follow. Somebody has to
 * decide that "Encoder" goes above "Latent space" and 130px to the left of
 * "Decoder", and that somebody is this file.
 *
 * PURE: numbers in, numbers out, no DOM and no React. Same input always gives
 * the same layout, which is what keeps the PDF byte-identical across runs.
 *
 * THE ONE INVARIANT THAT MATTERS: the returned `height` is always a whole
 * multiple of LINE_H. A diagram does not sit ON the ruled lines — no drawn box
 * does — but the space it consumes has to be a whole number of lines, or every
 * element after it drifts off the grid. See the vertical rhythm note in
 * lib/geometry.ts.
 */

import { CONTENT_W, LINE_H, snapToLine } from './geometry';
import type { GraphEdgeShape, GraphNodeShape } from './roughShapes';

/** A text label to be absolutely positioned over the drawn graph. */
export interface GraphLabel {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Font size in px. Small — these are cramped by definition. */
  size: number;
  align: 'center' | 'left';
  emphasis?: boolean;
}

export interface GraphLayout {
  width: number;
  height: number;
  nodes: GraphNodeShape[];
  edges: GraphEdgeShape[];
  labels: GraphLabel[];
  /**
   * Non-fatal complaints: edges naming a node that does not exist, a graph
   * clamped for depth, and so on. Surfaced so bad AI output is visible rather
   * than silently dropped.
   */
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

/**
 * Vertical room per level of a diagram.
 *
 * THREE ruled lines, not two, and the reason is the fan-out edge. A box is 44px
 * tall, so two lines (64px) leaves a 20px corridor between one level and the
 * next — enough for a straight arrow between two vertically-aligned boxes, and
 * hopeless for anything else. A parent with two children has to reach ~110px
 * sideways; doing that in 20px of vertical room draws a line 6° off horizontal,
 * which does not read as a connector at all, it reads as a stray streak across
 * the page. Three lines gives a 52px corridor and a ~25° diagonal, which reads
 * as a deliberate stroke and leaves room for the edge label to sit clear of it.
 */
const LEVEL_H = 3 * LINE_H;
const D_NODE_H = 44;
const D_GAP = 16;
const D_NODE_MAX_W = 210;

/**
 * Beyond this many levels the boxes are too short to read, so the layout stops
 * deepening and packs the rest side by side on the last level. A 12-level
 * diagram is an AI mistake, not a note worth rendering faithfully.
 */
const D_MAX_LEVELS = 7;

/**
 * Longest-path levelling.
 *
 * Deliberately NOT a topological sort: `edges` comes from an LLM and can contain
 * a cycle, which would make a real topo sort either throw or silently drop
 * nodes. Relaxing `level[to] = max(level[to], level[from] + 1)` at most |V|
 * times converges on a DAG and saturates harmlessly on a cycle — bounded,
 * deterministic, and every node still gets placed somewhere sensible.
 */
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

  const pairs: [number, number][] = [];
  const rawPairs = Array.isArray(rawEdges) ? rawEdges : [];
  const edgeLabels = clean(rawEdgeLabels);
  /** Index into `edgeLabels` for each kept edge — dropped edges must not shift it. */
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
  });

  const level = levelsOf(names.length, pairs);

  // Group by level, preserving the order the nodes were declared in.
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

    // Siblings are packed as a CENTRED GROUP with a fixed gutter — not given one
    // equal slot each across the full column. Slotting two nodes into a 670px
    // column puts their centres 335px apart, so the edges from their shared
    // parent each have to travel ~170px sideways; halving that to ~113px is the
    // difference between a diagonal and a horizontal smear. It also keeps the
    // whole diagram gathered in the middle of the page, which is where a hand
    // draws it — nobody spreads three boxes to the paper's edges.
    const nodeW = Math.min(
      D_NODE_MAX_W,
      Math.max(70, (width - (ids.length - 1) * D_GAP) / ids.length),
    );
    const groupW = ids.length * nodeW + (ids.length - 1) * D_GAP;
    const x0 = Math.max(0, (width - groupW) / 2);
    const y = row * LEVEL_H + (LEVEL_H - D_NODE_H) / 2;

    ids.forEach((id, i) => {
      const x = x0 + i * (nodeW + D_GAP);
      nodes[id] = { x, y, w: nodeW, h: D_NODE_H, shape: 'box' };
      labels[id] = {
        text: names[id],
        // Inset so a two-line label cannot touch the drawn border.
        x: x + 6,
        y: y + 3,
        w: nodeW - 12,
        h: D_NODE_H - 6,
        size: nodeW < 110 ? 12.5 : 14,
        align: 'center',
      };
    });
  });

  // Edges connect box EDGES, not centres, so the stroke starts where the drawn
  // outline is instead of disappearing under the label.
  const edges: GraphEdgeShape[] = [];
  const edgeLabelOut: GraphLabel[] = [];

  pairs.forEach(([a, b], i) => {
    const na = nodes[a];
    const nb = nodes[b];
    if (!na || !nb) return;

    const downward = nb.y > na.y + 1;
    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;

    if (downward) {
      x1 = na.x + na.w / 2;
      y1 = na.y + na.h;
      x2 = nb.x + nb.w / 2;
      y2 = nb.y;
    } else if (nb.y < na.y - 1) {
      // A back-edge (a cycle, or an LLM listing an edge in reverse).
      x1 = na.x + na.w / 2;
      y1 = na.y;
      x2 = nb.x + nb.w / 2;
      y2 = nb.y + nb.h;
    } else {
      // Same level — go sideways, from the nearer faces.
      const leftFirst = na.x <= nb.x;
      x1 = leftFirst ? na.x + na.w : na.x;
      x2 = leftFirst ? nb.x : nb.x + nb.w;
      y1 = na.y + na.h / 2;
      y2 = nb.y + nb.h / 2;
    }

    // A straight drop between two aligned boxes is drawn straight, because that
    // is what a hand does with a short vertical flick. A diagonal gets a bow —
    // also what a hand does — and now that the corridor is 52px the bow has room
    // to be seen instead of flattening against the boxes above and below.
    edges.push({ x1, y1, x2, y2, arrow: true, curve: Math.abs(x2 - x1) > 24 });

    const text = edgeLabels[labelIndexFor[i]];
    if (text) {
      edgeLabelOut.push({
        text,
        // Nudged off the line so the stroke does not run through the words.
        x: (x1 + x2) / 2 + 6,
        y: (y1 + y2) / 2 - 9,
        w: 96,
        h: 18,
        size: 11.5,
        align: 'left',
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

// ── Mind map: a hub with spokes left and right ───────────────────────────────

const M_SIDE_W = 224;
const M_GUTTER = 20;
const M_BRANCH_H = 36;
const M_SUB_H = 22;
/** Vertical breathing room between one branch block and the next. */
const M_BLOCK_GAP = 14;
const M_HUB_H = 58;

/**
 * WHY NOT A TRUE RADIAL LAYOUT: a mind map drawn on a circle needs roughly as
 * much width as height, and this page is a 670px column. Spokes at 45° either
 * run off the paper or shrink the labels to nothing.
 *
 * So: a hub in the middle with branches stacked up the left and right sides,
 * alternating. It is what a student actually ends up drawing once they hit the
 * edge of the page, it reads unmistakably as a mind map, and every label gets a
 * full 224px to wrap in.
 */
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

  // Alternate right, left, right… so the two columns stay balanced.
  const right: string[] = [];
  const left: string[] = [];
  branches.forEach((b, i) => (i % 2 === 0 ? right : left).push(b));

  const blockH = (name: string) =>
    M_BRANCH_H + subsOf(name).length * M_SUB_H + M_BLOCK_GAP;

  const colH = (col: string[]) => col.reduce((a, n) => a + blockH(n), 0);
  const contentH = Math.max(colH(left), colH(right), M_HUB_H + LINE_H);
  const height = snapToLine(contentH + M_BLOCK_GAP);

  const hubW = Math.max(120, width - 2 * (M_SIDE_W + M_GUTTER));
  const hubX = M_SIDE_W + M_GUTTER;
  const hubY = (height - M_HUB_H) / 2;

  const nodes: GraphNodeShape[] = [];
  const labels: GraphLabel[] = [];
  const edges: GraphEdgeShape[] = [];

  // The hub, drawn as an emphasised blob rather than a box.
  nodes.push({ x: hubX, y: hubY, w: hubW, h: M_HUB_H, shape: 'ellipse', emphasis: true });
  labels.push({
    text: hubText,
    // An ellipse loses its corners, so the label gets a wider inset than a box
    // would need or the first and last words clip against the curve.
    x: hubX + 16,
    y: hubY + 6,
    w: hubW - 32,
    h: M_HUB_H - 12,
    size: hubText.length > 24 ? 14 : 16.5,
    align: 'center',
    emphasis: true,
  });

  const placeColumn = (col: string[], side: 'left' | 'right') => {
    const total = colH(col);
    let y = Math.max(0, (height - total) / 2);
    const x = side === 'left' ? 0 : width - M_SIDE_W;

    for (const name of col) {
      nodes.push({ x, y, w: M_SIDE_W, h: M_BRANCH_H, shape: 'box' });
      labels.push({
        text: name,
        x: x + 8,
        y: y + 2,
        w: M_SIDE_W - 16,
        h: M_BRANCH_H - 4,
        size: 14,
        align: 'center',
      });

      // The spoke, from the hub's side to this branch's inner face.
      edges.push({
        x1: side === 'left' ? hubX : hubX + hubW,
        y1: hubY + M_HUB_H / 2,
        x2: side === 'left' ? x + M_SIDE_W : x,
        y2: y + M_BRANCH_H / 2,
        curve: true,
      });

      subsOf(name).forEach((sub, si) => {
        labels.push({
          text: `– ${sub}`,
          x: x + 16,
          y: y + M_BRANCH_H + si * M_SUB_H,
          w: M_SIDE_W - 20,
          h: M_SUB_H,
          size: 12.5,
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
