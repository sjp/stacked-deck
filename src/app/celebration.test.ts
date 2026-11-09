import { describe, expect, it } from "vitest";
import { makeState } from "../engine/testing.ts";
import { cardsForCelebration } from "./celebration.ts";

describe("win celebration cards", () => {
  it("throws foundation cards from the top down, one pile at a time", () => {
    const state = makeState("klondike", [
      { id: "f0", kind: "foundation", cards: "AS 2S" },
      { id: "f1", kind: "foundation", cards: "AH" },
      { id: "waste", kind: "waste", cards: "9C" },
    ]);
    expect(cardsForCelebration(state).map((card) => `${card.rank}${card.suit[0]}`)).toEqual([
      "2s",
      "1h",
      "1s",
    ]);
  });

  it("throws the waste in games without foundations", () => {
    const state = makeState("golf", [
      { id: "t0", kind: "tableau" },
      { id: "waste", kind: "waste", cards: "4C 5D" },
    ]);
    expect(cardsForCelebration(state).map((card) => card.rank)).toEqual([5, 4]);
  });
});
