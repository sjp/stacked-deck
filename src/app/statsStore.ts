import type { Stats, StatsRecord } from "./stats.ts";
import { EMPTY_RECORD, parseStats } from "./stats.ts";
import type { KeyValueStore } from "./storage.ts";
import { readStored, removeStored, writeStored } from "./storage.ts";

const KEY = "stats";

export function loadStats(store?: KeyValueStore): Stats {
  return parseStats(readStored(KEY, store));
}

/**
 * Updates one record and returns the new one. Nothing is written when the update returns
 * the record unchanged, so an abandon with no history doesn't add an empty row.
 */
export function updateRecord(
  key: string,
  update: (record: StatsRecord) => StatsRecord,
  store?: KeyValueStore,
): StatsRecord {
  const stats = loadStats(store);
  const current = stats[key] ?? EMPTY_RECORD;
  const record = update(current);
  if (record !== current) {
    writeStored(KEY, { ...stats, [key]: record }, store);
  }
  return record;
}

export function resetStats(store?: KeyValueStore): void {
  removeStored(KEY, store);
}
