import { useCallback, useEffect, useRef } from "react";
import { clearGame, saveGame } from "./gameStore.ts";
import type { Game } from "./useGame.ts";
import { currentState } from "./useGame.ts";
import type { Timer } from "./useTimer.ts";

/**
 * Saves the game after every change, and again when the page is hidden or unloaded (iOS
 * doesn't reliably fire beforeunload) or the game screen closes, so time spent thinking
<<<<<<< Updated upstream
 * since the last move is kept. A won game's save is removed.
=======
 * since the last move is kept. A game that is won or whose outcome is already recorded
 * (`ended`) has its save removed, so it can't be resumed and recorded again. Returns the
 * save function, for saving straight after a game ends.
>>>>>>> Stashed changes
 */
export function useAutoSave(
  game: Game,
  hints: number,
  timer: Timer,
  ended: () => boolean,
): () => void {
  const latest = useRef({ game, hints });
  const save = useCallback(() => {
    const current = latest.current;
    if (ended() || current.game.variant.isWon(currentState(current.game))) {
      clearGame(current.game.variant.id);
      return;
    }
    saveGame(current.game, {
      hints: current.hints,
      elapsedMs: Math.round(timer.elapsed()),
    });
  }, [ended, timer]);

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
      save();
    };
  }, [save]);

  return save;
}
