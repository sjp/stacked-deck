import { describe, expect, it } from "vitest";
import { play, settle } from "./game.ts";
import { solve } from "./solver.ts";
import type { GameState, Move, VariantOptions } from "./types.ts";
import type { Variant } from "./variant.ts";
import { getVariant } from "./variants/index.ts";

const OFF = { safeToFoundation: false };

/**
 * Follows solver hints the way a player with auto-moves off would, returning each position
 * and the hint given for it.
 */
function followHints(variant: Variant, start: GameState, steps: number): [GameState, Move][] {
  const hints: [GameState, Move][] = [];
  let state = settle(variant, start, OFF).state;
  for (let step = 0; step < steps && !variant.isWon(state); step++) {
    const result = solve(variant, state, { maxNodes: 50_000, maxMs: 3000 }, { startAuto: OFF });
    const first = result.status === "solved" ? result.moves[0] : undefined;
    if (first === undefined) {
      break;
    }
    hints.push([state, first]);
    const next = play(variant, state, first, OFF);
    if (next === undefined) {
      break;
    }
    state = next.state;
  }
  return hints;
}

describe("solver hints", () => {
  it.each<[string, VariantOptions, number]>([
    ["klondike", { draw: 1 }, 1],
    ["klondike", { draw: 3 }, 1],
    ["spider", { suits: 1 }, 1],
    ["freecell", {}, 2],
    ["pyramid", { passes: 3 }, 3],
    ["tripeaks", { wrap: true }, 1],
    ["golf", { wrap: true, onKing: true }, 3],
  ])("suggest a legal first move with auto-moves off (%s %o)", (id, options, seed) => {
    const variant = getVariant(id)!;
    const hints = followHints(variant, variant.deal(seed, options), 12);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.filter(([state, move]) => !variant.canMove(state, move))).toEqual([]);
  });
});
