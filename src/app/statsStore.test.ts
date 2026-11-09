import { describe, expect, it } from "vitest";
import { recordAbandon, recordWin } from "./stats.ts";
import { loadStats, updateRecord } from "./statsStore.ts";
import { memoryStore } from "./storage.ts";

const WIN = {
  elapsedMs: 1000,
  moves: 10,
  score: undefined,
  lowScoreWins: false,
  hints: 0,
  undos: 0,
};

describe("stats store", () => {
  it("doesn't add a row for an abandon with no record", () => {
    const store = memoryStore();
    updateRecord("golf", recordAbandon, store);
    expect(loadStats(store)).toEqual({});
  });

  it("keeps records between updates", () => {
    const store = memoryStore();
    updateRecord("golf", (record) => recordWin(record, WIN).record, store);
    updateRecord("golf", (record) => recordWin(record, WIN).record, store);
    expect(loadStats(store)["golf"]?.streak).toBe(2);
    updateRecord("golf", recordAbandon, store);
    expect(loadStats(store)["golf"]).toMatchObject({ played: 2, won: 2, streak: 0 });
  });
});
