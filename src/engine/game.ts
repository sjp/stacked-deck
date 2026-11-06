import type { GameState, Move } from "./types.ts";
import type { AutoMoveOptions, Variant } from "./variant.ts";

/** One player action: the move they made followed by any automatic moves. */
export interface Step {
  readonly moves: readonly Move[];
  readonly state: GameState;
}

/** Guards against a variant whose automatic moves never settle. */
const MAX_AUTO_MOVES = 500;

/** Applies automatic moves until none are left. */
export function settle(
  variant: Variant,
  state: GameState,
  options: AutoMoveOptions,
): { state: GameState; moves: Move[] } {
  const moves: Move[] = [];
  let current = state;
  for (let i = 0; i < MAX_AUTO_MOVES; i++) {
    const move = variant.autoMove(current, options);
    if (move === undefined) {
      break;
    }
    moves.push(move);
    current = variant.applyMove(current, move);
  }
  return { state: current, moves };
}

/** Applies a player's move and the automatic moves that follow it. */
export function play(
  variant: Variant,
  state: GameState,
  move: Move,
  options: AutoMoveOptions,
): Step | undefined {
  if (!variant.canMove(state, move)) {
    return undefined;
  }
  const settled = settle(variant, variant.applyMove(state, move), options);
  return { moves: [move, ...settled.moves], state: settled.state };
}

/** Rebuilds a state by replaying recorded moves, which already include automatic ones. */
export function replay(
  variant: Variant,
  start: GameState,
  steps: readonly (readonly Move[])[],
): GameState[] {
  const states: GameState[] = [];
  let current = start;
  for (const moves of steps) {
    for (const move of moves) {
      if (!variant.canMove(current, move)) {
        throw new Error(`Illegal move while replaying: ${JSON.stringify(move)}`);
      }
      current = variant.applyMove(current, move);
    }
    states.push(current);
  }
  return states;
}

export function sameMove(a: Move, b: Move): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
