import { describe, expect, it } from "vitest";
import { hasUsefulMoves } from "../../hints.ts";
import { solve } from "../../solver.ts";
import { findPile, getPile } from "../../state.ts";
import { allOfferedMovesLegal, cards, codes, makeState, walk } from "../../testing.ts";
import type { GameState } from "../../types.ts";
import { isExposed, pyramid, pyramidId } from "./pyramid.ts";

/** A pyramid from rows of shorthand ("" for a removed card), plus stock and waste. */
const THREE_PASSES = { passes: 3 };

function table(rows: string[][], stock = "", waste = "", options = THREE_PASSES, recycles = 0) {
  const piles = [];
  for (let row = 0; row < 7; row++) {
    for (let column = 0; column <= row; column++) {
      piles.push({
        id: pyramidId(row, column),
        kind: "tableau" as const,
        cards: rows[row]?.[column] ?? "",
      });
    }
  }
  return makeState(
    "pyramid",
    [
      ...piles,
      { id: "stock", kind: "stock" as const, cards: stock },
      { id: "waste", kind: "waste" as const, cards: waste },
      { id: "f0", kind: "foundation" as const },
    ],
    options,
    { recycles },
  );
}

const FULL = [
  ["5S"],
  ["6H", "7D"],
  ["8C", "9S", "10H"],
  ["JD", "QC", "KS", "AH"],
  ["2D", "3C", "4S", "5H", "6D"],
  ["7C", "8S", "9H", "10D", "JC", "QS"],
  ["KH", "AD", "2S", "3H", "4D", "5C", "8S"],
];

describe("deal", () => {
  it("deals 28 face-up cards and 24 to the stock with its top showing", () => {
    const state = pyramid.deal(3, pyramid.defaultOptions);
    const pyramidCards = state.piles.filter((pile) => pile.id.startsWith("p"));
    expect(pyramidCards.map((pile) => pile.cards.length)).toEqual(
      Array.from({ length: 28 }, () => 1),
    );
    expect(pyramidCards.flatMap((pile) => pile.cards).every((card) => card.faceUp)).toBe(true);
    const stock = getPile(state, "stock").cards;
    expect(stock).toHaveLength(24);
    expect(stock.map((card) => card.faceUp).lastIndexOf(true)).toBe(23);
    expect(stock.filter((card) => card.faceUp)).toHaveLength(1);
  });
});

describe("exposure", () => {
  it("frees a card only when both cards over it are gone", () => {
    const rows = FULL.map((row) => [...row]);
    expect(isExposed(table(rows), pyramidId(6, 0))).toBe(true);
    expect(isExposed(table(rows), pyramidId(5, 0))).toBe(false);
    rows[6]![0] = "";
    expect(isExposed(table(rows), pyramidId(5, 0))).toBe(false);
    rows[6]![1] = "";
    expect(isExposed(table(rows), pyramidId(5, 0))).toBe(true);
  });
});

