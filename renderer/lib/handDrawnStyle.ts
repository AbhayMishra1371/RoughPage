/**
 * handDrawnStyle.ts
 * =================
 * Shared hand-drawn styling system, palettes, sketch parameters, and
 * geometric connector helpers for RoughPage AI.
 *
 * Invariants:
 * 1. Fully deterministic: all variation derives from seed-based pseudo-randomness.
 * 2. Ink & Wash Palette: Authentic ballpoint blues, terracotta red, and muted pastel washes.
 * 3. Exact boundary intersection: Connectors attach strictly to node perimeters.
 */

import { INK, INK_RED, PAPER, STICKY_YELLOW } from './geometry';

// ── 1. Color Palette ────────────────────────────────────────────────────────

export const PALETTE = {
  // Primary pen inks
  ink: INK,               // #1c2b6b Deep ballpoint blue-black
  inkPressed: '#141f52',  // Heavy pressure
  inkLight: '#324585',    // Light flick
  inkRed: INK_RED,        // #c0392b Urgent correction pen
  inkTeal: '#1b6b65',     // Academic accent teal
  inkPurple: '#5c2d7a',   // Structure purple
  inkAmber: '#9c5814',    // Warm study notes amber
  inkPencil: '#3a3a3c',   // Soft graphite pencil

  // Paper & highlights
  paper: PAPER,           // #fdfaf2
  stickyYellow: STICKY_YELLOW, // #ffe883
  stickyYellowBorder: '#e0c65a',

  // Soft highlighter washes (water-based markers on notebook paper)
  washYellow: '#fff9d6',
  washYellowDark: '#f5e392',
  washBlue: '#e8f2fe',
  washBlueDark: '#b9d5f7',
  washGreen: '#eaf6ec',
  washGreenDark: '#bde2c4',
  washCoral: '#fdeeed',
  washCoralDark: '#f7c5c2',
  washPurple: '#f4edfa',
  washPurpleDark: '#dac3ed',
  washTeal: '#e5f6f4',
  washTealDark: '#b2e2de',

  // Washi tape & pin accents
  tapeColor: 'rgba(235, 225, 195, 0.72)',
  tapePattern: '#b3a078',
  pinRed: '#e74c3c',
  pinHead: '#c0392b',
} as const;

// Color families for mind maps, categorical groups, and charts
export const TOPIC_PALETTES = [
  { stroke: PALETTE.inkTeal, fill: PALETTE.washTeal, dark: PALETTE.washTealDark, name: 'teal' },
  { stroke: PALETTE.inkAmber, fill: PALETTE.washYellow, dark: PALETTE.washYellowDark, name: 'amber' },
  { stroke: PALETTE.inkPurple, fill: PALETTE.washPurple, dark: PALETTE.washPurpleDark, name: 'purple' },
  { stroke: PALETTE.ink, fill: PALETTE.washBlue, dark: PALETTE.washBlueDark, name: 'blue' },
  { stroke: PALETTE.inkRed, fill: PALETTE.washCoral, dark: PALETTE.washCoralDark, name: 'coral' },
  { stroke: '#2e7d32', fill: PALETTE.washGreen, dark: PALETTE.washGreenDark, name: 'green' },
] as const;

export function getTopicPalette(index: number) {
  return TOPIC_PALETTES[Math.abs(index) % TOPIC_PALETTES.length];
}

// ── 2. Rough.js Tuning Presets ──────────────────────────────────────────────

export const ROUGH_PRESETS = {
  // Delicate handwriting rule or subtle leader line
  penFlick: {
    strokeWidth: 1.2,
    roughness: 1.2,
    bowing: 1.4,
  },
  // Main diagram node box
  nodeBox: {
    strokeWidth: 1.5,
    roughness: 1.35,
    bowing: 1.3,
  },
  // Emphasized / Start-End node
  emphasizedBox: {
    strokeWidth: 2.0,
    roughness: 1.5,
    bowing: 1.8,
  },
  // Soft sketch cross-hatch shading
  sketchShading: {
    strokeWidth: 0.9,
    roughness: 1.6,
    hachureAngle: 60,
    hachureGap: 5,
  },
  // Solid or dense marker fill
  markerWash: {
    strokeWidth: 1.0,
    roughness: 1.8,
    hachureGap: 3,
    fillStyle: 'zigzag',
  },
} as const;

