import { describe, expect, it } from "vitest";
import { play, settle } from "./game.ts";
import type { SolveResult } from "./solver.ts";
import { SOLVER_AUTO, solve } from "./solver.ts";
import type { GameState, Move } from "./types.ts";
import type { Variant } from "./variant.ts";
import { freecell } from "./variants/freecell/freecell.ts";
import { golf } from "./variants/golf/golf.ts";
import { klondike } from "./variants/klondike/klondike.ts";
import { spider } from "./variants/spider/spider.ts";
import { tripeaks } from "./variants/tripeaks/tripeaks.ts";

function solutionOf(result: SolveResult): readonly Move[] {
  return result.status === "solved" ? result.moves : [];
}

const LIMITS = { maxNodes: 2_000_000, maxMs: 5000 };

/**
 * Replays a solution the way a player would: from the deal after its automatic moves,
 * with automatic moves after each move.
 */
function replaysToWin(variant: Variant, start: GameState, moves: readonly Move[]): boolean {
  let state: GameState | undefined = settle(variant, start, SOLVER_AUTO).state;
  for (const move of moves) {
    state = state === undefined ? undefined : play(variant, state, move, SOLVER_AUTO)?.state;
  }
  return state !== undefined && variant.isWon(state);
}

describe("solve", () => {
  it.each([
    [klondike, { draw: 1 }, 1],
    [klondike, { draw: 1 }, 2],
    [spider, { suits: 1 }, 1],
    [freecell, {}, 2],
    [tripeaks, { wrap: true }, 1],
    [golf, { wrap: true, onKing: true }, 1],
  ])("finds a solution that replays to a win (%#)", (variant, options, seed) => {
    const start = variant.deal(seed, options);
    const result = solve(variant, start, LIMITS);
    expect(result.status).toBe("solved");
    expect(replaysToWin(variant, start, solutionOf(result))).toBe(true);
  });

  it("proves a dead end unsolvable", () => {
    // Found by searching seeds: classic Golf deal 1 can't be won.
    expect(solve(golf, golf.deal(1, { wrap: false, onKing: false }), LIMITS).status).toBe(
      "unsolvable",
    );
  });

  it("gives up at its limits", () => {
    const result = solve(spider, spider.deal(1, { suits: 4 }), { maxNodes: 50, maxMs: 1000 });
    expect(result.status).toBe("gave-up");
  });
});
