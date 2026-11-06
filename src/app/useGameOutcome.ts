import { useCallback, useEffect, useRef, useState } from "react";
import { recordDailyWin } from "./dailyStore.ts";
import { emitFeedback } from "./feedback.ts";
import { recordAbandon, recordLoss, recordWin, statsKey } from "./stats.ts";
import { updateRecord } from "./statsStore.ts";
import type { Game } from "./useGame.ts";
import { currentState, moveCount } from "./useGame.ts";
import type { Timer } from "./useTimer.ts";

export type Ending = "abandon" | "loss";

/**
 * Records each game's result once: a win when it happens, or a loss or abandonment when
 * the player moves on. `gameNumber` changes with every new deal.
 */
export function useGameOutcome(
  game: Game,
  gameNumber: number,
  won: boolean,
  timer: Timer,
  hints: number,
  daily?: string,
) {
  const recorded = useRef<number | undefined>(undefined);
  const [newBests, setNewBests] = useState<{ game: number; bests: readonly string[] }>();
  const key = statsKey(game.variant, game.options);

  useEffect(() => {
    if (!won || recorded.current === gameNumber) {
      return;
    }
    recorded.current = gameNumber;
    emitFeedback("win");
    const elapsedMs = Math.round(timer.elapsed());
    if (daily !== undefined) {
      recordDailyWin(daily, game.variant.id, { elapsedMs, moves: moveCount(game) });
    }
    let bests: string[] = [];
    updateRecord(key, (record) => {
      const result = recordWin(record, {
        elapsedMs,
        moves: moveCount(game),
        score: game.variant.scored ? currentState(game).score : undefined,
        lowScoreWins: game.variant.lowScoreWins === true,
        hints,
        undos: game.undos,
      });
      bests = result.newBests;
      return result.record;
    });
    setNewBests({ game: gameNumber, bests });
  }, [daily, game, gameNumber, hints, key, timer, won]);

  /** Call before dealing again: counts the current game as lost or abandoned. */
  const end = useCallback(
    (ending: Ending) => {
      if (recorded.current === gameNumber || moveCount(game) === 0) {
        return;
      }
      recorded.current = gameNumber;
      updateRecord(key, (record) =>
        ending === "loss"
          ? recordLoss(record, { hints, undos: game.undos })
          : recordAbandon(record),
      );
    },
    [game, gameNumber, hints, key],
  );

  return { end, newBests: newBests?.game === gameNumber ? newBests.bests : [] };
}
