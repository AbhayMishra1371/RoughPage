/**
 * Deterministic tilt from an id, echoing PaperPage's seeded micro-rotation:
 * same notebook → same tilt on every render.
 */
export function tiltFrom(seed: string, amount = 1.4): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const unit = ((h >>> 0) % 1000) / 1000 - 0.5; // -0.5..0.5
  return Number((unit * 2 * amount).toFixed(2));
}

export function relativeDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
