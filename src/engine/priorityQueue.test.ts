import { describe, expect, it } from "vitest";
import type { PriorityQueue } from "./priorityQueue.ts";
import { priorityQueue } from "./priorityQueue.ts";
import { mulberry32 } from "./rng.ts";

interface Entry {
  readonly priority: number;
  readonly id: number;
}

function drain<T>(queue: PriorityQueue<T>): T[] {
  const items: T[] = [];
  for (let item = queue.pop(); item !== undefined; item = queue.pop()) {
    items.push(item);
  }
  return items;
}

function byPriorityThenId(a: Entry, b: Entry): number {
  return a.priority !== b.priority ? a.priority - b.priority : a.id - b.id;
}

describe("priorityQueue", () => {
  it("is empty to start with", () => {
    const queue = priorityQueue<string>();
    expect(queue.size).toBe(0);
    expect(queue.pop()).toBeUndefined();
  });

  it("pops the lowest priority first, the earliest added on a tie", () => {
    const queue = priorityQueue<string>();
    for (const [priority, item] of [
      [2, "b1"],
      [1, "a1"],
      [3, "c"],
      [1, "a2"],
      [2, "b2"],
    ] as const) {
      queue.push(priority, item);
    }
    expect(queue.size).toBe(5);
    expect(drain(queue)).toEqual(["a1", "a2", "b1", "b2", "c"]);
    expect(queue.size).toBe(0);
  });

  it("matches a stable sort when pushes and pops interleave", () => {
    const random = mulberry32(7);
    const queue = priorityQueue<number>();
    const waiting: Entry[] = [];
    let id = 0;
    // Three in, one out, so the heap grows while it is being drained.
    for (let round = 0; round < 200; round++) {
      for (let i = 0; i < 3; i++) {
        const priority = Math.floor(random() * 20);
        queue.push(priority, id);
        waiting.push({ priority, id });
        id += 1;
      }
      waiting.sort(byPriorityThenId);
      expect(queue.pop()).toBe(waiting.shift()?.id);
    }
    waiting.sort(byPriorityThenId);
    expect(drain(queue)).toEqual(waiting.map((entry) => entry.id));
  });
});
