import { describe, expect, it } from "vitest";
import { play, settle } from "./game.ts";
import type { HintLine } from "./hintLine.ts";
import { hintLine } from "./hintLine.ts";
import { SOLVER_AUTO, solve } from "./solver.ts";
import { pilesKey } from "./state.ts";
import type { GameState, Move, VariantOptions } from "./types.ts";
import type { AutoMoveOptions, Variant } from "./variant.ts";
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

/**
 * Takes hints from a kept winning line, with the player's automatic moves `auto`, searching
 * again only when the line has no move for the position. Returns how many searches it took
 * and the key of every position passed through, or undefined if a search failed.
 */
function followLine(
  variant: Variant,
  start: GameState,
  auto: AutoMoveOptions,
  steps: number,
): { searches: number; keys: string[]; won: boolean } | undefined {
  const keyOf = (state: GameState) => variant.stateKey?.(state) ?? pilesKey(state);
  let state = settle(variant, start, auto).state;
  let line: HintLine | undefined;
  let searches = 0;
  const keys = [keyOf(state)];
  for (let step = 0; step < steps && !variant.isWon(state); step++) {
    let move = line?.next(state);
    if (move === undefined) {
      const result = solve(
        variant,
        state,
        { maxNodes: 150_000, maxMs: 10_000 },
        { startAuto: auto },
      );
      if (result.status !== "solved") {
        return undefined;
      }
      searches += 1;
      line = hintLine(variant, state, result.moves, auto);
      move = line.next(state);
    }
    const next = move === undefined ? undefined : play(variant, state, move, auto);
    if (next === undefined) {
      return undefined;
    }
    state = next.state;
    keys.push(keyOf(state));
  }
  return { searches, keys, won: variant.isWon(state) };
}

describe("solver hints", () => {
  it.each<[number, string, AutoMoveOptions]>(
    [1, 2, 3, 4, 5].flatMap((seed) => [
      [seed, "on", SOLVER_AUTO],
      [seed, "off", OFF],
    ]),
  )(
    "win FreeCell deal %i from one search with auto-moves %s, never repeating a position",
    (seed, _label, auto) => {
      const freecell = getVariant("freecell")!;
      const followed = followLine(freecell, freecell.deal(seed, {}), auto, 300);
      expect(followed).toMatchObject({ searches: 1, won: true });
      expect(new Set(followed?.keys).size).toBe(followed?.keys.length);
    },
  );

  it.each<[string, VariantOptions, number]>([
    ["klondike", { draw: 1 }, 1],
    ["klondike", { draw: 3 }, 1],
    ["spider", { suits: 1 }, 1],
    ["freecell", {}, 2],
    ["pyramid", { passes: 3 }, 3],
    ["tripeaks", { wrap: true }, 1],
    ["golf", { wrap: true, onKing: true }, 3],
  ])(
    "suggest a legal first move with auto-moves off (%s %o)",
    { timeout: 30_000 },
    (id, options, seed) => {
      const variant = getVariant(id)!;
      const hints = followHints(variant, variant.deal(seed, options), 12);
      expect(hints.length).toBeGreaterThan(0);
      expect(hints.filter(([state, move]) => !variant.canMove(state, move))).toEqual([]);
    },
  );
});
