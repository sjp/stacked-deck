import { dealKey } from "../engine/dealKey.ts";

/** Results for one variant and option set, such as Klondike Draw 3. */
export interface StatsRecord {
  readonly played: number;
  readonly won: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly bestTimeMs?: number | undefined;
  readonly bestScore?: number | undefined;
  readonly fewestMoves?: number | undefined;
  /** Sum of winning times, for the average. */
  readonly totalWinMs: number;
  readonly hintsUsed: number;
  readonly undosUsed: number;
}

export type Stats = Readonly<Record<string, StatsRecord>>;

export const EMPTY_RECORD: StatsRecord = {
  played: 0,
  won: 0,
  streak: 0,
  bestStreak: 0,
  totalWinMs: 0,
  hintsUsed: 0,
  undosUsed: 0,
};

/** Stats are kept separately for each set of options that changes the deal. */
export const statsKey = dealKey;

export interface Finished {
  readonly elapsedMs: number;
  readonly moves: number;
  /** Undefined for variants without a score. */
  readonly score: number | undefined;
  /** True when lower scores are better (Golf). */
  readonly lowScoreWins?: boolean;
  readonly hints: number;
  readonly undos: number;
}

function better(value: number, best: number | undefined, lowerIsBetter: boolean): boolean {
  return best === undefined || (lowerIsBetter ? value < best : value > best);
}

export function recordWin(
  record: StatsRecord,
  game: Finished,
): { record: StatsRecord; newBests: string[] } {
  const newBests: string[] = [];
  const hadWins = record.won > 0;

  const bestTimeMs = better(game.elapsedMs, record.bestTimeMs, true)
    ? game.elapsedMs
    : record.bestTimeMs;
  if (hadWins && bestTimeMs !== record.bestTimeMs) {
    newBests.push("time");
  }
  const fewestMoves = better(game.moves, record.fewestMoves, true)
    ? game.moves
    : record.fewestMoves;
  if (hadWins && fewestMoves !== record.fewestMoves) {
    newBests.push("moves");
  }
  let { bestScore } = record;
  if (game.score !== undefined && better(game.score, bestScore, game.lowScoreWins === true)) {
    bestScore = game.score;
    if (hadWins) {
      newBests.push("score");
    }
  }
  const streak = record.streak + 1;
  return {
    record: {
      ...record,
      played: record.played + 1,
      won: record.won + 1,
      streak,
      bestStreak: Math.max(record.bestStreak, streak),
      bestTimeMs,
      bestScore,
      fewestMoves,
      totalWinMs: record.totalWinMs + game.elapsedMs,
      hintsUsed: record.hintsUsed + game.hints,
      undosUsed: record.undosUsed + game.undos,
    },
    newBests,
  };
}

/** The player gave up, or the game can't continue. */
export function recordLoss(
  record: StatsRecord,
  game: Pick<Finished, "hints" | "undos">,
): StatsRecord {
  return {
    ...record,
    played: record.played + 1,
    streak: 0,
    hintsUsed: record.hintsUsed + game.hints,
    undosUsed: record.undosUsed + game.undos,
  };
}

/** An abandoned game isn't counted, but it ends the streak so quitting can't protect one. */
export function recordAbandon(record: StatsRecord): StatsRecord {
  return record.streak === 0 ? record : { ...record, streak: 0 };
}

export function winRate(record: StatsRecord): number {
  return record.played === 0 ? 0 : record.won / record.played;
}

export function averageWinMs(record: StatsRecord): number | undefined {
  return record.won === 0 ? undefined : record.totalWinMs / record.won;
}

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const optional = (item: unknown): number | undefined =>
  typeof item === "number" && Number.isFinite(item) ? item : undefined;

function parseRecord(value: unknown): StatsRecord | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record: Partial<Record<keyof StatsRecord, unknown>> = value;
  const { played, won, streak, bestStreak, totalWinMs, hintsUsed, undosUsed } = record;
  if (
    !isCount(played) ||
    !isCount(won) ||
    !isCount(streak) ||
    !isCount(bestStreak) ||
    !isCount(totalWinMs) ||
    !isCount(hintsUsed) ||
    !isCount(undosUsed) ||
    won > played
  ) {
    return undefined;
  }
  return {
    played,
    won,
    streak,
    bestStreak,
    totalWinMs,
    hintsUsed,
    undosUsed,
    bestTimeMs: optional(record.bestTimeMs),
    bestScore: optional(record.bestScore),
    fewestMoves: optional(record.fewestMoves),
  };
}

export function parseStats(data: unknown): Stats {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {};
  }
  const stats: Record<string, StatsRecord> = {};
  for (const [key, value] of Object.entries(data)) {
    const record = parseRecord(value);
    if (record !== undefined) {
      stats[key] = record;
    }
  }
  return stats;
}
