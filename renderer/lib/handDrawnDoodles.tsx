'use client';

/**
 * handDrawnDoodles.tsx
 * ====================
 * A curated collection of genuine hand-drawn SVG doodle assets.
 * Rendered as authentic sketch strokes, hatching, and pen marks
 * using pure SVG vectors (no external images or bitmap dependencies).
 *
 * Designed to decorate study notebook pages, diagram nodes, sticky notes,
 * and section callouts with organic academic flair.
 */

import React from 'react';
import { PALETTE } from './handDrawnStyle';

export interface DoodleProps {
  size?: number;
  color?: string;
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
}

// ── 1. Conceptual & Educational Doodles ──────────────────────────────────────

/** Light bulb — eureka moment / idea */
export function LightBulbDoodle({
  size = 24,
  color = PALETTE.ink,
  fill = PALETTE.washYellow,
  style,
}: DoodleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', overflow: 'visible', ...style }}
    >
      {/* Glow rays */}
      <path d="M12 1.5v2.2M4.5 4.5l1.6 1.6M19.5 4.5l-1.6 1.6M2 11h2.2M22 11h-2.2" strokeWidth="1.3" opacity="0.8" />
      {/* Bulb body with warm wash fill */}
      <path
        d="M8.2 14.5c-.8-.9-1.4-2-1.4-3.3a5.2 5.2 0 1 1 10.4 0c0 1.3-.6 2.4-1.4 3.3-.6.7-1 1.7-1.1 2.7H9.3c-.1-1-.5-2-1.1-2.7z"
        fill={fill}
      />
      {/* Filament scribble */}
      <path d="M10 11.2a2 2 0 0 1 2-1.8 2 2 0 0 1 2 1.8M12 9.4v3.2" strokeWidth="1.2" opacity="0.85" />
      {/* Screw base & contact */}
      <path d="M9.4 18.8h5.2M10 20.6h4M10.8 22.2h2.4" strokeWidth="1.5" />
    </svg>
  );
}

/** Open study book */
export function BookDoodle({
  size = 24,
  color = PALETTE.ink,
  fill = PALETTE.washBlue,
  style,
}: DoodleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <path
        d="M2.5 18.2c2.8-.7 6-1 9.5.6 3.5-1.6 6.7-1.3 9.5-.6V5.2c-2.8-.7-6-1-9.5.6-3.5-1.6-6.7-1.3-9.5-.6v13z"
        fill={fill}
      />
      <path d="M12 5.8v13M5 8.2c1.8-.4 3.8-.5 5.5.2M5 11.2c1.8-.4 3.8-.5 5.5.2M13.5 8.4c1.7-.7 3.7-.6 5.5-.2M13.5 11.4c1.7-.7 3.7-.6 5.5-.2" strokeWidth="1.2" opacity="0.8" />
    </svg>
  );
}

/** Sketched five-point star with contour shadow */
export function StarBadgeDoodle({
  size = 20,
  color = PALETTE.inkRed,
  fill = PALETTE.washYellow,
  style,
}: DoodleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <polygon
        points="12,2.2 15.2,8.8 22.4,9.8 17.2,14.8 18.5,22 12,18.5 5.5,22 6.8,14.8 1.6,9.8 8.8,8.8"
        fill={fill}
      />
      {/* Hand-drawn retrace contour */}
      <path d="M12 4.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" strokeWidth="1.1" opacity="0.65" />
    </svg>
  );
}

/** Idea sparkle / starburst */
export function IdeaSparkDoodle({
  size = 18,
  color = PALETTE.inkAmber,
  style,
}: DoodleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <path d="M10 1.5v17M1.5 10h17M4 4l12 12M16 4L4 16" opacity="0.85" />
      <circle cx="10" cy="10" r="1.5" fill={color} />
    </svg>
  );
}

/** Checked mark with sketched double strike */
export function CheckmarkDoodle({
  size = 20,
  color = '#2e7d32',
  style,
}: DoodleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={color}
      strokeWidth="2.0"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <path d="M3.2 10.5l4.6 5.1L16.8 4.8" />
      <path d="M4 11l4.2 4.5 8.2-10" strokeWidth="1.2" opacity="0.6" />
    </svg>
  );
}

