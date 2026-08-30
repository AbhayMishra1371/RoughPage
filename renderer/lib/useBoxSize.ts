'use client';

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

export interface Box {
  w: number;
  h: number;
}

/**
 * Reports an element's rendered box so rough.js overlays can be sized to wrap
 * real, laid-out content rather than a guess.
 *
 * IMPORTANT — MARGINS ARE INVISIBLE HERE.
 * `getBoundingClientRect()` includes padding and border but EXCLUDES margin. If
 * an element used margin for its vertical spacing, the measure pass would
 * under-report its height and the page would silently overflow. So every
 * element in this renderer spaces itself with PADDING, never margin. That
 * convention is load-bearing, not stylistic.
 *
 * Overlays are absolutely positioned, so adding one cannot change the box that
 * was just measured — this settles after a single extra render instead of
 * oscillating.
 */
export function useBoxSize<T extends HTMLElement>(): [RefObject<T | null>, Box] {
  const ref = useRef<T | null>(null);
  const [box, setBox] = useState<Box>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const read = () => {
      const r = node.getBoundingClientRect();
      // Round to whole pixels; sub-pixel churn would retrigger renders forever.
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };

    read();

    const ro = new ResizeObserver(read);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  return [ref, box];
}

/**
 * The same idea, read from `offsetWidth`/`offsetHeight` instead.
 *
 * USE THIS WHENEVER THE MEASUREMENT DECIDES A TRANSFORM ON THE MEASURED NODE.
 * `getBoundingClientRect()` reports the box AFTER transforms, so scaling a node
 * by a factor derived from its own rect is a feedback loop: measure 500 → scale to
 * 0.8 → measure 400 → scale back to 1 → measure 500, forever, and the render never
 * goes quiet for the readiness handshake. `offsetWidth` is untransformed layout
 * geometry, so the natural size stays constant and the scale converges after one
 * extra pass. (Same reason the grid audit reads `offsetTop` rather than rects —
 * every page carries a seeded rotation, and a rotated rect is the inflated
 * axis-aligned box, not the element.)
 *
 * The trade is that `offsetWidth` is integer-rounded by the browser and excludes
 * transforms — both fine here, and neither is true of a rough.js overlay, which is
 * why `useBoxSize` above is still the right tool for those.
 */
export function useLayoutBox<T extends HTMLElement>(): [RefObject<T | null>, Box] {
  const ref = useRef<T | null>(null);
  const [box, setBox] = useState<Box>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const read = () => {
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };

    read();

    const ro = new ResizeObserver(read);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  return [ref, box];
}
