import { describe, expect, it } from "vitest";
import { play } from "../../game.ts";
import { counter, getPile } from "../../state.ts";
import { allOfferedMovesLegal, makeState, walk } from "../../testing.ts";
import { coveringCards, tripeaks } from "./tripeaks.ts";

function table(cards: Readonly<Record<number, string>>, waste: string, stock = "", chain = 0) {
  return makeState(
    "tripeaks",
    [
      ...Array.from({ length: 28 }, (_, i) => ({
        id: `p${i}`,
        kind: "tableau" as const,
        cards: cards[i] ?? "",
      })),
      { id: "stock", kind: "stock" as const, cards: stock },
      { id: "waste", kind: "waste" as const, cards: waste },
    ],
    { wrap: true },
    { chain },
  );
}

describe("deal", () => {
  it("deals 28 cards with only the bottom row face up, one to the waste", () => {
    const state = tripeaks.deal(2, tripeaks.defaultOptions);
    const faces = Array.from({ length: 28 }, (_, i) => getPile(state, `p${i}`).cards[0]?.faceUp);
    expect(faces.filter(Boolean)).toHaveLength(10);
    expect(faces.slice(18).every(Boolean)).toBe(true);
    expect(getPile(state, "waste").cards).toHaveLength(1);
    expect(getPile(state, "stock").cards).toHaveLength(23);
  });
});

describe("covering", () => {
  it("maps each card to the two cards over it", () => {
    expect(coveringCards(0)).toEqual([3, 4]);
    expect(coveringCards(2)).toEqual([7, 8]);
    expect(coveringCards(3)).toEqual([9, 10]);
    expect(coveringCards(4)).toEqual([10, 11]);
    expect(coveringCards(5)).toEqual([12, 13]);
    expect(coveringCards(9)).toEqual([18, 19]);
    expect(coveringCards(17)).toEqual([26, 27]);
    expect(coveringCards(27)).toEqual([]);
  });

  it("flips a card only when both covering cards are gone", () => {
    const state = table({ 17: "-QS", 26: "9C", 27: "8H" }, "7D");
    const first = play(
      tripeaks,
      state,
      { kind: "move", from: "p27", index: 0, to: "waste" },
      {
        safeToFoundation: false,
      },
    )!;
    expect(getPile(first.state, "p17").cards[0]?.faceUp).toBe(false);
    const second = play(
      tripeaks,
      first.state,
      { kind: "move", from: "p26", index: 0, to: "waste" },
      {
        safeToFoundation: false,
      },
    )!;
    expect(second.moves.at(-1)).toEqual({ kind: "flip", pile: "p17" });
    expect(getPile(second.state, "p17").cards[0]?.faceUp).toBe(true);
  });
});

describe("play", () => {
  it("plays one rank up or down, wrapping King and Ace by default", () => {
    const state = table({ 20: "KS", 21: "5H", 22: "3C" }, "AD");
    expect(tripeaks.legalMoves(state).filter((move) => move.kind === "move")).toEqual([
      { kind: "move", from: "p20", index: 0, to: "waste" },
    ]);
    const noWrap = { ...state, options: { wrap: false } };
    expect(tripeaks.canMove(noWrap, { kind: "move", from: "p20", index: 0, to: "waste" })).toBe(
      false,
    );
  });

  it("scores a rising chain that resets after a draw", () => {
    let state = table({ 20: "5H", 21: "6S", 22: "7D" }, "4C", "-9S");
    state = tripeaks.applyMove(state, { kind: "move", from: "p20", index: 0, to: "waste" });
    state = tripeaks.applyMove(state, { kind: "move", from: "p21", index: 0, to: "waste" });
    expect(state.score).toBe(1 + 2);
    state = tripeaks.applyMove(state, { kind: "draw" });
    expect(counter(state, "chain")).toBe(0);
    expect(tripeaks.canMove(state, { kind: "move", from: "p22", index: 0, to: "waste" })).toBe(
      false,
    );
  });

  it("adds a bonus for each peak cleared, and more for the last one", () => {
    const state = table({ 0: "5H", 1: "6S", 2: "7D" }, "4C");
    const one = tripeaks.applyMove(state, { kind: "move", from: "p0", index: 0, to: "waste" });
    expect(one.score).toBe(1 + 15);
    const two = tripeaks.applyMove(one, { kind: "move", from: "p1", index: 0, to: "waste" });
    const three = tripeaks.applyMove(two, { kind: "move", from: "p2", index: 0, to: "waste" });
    expect(three.score).toBe(1 + 15 + 2 + 15 + 3 + 15 + 30);
    expect(tripeaks.isWon(three)).toBe(true);
  });

  it("has one pass through the stock", () => {
    const state = table({ 20: "9H" }, "2C");
    expect(tripeaks.legalMoves(state)).toEqual([]);
    expect(tripeaks.isStuck?.(state)).toBe(true);
  });
});

describe("legal moves", () => {
  it.each([1, 2, 3])("are all legal (seed %i)", (seed) => {
    const states = walk(tripeaks, tripeaks.deal(seed, tripeaks.defaultOptions), 80);
    expect(allOfferedMovesLegal(tripeaks, states)).toBe(true);
  });
});
