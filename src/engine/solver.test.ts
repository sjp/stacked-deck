import { describe, expect, it } from "vitest";
import { play, settle } from "./game.ts";
import type { SolveResult } from "./solver.ts";
import { SOLVER_AUTO, solve } from "./solver.ts";
import type { GameState, Move } from "./types.ts";
import type { Variant } from "./variant.ts";
import { freecell } from "./variants/freecell/freecell.ts";
import { golf } from "./variants/golf/golf.ts";
import { klondike } from "./variants/klondike/klondike.ts";
import { pyramid } from "./variants/pyramid/pyramid.ts";
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

  it.each([
    // Found by searching seeds: deals solved quickly with and without auto-moves.
    [klondike, { draw: 1 }, [1, 3, 4, 5]],
    [freecell, {}, [8, 21, 26, 36]],
  ])("finds safe auto-moves never lose a winnable deal (%#)", (variant, options, seeds) => {
    const off = { safeToFoundation: false };
    // The node count stops the search; the time limit is only a backstop.
    const limits = { maxNodes: 20_000, maxMs: 10_000 };
    for (const seed of seeds) {
      const start = variant.deal(seed, options);
      const without = solve(variant, start, limits, { auto: off });
      const withAuto = solve(variant, start, limits);
      // Each deal is won without auto-moves, so the check below can't pass vacuously.
      expect(without.status).toBe("solved");
      // A deal won without auto-moves is still won with them.
      expect(withAuto.status).not.toBe("unsolvable");
    }
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

describe("solver hints", () => {
  const off = { safeToFoundation: false };

  it.each([
    [klondike, { draw: 1 }, 1],
    [klondike, { draw: 3 }, 1],
    [spider, { suits: 1 }, 1],
    [freecell, {}, 2],
    [pyramid, { passes: 3 }, 3],
    [tripeaks, { wrap: true }, 1],
    [golf, { wrap: true, onKing: true }, 3],
  ])("suggest a legal first move with auto-moves off (%#)", (variant, options, seed) => {
    // Follow the hints the way a player with auto-moves off would.
    let state = settle(variant, variant.deal(seed, options), off).state;
    let checked = 0;
    for (let step = 0; step < 12 && !variant.isWon(state); step++) {
      const result = solve(variant, state, { maxNodes: 50_000, maxMs: 3000 }, { startAuto: off });
      const [first] = solutionOf(result);
      if (first === undefined) {
        break;
      }
      expect(variant.canMove(state, first)).toBe(true);
      checked += 1;
      state = play(variant, state, first, off)!.state;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
