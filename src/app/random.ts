/** A random 32-bit seed for a new deal. */
export function randomSeed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] ?? 0;
}
