import { describe, expect, it } from "vitest";
import { klondike } from "../engine/variants/klondike/klondike.ts";
import type { Finished } from "./stats.ts";
import {
  averageWinMs,
  EMPTY_RECORD,
  parseStats,
  recordAbandon,
  recordLoss,
  recordWin,
  statsKey,
  winRate,
} from "./stats.ts";

const game = (overrides: Partial<Finished> = {}): Finished => ({
  elapsedMs: 120_000,
  moves: 100,
  score: 500,
  hints: 1,
  undos: 2,
  ...overrides,
});

describe("stats", () => {
  it("keys by option set", () => {
    expect(statsKey(klondike, { draw: 1 })).toBe("klondike:draw=1");
    expect(statsKey(klondike, { draw: 3 })).toBe("klondike:draw=3");
  });

  it("records wins, streaks and bests", () => {
    const first = recordWin(EMPTY_RECORD, game());
    expect(first.newBests).toEqual([]);
    const second = recordWin(first.record, game({ elapsedMs: 90_000, moves: 110, score: 600 }));
    expect(second.newBests).toEqual(["time", "score"]);
    expect(second.record).toMatchObject({
      played: 2,
      won: 2,
      streak: 2,
      bestStreak: 2,
      bestTimeMs: 90_000,
      bestScore: 600,
      fewestMoves: 100,
      hintsUsed: 2,
      undosUsed: 4,
    });
    expect(averageWinMs(second.record)).toBe(105_000);
    expect(winRate(second.record)).toBe(1);
  });

  it("treats lower scores as better when asked", () => {
    const first = recordWin(EMPTY_RECORD, game({ score: 10, lowScoreWins: true }));
    const second = recordWin(first.record, game({ score: 4, lowScoreWins: true }));
    expect(second.record.bestScore).toBe(4);
  });

  it("counts losses but not abandoned games", () => {
    const won = recordWin(EMPTY_RECORD, game()).record;
    const abandoned = recordAbandon(won);
    expect(abandoned.played).toBe(1);
    expect(abandoned.streak).toBe(0);
    expect(abandoned.bestStreak).toBe(1);
    const lost = recordLoss(won, { hints: 0, undos: 0 });
    expect(lost.played).toBe(2);
    expect(winRate(lost)).toBe(0.5);
    expect(lost.streak).toBe(0);
  });

  it("drops invalid stored records", () => {
    const good = recordWin(EMPTY_RECORD, game()).record;
    expect(parseStats({ a: good, b: { played: -1 }, c: "x" })).toEqual({ a: good });
    expect(parseStats(null)).toEqual({});
  });
});
