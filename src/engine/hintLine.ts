import { settle } from "./game.ts";
import { SOLVER_AUTO } from "./solver.ts";
import { pilesKey } from "./state.ts";
import type { GameState, Move } from "./types.ts";
import type { AutoMoveOptions, Variant } from "./variant.ts";

export interface HintLine {
  readonly variant: Variant;
  /**
   * The line's next move from a position on screen, or undefined when the position isn't
   * on the line (or the line's move doesn't lead to its next position from there).
   */
  next(state: GameState): Move | undefined;
}

/**
 * Remembers a winning line from the solver so later hints can follow it without searching
 * again. `start` is the position the line was solved from and `startAuto` the automatic
 * moves the solver applied to it first; every later position was settled with
 * `SOLVER_AUTO`, as in the search.
 *
 * Positions are compared after settling with `SOLVER_AUTO`, so a player with fewer
 * automatic moves on still matches. A move is served only if it is legal on screen and
 * leads to the line's next position, so following the line never goes back to a position
 * already passed.
 */
export function hintLine(
  variant: Variant,
  start: GameState,
  moves: readonly Move[],
  startAuto: AutoMoveOptions = SOLVER_AUTO,
): HintLine {
  const key = (state: GameState) => variant.stateKey?.(state) ?? pilesKey(state);
  const settledKey = (state: GameState) => key(settle(variant, state, SOLVER_AUTO).state);

  // The key of each position along the line, and which one it is. On a repeat (which the
  // solver doesn't produce), the later position wins, being nearer the end.
  const keys: string[] = [];
  const index = new Map<string, number>();
  let position = settle(variant, start, startAuto).state;
  keys.push(settledKey(position));
  for (const move of moves) {
    position = settle(variant, variant.applyMove(position, move), SOLVER_AUTO).state;
    keys.push(key(position));
  }
  for (const [at, positionKey] of keys.entries()) {
    index.set(positionKey, at);
  }

  return {
    variant,
    next(state) {
      const at = index.get(settledKey(state));
      const move = at === undefined ? undefined : moves[at];
      if (at === undefined || move === undefined || !variant.canMove(state, move)) {
        return undefined;
      }
      return settledKey(variant.applyMove(state, move)) === keys[at + 1] ? move : undefined;
    },
  };
}
