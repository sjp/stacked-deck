/** Seeds are unsigned 32-bit integers, so a deal can be shared as a short number. */
export function normalizeSeed(seed: number): number {
  return Math.trunc(seed) >>> 0;
}

/** mulberry32: a small, fast PRNG with a 32-bit state. Returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = normalizeSeed(seed);
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}

/** A 32-bit FNV-1a hash of a string, for deriving seeds from text such as a date. */
export function hashString(text: string): number {
  let hash = 0x81_1c_9d_c5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.codePointAt(i) ?? 0;
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return hash >>> 0;
}