// ── 2. Computing, AI & Technical Doodles ──────────────────────────────────────

/** Brain / Neural network / AI model */
export function BrainDoodle({
  size = 24,
  color = PALETTE.inkPurple,
  fill = PALETTE.washPurple,
  style,
}: DoodleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      {/* Left hemisphere lobes */}
      <path
        d="M12 4.2c-1.8-.8-4.2-.3-5.2 1.2-1.5 0-2.8 1.4-2.8 3 0 .8.3 1.5.8 2-.8.8-1.1 2-.8 3.1.4 1.4 1.6 2.4 3 2.5.4 1.8 2.2 3 4 2.6v-14.4z"
        fill={fill}
      />
      {/* Right hemisphere lobes */}
      <path
        d="M12 4.2c1.8-.8 4.2-.3 5.2 1.2 1.5 0 2.8 1.4 2.8 3 0 .8-.3 1.5-.8 2 .8.8 1.1 2 .8 3.1-.4 1.4-1.6 2.4-3 2.5-.4 1.8-2.2 3-4 2.6v-14.4z"
        fill={fill}
      />
      {/* Cortex fissures */}
      <path d="M8 8.5c1.2.6 1.8 1.8 1.2 3.2M16 8.5c-1.2.6-1.8 1.8-1.2 3.2M7.5 14c1.5-.2 2.5.5 2.5 1.8M16.5 14c-1.5-.2-2.5.5-2.5 1.8" strokeWidth="1.2" opacity="0.8" />
    </svg>
  );
}

/** Database cylinder / Storage / SQL */
export function DatabaseDoodle({
  size = 24,
  color = PALETTE.inkTeal,
  fill = PALETTE.washTeal,
  style,
}: DoodleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      {/* Top ellipse */}
      <ellipse cx="12" cy="5.5" rx="8" ry="3" fill={fill} />
      {/* Middle ring */}
      <path d="M4 5.5v5.5c0 1.66 3.58 3 8 3s8-1.34 8-3V5.5" />
      {/* Bottom ring */}
      <path d="M4 11v5.5c0 1.66 3.58 3 8 3s8-1.34 8-3V11" />
      {/* Hand-drawn hash indicator lights */}
      <circle cx="8" cy="11" r="0.75" fill={color} />
      <circle cx="8" cy="16.5" r="0.75" fill={color} />
    </svg>
  );
}

/** Server rack / Host */
export function ServerDoodle({
  size = 24,
  color = PALETTE.ink,
  fill = PALETTE.washBlue,
  style,
}: DoodleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <rect x="3" y="3" width="18" height="7" rx="1.5" fill={fill} />
      <rect x="3" y="14" width="18" height="7" rx="1.5" fill={fill} />
      <line x1="6.5" y1="6.5" x2="6.6" y2="6.5" strokeWidth="2.5" />
      <line x1="10" y1="6.5" x2="16" y2="6.5" strokeWidth="1.2" />
      <line x1="6.5" y1="17.5" x2="6.6" y2="17.5" strokeWidth="2.5" />
      <line x1="10" y1="17.5" x2="16" y2="17.5" strokeWidth="1.2" />
    </svg>
  );
}

/** CPU / Microchip / Processor */
export function CpuDoodle({
  size = 24,
  color = PALETTE.ink,
  fill = PALETTE.washGreen,
  style,
}: DoodleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <rect x="5.5" y="5.5" width="13" height="13" rx="2" fill={fill} />
      <rect x="8.5" y="8.5" width="7" height="7" strokeWidth="1.2" />
      {/* Pins */}
      <path d="M8.5 2v3.5M12 2v3.5M15.5 2v3.5M8.5 18.5V22M12 18.5V22M15.5 18.5V22M2 8.5h3.5M2 12h3.5M2 15.5h3.5M18.5 8.5H22M18.5 12H22M18.5 15.5H22" strokeWidth="1.3" />
    </svg>
  );
}

