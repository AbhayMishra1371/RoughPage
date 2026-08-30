'use client';

/**
 * Comparison.tsx
 * ==============
 * A hand-ruled two-column table: X versus Y, one row per point of difference.
 *
 * WHY THE TABLE FRAME IS DRAWN PER ROW RATHER THAN ONCE AROUND THE WHOLE THING:
 * a comparison is splittable at row boundaries, and a single drawn frame cannot
 * be cut in half. Each row instead draws its own left edge, right edge, centre
 * divider and bottom rule; stacked, those compose into a continuous table. Only
 * the header row draws a top edge — and since the header is part of the repeated
 * `head`, every fragment comes out as a complete little table with its own
 * labels rather than one with an open lid. See RoughTableRow in lib/roughShapes.
 *
 * The rows are FLEX, not a real `<table>`: a table's row heights are decided by
 * its own layout algorithm, which would quietly break the ruled-line grid.
 */

import { Hand } from '@/lib/handwriting';
import { CONTENT_W, EL_GAP, LINE_H } from '@/lib/geometry';
import { seedFrom } from '@/lib/rng';
import { RoughTableRow } from '@/lib/roughShapes';
import { useBoxSize } from '@/lib/useBoxSize';
import type { ComparisonElement, Importance } from '@/lib/types';
import { importanceOf } from '@/lib/types';
import ContdMarker from './ContdMarker';

const TABLE_W = CONTENT_W;
/** Dead centre — a comparison gives both sides equal room by definition. */
const DIV_X = Math.round(TABLE_W / 2);
const CELL_PAD = 13;

function Cell({
  text,
  seed,
  width,
  importance,
  header,
}: {
  text: string;
  seed: string;
  width?: number;
  importance: Importance;
  header?: boolean;
}) {
  return (
    <div
      style={{
        // The left cell is fixed to the divider position; the right one takes
        // the remainder, so the divider drawn by RoughTableRow lines up exactly
        // with the gap between the two.
        width,
        flex: width === undefined ? 1 : '0 0 auto',
        boxSizing: 'border-box',
        padding: `0 ${CELL_PAD}px`,
        position: 'relative',
        zIndex: 1,
        fontSize: header ? 17.5 : 16.5,
        lineHeight: `${LINE_H}px`,
        color: header ? '#141f52' : undefined,
        fontWeight: header ? 700 : undefined,
      }}
    >
      <Hand
        text={text}
        seed={seed}
        importance={header ? 'high' : importance}
        intensity={header ? 0.8 : 0.95}
      />
    </div>
  );
}

function Row({
  left,
  right,
  seed,
  index,
  header,
  importance,
}: {
  left: string;
  right: string;
  seed: string;
  /** Omitted for the header row — only data rows are splittable content. */
  index?: number;
  header?: boolean;
  importance: Importance;
}) {
  const [ref, box] = useBoxSize<HTMLDivElement>();
  const key = header ? 'hdr' : `r${index}`;

  return (
    <div
      ref={ref}
      {...(index === undefined ? {} : { 'data-part': index })}
      style={{ position: 'relative', display: 'flex', width: TABLE_W, alignItems: 'stretch' }}
    >
      {box.w > 0 && box.h > 0 && (
        <RoughTableRow
          width={box.w}
          height={box.h}
          seed={seedFrom(seed, 'trow', key)}
          divX={DIV_X}
          top={header}
          strokeWidth={header ? 1.7 : 1.3}
        />
      )}
      <Cell text={left} seed={`${seed}-${key}-l`} width={DIV_X} importance={importance} header={header} />
      <Cell text={right} seed={`${seed}-${key}-r`} importance={importance} header={header} />
    </div>
  );
}

export default function Comparison({
  el,
  seed,
  continued,
}: {
  el: ComparisonElement;
  seed: string;
  continued?: boolean;
}) {
  const importance = importanceOf(el);

  // `rows` is `list[tuple[str, str]]` in the schema, but it arrives as JSON from
  // a language model — a short row or a bare string should degrade, not throw.
  const rows: [string, string][] = (el.rows ?? []).map((r) =>
    Array.isArray(r)
      ? [String(r[0] ?? ''), String(r[1] ?? '')]
      : [String(r ?? ''), ''],
  );

  return (
    <div className="el" style={{ paddingBottom: EL_GAP }}>
      <div className="el-body">
        <div data-head="1">
          {(el.title || continued) && (
            <div style={{ fontSize: 20, lineHeight: `${LINE_H}px`, color: '#1a2660' }}>
              <Hand text={el.title ?? 'Comparison'} seed={`${seed}-title`} importance="medium" />
              {continued && <ContdMarker />}
            </div>
          )}
          <Row
            header
            left={String(el.left_label ?? '')}
            right={String(el.right_label ?? '')}
            seed={seed}
            importance={importance}
          />
        </div>

        {rows.map(([l, r], i) => (
          <Row key={i} index={i} left={l} right={r} seed={seed} importance={importance} />
        ))}
      </div>
    </div>
  );
}
