import { describe, expect, it } from "vitest";
import { makeState } from "../engine/testing.ts";
import { highlightFor } from "./useHints.ts";

const STATE = makeState("klondike", [
  { id: "stock", kind: "stock", cards: "-4C -5C" },
  { id: "t0", kind: "tableau", cards: "-9C 8H" },
  { id: "t1", kind: "tableau", cards: "9S" },
]);

describe("hint highlights", () => {
  it("light the moving cards and their destination", () => {
    expect(highlightFor(STATE, { kind: "move", from: "t0", index: 1, to: "t1" })).toEqual({
      from: { pile: "t0", index: 1 },
      to: "t1",
    });
  });

  it("light the top card for flips and the stock for draws", () => {
    expect(highlightFor(STATE, { kind: "flip", pile: "t0" })).toEqual({
      from: { pile: "t0", index: 1 },
    });
    expect(highlightFor(STATE, { kind: "draw" })).toEqual({ from: { pile: "stock", index: 1 } });
  });

  it("light both cards of a pair", () => {
    expect(highlightFor(STATE, { kind: "remove", piles: ["t0", "t1"] })).toEqual({
      from: { pile: "t0", index: 1 },
      to: "t1",
    });
    expect(highlightFor(STATE, { kind: "remove", piles: [] })).toEqual({});
  });
});
