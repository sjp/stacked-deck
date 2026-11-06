import { useCallback, useEffect, useRef } from "react";
import { clearGame, saveGame } from "./gameStore.ts";
import type { Game } from "./useGame.ts";
import { currentState } from "./useGame.ts";
import type { Timer } from "./useTimer.ts";

/**
 * Saves the game after every change, and again when the page is hidden or unloaded
 * (iOS doesn't reliably fire beforeunload). A won game's save is removed.
 */
export function useAutoSave(game: Game, hints: number, timer: Timer, daily?: string): void {
  const latest = useRef({ game, hints });
  const save = useCallback(() => {
    const current = latest.current;
    if (current.game.variant.isWon(currentState(current.game))) {
      clearGame(current.game.variant.id, daily !== undefined);
      return;
    }
    saveGame(current.game, {
      hints: current.hints,
      elapsedMs: Math.round(timer.elapsed()),
      daily,
    });
  }, [daily, timer]);

  useEffect(() => {
    latest.current = { game, hints };
    save();
  }, [game, hints, save]);

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
}
