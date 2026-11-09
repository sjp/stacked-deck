import { settle } from "./game.ts";
import { SOLVER_AUTO } from "./solver.ts";
import { pilesKey } from "./state.ts";
import type { GameState, Move } from "./types.ts";
import type { AutoMoveOptions, Variant } from "./variant.ts";

export interface HintLine {
  readonly variant: Variant;
  /**
   * The line's next move from a position on screen, or undefined when the position isn't
   * on the line (or nothing playable there keeps to it).
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
 * already passed. When the line's move has to wait for a card the player's automatic moves
 * left out, the hint is to move that card up first.
 */
export function hintLine(
  variant: Variant,
  start: GameState,
  moves: readonly Move[],
  startAuto: AutoMoveOptions = SOLVER_AUTO,
): HintLine {
  const key = (state: GameState) => variant.stateKey?.(state) ?? pilesKey(state);
  const settledKey = (state: GameState) => key(settle(variant, state, SOLVER_AUTO).state);

  // The key of each position along the line. Settled, the start can share a key with a
  // later position: when the player's automatic moves left cards out, the line may begin
  // by moving them up.
  const keys: string[] = [];
  let position = settle(variant, start, startAuto).state;
  keys.push(settledKey(position));
  for (const move of moves) {
    position = settle(variant, variant.applyMove(position, move), SOLVER_AUTO).state;
    keys.push(key(position));
  }
  const places = new Map<string, number[]>();
  for (const [at, positionKey] of keys.entries()) {
    places.set(positionKey, [...(places.get(positionKey) ?? []), at]);
  }

  return {
    variant,
    next(state) {
      const settled = settle(variant, state, SOLVER_AUTO);
      // Nearest the end first, among the places this position matches.
      const matches = places.get(key(settled.state))?.toReversed() ?? [];
      for (const at of matches) {
        const move = moves[at];
        if (
          move !== undefined &&
          variant.canMove(state, move) &&
          settledKey(variant.applyMove(state, move)) === keys[at + 1]
        ) {
          return move;
        }
      }
      const waiting = matches.length > 0 ? settled.moves[0] : undefined;
      return waiting !== undefined && variant.canMove(state, waiting) ? waiting : undefined;
    },
  };
}
