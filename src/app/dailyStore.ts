import { readStored, writeStored } from "./storage.ts";

export interface DailyResult {
  readonly elapsedMs: number;
  readonly moves: number;
}

/** Won daily deals: date → variant → result. */
export type DailyResults = Readonly<Record<string, Readonly<Record<string, DailyResult>>>>;

const KEY = "daily";

function isResult(value: unknown): value is DailyResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "elapsedMs" in value &&
    typeof value.elapsedMs === "number" &&
    "moves" in value &&
    typeof value.moves === "number"
  );
}

export function loadDailyResults(): DailyResults {
  const data = readStored(KEY);
  if (typeof data !== "object" || data === null) {
    return {};
  }
  const results: Record<string, Record<string, DailyResult>> = {};
  const days: [string, unknown][] = Object.entries(data);
  for (const [date, day] of days) {
    const entries: [string, unknown][] =
      typeof day === "object" && day !== null ? Object.entries(day) : [];
    for (const [variant, result] of entries) {
      if (isResult(result)) {
        results[date] = { ...results[date], [variant]: result };
      }
    }
  }
  return results;
}

/** Keeps the first win for each day and variant. */
export function recordDailyWin(date: string, variant: string, result: DailyResult): void {
  const results = loadDailyResults();
  if (results[date]?.[variant] !== undefined) {
    return;
  }
  writeStored(KEY, { ...results, [date]: { ...results[date], [variant]: result } });
}
