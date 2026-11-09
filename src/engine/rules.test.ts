import { describe, expect, it } from "vitest";
import {
  canAddToFoundation,
  canStackAlternating,
  isAlternatingRun,
  isSafeForFoundation,
  transfer,
} from "./rules.ts";
import { card, cards, makeState } from "./testing.ts";

function withFoundations(...piles: string[]) {
  return makeState(
    "klondike",
    piles.map((shorthand, i) => ({ id: `f${i}`, kind: "foundation" as const, cards: shorthand })),
  );
}

describe("tableau rules", () => {
  it("stack down in alternating colours on a face-up card", () => {
    expect(canStackAlternating(card("6H"), card("7S"))).toBe(true);
    expect(canStackAlternating(card("6H"), card("7D"))).toBe(false);
    expect(canStackAlternating(card("6H"), card("-7S"))).toBe(false);
    expect(canStackAlternating(card("6H"), undefined)).toBe(false);
  });

  it("check runs from any index, rejecting out-of-range ones", () => {
    const run = cards("-KS 9H 8S 7D");
    expect(isAlternatingRun(run, 1)).toBe(true);
    expect(isAlternatingRun(run, 3)).toBe(true);
    expect(isAlternatingRun(run, 0)).toBe(false);
    expect(isAlternatingRun(run, 4)).toBe(false);
    expect(isAlternatingRun(run, -1)).toBe(false);
  });
});

describe("foundation rules", () => {
  it("build up by suit from the Ace", () => {
    const [empty, hearts] = withFoundations("", "AH 2H").piles;
    expect(canAddToFoundation(card("AS"), empty!)).toBe(true);
    expect(canAddToFoundation(card("2S"), empty!)).toBe(false);
    expect(canAddToFoundation(card("3H"), hearts!)).toBe(true);
    expect(canAddToFoundation(card("3D"), hearts!)).toBe(false);
  });

  it("call a card safe once both opposite-colour suits are a rank below", () => {
    const state = withFoundations("AS 2S 3S 4S", "AC 2C 3C");
    expect(isSafeForFoundation(state, card("2H"))).toBe(true);
    expect(isSafeForFoundation(state, card("4H"))).toBe(true);
    expect(isSafeForFoundation(state, card("5H"))).toBe(false);
    expect(isSafeForFoundation(state, card("3S"))).toBe(false);
  });
});

describe("transfer", () => {
  it("moves the cards from an index onto another pile", () => {
    const state = makeState("klondike", [
      { id: "t0", kind: "tableau", cards: "KS QH JC" },
      { id: "t1", kind: "tableau", cards: "QD" },
    ]);
    const changes = transfer(state, "t0", 2, "t1");
    expect(changes["t0"]).toHaveLength(2);
    expect(changes["t1"]?.map((c) => c.rank)).toEqual([12, 11]);
  });

  it("changes nothing for an unknown pile", () => {
    const state = makeState("klondike", [{ id: "t0", kind: "tableau", cards: "KS" }]);
    expect(transfer(state, "t0", 0, "nowhere")).toEqual({});
  });
});
