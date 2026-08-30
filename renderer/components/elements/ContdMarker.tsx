/**
 * ContdMarker.tsx
 * ===============
 * The "(contd.)" annotation a splittable element repeats on its continuation
 * fragment. Used by every element the paginator is allowed to split.
 *
 * WHY THIS IS A COMPONENT AND NOT AN INLINE SPAN.
 * It carries a `line-height: 1` that is load-bearing, and the reason is not
 * obvious enough to survive being retyped by hand in the next splittable
 * element.
 *
 * Inline boxes on one line are aligned by BASELINE, and each gets half of its
 * leftover leading above and below its own text. Two inline boxes that share a
 * `line-height: 32px` but have different font sizes therefore do NOT occupy the
 * same 32px band: the larger one reaches higher above the baseline, the smaller
 * one reaches lower below it, and the line box grows to cover the union of the
 * two. A 15px marker on a 21px row costs about 2px — which snaps the element to
 * a whole extra ruled line and pushes every row inside it off the grid.
 *
 * `line-height: 1` makes the marker's own box small enough to sit entirely
 * inside the row's strut, so it cannot enlarge the line box no matter what font
 * size it is given, while still resting on the same baseline as the text it
 * follows. Do not replace it with the row's `LINE_H`.
 *
 * See the vertical rhythm note in lib/geometry.ts.
 */

export default function ContdMarker() {
  return (
    <span
      style={{
        // Load-bearing — see above. Not LINE_H.
        lineHeight: 1,
        fontSize: 15,
        fontWeight: 400,
        textTransform: 'none',
        opacity: 0.55,
        marginLeft: 8,
      }}
    >
      (contd.)
    </span>
  );
}
