import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Move, VariantOptions } from "../engine/types.ts";
import type { AutoMoveOptions, Variant } from "../engine/variant.ts";
import type { DealLink } from "./deals.ts";
import { findWinnableSeed, loadGame } from "./deals.ts";
import type { Settings } from "./settings.ts";
import { optionsFor } from "./settings.ts";
import { useAutoFinish } from "./useAutoFinish.ts";
import { useAutoSave } from "./useAutoSave.ts";
import type { Ending } from "./useGameOutcome.ts";
import { endingFor, useGameOutcome } from "./useGameOutcome.ts";
import {
  currentState,
  hasStarted,
  moveCount,
  newGame,
  redoable,
  undoable,
  useGame,
} from "./useGame.ts";
import { useGameClock } from "./useTimer.ts";

export type { DealLink } from "./deals.ts";
export type { Ending } from "./useGameOutcome.ts";

interface Options {
  readonly variant: Variant;
  /** A deal link to open. */
  readonly link: DealLink | undefined;
  readonly settings: Settings;
  /** Pause the timer (a dialog is open). */
  readonly paused: boolean;
}

/** A game together with its timer, hint count and saving. */
export function useGameSession({ variant, link, settings, paused }: Options) {
  const auto: AutoMoveOptions = useMemo(
    () => ({ safeToFoundation: settings.autoFoundation }),
    [settings.autoFoundation],
  );
  const [initial] = useState(() =>
    loadGame(variant, link, optionsFor(settings, variant), auto, settings.winnableOnly),
  );
  const [pendingLink, setPendingLink] = useState(initial.pendingLink);
  const { game, dispatch, replace } = useGame(() => initial.game);
  const [hints, setHints] = useState(initial.hints);
  const state = currentState(game);
  const won = variant.isWon(state);
  const started = hasStarted(game);
  // The timer runs from the first move until the win, while the page is visible and no
  // question is waiting.
  const timer = useGameClock(
    initial.elapsedMs,
    started && !won && !paused && pendingLink === undefined,
  );
  const canFinish = !won && variant.canFinish?.(state) === true;
  const [finishRequested, setFinishRequested] = useState(false);
  const finishing = canFinish && (settings.autoFinish || finishRequested);
  useAutoFinish(variant, state, finishing, settings.animation, auto, dispatch);

  const [gameNumber, setGameNumber] = useState(0);
  const outcome = useGameOutcome(game, gameNumber, won, timer, hints);

  const save = useAutoSave(game, hints, timer, outcome.ended);

  const { end } = outcome;
  const [dealing, setDealing] = useState(false);
  const dealRequest = useRef<AbortController | undefined>(undefined);
  useEffect(
    () => () => {
      dealRequest.current?.abort();
    },
    [],
  );

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
      end(ending ?? endingFor(variant, state));
      // Drop the ended game's save now, in case the page closes before the next deal.
      save();
      // A newer deal replaces any search still running.
      dealRequest.current?.abort();
      if (dealSeed !== undefined || !settings.winnableOnly) {
        setDealing(false);
        begin(dealOptions, dealSeed);
        return;
      }
      setDealing(true);
      const controller = new AbortController();
      dealRequest.current = controller;
      const deal = async () => {
        let found: number | undefined;
        try {
          found = await findWinnableSeed(variant, dealOptions, controller.signal);
        } catch (error) {
          console.warn("Could not find a winnable deal", error);
        }
        if (!controller.signal.aborted) {
          setDealing(false);
          begin(dealOptions, found);
        }
      };
      void deal();
    },
    [begin, end, save, settings.winnableOnly, state, variant],
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
      auto,
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
      /** True while a deal link waits to replace the game in progress. */
      linkPending: pendingLink !== undefined,
      /** Ends the game in progress and deals the waiting link. */
      openLink: () => {
        if (pendingLink !== undefined) {
          setPendingLink(undefined);
          start(pendingLink.options, pendingLink.seed);
        }
      },
      /** Keeps the game in progress and drops the waiting link. */
      dropLink: () => {
        setPendingLink(undefined);
      },
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
      auto,
      canFinish,
      dealing,
      dispatch,
      finishing,
      game,
      hints,
      outcome.newBests,
      pendingLink,
      play,
      start,
      state,
      timer,
      won,
    ],
  );
}
