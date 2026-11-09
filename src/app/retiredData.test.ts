import { describe, expect, it } from "vitest";
import { removeRetiredData } from "./retiredData.ts";
import { memoryStore, readStored, writeStored } from "./storage.ts";

describe("retired data", () => {
  it("removes old keys and keeps games and stats", () => {
    const store = memoryStore();
    writeStored("daily", { "2026-11-06": {} }, store);
    writeStored("game:golf:daily", { seed: 1 }, store);
    writeStored("game:golf", { seed: 2 }, store);
    writeStored("stats", { golf: {} }, store);

    removeRetiredData(store);
    removeRetiredData(store);

    expect(readStored("daily", store)).toBeUndefined();
    expect(readStored("game:golf:daily", store)).toBeUndefined();
    expect(readStored("game:golf", store)).toEqual({ seed: 2 });
    expect(readStored("stats", store)).toEqual({ golf: {} });
  });
});
