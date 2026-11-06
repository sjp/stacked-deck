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

describe("bundled winnable seeds", () => {
  it("are listed under real option sets as unique 32-bit seeds", () => {
    for (const [key, seeds] of Object.entries(WINNABLE_SEEDS)) {
      expect(KEYS.has(key)).toBe(true);
      expect(new Set(seeds).size).toBe(seeds.length);
      expect(seeds.filter((seed) => !isSeed(seed))).toEqual([]);
    }
  });

  it.each(["klondike:draw=1", "freecell", "tripeaks:wrap=true", "golf:wrap=true:onKing=true"])(
    "really are winnable (%s, first listed deal)",
    (key) => {
      const entry = KEYS.get(key)!;
      const seed = WINNABLE_SEEDS[key]![0]!;
      const result = solve(entry.variant, entry.variant.deal(seed, entry.options), {
        maxNodes: Number.POSITIVE_INFINITY,
        maxMs: 8000,
      });
      expect(result.status).toBe("solved");
    },
    15_000,
  );
});
