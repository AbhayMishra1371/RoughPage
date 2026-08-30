/**
 * rng.ts
 * ======
 * Seeded pseudo-randomness.
 *
 * The handwriting illusion needs a lot of jitter: word rotation, ink shade,
 * page tilt, rough.js wobble. If any of it came from `Math.random()`, the same
 * NotebookDocument would produce a different PDF on every run — which makes
 * visual regression diffing impossible and bug reports unreproducible.
 *
 * So: NO `Math.random()` anywhere in this codebase. Everything derives from a
 * seed computed off the document's own content.
 */

/** FNV-1a. Small, fast, good enough to turn a string into a seed. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Rng = () => number;

/**
 * mulberry32 — a compact, well-distributed 32-bit PRNG.
 * Returns a function producing floats in [0, 1).
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds a generator from any set of identifying parts. */
export function rngFrom(...parts: (string | number)[]): Rng {
  return mulberry32(hashString(parts.join('|')));
}

/** A stable integer seed — rough.js takes one directly via its `seed` option. */
export function seedFrom(...parts: (string | number)[]): number {
  return hashString(parts.join('|'));
}

// ── Shaping helpers ─────────────────────────────────────────────────────────

/** Uniform in [min, max). */
export function between(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Symmetric jitter in [-amount, +amount). */
export function jitter(rng: Rng, amount: number): number {
  return (rng() - 0.5) * 2 * amount;
}

/**
 * Sum of two draws, which clusters values toward the middle.
 * Real handwriting varies gently around a mean with occasional outliers —
 * uniform noise looks mechanical by comparison, oddly enough.
 */
export function jitterSoft(rng: Rng, amount: number): number {
  return ((rng() + rng()) / 2 - 0.5) * 2 * amount;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}
