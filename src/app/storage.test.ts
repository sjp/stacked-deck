import { describe, expect, it } from "vitest";
import type { KeyValueStore } from "./storage.ts";
import { memoryStore, readStored, resilientStore, writeStored } from "./storage.ts";

/** A store whose writes always fail, like a full quota. */
function fullStore(): KeyValueStore {
  const store = memoryStore();
  return {
    ...store,
    setItem: () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    },
  };
}

describe("stored values", () => {
  it("migrates data from an older version of its key", () => {
    const store = memoryStore();
    writeStored("game:golf", { seed: 4 }, store);
    const format = {
      version: 2,
      migrate: (data: unknown, from: number) => ({ from, old: data }),
    };
    expect(readStored("game:golf", store, format)).toEqual({ from: 1, old: { seed: 4 } });
  });

  it("ignores data from another version without a migration", () => {
    const store = memoryStore();
    writeStored("game:golf", { seed: 4 }, store, { version: 3 });
    expect(readStored("game:golf", store)).toBeUndefined();
    expect(readStored("game:golf", store, { version: 4 })).toBeUndefined();
  });

  it("keeps each key's version separate", () => {
    const store = memoryStore();
    writeStored("stats", { golf: { played: 1 } }, store);
    writeStored("game:golf", { seed: 4 }, store);
    // The saved-game format moves on; the stats are untouched.
    expect(readStored("game:golf", store, { version: 2 })).toBeUndefined();
    expect(readStored("stats", store)).toEqual({ golf: { played: 1 } });
  });

  it("ignores corrupt text", () => {
    const store = memoryStore();
    store.setItem("stacked-deck:x", "{not json");
    store.setItem("stacked-deck:y", JSON.stringify({ data: 1 }));
    expect(readStored("x", store)).toBeUndefined();
    expect(readStored("y", store)).toBeUndefined();
  });
});

describe("the fallback store", () => {
  it("keeps values in memory when writes fail", () => {
    const store = resilientStore(fullStore);
    writeStored("stats", { a: 1 }, store);
    expect(readStored("stats", store)).toEqual({ a: 1 });
  });

  it("works with no localStorage at all", () => {
    const store = resilientStore(() => undefined);
    writeStored("stats", { a: 2 }, store);
    expect(readStored("stats", store)).toEqual({ a: 2 });
  });

  it("goes back to real storage once writes succeed", () => {
    let local: KeyValueStore = fullStore();
    const store = resilientStore(() => local);
    writeStored("stats", { a: 1 }, store);
    local = memoryStore();
    writeStored("stats", { a: 2 }, store);
    expect(readStored("stats", local)).toEqual({ a: 2 });
    expect(readStored("stats", store)).toEqual({ a: 2 });
  });
});