// ── 3. Exact Perimeter Intersection Geometry ────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface RectBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Calculates where the ray from (cx, cy) to (tx, ty) intersects the perimeter
 * of rectangle [x, y, w, h].
 */
export function intersectRectPerimeter(
  box: RectBounds,
  target: Point,
  padding = 0,
): Point {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) {
    return { x: cx, y: cy };
  }

  const halfW = box.w / 2 + padding;
  const halfH = box.h / 2 + padding;

  // Scale factor to hit horizontal and vertical edges
  const scaleX = Math.abs(dx) > 1e-4 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = Math.abs(dy) > 1e-4 ? halfH / Math.abs(dy) : Infinity;

  const scale = Math.min(scaleX, scaleY);

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}

/**
 * Calculates where the ray from (cx, cy) to (tx, ty) intersects an ellipse.
 */
export function intersectEllipsePerimeter(
  box: RectBounds,
  target: Point,
  padding = 0,
): Point {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rx = box.w / 2 + padding;
  const ry = box.h / 2 + padding;

  const dx = target.x - cx;
  const dy = target.y - cy;

  if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) {
    return { x: cx, y: cy };
  }

  const angle = Math.atan2(dy / ry, dx / rx);
  return {
    x: cx + rx * Math.cos(angle),
    y: cy + ry * Math.sin(angle),
  };
}

/**
 * Calculates where the ray from (cx, cy) to (tx, ty) intersects a diamond.
 */
export function intersectDiamondPerimeter(
  box: RectBounds,
  target: Point,
  padding = 0,
): Point {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) {
    return { x: cx, y: cy };
  }

  const a = box.w / 2 + padding;
  const b = box.h / 2 + padding;

  // Equation of diamond: |x - cx|/a + |y - cy|/b = 1
  const t = 1 / (Math.abs(dx) / a + Math.abs(dy) / b);

  return {
    x: cx + dx * t,
    y: cy + dy * t,
  };
}

/**
 * Calculates smooth cubic Bézier control points between start and end.
 * Curvature is restrained so lines feel naturally hand-drawn, never noodle-like.
 */
export function calculateCurvedConnectorPoints(
  p1: Point,
  p2: Point,
  direction: 'down' | 'right' | 'radial' = 'down',
  curvatureFactor = 0.25,
): { cp1: Point; cp2: Point } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  if (direction === 'down') {
    // Top-to-bottom flow: curve extends vertically from p1 and enters vertically into p2
    const vOffset = Math.max(16, Math.abs(dy) * curvatureFactor);
    return {
      cp1: { x: p1.x, y: p1.y + vOffset },
      cp2: { x: p2.x, y: p2.y - vOffset },
    };
  }

  if (direction === 'right') {
    // Left-to-right flow: curve extends horizontally
    const hOffset = Math.max(16, Math.abs(dx) * curvatureFactor);
    return {
      cp1: { x: p1.x + hOffset, y: p1.y },
      cp2: { x: p2.x - hOffset, y: p2.y },
    };
  }

  // Radial / S-curve: natural sag
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const dist = Math.hypot(dx, dy) || 1;
  const perpX = (-dy / dist) * Math.min(18, dist * 0.15);
  const perpY = (dx / dist) * Math.min(18, dist * 0.15);

  return {
    cp1: { x: p1.x + dx * 0.33 + perpX, y: p1.y + dy * 0.33 + perpY },
    cp2: { x: p1.x + dx * 0.66 + perpX * 0.5, y: p1.y + dy * 0.66 + perpY * 0.5 },
  };
}
