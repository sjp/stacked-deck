import { describe, expect, it } from "vitest";
import { MAX_AUTO_MOVES, settle } from "./game.ts";
import { walk } from "./testing.ts";
import { VARIANTS } from "./variants/index.ts";

describe("settle", () => {
  it.each(VARIANTS.map((variant) => [variant.id, variant] as const))(
    "stops well before its safety limit (%s)",
    (_, variant) => {
      const counts = [1, 2, 3].flatMap((seed) =>
        walk(variant, variant.deal(seed, variant.defaultOptions), 80).map(
          (state) => settle(variant, state, { safeToFoundation: true }).moves.length,
        ),
      );
      // Hitting the limit would mean a variant's automatic moves never settle.
      expect(Math.max(...counts)).toBeLessThan(MAX_AUTO_MOVES);
    },
  );
});