/** Gear / Settings / Engineering */
export function GearDoodle({
  size = 22,
  color = PALETTE.inkPencil,
  style,
}: DoodleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeWidth="1.3" />
    </svg>
  );
}

/** Magnifying glass / Search / Inspection */
export function MagnifierDoodle({
  size = 20,
  color = PALETTE.ink,
  fill = PALETTE.washBlue,
  style,
}: DoodleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <circle cx="8.5" cy="8.5" r="5.5" fill={fill} />
      <path d="M12.5 12.5l5 5" strokeWidth="2.0" />
      <path d="M6.5 6.5a2.5 2.5 0 0 1 3.5 0" strokeWidth="1.2" opacity="0.7" />
    </svg>
  );
}

/** Rocket / Speed / Performance / Launch */
export function RocketDoodle({
  size = 22,
  color = PALETTE.inkRed,
  fill = PALETTE.washCoral,
  style,
}: DoodleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <path
        d="M4.5 16.5c-1.5 1.2-2 4-2 4s2.8-.5 4-2l-2-2zM15 3.5c-3.5 0-6.5 2.5-8 6l3.5 3.5c3.5-1.5 6-4.5 6-8 0-.5-.5-1.5-1.5-1.5z"
        fill={fill}
      />
      <path d="M9 14.5l-2.5 2.5M14.5 9l2.5-2.5M2 22l3-3" strokeWidth="1.3" opacity="0.8" />
      <circle cx="14" cy="7.5" r="1.5" fill={color} />
    </svg>
  );
}

// ── 3. Notebook Badges & Tape Decors ─────────────────────────────────────────

/** Washi tape strip with ripped, jagged ends */
export function TapeStripDoodle({
  width = 72,
  height = 18,
  color = 'rgba(238, 226, 185, 0.78)',
  patternColor = '#b8a678',
  style,
}: {
  width?: number;
  height?: number;
  color?: string;
  patternColor?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', overflow: 'visible', ...style }}
    >
      {/* Torn jagged tape path */}
      <path
        d={`M 0 3 
            L 3 0 L ${width - 3} 0 L ${width} 3 
            L ${width - 2} 7 L ${width} 11 L ${width - 3} 15 L ${width} ${height} 
            L ${width - 3} ${height - 2} L 3 ${height - 2} L 0 ${height} 
            L 2 13 L 0 9 Z`}
        fill={color}
        stroke={patternColor}
        strokeWidth="0.8"
        strokeOpacity="0.5"
      />
      {/* Subtle hatched striping on tape */}
      <line x1="12" y1="2" x2="6" y2={height - 2} stroke={patternColor} strokeWidth="0.9" opacity="0.4" />
      <line x1="24" y1="2" x2="18" y2={height - 2} stroke={patternColor} strokeWidth="0.9" opacity="0.4" />
      <line x1="36" y1="2" x2="30" y2={height - 2} stroke={patternColor} strokeWidth="0.9" opacity="0.4" />
      <line x1="48" y1="2" x2="42" y2={height - 2} stroke={patternColor} strokeWidth="0.9" opacity="0.4" />
      <line x1="60" y1="2" x2="54" y2={height - 2} stroke={patternColor} strokeWidth="0.9" opacity="0.4" />
    </svg>
  );
}

/** Sketched pushpin with cast shadow */
export function PinDoodle({
  size = 20,
  headColor = '#d94a3d',
  style,
}: {
  size?: number;
  headColor?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: 'block', overflow: 'visible', ...style }}
    >
      {/* Pin needle shadow */}
      <line x1="12" y1="12" x2="6" y2="21" stroke="rgba(0,0,0,0.22)" strokeWidth="1.8" strokeLinecap="round" />
      {/* Metallic needle */}
      <line x1="12" y1="12" x2="7" y2="19" stroke="#666" strokeWidth="1.6" strokeLinecap="round" />
      {/* Plastic pin head */}
      <ellipse cx="15" cy="8" rx="6" ry="4.5" fill={headColor} stroke="#7a1a12" strokeWidth="1.1" transform="rotate(-35 15 8)" />
      {/* Pin head highlight */}
      <circle cx="14" cy="6.5" r="1.5" fill="rgba(255,255,255,0.7)" />
    </svg>
  );
}

