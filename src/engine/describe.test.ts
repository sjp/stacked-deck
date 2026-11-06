import { describe, expect, it } from "vitest";
import { cardLabel, describeMove, pileLabel, pileName } from "./describe.ts";
import { card, makeState } from "./testing.ts";

const state = makeState("klondike", [
  { id: "stock", kind: "stock", cards: "-AS" },
  { id: "waste", kind: "waste", cards: "7H" },
  { id: "f0", kind: "foundation" },
  { id: "t0", kind: "tableau", cards: "-2C 8S" },
  { id: "t1", kind: "tableau", cards: "9H 8C 7D" },
  { id: "t2", kind: "tableau" },
]);

describe("labels", () => {
  it("names cards", () => {
    expect(cardLabel(card("7H"))).toBe("7 of hearts");
    expect(cardLabel(card("-7H"))).toBe("face-down card");
  });

  it("names and describes piles", () => {
    expect(pileName(state, "t1")).toBe("column 2");
    expect(pileName(state, "f0")).toBe("foundation 1");
    expect(pileLabel(state, "t0")).toBe("Column 1, 2 cards, top: 8 of spades");
    expect(pileLabel(state, "t2")).toBe("Column 3, empty");
    expect(pileLabel(state, "stock")).toBe("Stock, 1 card, top: face-down card");
  });
});

describe("describeMove", () => {
  it("describes each kind of move", () => {
    expect(describeMove(state, { kind: "move", from: "waste", index: 0, to: "t0" })).toBe(
      "Moved 7 of hearts to column 1",
    );
    expect(describeMove(state, { kind: "move", from: "t1", index: 1, to: "t2" })).toBe(
      "Moved 8 of clubs and 1 more to column 3",
    );
    expect(describeMove(state, { kind: "draw" })).toBe("Turned a card from the stock");
    expect(describeMove(state, { kind: "flip", pile: "t0" })).toBe(
      "Turned over a card in column 1",
    );
    expect(describeMove(state, { kind: "remove", piles: ["waste", "t0"] })).toBe(
      "Removed 7 of hearts and 8 of spades",
    );
  });
});
