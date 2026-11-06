import { useCallback, useMemo, useRef, useState } from "react";
import type { Move, VariantOptions } from "../engine/types.ts";
import type { AutoMoveOptions, Variant } from "../engine/variant.ts";
import { findWinnableSeed, loadGame } from "./deals.ts";
import type { Settings } from "./settings.ts";
import { optionsFor } from "./settings.ts";
import { useAutoFinish } from "./useAutoFinish.ts";
import { useAutoSave } from "./useAutoSave.ts";
import type { Ending } from "./useGameOutcome.ts";
import { useGameOutcome } from "./useGameOutcome.ts";
import { currentState, moveCount, newGame, redoable, undoable, useGame } from "./useGame.ts";
import { useGameClock } from "./useTimer.ts";

interface Options {
  readonly variant: Variant;
  readonly seed: number | undefined;
  readonly settings: Settings;
  /** Pause the timer (a dialog is open). */
  readonly paused: boolean;
  /** The date of the daily deal being played, if it is one. */
  readonly daily?: string | undefined;
}

/** A game together with its timer, hint count and saving. */
export function useGameSession({ variant, seed, settings, paused, daily }: Options) {
  const auto: AutoMoveOptions = useMemo(
    () => ({ safeToFoundation: settings.autoFoundation }),
    [settings.autoFoundation],
  );
  const [initial] = useState(() =>
    loadGame(
      variant,
      seed,
      daily === undefined ? optionsFor(settings, variant) : variant.defaultOptions,
      auto,
      settings.winnableOnly,
      daily,
    ),
  );
  const { game, dispatch, replace } = useGame(() => initial.game);
  const [hints, setHints] = useState(initial.hints);
  const state = currentState(game);
  const won = variant.isWon(state);
  const started = moveCount(game) > 0;
  // The timer runs from the first move until the win, while the page is visible.
  const timer = useGameClock(initial.elapsedMs, started && !won && !paused);
  const canFinish = !won && variant.canFinish?.(state) === true;
  const [finishRequested, setFinishRequested] = useState(false);
  const finishing = canFinish && (settings.autoFinish || finishRequested);
  useAutoFinish(variant, state, finishing, settings.animation, auto, dispatch);

  const [gameNumber, setGameNumber] = useState(0);
  const outcome = useGameOutcome(game, gameNumber, won, timer, hints, daily);

  useAutoSave(game, hints, timer, daily);

  const { end } = outcome;
  const [dealing, setDealing] = useState(false);
  const dealRequest = useRef(0);

  const begin = useCallback(
    (dealOptions: VariantOptions, dealSeed: number | undefined) => {
      setGameNumber((number) => number + 1);
      timer.reset();
      setHints(0);
      setFinishRequested(false);
      replace(newGame(variant, dealSeed, dealOptions, auto));
    },
    [auto, replace, timer, variant],
  );

  /** Ends the current game (as lost or abandoned) and deals another. */
  const start = useCallback(
    (dealOptions: VariantOptions, dealSeed: number | undefined, ending?: Ending) => {
      end(ending ?? (variant.isStuck?.(state) === true ? "loss" : "abandon"));
      dealRequest.current += 1;
      const request = dealRequest.current;
      if (dealSeed !== undefined || !settings.winnableOnly) {
        setDealing(false);
        begin(dealOptions, dealSeed);
        return;
      }
      setDealing(true);
      const deal = async () => {
        let found: number | undefined;
        try {
          found = await findWinnableSeed(variant, dealOptions);
        } catch (error) {
          console.warn("Could not find a winnable deal", error);
        }
        if (request === dealRequest.current) {
          setDealing(false);
          begin(dealOptions, found);
        }
      };
      void deal();
    },
    [begin, end, settings.winnableOnly, state, variant],
  );

  const play = useCallback(
    (move: Move): boolean => {
      if (won || dealing || !variant.canMove(state, move)) {
        return false;
      }
      dispatch({ type: "play", move, auto });
      return true;
    },
    [auto, dealing, dispatch, state, variant, won],
  );

  return useMemo(
    () => ({
      game,
      state,
      won,
      dealing,
      moves: moveCount(game),
      canFinish,
      finishing,
      finish: () => {
        setFinishRequested(true);
      },
      canUndo: undoable(game),
      canRedo: redoable(game),
      hints,
      timer,
      newBests: outcome.newBests,
      play,
      start,
      undo: () => {
        dispatch({ type: "undo" });
      },
      redo: () => {
        dispatch({ type: "redo" });
      },
      countHint: () => {
        setHints((count) => count + 1);
      },
    }),
    [
      canFinish,
      dealing,
      dispatch,
      finishing,
      game,
      hints,
      outcome.newBests,
      play,
      start,
      state,
      timer,
      won,
    ],
  );
}
