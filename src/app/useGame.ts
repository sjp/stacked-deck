import { useCallback, useReducer } from "react";
import type { Step } from "../engine/game.ts";
import { play, settle } from "../engine/game.ts";
import type { History } from "../engine/history.ts";
import { canRedo, canUndo, createHistory, pushHistory, redo, undo } from "../engine/history.ts";
import type { GameState, Move, VariantOptions } from "../engine/types.ts";
import type { AutoMoveOptions, Variant } from "../engine/variant.ts";
import { randomSeed } from "./random.ts";

export interface Game {
  readonly variant: Variant;
  readonly seed: number;
  readonly options: VariantOptions;
  /** Each entry is one player action; the first holds the automatic moves after the deal. */
  readonly history: History<Step>;
  readonly undos: number;
}

/** Deals a new game; without a seed, the deal is random. */
export function newGame(
  variant: Variant,
  seed: number | undefined,
  options: VariantOptions,
  auto: AutoMoveOptions,
): Game {
  const dealt = variant.deal(seed ?? randomSeed(), options);
  const settled = settle(variant, dealt, auto);
  return {
    variant,
    seed: dealt.seed,
    options,
    history: createHistory<Step>({ moves: settled.moves, state: settled.state }),
    undos: 0,
  };
}

export function undoable(game: Game): boolean {
  return canUndo(game.history);
}

export function redoable(game: Game): boolean {
  return canRedo(game.history);
}

export function currentState(game: Game): GameState {
  return game.history.present.state;
}

/** Player actions so far (the deal's automatic moves don't count). */
export function moveCount(game: Game): number {
  return game.history.past.length;
}

/**
 * Whether the player has done anything in this game. Undone moves count, so undoing back to
 * the deal doesn't turn a game in progress back into an untouched one.
 */
export function hasStarted(game: Game): boolean {
  return game.history.past.length > 0 || game.history.future.length > 0 || game.undos > 0;
}

export type GameAction =
  | { readonly type: "play"; readonly move: Move; readonly auto: AutoMoveOptions }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "replace"; readonly game: Game };

export function gameReducer(game: Game, action: GameAction): Game {
  if (action.type === "play") {
    const step = play(game.variant, currentState(game), action.move, action.auto);
    return step === undefined ? game : { ...game, history: pushHistory(game.history, step) };
  }
  if (action.type === "undo") {
    return canUndo(game.history)
      ? { ...game, history: undo(game.history), undos: game.undos + 1 }
      : game;
  }
  if (action.type === "redo") {
    return canRedo(game.history) ? { ...game, history: redo(game.history) } : game;
  }
  return action.game;
}

export function useGame(initial: () => Game) {
  const [game, dispatch] = useReducer(gameReducer, undefined, initial);
  const replace = useCallback((next: Game) => {
    dispatch({ type: "replace", game: next });
  }, []);
  return { game, dispatch, replace };
}