/** Circled number badge for flowchart steps (①, ②, ③, etc.) */
export function CircledNumberBadge({
  num,
  size = 22,
  color = PALETTE.ink,
  fill = PALETTE.washBlue,
  style,
}: {
  num: number | string;
  size?: number;
  color?: string;
  fill?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `1.6px solid ${color}`,
        backgroundColor: fill,
        fontSize: size * 0.62,
        fontWeight: 700,
        fontFamily: 'Kalam, cursive',
        color,
        boxShadow: '1px 1px 0px rgba(0,0,0,0.1)',
        marginRight: 8,
        flexShrink: 0,
        ...style,
      }}
    >
      {num}
    </span>
  );
}

/** Hand-drawn "VS" emblem for comparison tables */
export function VsBadgeDoodle({
  size = 32,
  color = PALETTE.inkRed,
  fill = PALETTE.washCoral,
  style,
}: {
  size?: number;
  color?: string;
  fill?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ display: 'inline-block', verticalAlign: 'middle', overflow: 'visible', ...style }}
    >
      {/* Sketched circle with retrace */}
      <circle cx="16" cy="16" r="14" fill={fill} stroke={color} strokeWidth="1.8" />
      <circle cx="16.5" cy="16.5" r="13" fill="none" stroke={color} strokeWidth="1.0" opacity="0.6" strokeDasharray="3 2" />
      {/* "VS" handwritten lettering */}
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontFamily="Kalam, cursive"
        fontSize="14"
        fontWeight="bold"
        fill={color}
      >
        VS
      </text>
    </svg>
  );
}

/** Hand-drawn warning / exclamation mark */
export function ExclamationDoodle({
  size = 22,
  color = PALETTE.inkRed,
  style,
}: DoodleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      {/* Exclamation point with doubled hand stroke */}
      <path d="M12 3.5v10.5M12.8 4v9.5" />
      <circle cx="12" cy="19.5" r="1.5" fill={color} stroke={color} strokeWidth="0.5" />
    </svg>
  );
}

// ── 4. Intelligent Doodle Keyword Resolver ───────────────────────────────────

/**
 * Resolves a relevant hand-drawn doodle component based on node text or label.
 * Used selectively to illustrate diagram nodes and section headings.
 */
export function getDoodleForKeyword(
  text: string,
  size = 20,
): React.ReactNode | null {
  const s = String(text ?? '').toLowerCase();

  if (s.includes('data') || s.includes('sql') || s.includes('storage') || s.includes('table')) {
    return <DatabaseDoodle size={size} />;
  }
  if (s.includes('brain') || s.includes('neural') || s.includes('ai') || s.includes('model') || s.includes('encoder') || s.includes('decoder') || s.includes('attention')) {
    return <BrainDoodle size={size} />;
  }
  if (s.includes('cpu') || s.includes('process') || s.includes('compute') || s.includes('hardware')) {
    return <CpuDoodle size={size} />;
  }
  if (s.includes('server') || s.includes('host') || s.includes('backend') || s.includes('cache')) {
    return <ServerDoodle size={size} />;
  }
  if (s.includes('gear') || s.includes('config') || s.includes('engine') || s.includes('setup')) {
    return <GearDoodle size={size} />;
  }
  if (s.includes('search') || s.includes('query') || s.includes('find') || s.includes('lookup') || s.includes('scan')) {
    return <MagnifierDoodle size={size} />;
  }
  if (s.includes('fast') || s.includes('rocket') || s.includes('speed') || s.includes('optimize') || s.includes('launch')) {
    return <RocketDoodle size={size} />;
  }
  if (s.includes('book') || s.includes('read') || s.includes('note') || s.includes('theory')) {
    return <BookDoodle size={size} />;
  }
  if (s.includes('idea') || s.includes('insight') || s.includes('key') || s.includes('tip')) {
    return <LightBulbDoodle size={size} />;
  }

  return null;
}
