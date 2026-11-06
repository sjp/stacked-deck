import { describe, expect, it } from "vitest";
import { findPile, getPile } from "../../state.ts";
import { allOfferedMovesLegal, codes, makeState, walk } from "../../testing.ts";
import type { GameState } from "../../types.ts";
import { freecell, maxMovable } from "./freecell.ts";

function table(spec: { c?: string[]; f?: string[]; t?: string[] }): GameState {
  return makeState("freecell", [
    ...[0, 1, 2, 3].map((i) => ({ id: `c${i}`, kind: "cell" as const, cards: spec.c?.[i] ?? "" })),
    ...[0, 1, 2, 3].map((i) => ({
      id: `f${i}`,
      kind: "foundation" as const,
      cards: spec.f?.[i] ?? "",
    })),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
      id: `t${i}`,
      kind: "tableau" as const,
      cards: spec.t?.[i] ?? "8D",
    })),
  ]);
}

const RUN = "KS QH JC 10D 9S 8H 7C 6D";

describe("deal", () => {
  it("deals four columns of 7 and four of 6, all face up", () => {
    const state = freecell.deal(5, {});
    const lengths = ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"].map(
      (id) => getPile(state, id).cards.length,
    );
    expect(lengths).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
    expect(state.piles.every((pile) => pile.cards.every((card) => card.faceUp))).toBe(true);
  });
});

describe("supermove", () => {
  it("is (1 + free cells) × 2^(empty columns)", () => {
    expect(maxMovable(table({ c: ["AS", "2S", "3S", "4S"] }), false)).toBe(1);
    expect(maxMovable(table({}), false)).toBe(5);
    expect(maxMovable(table({ t: ["", "", "8C"] }), false)).toBe(20);
    expect(maxMovable(table({ t: ["", "", "8C"] }), true)).toBe(10);
    expect(maxMovable(table({ c: ["AS", "2S", "3S"], t: [""] }), true)).toBe(2);
  });

  it("allows a run that fits and rejects one that doesn't, with a reason", () => {
    const state = table({ c: ["AS", "2S", "3S"], t: [RUN, "7S"] });
    // 1 free cell, no empty columns: 2 cards at most.
    expect(freecell.canMove(state, { kind: "move", from: "t0", index: 7, to: "t1" })).toBe(true);
    expect(freecell.canMove(state, { kind: "move", from: "t0", index: 6, to: "t1" })).toBe(false);
    const wide = table({ c: ["AS", "2S", "3S"], t: ["KS QH JC 10D 9S 8H 7C", "8D"] });
    expect(freecell.dropMove(wide, "t0", 4, "t1")).toBeUndefined();
    expect(freecell.explainMove?.(wide, "t0", 4, "t1")).toBeUndefined();
    const tooLong = table({ c: ["AS", "2S", "3S"], t: ["9H 8S 7H 6S", "10C"] });
    expect(freecell.explainMove?.(tooLong, "t0", 0, "t1")).toBe(
      "Not enough free space to move 4 cards (2 at most)",
    );
  });
});

describe("cells and foundations", () => {
  it("holds one card per cell", () => {
    const state = table({ c: ["AS"] });
    expect(freecell.canMove(state, { kind: "move", from: "t0", index: 0, to: "c0" })).toBe(false);
    expect(freecell.canMove(state, { kind: "move", from: "t0", index: 0, to: "c1" })).toBe(true);
  });

  it("builds foundations up by suit", () => {
    const state = table({ c: ["AS"], t: ["2S"] });
    const ace = freecell.applyMove(state, { kind: "move", from: "c0", index: 0, to: "f0" });
    expect(codes(findPile(ace, "f0"))).toBe("AS");
    expect(freecell.canMove(ace, { kind: "move", from: "t0", index: 0, to: "f0" })).toBe(true);
  });

  it("lets any card into an empty column", () => {
    const state = table({ t: ["", "5H"] });
    expect(freecell.canMove(state, { kind: "move", from: "t1", index: 0, to: "t0" })).toBe(true);
  });
});

describe("finishing", () => {
  it("can finish when every column runs high to low", () => {
    expect(freecell.canFinish?.(table({ t: ["KS QS 2H", "3C"] }))).toBe(true);
    expect(freecell.canFinish?.(table({ t: ["2S 3S"] }))).toBe(false);
  });
});

describe("legal moves", () => {
  it.each([1, 2, 3, 4])("are all legal (seed %i)", (seed) => {
    const states = walk(freecell, freecell.deal(seed, {}), 150);
    expect(states.length).toBeGreaterThan(5);
    expect(allOfferedMovesLegal(freecell, states)).toBe(true);
  });
});
