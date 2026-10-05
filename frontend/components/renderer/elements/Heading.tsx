'use client';

/**
 * Heading.tsx
 * ===========
 * Topic titles. The one place per-CHARACTER jitter is worth its cost — strings
 * are short, the type is large enough for the wobble to actually read, and the
 * node count stays trivial.
 *
 * Spacing is padding, never margin (see lib/useBoxSize.ts for why), and every
 * vertical value is a whole LINE_H so the text lands on the ruled grid.
 *
 * Level 1 deliberately occupies TWO ruled lines: a chapter title is written
 * large enough to cross a line, and letting the rules pass behind the letters
 * looks far more like a real notebook than shrinking the title to fit one band.
 * Level 2 stays on a single line, baseline on the rule.
 */

import { HandChars } from '@/lib/handwriting';
import { EL_GAP, LINE_H } from '@/lib/geometry';
import { seedFrom } from '@/lib/rng';
import { RoughHeadingRule } from '@/lib/roughShapes';
import { useBoxSize } from '@/lib/useBoxSize';
import type { HeadingElement } from '@/lib/types';

export default function Heading({ el, seed }: { el: HeadingElement; seed: string }) {
  const [ref, box] = useBoxSize<HTMLDivElement>();
  const level = el.level === 2 ? 2 : 1;

  return (
    <div className="el" style={{ paddingTop: level === 1 ? EL_GAP : 0 }}>
      <div className="el-body">
        <div
          ref={ref}
          style={{
            display: 'inline-block',
            // Load-bearing. An inline-block is aligned by BASELINE against the
            // parent block's strut, and its half-leading differs from the
            // strut's whenever the font sizes differ — so a level-2 title (23px
            // in a 19px block) makes the line box 2px taller than the LINE_H it
            // asks for, and everything below it, including the rule, drops off
            // the grid. `top` makes this box's own height authoritative: it can
            // never be inflated, and level 1 still correctly grows the row to
            // its full two lines. See lib/geometry.ts.
            verticalAlign: 'top',
            fontSize: level === 1 ? 34 : 23,
            lineHeight: `${level === 1 ? LINE_H * 2 : LINE_H}px`,
            fontWeight: 700,
            color: level === 1 ? '#141f52' : '#22306f',
            letterSpacing: '0.01em',
          }}
        >
          <HandChars text={el.text} seed={`${seed}-h`} intensity={level === 1 ? 1 : 0.7} />
        </div>

        {/*
          The rule gets a full ruled line to itself, drawn near the top of it so
          it still hugs the title rather than floating away from it. The rest of
          that line is the heading's breathing room — hence no paddingBottom.
        */}
        <div style={{ height: LINE_H, position: 'relative' }}>
          {box.w > 0 && (
            <div style={{ position: 'absolute', left: 0, top: 4, width: box.w, height: 14 }}>
              <RoughHeadingRule width={box.w} seed={seedFrom(seed, 'rule')} level={level} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
