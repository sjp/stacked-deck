import type { Stats, StatsRecord } from "./stats.ts";
import { EMPTY_RECORD, parseStats } from "./stats.ts";
import { readStored, removeStored, writeStored } from "./storage.ts";

const KEY = "stats";

export function loadStats(): Stats {
  return parseStats(readStored(KEY));
}

/** Updates one record and returns the new one. */
export function updateRecord(
  key: string,
  update: (record: StatsRecord) => StatsRecord,
): StatsRecord {
  const stats = loadStats();
  const record = update(stats[key] ?? EMPTY_RECORD);
  writeStored(KEY, { ...stats, [key]: record });
  return record;
}

export function resetStats(): void {
  removeStored(KEY);
}
