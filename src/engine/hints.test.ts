import { describe, expect, it } from "vitest";
import { hasUsefulMoves, rankHints } from "./hints.ts";
import { makeState } from "./testing.ts";
import type { GameState } from "./types.ts";
import { klondike } from "./variants/klondike/klondike.ts";
import { spider } from "./variants/spider/spider.ts";

/** Two-suit Spider with an empty stock and the given columns. */
function spiderTable(columns: readonly string[]): GameState {
  return makeState(
    "spider",
    [
      { id: "stock", kind: "stock" },
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ id: `f${i}`, kind: "foundation" as const })),
      ...columns.map((cards, i) => ({ id: `t${i}`, kind: "tableau" as const, cards })),
    ],
    { suits: 2 },
  );
}

function table(spec: { stock?: string; waste?: string; f?: string[]; t?: string[] }): GameState {
  return makeState(
    "klondike",
    [
      { id: "stock", kind: "stock", cards: spec.stock ?? "" },
      { id: "waste", kind: "waste", cards: spec.waste ?? "" },
      ...[0, 1, 2, 3].map((i) => ({
        id: `f${i}`,
        kind: "foundation" as const,
        cards: spec.f?.[i] ?? "",
      })),
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({
        id: `t${i}`,
        kind: "tableau" as const,
        cards: spec.t?.[i] ?? "",
      })),
    ],
    { draw: 1 },
  );
}

describe("rankHints", () => {
  it("puts foundation moves first, then uncovering hidden cards, then the stock", () => {
    const state = table({
      stock: "-5D",
      t: ["AH", "-2C -3C 9S", "10D", "-4C 8H", "9C"],
    });
    const hints = rankHints(klondike, state);
    expect(hints[0]).toEqual({ kind: "move", from: "t0", index: 0, to: "f0" });
    // Uncovering two hidden cards beats uncovering one.
    expect(hints[1]).toEqual({ kind: "move", from: "t1", index: 2, to: "t2" });
    expect(hints[2]).toMatchObject({ kind: "move", from: "t3", index: 1 });
    expect(hints.at(-1)).toEqual({ kind: "draw" });
  });

  it("skips moving a run between equivalent places", () => {
    const state = table({ t: ["10S 9H", "10C"] });
    expect(rankHints(klondike, state)).toEqual([]);
  });

  it("suggests a shuffle that frees a card for the foundation", () => {
    const state = table({ f: ["AS"], t: ["3H 2S 9H", "10C"] });
    // 9H isn't on a valid parent here, so this simply uncovers the 2 of spades.
    expect(rankHints(klondike, state)[0]).toEqual({ kind: "move", from: "t0", index: 2, to: "t1" });
  });

  it("suggests a run off one parent when it frees that parent for the foundation", () => {
    const state = table({ f: ["AS 2S"], t: ["3S 2H", "3C"] });
    expect(rankHints(klondike, state)[0]).toEqual({ kind: "move", from: "t0", index: 1, to: "t1" });
  });

  it("suggests moving a run onto a parent of its own suit in Spider", () => {
    const state = spiderTable(["-3C 6S 5H", "-4C 6H"]);
    expect(rankHints(spider, state)).toContainEqual({
      kind: "move",
      from: "t0",
      index: 2,
      to: "t1",
    });
    expect(hasUsefulMoves(spider, state)).toBe(true);
  });

  it("skips moving a Spider run off a parent of its own suit", () => {
    const state = spiderTable(["-3C 6H 5H", "-4C 6S"]);
    expect(rankHints(spider, state)).toEqual([]);
  });

  it("only suggests legal moves", () => {
    let state = klondike.deal(11, { draw: 3 });
    for (let i = 0; i < 100; i++) {
      const current = state;
      const hints = rankHints(klondike, current);
      expect(hints.every((move) => klondike.canMove(current, move))).toBe(true);
      state = klondike.applyMove(current, [...hints, ...klondike.legalMoves(current)][0]!);
    }
  });
});

describe("hasUsefulMoves", () => {
  it("finds a useful move hidden in the stock", () => {
    expect(hasUsefulMoves(klondike, table({ stock: "-AH -9C -8C", t: ["KS"] }))).toBe(true);
  });

  it("reports when only stock cycling is left", () => {
    expect(hasUsefulMoves(klondike, table({ stock: "-9C -8C", waste: "7C", t: ["KS"] }))).toBe(
      false,
    );
  });
});
