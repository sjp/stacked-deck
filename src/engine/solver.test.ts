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

  it.each([
    // Found by searching seeds: deals solved quickly with and without auto-moves.
    [klondike, { draw: 1 }, [1, 3, 4, 5]],
    [freecell, {}, [4, 21, 26, 36]],
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
      expect(withAuto.status).not.toBe("exhausted");
    }
  });

  it("exhausts a dead end", () => {
    // Found by searching seeds: classic Golf deal 1 can't be won.
    expect(solve(golf, golf.deal(1, { wrap: false, onKing: false }), LIMITS).status).toBe(
      "exhausted",
    );
  });

  it("gives up at its limits", () => {
    const result = solve(spider, spider.deal(1, { suits: 4 }), { maxNodes: 50, maxMs: 1000 });
    expect(result.status).toBe("gave-up");
  });
});

/** Golf searched best-first: the fewer cards left in the columns, the closer to a win. */
const bestFirstGolf: Variant = {
  ...golf,
  solverEstimate: (state) =>
    state.piles
      .filter((pile) => pile.kind === "tableau")
      .reduce((sum, pile) => sum + pile.cards.length, 0),
};

describe("solve, best-first", () => {
  it("finds a solution that replays to a win", () => {
    const start = bestFirstGolf.deal(1, { wrap: true, onKing: true });
    const result = solve(bestFirstGolf, start, LIMITS);
    expect(result.status).toBe("solved");
    expect(replaysToWin(bestFirstGolf, start, solutionOf(result))).toBe(true);
  });

  it("exhausts a dead end", () => {
    const start = bestFirstGolf.deal(1, { wrap: false, onKing: false });
    expect(solve(bestFirstGolf, start, LIMITS).status).toBe("exhausted");
  });

  it("gives up at its node limit", () => {
    const start = bestFirstGolf.deal(1, { wrap: true, onKing: true });
    expect(solve(bestFirstGolf, start, { maxNodes: 5, maxMs: 1000 })).toEqual({
      status: "gave-up",
      nodes: 6,
    });
  });

  it("gives up at its time limit", () => {
    let time = 0;
    const now = () => {
      time += 1000;
      return time;
    };
    const start = bestFirstGolf.deal(1, { wrap: true, onKing: true });
    const result = solve(bestFirstGolf, start, { maxNodes: 1_000_000, maxMs: 1 }, { now });
    expect(result).toEqual({ status: "gave-up", nodes: 256 });
  });

  it("wins FreeCell deals that depth-first search can't within the same node limit", () => {
    // Found by searching seeds: best-first wins each in a few thousand positions.
    const seeds = [1, 3, 5, 6, 20];
    const limits = { maxNodes: 10_000, maxMs: 10_000 };
    const depthFirstFreecell: Variant = { ...freecell };
    delete depthFirstFreecell.solverEstimate;
    expect(freecell).toHaveProperty("solverEstimate");
    for (const seed of seeds) {
      const start = freecell.deal(seed, {});
      const bestFirst = solve(freecell, start, limits);
      expect(bestFirst.status, `seed ${seed}`).toBe("solved");
      expect(replaysToWin(freecell, start, solutionOf(bestFirst))).toBe(true);
      expect(solve(depthFirstFreecell, start, limits).status, `seed ${seed}`).toBe("gave-up");
    }
  });
});
