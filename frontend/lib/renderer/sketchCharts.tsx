'use client';

/**
 * sketchCharts.tsx
 * ================
 * Hand-drawn mathematical graphs, statistical charts, and geometric figures.
 *
 * Designed for academic study notes:
 * 1. Strict mathematical correctness: axes, data values, and geometry are never distorted.
 * 2. Hand-sketched aesthetic: rough.js axes, cross-hatching, and Kalam font annotations.
 * 3. 32px line grid snapping: All components guarantee heights snapped to whole multiples of LINE_H.
 */

import React, { useEffect, useRef } from 'react';
import rough from 'roughjs';
import { CONTENT_W, INK, INK_RED, LINE_H, snapToLine } from './geometry';
import { PALETTE, TOPIC_PALETTES } from './handDrawnStyle';

// ── 1. Hand-Drawn Bar Chart ─────────────────────────────────────────────────

export interface BarChartItem {
  label: string;
  value: number;
}

export interface SketchBarChartProps {
  data: BarChartItem[];
  title?: string;
  unit?: string;
  width?: number;
  heightLines?: number; // In multiples of LINE_H (default: 6 lines = 192px)
  seed?: number;
}

export function SketchBarChart({
  data,
  title,
  unit = '',
  width = CONTENT_W,
  heightLines = 6,
  seed = 42,
}: SketchBarChartProps) {
  const containerH = heightLines * LINE_H;
  const svgRef = useRef<SVGSVGElement | null>(null);

  const padLeft = 56;
  const padBottom = 38;
  const padTop = title ? 32 : 16;
  const padRight = 24;

  const plotW = width - padLeft - padRight;
  const plotH = containerH - padTop - padBottom;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const niceMax = Math.ceil(maxValue * 1.15);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || width <= 0 || containerH <= 0) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const rc = rough.svg(svg);

    // 1. Draw X and Y Axes with hand-drawn pen stroke
    const axisOpts = {
      stroke: PALETTE.ink,
      strokeWidth: 1.6,
      roughness: 1.3,
      bowing: 1.2,
      seed,
    };

    // Y Axis (left vertical line)
    svg.appendChild(rc.line(padLeft, padTop - 6, padLeft, padTop + plotH + 2, axisOpts));
    // Y Axis Arrowhead
    svg.appendChild(rc.line(padLeft - 4, padTop + 2, padLeft, padTop - 6, { ...axisOpts, seed: seed + 1 }));
    svg.appendChild(rc.line(padLeft + 4, padTop + 2, padLeft, padTop - 6, { ...axisOpts, seed: seed + 2 }));

    // X Axis (bottom horizontal line)
    svg.appendChild(rc.line(padLeft - 2, padTop + plotH, padLeft + plotW + 10, padTop + plotH, { ...axisOpts, seed: seed + 3 }));
    // X Axis Arrowhead
    svg.appendChild(rc.line(padLeft + plotW + 4, padTop + plotH - 4, padLeft + plotW + 10, padTop + plotH, { ...axisOpts, seed: seed + 4 }));
    svg.appendChild(rc.line(padLeft + plotW + 4, padTop + plotH + 4, padLeft + plotW + 10, padTop + plotH, { ...axisOpts, seed: seed + 5 }));

    // 2. Y-Axis Grid Lines & Tick Marks (3 increments)
    const ticks = [0.25, 0.5, 0.75, 1.0];
    ticks.forEach((t, i) => {
      const y = padTop + plotH - t * plotH;
      // Subtle dashed pencil guide
      svg.appendChild(
        rc.line(padLeft, y, padLeft + plotW, y, {
          stroke: '#c8d4e4',
          strokeWidth: 0.9,
          roughness: 1.1,
          strokeLineDash: [6, 6],
          seed: seed + 10 + i,
        }),
      );
    });

    // 3. Bars
    const barCount = data.length;
    const barSlot = plotW / barCount;
    const barW = Math.min(48, barSlot * 0.65);

    data.forEach((d, i) => {
      const barH = (d.value / niceMax) * plotH;
      const x = padLeft + i * barSlot + (barSlot - barW) / 2;
      const y = padTop + plotH - barH;

      const palette = TOPIC_PALETTES[i % TOPIC_PALETTES.length];

      // Draw cross-hatched bar
      svg.appendChild(
        rc.rectangle(x, y, barW, barH, {
          stroke: palette.stroke,
          strokeWidth: 1.5,
          roughness: 1.25,
          bowing: 1.2,
          fill: palette.fill,
          fillStyle: 'hachure',
          hachureAngle: i % 2 === 0 ? 55 : -55,
          hachureGap: 4.5,
          seed: seed + 100 + i * 7,
        }),
      );
    });
  }, [data, width, containerH, seed, padLeft, padTop, plotW, plotH, niceMax]);

  return (
    <div style={{ position: 'relative', width, height: containerH, margin: '8px 0' }}>
      <svg
        ref={svgRef}
        width={width}
        height={containerH}
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
      />
      {/* Title */}
      {title && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: padLeft,
            fontSize: 16,
            fontWeight: 700,
            fontFamily: 'Kalam, cursive',
            color: PALETTE.ink,
          }}
        >
          {title}
        </div>
      )}
      {/* Y Axis Tick Labels */}
      {[0.5, 1.0].map((t, idx) => {
        const val = Math.round(niceMax * t);
        const y = padTop + plotH - t * plotH - 10;
        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              top: y,
              left: 4,
              width: padLeft - 10,
              textAlign: 'right',
              fontSize: 12.5,
              fontFamily: 'Kalam, cursive',
              color: '#48547a',
            }}
          >
            {val}
            {unit}
          </div>
        );
      })}
      {/* X Axis Bar Labels & Value Badges */}
      {data.map((d, i) => {
        const barSlot = plotW / data.length;
        const x = padLeft + i * barSlot;
        const barH = (d.value / niceMax) * plotH;
        const valY = padTop + plotH - barH - 22;

        return (
          <React.Fragment key={i}>
            {/* Top value callout */}
            <div
              style={{
                position: 'absolute',
                top: valY,
                left: x,
                width: barSlot,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'Kalam, cursive',
                color: PALETTE.ink,
              }}
            >
              {d.value}
            </div>
            {/* Bottom Category Label */}
            <div
              style={{
                position: 'absolute',
                top: padTop + plotH + 6,
                left: x - 4,
                width: barSlot + 8,
                textAlign: 'center',
                fontSize: 13,
                fontFamily: 'Kalam, cursive',
                color: PALETTE.ink,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {d.label}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── 2. Hand-Drawn Pie / Donut Chart ─────────────────────────────────────────

export interface PieChartItem {
  label: string;
  value: number;
}

export interface SketchPieChartProps {
  data: PieChartItem[];
  title?: string;
  width?: number;
  heightLines?: number; // In multiples of LINE_H (default: 7 lines = 224px)
  seed?: number;
}

export function SketchPieChart({
  data,
  title,
  width = CONTENT_W,
  heightLines = 7,
  seed = 88,
}: SketchPieChartProps) {
  const containerH = heightLines * LINE_H;
  const svgRef = useRef<SVGSVGElement | null>(null);

  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const cx = Math.round(width * 0.36);
  const cy = Math.round(containerH / 2) + (title ? 10 : 0);
  const radius = Math.min(84, (containerH - 48) / 2);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || width <= 0 || containerH <= 0) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const rc = rough.svg(svg);
    let currentAngle = -Math.PI / 2;

    data.forEach((d, i) => {
      const sliceAngle = (d.value / total) * (2 * Math.PI);
      const endAngle = currentAngle + sliceAngle;
      const palette = TOPIC_PALETTES[i % TOPIC_PALETTES.length];

      // Approximate sector with rough polygon
      const steps = 14;
      const points: [number, number][] = [[cx, cy]];
      for (let s = 0; s <= steps; s++) {
        const a = currentAngle + (sliceAngle * s) / steps;
        points.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
      }

      svg.appendChild(
        rc.polygon(points, {
          stroke: palette.stroke,
          strokeWidth: 1.5,
          roughness: 1.2,
          bowing: 1.1,
          fill: palette.fill,
          fillStyle: 'hachure',
          hachureAngle: 30 + i * 40,
          hachureGap: 4.5,
          seed: seed + i * 11,
        }),
      );

      // Leader line pointing outward
      const midAngle = currentAngle + sliceAngle / 2;
      const lx1 = cx + (radius * 0.75) * Math.cos(midAngle);
      const ly1 = cy + (radius * 0.75) * Math.sin(midAngle);
      const lx2 = cx + (radius + 16) * Math.cos(midAngle);
      const ly2 = cy + (radius + 16) * Math.sin(midAngle);

      svg.appendChild(
        rc.line(lx1, ly1, lx2, ly2, {
          stroke: palette.stroke,
          strokeWidth: 1.2,
          roughness: 1.4,
          seed: seed + 50 + i,
        }),
      );

      currentAngle = endAngle;
    });

    // Central circular hole cutout for donut feel
    svg.appendChild(
      rc.circle(cx, cy, radius * 0.45 * 2, {
        stroke: PALETTE.ink,
        strokeWidth: 1.4,
        roughness: 1.3,
        fill: PALETTE.paper,
        fillStyle: 'solid',
        seed: seed + 999,
      }),
    );
  }, [data, width, containerH, seed, total, cx, cy, radius, title]);

  return (
    <div style={{ position: 'relative', width, height: containerH, margin: '8px 0' }}>
      <svg
        ref={svgRef}
        width={width}
        height={containerH}
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
      />
      {title && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: 20,
            fontSize: 16,
            fontWeight: 700,
            fontFamily: 'Kalam, cursive',
            color: PALETTE.ink,
          }}
        >
          {title}
        </div>
      )}
      {/* Legend on the right side */}
      <div
        style={{
          position: 'absolute',
          top: cy - Math.min(containerH / 2 - 16, data.length * 15),
          left: cx + radius + 40,
          right: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {data.map((d, i) => {
          const pct = Math.round((d.value / total) * 100);
          const palette = TOPIC_PALETTES[i % TOPIC_PALETTES.length];
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontFamily: 'Kalam, cursive',
                color: PALETTE.ink,
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  border: `1.5px solid ${palette.stroke}`,
                  backgroundColor: palette.fill,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 600 }}>{d.label}</span>
              <span style={{ opacity: 0.75, fontSize: 12.5 }}>({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 3. Hand-Drawn Mathematical Function Graph ───────────────────────────────

export interface SketchFunctionGraphProps {
  title?: string;
  formulaLabel?: string;
  fn?: (x: number) => number; // Default: Sigmoid / Logistic function
  xRange?: [number, number]; // Default: [-4, 4]
  width?: number;
  heightLines?: number; // In multiples of LINE_H (default: 6 lines = 192px)
  seed?: number;
}

export function SketchFunctionGraph({
  title = 'Sigmoid Activation Function',
  formulaLabel = 'sigma(z) = 1 / (1 + exp(-z))',
  fn = (x: number) => 1 / (1 + Math.exp(-x)),
  xRange = [-4, 4],
  width = CONTENT_W,
  heightLines = 6,
  seed = 120,
}: SketchFunctionGraphProps) {
  const containerH = heightLines * LINE_H;
  const svgRef = useRef<SVGSVGElement | null>(null);

  const padLeft = 60;
  const padRight = 60;
  const padTop = 32;
  const padBottom = 28;

  const plotW = width - padLeft - padRight;
  const plotH = containerH - padTop - padBottom;

  const [minX, maxX] = xRange;
  const originX = padLeft + ((-minX) / (maxX - minX)) * plotW;
  const originY = padTop + plotH * 0.9; // Y=0 baseline near bottom

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || width <= 0 || containerH <= 0) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const rc = rough.svg(svg);
    const opts = { stroke: PALETTE.ink, strokeWidth: 1.6, roughness: 1.3, seed };

    // 1. Coordinate Axes
    // X Axis
    svg.appendChild(rc.line(padLeft - 10, originY, padLeft + plotW + 20, originY, opts));
    svg.appendChild(rc.line(padLeft + plotW + 14, originY - 4, padLeft + plotW + 20, originY, opts));
    svg.appendChild(rc.line(padLeft + plotW + 14, originY + 4, padLeft + plotW + 20, originY, opts));

    // Y Axis
    svg.appendChild(rc.line(originX, padTop - 12, originX, originY + 12, opts));
    svg.appendChild(rc.line(originX - 4, padTop - 6, originX, padTop - 12, opts));
    svg.appendChild(rc.line(originX + 4, padTop - 6, originX, padTop - 12, opts));

    // Horizontal Asymptote at Y = 1
    const yOne = originY - plotH * 0.75;
    svg.appendChild(
      rc.line(padLeft, yOne, padLeft + plotW, yOne, {
        stroke: '#b0c4de',
        strokeWidth: 1.0,
        strokeLineDash: [6, 4],
        roughness: 1.1,
        seed: seed + 5,
      }),
    );

    // 2. Plot Mathematical Function Curve
    const points: [number, number][] = [];
    const steps = 40;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const xVal = minX + t * (maxX - minX);
      const yVal = fn(xVal);

      const px = padLeft + t * plotW;
      const py = originY - yVal * (plotH * 0.75);
      points.push([px, py]);
    }

    svg.appendChild(
      rc.curve(points, {
        stroke: PALETTE.inkRed,
        strokeWidth: 2.2,
        roughness: 1.1,
        bowing: 1.0,
        seed: seed + 20,
      }),
    );

    // Inflection point at (0, 0.5)
    const inflectY = originY - 0.5 * (plotH * 0.75);
    svg.appendChild(
      rc.circle(originX, inflectY, 8, {
        stroke: PALETTE.inkRed,
        strokeWidth: 1.8,
        fill: PALETTE.washYellow,
        fillStyle: 'solid',
        seed: seed + 30,
      }),
    );
  }, [width, containerH, fn, minX, maxX, seed, padLeft, padRight, padTop, plotW, plotH, originX, originY]);

  return (
    <div style={{ position: 'relative', width, height: containerH, margin: '8px 0' }}>
      <svg
        ref={svgRef}
        width={width}
        height={containerH}
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
      />
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: padLeft,
          fontSize: 16,
          fontWeight: 700,
          fontFamily: 'Kalam, cursive',
          color: PALETTE.ink,
        }}
      >
        {title}
      </div>
      {/* Formula annotation badge */}
      <div
        style={{
          position: 'absolute',
          top: padTop,
          right: padRight,
          padding: '2px 10px',
          backgroundColor: PALETTE.washYellow,
          border: `1.2px solid ${PALETTE.stickyYellowBorder}`,
          borderRadius: 4,
          fontSize: 14,
          fontWeight: 700,
          fontFamily: 'Kalam, cursive',
          color: PALETTE.ink,
          boxShadow: '1px 1px 0 rgba(0,0,0,0.08)',
        }}
      >
        {formulaLabel}
      </div>
      {/* Axis Labels */}
      <span
        style={{
          position: 'absolute',
          top: originY - 22,
          left: originX - 16,
          fontSize: 13,
          fontFamily: 'Kalam, cursive',
          color: '#555',
        }}
      >
        O
      </span>
      <span
        style={{
          position: 'absolute',
          top: originY + 4,
          right: padRight - 20,
          fontSize: 14,
          fontWeight: 700,
          fontFamily: 'Kalam, cursive',
          color: PALETTE.ink,
        }}
      >
        x
      </span>
      <span
        style={{
          position: 'absolute',
          top: padTop - 18,
          left: originX + 8,
          fontSize: 14,
          fontWeight: 700,
          fontFamily: 'Kalam, cursive',
          color: PALETTE.ink,
        }}
      >
        y
      </span>
      {/* Asymptote labels */}
      <span
        style={{
          position: 'absolute',
          top: originY - plotH * 0.75 - 10,
          left: padLeft - 28,
          fontSize: 12.5,
          fontFamily: 'Kalam, cursive',
          color: '#555',
        }}
      >
        y = 1
      </span>
    </div>
  );
}

// ── 4. Hand-Drawn Geometric Diagram ─────────────────────────────────────────

export interface SketchGeometryProps {
  title?: string;
  width?: number;
  heightLines?: number; // In multiples of LINE_H (default: 6 lines = 192px)
  seed?: number;
}

export function SketchGeometry({
  title = 'Right-Angled Triangle & Pythagoras Theorem',
  width = CONTENT_W,
  heightLines = 6,
  seed = 150,
}: SketchGeometryProps) {
  const containerH = heightLines * LINE_H;
  const svgRef = useRef<SVGSVGElement | null>(null);

  const cx = Math.round(width * 0.35);
  const bottomY = containerH - 28;
  const topY = 40;
  const rightX = cx + 180;
  const leftX = cx - 40;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || width <= 0 || containerH <= 0) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const rc = rough.svg(svg);
    const triangleOpts = {
      stroke: PALETTE.ink,
      strokeWidth: 1.8,
      roughness: 1.3,
      bowing: 1.2,
      fill: PALETTE.washBlue,
      fillStyle: 'hachure',
      hachureAngle: 60,
      hachureGap: 6,
      seed,
    };

    // Right-angled triangle: (leftX, bottomY) to (rightX, bottomY) to (leftX, topY)
    svg.appendChild(
      rc.polygon(
        [
          [leftX, bottomY],
          [rightX, bottomY],
          [leftX, topY],
        ],
        triangleOpts,
      ),
    );

    // Right angle square marker at vertex A (leftX, bottomY)
    const sqSize = 14;
    svg.appendChild(
      rc.rectangle(leftX, bottomY - sqSize, sqSize, sqSize, {
        stroke: PALETTE.inkRed,
        strokeWidth: 1.3,
        roughness: 1.1,
        seed: seed + 5,
      }),
    );

    // Angle theta arc at vertex C (rightX, bottomY)
    const arcRadius = 32;
    svg.appendChild(
      rc.arc(rightX, bottomY, arcRadius * 2, arcRadius * 2, Math.PI, Math.PI * 1.2, false, {
        stroke: PALETTE.inkAmber,
        strokeWidth: 1.5,
        roughness: 1.2,
        seed: seed + 10,
      }),
    );
  }, [width, containerH, seed, leftX, rightX, topY, bottomY]);

  return (
    <div style={{ position: 'relative', width, height: containerH, margin: '8px 0' }}>
      <svg
        ref={svgRef}
        width={width}
        height={containerH}
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
      />
      {title && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: 20,
            fontSize: 16,
            fontWeight: 700,
            fontFamily: 'Kalam, cursive',
            color: PALETTE.ink,
          }}
        >
          {title}
        </div>
      )}
      {/* Vertex Labels */}
      <span style={{ position: 'absolute', top: bottomY + 2, left: leftX - 14, fontSize: 15, fontWeight: 700, fontFamily: 'Kalam, cursive', color: PALETTE.ink }}>
        A
      </span>
      <span style={{ position: 'absolute', top: topY - 18, left: leftX - 4, fontSize: 15, fontWeight: 700, fontFamily: 'Kalam, cursive', color: PALETTE.ink }}>
        B
      </span>
      <span style={{ position: 'absolute', top: bottomY + 2, left: rightX + 8, fontSize: 15, fontWeight: 700, fontFamily: 'Kalam, cursive', color: PALETTE.ink }}>
        C
      </span>
      {/* Side Lengths */}
      <span style={{ position: 'absolute', top: (topY + bottomY) / 2 - 10, left: leftX - 24, fontSize: 14, fontFamily: 'Kalam, cursive', color: '#444' }}>
        a
      </span>
      <span style={{ position: 'absolute', top: bottomY + 4, left: (leftX + rightX) / 2 - 4, fontSize: 14, fontFamily: 'Kalam, cursive', color: '#444' }}>
        b
      </span>
      <span style={{ position: 'absolute', top: (topY + bottomY) / 2 - 18, left: (leftX + rightX) / 2 + 16, fontSize: 14, fontFamily: 'Kalam, cursive', color: '#444' }}>
        c
      </span>
      {/* Angle label */}
      <span style={{ position: 'absolute', top: bottomY - 26, left: rightX - 36, fontSize: 14, fontWeight: 700, fontFamily: 'Kalam, cursive', color: PALETTE.inkAmber }}>
        C
      </span>
      {/* Formula Callout Box on right side */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          right: 32,
          padding: '8px 16px',
          backgroundColor: PALETTE.washYellow,
          border: `1.5px solid ${PALETTE.stickyYellowBorder}`,
          borderRadius: 6,
          boxShadow: '1px 2px 0 rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Kalam, cursive', color: PALETTE.ink }}>
          c<sup style={{ fontSize: 11 }}>2</sup> = a<sup style={{ fontSize: 11 }}>2</sup> + b<sup style={{ fontSize: 11 }}>2</sup>
        </div>
        <div style={{ fontSize: 13, fontFamily: 'Kalam, cursive', color: '#555', marginTop: 4 }}>
          sin(C) = a / c
        </div>
        <div style={{ fontSize: 13, fontFamily: 'Kalam, cursive', color: '#555' }}>
          cos(C) = b / c
        </div>
      </div>
    </div>
  );
}