describe("removing", () => {
  it("removes exposed pairs that add up to 13", () => {
    const state = table(FULL);
    const pair = (a: string, b: string) =>
      pyramid.canMove(state, { kind: "remove", piles: [a, b] });
    // 5♣ + 8♠ on the bottom row.
    expect(pair(pyramidId(6, 5), pyramidId(6, 6))).toBe(true);
    // K♥ + A♦ make 14.
    expect(pair(pyramidId(6, 0), pyramidId(6, 1))).toBe(false);
    // A♦ + Q♠, but the queen is covered.
    expect(pair(pyramidId(6, 1), pyramidId(5, 5))).toBe(false);
  });

  it("removes a King on its own", () => {
    const state = table(FULL);
    const next = pyramid.applyMove(state, { kind: "remove", piles: [pyramidId(6, 0)] });
    expect(codes(findPile(next, "f0"))).toBe("KH");
    expect(next.score).toBe(5);
    expect(pyramid.canMove(state, { kind: "remove", piles: [pyramidId(6, 1)] })).toBe(false);
  });

  it("pairs with the stock and waste tops, and shows the next stock card", () => {
    const state = table(FULL, "-9C 8D", "QD");
    expect(pyramid.canMove(state, { kind: "remove", piles: ["stock", "waste"] })).toBe(false);
    const withAce = table(FULL, "-9C 8D", "5D");
    const next = pyramid.applyMove(withAce, { kind: "remove", piles: ["stock", "waste"] });
    expect(codes(findPile(next, "stock"))).toBe("9C");
    expect(
      pyramid.canMove(table(FULL, "", "QD"), { kind: "remove", piles: ["waste", pyramidId(6, 1)] }),
    ).toBe(true);
  });

  it("scores rows and clearing the pyramid", () => {
    const state = table(
      [
        ["6S"],
        ["", ""],
        ["", "", ""],
        ["", "", "", ""],
        ["", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", "", ""],
      ],
      "",
      "7H",
    );
    const next = pyramid.applyMove(state, { kind: "remove", piles: [pyramidId(0, 0), "waste"] });
    expect(pyramid.isWon(next)).toBe(true);
    expect(next.score).toBe(5 + 25 + 500);
  });
});

describe("stock", () => {
  it("allows three passes by default", () => {
    expect(pyramid.canMove(table(FULL, "", "AS", { passes: 3 }, 1), { kind: "recycle" })).toBe(
      true,
    );
    expect(pyramid.canMove(table(FULL, "", "AS", { passes: 3 }, 2), { kind: "recycle" })).toBe(
      false,
    );
    expect(pyramid.canMove(table(FULL, "", "AS", { passes: 0 }, 50), { kind: "recycle" })).toBe(
      true,
    );
  });

  it("recycles with the top card showing", () => {
    const next = pyramid.applyMove(table(FULL, "", "AS 2S"), { kind: "recycle" });
    expect(codes(findPile(next, "stock"))).toBe("-2S AS");
  });
});

describe("taps", () => {
  it("removes a King or an only pair, otherwise waits for a choice", () => {
    const state = table(FULL);
    expect(pyramid.tapMoves(state, pyramidId(6, 0), 0)).toEqual([
      { kind: "remove", piles: [pyramidId(6, 0)] },
    ]);
    expect(pyramid.tapMoves(state, pyramidId(6, 2), 0)).toEqual([]);
    expect(pyramid.canPickUp(state, pyramidId(6, 2), 0)).toBe(true);
    expect(pyramid.canPickUp(state, pyramidId(5, 2), 0)).toBe(false);
  });
});

describe("legal moves", () => {
  it.each([1, 2, 3])("are all legal (seed %i)", (seed) => {
    const states: GameState[] = walk(pyramid, pyramid.deal(seed, { passes: 0 }), 150);
    expect(states.length).toBeGreaterThan(10);
    expect(allOfferedMovesLegal(pyramid, states)).toBe(true);
  });
});

describe("state keys", () => {
  const UNLIMITED = { passes: 0 };

  it("ignore the order cards were discarded in", () => {
    const state = table([["6S"]], "2C", "3D");
    const discards = cards("KH QD AC");
    const withDiscards = (order: readonly number[]): GameState => ({
      ...state,
      piles: [
        ...state.piles.filter((pile) => pile.id !== "f0"),
        { id: "f0", kind: "foundation", cards: order.map((index) => discards[index]!) },
      ],
    });
    expect(pyramid.stateKey?.(withDiscards([0, 1, 2]))).toBe(
      pyramid.stateKey?.(withDiscards([1, 2, 0])),
    );
  });

  it("let a dead end with unlimited passes be found quickly", () => {
    const state = table([["6S"]], "2C 3D", "", UNLIMITED);
    expect(solve(pyramid, state, { maxNodes: 1000, maxMs: 1000 })).toMatchObject({
      status: "exhausted",
    });
    expect(hasUsefulMoves(pyramid, state)).toBe(false);
  });
});
