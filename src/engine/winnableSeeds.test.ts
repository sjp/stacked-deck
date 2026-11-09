import { describe, expect, it } from "vitest";
import { allOptionSets, dealKey } from "./dealKey.ts";
import { solve } from "./solver.ts";
import { VARIANTS } from "./variants/index.ts";
import { WINNABLE_SEEDS } from "./winnableSeeds.ts";

const KEYS = new Map(
  VARIANTS.flatMap((variant) =>
    allOptionSets(variant).map(
      (options) => [dealKey(variant, options), { variant, options }] as const,
    ),
  ),
);

function isSeed(seed: number): boolean {
  return Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32;
}

function solved(key: string, seed: number, maxMs: number): boolean {
  const entry = KEYS.get(key)!;
  const result = solve(entry.variant, entry.variant.deal(seed, entry.options), {
    maxNodes: Number.POSITIVE_INFINITY,
    maxMs,
  });
  return result.status === "solved";
}

describe("bundled winnable seeds", () => {
  it("are listed under real option sets as unique 32-bit seeds", () => {
    for (const [key, seeds] of Object.entries(WINNABLE_SEEDS)) {
      expect(KEYS.has(key)).toBe(true);
      expect(new Set(seeds).size).toBe(seeds.length);
      expect(seeds.filter((seed) => !isSeed(seed))).toEqual([]);
    }
  });

  // A different listed deal each run, from the option sets the solver wins quickly.
  // `node scripts/find-winnable.ts --verify` checks every listed deal (slow).
  it.each(["klondike:draw=1", "freecell", "tripeaks:wrap=true", "golf:wrap=true:onKing=true"])(
    "really are winnable (%s, a random listed deal)",
    (key) => {
      const seeds = WINNABLE_SEEDS[key]!;
      const seed = seeds[Math.floor(Math.random() * seeds.length)]!;
      expect(solved(key, seed, 8000), `seed ${seed}`).toBe(true);
    },
    15_000,
  );
});
