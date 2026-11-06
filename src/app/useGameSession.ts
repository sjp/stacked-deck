import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Move, VariantOptions } from "../engine/types.ts";
import type { AutoMoveOptions, Variant } from "../engine/variant.ts";
import { parseSaved, restoreGame, toSaved } from "./savedGame.ts";
import type { Settings } from "./settings.ts";
import { optionsFor } from "./settings.ts";
import { readStored, removeStored, writeStored } from "./storage.ts";
import type { Game } from "./useGame.ts";
import { currentState, moveCount, newGame, redoable, undoable, useGame } from "./useGame.ts";
import { usePageVisible } from "./usePageVisible.ts";
import { useTimer } from "./useTimer.ts";

export const gameKey = (variantId: string): string => `game:${variantId}`;

interface Loaded {
  readonly game: Game;
  readonly hints: number;
  readonly elapsedMs: number;
}

function load(
  variant: Variant,
  seed: number | undefined,
  options: VariantOptions,
  auto: AutoMoveOptions,
): Loaded {
  const saved = parseSaved(readStored(gameKey(variant.id)));
  if (saved !== undefined && (seed === undefined || seed === saved.seed)) {
    const game = restoreGame(variant, saved);
    if (game !== undefined) {
      return { game, hints: saved.hints, elapsedMs: saved.elapsedMs };
    }
  }
  return { game: newGame(variant, seed, options, auto), hints: 0, elapsedMs: 0 };
}

interface Options {
  readonly variant: Variant;
  readonly seed: number | undefined;
  readonly settings: Settings;
  /** Pause the timer (a dialog is open). */
  readonly paused: boolean;
}

/** A game together with its timer, hint count and saving. */
export function useGameSession({ variant, seed, settings, paused }: Options) {
  const auto: AutoMoveOptions = useMemo(
    () => ({ safeToFoundation: settings.autoFoundation }),
    [settings.autoFoundation],
  );
  const [initial] = useState(() => load(variant, seed, optionsFor(settings, variant), auto));
  const { game, dispatch, replace } = useGame(() => initial.game);
  const [hints, setHints] = useState(initial.hints);
  const timer = useTimer(initial.elapsedMs);
  const visible = usePageVisible();
  const state = currentState(game);
  const won = variant.isWon(state);
  const started = moveCount(game) > 0;

  // The timer runs from the first move until the win, while the page is visible.
  useEffect(() => {
    if (started && !won && visible && !paused) {
      timer.start();
    } else {
      timer.pause();
    }
  }, [started, won, visible, paused, timer]);

  const latest = useRef({ game, hints });
  const save = useCallback(() => {
    const current = latest.current;
    if (variant.isWon(currentState(current.game))) {
      removeStored(gameKey(variant.id));
      return;
    }
    writeStored(
      gameKey(variant.id),
      toSaved(current.game, { hints: current.hints, elapsedMs: Math.round(timer.elapsed()) }),
    );
  }, [timer, variant]);

  useEffect(() => {
    latest.current = { game, hints };
    save();
  }, [game, hints, save]);

  // iOS doesn't reliably fire beforeunload, so also save when the page is hidden.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        save();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    globalThis.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      globalThis.removeEventListener("pagehide", save);
    };
  }, [save]);

  const start = useCallback(
    (dealOptions: VariantOptions, dealSeed: number | undefined) => {
      timer.reset();
      setHints(0);
      replace(newGame(variant, dealSeed, dealOptions, auto));
    },
    [auto, replace, timer, variant],
  );

  const play = useCallback(
    (move: Move): boolean => {
      if (won || !variant.canMove(state, move)) {
        return false;
      }
      dispatch({ type: "play", move, auto });
      return true;
    },
    [auto, dispatch, state, variant, won],
  );

  return useMemo(
    () => ({
      game,
      state,
      won,
      moves: moveCount(game),
      canUndo: undoable(game),
      canRedo: redoable(game),
      hints,
      timer,
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
    [dispatch, game, hints, play, start, state, timer, won],
  );
}

/** Variants with a saved game that has at least one move. */
export function variantsInProgress(variants: readonly Variant[]): Set<string> {
  const ids = new Set<string>();
  for (const variant of variants) {
    const saved = parseSaved(readStored(gameKey(variant.id)));
    if (saved !== undefined && saved.steps.length > 1) {
      ids.add(variant.id);
    }
  }
  return ids;
}
