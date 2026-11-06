import { describe, expect, it } from "vitest";
import { getPile } from "../../state.ts";
import { allOfferedMovesLegal, makeState, walk } from "../../testing.ts";
import type { VariantOptions } from "../../types.ts";
import { golf, golfScore } from "./golf.ts";

const CLASSIC = { wrap: false, onKing: false };

function table(columns: string[], waste: string, stock = "", options: VariantOptions = CLASSIC) {
  return makeState(
    "golf",
    [
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({
        id: `t${i}`,
        kind: "tableau" as const,
        cards: columns[i] ?? "",
      })),
      { id: "stock", kind: "stock" as const, cards: stock },
      { id: "waste", kind: "waste" as const, cards: waste },
    ],
    options,
  );
}

describe("deal", () => {
  it("deals seven columns of five face up, one to the waste and 16 to the stock", () => {
    const state = golf.deal(6, golf.defaultOptions);
    for (let i = 0; i < 7; i++) {
      expect(getPile(state, `t${i}`).cards).toHaveLength(5);
    }
    expect(getPile(state, "waste").cards).toHaveLength(1);
    expect(getPile(state, "stock").cards).toHaveLength(16);
    expect(state.score).toBe(35);
  });
});

describe("rules", () => {
  it("plays the top card of a column one rank up or down", () => {
    const state = table(["2C 5H", "9D 7S"], "6D");
    expect(golf.canMove(state, { kind: "move", from: "t0", index: 1, to: "waste" })).toBe(true);
    expect(golf.canMove(state, { kind: "move", from: "t1", index: 1, to: "waste" })).toBe(true);
    expect(golf.tapMoves(state, "t0", 0)).toEqual([
      { kind: "move", from: "t0", index: 1, to: "waste" },
    ]);
  });

  it.each([
    [CLASSIC, false, false, false],
    [{ wrap: true, onKing: false }, true, false, false],
    [{ wrap: false, onKing: true }, false, true, false],
    [{ wrap: true, onKing: true }, true, true, true],
  ])("follows the options %o", (options, wraps, onKing, aceOnKingAllowed) => {
    const aceOnKing = table(["AH"], "KS", "", options);
    const queenOnKing = table(["QH"], "KS", "", options);
    const kingOnAce = table(["KH"], "AS", "", options);
    const move = { kind: "move", from: "t0", index: 0, to: "waste" } as const;
    expect(golf.canMove(kingOnAce, move)).toBe(wraps);
    expect(golf.canMove(queenOnKing, move)).toBe(onKing);
    expect(golf.canMove(aceOnKing, move)).toBe(aceOnKingAllowed);
  });
});

describe("scoring", () => {
  it("counts the cards left, or minus the stock left after clearing", () => {
    expect(golfScore(table(["2C 5H", "9D"], "6D", "-3S"))).toBe(3);
    const cleared = golf.applyMove(table(["5H"], "6D", "-3S -4S"), {
      kind: "move",
      from: "t0",
      index: 0,
      to: "waste",
    });
    expect(golf.isWon(cleared)).toBe(true);
    expect(cleared.score).toBe(-2);
    expect(golf.lowScoreWins).toBe(true);
  });
});

describe("legal moves", () => {
  it.each([1, 2, 3])("are all legal (seed %i)", (seed) => {
    const states = walk(golf, golf.deal(seed, golf.defaultOptions), 60);
    expect(allOfferedMovesLegal(golf, states)).toBe(true);
  });
});
